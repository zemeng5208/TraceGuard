using TraceGuard.Core.Protection;

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
    public void CriticalServicesAreAlwaysProtected(string serviceName) => Assert.True(CoreGuard.IsProtectedService(serviceName));

    [Fact]
    public void OrdinaryUserProcessIsNotCoreProtected() => Assert.False(CoreGuard.IsProtectedProcess("notepad.exe"));
}
