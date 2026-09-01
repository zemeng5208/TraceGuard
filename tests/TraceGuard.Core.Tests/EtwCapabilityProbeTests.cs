using TraceGuard.Core.Platform;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class EtwCapabilityProbeTests
{
    [Fact]
    public void PerformanceLogUserIsReportedAsEligibleWithoutClaimingAttribution()
    {
        var status = EtwCapabilityProbe.Evaluate(true, true);

        Assert.Equal("available", status.State);
        Assert.Contains("not enabled yet", status.Message);
    }

    [Fact]
    public void OrdinaryTokenIsReportedAsUnavailableWithoutElevationAdvice()
    {
        var status = EtwCapabilityProbe.Evaluate(true, false);

        Assert.Equal("unavailable", status.State);
        Assert.Contains("will not request elevation", status.Message);
    }
}
