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
- [ ] Windows CI validation for the Phase 2 checkpoint

## Phase 2 — active

- [x] Installer process detection and persistent sessions
- [x] Parent/child/grandchild process capture with launch-source inference
- [x] Selected HKCU registry Snapshot A / Snapshot B diff
- [x] Application report page with severity-aware summaries
- [x] Current-user Run / RunOnce / Startup Folder disable action
- [x] SQLite-backed Rules center
- [x] Block Auto-Restart with CoreGuard and current-token permission checks
- [x] Explicit best-effort attribution disclosure
- [ ] Session completion grace period for long-lived installer descendants
- [ ] Restore disabled startup entries from the Restore Center
- [ ] Broader launch-source correlation with enumerated startup entries and scheduled tasks

## Next checkpoint

Complete the remaining Phase 2 restoration and attribution work, then begin Phase 3 with read-only browser configuration baselines and Windows Update activity observation.
