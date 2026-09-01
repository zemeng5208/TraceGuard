using System.Text.Json;
using System.Text.Json.Serialization;

namespace TraceGuard.Core.Models;

public sealed record RpcRequest(long Id, string Method, JsonElement Params);
public sealed record RpcResponse(long Id, object? Result = null, string? Error = null);
public sealed record RpcEvent(string Event, object Data);

public sealed record ActionResult(bool Success, string? Message = null, string? MessageZh = null, bool RequiresElevation = false);

public sealed record ActiveInstaller(string Name, int Pid, int ElapsedSeconds, int ChangeCount);
public sealed record Overview(
    long FileChanges,
    long RegistryChanges,
    int ProcessCount,
    int ServiceCount,
    long DiskBytesPerSecond,
    long NetworkBytesPerSecond,
    double CpuPercent,
    double MemoryPercent,
    bool Monitoring,
    ActiveInstaller? ActiveInstaller = null);

public sealed record TraceEvent(
    long Id,
    DateTimeOffset Timestamp,
    string Category,
    string Action,
    string EasyMessage,
    string EasyMessageZh,
    string Detail,
    string? ProcessName,
    int? Pid,
    string Severity);

public sealed record ProcessRow(int Pid, int? ParentPid, string Name, string? Executable, double CpuPercent, long MemoryBytes, string? Publisher, string Permission);
public sealed record ServiceRow(string Name, string DisplayName, string Status, string StartType, string? Executable, string? Publisher, string Category, string Permission);
public sealed record StartupRow(string Name, string Command, string Source, bool Enabled, string Permission);

public sealed record ProcessObservation(int Pid, int? ParentPid, string Name, string? Executable, bool Started, DateTimeOffset Timestamp);
public sealed record RegistryChange(string Hive, string Path, string ValueName, string ChangeType, string? OldValue, string? NewValue, string Severity);
public sealed record SessionProcess(int Pid, int? ParentPid, string Name, string? Executable, DateTimeOffset StartedAt, DateTimeOffset? EndedAt, string LaunchSource);
public sealed record ChangeSummary(int FilesCreated, int FilesModified, int FilesDeleted, int RegistryCreated, int RegistryModified, int RegistryDeleted, int StartupChanges, int BrowserChanges, int NetworkChanges, int UserFilesModified);
public sealed record InstallationSession(
    string Id,
    string RootProcess,
    int RootPid,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    string Status,
    int ChangeCount,
    int ImportantCount,
    ChangeSummary Summary,
    IReadOnlyList<RegistryChange> RegistryChanges,
    IReadOnlyList<SessionProcess>? Processes = null);

public sealed record TraceRule(
    string Id,
    string ProcessPattern,
    string AutoStartAction,
    string ManualStartAction,
    bool Notify,
    bool BlockAutoRestart,
    DateTimeOffset UpdatedAt);

public sealed record AppSettings
{
    public int SchemaVersion { get; init; } = 1;
    public string Locale { get; init; } = "auto";
    public string Theme { get; init; } = "system";
    public string VisualStyle { get; init; } = "acrylic";
    public string AccentColor { get; init; } = "#58a5ff";
    public bool UseSystemAccent { get; init; } = true;
    public int Transparency { get; init; } = 20;
    public string Density { get; init; } = "comfortable";
    public string FontSize { get; init; } = "default";
    public string Animation { get; init; } = "full";
    public string Sidebar { get; init; } = "expanded";
    public bool StartMinimized { get; init; }
    public string StartSurface { get; init; } = "console";
    public string CloseBehavior { get; init; } = "tray";
    public bool RememberWindowPosition { get; init; } = true;
    public bool RememberWindowSize { get; init; } = true;
    public bool RestoreLastPage { get; init; } = true;
    public bool FileMonitoring { get; init; } = true;
    public bool ProcessMonitoring { get; init; } = true;
    public bool ServiceMonitoring { get; init; } = true;
    public bool StartupMonitoring { get; init; } = true;
    public bool RegistryMonitoring { get; init; } = true;
    public bool BrowserMonitoring { get; init; }
    public bool UpdateMonitoring { get; init; } = true;
    public bool NetworkMonitoring { get; init; }
    public bool FullDiskMonitoring { get; init; }
    public bool FloatingWidgetEnabled { get; init; } = true;
    public bool AlwaysOnTop { get; init; } = true;
    public bool ClickThrough { get; init; }
    public int WidgetOpacity { get; init; } = 92;
    public string WidgetSize { get; init; } = "standard";
    public int WidgetRefreshMs { get; init; } = 1000;
    public bool AutoCollapse { get; init; }
    public bool EdgeSnap { get; init; } = true;
    public bool RememberWidgetPosition { get; init; } = true;
    public string BubbleSize { get; init; } = "medium";
    public string BubbleLabel { get; init; } = "tg";
    public bool ShowBadgeCount { get; init; } = true;
    public bool HoverPreview { get; init; } = true;
    public int HoverDelayMs { get; init; } = 500;
    public string TerminalMode { get; init; } = "easy";
    public bool TerminalAutoScroll { get; init; } = true;
    public bool TerminalTimestampMilliseconds { get; init; }
    public int TerminalMaxRows { get; init; } = 1000;
    public string NotificationLevel { get; init; } = "important";
    public bool NotificationSound { get; init; } = true;
    public bool LaunchAtSignIn { get; init; }
    public bool KeepMonitoringOnClose { get; init; } = true;
    public bool LowPowerMode { get; init; }
    public bool StoreFilePaths { get; init; } = true;
    public int RetentionDays { get; init; } = 30;
    public bool WarnBeforeStopping { get; init; } = true;
    public bool WarnBeforeDisablingStartup { get; init; } = true;
    public bool ConfirmRestore { get; init; } = true;
    public bool ConfirmRuleCreation { get; init; } = true;
    public string CornerRadius { get; init; } = "rounded";
    public bool PauseOnBattery { get; init; }
}

public static class JsonDefaults
{
    public static JsonSerializerOptions Options { get; } = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}
