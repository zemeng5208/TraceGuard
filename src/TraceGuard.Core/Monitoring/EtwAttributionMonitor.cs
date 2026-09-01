using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Diagnostics.Tracing;
using Microsoft.Diagnostics.Tracing.Session;
using TraceGuard.Core.Platform;
using EtwTraceEvent = Microsoft.Diagnostics.Tracing.TraceEvent;
using ModelTraceEvent = TraceGuard.Core.Models.TraceEvent;

namespace TraceGuard.Core.Monitoring;

/// <summary>
/// Optional, read-only attribution for metadata events. This is a normal real-time
/// ETW session, never the privileged NT Kernel Logger. It starts only when the
/// current token already has Performance Log Users membership.
/// </summary>
public sealed class EtwAttributionMonitor : IDisposable
{
    private const string ProcessProvider = "Microsoft-Windows-Kernel-Process";
    private const string FileProvider = "Microsoft-Windows-Kernel-File";
    private const ulong ProcessKeyword = 0x10;
    private const ulong FileKeywords = 0x1e90;
    private const int MaxObservations = 4096;
    private static readonly TimeSpan MatchWindow = TimeSpan.FromSeconds(8);

    private readonly object _gate = new();
    private readonly ConcurrentQueue<FileObservation> _observations = new();
    private readonly ConcurrentDictionary<ulong, string> _fileNames = new();
    private readonly IReadOnlyDictionary<string, string> _deviceRoots = BuildDeviceRootMap();
    private TraceEventSession? _session;
    private Task? _consumer;
    private string? _lastError;

    public bool IsRunning { get { lock (_gate) return _session is not null && _consumer is { IsCompleted: false }; } }
    public string? LastError { get { lock (_gate) return _lastError; } }

    public bool Start(bool fileProvider, bool processProvider)
    {
        Stop();
        if (!OperatingSystem.IsWindows() || (!fileProvider && !processProvider) || !EtwCapabilityProbe.CanControlUserSessions()) return false;

        lock (_gate)
        {
            try
            {
                var session = new TraceEventSession($"TraceGuard.User.{Environment.ProcessId}") { StopOnDispose = true };
                _session = session;
                session.Source.Dynamic.All += OnEvent;
                if (processProvider) session.EnableProvider(ProcessProvider, TraceEventLevel.Informational, ProcessKeyword);
                if (fileProvider) session.EnableProvider(FileProvider, TraceEventLevel.Informational, FileKeywords);
                _consumer = Task.Run(() =>
                {
                    try { session.Source.Process(); }
                    catch (Exception error) when (error is InvalidOperationException or UnauthorizedAccessException or System.ComponentModel.Win32Exception)
                    {
                        lock (_gate) _lastError = error.Message;
                    }
                });
                return true;
            }
            catch (Exception error) when (error is InvalidOperationException or UnauthorizedAccessException or System.ComponentModel.Win32Exception)
            {
                _lastError = error.Message;
                _session?.Dispose();
                _session = null;
                _consumer = null;
                return false;
            }
        }
    }

    public ModelTraceEvent Attribute(ModelTraceEvent item)
    {
        if (item.Category != "file" || item.Pid is not null) return item;
        var now = DateTimeOffset.UtcNow;
        while (_observations.TryPeek(out var expired) && now - expired.ObservedAt > MatchWindow) _observations.TryDequeue(out _);

        var detail = NormalizePath(item.Detail);
        var match = _observations.Reverse().FirstOrDefault(value =>
            now - value.ObservedAt <= MatchWindow &&
            string.Equals(value.Path, detail, StringComparison.OrdinalIgnoreCase) &&
            ActionsCompatible(item.Action, value.Action));
        return match is null ? item : item with { ProcessName = match.ProcessName, Pid = match.Pid };
    }

    private void OnEvent(EtwTraceEvent data)
    {
        try
        {
            if (!string.Equals(data.ProviderName, FileProvider, StringComparison.OrdinalIgnoreCase)) return;
            var eventId = (int)data.ID;
            if (eventId == 10)
            {
                var fileKey = ReadUInt64(data, "FileKey");
                var fileName = ReadString(data, "FileName");
                if (fileKey is not null && !string.IsNullOrWhiteSpace(fileName)) _fileNames[fileKey.Value] = NormalizePath(fileName);
                return;
            }

            var action = MapFileAction(eventId);
            if (action is null || data.ProcessID <= 0) return;
            var path = ReadString(data, "FileName");
            if (string.IsNullOrWhiteSpace(path))
            {
                var fileKey = ReadUInt64(data, "FileKey");
                if (fileKey is not null) _fileNames.TryGetValue(fileKey.Value, out path);
            }
            if (string.IsNullOrWhiteSpace(path)) return;

            RecordObservation(new FileObservation(NormalizePath(path), action, data.ProcessID,
                ReadProcessName(data.ProcessID), DateTimeOffset.UtcNow));
        }
        catch (Exception error) when (error is InvalidOperationException or ArgumentException or OverflowException) { }
    }

    internal void RecordObservation(FileObservation observation)
    {
        _observations.Enqueue(observation);
        while (_observations.Count > MaxObservations) _observations.TryDequeue(out _);
    }

    internal static string? MapFileAction(int eventId) => eventId switch
    {
        30 => "CREATE",
        26 => "DELETE",
        27 or 28 => "RENAME",
        16 => "MODIFY",
        _ => null,
    };

    internal static bool ActionsCompatible(string observed, string attributed) =>
        string.Equals(observed, attributed, StringComparison.OrdinalIgnoreCase) ||
        (string.Equals(observed, "MODIFY", StringComparison.OrdinalIgnoreCase) && string.Equals(attributed, "CREATE", StringComparison.OrdinalIgnoreCase));

    internal string NormalizePath(string path)
    {
        path = UsnJournalMonitor.NormalizeExtendedPath(path);
        foreach (var pair in _deviceRoots)
            if (path.StartsWith(pair.Key, StringComparison.OrdinalIgnoreCase)) return pair.Value + path[pair.Key.Length..];
        return path;
    }

    private static string? ReadString(EtwTraceEvent data, string name) => data.PayloadByName(name)?.ToString();

    private static ulong? ReadUInt64(EtwTraceEvent data, string name)
    {
        var value = data.PayloadByName(name);
        if (value is null) return null;
        return value switch
        {
            ulong number => number,
            long number => unchecked((ulong)number),
            uint number => number,
            int number => unchecked((uint)number),
            IntPtr number => unchecked((ulong)number.ToInt64()),
            _ => Convert.ToUInt64(value),
        };
    }

    private static string? ReadProcessName(int pid)
    {
        try { using var process = Process.GetProcessById(pid); return process.ProcessName + ".exe"; }
        catch (ArgumentException) { return null; }
        catch (InvalidOperationException) { return null; }
        catch (System.ComponentModel.Win32Exception) { return null; }
    }

    private static IReadOnlyDictionary<string, string> BuildDeviceRootMap()
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!OperatingSystem.IsWindows()) return result;
        foreach (var drive in DriveInfo.GetDrives())
        {
            var name = drive.Name.TrimEnd(Path.DirectorySeparatorChar);
            var buffer = new StringBuilder(1024);
            if (QueryDosDevice(name, buffer, buffer.Capacity) == 0) continue;
            var device = buffer.ToString().Split('\0', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(device)) result[device] = name;
        }
        return result;
    }

    public void Stop()
    {
        TraceEventSession? session;
        Task? consumer;
        lock (_gate)
        {
            session = _session;
            consumer = _consumer;
            _session = null;
            _consumer = null;
        }
        if (session is not null)
        {
            try { session.Stop(); } catch (Exception error) when (error is InvalidOperationException or System.ComponentModel.Win32Exception) { }
            session.Dispose();
        }
        try { consumer?.Wait(TimeSpan.FromSeconds(2)); } catch (AggregateException) { }
        _observations.Clear();
        _fileNames.Clear();
    }

    public void Dispose() => Stop();

    internal sealed record FileObservation(string Path, string Action, int Pid, string? ProcessName, DateTimeOffset ObservedAt);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint QueryDosDevice(string deviceName, StringBuilder targetPath, int maxLength);
}
