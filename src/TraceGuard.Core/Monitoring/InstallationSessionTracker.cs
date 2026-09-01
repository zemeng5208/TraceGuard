using System.Collections.Concurrent;
using TraceGuard.Core.Models;
using TraceGuard.Core.Storage;

namespace TraceGuard.Core.Monitoring;

public sealed class InstallationSessionTracker(EventStore store, RegistrySnapshotService registry, Action<TraceEvent> publish)
{
    private sealed class ActiveState(InstallationSession session, Dictionary<string, string?> registryBefore)
    {
        public InstallationSession Session { get; set; } = session;
        public Dictionary<string, string?> RegistryBefore { get; } = registryBefore;
        public int FilesCreated;
        public int FilesModified;
        public int FilesDeleted;
        public int UserFilesModified;
        public ConcurrentDictionary<int, SessionProcess> Processes { get; } = [];
    }

    private readonly ConcurrentDictionary<int, ActiveState> _active = [];
    private static readonly string[] InstallerTokens = ["setup", "install", "installer", "msiexec", "update", "updater", "bootstrap"];
    public bool RegistryMonitoringEnabled { get; set; }

    public InstallationSession? Current
    {
        get
        {
            var state = _active.Values.OrderByDescending(value => value.Session.StartedAt).FirstOrDefault();
            if (state is null) return null;
            var summary = state.Session.Summary with
            {
                FilesCreated = Volatile.Read(ref state.FilesCreated),
                FilesModified = Volatile.Read(ref state.FilesModified),
                FilesDeleted = Volatile.Read(ref state.FilesDeleted),
                UserFilesModified = Volatile.Read(ref state.UserFilesModified)
            };
            return state.Session with
            {
                ChangeCount = summary.FilesCreated + summary.FilesModified + summary.FilesDeleted,
                ImportantCount = summary.UserFilesModified,
                Summary = summary,
                Processes = state.Processes.Values.OrderBy(process => process.StartedAt).ToArray()
            };
        }
    }

    public void OnProcess(ProcessObservation process)
    {
        if (process.Started)
        {
            var parentState = process.ParentPid is { } parentPid ? _active.Values.FirstOrDefault(state => state.Processes.ContainsKey(parentPid)) : null;
            if (parentState is not null) AddProcess(parentState, process);
            else if (IsInstaller(process.Name, process.Executable)) Start(process);
            return;
        }
        foreach (var state in _active.Values)
        {
            if (!state.Processes.TryGetValue(process.Pid, out var tracked)) continue;
            state.Processes[process.Pid] = tracked with { EndedAt = process.Timestamp };
            if (process.Pid == state.Session.RootPid && _active.TryRemove(process.Pid, out var completed)) _ = CompleteAsync(completed, process.Timestamp);
            break;
        }
    }

    public void OnEvent(TraceEvent item)
    {
        foreach (var state in _active.Values)
        {
            if (item.Category != "file") continue;
            if (item.Action == "CREATE") Interlocked.Increment(ref state.FilesCreated);
            else if (item.Action == "MODIFY") Interlocked.Increment(ref state.FilesModified);
            else if (item.Action == "DELETE") Interlocked.Increment(ref state.FilesDeleted);
            if (item.Severity == "important") Interlocked.Increment(ref state.UserFilesModified);
        }
    }

    private void Start(ProcessObservation process)
    {
        var session = new InstallationSession(Guid.NewGuid().ToString("N"), process.Name, process.Pid, process.Timestamp, null, "recording", 0, 0, new ChangeSummary(0,0,0,0,0,0,0,0,0,0), [], []);
        var state = new ActiveState(session, RegistryMonitoringEnabled ? registry.Capture() : new Dictionary<string, string?>());
        AddProcess(state, process);
        if (!_active.TryAdd(process.Pid, state)) return;
        _ = store.SaveSessionAsync(session);
        publish(new TraceEvent(0, process.Timestamp, "process", "INSTALLER_START", "Installation monitoring started", "已开始监控安装程序", process.Executable ?? process.Name, process.Name, process.Pid, "important"));
    }

    private async Task CompleteAsync(ActiveState state, DateTimeOffset endedAt)
    {
        IReadOnlyList<RegistryChange> changes = RegistryMonitoringEnabled ? registry.Diff(state.RegistryBefore, registry.Capture()) : [];
        var summary = new ChangeSummary(state.FilesCreated, state.FilesModified, state.FilesDeleted,
            changes.Count(change => change.ChangeType == "created"), changes.Count(change => change.ChangeType == "modified"), changes.Count(change => change.ChangeType == "deleted"),
            changes.Count(change => change.Path.Contains("\\Run", StringComparison.OrdinalIgnoreCase)),
            changes.Count(change => change.Path.Contains("Chrome", StringComparison.OrdinalIgnoreCase) || change.Path.Contains("Edge", StringComparison.OrdinalIgnoreCase) || change.Path.Contains("Firefox", StringComparison.OrdinalIgnoreCase)), 0, state.UserFilesModified);
        var count = summary.FilesCreated + summary.FilesModified + summary.FilesDeleted + summary.RegistryCreated + summary.RegistryModified + summary.RegistryDeleted;
        var important = changes.Count(change => change.Severity == "important") + state.UserFilesModified;
        var completed = state.Session with { EndedAt = endedAt, Status = "completed", ChangeCount = count, ImportantCount = important, Summary = summary, RegistryChanges = changes, Processes = state.Processes.Values.OrderBy(process => process.StartedAt).ToArray() };
        await store.SaveSessionAsync(completed);
        publish(new TraceEvent(0, endedAt, "process", "INSTALLER_COMPLETE", "Installation monitoring completed", "安装监控已完成", $"{completed.RootProcess} · {count} changes · {important} important", completed.RootProcess, completed.RootPid, important > 0 ? "important" : "normal"));
    }

    private static bool IsInstaller(string name, string? executable)
    {
        var value = $"{name} {Path.GetFileName(executable)}";
        return InstallerTokens.Any(token => value.Contains(token, StringComparison.OrdinalIgnoreCase));
    }

    private static void AddProcess(ActiveState state, ProcessObservation process) => state.Processes.TryAdd(process.Pid,
        new SessionProcess(process.Pid, process.ParentPid, process.Name, process.Executable, process.Timestamp, null, LaunchSourceAnalyzer.Analyze(process)));
}
