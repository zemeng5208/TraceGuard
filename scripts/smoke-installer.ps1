$ErrorActionPreference = 'Stop'

$package = Get-Content -LiteralPath ./package.json -Raw | ConvertFrom-Json
$installer = Resolve-Path -LiteralPath "./release/TraceGuard-Setup-$($package.version)-x64.exe"
$installDirectory = Join-Path $env:RUNNER_TEMP "TraceGuard-Install-$([guid]::NewGuid().ToString('N'))"

try {
    $install = Start-Process -FilePath $installer.Path -ArgumentList @('/S', "/D=$installDirectory") -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw "Per-user installer failed with exit code $($install.ExitCode)." }

    $installedExecutable = Join-Path $installDirectory 'TraceGuard.exe'
    $installedCore = Join-Path $installDirectory 'resources/core/TraceGuard.Core.exe'
    if (-not (Test-Path -LiteralPath $installedExecutable)) { throw 'Installed TraceGuard.exe was not found.' }
    if (-not (Test-Path -LiteralPath $installedCore)) { throw 'Installed C# Core executable was not found.' }

    ./scripts/smoke-desktop.ps1 -Executable $installedExecutable

    $uninstaller = Join-Path $installDirectory 'Uninstall TraceGuard.exe'
    if (-not (Test-Path -LiteralPath $uninstaller)) { throw 'Per-user uninstaller was not found.' }
    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) { throw "Per-user uninstaller failed with exit code $($uninstall.ExitCode)." }

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
    while ((Test-Path -LiteralPath $installedExecutable) -and [DateTimeOffset]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 500 }
    if (Test-Path -LiteralPath $installedExecutable) { throw 'TraceGuard.exe remained after silent uninstall.' }
    Write-Host 'TraceGuard per-user install, packaged launch, and uninstall smoke test passed.'
}
finally {
    if (Test-Path -LiteralPath $installDirectory) { Remove-Item -LiteralPath $installDirectory -Recurse -Force -ErrorAction SilentlyContinue }
}
