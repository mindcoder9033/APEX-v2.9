# APEX Telemetry Command Center - Build & Launch Guide

Here is how you can run **APEX Telemetry Command Center** locally and build the standalone portable Windows executable:

---

### 1. Initial Setup

Ensure your dependencies are installed:
```powershell
npm install
```

---

### 2. Running APEX Locally

You can run APEX in two different modes depending on your workflow:

#### Option A: Desktop App Mode (Electron - Recommended)
Runs APEX in the native frameless desktop interface with embedded UDP socket ingestion and WebSocket streaming:
```powershell
npm run electron:dev
```

#### Option B: Web & Browser Mode (Headless / LAN Pit-Wall)
Runs the Node.js backend server and serves the dashboard over HTTP:
```powershell
npm start
```
- Open `http://localhost:3000` in your web browser.
- Default ports: HTTP `3000`, WebSocket `8080`, UDP `9999` (configured in [`src/server/config.js`](file:///d:/AI%20Workspace/APEX%20v2.9/src/server/config.js)).

---

### 3. Testing with Simulated Telemetry (Optional)

If Forza Motorsport is not running, simulate live racing telemetry on a virtual track:
```powershell
npm run mock:stream
```
*Run this in a separate terminal while APEX is running to feed mock 60Hz telemetry data into UDP port 9999.*

---

### 4. Creating a Portable Windows Installer (`.exe`)

To package a standalone, zero-install portable executable:

```powershell
npm run electron:pack
```

#### Output Artifact:
- Packaged by `electron-builder` using the config in [`package.json`](file:///d:/AI%20Workspace/APEX%20v2.9/package.json#L15-L35).
- Output location: **`dist/APEX-Telemetry-Portable-1.0.0.exe`**
- This file can be run standalone on any Windows PC without installation.

---

### 5. Forza In-Game Telemetry Configuration

In Forza Motorsport / Horizon:
- **Data Out**: `ON`
- **IP Address**: `127.0.0.1` *(or your PC's LAN IP if running Forza on an Xbox console)*
- **Port**: `9999`
- **Packet Format**: `CarDash` / `Dash`