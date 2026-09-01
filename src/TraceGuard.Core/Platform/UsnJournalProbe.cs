using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Platform;

public static class UsnJournalProbe
{
    private const uint FsctlQueryUsnJournal = 0x000900f4;
    private const uint OpenExisting = 3;
    private const int ErrorAccessDenied = 5;
    private const int ErrorJournalNotActive = 1179;
    private static readonly object Gate = new();
    private static MonitorModuleStatus? _cached;
    private static DateTimeOffset _cachedAt = DateTimeOffset.MinValue;

    public static MonitorModuleStatus GetStatus()
    {
        lock (Gate)
        {
            if (_cached is not null && DateTimeOffset.UtcNow - _cachedAt < TimeSpan.FromMinutes(1)) return _cached;
            _cached = Probe();
            _cachedAt = DateTimeOffset.UtcNow;
            return _cached;
        }
    }

    private static MonitorModuleStatus Probe()
    {
        if (!OperatingSystem.IsWindows())
            return Unavailable("USN Journal is available only on Windows NTFS volumes.", "USN Journal 仅适用于 Windows NTFS 卷。");

        var readable = new List<string>();
        var accessDenied = new List<string>();
        var inactive = new List<string>();
        var ntfsVolumes = 0;
        foreach (var drive in DriveInfo.GetDrives())
        {
            try
            {
                if (!drive.IsReady || drive.DriveType != DriveType.Fixed || !string.Equals(drive.DriveFormat, "NTFS", StringComparison.OrdinalIgnoreCase)) continue;
                ntfsVolumes++;
                var label = drive.Name.TrimEnd(Path.DirectorySeparatorChar);
                using var handle = CreateFile($@"\\.\{label}", 0, FileShare.ReadWrite | FileShare.Delete, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
                if (handle.IsInvalid)
                {
                    if (Marshal.GetLastWin32Error() == ErrorAccessDenied) accessDenied.Add(label);
                    continue;
                }

                if (DeviceIoControl(handle, FsctlQueryUsnJournal, IntPtr.Zero, 0, out UsnJournalDataV0 _, Marshal.SizeOf<UsnJournalDataV0>(), out _, IntPtr.Zero))
                {
                    readable.Add(label);
                    continue;
                }

                var error = Marshal.GetLastWin32Error();
                if (error == ErrorAccessDenied) accessDenied.Add(label);
                else if (error == ErrorJournalNotActive) inactive.Add(label);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { accessDenied.Add(drive.Name.TrimEnd(Path.DirectorySeparatorChar)); }
            catch (Win32Exception) { }
        }

        if (readable.Count > 0)
        {
            var volumes = string.Join(", ", readable);
            return new("usn", "available",
                $"Readable with the current user token on {volumes}. FileSystemWatcher remains active until journal event attribution is enabled.",
                $"当前用户令牌可读取 {volumes}。在 USN 事件归属功能启用前仍继续使用 FileSystemWatcher。");
        }
        if (ntfsVolumes == 0) return Unavailable("No ready local NTFS volume was found.", "未发现已就绪的本地 NTFS 卷。");
        if (accessDenied.Count > 0)
        {
            var volumes = string.Join(", ", accessDenied.Distinct(StringComparer.OrdinalIgnoreCase));
            return Unavailable($"The current user cannot query the journal on {volumes}; TraceGuard will not request elevation.", $"当前用户无法查询 {volumes} 的日志；TraceGuard 不会请求提权。");
        }
        if (inactive.Count > 0)
        {
            var volumes = string.Join(", ", inactive.Distinct(StringComparer.OrdinalIgnoreCase));
            return Unavailable($"No active journal was found on {volumes}; TraceGuard will not create or modify one.", $"{volumes} 没有活动日志；TraceGuard 不会创建或修改日志。");
        }
        return Unavailable("USN Journal capability could not be confirmed; FileSystemWatcher remains active.", "无法确认 USN Journal 能力；继续使用 FileSystemWatcher。");
    }

    private static MonitorModuleStatus Unavailable(string message, string messageZh) => new("usn", "unavailable", message, messageZh);

    [StructLayout(LayoutKind.Sequential)]
    private struct UsnJournalDataV0
    {
        public ulong UsnJournalId;
        public long FirstUsn;
        public long NextUsn;
        public long LowestValidUsn;
        public long MaxUsn;
        public ulong MaximumSize;
        public ulong AllocationDelta;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string fileName, uint desiredAccess, FileShare shareMode, IntPtr securityAttributes, uint creationDisposition, uint flagsAndAttributes, IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DeviceIoControl(SafeFileHandle device, uint controlCode, IntPtr inputBuffer, int inputBufferSize, out UsnJournalDataV0 outputBuffer, int outputBufferSize, out int bytesReturned, IntPtr overlapped);
}
