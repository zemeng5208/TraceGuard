using System.Diagnostics;
using System.Net.NetworkInformation;
using System.ServiceProcess;
using System.Text.Json;
using Microsoft.Win32;
using TraceGuard.Core.Models;

namespace TraceGuard.Core.Platform;

public static class SystemConfigurationCollectors
{
    public static IReadOnlyList<ConfigurationItem> BrowserItems()
    {
        var rows = new List<ConfigurationItem>();
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        ReadChromium(rows, "chrome", "Google Chrome", Path.Combine(local, "Google", "Chrome", "User Data", "Default"));
        ReadChromium(rows, "edge", "Microsoft Edge", Path.Combine(local, "Microsoft", "Edge", "User Data", "Default"));
        ReadFirefox(rows);
        ReadBrowserPolicies(rows, "chrome", "Google Chrome", @"Software\Policies\Google\Chrome");
        ReadBrowserPolicies(rows, "edge", "Microsoft Edge", @"Software\Policies\Microsoft\Edge");
        rows.AddRange(FileAssociationItems().Where(item => item.Category is "http" or "https" or "html"));
        return rows;
    }

    public static IReadOnlyList<ConfigurationItem> NetworkItems()
    {
        var rows = new List<ConfigurationItem>();
        try
        {
            using var internet = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Internet Settings");
            AddRegistryItem(rows, "proxy.enabled", "proxy", "Proxy enabled", internet?.GetValue("ProxyEnable"), "HKCU Internet Settings", "Controls whether the current-user proxy is enabled.", "控制当前用户代理是否启用。", "important");
            AddRegistryItem(rows, "proxy.server", "proxy", "Proxy server", internet?.GetValue("ProxyServer"), "HKCU Internet Settings", "Current-user proxy server address.", "当前用户代理服务器地址。", "important");
            AddRegistryItem(rows, "proxy.auto", "proxy", "Automatic configuration", internet?.GetValue("AutoConfigURL"), "HKCU Internet Settings", "Automatic proxy configuration URL.", "自动代理配置地址。", "important");
        }
        catch (UnauthorizedAccessException) { }

        foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces().Where(item => item.OperationalStatus == OperationalStatus.Up))
        {
            try
            {
                var dns = string.Join(", ", adapter.GetIPProperties().DnsAddresses.Select(address => address.ToString()));
                rows.Add(new ConfigurationItem($"dns.{adapter.Id}", "dns", adapter.Name, string.IsNullOrWhiteSpace(dns) ? "Automatic" : dns, adapter.NetworkInterfaceType.ToString(), "observable", "DNS servers visible for this active adapter.", "当前活动网络适配器可见的 DNS 服务器。", "normal"));
            }
            catch { }
        }

        var hosts = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "drivers", "etc", "hosts");
        try
        {
            var info = new FileInfo(hosts);
            if (info.Exists) rows.Add(new ConfigurationItem("hosts.metadata", "hosts", "Hosts file", $"{info.Length} bytes · {info.LastWriteTimeUtc:O}", hosts, "observable", "Metadata only. TraceGuard does not read the hosts file contents.", "仅记录元数据，TraceGuard 不读取 Hosts 文件正文。", "important"));
        }
        catch { }
        return rows;
    }

    public static IReadOnlyList<ConfigurationItem> WindowsUpdateItems()
    {
        var rows = new List<ConfigurationItem>();
        foreach (var serviceName in new[] { "wuauserv", "UsoSvc", "DoSvc", "BITS" })
        {
            try
            {
                using var service = new ServiceController(serviceName);
                rows.Add(new ConfigurationItem($"update.service.{serviceName}", "service", service.DisplayName, service.Status.ToString(), serviceName, "protected", "Windows update infrastructure is observed but never force-stopped.", "Windows 更新基础组件仅供观察，TraceGuard 不会强制停止。", "normal"));
            }
            catch { }
        }

        foreach (var processName in new[] { "MoUsoCoreWorker", "TiWorker", "TrustedInstaller", "UsoClient" })
        {
            var processes = Process.GetProcessesByName(processName);
            try
            {
                if (processes.Length > 0) rows.Add(new ConfigurationItem($"update.process.{processName}", "process", processName + ".exe", $"Running · {processes.Length}", "Windows Update", "protected", "An update-related Windows process is currently active.", "Windows 更新相关进程当前处于活动状态。", "important"));
            }
            finally { foreach (var process in processes) process.Dispose(); }
        }

        try
        {
            using var detect = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\Results\Detect");
            AddRegistryItem(rows, "update.last-detect", "activity", "Last update detection", detect?.GetValue("LastSuccessTime"), "Windows Update", "Last readable successful update detection time.", "最近一次可读取的更新检测成功时间。", "normal", "protected");
        }
        catch (UnauthorizedAccessException) { }
        if (rows.All(item => item.Category != "process")) rows.Add(new ConfigurationItem("update.activity", "activity", "Current activity", "Idle or not observable", "Windows Update", "protected", "No update worker process is currently visible to this user.", "当前用户没有观察到正在运行的更新工作进程。", "normal"));
        return rows;
    }

    public static IReadOnlyList<ConfigurationItem> FileAssociationItems()
    {
        var rows = new List<ConfigurationItem>();
        var targets = new[]
        {
            ("pdf", ".pdf", @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\UserChoice"),
            ("jpg", ".jpg", @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.jpg\UserChoice"),
            ("png", ".png", @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.png\UserChoice"),
            ("zip", ".zip", @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.zip\UserChoice"),
            ("html", ".html", @"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.html\UserChoice"),
            ("http", "HTTP", @"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"),
            ("https", "HTTPS", @"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice")
        };
        foreach (var (id, label, path) in targets)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(path);
                var value = Convert.ToString(key?.GetValue("ProgId"));
                if (!string.IsNullOrWhiteSpace(value)) rows.Add(new ConfigurationItem($"association.{id}", id, label, value, $"HKCU\\{path}", "observable", "Current-user default application association.", "当前用户的默认应用关联。", "important"));
            }
            catch (UnauthorizedAccessException) { }
        }
        return rows;
    }

    private static void ReadChromium(List<ConfigurationItem> rows, string id, string displayName, string profile)
    {
        var preferences = Path.Combine(profile, "Preferences");
        if (File.Exists(preferences))
        {
            TryReadJson(preferences, document =>
            {
                AddJson(rows, $"{id}.homepage", "homepage", displayName + " homepage", document.RootElement, ["homepage"], preferences, "Browser homepage configuration.", "浏览器主页配置。", "important");
                AddJson(rows, $"{id}.startup-mode", "startup", displayName + " startup mode", document.RootElement, ["session", "restore_on_startup"], preferences, "Browser startup behavior.", "浏览器启动行为。", "important");
                AddJson(rows, $"{id}.startup-pages", "startup", displayName + " startup pages", document.RootElement, ["session", "startup_urls"], preferences, "Pages opened when the browser starts.", "浏览器启动时打开的页面。", "important");
                AddJson(rows, $"{id}.download", "download", displayName + " download location", document.RootElement, ["download", "default_directory"], preferences, "Configured download folder.", "配置的下载目录。", "normal");
                AddJson(rows, $"{id}.search", "search", displayName + " search provider", document.RootElement, ["default_search_provider", "name"], preferences, "Configured default search provider.", "配置的默认搜索引擎。", "important");
            });
        }
        var extensions = Path.Combine(profile, "Extensions");
        if (!Directory.Exists(extensions)) return;
        foreach (var extension in Directory.EnumerateDirectories(extensions).Take(250))
        {
            try
            {
                var version = Directory.EnumerateDirectories(extension).OrderByDescending(Path.GetFileName).FirstOrDefault();
                if (version is null) continue;
                var manifest = Path.Combine(version, "manifest.json");
                if (!File.Exists(manifest)) continue;
                TryReadJson(manifest, document =>
                {
                    var name = JsonValue(document.RootElement, ["name"]);
                    var versionName = JsonValue(document.RootElement, ["version"]);
                    var extensionId = Path.GetFileName(extension);
                    rows.Add(new ConfigurationItem($"{id}.extension.{extensionId}", "extension", string.IsNullOrWhiteSpace(name) ? extensionId : name, versionName ?? "Installed", manifest, "observable", "Installed browser extension metadata.", "已安装浏览器扩展的元数据。", "important"));
                });
            }
            catch { }
        }
    }

    private static void ReadFirefox(List<ConfigurationItem> rows)
    {
        var profiles = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Mozilla", "Firefox", "Profiles");
        if (!Directory.Exists(profiles)) return;
        var keys = new[] { "browser.startup.homepage", "browser.newtabpage.enabled", "browser.download.dir", "network.proxy.type", "network.proxy.http" };
        foreach (var profile in Directory.EnumerateDirectories(profiles).Take(20))
        {
            var prefs = Path.Combine(profile, "prefs.js");
            if (!File.Exists(prefs)) continue;
            try
            {
                using var stream = new FileStream(prefs, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                using var reader = new StreamReader(stream);
                while (reader.ReadLine() is { } line)
                {
                    var key = keys.FirstOrDefault(candidate => line.StartsWith($"user_pref(\"{candidate}\"", StringComparison.Ordinal));
                    if (key is null) continue;
                    var comma = line.IndexOf(',');
                    var value = comma >= 0 ? line[(comma + 1)..].Trim().TrimEnd(')', ';').Trim().Trim('"') : string.Empty;
                    rows.Add(new ConfigurationItem($"firefox.{Path.GetFileName(profile)}.{key}", key.Contains("proxy") ? "proxy" : key.Contains("download") ? "download" : "homepage", "Firefox " + key, value, prefs, "observable", "Selected Firefox configuration value.", "选定的 Firefox 配置项。", key.Contains("homepage") || key.Contains("proxy") ? "important" : "normal"));
                }
            }
            catch { }
        }
    }

    private static void ReadBrowserPolicies(List<ConfigurationItem> rows, string id, string displayName, string path)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(path);
            if (key is null) return;
            foreach (var name in key.GetValueNames()) rows.Add(new ConfigurationItem($"{id}.policy.{name}", "policy", $"{displayName} policy · {name}", Convert.ToString(key.GetValue(name)) ?? string.Empty, $"HKCU\\{path}", "observable", "Current-user browser policy. Policy changes are important.", "当前用户浏览器策略；策略变化属于重要事件。", "important"));
        }
        catch (UnauthorizedAccessException) { }
    }

    private static void TryReadJson(string path, Action<JsonDocument> read)
    {
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var document = JsonDocument.Parse(stream);
            read(document);
        }
        catch { }
    }

    private static void AddJson(List<ConfigurationItem> rows, string id, string category, string name, JsonElement root, string[] path, string source, string description, string descriptionZh, string severity)
    {
        var value = JsonValue(root, path);
        if (!string.IsNullOrWhiteSpace(value)) rows.Add(new ConfigurationItem(id, category, name, value, source, "observable", description, descriptionZh, severity));
    }

    private static string? JsonValue(JsonElement root, string[] path)
    {
        var value = root;
        foreach (var segment in path)
        {
            if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(segment, out var next)) return null;
            value = next;
        }
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => value.ToString(),
            JsonValueKind.Array => string.Join(" | ", value.EnumerateArray().Take(8).Select(item => item.ValueKind == JsonValueKind.String ? item.GetString() : item.ToString())),
            _ => null
        };
    }

    private static void AddRegistryItem(List<ConfigurationItem> rows, string id, string category, string name, object? raw, string source, string description, string descriptionZh, string severity, string permission = "observable")
    {
        var value = raw switch { string[] values => string.Join(" | ", values), null => null, _ => Convert.ToString(raw) };
        if (!string.IsNullOrWhiteSpace(value)) rows.Add(new ConfigurationItem(id, category, name, value, source, permission, description, descriptionZh, severity));
    }
}
