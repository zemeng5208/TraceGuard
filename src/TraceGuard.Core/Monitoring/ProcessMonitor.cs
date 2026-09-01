using System.Diagnostics;
using TraceGuard.Core.Models;
using TraceGuard.Core.Platform;

namespace TraceGuard.Core.Monitoring;

public sealed class ProcessMonitor(Action<TraceEvent> publish, Action<ProcessObservation> observe) : IDisposable
{
    private readonly Dictionary<int, (string Name, string? Executable, int? ParentPid)> _known = [];
    private Timer? _timer;
    private int _polling;

    public void Start()
    {
        Stop();
        var parentPids = ProcessTree.GetParentPidMap();
        foreach (var process in Process.GetProcesses())
        {
            try { _known[process.Id] = (process.ProcessName + ".exe", TryPath(process), parentPids.GetValueOrDefault(process.Id)); }
            catch { }
            finally { process.Dispose(); }
        }
        _timer = new Timer(_ => Poll(), null, 750, 750);
    }

    private void Poll()
    {
        if (Interlocked.Exchange(ref _polling, 1) == 1) return;
        try
        {
            var current = new Dictionary<int, (string Name, string? Executable, int? ParentPid)>();
            var parentPids = ProcessTree.GetParentPidMap();
            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    var entry = (process.ProcessName + ".exe", TryPath(process), parentPids.GetValueOrDefault(process.Id));
                    current[process.Id] = entry;
                    if (_known.ContainsKey(process.Id)) continue;
                    var timestamp = DateTimeOffset.UtcNow;
                    observe(new ProcessObservation(process.Id, entry.Item3, entry.Item1, entry.Item2, true, timestamp));
                    publish(new TraceEvent(0, timestamp, "process", "START", "A process started", "进程已启动", BuildDetail(entry.Item1, entry.Item3), entry.Item1, process.Id, "normal"));
                }
                catch { }
                finally { process.Dispose(); }
            }
            foreach (var previous in _known.Where(item => !current.ContainsKey(item.Key)))
                observe(new ProcessObservation(previous.Key, previous.Value.ParentPid, previous.Value.Name, previous.Value.Executable, false, DateTimeOffset.UtcNow));
            _known.Clear();
            foreach (var item in current) _known[item.Key] = item.Value;
        }
        catch { }
        finally { Volatile.Write(ref _polling, 0); }
    }

    private static string BuildDetail(string name, int? parentPid) => parentPid is null ? name : $"{name} · Parent PID {parentPid}";
    private static string? TryPath(Process process) { try { return process.MainModule?.FileName; } catch { return null; } }
    public void Stop() { _timer?.Dispose(); _timer = null; _known.Clear(); }
    public void Dispose() => Stop();
}
