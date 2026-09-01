# TraceGuard architecture

TraceGuard deliberately separates presentation from Windows observation.

## Desktop host

Electron owns the lifecycle of four renderer surfaces: the full console, structured terminal, floating widget, and floating bubble. Its preload bridge exposes a narrow API and keeps Node.js unavailable to React. The Windows package uses a per-user installer, `asInvoker`, and no privileged service.

React renders every label through the bilingual copy layer. Settings are centralized in the first-class Settings page; other pages do not duplicate configuration controls.

## Windows core

The .NET 8 process accepts line-delimited JSON requests over redirected standard input/output. It performs process, service, startup, resource, registry-configuration, and file-system observation using the current user's token. Responses explicitly distinguish controllable, observable, and protected objects.

Phase 2 adds installer sessions. A low-overhead Toolhelp snapshot records parent PIDs, builds the observed process chain, and infers a launch source without elevating. The session captures selected HKCU configuration before and after execution and stores the resulting registry diff and risk-relevant summary in SQLite. File events are associated to the active session by time window until ETW/USN attribution is implemented; the UI states this limitation directly.

The rule engine stores current-user process rules in SQLite. Block Auto-Restart acts only when a matching automatic launch is observed and the signed-in user can terminate it. CoreGuard is checked before every stop attempt, and access failures remain read-only observations.

User-folder monitoring uses `FileSystemWatcher`. When the user opts into full-disk monitoring, the core first tries to open each existing NTFS journal with `GENERIC_READ` under the current token. Eligible volumes are tailed from their current `NextUsn`; inaccessible and non-NTFS volumes independently fall back to `FileSystemWatcher`. The journal parser accepts bounded USN v2 records and resolves existing files (or their parent directory after deletion) with `OpenFileById`. It records path and change type only, never contents. Exact originating-process correlation remains a separate ETW hardening task and temporal installer-session association is labeled best-effort.

The core reports the runtime state of every configured collector as active, available, reduced, paused, disabled, or unavailable. Battery mode is re-evaluated while the application is running: it reduces full-disk scope to user folders and lowers configuration polling frequency while preserving process observation. Dashboard event rates are queried from SQLite and its activity chart is derived from actual recent events; unreadable elevated-process I/O is never replaced with sample telemetry.

Optional ETW attribution uses a uniquely named normal real-time session, not the NT Kernel Logger. It starts only when the current token already belongs to `Performance Log Users`, enables the `Microsoft-Windows-Kernel-Process` process keyword and a bounded set of `Microsoft-Windows-Kernel-File` metadata keywords, and consumes their registered manifests through Microsoft's TraceEvent library. Exact normalized paths observed by both ETW and the primary file collector within a short window receive the ETW header PID and current process name. TraceGuard does not infer a match from filenames alone. Failed provider/session control leaves the primary collectors running and is reported as unavailable.

USN Journal capability probing opens each ready local NTFS volume with zero requested access and calls `FSCTL_QUERY_USN_JOURNAL`. Full-disk collection reopens only eligible volumes for read access and calls `FSCTL_READ_USN_JOURNAL`; it starts at the current journal tail so historical metadata is not replayed. TraceGuard never calls the create/delete journal controls, changes volume permissions, or enables a token privilege. A failed or revoked read therefore degrades to the ordinary current-user watcher path instead of elevation.

## Persistence

Events, installer sessions, behavior reports, and rules are written to a local SQLite database in `%LOCALAPPDATA%\TraceGuard`. WAL mode keeps short writes from blocking UI reads. Settings use versioned JSON and an atomic temporary-file replacement; malformed settings are quarantined and defaults are restored.

## Preview boundary

Browser development uses clearly isolated sample data from `data/preview.ts` to make visual work possible outside Windows. Packaged Electron builds never use that adapter: the preload bridge talks to the .NET core and displays a core-unavailable message if the process cannot start.
