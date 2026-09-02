using TraceGuard.Core.Storage;

namespace TraceGuard.Core.Monitoring;

/// <summary>
/// Prevents TraceGuard's local persistence from feeding back into its own
/// filesystem event stream. Comparisons are canonical, case-insensitive, and
/// separator-bound so a sibling such as "TraceGuard-backup" is not excluded.
/// </summary>
internal sealed class MonitoringPathExclusions
{
    private readonly string _dataDirectory;
    private readonly HashSet<string> _files;
    private readonly HashSet<string> _fileNames;

    private MonitoringPathExclusions(string dataDirectory, IEnumerable<string> files)
    {
        _dataDirectory = Normalize(dataDirectory);
        _files = new HashSet<string>(files.Select(Normalize).Where(path => path.Length > 0), StringComparer.OrdinalIgnoreCase);
        _fileNames = new HashSet<string>(_files.Select(Path.GetFileName), StringComparer.OrdinalIgnoreCase);
    }

    public static MonitoringPathExclusions ForAppPaths(AppPaths paths) => new(paths.DataDirectory,
    [
        paths.DatabasePath,
        paths.DatabasePath + "-wal",
        paths.DatabasePath + "-shm",
        paths.SettingsPath + ".tmp",
        Path.Combine(paths.DataDirectory, "settings.tmp"),
    ]);

    internal static MonitoringPathExclusions CreateForTests(string dataDirectory, params string[] files) =>
        new(dataDirectory, files);

    public bool IsExcluded(string? path)
    {
        var candidate = Normalize(path);
        if (candidate.Length == 0) return false;
        if (_files.Contains(candidate)) return true;
        return IsSameOrDescendant(candidate, _dataDirectory);
    }

    public bool IsExcludedUnresolvedFileName(string? fileName) =>
        !string.IsNullOrWhiteSpace(fileName) && _fileNames.Contains(Path.GetFileName(fileName));

    internal static bool IsSameOrDescendant(string candidate, string directory)
    {
        var normalizedCandidate = Normalize(candidate);
        var normalizedDirectory = Normalize(directory);
        if (normalizedCandidate.Length == 0 || normalizedDirectory.Length == 0) return false;
        if (string.Equals(normalizedCandidate, normalizedDirectory, StringComparison.OrdinalIgnoreCase)) return true;
        if (!normalizedCandidate.StartsWith(normalizedDirectory, StringComparison.OrdinalIgnoreCase)) return false;
        return normalizedCandidate.Length > normalizedDirectory.Length &&
               IsSeparator(normalizedCandidate[normalizedDirectory.Length]);
    }

    private static string Normalize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return string.Empty;
        try
        {
            var normalized = UsnJournalMonitor.NormalizeExtendedPath(path.Trim());
            return Path.GetFullPath(normalized).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }
        catch (ArgumentException) { return string.Empty; }
        catch (NotSupportedException) { return string.Empty; }
        catch (PathTooLongException) { return string.Empty; }
    }

    private static bool IsSeparator(char value) => value is '\\' or '/';
}
