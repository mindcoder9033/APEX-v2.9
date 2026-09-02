# APEX Telemetry Command Center v1.0.0 (Portable Release)

> **Official Release Notes & Announcement**  
> **Release Artifact**: `APEX-Telemetry-Portable-1.0.0.exe`  
> **Target Platform**: Windows 10 / 11 (64-bit)  
> **Architecture**: x64 (Zero-Installation Standalone Binary)  
> **Target Sim**: Forza Motorsport (2023) / Forza Horizon 4 & 5  

---

## 🏁 Summary

We are proud to announce the **v1.0.0 official production release** of **APEX: Racing Telemetry Command Center** as a standalone, zero-installation portable Windows application!

APEX is an offline, racecraft-focused telemetry analysis station engineered specifically for sim racers. Grounded strictly in the driver training curriculum of the legendary **Skip Barber Racing School ("Going Faster! Mastering the Art of Race Driving")**, APEX bridges the gap between raw data channels and actual lap-time reduction.

With this release, drivers can double-click a single executable to access 60Hz real-time telemetry, live friction circle vectors, tire slip angle monitoring, corner-by-corner coaching breakdowns, and client-side PDF reports—**with zero accounts, zero cloud dependencies, and zero setup hassle.**

---

## ⚡ What's New in v1.0.0

### 1. Single-Binary Portable Windows Executable
- **Zero Installation**: Run `APEX-Telemetry-Portable-1.0.0.exe` directly on any Windows PC. No Node.js, Python, or dependency installation required.
- **Embedded Engine**: Ships bundled with Electron 31, local UDP packet parser, and embedded WebSocket streaming bridge.
- **Offline & Private**: Never phones home. All telemetry analysis, memory ring buffers, and PDF exports are processed 100% locally on your machine.

### 2. High-Frequency 60Hz Live Cockpit HUD
- **Digital Instrument Cluster**: Low-latency speedometer (km/h & mph), gear indicator, tachometer, and powerband readouts.
- **Dynamic Sequential Shift Lights**: Progressive RPM light bar that auto-calibrates to individual vehicle redlines.
- **Microsecond Pedal Inputs**: High-precision throttle, brake, and clutch telemetry bars to identify pedal overlap and throttle hesitation.

### 3. Real-Time "Going Faster!" G-G Friction Circle
- **Real-Time Traction Vector**: 60Hz canvas visualization of your car's lateral ($G_y$) and longitudinal ($G_x$) acceleration.
- **Tire Traction Envelope**: Historical grip trail allowing drivers to instantly spot under-utilized grip, abrupt brake releases, or diamond vs. circular transition shapes.
- **Trail-Braking Diagnostics**: Visual feedback during the critical transition from straight-line threshold braking to apex turn-in.

### 4. 4-Corner Tire & Suspension Dynamics
- **4-Wheel Independent Thermals**: Live inner/surface tire temperatures in Celsius or Fahrenheit.
- **Slip Angle & Slip Ratio Monitoring**: Early warning indications for front-axle understeer scrub and rear-axle snap oversteer.
- **Dynamic Suspension Deflection**: Suspension travel and chassis load distribution indicators.

### 5. Stint Management & Session Analytics
- **Automatic Lap Boundary Detection**: Out-lap filtering, flying lap detection, and in-lap segmentation.
- **Pace Comparison**: Delta against Personal Best (PB) and theoretical optimal lap calculations.
- **Consistency Index**: Statistical lap-to-lap variance tracking across identical track conditions.

### 6. Client-Side Instant PDF Coaching Reports
- **100% Offline Compilation**: Multi-page PDF race engineering reports compiled entirely in local memory using `pdf-lib`.
- **Vector Telemetry Traces**: High-resolution graphs for speed, throttle, brake, steering angle, and G-loads.
- **Turn-by-Turn Racecraft Feedback**: Pinpoints lost tenths in corner entry threshold braking, apex minimum speed ($V_{min}$), and corner exit drive.

### 7. Dual-Mode Architecture (Desktop & LAN Pit-Wall)
- **Local Desktop HUD**: Frameless, sleek native application running beside or over your simulator.
- **LAN Pit-Wall Mode**: Built-in HTTP server allows engineers or friends to monitor your live telemetry on a second laptop, iPad, or mobile browser across the local network.

---

## 🎮 Forza Motorsport Setup Instructions

To stream telemetry to APEX:

1. Launch **Forza Motorsport** (or Forza Horizon).
2. Go to **Settings** ➔ **Gameplay & HUD** ➔ **Data Out**.
3. Configure the following settings:
   - **Data Out**: `ON`
   - **Data Out IP Address**: `127.0.0.1` *(or your PC's LAN IP if Forza runs on an Xbox console)*
   - **Data Out IP Port**: `9999`
   - **Data Out Packet Format**: `CarDash` (or `Dash`)
4. Launch `APEX-Telemetry-Portable-1.0.0.exe` and hit the track!

> [!TIP]
> **No Game Running?** You can test APEX right away with simulated telemetry using the included Laguna Seca 60Hz mock feed (`npm run mock:stream`).

---

## 📦 Binary Verification & Checksums

| Attribute | Details |
| :--- | :--- |
| **File Name** | `APEX-Telemetry-Portable-1.0.0.exe` |
| **Release Type** | Standalone Portable (Win32 / x64) |
| **File Size** | `72,800,300 bytes` (~69.4 MB) |
| **SHA-256 Checksum** | `2AADC53FEDD33E1B9BEB8D439720EF52E93D9DA93F5D541C0B9547CE5BE43226` |

---

## 💻 System Requirements

- **Operating System**: Windows 10 (1809+) or Windows 11 (64-bit)
- **Processor**: Intel Core i3 / AMD Ryzen 3 or higher
- **Memory**: 4 GB RAM (8 GB recommended)
- **Network**: Local Loopback / Home Wi-Fi (for Xbox console LAN streaming)
- **Sim Compatibility**: Forza Motorsport (2023), Forza Horizon 5, Forza Horizon 4

---

<p align="center">
  <b>Built for racers who want to go faster.</b><br>
  <i>"Speed is not about how hard you press the pedals, it is about how smoothly you manage the friction circle." — Skip Barber Racing School</i>
</p>
