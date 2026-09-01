# Security model

## Zero-Privilege

TraceGuard must never request administrator or SYSTEM rights. Both the Electron package and .NET executable declare `asInvoker`. There is no Windows Service, kernel driver, filter driver, `runas`, ACL bypass, security-descriptor rewrite, or privilege escalation path.

An operation that Windows denies is surfaced as:

- `Requires elevated permission. TraceGuard Zero-Privilege Mode will not request administrator rights.`
- `需要更高权限，TraceGuard 零提权模式不会请求管理员权限。`

## CoreGuard

CoreGuard rejects destructive actions against critical Windows processes and infrastructure before any operating-system control call is attempted. This protection has no advanced-mode bypass. The protected baseline includes System, Registry, Session Manager, Client/Server Runtime, Wininit, Winlogon, Service Control Manager, LSASS, RPC infrastructure, Plug and Play, Event Log, SAM, Task Scheduler, and WMI.

## Data boundaries

- Processing and storage are local.
- File events store paths and metadata, never file contents.
- Disabling path storage replaces event details with a non-path summary.
- Browser monitoring must not read passwords, cookies, form data, or browsing-history content.
- TraceGuard currently sends no telemetry.

## USN Journal boundary

TraceGuard queries existing NTFS journals read-only. Full-disk monitoring tails only new records on volumes the signed-in user's token can open with `GENERIC_READ`; it does not replay earlier records. It never creates, deletes, resizes, or configures a journal and never enables backup, security, or volume-management privileges. If Windows refuses access, that volume falls back to `FileSystemWatcher` and the limitation remains visible in collector health.

## ETW boundary

Windows restricts general ETW session control to administrators, the built-in `Performance Log Users` group, and specific service accounts; NT Kernel Logger control is stricter. TraceGuard only inspects the current token for existing `Performance Log Users` membership. It never adds the user to that group, requests elevation, starts a privileged kernel session, or reports provider attribution as active before it is actually implemented and verified.
