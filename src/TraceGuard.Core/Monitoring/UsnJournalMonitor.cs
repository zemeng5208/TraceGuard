using System.Buffers.Binary;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Monitoring;

/// <summary>
/// Tails already-existing NTFS change journals when the current user can open the
/// volume for read access. It never creates, resizes, deletes, or otherwise
/// modifies a journal and never attempts to enable a privilege.
/// </summary>
public sealed class UsnJournalMonitor : IDisposable
{
    private const uint GenericRead = 0x80000000;
    private const uint OpenExisting = 3;
    private const uint FileFlagBackupSemantics = 0x02000000;
    private const uint FsctlQueryUsnJournal = 0x000900f4;
    private const uint FsctlReadUsnJournal = 0x000900bb;
    private const int BufferSize = 64 * 1024;
    private const int HeaderSize = sizeof(long);
    private const int MaxBatchesPerPoll = 8;

    private readonly Action<TraceEvent> _publish;
    private readonly MonitoringPathExclusions _exclusions;
    private readonly object _gate = new();
    private readonly List<VolumeReader> _volumes = [];
    private Timer? _timer;

    internal UsnJournalMonitor(Action<TraceEvent> publish, MonitoringPathExclusions exclusions)
    {
        _publish = publish;
        _exclusions = exclusions;
    }

    public int VolumeCount
    {
        get { lock (_gate) return _volumes.Count; }
    }

    public IReadOnlySet<string> Start()
    {
        Stop();
        var activeRoots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!OperatingSystem.IsWindows()) return activeRoots;

        lock (_gate)
        {
            foreach (var drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (!drive.IsReady || drive.DriveType != DriveType.Fixed ||
                        !string.Equals(drive.DriveFormat, "NTFS", StringComparison.OrdinalIgnoreCase)) continue;

                    var root = drive.RootDirectory.FullName;
                    var volumeName = root.TrimEnd(Path.DirectorySeparatorChar);
                    var handle = CreateFile($@"\\.\{volumeName}", GenericRead,
                        FileShare.ReadWrite | FileShare.Delete, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
                    if (handle.IsInvalid)
                    {
                        handle.Dispose();
                        continue;
                    }

                    if (!TryQuery(handle, out var journal))
                    {
                        handle.Dispose();
                        continue;
                    }

                    // Start at NextUsn. TraceGuard observes new activity only and does
                    // not replay historical filesystem metadata without user intent.
                    _volumes.Add(new VolumeReader(root, handle, journal.UsnJournalId, journal.NextUsn));
                    activeRoots.Add(root);
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }

            if (_volumes.Count > 0)
                _timer = new Timer(_ => Poll(), null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
        }
        return activeRoots;
    }

    private void Poll()
    {
        lock (_gate)
        {
            foreach (var volume in _volumes)
            {
                try { PollVolume(volume); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
    }

    private void PollVolume(VolumeReader volume)
    {
        for (var batch = 0; batch < MaxBatchesPerPoll; batch++)
        {
            var request = new ReadUsnJournalDataV0
            {
                StartUsn = volume.NextUsn,
                ReasonMask = uint.MaxValue,
                ReturnOnlyOnClose = 0,
                Timeout = 0,
                BytesToWaitFor = 0,
                UsnJournalId = volume.JournalId,
            };
            var buffer = new byte[BufferSize];
            if (!DeviceIoControl(volume.Handle, FsctlReadUsnJournal, ref request,
                    Marshal.SizeOf<ReadUsnJournalDataV0>(), buffer, buffer.Length, out var bytesReturned, IntPtr.Zero)) return;
            if (bytesReturned < HeaderSize) return;

            volume.NextUsn = BinaryPrimitives.ReadInt64LittleEndian(buffer.AsSpan(0, HeaderSize));
            var records = ParseRecords(buffer.AsSpan(0, bytesReturned));
            foreach (var record in records)
            {
                var action = ClassifyAction(record.Reason);
                if (action is null) continue;
                var resolvedPath = ResolvePath(volume, record);
                if (resolvedPath is null && _exclusions.IsExcludedUnresolvedFileName(record.FileName)) continue;
                var path = resolvedPath ?? $"{volume.Root}[USN] {record.FileName}";
                if (_exclusions.IsExcluded(path)) continue;
                var (english, chinese) = Messages(action);
                _publish(new TraceEvent(0, DateTimeOffset.UtcNow, "file", action, english, chinese,
                    path, null, null, IsUserDocument(path) ? "important" : "normal"));
            }

            if (bytesReturned < buffer.Length) break;
        }
    }

    private static string? ResolvePath(VolumeReader volume, UsnRecord record)
    {
        var direct = OpenPathById(volume, record.FileReferenceNumber);
        if (!string.IsNullOrWhiteSpace(direct)) return direct;

        var parent = OpenPathById(volume, record.ParentFileReferenceNumber);
        return string.IsNullOrWhiteSpace(parent) ? null : Path.Combine(parent, record.FileName);
    }

    private static string? OpenPathById(VolumeReader volume, ulong fileId)
    {
        var descriptor = new FileIdDescriptor
        {
            Size = (uint)Marshal.SizeOf<FileIdDescriptor>(),
            Type = FileIdType.FileId,
            FileId = unchecked((long)fileId),
        };
        using var handle = OpenFileById(volume.Handle, ref descriptor, 0,
            FileShare.ReadWrite | FileShare.Delete, IntPtr.Zero, FileFlagBackupSemantics);
        if (handle.IsInvalid) return null;

        var buffer = new StringBuilder(512);
        var length = GetFinalPathNameByHandle(handle, buffer, (uint)buffer.Capacity, 0);
        if (length == 0) return null;
        if (length >= buffer.Capacity)
        {
            buffer = new StringBuilder(checked((int)length + 1));
            length = GetFinalPathNameByHandle(handle, buffer, (uint)buffer.Capacity, 0);
            if (length == 0 || length >= buffer.Capacity) return null;
        }
        return NormalizeExtendedPath(buffer.ToString());
    }

    internal static IReadOnlyList<UsnRecord> ParseRecords(ReadOnlySpan<byte> buffer)
    {
        var result = new List<UsnRecord>();
        var offset = HeaderSize;
        while (offset + 60 <= buffer.Length)
        {
            var length = BinaryPrimitives.ReadUInt32LittleEndian(buffer.Slice(offset, 4));
            if (length < 60 || offset + length > buffer.Length) break;
            var major = BinaryPrimitives.ReadUInt16LittleEndian(buffer.Slice(offset + 4, 2));
            if (major == 2)
            {
                var fileNameLength = BinaryPrimitives.ReadUInt16LittleEndian(buffer.Slice(offset + 56, 2));
                var fileNameOffset = BinaryPrimitives.ReadUInt16LittleEndian(buffer.Slice(offset + 58, 2));
                if (fileNameOffset >= 60 && fileNameOffset + fileNameLength <= length && fileNameLength % 2 == 0)
                {
                    result.Add(new UsnRecord(
                        BinaryPrimitives.ReadUInt64LittleEndian(buffer.Slice(offset + 8, 8)),
                        BinaryPrimitives.ReadUInt64LittleEndian(buffer.Slice(offset + 16, 8)),
                        BinaryPrimitives.ReadInt64LittleEndian(buffer.Slice(offset + 24, 8)),
                        BinaryPrimitives.ReadUInt32LittleEndian(buffer.Slice(offset + 40, 4)),
                        Encoding.Unicode.GetString(buffer.Slice(offset + fileNameOffset, fileNameLength))));
                }
            }
            offset += checked((int)length);
        }
        return result;
    }

    internal static string? ClassifyAction(uint reason)
    {
        if ((reason & 0x00000200) != 0) return "DELETE";
        if ((reason & (0x00001000 | 0x00002000)) != 0) return "RENAME";
        if ((reason & 0x00000100) != 0) return "CREATE";
        if ((reason & 0x80000000) != 0 && reason == 0x80000000) return null;
        return (reason & 0x7ffffcff) != 0 ? "MODIFY" : null;
    }

    internal static string NormalizeExtendedPath(string path) =>
        path.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase) ? @"\\" + path[8..] :
        path.StartsWith(@"\\?\", StringComparison.OrdinalIgnoreCase) ? path[4..] : path;

    private static (string English, string Chinese) Messages(string action) => action switch
    {
        "CREATE" => ("A file was created", "创建了文件"),
        "DELETE" => ("A file was deleted", "删除了文件"),
        "RENAME" => ("A file was renamed or moved", "文件被重命名或移动"),
        _ => ("A file was modified", "修改了文件"),
    };

    private static bool IsUserDocument(string path)
    {
        var special = new[] { Environment.SpecialFolder.DesktopDirectory, Environment.SpecialFolder.MyDocuments, Environment.SpecialFolder.MyPictures };
        return special.Select(Environment.GetFolderPath).Where(p => !string.IsNullOrWhiteSpace(p))
            .Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));
    }

    private static bool TryQuery(SafeFileHandle handle, out UsnJournalDataV0 journal) =>
        DeviceIoControl(handle, FsctlQueryUsnJournal, IntPtr.Zero, 0, out journal,
            Marshal.SizeOf<UsnJournalDataV0>(), out _, IntPtr.Zero);

    public void Stop()
    {
        lock (_gate)
        {
            _timer?.Dispose();
            _timer = null;
            foreach (var volume in _volumes) volume.Dispose();
            _volumes.Clear();
        }
    }

    public void Dispose() => Stop();

    internal sealed record UsnRecord(ulong FileReferenceNumber, ulong ParentFileReferenceNumber, long Usn, uint Reason, string FileName);

    private sealed class VolumeReader(string root, SafeFileHandle handle, ulong journalId, long nextUsn) : IDisposable
    {
        public string Root { get; } = root;
        public SafeFileHandle Handle { get; } = handle;
        public ulong JournalId { get; } = journalId;
        public long NextUsn { get; set; } = nextUsn;
        public void Dispose() => Handle.Dispose();
    }

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

    [StructLayout(LayoutKind.Sequential)]
    private struct ReadUsnJournalDataV0
    {
        public long StartUsn;
        public uint ReasonMask;
        public uint ReturnOnlyOnClose;
        public ulong Timeout;
        public ulong BytesToWaitFor;
        public ulong UsnJournalId;
    }

    private enum FileIdType : uint { FileId = 0 }

    [StructLayout(LayoutKind.Sequential)]
    private struct FileIdDescriptor
    {
        public uint Size;
        public FileIdType Type;
        public long FileId;
        public long Reserved;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string fileName, uint desiredAccess, FileShare shareMode,
        IntPtr securityAttributes, uint creationDisposition, uint flagsAndAttributes, IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DeviceIoControl(SafeFileHandle device, uint controlCode, IntPtr inputBuffer,
        int inputBufferSize, out UsnJournalDataV0 outputBuffer, int outputBufferSize, out int bytesReturned, IntPtr overlapped);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DeviceIoControl(SafeFileHandle device, uint controlCode, ref ReadUsnJournalDataV0 inputBuffer,
        int inputBufferSize, [Out] byte[] outputBuffer, int outputBufferSize, out int bytesReturned, IntPtr overlapped);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern SafeFileHandle OpenFileById(SafeFileHandle volumeHandle, ref FileIdDescriptor fileId,
        uint desiredAccess, FileShare shareMode, IntPtr securityAttributes, uint flagsAndAttributes);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandle(SafeFileHandle fileHandle, StringBuilder filePath,
        uint filePathLength, uint flags);
}
