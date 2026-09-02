using TraceGuard.Core.Protection;
using TraceGuard.Core.Storage;
using Xunit;

namespace TraceGuard.Core.Tests;

public sealed class CoreGuardTests
{
    [Theory]
    [InlineData("System")]
    [InlineData("Registry")]
    [InlineData("smss.exe")]
    [InlineData("csrss.exe")]
    [InlineData("wininit.exe")]
    [InlineData("winlogon.exe")]
    [InlineData("services.exe")]
    [InlineData("lsass.exe")]
    public void CriticalProcessesAreAlwaysProtected(string processName) => Assert.True(CoreGuard.IsProtectedProcess(processName));

    [Theory]
    [InlineData("RpcSs")]
    [InlineData("DcomLaunch")]
    [InlineData("PlugPlay")]
    [InlineData("wuauserv")]
    [InlineData("WinDefend")]
    public void CriticalServicesAreAlwaysProtected(string serviceName) => Assert.True(CoreGuard.IsProtectedService(serviceName));

    [Fact]
    public void OrdinaryUserProcessIsNotCoreProtected() => Assert.False(CoreGuard.IsProtectedProcess("notepad.exe"));

    [Theory]
    [InlineData(true, true, false, 0x2000u, false)]
    [InlineData(true, true, true, 0x2000u, true)]
    [InlineData(true, true, false, 0x3000u, true)]
    [InlineData(true, true, false, 0x4000u, true)]
    [InlineData(true, false, false, 0x2000u, true)]
    [InlineData(false, false, false, 0u, false)]
    public void ElevatedTokenDetectionFailsClosedOnWindows(bool isWindows, bool probeSucceeded, bool elevated, uint integrityRid, bool expected) =>
        Assert.Equal(expected, ExecutionPrivilegeGuard.ShouldBlock(isWindows, probeSucceeded, elevated, integrityRid));

    [Fact]
    public void ElevatedExecutionDenialIsBilingualAndDoesNotRequestMorePrivilege()
    {
        var result = CoreGuard.ElevatedExecutionDenied();

        Assert.False(result.Success);
        Assert.False(result.RequiresElevation);
        Assert.Contains("high-integrity", result.Message);
        Assert.Contains("高完整性", result.MessageZh);
    }

    [Fact]
    public async Task ElevatedCoreHostDoesNotCollectAndRejectsDestructiveActions()
    {
        var dataDirectory = Path.Combine(Path.GetTempPath(), "TraceGuard-elevated-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            using var host = new CoreHost(new AppPaths(dataDirectory), _ => { }, privilegeBlocked: true);
            await host.InitializeAsync();

            var overview = await host.GetOverviewAsync();
            Assert.False(overview.Monitoring);
            Assert.Equal("privilege-blocked", overview.MonitoringMode);
            Assert.Equal(0, overview.ProcessCount);
            Assert.All(overview.MonitorModules, module =>
            {
                Assert.Equal("blocked", module.State);
                Assert.Contains("high-integrity", module.Message);
                Assert.Contains("高完整性", module.MessageZh);
            });
            Assert.Empty(host.GetProcesses());
            Assert.Empty(host.GetServices());
            Assert.False(host.StopProcess(Environment.ProcessId).Success);
            Assert.False(host.StopService("Spooler").Success);
            Assert.False(host.DisableStartup("example", "run").Success);
            Assert.False((await host.ClearEventsAsync()).Success);
            Assert.False((await host.ClearReportsAsync()).Success);
            Assert.False((await host.ResetDatabaseAsync()).Success);
            Assert.False(host.ResumeMonitoring().Success);
        }
        finally
        {
            try { if (Directory.Exists(dataDirectory)) Directory.Delete(dataDirectory, true); } catch { }
        }
    }
}
