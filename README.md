# TraceGuard

> See what changed. Understand why. Control what you own.  
> 看见变化。理解原因。控制属于你的系统权限。

TraceGuard is a local-first Windows 10/11 desktop application that explains software installation activity, background processes, services, startup entries, and file-system changes without requesting administrator privileges.

## Current status

Version `0.2.0` is the current **pre-release MVP candidate**, not a stable release. Phase 1 and the planned Phase 2/3 observation flows are implemented. The current build contains the Electron + React desktop shell, bilingual premium-glass UI, structured live terminal, floating surfaces, a working .NET 8 observation core, CoreGuard, local persistence, installer behavior sessions, process launch chains, registry before/after diffs, user-level startup control, current-user Block Auto-Restart rules, browser/network/default-app baselines, Windows Update activity, exportable behavior reports, and truthful runtime collector health.

`0.2.0` 是当前的 **MVP 预发布候选版本**，并非稳定正式版。安装包、Portable 版本及零提权运行链路已经通过 Windows CI；Windows 10/11 消费级设备的完整实机兼容性矩阵仍在验证中。

## Safety model

- **Zero-Privilege:** TraceGuard runs as the signed-in user and never requests UAC elevation, installs a privileged service, loads a kernel driver, or bypasses Windows ACLs.
- **CoreGuard:** destructive actions against critical Windows components are permanently denied.
- **Explicit limits:** operations unavailable to the current user are shown as `Requires elevated permission` / `需要更高权限，TraceGuard 零提权模式不会请求管理员权限。`
- **Local-first privacy:** events stay on the device. File contents, browser passwords, cookies, chat content, and browsing-history content are not collected.

## Architecture

```text
Electron host + React/TypeScript UI
               │ JSON-line IPC
               ▼
.NET 8 Windows core ── SQLite event/settings store
               │
               ├─ Process tree, service and startup discovery
               ├─ Installer sessions + registry snapshots/diffs
               ├─ Current-user rules and startup control
               └─ File-system monitoring within current-user access
```

The UI runs in Electron for the frameless console, terminal, widget, and bubble surfaces. Windows-specific observation and permission checks live in a C#/.NET 8 process. Packaging is per-user and declares `asInvoker`.

## Supported Windows versions

- Windows 11 x64 (targeted; consumer-hardware matrix validation is still in progress)
- Windows 10 22H2 x64 (targeted on a best-effort basis while supported by the underlying Electron and .NET runtimes; consumer-hardware validation is still in progress)

Windows 7 and Windows 8.1 are not supported. No ARM64 package is currently produced. See the distinction between targeted and verified environments in [Compatibility](docs/COMPATIBILITY.md).

## Install, run, verify, and uninstall

The pre-release Windows build provides three files:

- `TraceGuard-Setup-0.2.0-x64.exe` — interactive per-user installer. It does not request administrator permission.
- `TraceGuard-Portable-0.2.0-x64.exe` — self-extracting portable build. It runs as the current user and does not install a Windows service.
- `SHA256SUMS.txt` — SHA-256 digests generated from the two executables by the release build.

安装版：运行 `TraceGuard-Setup-0.2.0-x64.exe`，按向导完成当前用户安装。Portable 版：直接运行 `TraceGuard-Portable-0.2.0-x64.exe`。两者均为 x64，均不会请求 UAC 提权。

Before running a downloaded file, place it beside `SHA256SUMS.txt` and verify its digest in PowerShell:

```powershell
$file = '.\TraceGuard-Setup-0.2.0-x64.exe'
$expected = (Get-Content .\SHA256SUMS.txt | Where-Object { $_ -match [regex]::Escape((Split-Path $file -Leaf)) }).Split()[0]
$actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant()
$actual -eq $expected
```

The result must be `True`. Replace `$file` with the Portable filename to verify that build. If the file is absent from `SHA256SUMS.txt` or the result is `False`, do not run it.

TraceGuard `0.2.0` is not code-signed. Windows SmartScreen may therefore show an unknown-publisher warning even when the checksum is valid. Only continue when the executable came from the TraceGuard repository release and its SHA-256 value matches; a future signed build is planned.

Uninstall the installed build from **Settings → Apps → Installed apps → TraceGuard → Uninstall** (or the equivalent Windows 10 Apps & features page). The uninstaller removes the application from the current user; it does not require administrator permission.

Local settings, events, reports, and rules are stored separately under `%LOCALAPPDATA%\TraceGuard`. They are not intentionally removed during an ordinary application uninstall, so reinstalling can preserve local history. To erase them, clear/reset the relevant data from TraceGuard Settings before uninstalling, or—after TraceGuard has exited—remove that directory manually. This never affects files observed by TraceGuard.

## Development

Prerequisites: Node.js 22+, npm 10+, and .NET 8 SDK on Windows.

```powershell
npm ci
npm run dev
```

Run the browser-only visual preview with:

```powershell
npm run dev:web
```

## Build

```powershell
dotnet publish src/TraceGuard.Core/TraceGuard.Core.csproj -c Release -r win-x64 --self-contained true
npm run build
npm run package:win
```

The Windows CI also starts the published core as the runner's ordinary user and verifies settings, overview, collector-health, pause/resume, and SQLite IPC responses. The smoke test never requests elevation or performs a destructive process/service/startup action.

After packaging, CI launches the complete `win-unpacked` Electron application and verifies that the React application shell mounts, the bundled C# Core starts, real process/service data arrives over IPC, ten collector capability states are present, and the packaged desktop version matches the release metadata. The test then terminates only its own TraceGuard process tree.

The packaged-app check also captures the rendered Dashboard after the Core is ready and publishes the PNG beside the installers as a CI artifact. This makes release visual review use the real Windows/Electron build rather than the browser preview adapter.

The final Portable executable is also launched directly. CI verifies its extraction wrapper, packaged renderer, bundled Core IPC, real system data, version, and clean application shutdown rather than assuming the portable target behaves like the unpacked directory.

CI also performs a silent per-user NSIS installation into an isolated runner directory, launches the installed application through the same full desktop health check, runs the generated uninstaller, and verifies that the installed executable is removed. No administrator permission or machine-wide installation is used.

## Roadmap

- **Phase 1 (complete):** executable desktop shell, i18n, process/service/startup visibility, basic file monitoring, live terminal, floating widget/bubble, SQLite persistence.
- **Phase 2 (complete):** installer sessions, process trees, registry diffing, user-startup control and restore, auto-restart blocking, launch-source analysis.
- **Phase 3 (complete):** browser/network/default-app/Windows Update observation and live configuration differences.
- **Phase 4 (active):** collector hardening, richer attribution, safe USN/ETW capability work, release testing and packaging.

## Known limitations

TraceGuard does not request administrator permission. Some system services, protected processes, and machine-level configuration can therefore be observed but cannot be controlled. This is expected behavior under the Windows security model.

The Windows build produces two per-user artifacts: `TraceGuard-Setup-<version>-x64.exe` and `TraceGuard-Portable-<version>-x64.exe`, plus `SHA256SUMS.txt` for integrity checks. CI rejects missing, duplicate, undersized, or non-PE artifacts. Packaging is explicitly local-only (`--publish never`); creating a package never uploads application data or release files.

File monitoring records metadata only. User-folder scope uses Windows `FileSystemWatcher`. When full-disk monitoring is enabled, TraceGuard starts at the current end of each already-existing NTFS USN Journal that the signed-in user can read, resolves paths by file ID where Windows permits it, and falls back to `FileSystemWatcher` independently for inaccessible or non-NTFS volumes. It never creates, resizes, or deletes a journal. Installer reports associate otherwise unattributed file events with an installer session by time window and label that result best-effort. If the current token already belongs to Windows' `Performance Log Users` group, TraceGuard starts a normal real-time ETW session for only the process and file manifest providers and attaches PID/process identity when an exact normalized path matches a primary collector event. It never uses the privileged NT Kernel Logger, changes group membership, captures stacks, or persists raw ETW payloads; failure leaves the primary data chain active. Disk activity aggregates I/O counters from processes readable by the current user, so elevated or protected-process activity can remain unaccounted for. The UI labels these boundaries instead of inventing values.

## License status

No software license has been declared for this repository yet. Do not infer redistribution or reuse rights from source availability.

本仓库目前尚未声明软件许可证；不要仅根据源码可见性推断再分发或复用权限。

See [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY.md), [compatibility](docs/COMPATIBILITY.md), [v0.2.0 pre-release notes](docs/releases/v0.2.0.md), and [development progress](docs/PROGRESS.md).
