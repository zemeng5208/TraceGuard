using System.Diagnostics;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Monitoring;

public sealed class ProcessMonitor(Action<TraceEvent> publish) : IDisposable
{
    private readonly HashSet<int> _known = [];
    private Timer? _timer;

    public void Start()
    {
        Stop();
        foreach (var process in Process.GetProcesses()) _known.Add(process.Id);
        _timer = new Timer(_ => Poll(), null, 1000, 1000);
    }

    private void Poll()
    {
        try
        {
            var current = Process.GetProcesses();
            var ids = current.Select(process => process.Id).ToHashSet();
            foreach (var process in current.Where(process => !_known.Contains(process.Id)))
            {
                publish(new TraceEvent(0, DateTimeOffset.UtcNow, "process", "START", "A process started", "进程已启动", process.ProcessName, process.ProcessName, process.Id, "normal"));
            }
            _known.Clear();
            _known.UnionWith(ids);
            foreach (var process in current) process.Dispose();
        }
        catch { }
    }

    public void Stop() { _timer?.Dispose(); _timer = null; _known.Clear(); }
    public void Dispose() => Stop();
}
