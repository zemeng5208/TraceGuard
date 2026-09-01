$ErrorActionPreference = 'Stop'

$package = Get-Content -LiteralPath ./package.json -Raw | ConvertFrom-Json
$version = $package.version
$project = [xml](Get-Content -LiteralPath ./src/TraceGuard.Core/TraceGuard.Core.csproj -Raw)
$coreProjectVersion = [string]$project.Project.PropertyGroup.Version
if ($coreProjectVersion -ne $version) { throw "Version mismatch: package.json=$version, TraceGuard.Core.csproj=$coreProjectVersion" }
$publishedCore = './src/TraceGuard.Core/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/TraceGuard.Core.exe'
if (-not (Test-Path -LiteralPath $publishedCore)) { throw 'Published TraceGuard Core is missing before packaging verification.' }
$coreFileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path -LiteralPath $publishedCore).Path).FileVersion
if ($coreFileVersion -ne "$version.0") { throw "Published core file version mismatch: expected $version.0, found $coreFileVersion" }
$expected = @(
    "TraceGuard-Setup-$version-x64.exe",
    "TraceGuard-Portable-$version-x64.exe"
)

$artifacts = @(Get-ChildItem -LiteralPath ./release -Filter 'TraceGuard-*.exe' -File)
if ($artifacts.Count -ne $expected.Count) {
    throw "Expected exactly $($expected.Count) Windows executables, found $($artifacts.Count)."
}

$checksumLines = foreach ($name in $expected) {
    $path = Join-Path ./release $name
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing Windows artifact: $name" }
    $item = Get-Item -LiteralPath $path
    if ($item.Length -lt 50MB) { throw "Windows artifact is unexpectedly small: $name ($($item.Length) bytes)" }

    $stream = [System.IO.File]::OpenRead($item.FullName)
    try {
        if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) { throw "Windows artifact does not have an MZ header: $name" }
    }
    finally { $stream.Dispose() }

    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $name"
}

$checksumPath = Join-Path ./release 'SHA256SUMS.txt'
$checksumLines | Set-Content -LiteralPath $checksumPath -Encoding utf8NoBOM
Write-Host "Verified Windows artifacts and wrote $checksumPath"
$checksumLines | ForEach-Object { Write-Host $_ }
