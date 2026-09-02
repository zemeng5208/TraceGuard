namespace TraceGuard.Core.Protection;

public static class CoreGuard
{
    public const string ElevatedExecutionMessage = "TraceGuard detected an elevated or high-integrity token. Zero-Privilege safety mode has blocked monitoring and destructive actions. Restart TraceGuard normally without Run as administrator.";
    public const string ElevatedExecutionMessageZh = "TraceGuard 检测到提升权限或高完整性令牌。零提权安全模式已阻止监控和所有破坏性操作。请不要使用“以管理员身份运行”，并正常重启 TraceGuard。";
    private static readonly HashSet<string> ProtectedProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "system", "registry", "smss", "csrss", "wininit", "winlogon", "services", "lsass"
    };

    private static readonly HashSet<string> ProtectedServices = new(StringComparer.OrdinalIgnoreCase)
    {
        "RpcSs", "DcomLaunch", "RpcEptMapper", "PlugPlay", "Power", "EventLog", "SamSs", "Schedule", "Winmgmt",
        "BrokerInfrastructure", "LSM", "ProfSvc", "UserManager", "Appinfo", "CryptSvc", "BFE", "MpsSvc",
        "WinDefend", "WdNisSvc", "SecurityHealthService", "Dhcp", "Dnscache", "NlaSvc",
        "wuauserv", "UsoSvc", "DoSvc", "BITS", "TrustedInstaller"
    };

    public static bool IsProtectedProcess(string? processName)
    {
        if (string.IsNullOrWhiteSpace(processName)) return true;
        return ProtectedProcesses.Contains(Path.GetFileNameWithoutExtension(processName));
    }

    public static bool IsProtectedService(string? serviceName) =>
        string.IsNullOrWhiteSpace(serviceName) || ProtectedServices.Contains(serviceName);

    public static Models.ActionResult Denied() => new(false,
        "Protected Windows Core Component",
        "Windows 核心受保护组件");

    public static Models.ActionResult ElevatedExecutionDenied() => new(false,
        ElevatedExecutionMessage, ElevatedExecutionMessageZh);

    public static InvalidOperationException ElevatedExecutionException() =>
        new($"{ElevatedExecutionMessage} / {ElevatedExecutionMessageZh}");
}
