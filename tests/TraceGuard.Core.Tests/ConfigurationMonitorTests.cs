using TraceGuard.Core.Models;
using TraceGuard.Core.Monitoring;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class ConfigurationMonitorTests
{
    [Fact]
    public void DuplicateScheduledTaskRowsDoNotCrashBaselineCreation()
    {
        var duplicate = new StartupRow("Edge Update", "edgeupdate.exe /core", "scheduled-task", true, "observable");

        var index = ConfigurationMonitor.IndexStartupItems([duplicate, duplicate]);

        Assert.Single(index);
    }

    [Fact]
    public void SameTaskNameWithDifferentCommandsRemainsObservable()
    {
        var items = new[]
        {
            new StartupRow("Edge Update", "edgeupdate.exe /core", "scheduled-task", true, "observable"),
            new StartupRow("Edge Update", "edgeupdate.exe /ua", "scheduled-task", true, "observable")
        };

        var index = ConfigurationMonitor.IndexStartupItems(items);

        Assert.Equal(2, index.Count);
    }
}
