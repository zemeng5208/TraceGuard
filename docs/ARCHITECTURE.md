# TraceGuard architecture

TraceGuard deliberately separates presentation from Windows observation.

## Desktop host

Electron owns the lifecycle of four renderer surfaces: the full console, structured terminal, floating widget, and floating bubble. Its preload bridge exposes a narrow API and keeps Node.js unavailable to React. The Windows package uses a per-user installer, `asInvoker`, and no privileged service.

React renders every label through the bilingual copy layer. Settings are centralized in the first-class Settings page; other pages do not duplicate configuration controls.

## Windows core

The .NET 8 process accepts line-delimited JSON requests over redirected standard input/output. It performs process, service, startup, resource, registry-configuration, and file-system observation using the current user's token. Responses explicitly distinguish controllable, observable, and protected objects.

Phase 2 adds installer sessions. A low-overhead Toolhelp snapshot records parent PIDs, builds the observed process chain, and infers a launch source without elevating. The session captures selected HKCU configuration before and after execution and stores the resulting registry diff and risk-relevant summary in SQLite. File events are associated to the active session by time window until ETW/USN attribution is implemented; the UI states this limitation directly.

The rule engine stores current-user process rules in SQLite. Block Auto-Restart acts only when a matching automatic launch is observed and the signed-in user can terminate it. CoreGuard is checked before every stop attempt, and access failures remain read-only observations.

Phase 1 file monitoring uses `FileSystemWatcher` over user folders, or accessible fixed volumes when the user opts into full-disk monitoring. It records metadata only. The USN Journal and ETW are reserved for Phase 4 and will appear in Settings only after they are genuinely implemented.

## Persistence

Events, installer sessions, behavior reports, and rules are written to a local SQLite database in `%LOCALAPPDATA%\TraceGuard`. WAL mode keeps short writes from blocking UI reads. Settings use versioned JSON and an atomic temporary-file replacement; malformed settings are quarantined and defaults are restored.

## Preview boundary

Browser development uses clearly isolated sample data from `data/preview.ts` to make visual work possible outside Windows. Packaged Electron builds never use that adapter: the preload bridge talks to the .NET core and displays a core-unavailable message if the process cannot start.
