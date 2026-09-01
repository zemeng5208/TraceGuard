using TraceGuard.Core.Models;

namespace TraceGuard.Core.Monitoring;

public sealed class FileMonitor(Action<TraceEvent> publish) : IDisposable
{
    private readonly List<FileSystemWatcher> _watchers = [];

    public void Start(bool fullDisk)
    {
        Stop();
        var roots = fullDisk ? DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed).Select(d => d.RootDirectory.FullName) : DefaultFolders();
        foreach (var root in roots.Distinct(StringComparer.OrdinalIgnoreCase)) TryWatch(root);
    }

    private static IEnumerable<string> DefaultFolders()
    {
        yield return Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        yield return Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        yield return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        yield return Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
    }

    private void TryWatch(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return;
        try
        {
            var watcher = new FileSystemWatcher(path)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
                InternalBufferSize = 32 * 1024,
                EnableRaisingEvents = true,
            };
            watcher.Created += (_, e) => Emit("CREATE", e.FullPath, "A file was created", "创建了文件");
            watcher.Changed += (_, e) => Emit("MODIFY", e.FullPath, "A file was modified", "修改了文件");
            watcher.Deleted += (_, e) => Emit("DELETE", e.FullPath, "A file was deleted", "删除了文件");
            watcher.Renamed += (_, e) => Emit("RENAME", $"{e.OldFullPath} → {e.FullPath}", "A file was renamed or moved", "文件被重命名或移动");
            _watchers.Add(watcher);
        }
        catch (UnauthorizedAccessException) { }
        catch (IOException) { }
    }

    private void Emit(string action, string path, string english, string chinese) => publish(new TraceEvent(
        0, DateTimeOffset.UtcNow, "file", action, english, chinese, path, null, null,
        IsUserDocument(path) ? "important" : "normal"));

    private static bool IsUserDocument(string path)
    {
        var special = new[] { Environment.SpecialFolder.DesktopDirectory, Environment.SpecialFolder.MyDocuments, Environment.SpecialFolder.MyPictures };
        return special.Select(Environment.GetFolderPath).Where(p => !string.IsNullOrWhiteSpace(p)).Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));
    }

    public void Stop()
    {
        foreach (var watcher in _watchers) watcher.Dispose();
        _watchers.Clear();
    }

    public void Dispose() => Stop();
}
