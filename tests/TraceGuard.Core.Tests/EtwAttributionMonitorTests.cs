using TraceGuard.Core.Models;
using TraceGuard.Core.Monitoring;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class EtwAttributionMonitorTests
{
    [Theory]
    [InlineData(30, "CREATE")]
    [InlineData(26, "DELETE")]
    [InlineData(27, "RENAME")]
    [InlineData(28, "RENAME")]
    [InlineData(16, "MODIFY")]
    public void MapsOnlySupportedFileEvents(int eventId, string action) =>
        Assert.Equal(action, EtwAttributionMonitor.MapFileAction(eventId));

    [Theory]
    [InlineData(10)]
    [InlineData(12)]
    [InlineData(15)]
    [InlineData(24)]
    public void DoesNotInventActionsForMetadataOrReadEvents(int eventId) =>
        Assert.Null(EtwAttributionMonitor.MapFileAction(eventId));

    [Fact]
    public void AttributesOnlyAnExactRecentPathAndCompatibleAction()
    {
        using var monitor = new EtwAttributionMonitor();
        monitor.RecordObservation(new(@"C:\Users\Alice\Downloads\setup.exe", "CREATE", 4242, "installer.exe", DateTimeOffset.UtcNow));
        var item = new TraceEvent(0, DateTimeOffset.UtcNow, "file", "CREATE", "created", "创建", @"C:\Users\Alice\Downloads\setup.exe", null, null, "normal");

        var result = monitor.Attribute(item);

        Assert.Equal(4242, result.Pid);
        Assert.Equal("installer.exe", result.ProcessName);
    }

    [Fact]
    public void LeavesUnmatchedEventsUnattributed()
    {
        using var monitor = new EtwAttributionMonitor();
        monitor.RecordObservation(new(@"C:\Temp\one.txt", "MODIFY", 77, "writer.exe", DateTimeOffset.UtcNow));
        var item = new TraceEvent(0, DateTimeOffset.UtcNow, "file", "DELETE", "deleted", "删除", @"C:\Temp\two.txt", null, null, "normal");

        var result = monitor.Attribute(item);

        Assert.Null(result.Pid);
        Assert.Null(result.ProcessName);
    }
}
