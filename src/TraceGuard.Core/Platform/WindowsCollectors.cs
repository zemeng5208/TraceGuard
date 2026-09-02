using System.ComponentModel;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;
using System.ServiceProcess;
using TraceGuard.Core.Models;
using TraceGuard.Core.Protection;

namespace TraceGuard.Core.Platform;

public static class WindowsCollectors
{
    private const string DisabledStartupPath = @"Software\TraceGuard\DisabledStartup";
    private static readonly object ScheduledTaskGate = new();
    private static IReadOnlyList<StartupRow> _scheduledTasks = [];
    private static DateTimeOffset _scheduledTasksAt = DateTimeOffset.MinValue;
    private static readonly object ProcessMetricsGate = new();
    private static readonly Dictionary<int, (DateTimeOffset At, double CpuMs, long IoBytes)> ProcessMetrics = [];

    public static IReadOnlyList<ProcessRow> Processes()
    {
        var rows = new List<ProcessRow>();
        var parentPids = ProcessTree.GetParentPidMap();
        foreach (var process in Process.GetProcesses().OrderBy(p => p.ProcessName))
        {
            try
            {
                var name = process.ProcessName;
                var path = Try(() => process.MainModule?.FileName);
                var permission = CoreGuard.IsProtectedProcess(name) ? "protected" : CanTerminate(process.Id) ? "controllable" : "observable";
                var metrics = SampleProcessMetrics(process);
                rows.Add(new ProcessRow(process.Id, parentPids.GetValueOrDefault(process.Id), name + ".exe", path, metrics.Cpu, Try(() => process.WorkingSet64), metrics.IoBytesPerSecond, null, permission));
            }
            catch { }
            finally { process.Dispose(); }
        }
        return rows;
    }

    public static IReadOnlyList<ServiceRow> Services()
    {
        var rows = new List<ServiceRow>();
        foreach (var service in ServiceController.GetServices().OrderBy(s => s.DisplayName))
        {
            try
            {
                var protectedService = CoreGuard.IsProtectedService(service.ServiceName);
                var canControl = !protectedService && service.CanStop && CanControlService(service.ServiceName);
                rows.Add(new ServiceRow(
                    service.ServiceName,
                    service.DisplayName,
                    service.Status.ToString(),
                    Try(() => service.StartType.ToString()) ?? "Unknown",
                    ReadServiceImagePath(service.ServiceName),
                    protectedService ? "Microsoft Corporation" : null,
                    protectedService ? "windows-core" : IsLikelyWindowsService(service.ServiceName) ? "windows-optional" : "unknown",
                    protectedService ? "protected" : canControl ? "controllable" : "observable"));
            }
            catch { }
            finally { service.Dispose(); }
        }
        return rows;
    }

    public static IReadOnlyList<StartupRow> StartupItems()
    {
        var rows = new List<StartupRow>();
        ReadRunKey(rows, @"Software\Microsoft\Windows\CurrentVersion\Run", "run");
        ReadRunKey(rows, @"Software\Microsoft\Windows\CurrentVersion\RunOnce", "run-once");
        var folder = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
        if (Directory.Exists(folder))
        {
            foreach (var file in Directory.EnumerateFiles(folder)) rows.Add(new StartupRow(Path.GetFileNameWithoutExtension(file), file, "startup-folder", true, "controllable"));
        }
        ReadScheduledTasks(rows);
        return rows;
    }

    public static IReadOnlyList<RestoreItem> RestoreItems()
    {
        var rows = new List<RestoreItem>();
        try
        {
            using var root = Registry.CurrentUser.OpenSubKey(DisabledStartupPath, writable: false);
            if (root is null) return rows;
            foreach (var id in root.GetSubKeyNames())
            {
                using var item = root.OpenSubKey(id, writable: false);
                if (item is null) continue;
                var name = Convert.ToString(item.GetValue("Name")) ?? string.Empty;
                var source = Convert.ToString(item.GetValue("Source")) ?? string.Empty;
                var command = Convert.ToString(item.GetValue("Command")) ?? string.Empty;
                var disabled = DateTimeOffset.TryParse(Convert.ToString(item.GetValue("DisabledAt")), out var timestamp) ? timestamp : DateTimeOffset.MinValue;
                if (!string.IsNullOrWhiteSpace(name)) rows.Add(new RestoreItem(id, name, source, command, disabled, "controllable"));
            }
            foreach (var legacyName in root.GetValueNames())
            {
                var split = legacyName.Split('|', 2);
                if (split.Length != 2) continue;
                rows.Add(new RestoreItem($"legacy:{legacyName}", split[1], split[0], Convert.ToString(root.GetValue(legacyName)) ?? string.Empty, DateTimeOffset.MinValue, "controllable"));
            }
        }
        catch (UnauthorizedAccessException) { }
        return rows.OrderByDescending(item => item.DisabledAt).ToArray();
    }

    public static ActionResult StopProcess(int pid)
    {
        if (ExecutionPrivilegeGuard.IsBlocked) return CoreGuard.ElevatedExecutionDenied();
        try
        {
            using var process = Process.GetProcessById(pid);
            if (CoreGuard.IsProtectedProcess(process.ProcessName)) return CoreGuard.Denied();
            process.Kill(false);
            return new(true, "Process stopped.", "进程已停止。");
        }
        catch (Win32Exception) { return Elevated(); }
        catch (UnauthorizedAccessException) { return Elevated(); }
        catch (ArgumentException) { return new(false, "Process is no longer running.", "进程已不再运行。"); }
    }

    public static ActionResult StopService(string name)
    {
        if (ExecutionPrivilegeGuard.IsBlocked) return CoreGuard.ElevatedExecutionDenied();
        if (CoreGuard.IsProtectedService(name)) return CoreGuard.Denied();
        try
        {
            using var service = new ServiceController(name);
            if (!service.CanStop) return Elevated();
            service.Stop();
            return new(true, "Service stop requested.", "已请求停止服务。");
        }
        catch (InvalidOperationException) { return Elevated(); }
        catch (Win32Exception) { return Elevated(); }
    }

    public static ActionResult DisableStartup(string name, string source)
    {
        if (ExecutionPrivilegeGuard.IsBlocked) return CoreGuard.ElevatedExecutionDenied();
        try
        {
            if (source is "run" or "run-once")
            {
                var sourcePath = source == "run" ? @"Software\Microsoft\Windows\CurrentVersion\Run" : @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
                using var sourceKey = Registry.CurrentUser.OpenSubKey(sourcePath, writable: true);
                var value = sourceKey?.GetValue(name, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                if (value is null) return new(false, "Startup item was not found.", "未找到该启动项。");
                var id = Guid.NewGuid().ToString("N");
                using var backup = Registry.CurrentUser.CreateSubKey($@"{DisabledStartupPath}\{id}", writable: true);
                backup.SetValue("Name", name, RegistryValueKind.String);
                backup.SetValue("Source", source, RegistryValueKind.String);
                backup.SetValue("Command", Convert.ToString(value) ?? string.Empty, RegistryValueKind.String);
                backup.SetValue("Kind", (int)sourceKey!.GetValueKind(name), RegistryValueKind.DWord);
                backup.SetValue("DisabledAt", DateTimeOffset.UtcNow.ToString("O"), RegistryValueKind.String);
                sourceKey!.DeleteValue(name, throwOnMissingValue: false);
                return new(true, "User startup item disabled.", "用户级启动项已禁用。");
            }
            if (source == "startup-folder")
            {
                var startup = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                var file = Directory.EnumerateFiles(startup).FirstOrDefault(path => string.Equals(Path.GetFileNameWithoutExtension(path), name, StringComparison.OrdinalIgnoreCase));
                if (file is null) return new(false, "Startup item was not found.", "未找到该启动项。");
                var disabled = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TraceGuard", "DisabledStartup");
                Directory.CreateDirectory(disabled);
                var id = Guid.NewGuid().ToString("N");
                var storedPath = Path.Combine(disabled, id + Path.GetExtension(file));
                using (var backup = Registry.CurrentUser.CreateSubKey($@"{DisabledStartupPath}\{id}", writable: true))
                {
                    backup.SetValue("Name", name, RegistryValueKind.String);
                    backup.SetValue("Source", source, RegistryValueKind.String);
                    backup.SetValue("Command", file, RegistryValueKind.String);
                    backup.SetValue("StoredPath", storedPath, RegistryValueKind.String);
                    backup.SetValue("DisabledAt", DateTimeOffset.UtcNow.ToString("O"), RegistryValueKind.String);
                }
                try { File.Move(file, storedPath, false); }
                catch
                {
                    Registry.CurrentUser.DeleteSubKeyTree($@"{DisabledStartupPath}\{id}", throwOnMissingSubKey: false);
                    throw;
                }
                return new(true, "User startup item disabled.", "用户级启动项已禁用。");
            }
            return new(false, "Observed but cannot be controlled in Zero-Privilege Mode.", "已检测到，但零提权模式下当前用户没有权限控制。");
        }
        catch (UnauthorizedAccessException) { return Elevated(); }
        catch (IOException error) { return new(false, error.Message, "禁用启动项时发生文件错误。"); }
    }

    public static ActionResult RestoreStartup(string id)
    {
        if (ExecutionPrivilegeGuard.IsBlocked) return CoreGuard.ElevatedExecutionDenied();
        try
        {
            if (id.StartsWith("legacy:", StringComparison.Ordinal)) return RestoreLegacy(id[7..]);
            using var backup = Registry.CurrentUser.OpenSubKey($@"{DisabledStartupPath}\{id}", writable: false);
            if (backup is null) return new(false, "Restore item was not found.", "未找到恢复项目。");
            var name = Convert.ToString(backup.GetValue("Name")) ?? string.Empty;
            var source = Convert.ToString(backup.GetValue("Source")) ?? string.Empty;
            var command = Convert.ToString(backup.GetValue("Command")) ?? string.Empty;
            if (source is "run" or "run-once")
            {
                var targetPath = source == "run" ? @"Software\Microsoft\Windows\CurrentVersion\Run" : @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
                using var target = Registry.CurrentUser.CreateSubKey(targetPath, writable: true);
                if (target.GetValue(name) is not null) return new(false, "A startup item with the same name already exists.", "同名启动项已经存在，未覆盖现有配置。");
                var kindValue = Convert.ToInt32(backup.GetValue("Kind", (int)RegistryValueKind.String));
                var kind = Enum.IsDefined(typeof(RegistryValueKind), kindValue) ? (RegistryValueKind)kindValue : RegistryValueKind.String;
                target.SetValue(name, command, kind);
            }
            else if (source == "startup-folder")
            {
                var storedPath = Convert.ToString(backup.GetValue("StoredPath"));
                if (string.IsNullOrWhiteSpace(storedPath) || !File.Exists(storedPath)) return new(false, "Stored startup file is missing.", "用于恢复的启动文件已丢失。");
                if (File.Exists(command)) return new(false, "A startup file with the same name already exists.", "同名启动文件已经存在，未覆盖现有文件。");
                Directory.CreateDirectory(Path.GetDirectoryName(command)!);
                File.Move(storedPath, command, false);
            }
            else return new(false, "This item cannot be restored in Zero-Privilege Mode.", "零提权模式下无法恢复此项目。");
            Registry.CurrentUser.DeleteSubKeyTree($@"{DisabledStartupPath}\{id}", throwOnMissingSubKey: false);
            return new(true, "User startup item restored.", "用户级启动项已恢复。");
        }
        catch (UnauthorizedAccessException) { return Elevated(); }
        catch (IOException error) { return new(false, error.Message, "恢复启动项时发生文件错误。"); }
    }

    private static ActionResult RestoreLegacy(string valueName)
    {
        using var root = Registry.CurrentUser.OpenSubKey(DisabledStartupPath, writable: true);
        var command = Convert.ToString(root?.GetValue(valueName));
        var split = valueName.Split('|', 2);
        if (root is null || command is null || split.Length != 2 || !(split[0] is "run" or "run-once")) return new(false, "Legacy restore item is invalid.", "旧版恢复项目无效。");
        var targetPath = split[0] == "run" ? @"Software\Microsoft\Windows\CurrentVersion\Run" : @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
        using var target = Registry.CurrentUser.CreateSubKey(targetPath, writable: true);
        if (target.GetValue(split[1]) is not null) return new(false, "A startup item with the same name already exists.", "同名启动项已经存在，未覆盖现有配置。");
        target.SetValue(split[1], command, RegistryValueKind.String);
        root.DeleteValue(valueName, throwOnMissingValue: false);
        return new(true, "User startup item restored.", "用户级启动项已恢复。");
    }

    private static void ReadRunKey(List<StartupRow> rows, string path, string source)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(path, writable: false);
            if (key is null) return;
            foreach (var name in key.GetValueNames()) rows.Add(new StartupRow(name, Convert.ToString(key.GetValue(name)) ?? string.Empty, source, true, "controllable"));
        }
        catch (UnauthorizedAccessException) { }
    }

    private static void ReadScheduledTasks(List<StartupRow> rows)
    {
        lock (ScheduledTaskGate)
        {
            if (DateTimeOffset.UtcNow - _scheduledTasksAt < TimeSpan.FromSeconds(30)) { rows.AddRange(_scheduledTasks); return; }
            try
            {
                var discovered = new List<StartupRow>();
                using var process = Process.Start(new ProcessStartInfo("schtasks.exe", "/Query /FO CSV /NH")
                {
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                });
                if (process is null) return;
                var output = process.StandardOutput.ReadToEnd();
                if (!process.WaitForExit(4000)) { try { process.Kill(); } catch { } return; }
                foreach (var line in output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
                {
                    var columns = ParseCsvLine(line);
                    if (columns.Count == 0 || string.IsNullOrWhiteSpace(columns[0])) continue;
                    var taskName = columns[0];
                    var protectedTask = taskName.StartsWith(@"\Microsoft\Windows\", StringComparison.OrdinalIgnoreCase);
                    discovered.Add(new StartupRow(taskName, columns.Count > 1 ? columns[1] : string.Empty, "scheduled-task", true, protectedTask ? "protected" : "observable"));
                }
                _scheduledTasks = discovered;
                _scheduledTasksAt = DateTimeOffset.UtcNow;
                rows.AddRange(discovered);
            }
            catch { }
        }
    }

    private static IReadOnlyList<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        var quoted = false;
        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"')
            {
                if (quoted && index + 1 < line.Length && line[index + 1] == '"') { current.Append('"'); index++; }
                else quoted = !quoted;
            }
            else if (character == ',' && !quoted) { values.Add(current.ToString()); current.Clear(); }
            else current.Append(character);
        }
        values.Add(current.ToString());
        return values;
    }

    private static string? ReadServiceImagePath(string name)
    {
        try { using var key = Registry.LocalMachine.OpenSubKey($@"SYSTEM\CurrentControlSet\Services\{name}"); return Convert.ToString(key?.GetValue("ImagePath")); }
        catch { return null; }
    }

    private static bool IsLikelyWindowsService(string name) => name.StartsWith("Win", StringComparison.OrdinalIgnoreCase) || name is "Spooler" or "W32Time" or "BITS" or "wuauserv";
    private static ActionResult Elevated() => new(false, "Requires elevated permission. TraceGuard Zero-Privilege Mode will not request administrator rights.", "需要更高权限，TraceGuard 零提权模式不会请求管理员权限。", true);

    private static bool CanTerminate(int pid)
    {
        var handle = OpenProcess(0x0001, false, pid);
        if (handle == IntPtr.Zero) return false;
        CloseHandle(handle);
        return true;
    }

    private static bool CanControlService(string name)
    {
        var manager = OpenSCManager(null, null, 0x0001);
        if (manager == IntPtr.Zero) return false;
        try
        {
            var service = OpenService(manager, name, 0x0020);
            if (service == IntPtr.Zero) return false;
            CloseServiceHandle(service);
            return true;
        }
        finally { CloseServiceHandle(manager); }
    }

    private static (double Cpu, long IoBytesPerSecond) SampleProcessMetrics(Process process)
    {
        var now = DateTimeOffset.UtcNow;
        var cpuMs = Try(() => process.TotalProcessorTime.TotalMilliseconds);
        var ioBytes = TryGetIoBytes(process.Id);
        lock (ProcessMetricsGate)
        {
            var cpu = 0d;
            var ioRate = 0L;
            if (ProcessMetrics.TryGetValue(process.Id, out var previous))
            {
                var seconds = Math.Max(.1, (now - previous.At).TotalSeconds);
                cpu = Math.Clamp((cpuMs - previous.CpuMs) / (seconds * 1000 * Math.Max(1, Environment.ProcessorCount)) * 100, 0, 100);
                ioRate = Math.Max(0, (long)((ioBytes - previous.IoBytes) / seconds));
            }
            ProcessMetrics[process.Id] = (now, cpuMs, ioBytes);
            if (ProcessMetrics.Count > 4096)
            {
                foreach (var stale in ProcessMetrics.Where(item => now - item.Value.At > TimeSpan.FromMinutes(2)).Select(item => item.Key).ToArray()) ProcessMetrics.Remove(stale);
            }
            return (cpu, ioRate);
        }
    }

    internal static long TryGetIoBytes(int pid)
    {
        var handle = OpenProcess(0x1000, false, pid);
        if (handle == IntPtr.Zero) return 0;
        try
        {
            if (!GetProcessIoCounters(handle, out var counters)) return 0;
            var total = counters.ReadTransferCount > ulong.MaxValue - counters.WriteTransferCount ? ulong.MaxValue : counters.ReadTransferCount + counters.WriteTransferCount;
            return total > long.MaxValue ? long.MaxValue : (long)total;
        }
        finally { CloseHandle(handle); }
    }

    private static T? Try<T>(Func<T> action) { try { return action(); } catch { return default; } }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inherit, int processId);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenSCManager(string? machineName, string? databaseName, uint desiredAccess);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenService(IntPtr manager, string serviceName, uint desiredAccess);
    [DllImport("advapi32.dll", SetLastError = true)] private static extern bool CloseServiceHandle(IntPtr handle);
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperationCount; public ulong WriteOperationCount; public ulong OtherOperationCount; public ulong ReadTransferCount; public ulong WriteTransferCount; public ulong OtherTransferCount; }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetProcessIoCounters(IntPtr processHandle, out IoCounters counters);
}

public sealed class SystemSampler
{
    private ulong _previousIdle;
    private ulong _previousKernel;
    private ulong _previousUser;
    private long _previousNetwork;
    private DateTimeOffset _previousNetworkAt = DateTimeOffset.UtcNow;
    private long _previousIo;
    private DateTimeOffset _previousIoAt = DateTimeOffset.UtcNow;

    public (double Cpu, double Memory, long NetworkBytesPerSecond, long IoBytesPerSecond) Sample()
    {
        var cpu = SampleCpu();
        var memory = SampleMemory();
        var network = SampleNetwork();
        return (cpu, memory, network, SampleIo());
    }

    private double SampleCpu()
    {
        if (!GetSystemTimes(out var idle, out var kernel, out var user)) return 0;
        var i = ToUInt64(idle); var k = ToUInt64(kernel); var u = ToUInt64(user);
        var total = (k - _previousKernel) + (u - _previousUser);
        var idleDelta = i - _previousIdle;
        _previousIdle = i; _previousKernel = k; _previousUser = u;
        return total == 0 ? 0 : Math.Clamp((total - idleDelta) * 100d / total, 0, 100);
    }

    private static double SampleMemory()
    {
        var status = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        return GlobalMemoryStatusEx(ref status) ? status.MemoryLoad : 0;
    }

    private long SampleNetwork()
    {
        var total = NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up).Sum(n => { try { var s = n.GetIPv4Statistics(); return s.BytesReceived + s.BytesSent; } catch { return 0L; } });
        var now = DateTimeOffset.UtcNow;
        var seconds = Math.Max(.1, (now - _previousNetworkAt).TotalSeconds);
        var rate = _previousNetwork == 0 ? 0 : Math.Max(0, (long)((total - _previousNetwork) / seconds));
        _previousNetwork = total; _previousNetworkAt = now;
        return rate;
    }

    private long SampleIo()
    {
        long total = 0;
        foreach (var process in Process.GetProcesses())
        {
            try { total = checked(total + WindowsCollectors.TryGetIoBytes(process.Id)); }
            catch (OverflowException) { total = long.MaxValue; }
            finally { process.Dispose(); }
        }
        var now = DateTimeOffset.UtcNow;
        var seconds = Math.Max(.1, (now - _previousIoAt).TotalSeconds);
        var rate = _previousIo == 0 || total < _previousIo ? 0 : Math.Max(0, (long)((total - _previousIo) / seconds));
        _previousIo = total; _previousIoAt = now;
        return rate;
    }

    private static ulong ToUInt64(FileTime value) => ((ulong)value.High << 32) | value.Low;
    [StructLayout(LayoutKind.Sequential)] private struct FileTime { public uint Low; public uint High; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)] private struct MemoryStatus { public uint Length; public uint MemoryLoad; public ulong TotalPhysical; public ulong AvailablePhysical; public ulong TotalPageFile; public ulong AvailablePageFile; public ulong TotalVirtual; public ulong AvailableVirtual; public ulong AvailableExtendedVirtual; }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetSystemTimes(out FileTime idle, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
}
