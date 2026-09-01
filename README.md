# TraceGuard

> See what changed. Understand why. Control what you own.  
> 看见变化。理解原因。控制属于你的系统权限。

TraceGuard is a local-first Windows 10/11 desktop application that explains software installation activity, background processes, services, startup entries, and file-system changes without requesting administrator privileges.

## Current status

Phase 1 and the planned Phase 2/3 observation flows are implemented. The current build contains the Electron + React desktop shell, bilingual premium-glass UI, structured live terminal, floating surfaces, a working .NET 8 observation core, CoreGuard, local persistence, installer behavior sessions, process launch chains, registry before/after diffs, user-level startup control, current-user Block Auto-Restart rules, browser/network/default-app baselines, Windows Update activity, exportable behavior reports, and truthful runtime collector health.

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

- Windows 11
- Windows 10 22H2 (best effort while supported by the underlying Electron and .NET runtimes)

Windows 7 is not supported.

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

## Roadmap

- **Phase 1 (complete):** executable desktop shell, i18n, process/service/startup visibility, basic file monitoring, live terminal, floating widget/bubble, SQLite persistence.
- **Phase 2 (complete):** installer sessions, process trees, registry diffing, user-startup control and restore, auto-restart blocking, launch-source analysis.
- **Phase 3 (complete):** browser/network/default-app/Windows Update observation and live configuration differences.
- **Phase 4 (active):** collector hardening, richer attribution, safe USN/ETW capability work, release testing and packaging.

## Known limitations

TraceGuard does not request administrator permission. Some system services, protected processes, and machine-level configuration can therefore be observed but cannot be controlled. This is expected behavior under the Windows security model.

File monitoring currently uses Windows `FileSystemWatcher` and records metadata within the current user's accessible scope. Installer reports associate those events with an installer session by time window; this is explicitly labeled as best-effort and is not presented as exact process attribution. TraceGuard safely probes whether the current user can query each NTFS USN Journal, but journal event reading and ETW attribution are not yet enabled and no fake settings are exposed for them. The probe never creates or modifies a journal. Disk activity aggregates I/O counters from processes readable by the current user, so elevated or protected-process activity can remain unaccounted for. The UI labels this boundary instead of inventing a value.

See [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY.md), and [development progress](docs/PROGRESS.md).
