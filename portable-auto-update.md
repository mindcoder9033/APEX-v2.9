# Plan: Portable Auto-Update & GitHub CI/CD Release Pipeline

## Overview
Implement an automated update pipeline for the portable standalone Windows edition of APEX Telemetry Command Center (`APEX-Telemetry-Portable-X.X.X.exe`). 

When new releases or git tags are pushed to GitHub (`mindcoder9033/APEX-v2.9`), a GitHub Actions CI/CD workflow automatically builds the portable `.exe` artifact using `electron-builder` and attaches it to GitHub Releases. The running portable APEX desktop app checks the GitHub Releases API for newer SemVer versions, presents a telemetry-themed update notification modal (with release notes and download progress), downloads the replacement executable, and orchestrates an in-place hot swap with automatic relaunch using a detached helper script.

---

## Project Type
**ELECTRON DESKTOP (Node.js + Windows Native)**

---

## Success Criteria
- [x] Automated GitHub Actions release workflow builds and drafts a release with `APEX-Telemetry-Portable-${version}.exe` upon pushing version tags (e.g. `v2.9.1`).
- [x] Portable APEX client checks for updates on startup (and on-demand) via GitHub Releases API without requiring user authentication.
- [ ] Sleek telemetry-style UI banner/modal appears in titlebar or notification area when a newer version is available with release notes and update actions.
- [ ] 1-Click Update downloads the `.exe` with visual progress percentage and sha256 checksum verification.
- [ ] Safe in-place executable swap via detached PowerShell / batch script that waits for process termination, replaces `APEX-Telemetry-Portable.exe`, and relaunches the updated executable seamlessly.
- [ ] Graceful fallback: If automatic swap fails (e.g. permission/AV lock), direct manual download / folder open link is provided.

---

## Tech Stack
| Component | Technology | Rationale |
|---|---|---|
| **CI/CD Build Pipeline** | GitHub Actions (`windows-latest`) | Native Windows runner builds portable `.exe` with zero setup and uploads artifacts directly to GitHub Releases. |
| **Packaging Engine** | `electron-builder` | Already configured in repository for portable Windows binary creation. |
| **Update Discovery** | Node.js `https` / Fetch to GitHub Releases API | Lightweight, zero extra dependencies, works with public repos, extracts release tag and asset download URL. |
| **In-Place Replacer** | Detached PowerShell Helper (`spawn('powershell.exe', ... detached: true)`) | Solves Windows locked-file problem by waiting for APEX PID exit before replacing target `.exe` and restarting. |
| **Frontend UI** | Vanilla JS / CSS Modal in APEX Shell | Matches existing dark telemetry glassmorphism design system; zero bloat. |

---

## File Structure

```
d:/AI Workspace/APEX v2.9/
├── .github/
│   └── workflows/
│       └── release.yml                 # [COMPLETED] GitHub Actions CI/CD build & release workflow
├── src/
│   └── electron/
│       ├── updater/
│       │   ├── update-checker.js       # [COMPLETED] GitHub Release API polling & version comparison
│       │   ├── binary-swapper.js       # [NEW] Detached swap script execution & download engine
│       │   └── index.js                # [NEW] Updater IPC bridge & lifecycle orchestration
│       ├── main.js                     # [MODIFY] Register updater IPC handlers & startup check
│       └── preload.js                  # [MODIFY] Expose apexDesktop.updater APIs
└── public/
    ├── js/
    │   └── ui-updater.js               # [NEW] Update badge, modal dialog, changelog & progress UI
    ├── css/
    │   └── components/
    │       └── updater.css             # [NEW] Telemetry-styled update banner and progress bar
    └── index.html                      # [MODIFY] Include updater CSS/JS and modal markup container
```

---

## Task Breakdown

### Phase 1: GitHub Actions CI/CD Release Pipeline
- **Task ID:** `TASK-01`
- **Name:** Create automated GitHub Actions release workflow
- **Agent:** `devops-automator`
- **Skill:** `deployment-procedures`
- **Priority:** P1
- **Status:** COMPLETED
- **Dependencies:** None
- **INPUT:** `package.json` build config & git tag triggers.
- **OUTPUT:** `.github/workflows/release.yml` automating clean install, test run, `electron-builder --win portable`, and GitHub Release draft/publish.
- **VERIFY:** Workflow YAML syntax validation and step dry-run structure.

---

### Phase 2: Electron Main Process Updater Core
- **Task ID:** `TASK-02`
- **Name:** Implement GitHub Releases checker and SemVer comparator
- **Agent:** `backend-architect`
- **Skill:** `api-patterns`
- **Priority:** P1
- **Status:** COMPLETED
- **Dependencies:** `TASK-01`
- **INPUT:** `package.json` current version + GitHub repository metadata (`mindcoder9033/APEX-v2.9`).
- **OUTPUT:** `src/electron/updater/update-checker.js` querying `https://api.github.com/repos/mindcoder9033/APEX-v2.9/releases/latest`, comparing SemVer, and parsing release notes & asset download URL.
- **VERIFY:** Unit test with mock release payload testing newer, equal, and older version scenarios.

---

### Phase 3: In-Place Binary Download & Swap Mechanism
- **Task ID:** `TASK-03`
- **Name:** Build chunked downloader and detached Windows swap helper
- **Agent:** `backend-architect`
- **Skill:** `powershell-windows`
- **Priority:** P1
- **Dependencies:** `TASK-02`
- **INPUT:** Portable executable execution path (`process.env.PORTABLE_EXECUTABLE_FILE` or `process.execPath`) and target download URL.
- **OUTPUT:** `src/electron/updater/binary-swapper.js` supporting progress streaming, SHA256 integrity check, temp file staging, and detached PowerShell swap script execution.
- **VERIFY:** Test swap script logic with temp test files verifying clean file replacement and process launch.

---

### Phase 4: IPC Bridge & Main Lifecycle Integration
- **Task ID:** `TASK-04`
- **Name:** Connect updater to Electron IPC and preload layer
- **Agent:** `backend-architect`
- **Skill:** `clean-code`
- **Priority:** P2
- **Dependencies:** `TASK-02`, `TASK-03`
- **INPUT:** `src/electron/updater/index.js`, `main.js`, `preload.js`.
- **OUTPUT:** IPC channels (`updater:check`, `updater:download`, `updater:install-restart`, `updater:cancel`) and renderer bridge `window.apexDesktop.updater`.
- **VERIFY:** Check IPC message handling and error boundary recovery.

---

### Phase 5: Telemetry UI Notification & Modal
- **Task ID:** `TASK-05`
- **Name:** Build F1 telemetry update modal, progress bar, and changelog viewer
- **Agent:** `frontend-developer`
- **Skill:** `frontend-design`
- **Priority:** P2
- **Dependencies:** `TASK-04`
- **INPUT:** `public/index.html`, `public/css/`, `public/js/`.
- **OUTPUT:** `public/css/components/updater.css` and `public/js/ui-updater.js` providing non-intrusive titlebar badge, update modal with Markdown changelog renderer, download progress bar, and restart buttons.
- **VERIFY:** UI test for glassmorphism styling, responsive layout, and dismiss/postpone states.

---

## 🛡️ Risk Assessment & Rollback Strategy

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| Windows File Locking prevents `.exe` replacement | Medium | High | Use `process.env.PORTABLE_EXECUTABLE_FILE` detection; PowerShell script polls for process termination before initiating copy with retry loop. |
| Anti-Virus blocks detached PowerShell script | Low | Medium | Keep PowerShell commands concise with standard file copy and `Start-Process`; provide fallback button to open downloads folder. |
| Network interruption during 100MB download | Medium | Low | Chunked download with resume support and integrity verification before swap. |
| GitHub API rate limiting on frequent checks | Low | Low | Cache check results locally for 4 hours; only query on startup and explicit user "Check for Updates" click. |

---

## Phase X: Final Verification Checklist

- [ ] **Workflow Validation:** `.github/workflows/release.yml` triggers properly and runs `electron-builder`.
- [ ] **SemVer Check:** Correctly identifies when a remote GitHub tag is newer than local `package.json` version.
- [ ] **Download Integrity:** Downloaded file matches expected size and hash before initiating restart.
- [ ] **Portable Swapping:** Detached swap process successfully replaces the running portable `.exe` and relaunches APEX.
- [ ] **UI/UX Aesthetics:** Notification banner and modal adhere to APEX F1 dark/carbon telemetry styling.
- [ ] **Build Integrity:** `npm test` and `npm run electron:pack` execute without packaging or runtime regressions.
