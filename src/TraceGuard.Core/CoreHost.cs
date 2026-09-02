using System.Diagnostics;
using System.ServiceProcess;
using TraceGuard.Core.Models;
using TraceGuard.Core.Monitoring;
using TraceGuard.Core.Platform;
using TraceGuard.Core.Protection;
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
    private readonly EtwAttributionMonitor _etw = new();
    private readonly SystemSampler _sampler = new();
    private readonly object _monitoringGate = new();
    private Timer? _powerTimer;
    private AppSettings _settings = new();
    private bool _monitoring;
    private bool _monitoringRequested = true;
    private bool _batteryLimited;
    private readonly bool _privilegeBlocked;

    public CoreHost(AppPaths paths, Action<TraceEvent> publish) : this(paths, publish, ExecutionPrivilegeGuard.IsBlocked)
    {
    }

    internal CoreHost(AppPaths paths, Action<TraceEvent> publish, bool privilegeBlocked)
    {
        _privilegeBlocked = privilegeBlocked;
        _events = new EventStore(paths);
        _settingsStore = new SettingsStore(paths);
        _files = new FileMonitor(item => QueueEvent(item, publish), MonitoringPathExclusions.ForAppPaths(paths));
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
        if (!_privilegeBlocked) await _events.ApplyRetentionAsync(_settings.RetentionDays);
        if (!_privilegeBlocked)
        {
            StartMonitoring();
            _powerTimer = new Timer(_ => RefreshPowerMode(), null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
        }
    }

    public async Task<Overview> GetOverviewAsync()
    {
        var sample = _privilegeBlocked
            ? (Cpu: 0d, Memory: 0d, NetworkBytesPerSecond: 0L, IoBytesPerSecond: 0L)
            : _sampler.Sample();
        var since = DateTimeOffset.UtcNow.AddMinutes(-1);
        var fileChanges = _events.CountCategoryAsync("file");
        var registryChanges = _events.CountCategoryAsync("registry");
        var fileRate = _events.CountCategorySinceAsync("file", since);
        var registryRate = _events.CountCategorySinceAsync("registry", since);
        return new Overview(
            await fileChanges,
            await registryChanges,
            await fileRate,
            await registryRate,
            _privilegeBlocked ? 0 : CountProcesses(),
            _privilegeBlocked ? 0 : CountServices(),
            sample.IoBytesPerSecond,
            sample.NetworkBytesPerSecond,
            sample.Cpu,
            sample.Memory,
            _monitoring,
            _privilegeBlocked ? "privilege-blocked" : !_monitoringRequested ? "paused" : _batteryLimited || _settings.LowPowerMode ? "reduced" : "active",
            !_privilegeBlocked && PowerStatus.IsOnBattery(),
            GetMonitorModules(),
            _sessions.Current is { } session ? new ActiveInstaller(session.RootProcess, session.RootPid, Math.Max(0, (int)(DateTimeOffset.UtcNow - session.StartedAt).TotalSeconds), session.ChangeCount) : null);
    }

    public Task<IReadOnlyList<TraceEvent>> GetEventsAsync(int limit) => _events.GetRecentAsync(limit);
    public IReadOnlyList<ProcessRow> GetProcesses() => _privilegeBlocked ? [] : WindowsCollectors.Processes();
    public IReadOnlyList<ServiceRow> GetServices() => _privilegeBlocked ? [] : WindowsCollectors.Services();
    public IReadOnlyList<StartupRow> GetStartupItems() => _privilegeBlocked ? [] : WindowsCollectors.StartupItems();
    public IReadOnlyList<RestoreItem> GetRestoreItems() => _privilegeBlocked ? [] : WindowsCollectors.RestoreItems();
    public IReadOnlyList<ConfigurationItem> GetBrowserItems() => _privilegeBlocked ? [] : SystemConfigurationCollectors.BrowserItems();
    public IReadOnlyList<ConfigurationItem> GetNetworkItems() => _privilegeBlocked ? [] : SystemConfigurationCollectors.NetworkItems();
    public IReadOnlyList<ConfigurationItem> GetWindowsUpdateItems() => _privilegeBlocked ? [] : SystemConfigurationCollectors.WindowsUpdateItems();
    public IReadOnlyList<ConfigurationItem> GetFileAssociationItems() => _privilegeBlocked ? [] : SystemConfigurationCollectors.FileAssociationItems();
    public Task<IReadOnlyList<InstallationSession>> GetSessionsAsync(int limit) => _events.GetSessionsAsync(limit);
    public Task<StorageInfo> GetStorageInfoAsync() => _events.GetStorageInfoAsync();
    public IReadOnlyList<TraceRule> GetRules() => _rules.Rules;
    public Task<TraceRule> SaveRuleAsync(TraceRule rule) => _privilegeBlocked
        ? Task.FromException<TraceRule>(CoreGuard.ElevatedExecutionException())
        : _rules.SaveAsync(rule);
    public async Task<ActionResult> DeleteRuleAsync(string id) { if (_privilegeBlocked) return CoreGuard.ElevatedExecutionDenied(); await _rules.DeleteAsync(id); return new(true, "Rule deleted.", "规则已删除。"); }
    public ActionResult DisableStartup(string name, string source) => _privilegeBlocked ? CoreGuard.ElevatedExecutionDenied() : WindowsCollectors.DisableStartup(name, source);
    public ActionResult RestoreStartup(string id) => _privilegeBlocked ? CoreGuard.ElevatedExecutionDenied() : WindowsCollectors.RestoreStartup(id);
    public ActionResult StopProcess(int pid) => _privilegeBlocked ? CoreGuard.ElevatedExecutionDenied() : WindowsCollectors.StopProcess(pid);
    public ActionResult StopService(string name) => _privilegeBlocked ? CoreGuard.ElevatedExecutionDenied() : WindowsCollectors.StopService(name);
    public AppSettings GetSettings() => _settings;

    public async Task<AppSettings> UpdateSettingsAsync(AppSettings settings)
    {
        _settings = await _settingsStore.SaveAsync(settings);
        _sessions.RegistryMonitoringEnabled = _settings.RegistryMonitoring;
        if (_monitoringRequested) ApplyMonitoringConfiguration();
        if (!_privilegeBlocked) await _events.ApplyRetentionAsync(_settings.RetentionDays);
        return _settings;
    }

    public ActionResult PauseMonitoring()
    {
        _monitoringRequested = false;
        StopCollectors();
        return new(true, "Monitoring paused.", "监控已暂停。");
    }

    public ActionResult ResumeMonitoring()
    {
        if (_privilegeBlocked) return CoreGuard.ElevatedExecutionDenied();
        _monitoringRequested = true;
        StartMonitoring();
        return new(true, "Monitoring resumed.", "监控已恢复。");
    }

    public async Task<ActionResult> ClearEventsAsync()
    {
        if (_privilegeBlocked) return CoreGuard.ElevatedExecutionDenied();
        await _events.ClearAsync();
        return new(true, "Event history cleared.", "事件历史已清空。");
    }
    public async Task<ActionResult> ClearReportsAsync() { if (_privilegeBlocked) return CoreGuard.ElevatedExecutionDenied(); await _events.ClearReportsAsync(); return new(true, "Installation reports cleared.", "安装报告已清除。"); }
    public async Task<ActionResult> ResetDatabaseAsync() { if (_privilegeBlocked) return CoreGuard.ElevatedExecutionDenied(); await _events.ResetAsync(); await _rules.InitializeAsync(); return new(true, "Local database reset.", "本地数据库已重置。"); }

    private void StartMonitoring()
    {
        _monitoringRequested = true;
        ApplyMonitoringConfiguration();
    }

    private void ApplyMonitoringConfiguration()
    {
        lock (_monitoringGate)
        {
            StopCollectors();
            if (!_monitoringRequested || _privilegeBlocked) return;
            _batteryLimited = _settings.PauseOnBattery && PowerStatus.IsOnBattery();
            _etw.Start(_settings.FileMonitoring, _settings.ProcessMonitoring);
            if (_settings.FileMonitoring) _files.Start(_settings.FullDiskMonitoring && !_batteryLimited);
            if (_settings.ProcessMonitoring) _processes.Start();
            if (HasConfigurationMonitoring(_settings)) _configurations.Start(_settings);
            _monitoring = _files.ActiveSourceCount > 0 || _processes.IsRunning || _configurations.IsRunning;
        }
    }

    private void RefreshPowerMode()
    {
        if (!_monitoringRequested || !_settings.PauseOnBattery) return;
        var limited = PowerStatus.IsOnBattery();
        if (limited != _batteryLimited) ApplyMonitoringConfiguration();
    }

    private static bool HasConfigurationMonitoring(AppSettings settings) =>
        settings.RegistryMonitoring || settings.ServiceMonitoring || settings.StartupMonitoring || settings.BrowserMonitoring || settings.NetworkMonitoring || settings.UpdateMonitoring;

    private IReadOnlyList<MonitorModuleStatus> GetMonitorModules()
    {
        lock (_monitoringGate)
        {
            if (_privilegeBlocked)
                return Enumerable.Range(0, 10).Select(index => new MonitorModuleStatus(
                    new[] { "file", "process", "registry", "service", "startup", "browser", "network", "update", "usn", "etw" }[index],
                    "blocked", CoreGuard.ElevatedExecutionMessage, CoreGuard.ElevatedExecutionMessageZh)).ToArray();
            MonitorModuleStatus Status(string id, bool enabled, bool running, string active, string activeZh)
            {
                if (!enabled) return new(id, "disabled", "Disabled in Settings.", "已在设置中关闭。");
                if (!_monitoringRequested) return new(id, "paused", "Paused by the user. Collection is stopped.", "已由用户暂停，采集已停止。");
                return running ? new(id, "active", active, activeZh) : new(id, "unavailable", "No accessible source is available to the current user.", "当前用户没有可访问的数据源。");
            }

            var configurationRunning = _configurations.IsRunning;
            var file = Status("file", _settings.FileMonitoring, _files.ActiveSourceCount > 0,
                _batteryLimited && _settings.FullDiskMonitoring ? "User folders active; full-disk scope is reduced on battery." : _files.UsnVolumeCount > 0
                    ? $"Tailing {_files.UsnVolumeCount} readable NTFS journal(s); {_files.WatcherCount} inaccessible or non-NTFS volume(s) use FileSystemWatcher."
                    : $"Watching {_files.WatcherCount} accessible location(s).",
                _batteryLimited && _settings.FullDiskMonitoring ? "用户目录监控正常；电池供电时已缩减全磁盘范围。" : _files.UsnVolumeCount > 0
                    ? $"正在增量读取 {_files.UsnVolumeCount} 个可读 NTFS 日志；{_files.WatcherCount} 个不可读或非 NTFS 卷使用 FileSystemWatcher。"
                    : $"正在监控 {_files.WatcherCount} 个可访问位置。");
            if (file.State == "active" && _batteryLimited && _settings.FullDiskMonitoring) file = file with { State = "reduced" };
            var usn = _files.UsnVolumeCount > 0
                ? new MonitorModuleStatus("usn", "active",
                    $"Incrementally reading {_files.UsnVolumeCount} existing NTFS journal(s) with the current user token.",
                    $"正在使用当前用户令牌增量读取 {_files.UsnVolumeCount} 个现有 NTFS 日志。")
                : UsnJournalProbe.GetStatus();
            var etw = _etw.IsRunning
                ? new MonitorModuleStatus("etw", "active",
                    "Supported process and file providers are supplying current-token event attribution.",
                    "受支持的进程与文件提供程序正在提供当前令牌范围内的事件归属。")
                : EtwCapabilityProbe.GetStatus();
            return
            [
                file,
                Status("process", _settings.ProcessMonitoring, _processes.IsRunning, "Polling process starts and exits.", "正在观察进程启动与退出。"),
                Status("registry", _settings.RegistryMonitoring, configurationRunning, $"Current-user configuration diff every {_configurations.PollIntervalMs / 1000}s.", $"每 {_configurations.PollIntervalMs / 1000} 秒比较当前用户配置。"),
                Status("service", _settings.ServiceMonitoring, configurationRunning, $"Read-only service comparison every {_configurations.PollIntervalMs / 1000}s.", $"每 {_configurations.PollIntervalMs / 1000} 秒只读比较服务状态。"),
                Status("startup", _settings.StartupMonitoring, configurationRunning, $"User startup comparison every {_configurations.PollIntervalMs / 1000}s.", $"每 {_configurations.PollIntervalMs / 1000} 秒比较用户启动项。"),
                Status("browser", _settings.BrowserMonitoring, configurationRunning, "Browser configuration monitoring is active.", "浏览器配置监控正在运行。"),
                Status("network", _settings.NetworkMonitoring, configurationRunning, "Network configuration monitoring is active.", "网络配置监控正在运行。"),
                Status("update", _settings.UpdateMonitoring, configurationRunning, "Windows Update observation is active.", "Windows Update 活动观察正在运行。"),
                usn,
                etw
            ];
        }
    }

    private void StopCollectors()
    {
        _files.Stop();
        _processes.Stop();
        _configurations.Stop();
        _etw.Stop();
        _monitoring = false;
    }

    private void QueueEvent(TraceEvent item, Action<TraceEvent> publish)
    {
        item = _etw.Attribute(item);
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
        _powerTimer?.Dispose();
        _powerTimer = null;
        _monitoringRequested = false;
        StopCollectors();
        _files.Dispose();
        _processes.Dispose();
        _configurations.Dispose();
        _etw.Dispose();
    }
}
