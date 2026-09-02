using System.Diagnostics;
using TraceGuard.Core.Models;
using TraceGuard.Core.Platform;
using TraceGuard.Core.Protection;
using TraceGuard.Core.Storage;

namespace TraceGuard.Core.Monitoring;

public sealed class RuleEngine(EventStore store, Action<TraceEvent> publish)
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IReadOnlyList<TraceRule> _rules = [];

    public async Task InitializeAsync() => _rules = await store.GetRulesAsync();
    public IReadOnlyList<TraceRule> Rules => _rules;

    public async Task<TraceRule> SaveAsync(TraceRule rule)
    {
        if (string.IsNullOrWhiteSpace(rule.ProcessPattern) || rule.ProcessPattern.Trim('*', ' ').Length == 0)
            throw new ArgumentException("A process name or executable pattern is required.", nameof(rule));
        var saved = await store.SaveRuleAsync(rule);
        await RefreshAsync();
        return saved;
    }

    public async Task DeleteAsync(string id)
    {
        await store.DeleteRuleAsync(id);
        await RefreshAsync();
    }

    public void OnProcess(ProcessObservation process)
    {
        if (ExecutionPrivilegeGuard.IsBlocked) return;
        if (!process.Started) return;
        var rule = _rules.FirstOrDefault(item => Matches(item.ProcessPattern, process.Name, process.Executable));
        if (rule is null) return;
        var source = LaunchSourceAnalyzer.Analyze(process);
        var automatic = source is not "user" and not "parent-process";
        var action = automatic && rule.BlockAutoRestart ? "block" : automatic ? rule.AutoStartAction : rule.ManualStartAction;
        if (string.Equals(action, "allow", StringComparison.OrdinalIgnoreCase)) return;
        if (string.Equals(action, "ask", StringComparison.OrdinalIgnoreCase))
        {
            publish(new TraceEvent(0, DateTimeOffset.UtcNow, "process", "RULE_DECISION_REQUIRED",
                "A process matched an Ask rule and was allowed for this launch", "进程匹配询问规则，本次启动已暂时允许",
                $"{process.Name} · Source: {source} · Open Rules to choose a persistent behavior.", process.Name, process.Pid, rule.Notify ? "important" : "normal"));
            return;
        }
        if (!string.Equals(action, "block", StringComparison.OrdinalIgnoreCase)) return;
        if (CoreGuard.IsProtectedProcess(process.Name))
        {
            PublishObserved(process, source, "Protected Windows Core Component", "Windows 核心受保护组件");
            return;
        }
        var result = WindowsCollectors.StopProcess(process.Pid);
        if (result.Success)
            publish(new TraceEvent(0, DateTimeOffset.UtcNow, "process", automatic ? (rule.Notify ? "AUTO_RESTART_BLOCKED" : "AUTO_RESTART_BLOCKED_SILENT") : "MANUAL_LAUNCH_BLOCKED",
                automatic ? "Blocked an automatic process restart" : "Blocked a manual process launch",
                automatic ? "已阻止程序自动重新启动" : "已阻止手动启动的程序",
                $"{process.Name} · Source: {source}", process.Name, process.Pid, rule.Notify ? "important" : "normal"));
        else
            PublishObserved(process, source, result.Message ?? "Observed but cannot be controlled in Zero-Privilege Mode.", result.MessageZh ?? "已检测到，但零提权模式下当前用户没有权限控制。");
    }

    private async Task RefreshAsync()
    {
        await _gate.WaitAsync();
        try { _rules = await store.GetRulesAsync(); }
        finally { _gate.Release(); }
    }

    private void PublishObserved(ProcessObservation process, string source, string english, string chinese) => publish(new TraceEvent(0, DateTimeOffset.UtcNow, "process", "BLOCK_UNAVAILABLE", english, chinese, $"{process.Name} · Source: {source}", process.Name, process.Pid, "important"));
    private static bool Matches(string pattern, string name, string? executable)
    {
        var needle = pattern.Trim().Trim('*');
        return name.Contains(needle, StringComparison.OrdinalIgnoreCase) || (!string.IsNullOrWhiteSpace(executable) && executable.Contains(needle, StringComparison.OrdinalIgnoreCase));
    }
}

public static class LaunchSourceAnalyzer
{
    public static string Analyze(ProcessObservation process)
    {
        var name = process.Name;
        if (name.Contains("update", StringComparison.OrdinalIgnoreCase)) return "updater";
        if (name.Contains("launcher", StringComparison.OrdinalIgnoreCase)) return "launcher";
        if (name.Contains("chrome", StringComparison.OrdinalIgnoreCase) || name.Contains("msedge", StringComparison.OrdinalIgnoreCase) || name.Contains("firefox", StringComparison.OrdinalIgnoreCase)) return "browser";
        if (process.ParentPid is null) return "unknown";
        try
        {
            using var parent = Process.GetProcessById(process.ParentPid.Value);
            var parentName = parent.ProcessName;
            if (parentName.Equals("explorer", StringComparison.OrdinalIgnoreCase)) return "user";
            if (parentName.Equals("services", StringComparison.OrdinalIgnoreCase) || parentName.Equals("svchost", StringComparison.OrdinalIgnoreCase)) return "service";
            if (parentName.Contains("task", StringComparison.OrdinalIgnoreCase)) return "scheduled-task";
            return "parent-process";
        }
        catch { return "unknown"; }
    }
}
