using TraceGuard.Core.Monitoring;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class MonitoringPathExclusionsTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "TraceGuard-path-policy-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void ExcludesDataDirectoryAndAllDescendants()
    {
        var data = Path.Combine(_root, "TraceGuard");
        var policy = MonitoringPathExclusions.CreateForTests(data);

        Assert.True(policy.IsExcluded(data));
        Assert.True(policy.IsExcluded(Path.Combine(data, "reports", "session.json")));
        Assert.True(policy.IsExcluded(data.ToUpperInvariant()));
    }

    [Fact]
    public void DirectoryBoundaryDoesNotExcludePrefixSibling()
    {
        var data = Path.Combine(_root, "TraceGuard");
        var policy = MonitoringPathExclusions.CreateForTests(data);

        Assert.False(policy.IsExcluded(Path.Combine(_root, "TraceGuard-backup", "file.txt")));
        Assert.False(MonitoringPathExclusions.IsSameOrDescendant(data + "2", data));
    }

    [Fact]
    public void ExcludesExplicitSqliteAndTemporaryArtifacts()
    {
        var data = Path.Combine(_root, "TraceGuard");
        var external = Path.Combine(_root, "database");
        var database = Path.Combine(external, "traceguard.db");
        var policy = MonitoringPathExclusions.CreateForTests(data,
            database, database + "-wal", database + "-shm", Path.Combine(external, "settings.tmp"));

        Assert.True(policy.IsExcluded(database));
        Assert.True(policy.IsExcluded(database + "-wal"));
        Assert.True(policy.IsExcluded(database + "-shm"));
        Assert.True(policy.IsExcluded(Path.Combine(external, "settings.tmp")));
        Assert.False(policy.IsExcluded(database + ".backup"));
        Assert.True(policy.IsExcludedUnresolvedFileName("traceguard.db-wal"));
        Assert.False(policy.IsExcludedUnresolvedFileName("unrelated.db-wal"));
    }

    public void Dispose()
    {
        try { if (Directory.Exists(_root)) Directory.Delete(_root, true); } catch { }
    }
}
