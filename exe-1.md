# Standalone Desktop Application Packaging (APEX Desktop)

Package the **APEX Telemetry Command Center** into a high-performance standalone Windows desktop application (`.exe`) using **Electron** with an embedded Node.js backend (UDP 60Hz telemetry receiver + WebSocket hub), frameless F1 pit-wall UI, native file dialogs with auto-archiving, a one-click Forza Motorsport UWP loopback & firewall utility, and zero-install portable packaging via `electron-builder`.

---

## User Review Required

> [!IMPORTANT]
> - **Dependency Installation**: `electron` and `electron-builder` will be added as `devDependencies` in `package.json`.
> - **Desktop Window Only (`file://`)**: The Electron renderer will load `public/index.html` directly via `file://`. The existing Node.js HTTP server (`src/server/udp-proxy.js`) remains completely intact and unaffected for standalone web/server usage.
> - **Windows Loopback Exemption**: Windows UWP restrictions prevent Forza Motorsport (Microsoft Store / Game Pass version) on the same PC from sending UDP packets to `127.0.0.1` unless exempted. The desktop app will feature a built-in one-click utility running `CheckNetIsolation.exe` with user elevation.

---

## Proposed Changes

### Build Configuration & Project Dependencies

#### [MODIFY] [package.json](file:///D:/AI%20Workspace/APEX%20v2.9/package.json)
- Add `"electron": "^31.0.0"` and `"electron-builder": "^24.13.3"` (or latest compatible) to `devDependencies`.
- Add script targets:
  - `"electron:dev"`: Launch Electron in development mode pointing to `src/electron/main.js`.
  - `"electron:pack"`: Build Windows Portable single executable (`.exe`).
- Define `build` configuration specifying `win: { target: ["portable"], icon: "public/favicon.ico" }` and portable output parameters.

#### [NEW] [electron-builder.yml](file:///D:/AI%20Workspace/APEX%20v2.9/electron-builder.yml)
- Dedicated configuration file for `electron-builder`:
  - Product Name: `APEX Telemetry Command Center`
  - App ID: `com.apex.telemetry`
  - Windows Target: `portable` (x64)
  - Output Directory: `dist/`
  - File filters to bundle runtime assets (`src/`, `public/`, `package.json`) while excluding tests and markdown docs.

---

### Electron Main & IPC Backend Layer

#### [NEW] [src/electron/main.js](file:///D:/AI%20Workspace/APEX%20v2.9/src/electron/main.js)
- Electron Main process lifecycle manager:
  - Initializes `BrowserWindow` with `frame: false`, `titleBarStyle: 'hidden'`, dark background (`#0a0a0c`), min dimensions (`1280x800`).
  - Spawns embedded UDP receiver (`dgram.createSocket`) and WebSocket broadcaster (`ws.WebSocketServer`) on startup.
  - Registers IPC handlers:
    - `window:minimize`, `window:maximize`, `window:unmaximize`, `window:close`, `window:isMaximized`.
    - `dialog:save-file` (Native Save File dialog for PDF and CSV exports).
    - `file:auto-archive` (Silently writes PDFs/CSVs to `%USERPROFILE%/Documents/APEX Telemetry/Reports/`).
    - `system:get-lan-ip` (Detects local machine IPv4 for console UDP setup).
    - `system:check-loopback` & `system:enable-loopback` (Executes UWP loopback commands).
  - Handles clean socket and server teardown upon application quit.

#### [NEW] [src/electron/preload.js](file:///D:/AI%20Workspace/APEX%20v2.9/src/electron/preload.js)
- Secure context bridge (`contextBridge.exposeInMainWorld('apexDesktop', ...)`):
  - Exposes window control APIs (`minimize`, `maximize`, `close`, `onMaximizeChange`).
  - Exposes native file save dialogs and auto-archive triggers.
  - Exposes UWP loopback inspection and execution bridge.
  - Exposes platform metadata (`isDesktop: true`, `platform: process.platform`).

#### [NEW] [src/electron/loopback-helper.js](file:///D:/AI%20Workspace/APEX%20v2.9/src/electron/loopback-helper.js)
- Utility module executing and parsing Windows commands:
  - Detects network interfaces and returns the active LAN IPv4 address (e.g. `192.168.1.50`).
  - Checks if Forza Motorsport (`Microsoft.ForzaMotorsport_8wekyb3d8bbwe` / `Microsoft.SunriseBaseGame_8wekyb3d8bbwe`) has loopback exemption.
  - Generates and executes elevation script / `CheckNetIsolation.exe LoopbackExempt -a -n=...`.

---

### Frontend UI & Client Integration

#### [MODIFY] [public/index.html](file:///D:/AI%20Workspace/APEX%20v2.9/public/index.html)
- Add a draggable top bar region (`-webkit-app-region: drag`) within `.pit-header`.
- Add desktop window control button group (`#desktop-window-controls` containing minimize, maximize/restore, close buttons) dynamically enabled when `window.apexDesktop` is present.
- Add loopback utility trigger button in the header toolbar (`#btn-open-loopback-tool`).
- Embed modal dialog markup for the One-Click UWP Loopback & Firewall Tool (`#modal-loopback-tool`).

#### [MODIFY] [public/css/index.css](file:///D:/AI%20Workspace/APEX%20v2.9/public/css/index.css)
- Implement CSS rules for draggable window regions (`.app-drag-region`, `.no-drag`).
- Style custom F1 pit-wall window control buttons (chamfered hover states, red close button highlight).
- Style the UWP loopback and network diagnostics modal with OLED dark panel, status badges, and action buttons.

#### [MODIFY] [public/js/app.js](file:///D:/AI%20Workspace/APEX%20v2.9/public/js/app.js)
- Detect `window.apexDesktop` environment on initialization.
- Wire event listeners for custom minimize, maximize, and close buttons.
- Connect PDF and CSV export handlers to native save dialog and auto-archive pipeline when running in Electron.

#### [NEW] [public/js/components/loopback-modal.js](file:///D:/AI%20Workspace/APEX%20v2.9/public/js/components/loopback-modal.js)
- Modal controller that displays:
  - Current LAN IP address and target port (`9988`).
  - Step-by-step telemetry configuration guide for Forza in-game settings.
  - One-click "Enable UWP Loopback Exemption" button with instant live status check and feedback toast.

---

### Verification & Automated Testing

#### [NEW] [tests/electron-integration.test.js](file:///D:/AI%20Workspace/APEX%20v2.9/tests/electron-integration.test.js)
- Unit tests verifying:
  - Loopback helper command generator and LAN IP resolution.
  - Embedded UDP and WebSocket port binding and message lifecycle.
  - Auto-archive directory path generation and file persistence safety.

---

## Verification Plan

### Automated Tests
- Run complete test suite:
  ```powershell
  npm test
  ```
- Run new Electron integration test suite:
  ```powershell
  node --test tests/electron-integration.test.js
  ```

### Manual Verification
1. **Launch Development Electron App**:
   ```powershell
   npm run electron:dev
   ```
2. **Window Controls Verification**:
   - Verify drag-and-move functionality across the top bar.
   - Verify minimize, maximize/restore toggle, and close buttons respond instantly.
3. **Telemetry & Live Pit-Wall Streaming**:
   - Start synthetic stream in another terminal (`npm run mock:stream`).
   - Confirm live HUD, shift lights, 2.5D track map, and telemetry gauges animate at 60Hz.
4. **Export & Auto-Archive Verification**:
   - Record a stint and trigger PDF export -> verify native Save File dialog opens.
   - Verify PDF is saved correctly to `Documents/APEX Telemetry/Reports/`.
5. **Forza Loopback Helper Verification**:
   - Open Loopback & Network Diagnostics modal -> verify active LAN IP displays accurately.
   - Click "Verify / Enable Loopback" -> confirm status feedback.
