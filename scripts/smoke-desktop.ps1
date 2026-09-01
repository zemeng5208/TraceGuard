param(
    [string]$Executable = './release/win-unpacked/TraceGuard.exe'
)

$ErrorActionPreference = 'Stop'

$executablePath = Resolve-Path -LiteralPath $Executable
$package = Get-Content -LiteralPath ./package.json -Raw | ConvertFrom-Json
$smokeFile = Join-Path $env:RUNNER_TEMP "traceguard-desktop-smoke-$([guid]::NewGuid().ToString('N')).json"

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $executablePath.Path
$startInfo.WorkingDirectory = Split-Path -Parent $executablePath.Path
$startInfo.UseShellExecute = $false
$startInfo.Environment['TRACEGUARD_SMOKE_FILE'] = $smokeFile

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo

try {
    if (-not $process.Start()) { throw 'The packaged TraceGuard desktop process could not be started.' }
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(45)
    while (-not (Test-Path -LiteralPath $smokeFile) -and [DateTimeOffset]::UtcNow -lt $deadline) {
        if ($process.HasExited) { throw "Packaged TraceGuard exited before reporting health (exit code $($process.ExitCode))." }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Path -LiteralPath $smokeFile)) { throw 'Packaged TraceGuard did not report desktop health within 45 seconds.' }

    $health = Get-Content -LiteralPath $smokeFile -Raw | ConvertFrom-Json
    if (-not $health.success) { throw "Desktop health check failed: $($health.error)" }
    if (-not $health.packaged) { throw 'Desktop smoke test did not run in packaged mode.' }
    if (-not $health.rendererReady) { throw 'React renderer did not mount the application shell.' }
    if (-not $health.coreReady -or $health.processCount -lt 1 -or $health.serviceCount -lt 1) { throw 'Packaged C# Core did not return real system data.' }
    if ($health.monitorModules -lt 10) { throw "Expected 10 collector capability states, found $($health.monitorModules)." }
    if ($health.version -ne $package.version) { throw "Packaged desktop version mismatch: expected $($package.version), found $($health.version)." }

    Write-Host "TraceGuard desktop smoke test passed: version=$($health.version), processes=$($health.processCount), services=$($health.serviceCount), modules=$($health.monitorModules)"
}
finally {
    if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
    $process.Dispose()
    Remove-Item -LiteralPath $smokeFile -Force -ErrorAction SilentlyContinue
}
