using System.Diagnostics;
using System.ServiceProcess;
using TraceGuard.Core.Models;
using TraceGuard.Core.Monitoring;
using TraceGuard.Core.Platform;
using TraceGuard.Core.Storage;

namespace TraceGuard.Core;

public sealed class CoreHost : IDisposable
{
    private readonly EventStore _events;
    private readonly SettingsStore _settingsStore;
    private readonly FileMonitor _files;
    private readonly ProcessMonitor _processes;
    private readonly InstallationSessionTracker _sessions;
    private readonly RuleEngine _rules;
    private readonly ConfigurationMonitor _configurations;
    private readonly SystemSampler _sampler = new();
    private AppSettings _settings = new();
    private bool _monitoring;

    public CoreHost(AppPaths paths, Action<TraceEvent> publish)
    {
        _events = new EventStore(paths);
        _settingsStore = new SettingsStore(paths);
        _files = new FileMonitor(item => QueueEvent(item, publish));
        _sessions = new InstallationSessionTracker(_events, new RegistrySnapshotService(), item => QueueEvent(item, publish));
        _rules = new RuleEngine(_events, item => QueueEvent(item, publish));
        _configurations = new ConfigurationMonitor(item => QueueEvent(item, publish));
        _processes = new ProcessMonitor(item => QueueEvent(item, publish), observation => { _sessions.OnProcess(observation); _rules.OnProcess(observation); });
    }

    public async Task InitializeAsync()
    {
        await _events.InitializeAsync();
        _settings = await _settingsStore.LoadAsync();
        _sessions.RegistryMonitoringEnabled = _settings.RegistryMonitoring;
        await _rules.InitializeAsync();
        await _events.ApplyRetentionAsync(_settings.RetentionDays);
        StartMonitoring();
    }

    public async Task<Overview> GetOverviewAsync()
    {
        var sample = _sampler.Sample();
        return new Overview(
            await _events.CountCategoryAsync("file"),
            await _events.CountCategoryAsync("registry"),
            CountProcesses(),
            CountServices(),
            0,
            sample.NetworkBytesPerSecond,
            sample.Cpu,
            sample.Memory,
            _monitoring,
            _sessions.Current is { } session ? new ActiveInstaller(session.RootProcess, session.RootPid, Math.Max(0, (int)(DateTimeOffset.UtcNow - session.StartedAt).TotalSeconds), session.ChangeCount) : null);
    }

    public Task<IReadOnlyList<TraceEvent>> GetEventsAsync(int limit) => _events.GetRecentAsync(limit);
    public IReadOnlyList<ProcessRow> GetProcesses() => WindowsCollectors.Processes();
    public IReadOnlyList<ServiceRow> GetServices() => WindowsCollectors.Services();
    public IReadOnlyList<StartupRow> GetStartupItems() => WindowsCollectors.StartupItems();
    public IReadOnlyList<RestoreItem> GetRestoreItems() => WindowsCollectors.RestoreItems();
    public IReadOnlyList<ConfigurationItem> GetBrowserItems() => SystemConfigurationCollectors.BrowserItems();
    public IReadOnlyList<ConfigurationItem> GetNetworkItems() => SystemConfigurationCollectors.NetworkItems();
    public IReadOnlyList<ConfigurationItem> GetWindowsUpdateItems() => SystemConfigurationCollectors.WindowsUpdateItems();
    public IReadOnlyList<ConfigurationItem> GetFileAssociationItems() => SystemConfigurationCollectors.FileAssociationItems();
    public Task<IReadOnlyList<InstallationSession>> GetSessionsAsync(int limit) => _events.GetSessionsAsync(limit);
    public Task<StorageInfo> GetStorageInfoAsync() => _events.GetStorageInfoAsync();
    public IReadOnlyList<TraceRule> GetRules() => _rules.Rules;
    public Task<TraceRule> SaveRuleAsync(TraceRule rule) => _rules.SaveAsync(rule);
    public async Task<ActionResult> DeleteRuleAsync(string id) { await _rules.DeleteAsync(id); return new(true, "Rule deleted.", "规则已删除。"); }
    public ActionResult DisableStartup(string name, string source) => WindowsCollectors.DisableStartup(name, source);
    public ActionResult RestoreStartup(string id) => WindowsCollectors.RestoreStartup(id);
    public AppSettings GetSettings() => _settings;

    public async Task<AppSettings> UpdateSettingsAsync(AppSettings settings)
    {
        _settings = await _settingsStore.SaveAsync(settings);
        _sessions.RegistryMonitoringEnabled = _settings.RegistryMonitoring;
        if (_monitoring) StartMonitoring();
        await _events.ApplyRetentionAsync(_settings.RetentionDays);
        return _settings;
    }

    public ActionResult PauseMonitoring()
    {
        StopMonitoring();
        return new(true, "Monitoring paused.", "监控已暂停。");
    }

    public ActionResult ResumeMonitoring()
    {
        StartMonitoring();
        return new(true, "Monitoring resumed.", "监控已恢复。");
    }

    public async Task<ActionResult> ClearEventsAsync()
    {
        await _events.ClearAsync();
        return new(true, "Event history cleared.", "事件历史已清空。");
    }
    public async Task<ActionResult> ClearReportsAsync() { await _events.ClearReportsAsync(); return new(true, "Installation reports cleared.", "安装报告已清除。"); }
    public async Task<ActionResult> ResetDatabaseAsync() { await _events.ResetAsync(); await _rules.InitializeAsync(); return new(true, "Local database reset.", "本地数据库已重置。"); }

    private void StartMonitoring()
    {
        StopMonitoring();
        var batteryLimited = _settings.PauseOnBattery && PowerStatus.IsOnBattery();
        if (_settings.FileMonitoring) _files.Start(_settings.FullDiskMonitoring && !batteryLimited);
        if (_settings.ProcessMonitoring) _processes.Start();
        _configurations.Start(_settings);
        _monitoring = true;
    }

    private void StopMonitoring()
    {
        _files.Stop();
        _processes.Stop();
        _configurations.Stop();
        _monitoring = false;
    }

    private void QueueEvent(TraceEvent item, Action<TraceEvent> publish)
    {
        _sessions.OnEvent(item);
        _ = Task.Run(async () =>
        {
            try
            {
                var safe = _settings.StoreFilePaths ? item : item with { Detail = "Path storage disabled by user." };
                publish(await _events.AddAsync(safe));
            }
            catch { }
        });
    }

    private static int CountProcesses()
    {
        var processes = Process.GetProcesses();
        try { return processes.Length; }
        finally { foreach (var process in processes) process.Dispose(); }
    }

    private static int CountServices()
    {
        var services = ServiceController.GetServices();
        try { return services.Length; }
        finally { foreach (var service in services) service.Dispose(); }
    }

    public void Dispose()
    {
        StopMonitoring();
        _files.Dispose();
        _processes.Dispose();
        _configurations.Dispose();
    }
}
