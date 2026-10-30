# APEX Android - Implementation Plan

**Project:** APEX Android (Native Sim Racing Telemetry Command Center)  
**Target Directory:** `./android`  
**Date:** 2026-10-30  
**Status:** Ready for Execution (`/create`)  
**Primary Agent:** `mobile-developer`  
**Primary Skills:** `mobile-design`, `clean-code`, `plan-writing`

---

## 1. Project Context & Decisions Log

The following decisions were finalized during the `/grill-me` architectural interview:

| Decision Area | Selected Strategy | Rationale |
|---|---|---|
| **Operating Architecture** | Standalone UDP Ingestion Only | Android device directly receives and decodes 60Hz UDP packets on port 9999 over local Wi-Fi from Xbox or PC. Zero desktop PC dependency. |
| **Technology Stack** | Native Kotlin + Jetpack Compose | Hardware-accelerated 60/120Hz Compose Canvas, zero-copy `ByteBuffer` UDP ingestion, direct `DatagramChannel` OS socket, zero GC stutter on rig displays. |
| **Form Factor & Layout** | Adaptive (Phone & Tablet) | Landscape Cockpit HUD optimized for phones mounted on steering wheels/wheel bases; expands to multi-pane Pit-Wall Command Center on tablets and foldables. |
| **Functional Scope (v1.0)** | Core Telemetry + In-App Stint Analysis & Coaching | Live HUD, Friction Circle, 4-corner tire/suspension dynamics, auto lap/stint segmentation, "Going Faster!" corner diagnostics, and CSV export. (PDF export and Career Hub deferred to v1.1). |
| **Storage Architecture** | Tiered Storage (Room SQLite + Binary Traces) | Room DB for Sessions, Stints, Laps, and Corner metrics (fast relational querying); compact binary files for raw 60Hz high-frequency traces loaded on demand for graphing. |
| **Background & Power** | Foreground Service + Keep-Screen-On with Auto-Dim | Android Foreground Service with `WifiLock` (HIGH_PERF) prevents socket sleep; screen stays active while driving with AMOLED auto-dim in pit lane to protect OLED panels. |
| **Post-Stint Views** | 4 Interactive In-App Analysis Views | 1. Synchronized scrubbable telemetry graphs (Speed, Brake, Throttle, Gs)<br>2. In-App Friction Circle Heatmap<br>3. Turn-by-Turn "Going Faster!" coaching breakdown<br>4. 2D Reconstructed Track Map with speed heatmap |
| **Network Setup UX** | Auto-Detect & Minimal Status | Live local Wi-Fi IP display with active port banner and connection health indicator. |
| **Project Location** | `./android` in APEX Workspace | Self-contained Gradle project alongside existing JS logic, FM23 track data, and specs for direct reference. |

---

## 2. Directory & Component Structure (`./android`)

```
android/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
└── app/
    ├── build.gradle.kts
    └── src/
        └── main/
            ├── AndroidManifest.xml
            ├── res/
            │   ├── values/
            │   │   ├── strings.xml
            │   │   └── colors.xml
            │   └── mipmap-*/
            └── java/com/apex/telemetry/
                ├── ApexApplication.kt
                │
                ├── core/
                │   ├── network/
                │   │   ├── TelemetryUdpReceiver.kt     # DatagramChannel non-blocking UDP listener
                │   │   ├── TelemetryParser.kt          # 311/331-byte little-endian binary decoder
                │   │   ├── CircularRingBuffer.kt       # Zero-allocation high-speed ring buffer
                │   │   ├── NetworkStateMonitor.kt      # Wi-Fi IP auto-detection & status observer
                │   │   └── model/
                │   │       ├── TelemetrySample.kt      # Immutable sample data class
                │   │       └── ConnectionState.kt      # Disconnected, Waiting, Streaming (60Hz)
                │   │
                │   ├── analysis/                       # Pure math/physics ported from APEX v2.9
                │   │   ├── LapSegmenter.kt             # Out-lap, flying lap, in-lap classifier
                │   │   ├── FrictionCircleCalculator.kt # 2D acceleration vector & grip envelope
                │   │   ├── TrailBrakingEvaluator.kt    # Brake release rate vs steering angle
                │   │   ├── CornerDetector.kt           # Entry, Apex Vmin, and Exit segmentation
                │   │   ├── TireDynamicsEngine.kt       # 4-corner slip ratio, slip angle & temps
                │   │   ├── CarBalanceAnalyzer.kt       # Understeer / oversteer gradient detection
                │   │   └── TrackMapSynthesizer.kt      # 2D coordinate track builder from X/Z
                │   │
                │   ├── database/                       # Tiered storage architecture
                │   │   ├── ApexDatabase.kt             # Room DB definition
                │   │   ├── dao/
                │   │   │   ├── StintDao.kt             # Stint summary queries & filtering
                │   │   │   ├── LapDao.kt               # Lap records & sector deltas
                │   │   │   └── CornerMetricDao.kt      # Turn-by-turn scores & coaching notes
                │   │   ├── entities/
                │   │   │   ├── StintEntity.kt
                │   │   │   ├── LapEntity.kt
                │   │   │   └── CornerMetricEntity.kt
                │   │   └── storage/
                │   │       └── BinaryTraceStore.kt     # High-speed binary chunk file reader/writer
                │   │
                │   └── service/
                │       └── TelemetryService.kt         # Foreground Service with WifiLock & WakeLock
                │
                ├── ui/
                │   ├── MainActivity.kt                 # Adaptive window size root
                │   ├── theme/
                │   │   ├── Color.kt                    # AMOLED #000000, Apex Neon Cyan, Amber, Red
                │   │   ├── Theme.kt                    # Material 3 Dark High-Contrast Theme
                │   │   └── Type.kt                     # Racing monospace and clean digital type
                │   │
                │   ├── hud/                            # Real-Time Cockpit Dashboard
                │   │   ├── CockpitHudScreen.kt         # Master landscape HUD view
                │   │   ├── components/
                │   │   │   ├── RpmDialCanvas.kt        # 60/120Hz hardware-accelerated dial
                │   │   │   ├── ShiftLightsBar.kt       # Progressive LED indicator bar
                │   │   │   ├── FrictionCircleCanvas.kt # Real-time G-G dot & fading vector trail
                │   │   │   ├── PedalTraces.kt          # Vertical/horizontal throttle/brake bars
                │   │   │   └── TireStatusMatrix.kt     # 4-corner tire temps & slip visualizer
                │   │
                │   ├── stint/                          # In-App Post-Stint Review & Coaching
                │   │   ├── StintReviewScreen.kt        # Multi-tab stint analysis screen
                │   │   ├── components/
                │   │   │   ├── TelemetryTraceViewer.kt # Interactive scrubbable trace canvas
                │   │   │   ├── FrictionHeatmapCanvas.kt# Stint-wide grip saturation heatmap
                │   │   │   ├── CornerBreakdownCard.kt  # Entry/Apex/Exit "Going Faster!" cards
                │   │   │   └── TrackMapCanvas.kt       # 2D reconstructed layout with speed color
                │   │
                │   └── common/
                │       ├── ConnectionStatusBar.kt      # Minimal IP banner & packet counter
                │       └── AutoDimController.kt        # Pit-lane idle dimming for OLED
```

---

## 3. Phased Task Breakdown

### Phase 1: Gradle Scaffolding & System Configuration
- **Task 1.1** [COMPLETED]: Initialize `./android` Gradle root and `app` module with Kotlin DSL, Android Gradle Plugin (AGP), Jetpack Compose, Room SQLite, and Coroutines.
  - **Agent:** `mobile-developer`
  - **Skills:** `clean-code`
  - **Priority:** P0 (Blocker)
  - **Input:** Standard Android Gradle configuration targeting Android 14 (API 34), Min SDK 26.
  - **Output:** Functional Gradle build files in `./android` (`build.gradle.kts`, `settings.gradle.kts`, `app/build.gradle.kts`, `AndroidManifest.xml`).
  - **Verify:** Gradle sync and validation check without syntax errors.

- **Task 1.2** [COMPLETED]: Configure `AndroidManifest.xml` with permissions (`INTERNET`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`).
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P0
  - **Input:** Application requirements for background UDP streaming and screen management.
  - **Output:** Manifest configured with permissions, `TelemetryService` declaration, and orientation flags.
  - **Verify:** Manifest syntax verified against Android SDK guidelines.

---

### Phase 2: Core Network Engine & Binary Parser
- **Task 2.1** [COMPLETED]: Implement `TelemetrySample` data model and zero-copy `TelemetryParser`.
  - **Agent:** `mobile-developer`
  - **Skills:** `clean-code`
  - **Priority:** P1
  - **Input:** 311/331 byte CarDash binary specification from `src/shared/telemetry-parser.js`.
  - **Output:** `TelemetrySample.kt` and `TelemetryParser.kt` using `java.nio.ByteBuffer` (little-endian) with packet size validation.
  - **Verify:** Unit test parsing simulated 311-byte and 331-byte byte arrays matching desktop parser test vectors.

- **Task 2.2** [COMPLETED]: Implement `CircularRingBuffer` and `TelemetryUdpReceiver`.
  - **Agent:** `mobile-developer`
  - **Skills:** `clean-code`
  - **Priority:** P1
  - **Input:** Configured UDP port 9999 and circular buffer pattern from `src/shared/circular-buffer.js`.
  - **Output:** Non-blocking `DatagramChannel` receiver on `Dispatchers.IO` emitting samples via Kotlin `SharedFlow` / `Channel`.
  - **Verify:** Socket bind verification and packet throughput loop testing.

- **Task 2.3** [COMPLETED]: Implement `TelemetryService` and `NetworkStateMonitor`.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P1
  - **Input:** Android `WifiManager` and `PowerManager` system services.
  - **Output:** Foreground service holding `WifiLock(WIFI_MODE_FULL_HIGH_PERF)` and persistent notification showing connection state and IP address.
  - **Verify:** Service lifecycle test ensuring socket remains open across configuration changes.

---

### Phase 3: "Going Faster!" Racecraft Engine & Tiered Storage
- **Task 3.1** [COMPLETED]: Implement `LapSegmenter` and `CornerDetector`.
  - **Agent:** `mobile-developer`
  - **Skills:** `clean-code`
  - **Priority:** P1
  - **Input:** Porting algorithms from `src/analysis/lap-segmenter.js` and `src/analysis/corner-detector.js`.
  - **Output:** Kotlin logic for out-lap filtering, flying lap detection, lap time calculation, and corner boundary tagging (Entry, Apex Vmin, Exit).
  - **Verify:** Mathematical parity test against known recorded lap data.

- **Task 3.2**: Implement `FrictionCircleCalculator` and `TrailBrakingEvaluator`.
  - **Agent:** `mobile-developer`
  - **Skills:** `clean-code`
  - **Priority:** P1
  - **Input:** Formulas from `src/analysis/friction-circle.js` and `src/analysis/going-faster/trail-braking.js`.
  - **Output:** Grip saturation computation ($G_{total} = \sqrt{G_x^2 + G_y^2}$), trail-braking release rate gradient, and hesitation detection.
  - **Verify:** Grip saturation evaluation matches Skip Barber threshold calculations.

- **Task 3.3**: Implement Room Database and `BinaryTraceStore`.
  - **Agent:** `mobile-developer`
  - **Skills:** `clean-code`
  - **Priority:** P1
  - **Input:** Tiered storage architecture requirements.
  - **Output:** Room entities (`StintEntity`, `LapEntity`, `CornerMetricEntity`), DAOs, and binary stream chunk writer/reader for 60Hz telemetry traces.
  - **Verify:** CRUD operations on Room entities and binary round-trip read/write test.

---

### Phase 4: Jetpack Compose Live Cockpit HUD
- **Task 4.1**: Implement AMOLED Dark Theme and `ConnectionStatusBar`.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P2
  - **Input:** Color tokens (`#000000` background, high-contrast cyan, red, amber, white).
  - **Output:** `Theme.kt`, `Color.kt`, and `ConnectionStatusBar.kt` showing live IP, active port, and streaming rate badge.
  - **Verify:** Screen rendering visually inspectable on OLED theme.

- **Task 4.2**: Implement Hardware-Accelerated `RpmDialCanvas` and `ShiftLightsBar`.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P2
  - **Input:** Redline and powerband parameters from telemetry packet.
  - **Output:** Compose `Canvas` with `drawWithCache` rendering circular RPM dial, digital gear number, speed readout, and progressive sequential shift lights.
  - **Verify:** High-frequency 60Hz render loop runs without UI thread frame drops.

- **Task 4.3**: Implement Live `FrictionCircleCanvas` and `PedalTraces`.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P2
  - **Input:** Lateral/Longitudinal G vectors and normalized pedal inputs (0.0..1.0).
  - **Output:** Compose Canvas drawing circular 1.0G/1.5G boundaries, dynamic friction dot, 120-point fading vector trail, and responsive pedal bars.
  - **Verify:** Vector trail smoothly decays over 2.0 seconds at 60fps.

- **Task 4.4**: Implement `TireStatusMatrix` and Assemble `CockpitHudScreen`.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P2
  - **Input:** 4-Corner temps, slip angles, and suspension travel.
  - **Output:** Complete rig-mounted cockpit HUD layout with auto-dimming pit-lane screen protection.
  - **Verify:** Responsive layout verified in landscape orientation.

---

### Phase 5: In-App Stint Analysis & Adaptive Tablet Layout
- **Task 5.1**: Implement `TelemetryTraceViewer` with Interactive Scrubbing.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P3
  - **Input:** Binary trace samples loaded for a selected lap.
  - **Output:** Multi-channel synchronized graph (Speed, Brake, Throttle, Gs) with horizontal drag/touch scrub cursor updating track position.
  - **Verify:** Touch gesture scrubbing tracks accurately along distance axis.

- **Task 5.2**: Implement `FrictionHeatmapCanvas` and `CornerBreakdownCard`.
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P3
  - **Input:** Stint corner metrics and G-force distributions.
  - **Output:** Grip envelope heatmap and turn-by-turn cards highlighting lost tenths, entry braking, and exit traction tips.
  - **Verify:** Corner cards render diagnostic messages and metrics cleanly.

- **Task 5.3**: Implement `TrackMapCanvas` (2D Reconstructed Layout).
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P3
  - **Input:** $(X, Z)$ world coordinate arrays from lap telemetry.
  - **Output:** 2D canvas drawing normalized circuit path, colored by speed delta, with corner markers and sector splits.
  - **Verify:** Coordinate normalization scales circuit correctly to screen bounds.

- **Task 5.4**: Implement Adaptive Window Sizing (Phone Landscape vs Tablet Multi-Pane).
  - **Agent:** `mobile-developer`
  - **Skills:** `mobile-design`
  - **Priority:** P3
  - **Input:** Material 3 `WindowWidthSizeClass`.
  - **Output:** Compact/Medium screens display dedicated Cockpit HUD or Stint Review tabs; Expanded screens (Tablets/Foldables) display concurrent HUD + Live Map + Stint Insights.
  - **Verify:** Layout adapts smoothly between phone landscape and tablet display configurations.

---

## 4. Phase X: Verification & Quality Assurance

- [ ] **Android Lint & Syntax Check**: Zero syntax or import errors across Kotlin codebase.
- [ ] **Packet Parsing Integrity**: Verify `TelemetryParser` correctly extracts all 311/331-byte CarDash channels.
- [ ] **Thread Decoupling**: Confirm UDP network I/O and Room DB writes run strictly on background dispatchers (`Dispatchers.IO`), never on the Main UI thread.
- [ ] **OLED Power Optimization**: Confirm pure black `#000000` surface backgrounds and working pit-lane auto-dim.
- [ ] **Memory & Zero-Allocation**: Confirm no object allocations occur inside the 60Hz hot-path render loop.

---

## 5. Next Steps

1. Review this plan file (`apex-android.md`).
2. Run `/create` to execute implementation of the scaffolding, core network, and HUD modules.
3. Or request manual adjustments to specific tasks or components.

