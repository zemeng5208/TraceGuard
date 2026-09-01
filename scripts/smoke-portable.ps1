$ErrorActionPreference = 'Stop'

$package = Get-Content -LiteralPath ./package.json -Raw | ConvertFrom-Json
$portable = "./release/TraceGuard-Portable-$($package.version)-x64.exe"
if (-not (Test-Path -LiteralPath $portable)) { throw "Portable artifact was not found: $portable" }

./scripts/smoke-desktop.ps1 -Executable $portable
Write-Host 'TraceGuard Portable extraction, desktop launch, Core IPC, and clean exit smoke test passed.'
