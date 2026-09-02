# APEX: Racing Telemetry Command Center

public\favicon.ico

[![Forza Motorsport 2023](https://img.shields.io/badge/Forza_Motorsport-2023-red.svg?style=flat-square&logo=xbox)](https://www.xbox.com/en-US/games/forza-motorsport)
[![Telemetry Stream](https://img.shields.io/badge/Telemetry-60Hz_UDP-00ffcc.svg?style=flat-square)](https://github.com)
[![Platform](https://img.shields.io/badge/Platform-Windows_Portable_%7C_Web-blue.svg?style=flat-square&logo=windows)](https://github.com)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Offline-success.svg?style=flat-square)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

> **Professional-grade racing telemetry analysis for Forza Motorsport.**  
> Built strictly on the racecraft methodology of **"Going Faster!"** by the Skip Barber Racing School. Real-time 60Hz live HUD, friction circle dynamics, corner segmentation, and instant, offline PDF coaching reports with zero cloud subscriptions, accounts, or external dependencies.

---

## Table of Contents

- [Overview & Philosophy](#-overview--philosophy)
- [The "Going Faster!" Racecraft Methodology](#-the-going-faster-racecraft-methodology)
- [Core Features](#-core-features)
- [Architecture & Data Flow](#-architecture--data-flow)
- [Getting Started](#-getting-started)
  - [Option 1: Windows Portable App (Recommended)](#option-1-windows-portable-app-recommended)
  - [Option 2: Running from Source (Node.js / Web LAN)](#option-2-running-from-source-nodejs--web-lan)
- [Forza Motorsport In-Game Configuration](#-forza-motorsport-in-game-configuration)
  - [Configuration Settings](#configuration-settings)
  - [Setup A: Playing on the Same PC](#setup-a-playing-on-the-same-pc)
  - [Setup B: Playing on Xbox Console (LAN Pit-Wall)](#setup-b-playing-on-xbox-console-lan-pit-wall)
  - [Testing with Simulated Telemetry](#testing-with-simulated-telemetry)
  - [Firewall & Network Troubleshooting](#firewall--network-troubleshooting)
- [Interpreting Your Telemetry](#-interpreting-your-telemetry)
- [Telemetry Channels Captured](#-telemetry-channels-captured)
- [Privacy & Offline Guarantee](#-privacy--offline-guarantee)
- [Tech Stack](#-tech-stack)
- [License](#-license)

---

## 🏎️ Overview & Philosophy

Most sim racing telemetry tools are either overly complex engineering dashboards designed for race engineers or cloud-tethered subscription platforms that store your session data on third-party servers.

**APEX takes a different approach:**
1. **Instant Feedback**: Ingests high-frequency UDP data packets at 60Hz directly from your car into local memory.
2. **Racecraft-Focused**: Applies 25+ years of driver training principles from the legendary Skip Barber Racing School to diagnose where lap time is lost or gained.
3. **Zero Complexity**: No user accounts, logins, telemetry upload queues, or complex database setups.
4. **100% Offline & Private**: Runs completely on your local workstation. Zero cloud sync, zero external analytics, zero AI hallucination.

---

## 🏁 The "Going Faster!" Racecraft Methodology

APEX does not simply present raw numbers; it evaluates your driving against real racing physics documented in Carroll Smith's and Carl Lopez's **"Going Faster! Mastering the Art of Race Driving"**:

```
                 Braking (Peak Deceleration)
                           +1.5G
                             │
                             ▲
      Trail-Braking Transition ╲
                                ╲
  Left Cornering ◀───────────────●───────────────▶ Right Cornering
      -1.5G                      │                      +1.5G
                                ╱
      Throttle Exit Application╱
                             ▼
                           -1.0G
                 Acceleration (Longitudinal)
```

### 1. The Friction Circle (G-G Diagram)
Every tire has a finite traction envelope. You can use 100% of available grip for braking, 100% for cornering, or a vector combination of both.
- **Under-utilization**: Operating deep inside the circle means left-over grip that could have carried higher corner speed.
- **Spikes & Sudden Loss**: Abrupt transitions between longitudinal (braking/gas) and lateral (turning) loads break tire adhesion and induce slip or spin.

### 2. Trail Braking Efficiency
APEX analyzes the transition from maximum straight-line threshold braking to apex turn-in. It tracks how smoothly you bleed off brake pressure as you wind on steering lock to keep the front tires loaded without overwhelming total tire grip.

### 3. Corner Segmentation
Every corner is partitioned into three distinct telemetry zones:
- **Entry Phase**: Threshold braking, downshift stability, trail braking release rate, and initial turn-in yaw rate.
- **Apex Phase**: Minimum cornering speed ($V_{min}$), lateral G attainment, and duration of the transitional coast/neutral state.
- **Exit Phase**: Throttle application linearity, power delivery hesitation, and acceleration traction limit.

---

## ⚡ Core Features

### 🖥️ Real-Time 60Hz HUD & Dynamic Shift Lights
- **Digital Cockpit Display**: Speedometer, gear indicator, live RPM dial with color-coded powerband thresholds.
- **Predictive Shift Lights**: Progressive sequential shift-light bar calibrated to each vehicle's engine redline.
- **Pedal Input Traces**: Microsecond throttle, brake, and clutch position bars for instant throttle hesitation and trail-braking visibility.

### ⭕ Live G-G Friction Circle
- Dynamic HTML5 canvas drawing your real-time vehicle acceleration vector at 60Hz.
- Historical vector trail showing your tire grip envelope across consecutive corners.
- Real-time lateral ($G_y$) and longitudinal ($G_x$) readouts with peak retention indicators.

### 🛞 4-Corner Tire & Suspension Dynamics
- Real-time four-wheel tire surface temperatures (Celsius / Fahrenheit).
- Independent tire slip ratios and tire slip angles to detect front understeer or rear snap oversteer immediately.
- Dynamic suspension travel deflection and wheel load distribution.

### ⏱️ Stint Management & Session Analytics
- Automatic lap detection, out-lap filtering, and flying lap segmentation.
- Sector deltas, personal best comparisons, and theoretical optimal lap time calculation.
- Stint consistency scoring to measure lap-to-lap variance in identical conditions.

### 📄 Zero-Dependency Automated PDF Reports
- Instant post-stint report generation compiled entirely client-side using `pdf-lib` / `jsPDF`.
- High-resolution vector telemetry traces (Speed, Throttle, Brake, Steering, RPM, G-Forces).
- Automated corner-by-corner coaching summaries pinpointing lost tenths in braking zones and corner exits.

---

## 🛠️ Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      FORZA MOTORSPORT                       │
│              (PC or Xbox Console on Local LAN)               │
└──────────────────────────────┬──────────────────────────────┘
                               │  UDP Packets @ 60Hz (Port 9999)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      APEX BACKEND                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  UDP Ingestion Socket & CarDash Binary Parser          │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  High-Speed Circular Ring Buffer (Zero Allocation)    │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WebSocket Bridge (Port 8080) / Electron IPC Stream   │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │  60Hz Real-Time Frame
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   APEX COMMAND CENTER (UI)                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │ Live HUD Canvas  │  │ Friction Circle  │  │ Stint Mgr │  │
│  └──────────────────┘  └──────────────────┘  └───────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Going Faster! Racecraft Analysis & Corner Segmenter  │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Local Client-Side PDF Report Generator (Zero Cloud)  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Option 1: Windows Portable App (Recommended)

No Node.js, command line, or external runtimes required.

1. Download the latest **`APEX-Telemetry-Portable-x.x.x.exe`** from the [Releases](https://github.com) section (or package it locally from `dist/`).
2. Double-click the executable to launch the **APEX Telemetry Command Center**.
3. Configure Forza Motorsport using the [In-Game Settings](#-forza-motorsport-in-game-configuration) below.
4. As soon as you leave pit lane, APEX automatically begins recording your telemetry.

---

### Option 2: Running from Source (Node.js / Web LAN)

Ideal if you are customizing features, running APEX on a separate tablet/laptop over Wi-Fi, or building from source.

#### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

#### Installation
```bash
# Clone the repository
git clone https://github.com/mindcoder9033/APEX-v2.9.git
cd "APEX v2.9"

# Install dependencies
npm install
```

#### Launch Modes

**A. Native Desktop App (Electron)**
```powershell
npm run electron:dev
```
*Launches the native frameless window with direct socket bindings.*

**B. Web Pit-Wall Server (Browser Mode)**
```powershell
npm start
```
*Spawns the local telemetry bridge server.*
- Open your browser at **`http://localhost:3000`** (or `http://<your-pc-ip>:3000` from an iPad, tablet, or secondary pit-wall laptop on the same local network).

**C. Building the Portable Windows `.exe`**
```powershell
npm run electron:pack
```
*Generates the standalone portable binary inside the `dist/` directory.*

---

## 🎮 Forza Motorsport In-Game Configuration

To broadcast real-time telemetry from Forza Motorsport or Forza Horizon to APEX:

### Configuration Settings

In Forza Motorsport:
1. Navigate to **Settings** ➔ **Gameplay & HUD** (or **HUD and Gameplay**).
2. Scroll to the bottom to find the **DATA OUT** section.
3. Apply the following settings:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Data Out** | **ON** | Enables UDP telemetry output |
| **Data Out IP Address** | `127.0.0.1` *or* `<PC-LAN-IP>` | See setup scenarios below |
| **Data Out IP Port** | `9999` | Default APEX ingestion port |
| **Data Out Packet Format** | **CarDash** *(or Dash)* | Standard 311/324-byte packet |

---

### Setup A: Playing on the Same PC
If Forza Motorsport and APEX run on the same Windows computer:
- **Data Out IP Address**: `127.0.0.1` (Localhost)
- **Data Out IP Port**: `9999`

---

### Setup B: Playing on Xbox Console (LAN Pit-Wall)
If Forza is running on an Xbox Series X/S or Xbox One, and APEX is running on your PC or laptop:
1. Find your PC's local network IP address:
   - On Windows: Open PowerShell / Command Prompt and type `ipconfig`. Look for **IPv4 Address** (e.g., `192.168.1.145`).
2. On your Xbox console in Forza's Data Out menu:
   - Set **Data Out IP Address** to your PC's IP (e.g., `192.168.1.145`).
   - Set **Data Out IP Port** to `9999`.
3. Ensure both your Xbox and PC are connected to the same home router / local network.

---

### 🧪 Testing with Simulated Telemetry

Want to preview the HUD, telemetry gauges, and PDF reports without booting the game? APEX includes a high-fidelity 60Hz mock feed simulating a competitive lap around Laguna Seca:

1. Launch APEX (`npm start` or the portable `.exe`).
2. In a separate terminal, start the mock feed:
   ```powershell
   npm run mock:stream
   ```
3. The dashboard will immediately come alive with full vehicle dynamics, gear shifts, throttle/brake telemetry, and G-G vectors.

---

### 🛡️ Firewall & Network Troubleshooting

- **Windows Defender Firewall Alert**: When APEX or Node.js runs for the first time, Windows will prompt for network permissions. Ensure **Private networks** is checked.
- **No data arriving?**:
  1. Verify Forza's Data Out toggle is set to **ON** (Forza occasionally resets this after major game updates).
  2. Confirm the port is exactly **`9999`**.
  3. If streaming from Xbox, verify that your PC's network profile is set to **Private** in Windows Settings, and temporarily verify whether your firewall blocks incoming UDP port 9999:
     ```powershell
     # Test UDP listener availability
     Get-NetUDPEndpoint -LocalPort 9999
     ```

---

## 📈 Interpreting Your Telemetry

| Indicator | Ideal Racecraft Target | Coaching Diagnosis |
| :--- | :--- | :--- |
| **G-G Diamond vs Circle** | Smooth, rounded outer boundary | A "pinched" or star-shaped pattern indicates you are braking, then completely releasing before turning, rather than trail braking smoothly into the apex. |
| **Throttle Hesitation** | Single, committed, progressive press | Stepped or sawtooth throttle application on exit signals that you applied power before the car was rotated, causing understeer and lost drive down the following straight. |
| **Tire Slip Angles** | Within the car's peak grip window | High front slip angle accompanied by steering angle saturation indicates terminal understeer ($V_{entry}$ was too high). |
| **Brake Release Shape** | Linear taper from peak threshold | Abrupt brake snap releases destabilize the rear axle, causing pitch oscillation and snapping the rear out during turn-in. |

---

## 📡 Telemetry Channels Captured

APEX processes the full Forza Motorsport UDP stream at 60Hz:

- **Engine & Drivetrain**: RPM, Redline, Idle RPM, Speed (km/h & mph), Current Gear, Power (kW), Torque (Nm), Boost (psi/bar).
- **Driver Inputs**: Normalized Throttle ($0-100\%$), Brake ($0-100\%$), Clutch ($0-100\%$), Handbrake, Steering Angle.
- **Chassis & Acceleration**: Longitudinal Acceleration ($G_x$), Lateral Acceleration ($G_y$), Vertical Acceleration ($G_z$), Yaw, Pitch, Roll velocities.
- **4-Corner Wheel Dynamics**: Front-Left, Front-Right, Rear-Left, Rear-Right:
  - Wheel Rotation Speed
  - Tire Slip Ratio (longitudinal wheelspin/lockup)
  - Tire Slip Angle (lateral scrub)
  - Normalized Tire Load
  - Suspension Travel Deflection
  - Surface Tire Temperature (°C / °F)
- **Position & Timing**: Lap Number, Current Lap Time, Best Lap Time, Last Lap Time, Race Position, In-Race Distance, Coordinate Trajectory ($X, Y, Z$).

---

## 🔒 Privacy & Offline Guarantee

Unlike web platforms that require you to upload personal telemetry data to foreign servers, **APEX is strictly local-first**:

- **Zero Cloud Communication**: No external network requests are made during telemetry capture or analysis.
- **Zero Account Requirements**: No sign-ups, passwords, tracking cookies, or subscription tiers.
- **Local Client-Side Reports**: All PDF generation is compiled in memory on your CPU using local vector engines.
- **Your Data Remains Yours**: Session data and CSV exports remain exclusively on your local hard drive.

---

## 💻 Tech Stack

- **Desktop Shell**: [Electron](https://www.electronjs.org/) for cross-process native desktop execution and system tray integration.
- **Runtime & Server**: [Node.js](https://nodejs.org/) (`dgram` native UDP socket parser, `http` static asset server).
- **Real-Time Streaming**: High-throughput [ws](https://github.com/websockets/ws) WebSockets bridging 60Hz binary frames.
- **Frontend Core**: Vanilla HTML5 / ES6 JavaScript / Modern CSS (Zero bulky frontend frameworks, microsecond rendering latency).
- **Vector Rendering**: HTML5 2D Canvas API for micro-latency 60FPS HUD gauges and G-G friction diagrams.
- **Report Engine**: [pdf-lib](https://pdf-lib.js.org/) client-side vector document compiler.
- **Packaging**: [electron-builder](https://www.electron.build/) for single-binary zero-install Windows portability.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete details.

---

<p align="center">
  <b>Built for racers who want to go faster.</b><br>
  <i>"Speed is not about how hard you press the pedals, it is about how smoothly you manage the friction circle." — Skip Barber Racing School</i>
</p>
