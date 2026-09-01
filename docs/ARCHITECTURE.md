# TraceGuard architecture

TraceGuard deliberately separates presentation from Windows observation.

## Desktop host

Electron owns the lifecycle of four renderer surfaces: the full console, structured terminal, floating widget, and floating bubble. Its preload bridge exposes a narrow API and keeps Node.js unavailable to React. The Windows package uses a per-user installer, `asInvoker`, and no privileged service.

React renders every label through the bilingual copy layer. Settings are centralized in the first-class Settings page; other pages do not duplicate configuration controls.

## Windows core

The .NET 8 process accepts line-delimited JSON requests over redirected standard input/output. It performs process, service, startup, resource, and file-system observation using the current user's token. Responses explicitly distinguish controllable, observable, and protected objects.

Phase 1 file monitoring uses `FileSystemWatcher` over user folders, or accessible fixed volumes when the user opts into full-disk monitoring. It records metadata only. The USN Journal and ETW are reserved for Phase 4 and will appear in Settings only after they are genuinely implemented.

## Persistence

Events are written to a local SQLite database in `%LOCALAPPDATA%\TraceGuard`. WAL mode keeps short writes from blocking UI reads. Settings use versioned JSON and an atomic temporary-file replacement; malformed settings are quarantined and defaults are restored.

## Preview boundary

Browser development uses clearly isolated sample data from `data/preview.ts` to make visual work possible outside Windows. Packaged Electron builds never use that adapter: the preload bridge talks to the .NET core and displays a core-unavailable message if the process cannot start.
