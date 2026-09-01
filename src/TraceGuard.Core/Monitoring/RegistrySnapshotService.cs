using Microsoft.Win32;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Monitoring;

public sealed class RegistrySnapshotService
{
    private static readonly string[] UserPaths =
    [
        @"Software\Microsoft\Windows\CurrentVersion\Run",
        @"Software\Microsoft\Windows\CurrentVersion\RunOnce",
        @"Environment",
        @"Software\Microsoft\Windows\Shell\Associations",
        @"Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        @"Software\Policies\Google\Chrome",
        @"Software\Policies\Microsoft\Edge",
        @"Software\Mozilla\Firefox",
    ];

    public Dictionary<string, string?> Capture()
    {
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var path in UserPaths) ReadTree(Registry.CurrentUser, "HKCU", path, result, 0);
        return result;
    }

    public IReadOnlyList<RegistryChange> Diff(IReadOnlyDictionary<string, string?> before, IReadOnlyDictionary<string, string?> after)
    {
        var changes = new List<RegistryChange>();
        foreach (var item in after)
        {
            if (!before.TryGetValue(item.Key, out var oldValue)) changes.Add(ToChange(item.Key, "created", null, item.Value));
            else if (!string.Equals(oldValue, item.Value, StringComparison.Ordinal)) changes.Add(ToChange(item.Key, "modified", oldValue, item.Value));
        }
        foreach (var item in before.Where(item => !after.ContainsKey(item.Key))) changes.Add(ToChange(item.Key, "deleted", item.Value, null));
        return changes;
    }

    private static void ReadTree(RegistryKey hive, string hiveName, string path, IDictionary<string, string?> target, int depth)
    {
        if (depth > 5) return;
        try
        {
            using var key = hive.OpenSubKey(path, writable: false);
            if (key is null) return;
            foreach (var valueName in key.GetValueNames())
            {
                var raw = key.GetValue(valueName, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                target[$"{hiveName}\\{path}::{valueName}"] = SerializeValue(raw);
            }
            foreach (var child in key.GetSubKeyNames()) ReadTree(hive, hiveName, $"{path}\\{child}", target, depth + 1);
        }
        catch (UnauthorizedAccessException) { }
        catch (IOException) { }
    }

    private static string? SerializeValue(object? value) => value switch
    {
        null => null,
        string[] values => string.Join("\u001f", values),
        byte[] bytes => Convert.ToHexString(bytes),
        _ => Convert.ToString(value)
    };

    private static RegistryChange ToChange(string compound, string type, string? oldValue, string? newValue)
    {
        var split = compound.Split("::", 2, StringSplitOptions.None);
        var fullPath = split[0];
        var slash = fullPath.IndexOf('\\');
        var hive = slash < 0 ? fullPath : fullPath[..slash];
        var path = slash < 0 ? string.Empty : fullPath[(slash + 1)..];
        var valueName = split.Length > 1 ? split[1] : string.Empty;
        var sensitive = path.Contains("\\Run", StringComparison.OrdinalIgnoreCase) || path.Contains("Policies", StringComparison.OrdinalIgnoreCase) || path.Contains("Internet Settings", StringComparison.OrdinalIgnoreCase);
        return new RegistryChange(hive, path, valueName, type, oldValue, newValue, sensitive ? "important" : "normal");
    }
}
