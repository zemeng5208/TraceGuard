using System.Text.Json;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Storage;

public sealed class SettingsStore(AppPaths paths)
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<AppSettings> LoadAsync()
    {
        await _gate.WaitAsync();
        try
        {
            if (!File.Exists(paths.SettingsPath)) return new AppSettings();
            var json = await File.ReadAllTextAsync(paths.SettingsPath);
            return JsonSerializer.Deserialize<AppSettings>(json, JsonDefaults.Options) ?? new AppSettings();
        }
        catch (JsonException)
        {
            TryQuarantineCorruptFile(paths.SettingsPath);
            return new AppSettings();
        }
        finally { _gate.Release(); }
    }

    public async Task<AppSettings> SaveAsync(AppSettings settings)
    {
        await _gate.WaitAsync();
        try
        {
            var normalized = settings with { SchemaVersion = 1 };
            var temporary = paths.SettingsPath + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(normalized, JsonDefaults.Options));
            File.Move(temporary, paths.SettingsPath, true);
            return normalized;
        }
        finally { _gate.Release(); }
    }

    private static void TryQuarantineCorruptFile(string path)
    {
        try { File.Move(path, path + $".corrupt-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}", true); } catch { }
    }
}
