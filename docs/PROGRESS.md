# Development progress

## Phase 1 MVP — complete

- [x] Electron + React + TypeScript desktop shell
- [x] English / Simplified Chinese runtime UI switching
- [x] Premium dark glass Dashboard matching the approved concept
- [x] Central Settings experience with Appearance priority
- [x] Structured Live Terminal with view-only pause, filters, search, Easy/Raw modes
- [x] Floating Widget and Floating Bubble renderer surfaces
- [x] Electron native bubble context menu and multi-window lifecycle
- [x] C# process and service discovery with permission status
- [x] Current-user Run / RunOnce / Startup Folder discovery
- [x] Basic metadata-only file monitoring
- [x] SQLite event persistence and retention
- [x] Atomic, versioned settings persistence
- [x] CoreGuard process/service denylist and tests
- [x] Windows CI build and packaged artifact
- [ ] Visual browser QA and final fidelity pass (browser runtime unavailable in the current cloud environment)
- [x] Windows CI validates .NET tests, C# publish, and renderer build
- [x] Windows package validation with separate per-user installer and portable artifact names
- [x] Runtime language switching for native tray, bubble menu, tooltip, and notifications
- [x] Published-core IPC smoke test running as the ordinary Windows CI user
- [x] Duplicate startup/scheduled-task rows are deterministically de-duplicated without hiding distinct commands
- [x] Release artifact structure, PE headers, minimum sizes, and SHA-256 checksums are validated in CI
- [x] Evaluate current-token ETW session eligibility without starting a session or changing permissions
- [x] Renderer, About page, Windows artifact, and .NET executable versions normalized to 0.2.0
- [x] Full packaged Electron + React + C# Core desktop smoke test in Windows CI
- [x] Per-user NSIS install, installed-app launch, and uninstall smoke test in Windows CI

## Phase 2 — complete

- [x] Installer process detection and persistent sessions
- [x] Parent/child/grandchild process capture with launch-source inference
- [x] Selected HKCU registry Snapshot A / Snapshot B diff
- [x] Application report page with severity-aware summaries
- [x] Current-user Run / RunOnce / Startup Folder disable action
- [x] SQLite-backed Rules center
- [x] Block Auto-Restart with CoreGuard and current-token permission checks
- [x] Explicit best-effort attribution disclosure
- [x] Session completion grace period for long-lived installer descendants
- [x] Restore disabled startup entries from the Restore Center
- [x] Broader launch-source correlation with enumerated startup entries and scheduled tasks

## Phase 3 — complete

- [x] Chrome, Edge, and Firefox readable configuration baselines
- [x] Default-application and file-association observation
- [x] Proxy, DNS, Hosts, and readable network-configuration observation
- [x] Windows Update service, worker-process, and event observation
- [x] Live configuration differences with bilingual explanations
- [x] Real readable-process CPU and I/O sampling
- [x] Exportable installer behavior reports with risk explanations

## Phase 4 / release hardening — active

- [x] Runtime collector health states: active, reduced, paused, disabled, unavailable
- [x] Dynamic battery-mode reduction without stopping core process observation
- [x] Real one-minute event rates and event-derived Dashboard chart
- [x] Remove hard-coded disk/network percentages and sample telemetry from production UI
- [x] Probe zero-privilege USN Journal readability per NTFS volume without creating or modifying journals
- [ ] Read and attribute USN journal events on volumes where the current user token is sufficient
- [x] Evaluate current-token eligibility for user-session ETW control without requiring elevation
- [ ] Enable and consume explicitly supported user-mode ETW providers only when the current token is eligible
- [ ] Complete Windows 10/11 build, installer, and runtime smoke tests
- [ ] Normalize release version and publish the first verified package

## Next checkpoint

Validate the published-core IPC smoke test in Windows CI, then continue with zero-privilege USN/ETW capability evaluation and full desktop runtime testing.
