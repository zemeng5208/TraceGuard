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
