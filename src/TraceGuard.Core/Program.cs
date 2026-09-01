using System.Text.Json;
using TraceGuard.Core;
using TraceGuard.Core.Models;
using TraceGuard.Core.Platform;
using TraceGuard.Core.Storage;

var outputGate = new object();
void Write(object value)
{
    lock (outputGate)
    {
        Console.Out.WriteLine(JsonSerializer.Serialize(value, JsonDefaults.Options));
        Console.Out.Flush();
    }
}

using var host = new CoreHost(new AppPaths(), traceEvent => Write(new RpcEvent("traceEvent", traceEvent)));
try
{
    await host.InitializeAsync();
}
catch (Exception error)
{
    Console.Error.WriteLine($"TraceGuard Core initialization failed: {error.Message}");
    return 1;
}

string? line;
while ((line = await Console.In.ReadLineAsync()) is not null)
{
    RpcRequest? request = null;
    try
    {
        request = JsonSerializer.Deserialize<RpcRequest>(line, JsonDefaults.Options);
        if (request is null) continue;
        object? result = request.Method switch
        {
            "getOverview" => await host.GetOverviewAsync(),
            "getEvents" => await host.GetEventsAsync(ReadInt(request.Params, "limit", 100)),
            "getProcesses" => host.GetProcesses(),
            "getServices" => host.GetServices(),
            "getStartupItems" => host.GetStartupItems(),
            "getSettings" => host.GetSettings(),
            "updateSettings" => await host.UpdateSettingsAsync(ReadSettings(request.Params)),
            "pauseMonitoring" => host.PauseMonitoring(),
            "resumeMonitoring" => host.ResumeMonitoring(),
            "clearEvents" => await host.ClearEventsAsync(),
            "stopProcess" => WindowsCollectors.StopProcess(ReadInt(request.Params, "pid", -1)),
            "stopService" => WindowsCollectors.StopService(ReadString(request.Params, "name")),
            _ => throw new InvalidOperationException($"Unknown TraceGuard Core method: {request.Method}")
        };
        Write(new RpcResponse(request.Id, result));
    }
    catch (Exception error)
    {
        Write(new RpcResponse(request?.Id ?? 0, null, error.Message));
    }
}

return 0;

static int ReadInt(JsonElement element, string property, int fallback) =>
    element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) && value.TryGetInt32(out var number) ? number : fallback;

static string ReadString(JsonElement element, string property) =>
    element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) ? value.GetString() ?? string.Empty : string.Empty;

static AppSettings ReadSettings(JsonElement element)
{
    if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("settings", out var value)) throw new InvalidOperationException("Missing settings payload.");
    return value.Deserialize<AppSettings>(JsonDefaults.Options) ?? throw new InvalidOperationException("Invalid settings payload.");
}
