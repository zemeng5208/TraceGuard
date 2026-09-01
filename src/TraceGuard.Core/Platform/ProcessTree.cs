using System.Runtime.InteropServices;

namespace TraceGuard.Core.Platform;

public static class ProcessTree
{
    private const uint SnapshotProcess = 0x00000002;
    private static readonly IntPtr InvalidHandle = new(-1);

    public static int? GetParentPid(int processId)
        => GetParentPidMap().GetValueOrDefault(processId);

    public static IReadOnlyDictionary<int, int?> GetParentPidMap()
    {
        var result = new Dictionary<int, int?>();
        var snapshot = CreateToolhelp32Snapshot(SnapshotProcess, 0);
        if (snapshot == InvalidHandle) return result;
        try
        {
            var entry = new ProcessEntry { Size = (uint)Marshal.SizeOf<ProcessEntry>() };
            if (!Process32First(snapshot, ref entry)) return result;
            do { result[unchecked((int)entry.ProcessId)] = entry.ParentProcessId == 0 ? null : unchecked((int)entry.ParentProcessId); }
            while (Process32Next(snapshot, ref entry));
            return result;
        }
        finally { CloseHandle(snapshot); }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct ProcessEntry
    {
        public uint Size;
        public uint Usage;
        public uint ProcessId;
        public IntPtr DefaultHeapId;
        public uint ModuleId;
        public uint Threads;
        public uint ParentProcessId;
        public int BasePriority;
        public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string? ExeFile;
    }

    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern bool Process32First(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
