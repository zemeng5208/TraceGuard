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
    private readonly SystemSampler _sampler = new();
    private AppSettings _settings = new();
    private bool _monitoring;

    public CoreHost(AppPaths paths, Action<TraceEvent> publish)
    {
        _events = new EventStore(paths);
        _settingsStore = new SettingsStore(paths);
        _files = new FileMonitor(item => QueueEvent(item, publish));
        _processes = new ProcessMonitor(item => QueueEvent(item, publish));
    }

    public async Task InitializeAsync()
    {
        await _events.InitializeAsync();
        _settings = await _settingsStore.LoadAsync();
        await _events.ApplyRetentionAsync(_settings.RetentionDays);
        StartMonitoring();
    }

    public async Task<Overview> GetOverviewAsync()
    {
        var sample = _sampler.Sample();
        return new Overview(
            await _events.CountCategoryAsync("file"),
            await _events.CountCategoryAsync("registry"),
            Process.GetProcesses().Length,
            ServiceController.GetServices().Length,
            0,
            sample.NetworkBytesPerSecond,
            sample.Cpu,
            sample.Memory,
            _monitoring);
    }

    public Task<IReadOnlyList<TraceEvent>> GetEventsAsync(int limit) => _events.GetRecentAsync(limit);
    public IReadOnlyList<ProcessRow> GetProcesses() => WindowsCollectors.Processes();
    public IReadOnlyList<ServiceRow> GetServices() => WindowsCollectors.Services();
    public IReadOnlyList<StartupRow> GetStartupItems() => WindowsCollectors.StartupItems();
    public AppSettings GetSettings() => _settings;

    public async Task<AppSettings> UpdateSettingsAsync(AppSettings settings)
    {
        _settings = await _settingsStore.SaveAsync(settings);
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

    private void StartMonitoring()
    {
        StopMonitoring();
        if (_settings.FileMonitoring) _files.Start(_settings.FullDiskMonitoring);
        if (_settings.ProcessMonitoring) _processes.Start();
        _monitoring = true;
    }

    private void StopMonitoring()
    {
        _files.Stop();
        _processes.Stop();
        _monitoring = false;
    }

    private void QueueEvent(TraceEvent item, Action<TraceEvent> publish)
    {
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

    public void Dispose()
    {
        StopMonitoring();
        _files.Dispose();
        _processes.Dispose();
    }
}
