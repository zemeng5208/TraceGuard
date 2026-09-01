using System.ComponentModel;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using System.ServiceProcess;
using TraceGuard.Core.Models;
using TraceGuard.Core.Protection;

namespace TraceGuard.Core.Platform;

public static class WindowsCollectors
{
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
                rows.Add(new ProcessRow(process.Id, parentPids.GetValueOrDefault(process.Id), name + ".exe", path, 0, Try(() => process.WorkingSet64), null, permission));
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
                var canControl = !protectedService && service.CanStop;
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
        return rows;
    }

    public static ActionResult StopProcess(int pid)
    {
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
        try
        {
            if (source is "run" or "run-once")
            {
                var sourcePath = source == "run" ? @"Software\Microsoft\Windows\CurrentVersion\Run" : @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
                using var sourceKey = Registry.CurrentUser.OpenSubKey(sourcePath, writable: true);
                var value = sourceKey?.GetValue(name, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                if (value is null) return new(false, "Startup item was not found.", "未找到该启动项。");
                using var backup = Registry.CurrentUser.CreateSubKey(@"Software\TraceGuard\DisabledStartup", writable: true);
                backup.SetValue($"{source}|{name}", Convert.ToString(value) ?? string.Empty, RegistryValueKind.String);
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
                File.Move(file, Path.Combine(disabled, Path.GetFileName(file)), true);
                return new(true, "User startup item disabled.", "用户级启动项已禁用。");
            }
            return new(false, "Observed but cannot be controlled in Zero-Privilege Mode.", "已检测到，但零提权模式下当前用户没有权限控制。");
        }
        catch (UnauthorizedAccessException) { return Elevated(); }
        catch (IOException error) { return new(false, error.Message, "禁用启动项时发生文件错误。"); }
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

    private static T? Try<T>(Func<T> action) { try { return action(); } catch { return default; } }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inherit, int processId);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}

public sealed class SystemSampler
{
    private ulong _previousIdle;
    private ulong _previousKernel;
    private ulong _previousUser;
    private long _previousNetwork;
    private DateTimeOffset _previousNetworkAt = DateTimeOffset.UtcNow;

    public (double Cpu, double Memory, long NetworkBytesPerSecond) Sample()
    {
        var cpu = SampleCpu();
        var memory = SampleMemory();
        var network = SampleNetwork();
        return (cpu, memory, network);
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

    private static ulong ToUInt64(FileTime value) => ((ulong)value.High << 32) | value.Low;
    [StructLayout(LayoutKind.Sequential)] private struct FileTime { public uint Low; public uint High; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)] private struct MemoryStatus { public uint Length; public uint MemoryLoad; public ulong TotalPhysical; public ulong AvailablePhysical; public ulong TotalPageFile; public ulong AvailablePageFile; public ulong TotalVirtual; public ulong AvailableVirtual; public ulong AvailableExtendedVirtual; }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetSystemTimes(out FileTime idle, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
}
