# Development progress

## Release status

`0.2.0` is version-normalized and its x64 Setup/Portable artifacts pass the automated Windows build, launch, Core IPC, per-user install, uninstall, PE-structure, and SHA-256 checks. It remains a **pre-release candidate** until the Windows 10/11 consumer-hardware matrix and final packaged visual review are complete; no stable GitHub Release has been published.

`0.2.0` 已完成版本统一，x64 安装包与 Portable 包已通过自动化 Windows 构建、启动、Core IPC、当前用户安装/卸载、PE 结构和 SHA-256 校验。目前仍是 **预发布候选版本**；Windows 10/11 消费级实机矩阵与最终成品视觉复核完成前，不视为稳定正式版。

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
- [ ] Final fidelity pass (packaged Windows Dashboard screenshot capture is automated; visual review remains)
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
- [x] Final Portable wrapper extraction, full desktop launch, Core IPC, and clean-exit smoke test

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
- [x] Incrementally read new USN v2 records on eligible volumes, resolve paths by file ID where accessible, and fall back per-volume without elevation
- [x] Supplement primary file events with exact-path PID/process attribution when the current token is already eligible for the bounded user-mode ETW session
- [ ] Expand exact originating-process coverage beyond eligible ETW exact-path matches (unmatched USN/Watcher events remain best-effort by design)
- [x] Evaluate current-token eligibility for user-session ETW control without requiring elevation
- [x] Enable only the process/file manifest providers for eligible current tokens and correlate exact-path metadata events with PID/process identity
- [ ] Complete Windows 10/11 hardware compatibility testing (automated Windows runner coverage is complete)
- [x] Normalize renderer, package, About page, and .NET assembly versions to `0.2.0`
- [ ] Publish the first verified `0.2.0` pre-release package

## Next checkpoint

Complete the packaged light/dark visual review and document results from Windows 10/11 consumer-hardware tests, then publish the verified `0.2.0` pre-release package.
