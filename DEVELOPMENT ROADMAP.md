# APEX: Racing Telemetry Analysis Tool
# Comprehensive Development Roadmap & Execution Plan

---

## 1. Executive Summary & Vision

**APEX** is a high-performance, self-hosted, minimalist web and desktop application designed to ingest and analyze UDP telemetry from **Forza Motorsport 2023 (XBOX / PC)**. Rooted in the championship-proven racecraft curriculum of *"Going Faster! Mastering the Art of Race Driving"* by Carl Lopez and the Skip Barber Racing School, APEX delivers automated, data-driven coaching via instant, professional PDF reports with zero external dependencies, no cloud subscriptions, and 100% local privacy.

### Key Architectural & Design Pillars
- **Real-Time UDP Ingestion**: 331-byte binary packet parsing at 60Hz+ with a Node.js/Electron UDP-to-WebSocket bridge.
- **Physics & Racecraft Engine**: Deterministic corner detection, lap segmentation, trail-braking overlap metrics, Throttle Application Point (TAP) distance delta, and Skip Barber heuristic rules.
- **Client-Side PDF Engine**: Vector track map generation, speed profile charts, G-force tables, and tiered coaching recommendations compiled in `< 10s` via `pdf-lib`.
- **F1 Pit-Wall Aesthetic**: OLED pitch black (`#000000`), F1 Red (`#E10600`) dynamic glows, sharp 45° precision corner cuts (`clip-path`), Inter / JetBrains Mono typography, and responsive controls.

---

## 2. Release Milestones & Phase Architecture

```mermaid
gantt
    title APEX Development Roadmap Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1: MVP Core (v1.0.0)
    Sprint 1: UDP Pipeline & Parser        :p1_s1, 2026-08-24, 7d
    Sprint 2: UI Foundation & Design System :p1_s2, 2026-08-31, 7d
    Sprint 3: Lap Segmentation & Algorithms:p1_s3, 2026-09-07, 7d
    Sprint 4: PDF Generator & Integration   :p1_s4, 2026-09-14, 7d
    section Phase 2: Enhanced Analysis (v1.1.0)
    Sprint 5: Track Map & Geometry Line    :p2_s5, 2026-09-28, 7d
    Sprint 6: Trail-Braking & Apex Timing  :p2_s6, 2026-10-05, 7d
    Sprint 7: Tire Dynamics & Persistence  :p2_s7, 2026-10-12, 7d
    section Phase 3: Advanced Telemetry (v1.2.0)
    Sprint 8: Best vs Avg Lap Comparison   :p3_s8, 2026-10-26, 7d
    Sprint 9: Braking Zones & G-Forces     :p3_s9, 2026-11-02, 7d
    Sprint 10: Shifting & Telemetry Export :p3_s10, 2026-11-09, 7d
    section Phase 4: Standalone & Multi-Session (v2.0.0)
    Sprint 11: Electron Packaging & CI/CD  :p4_s11, 2026-11-23, 7d
    Sprint 12: Session Archive & Multi-Stint:p4_s12, 2026-11-30, 7d
    Sprint 13: G-G Friction Circle & Release:p4_s13, 2026-12-07, 7d
```

---

## 3. Detailed Work Breakdown Structure (WBS)

### Phase 1: Core Foundation & MVP (v1.0.0)
*Target: 4 Weeks | Goal: End-to-end working pipeline from XBOX UDP packet to automated PDF report.*

#### Sprint 1: Network Ingestion & Telemetry Parser
- [x] **Task 1.1: UDP Socket Listener (`udp-proxy.js`)**
  - Implement Node.js `dgram` socket binding to `0.0.0.0:9999` (configurable).
  - Handle buffer allocation, socket errors (`EADDRINUSE`), and port collision recovery.
  - Implement base64 / ArrayBuffer framing for transmission over WebSocket.
- [x] **Task 1.2: Local WebSocket Server**
  - Establish `ws` WebSocket broadcast server on `ws://127.0.0.1:8080`.
  - Implement client connection lifecycle, heartbeat keep-alive, and auto-reconnection.
- [x] **Task 1.3: Binary Telemetry Parser**
  - Decode exact 331-byte binary packet payload per FM23 specification using JavaScript `DataView` (Little-Endian).
  - Extract Sled data: `TimestampMS`, `IsRaceOn`, `EngineMaxRpm`, `EngineIdleRpm`, `CurrentEngineRpm`, `AccelerationX/Y/Z`, `VelocityX/Y/Z`, `Yaw/Pitch/Roll`, `TireSlipRatio*`, `TireSlipAngle*`.
  - Extract Dash data: `PositionX/Y/Z`, `Speed` (converted to mph/kmh), `Power`, `Torque`, `TireTemp*`, `Fuel`, `LapNumber`, `RacePosition`, `Accel`, `Brake`, `Clutch`, `Gear`, `Steer`.
- [x] **Task 1.4: In-Memory Ring Buffer**
  - Construct fixed-size `CircularBuffer` (`maxSize = 100,000` samples) to prevent browser memory leaks (<500MB).

#### Sprint 2: Design System & UI Implementation
- [x] **Task 2.1: Design Tokens & CSS Architecture (`index.css`)**
  - Implement full color palette: OLED Black (`#000000`), Dark Gray (`#1A1A1A`), Mid Gray (`#2A2A2A`), F1 Red (`#E10600`), Success Green (`#00CC66`), Error Red (`#FF3333`).
  - Configure typography tokens: `Inter` (UI) and `JetBrains Mono` (Telemetry tabular numbers).
  - Implement 45° angle corner cuts using CSS `clip-path: polygon(...)` across primary buttons, status panels, and inputs.
- [x] **Task 2.2: Live Telemetry Status & Control Panels**
  - Build `StatusIndicator` with animated pulse states (Green Connected, Yellow Connecting, Red Disconnected).
  - Build `ControlsPanel` featuring Start Recording (`⏺`), Stop Recording (`■`), Lap Counter, Stint Timer, and Best Lap display.
  - Implement Settings Panel with UDP Port and Session Name inputs with localStorage persistence.
- [x] **Task 2.3: Responsive Layout & Micro-interactions**
  - Implement desktop, tablet, and mobile breakpoints (1280px, 1024px, 768px).
  - Add active/hover transitions (scale 1.02, glowing borders, red separator gradients).

#### Sprint 3: Lap Segmentation & Going Faster! Algorithms
- [x] **Task 3.1: Lap Segmentation Engine**
  - Implement start/finish line crossing detection using `PositionX/Z` delta checks and `LapNumber` state transitions.
  - Automatically filter and discard out-laps / incomplete in-laps.
  - Calculate accurate lap times, average speed, and top speed metrics.
- [x] **Task 3.2: Deterministic Corner Detection**
  - Implement speed minima detection with multi-point smoothing.
  - Validate corners using steering threshold (> 5°) and lateral G-force (> 0.3G).
  - Classify corner types (Left, Right, Hairpin) and merge duplicate apex detections within 100 samples.
- [x] **Task 3.3: Corner Dynamics Feature Extraction**
  - Calculate Brake Point, Turn-in Point, Apex (minimum speed point), Track-Out Point, and Throttle Application Point (TAP).
  - Compute entry speed, apex speed, exit speed, gear used, min RPM, and exit RPM.
- [x] **Task 3.4: Core Rules Engine (Exit Speed & Braking)**
  - Implement rule evaluations:
    - `R-001`: Late Throttle Application (TAP > Apex + 15ft).
    - `R-002`: Premature Throttle Application (TAP < Apex - 15ft).
    - `R-009`: Under-braking / Early braking (Low entry speed).
    - `R-010`: Over-speed corner entry.

#### Sprint 4: Client-Side PDF Generation & MVP Polish
- [x] **Task 4.1: PDF Layout Architecture (`pdf-lib`)**
  - Setup A4 page canvas (595x842pt) with standard margins and Dark Gray/F1 Red header.
  - Build Header component with session metadata, car ID, track info, date, and lap counts.
- [x] **Task 4.2: Executive Summary & Corner Tables**
  - Section 1: Executive summary grid (Best Lap, Avg Lap, Top Speed, Max Lateral G, Key Insights).
  - Section 2: Corner-by-Corner analysis table with delta comparisons and severity-coded warnings.
- [x] **Task 4.3: Skip Barber Narrative Feedback & Quotes**
  - Integrate contextual "Going Faster!" coaching recommendations and authentic quotes per detected corner fault.
- [x] **Task 4.4: Auto-Download & Stint Workflow**
  - Trigger instant PDF compilation and browser auto-download upon clicking "Stop Recording".
  - Perform end-to-end integration validation with live / simulated FM23 packet streams.

---

### Phase 2: Enhanced Analysis & Visualizations (v1.1.0)
*Target: 3 Weeks | Goal: Vector track maps, trail-braking telemetry, apex geometry, and tire slip.*

```
Phase 2 Delivery Scope:
├── Section 3: The Line (Track Map Visualization)
├── Trail-Braking Overlap & Snap-Off Detection
├── Early Apex & Late Apex Geometry Detection
└── Tire Slip & Temperature Heatmaps
```

#### Sprint 5: Vector Track Map & Line Analysis
- [x] **Task 5.1: 2D Track Map Coordinate Normalization**
  - Transform `PositionX` and `PositionZ` telemetry into normalized SVG/PDF vector paths.
  - Scale aspect ratio dynamically to fit 500x400pt PDF bounding box.
- [x] **Task 5.2: Multi-Color Path Encoding**
  - Color-code track path segments: Green (Full Throttle > 80%), Yellow (Partial Throttle), Red (Braking > 10%), Blue (Coasting).
- [x] **Task 5.3: Track Annotation Overlays**
  - Annotate numbered turn markers (T1, T2, ... Tn) and highlight problem zones directly on the map.

#### Sprint 6: Trail-Braking & Apex Geometry Engine
- [x] **Task 6.1: Trail-Braking Overlap Calculation**
  - Calculate percentage overlap of brake pressure (> 10%) during steering phase (Turn-In to Apex).
  - Implement `R-005`: Little to no trail-braking (< 20% overlap).
- [x] **Task 6.2: Brake Snap-Off Detection**
  - Detect abrupt brake release rate (`dBrake/dt`) at turn-in inducing Trailing Throttle Oversteer (TTO).
- [x] **Task 6.3: Geometric Apex Fault Identification**
  - Detect Early Apex (`R-003`): Steering angle increase/correction > 5° post-apex.
  - Detect Late Apex (`R-004`): Premature steering unwind with excess unused track margin.

#### Sprint 7: Tire Dynamics & State Management
- [x] **Task 7.1: Tire Slip Ratio & Grip Analysis**
  - Calculate longitudinal and lateral slip ratios across all four wheels (`TireSlipRatioFL/FR/RL/RR`).
  - Implement `R-009`: Excessive wheelspin on exit (`slipRatio > 1.0`).
- [x] **Task 7.2: Tire Temperature Assessment**
  - Ingest 4-corner tire temperatures (`tempFL/FR/RL/RR`) and flag cold (< 200°F) or overheated (> 240°F) tires.
- [x] **Task 7.3: PDF Section 7 (Tire Management)**
  - Add dedicated PDF table visualizing 4-tire slip matrix and average operating temperatures.

---

### Phase 3: Advanced Telemetry & Comparative Analytics (v1.2.0)
*Target: 3 Weeks | Goal: Delta comparisons against best lap, threshold braking analysis, shifting powerband.*

#### Sprint 8: Delta Lap Comparison Matrix
- [x] **Task 8.1: Best Lap vs. Average Lap Baseline**
  - Isolate stint's optimal lap and compute delta traces for speed, throttle, and brake across every segment.
- [x] **Task 8.2: Segment-by-Segment Time Loss Attribution**
  - Quantify exact time lost (in tenths of a second) in braking zone, mid-corner, and corner exit.
- [x] **Task 8.3: Type I/II/III Corner Priority Ranking**
  - Implement Skip Barber corner categorization:
    - *Type I*: Leading onto straights (Highest priority).
    - *Type II*: End of straights (Medium priority).
    - *Type III*: Connecting corners (Lowest priority).
  - Rank recommendations by projected lap time gain.

#### Sprint 9: Braking Zone G-Force Deep-Dive
- [x] **Task 9.1: Threshold Braking Efficiency Calculation**
  - Measure peak longitudinal deceleration Gs (`AccelerationZ`) vs car's theoretical maximum.
  - Calculate braking distance (ft / m) from initial brake application to turn-in.
- [x] **Task 9.2: "The Procedure" Braking Evaluation**
  - Evaluate driver's consistency in stepping brake markers closer to turn-in over successive laps.
- [x] **Task 9.3: PDF Section 5 (Braking & Entering)**
  - Render deceleration G profile curves and threshold compliance ratings in the PDF report.

#### Sprint 10: Shifting, Powerband & Data Export
- [x] **Task 10.1: Powerband Optimization Engine**
  - Verify minimum corner RPM and exit RPM against engine powerband (`EngineIdleRpm` to `EngineMaxRpm`).
  - Implement `R-007` (Downshift required: Exit RPM < 60% powerband) and `R-008` (Rev limiter strike risk: Exit RPM > 95% redline).
- [x] **Task 10.2: Downshift Quality Assessment**
  - Evaluate throttle blip accuracy and brake pedal modulation stability during heel-and-toe / downshift events.
- [x] **Task 10.3: Raw Telemetry CSV Export**
  - Provide one-click export of complete stint telemetry (Timestamp, Position, Speed, Gs, Inputs, Temps) to CSV for third-party tooling.

---

### Phase 4: Standalone Distribution, Multi-Stint & G-G Diagram (v2.0.0)
*Target: 4 Weeks | Goal: Standalone Electron desktop app, multi-session archiving, friction circle.*

#### Sprint 11: Electron Standalone Architecture & Native Packaging
- [ ] **Task 11.1: Electron Main Process Integration (`electron-main.js`)**
  - Integrate UDP listener socket and WebSocket server directly into Electron background process.
  - Implement native window lifecycle, tray minimization, and menu configuration.
- [ ] **Task 11.2: Cross-Platform Build Pipelines**
  - Configure `electron-builder` for automated packaging:
    - Windows: NSIS Installer (`.exe`) + Portable executable.
    - macOS: Universal DMG (`.dmg`).
    - Linux: AppImage / `.deb`.

#### Sprint 12: Multi-Session History & Comparison
- [ ] **Task 12.1: Client-Side IndexedDB Storage**
  - Persist historical session records, lap metrics, and analysis summaries locally with zero cloud dependencies.
- [ ] **Task 12.2: Stint-to-Stint Progression Tracking**
  - Track driver progression over multiple days/weeks (lap time reduction, corner exit speed delta, consistency index).
- [ ] **Task 12.3: Session JSON Interchange**
  - Allow importing and exporting complete session datasets in JSON format.

#### Sprint 13: Friction Circle (G-G Diagram) & v2.0 Release
- [ ] **Task 13.1: Friction Circle / G-G Diagram Generation**
  - Plot lateral G (`AccelerationX`) vs longitudinal G (`AccelerationY/Z`) across 100% of cornering samples.
  - Calculate traction circle utilization percentage to assess vehicle limit exploitation.
- [ ] **Task 13.2: PDF Report Overhaul (v2.0)**
  - Integrate vector G-G scatter plot directly into the PDF report.
  - Polish layout for 8-page consultant-grade printout.
- [ ] **Task 13.3: Production Release & Documentation**
  - Publish `README.md`, `TROUBLESHOOTING.md`, user guides, and release binaries.

---

## 4. Technical Architecture & Dependency Graph

```mermaid
graph TD
    subgraph LAN [Local Area Network]
        XBOX[XBOX / PC - Forza Motorsport 2023]
    end

    subgraph Backend [APEX Core Proxy Layer]
        UDP[UDP Socket Listener :9999]
        Parser[331-Byte Binary Packet Parser]
        WS_Server[WebSocket Server :8080]
    end

    subgraph Client [Browser / Electron UI]
        WS_Client[WebSocket Client]
        Buffer[Circular In-Memory Buffer]
        StateMgr[Session & Stint Manager]
        UI[F1 Pitch Black UI / Controls]
    end

    subgraph Engine [Analysis & Rules Engine]
        LapSeg[Lap Segmentation & Crossing]
        CornerDetect[Corner Feature Extractor]
        GoingFaster[Skip Barber Rules Engine R-001..R-012]
        PriorityRank[Type I/II/III Corner Prioritizer]
    end

    subgraph Output [Report Generation Layer]
        PDFGen[pdf-lib Report Builder]
        TrackMap[2D Vector Map Engine]
        PDFDoc[Automated PDF Download]
        CSVExport[Raw CSV Exporter]
    end

    XBOX -->|UDP Broadcast :9999| UDP
    UDP --> Parser
    Parser --> WS_Server
    WS_Server -->|ws://127.0.0.1:8080| WS_Client
    WS_Client --> Buffer
    Buffer --> StateMgr
    StateMgr --> UI
    StateMgr -->|Stint Stopped| LapSeg
    LapSeg --> CornerDetect
    CornerDetect --> GoingFaster
    GoingFaster --> PriorityRank
    PriorityRank --> PDFGen
    CornerDetect --> TrackMap
    TrackMap --> PDFGen
    PDFGen --> PDFDoc
    Buffer --> CSVExport
```

---

## 5. Skip Barber "Going Faster!" Rules Matrix

| Rule ID | Metric / Trigger Condition | Severity | Racecraft Fault | Coaching Recommendation & Action Plan |
|---|---|---|---|---|
| **R-001** | `TAP Distance > Apex + 15ft` | High | Late Throttle Application | *"The biggest gain in lap time comes from corner exit speed."* Squeeze throttle on earlier as you unwind steering towards track-out. |
| **R-002** | `TAP Distance < Apex - 15ft` | Medium | Premature Power Application | *"Getting to throttle too early induces understeer and pushes the car wide."* Modulate speed with trail-braking before committing to power. |
| **R-003** | `Steering > Apex_Steer + 5° (Post-Apex)` | High | Early Apex | *"The primary symptom of early apexing is the need to turn more in the 2nd part of the turn."* Move turn-in point deeper and apex later. |
| **R-004** | `Unused Track Margin > 2ft at Exit` | Medium | Late Apex / Conservative Line | *"Unused track at exit indicates sacrificed entry and apex speed."* Move turn-in earlier to carry higher rolling minimum speed. |
| **R-005** | `Trail-Brake Overlap < 20%` | Medium | Abrupt Turn-In / No Trail-Brake | *"The question is not if you trail-brake, but how."* Carry light brake pressure past turn-in to transfer weight forward and assist rotation. |
| **R-006** | `Brake Release Rate > 80%/100ms` | High | Brake Snap-Off | *"Abrupt brake release causes Trailing Throttle Oversteer (TTO)."* Bleed off brake pedal progressively as steering lock increases. |
| **R-007** | `Exit RPM < 60% Max RPM` | Medium | Gear Selected Too High | *"If the engine bogs at corner exit, gear is too high."* Downshift one additional gear in braking zone to optimize powerband. |
| **R-008** | `Exit RPM > 95% Max RPM` | Medium | Gear Selected Too Low | *"Hitting rev limiter before corner exit kills acceleration."* Upshift earlier or carry a taller gear to avoid rev limiter bog. |
| **R-009** | `Tire Slip Ratio > 1.0` | High | Excessive Wheelspin | *"Wheelspin destroys rear tires and wastes forward drive."* Smooth out initial throttle progression; do not mat the gas on exit. |
| **R-010** | `Peak Decel G < 80% Max Capability` | Medium | Sub-Threshold Braking | *"Practice The Procedure: Step your brake point in small bites to find the limit of deceleration."* Press harder initially in straight line. |
| **R-011** | `Consecutive Lap Exit Speed Var > 3mph` | Medium | Throttle Inconsistency | *"Focus on consistent reference points for throttle application."* Align power application with steering unwinding rate. |
| **R-012** | `Over-Braking Delta > 10mph vs Apex` | High | Parking the Car in Mid-Corner | *"Over-slowing at corner entry forces a coasting dead-zone."* Roll higher minimum speed into the corner. |

---

## 6. Comprehensive Testing & Quality Assurance Plan

### 6.1 Testing Pyramid
```
          / \
         /   \       E2E / Integration Tests (20%)
        / E2E \      - End-to-end synthetic UDP packet stream to PDF validation
       /-------\
      /         \    Module Integration Tests (30%)
     / Integrat. \   - Lap segmentation, Corner detection, Buffer overflow
    /-------------\
   /               \ Unit Tests (50%)
  /   Unit Tests    \ - Binary packet parsing, Going Faster! rules, coordinate math
 /-------------------\
```

### 6.2 Test Suites Breakdown

| Suite | Scope | Target Metrics | Automation Tool |
|---|---|---|---|
| **Binary Parser Suite** | Verify exact byte offset decoding against FM23 UDP specification. Validate endianness, negative values, and NaN handling. | 100% field test coverage, 0 corrupted packets | Jest / Node.js Runner |
| **Corner Detection Suite** | Test speed minima algorithms across standard circuits (hairpins, chicanes, high-speed sweepers, carousel). | ≥ 98% corner detection accuracy against ground truth | Jest |
| **Rules Engine Suite** | Verify R-001 through R-012 trigger exact severity ratings, messages, and calculations for known boundary conditions. | 100% rule condition test coverage | Jest |
| **Memory & Performance** | Ingest continuous 60Hz telemetry stream for 100+ laps (2 hours). Monitor heap usage and GC behavior. | Heap < 500MB, 0 frame drops, latency < 10ms | Chrome DevTools / Node profiler |
| **PDF Generation Suite** | Generate 10, 20, and 50-lap PDF reports. Validate layout bounds, fonts, table pagination, and vector rendering. | Generation time < 10s (20 laps), File size < 2MB | Jest + pdf-lib validator |

---

## 7. Risk Management & Mitigation Matrix

| Risk Event | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **UDP Port Collision (Port 9999 in use)** | High | Medium | Implement dynamic port configuration UI with fallback port scanner and clear UI error guidance. |
| **Network Packet Drop over Wi-Fi** | Medium | High | Implement interpolation for single-frame dropouts; add connection quality indicator (packet rate / sec) on UI. |
| **Browser Memory Overflow on 50+ Lap Stints** | High | Low | Enforce strict `CircularBuffer` capacity limit; store compact typed arrays rather than nested object graphs. |
| **PDF Memory Spike on Large Multi-Page Output** | Medium | Medium | Stream page generation sequentially using `pdf-lib` without keeping redundant canvas bitmaps in memory. |
| **Forza Motorsport Telemetry Spec Updates** | Medium | Low | Maintain versioned telemetry parser schema with modular field mapping. |
| **Cross-Platform Electron Portability Issues** | Low | Medium | Utilize standard multi-platform `electron-builder` configuration; isolate OS-specific file paths. |

---

## 8. Release Checklist & Acceptance Criteria

### v1.0.0 (MVP) Launch Criteria
- [x] Connects seamlessly to Forza Motorsport 2023 UDP stream on LAN.
- [x] UI reflects accurate real-time connection state and stint timer.
- [x] Accurately segments laps and identifies corners with > 95% reliability.
- [x] Automatically compiles and downloads clean A4 PDF report in under 10 seconds.
- [x] Follows F1-inspired pitch black design system with 45° cut components.
- [x] Operates 100% locally with zero cloud dependencies, accounts, or trackers.

### v1.1.0 Feature Release Criteria
- [x] PDF includes 2D vector track map with throttle/braking color encoding.
- [x] Trail-braking overlap and snap-off detection fully operational.
- [x] Geometry line analysis detects early and late apexes accurately.
- [x] Settings persist across browser sessions in `localStorage`.

### v1.2.0 Telemetry Release Criteria
- [ ] Best lap vs average lap delta tables integrated in PDF.
- [ ] Threshold braking G-force and deceleration distances calculated.
- [ ] Powerband and shifting optimization rules active.
- [ ] Full stint raw data exportable to CSV.

### v2.0.0 Desktop Suite Launch Criteria
- [ ] Standalone installer and portable executable available for Windows, macOS, and Linux.
- [ ] Historical session archive powered by local IndexedDB.
- [ ] Traction circle (G-G diagram) rendered in PDF reports.

---

*Document Version: 1.0.0 | Status: APPROVED | Reference Documents: [PRD.md](file:///d:/AI%20Workspace/APEX%20v2.9/Docs/APEX%20PRD.md), [TRD.md](file:///d:/AI%20Workspace/APEX%20v2.9/Docs/APEX%20TRD.md), [DESIGN.md](file:///d:/AI%20Workspace/APEX%20v2.9/Docs/APEX%20DESIGN.md), [PDF.md](file:///d:/AI%20Workspace/APEX%20v2.9/Docs/APEX%20PDF.md)*
