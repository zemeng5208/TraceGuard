using System.Security.Principal;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Platform;

public static class EtwCapabilityProbe
{
    private const string PerformanceLogUsersSid = "S-1-5-32-559";
    private static readonly object Gate = new();
    private static MonitorModuleStatus? _cached;
    private static DateTimeOffset _cachedAt = DateTimeOffset.MinValue;

    public static MonitorModuleStatus GetStatus()
    {
        lock (Gate)
        {
            if (_cached is not null && DateTimeOffset.UtcNow - _cachedAt < TimeSpan.FromMinutes(1)) return _cached;
            _cached = Probe();
            _cachedAt = DateTimeOffset.UtcNow;
            return _cached;
        }
    }

    private static MonitorModuleStatus Probe()
    {
        if (!OperatingSystem.IsWindows()) return Evaluate(false, false);
        try
        {
            using var identity = WindowsIdentity.GetCurrent(TokenAccessLevels.Query);
            var principal = new WindowsPrincipal(identity);
            var performanceLogUsers = new SecurityIdentifier(PerformanceLogUsersSid);
            return Evaluate(true, principal.IsInRole(performanceLogUsers));
        }
        catch (UnauthorizedAccessException) { return Evaluate(true, false); }
        catch (SystemException) { return Evaluate(true, false); }
    }

    internal static MonitorModuleStatus Evaluate(bool isWindows, bool isPerformanceLogUser)
    {
        if (!isWindows)
            return new("etw", "unavailable", "ETW is available only on Windows.", "ETW 仅适用于 Windows。");
        if (isPerformanceLogUser)
            return new("etw", "available",
                "The current token belongs to Performance Log Users. User-mode ETW session control is eligible, but provider attribution is not enabled yet.",
                "当前令牌属于“性能日志用户”组，具备用户模式 ETW 会话控制资格，但尚未启用提供程序事件归属。");
        return new("etw", "unavailable",
            "The current token cannot control general ETW sessions. TraceGuard will not request elevation or change group membership.",
            "当前令牌无法控制常规 ETW 会话。TraceGuard 不会请求提权或修改用户组成员身份。");
    }
}
