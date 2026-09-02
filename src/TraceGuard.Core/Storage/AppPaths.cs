namespace TraceGuard.Core.Storage;

public sealed class AppPaths
{
    public AppPaths() : this(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TraceGuard"))
    {
    }

    internal AppPaths(string dataDirectory)
    {
        DataDirectory = dataDirectory;
        Directory.CreateDirectory(DataDirectory);
    }

    public string DataDirectory { get; }
    public string DatabasePath => Path.Combine(DataDirectory, "traceguard.db");
    public string SettingsPath => Path.Combine(DataDirectory, "settings.json");
}
