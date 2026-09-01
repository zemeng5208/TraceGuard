using TraceGuard.Core.Monitoring;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class RegistrySnapshotTests
{
    private readonly RegistrySnapshotService _snapshots = new();

    [Fact]
    public void DiffClassifiesCreatedModifiedAndDeletedValues()
    {
        var before = new Dictionary<string, string?>
        {
            [@"HKCU\Software\Example::Changed"] = "old",
            [@"HKCU\Software\Example::Removed"] = "value"
        };
        var after = new Dictionary<string, string?>
        {
            [@"HKCU\Software\Example::Changed"] = "new",
            [@"HKCU\Software\Example::Created"] = "value"
        };

        var changes = _snapshots.Diff(before, after);

        Assert.Contains(changes, change => change.ValueName == "Created" && change.ChangeType == "created");
        Assert.Contains(changes, change => change.ValueName == "Changed" && change.ChangeType == "modified" && change.OldValue == "old" && change.NewValue == "new");
        Assert.Contains(changes, change => change.ValueName == "Removed" && change.ChangeType == "deleted");
    }

    [Theory]
    [InlineData(@"HKCU\Software\Microsoft\Windows\CurrentVersion\Run::Updater")]
    [InlineData(@"HKCU\Software\Policies\Google\Chrome::HomepageLocation")]
    [InlineData(@"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings::ProxyEnable")]
    public void DiffMarksSensitiveConfigurationAsImportant(string key)
    {
        var changes = _snapshots.Diff(new Dictionary<string, string?>(), new Dictionary<string, string?> { [key] = "changed" });
        Assert.Equal("important", Assert.Single(changes).Severity);
    }
}
