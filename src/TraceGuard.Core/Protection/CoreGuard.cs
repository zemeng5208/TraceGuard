namespace TraceGuard.Core.Protection;

public static class CoreGuard
{
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
}
