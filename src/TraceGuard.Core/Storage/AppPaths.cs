namespace TraceGuard.Core.Storage;

public sealed class AppPaths
{
    public AppPaths()
    {
        DataDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TraceGuard");
        Directory.CreateDirectory(DataDirectory);
    }

    public string DataDirectory { get; }
    public string DatabasePath => Path.Combine(DataDirectory, "traceguard.db");
    public string SettingsPath => Path.Combine(DataDirectory, "settings.json");
}
