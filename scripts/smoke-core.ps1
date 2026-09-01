param(
    [Parameter(Mandatory = $true)]
    [string]$Executable
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Executable)) {
    throw "TraceGuard Core executable was not found: $Executable"
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = (Resolve-Path -LiteralPath $Executable).Path
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo

function Read-RpcResponse {
    param(
        [System.Diagnostics.Process]$CoreProcess,
        [long]$ExpectedId
    )

    while (-not $CoreProcess.HasExited) {
        $line = $CoreProcess.StandardOutput.ReadLine()
        if ($null -eq $line) { break }
        try { $message = $line | ConvertFrom-Json -Depth 20 }
        catch { continue }
        if ($null -ne $message.event) { continue }
        if ($message.id -eq $ExpectedId) {
            if ($null -ne $message.error) { throw "Core RPC failed: $($message.error)" }
            return $message.result
        }
    }

    $errorText = $CoreProcess.StandardError.ReadToEnd()
    throw "TraceGuard Core exited before RPC $ExpectedId completed. $errorText"
}

function Invoke-CoreRpc {
    param(
        [System.Diagnostics.Process]$CoreProcess,
        [long]$Id,
        [string]$Method,
        [hashtable]$Params = @{}
    )

    $request = @{ id = $Id; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 20
    $CoreProcess.StandardInput.WriteLine($request)
    $CoreProcess.StandardInput.Flush()
    return Read-RpcResponse -CoreProcess $CoreProcess -ExpectedId $Id
}

try {
    if (-not $process.Start()) { throw 'TraceGuard Core could not be started.' }

    $settings = Invoke-CoreRpc -CoreProcess $process -Id 1 -Method 'getSettings'
    if ($settings.schemaVersion -ne 1) { throw "Unexpected settings schema: $($settings.schemaVersion)" }

    $overview = Invoke-CoreRpc -CoreProcess $process -Id 2 -Method 'getOverview'
    if ($overview.processCount -lt 1) { throw 'The process collector returned no running processes.' }
    if ($overview.monitorModules.Count -lt 8) { throw 'Runtime collector health is incomplete.' }

    $pause = Invoke-CoreRpc -CoreProcess $process -Id 3 -Method 'pauseMonitoring'
    if (-not $pause.success) { throw 'Pause monitoring RPC failed.' }
    $pausedOverview = Invoke-CoreRpc -CoreProcess $process -Id 4 -Method 'getOverview'
    if ($pausedOverview.monitoring -or $pausedOverview.monitoringMode -ne 'paused') { throw 'Paused monitoring state was not reported truthfully.' }

    $resume = Invoke-CoreRpc -CoreProcess $process -Id 5 -Method 'resumeMonitoring'
    if (-not $resume.success) { throw 'Resume monitoring RPC failed.' }
    $storage = Invoke-CoreRpc -CoreProcess $process -Id 6 -Method 'getStorageInfo'
    if ([string]::IsNullOrWhiteSpace($storage.databasePath)) { throw 'SQLite storage path was not reported.' }

    Write-Host "TraceGuard Core smoke test passed: processes=$($overview.processCount), services=$($overview.serviceCount), modules=$($overview.monitorModules.Count)"
}
finally {
    if (-not $process.HasExited) {
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(5000)) { $process.Kill($true) }
    }
    $process.Dispose()
}
