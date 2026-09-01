using TraceGuard.Core.Models;
using TraceGuard.Core.Platform;

namespace TraceGuard.Core.Monitoring;

public sealed class ConfigurationMonitor(Action<TraceEvent> publish) : IDisposable
{
    private readonly RegistrySnapshotService _registry = new();
    private Dictionary<string, string?> _registryBaseline = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, ConfigurationItem> _browserBaseline = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, ConfigurationItem> _networkBaseline = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, ConfigurationItem> _updateBaseline = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, StartupRow> _startupBaseline = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, ServiceRow> _serviceBaseline = new(StringComparer.OrdinalIgnoreCase);
    private AppSettings _settings = new();
    private Timer? _timer;
    private int _polling;
    public bool IsRunning => _timer is not null;
    public int PollIntervalMs { get; private set; }

    public void Start(AppSettings settings)
    {
        Stop();
        _settings = settings;
        CaptureBaselines();
        PollIntervalMs = settings.LowPowerMode || settings.PauseOnBattery && PowerStatus.IsOnBattery() ? 10_000 : 4_000;
        _timer = new Timer(_ => Poll(), null, PollIntervalMs, PollIntervalMs);
    }

    private void CaptureBaselines()
    {
        if (_settings.RegistryMonitoring) _registryBaseline = _registry.Capture();
        if (_settings.BrowserMonitoring) _browserBaseline = Index(SystemConfigurationCollectors.BrowserItems());
        if (_settings.NetworkMonitoring) _networkBaseline = Index(SystemConfigurationCollectors.NetworkItems());
        if (_settings.UpdateMonitoring) _updateBaseline = Index(SystemConfigurationCollectors.WindowsUpdateItems());
        if (_settings.StartupMonitoring) _startupBaseline = WindowsCollectors.StartupItems().ToDictionary(StartupKey, StringComparer.OrdinalIgnoreCase);
        if (_settings.ServiceMonitoring) _serviceBaseline = WindowsCollectors.Services().ToDictionary(item => item.Name, StringComparer.OrdinalIgnoreCase);
    }

    private void Poll()
    {
        if (Interlocked.Exchange(ref _polling, 1) == 1) return;
        try
        {
            if (_settings.RegistryMonitoring) PollRegistry();
            if (_settings.BrowserMonitoring) PollConfigurations("browser", "Browser configuration changed", "浏览器配置发生变化", ref _browserBaseline, SystemConfigurationCollectors.BrowserItems());
            if (_settings.NetworkMonitoring) PollConfigurations("network", "Network setting changed", "网络设置发生变化", ref _networkBaseline, SystemConfigurationCollectors.NetworkItems());
            if (_settings.UpdateMonitoring) PollConfigurations("update", "Windows Update activity changed", "Windows Update 活动发生变化", ref _updateBaseline, SystemConfigurationCollectors.WindowsUpdateItems());
            if (_settings.StartupMonitoring) PollStartup();
            if (_settings.ServiceMonitoring) PollServices();
        }
        catch { }
        finally { Volatile.Write(ref _polling, 0); }
    }

    private void PollRegistry()
    {
        var next = _registry.Capture();
        foreach (var change in _registry.Diff(_registryBaseline, next))
        {
            var action = change.ChangeType.ToUpperInvariant();
            publish(new TraceEvent(0, DateTimeOffset.UtcNow, "registry", action,
                $"A registry value was {change.ChangeType}", $"注册表值已{RegistryVerbZh(change.ChangeType)}",
                $"{change.Hive}\\{change.Path}::{change.ValueName} · {Display(change.OldValue)} → {Display(change.NewValue)}",
                null, null, change.Severity));
        }
        _registryBaseline = next;
    }

    private void PollConfigurations(string category, string message, string messageZh, ref Dictionary<string, ConfigurationItem> baseline, IReadOnlyList<ConfigurationItem> items)
    {
        var next = Index(items);
        foreach (var item in next.Values)
        {
            if (!baseline.TryGetValue(item.Id, out var previous)) EmitConfiguration(category, "ADD", message, messageZh, null, item);
            else if (!string.Equals(previous.Value, item.Value, StringComparison.Ordinal)) EmitConfiguration(category, "MODIFY", message, messageZh, previous, item);
        }
        foreach (var previous in baseline.Values.Where(item => !next.ContainsKey(item.Id))) EmitConfiguration(category, "DELETE", message, messageZh, previous, null);
        baseline = next;
    }

    private void EmitConfiguration(string category, string action, string message, string messageZh, ConfigurationItem? before, ConfigurationItem? after)
    {
        var item = after ?? before!;
        publish(new TraceEvent(0, DateTimeOffset.UtcNow, category, action, message, messageZh,
            $"{item.Name} · {Display(before?.Value)} → {Display(after?.Value)} · {item.Source}", null, null, item.Severity));
    }

    private void PollStartup()
    {
        var next = WindowsCollectors.StartupItems().ToDictionary(StartupKey, StringComparer.OrdinalIgnoreCase);
        foreach (var item in next.Values.Where(item => !_startupBaseline.ContainsKey(StartupKey(item))))
            publish(new TraceEvent(0, DateTimeOffset.UtcNow, "startup", "ADD", "A startup item was added", "新增了自启动项", $"{item.Name} · {item.Command} · {item.Source}", null, null, "important"));
        foreach (var item in _startupBaseline.Values.Where(item => !next.ContainsKey(StartupKey(item))))
            publish(new TraceEvent(0, DateTimeOffset.UtcNow, "startup", "DELETE", "A startup item was removed", "移除了自启动项", $"{item.Name} · {item.Command} · {item.Source}", null, null, "important"));
        _startupBaseline = next;
    }

    private void PollServices()
    {
        var next = WindowsCollectors.Services().ToDictionary(item => item.Name, StringComparer.OrdinalIgnoreCase);
        foreach (var item in next.Values)
        {
            if (!_serviceBaseline.TryGetValue(item.Name, out var previous))
                publish(new TraceEvent(0, DateTimeOffset.UtcNow, "service", "CREATED", "A new service was detected", "检测到新服务", $"{item.DisplayName} · {item.Name} · {item.Executable}", null, null, item.Category == "windows-core" ? "normal" : "important"));
            else if (!string.Equals(previous.Status, item.Status, StringComparison.OrdinalIgnoreCase))
                publish(new TraceEvent(0, DateTimeOffset.UtcNow, "service", "STATUS", "A service status changed", "服务状态发生变化", $"{item.DisplayName} · {previous.Status} → {item.Status}", null, null, "normal"));
        }
        foreach (var item in _serviceBaseline.Values.Where(item => !next.ContainsKey(item.Name)))
            publish(new TraceEvent(0, DateTimeOffset.UtcNow, "service", "REMOVED", "A service is no longer visible", "服务已不再可见", $"{item.DisplayName} · {item.Name}", null, null, item.Category == "windows-core" ? "normal" : "important"));
        _serviceBaseline = next;
    }

    private static Dictionary<string, ConfigurationItem> Index(IReadOnlyList<ConfigurationItem> items) =>
        items.GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase).ToDictionary(group => group.Key, group => group.Last(), StringComparer.OrdinalIgnoreCase);
    private static string StartupKey(StartupRow item) => $"{item.Source}::{item.Name}";
    private static string Display(string? value) => string.IsNullOrWhiteSpace(value) ? "(none)" : value;
    private static string RegistryVerbZh(string value) => value switch { "created" => "创建", "modified" => "修改", "deleted" => "删除", _ => "变更" };

    public void Stop()
    {
        _timer?.Dispose();
        _timer = null;
        PollIntervalMs = 0;
        _registryBaseline.Clear();
        _browserBaseline.Clear();
        _networkBaseline.Clear();
        _updateBaseline.Clear();
        _startupBaseline.Clear();
        _serviceBaseline.Clear();
    }

    public void Dispose() => Stop();
}
