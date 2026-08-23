# APEX PRD.md

# APEX: Racing Telemetry Analysis Tool
## Product Requirements Document

---

## 1. Executive Summary

### 1.1 Product Overview
APEX is a self-hosted, minimalist web application that ingests and analyzes UDP telemetry data from Forza Motorsport 2023 (XBOX) based on the proven racecraft principles documented in "Going Faster!" by the Skip Barber Racing School. APEX provides actionable, data-driven feedback through automatically generated PDF reports, with zero external dependencies, authentication, or AI.

### 1.2 Core Value Proposition
- **Instant Feedback**: No cloud uploads, no waiting. Analyze your stint immediately.
- **Racecraft-Focused**: Built on 25+ years of professional racing instruction methodology.
- **Zero Complexity**: No accounts, no subscriptions, no backend infrastructure.
- **Privacy First**: All data stays on your local machine.

### 1.3 Target Users
- Forza Motorsport players seeking to improve lap times
- Sim racing enthusiasts looking for structured telemetry analysis
- Racing school graduates wanting to apply "Going Faster!" principles
- Competitive sim racers preparing for online events

---

## 2. Technical Specifications

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         APEX Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │   UDP Listener  │───▶│      Data Buffer (Memory)       │ │
│  │   (Port 9999)   │    │    Raw Telemetry Samples         │ │
│  └─────────────────┘    └──────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │  Analysis Engine│◀───│      Lap Segmentation            │ │
│  │  (Going Faster!)│    │    Corner Detection              │ │
│  └─────────────────┘    └──────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │   PDF Generator │◀───│      Report Builder              │ │
│  │   (jsPDF)       │    │    Metrics Compilation           │ │
│  └─────────────────┘    └──────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   PDF Report    │
                     │   Downloaded    │
                     └─────────────────┘
```

### 2.2 Data Source
- **Protocol**: UDP
- **Default Port**: 9999 (configurable)
- **Format**: Binary (per FM23_UDP (1).md specification)
- **Source**: Forza Motorsport 2023 running on XBOX (same local network)

### 2.3 Telemetry Data Fields Used

#### Sled (Core) Data
| Field | Type | Purpose |
|-------|------|---------|
| `IsRaceOn` | S32 | Lap segmentation |
| `TimestampMS` | U32 | Time-stamping samples |
| `CurrentEngineRpm` | F32 | Shift analysis, powerband verification |
| `AccelerationX/Y/Z` | F32 | Cornering & braking force calculation |
| `VelocityX/Y/Z` | F32 | Speed profile, track mapping |
| `Yaw/Pitch/Roll` | F32 | Car attitude analysis |
| `NormalizedSuspensionTravel*` | F32 | Cornering load analysis |
| `TireSlipRatio*` | F32 | Wheelspin, grip analysis |
| `WheelRotationSpeed*` | F32 | Wheel speed verification |
| `TireSlipAngle*` | F32 | Cornering grip analysis |
| `TireCombinedSlip*` | F32 | Overall traction analysis |
| `CarOrdinal` | S32 | Car identification |
| `CarClass` | S32 | Class context |
| `DrivetrainType` | S32 | RWD/FWD/AWD context |

#### Dash Data (Additional)
| Field | Type | Purpose |
|-------|------|---------|
| `PositionX/Y/Z` | F32 | Track mapping, line analysis |
| `Speed` | F32 | Core speed measurement |
| `Power` | F32 | Performance analysis |
| `Torque` | F32 | Power application analysis |
| `TireTemp*` | F32 | Tire management analysis |
| `Accel/Brake` | U8 | Driver input analysis |
| `Gear` | U8 | Gear selection analysis |
| `Steer` | S8 | Steering smoothness analysis |

### 2.4 Minimum Requirements
- **Hardware**: PC or Mac with network connection to XBOX
- **Network**: Same local subnet as XBOX
- **Browser**: Chrome 90+, Firefox 88+, Edge 90+
- **Memory**: 512MB available RAM
- **Storage**: 100MB free space (for PDF generation)

---

## 3. Functional Requirements

### 3.1 Core User Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│  1. OPEN APEX          2. CONNECT              3. RECORD STINT              │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │ Open APEX        │   │ Check connection │   │ Click "Start     │        │
│  │ in browser       │   │ status (green)   │   │ Recording"       │        │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘        │
│                                                     │                        │
│  5. DOWNLOAD PDF        4. STOP RECORDING           ▼                        │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │ PDF auto-downloads│◀──│ Click "Stop      │   │ Drive your       │        │
│  │ to user's PC      │   │ Recording"       │   │ stint            │        │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Feature Requirements

#### 3.2.1 UDP Telemetry Reception
| FR-ID | Requirement | Priority |
|-------|--------------|----------|
| FR-001 | Listen on configurable UDP port (default: 9999) | P0 |
| FR-002 | Parse incoming binary telemetry packets per FM23 spec | P0 |
| FR-003 | Display real-time connection status (connected/disconnected) | P0 |
| FR-004 | Display source IP address when connected | P1 |
| FR-005 | Buffer incoming data without dropping packets | P0 |
| FR-006 | Handle packet loss gracefully (interpolate missing data) | P2 |

#### 3.2.2 Data Recording
| FR-ID | Requirement | Priority |
|-------|--------------|----------|
| FR-007 | Start recording via "Start Recording" button | P0 |
| FR-008 | Stop recording via "Stop Recording" button | P0 |
| FR-009 | Display running lap count during recording | P1 |
| FR-010 | Display stint timer (elapsed time) during recording | P1 |
| FR-011 | Auto-detect lap completion (using Position data) | P0 |
| FR-012 | Discard incomplete lap data (first/last partial laps) | P2 |
| FR-013 | Buffer all telemetry data in memory during recording | P0 |

#### 3.2.3 Analysis Engine (Going Faster! Methodology)
| FR-ID | Requirement | Priority |
|-------|--------------|----------|
| **Line Analysis** | | |
| FR-014 | Detect early apexes (steering re-correction post-apex) | P0 |
| FR-015 | Detect late apexes (excess track available at exit) | P0 |
| FR-016 | Generate track map from Position data | P1 |
| FR-017 | Color-code track map by throttle application | P2 |
| **Corner Exit Speed** | | |
| FR-018 | Identify Throttle Application Point (TAP) for each corner | P0 |
| FR-019 | Calculate corner exit speed (at track-out point) | P0 |
| FR-020 | Compare exit RPM to powerband (EngineMaxRpm/IdleRpm) | P0 |
| FR-021 | Detect excessive wheelspin (TireSlipRatio > 1.0) | P0 |
| **Braking & Entering** | | |
| FR-022 | Detect threshold braking (near max deceleration) | P0 |
| FR-023 | Identify trail-braking phases (brake + steering overlap) | P0 |
| FR-024 | Detect brake "snap-off" (sudden brake release at turn-in) | P0 |
| FR-025 | Calculate minimum corner speed (apex identification) | P0 |
| FR-026 | Detect over-braking (excess speed loss vs. apex speed) | P1 |

#### 3.2.4 PDF Report Generation
| FR-ID | Requirement | Priority |
|-------|--------------|----------|
| FR-027 | Auto-generate PDF after recording stops | P0 |
| FR-028 | Auto-download PDF to user's computer | P0 |
| FR-029 | Include overall summary (total laps, best lap, top speed) | P0 |
| FR-030 | Include track map with annotated line analysis | P1 |
| FR-031 | Include corner-by-corner analysis with metrics table | P0 |
| FR-032 | Include "Going Faster!" narrative feedback per corner | P0 |
| FR-033 | Include braking zone analysis with G-force comparison | P1 |
| FR-034 | Include tire management analysis (slip angles, temps) | P2 |
| FR-035 | Include optional session name in report header | P2 |

#### 3.2.5 User Interface
| FR-ID | Requirement | Priority |
|-------|--------------|----------|
| FR-036 | Minimal, clean UI design | P0 |
| FR-037 | Display connection status (indicator + IP:Port) | P0 |
| FR-038 | "Start Recording" button (enabled when connected) | P0 |
| FR-039 | "Stop Recording" button (enabled when recording) | P0 |
| FR-040 | Display lap counter during recording | P1 |
| FR-041 | Display stint timer during recording | P1 |
| FR-042 | UDP Port configuration input (default: 9999) | P1 |
| FR-043 | Session Name input (optional, for PDF header) | P2 |
| FR-044 | "Save Settings" button (persist via localStorage) | P2 |
| FR-045 | Status bar for feedback (connection, recording, analysis) | P0 |

### 3.3 Non-Functional Requirements

| NFR-ID | Requirement | Metric |
|--------|--------------|--------|
| NFR-001 | Data processing must be near real-time | < 100ms per sample |
| NFR-002 | Memory usage must stay within browser limits | < 500MB RAM |
| NFR-003 | PDF generation must complete in under 10 seconds | For 20-lap stint |
| NFR-004 | Application must work offline (after initial load) | No internet required |
| NFR-005 | No external dependencies (CDN, APIs, etc.) | Self-contained |
| NFR-006 | No authentication or user accounts | Zero login friction |
| NFR-007 | All data processing must occur client-side | No data leaves machine |
| NFR-008 | Must be compatible with modern browsers | Chrome/Firefox/Edge 90+ |
| NFR-009 | Error handling must be graceful | No crashes on bad packets |
| NFR-010 | UI should be responsive for different screen sizes | 1280x720 minimum |

---

## 4. User Interface Design

### 4.1 Main Screen Layout

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │                        APEX                                         │   ║
║  │              Racing Telemetry Analysis Tool                         │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
║                                                                           ║
║  ┌──────────────────────────────┐  ┌──────────────────────────────────┐  ║
║  │  ● CONNECTED                 │  │  SESSION NAME                    │  ║
║  │  Source: 192.168.1.100:9999  │  │  [My Qualifying Stint   ]        │  ║
║  └──────────────────────────────┘  └──────────────────────────────────┘  ║
║                                                                           ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │                                                                     │   ║
║  │           [  ⏺ START RECORDING  ]    [  ■ STOP RECORDING  ]       │   ║
║  │                                                                     │   ║
║  │           ┌────────────────────────────────────┐                   │   ║
║  │           │   Laps: 3    │   Time: 02:37:12   │                   │   ║
║  │           └────────────────────────────────────┘                   │   ║
║  │                                                                     │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
║                                                                           ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  STATUS: ● Recording Lap 3... Press Stop to generate report.      │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
║                                                                           ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  SETTINGS                                                          │   ║
║  │  UDP Port: [9999]               [ SAVE SETTINGS ]                 │   ║
║  │  Session Name: [My Qualifying Stint]                               │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
║                                                                           ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 4.2 Color Palette
- **Background**: #1A1A1A (Dark grey)
- **Primary Text**: #FFFFFF (White)
- **Accent**: #FF4D00 (Racing orange)
- **Success**: #00CC66 (Green)
- **Warning**: #FFCC00 (Yellow)
- **Card Background**: #2D2D2D (Lighter grey)

### 4.3 Responsive Design
- Desktop: Full layout with all panels visible
- Tablet: Collapsed settings panel (expandable)
- Mobile: Vertical stack with all panels (minimum support)

---

## 5. Analysis Engine Specifications

### 5.1 Corner Detection Algorithm

```
1. Segment data by lap (using IsRaceOn transitions + Position data)
2. For each lap, identify corners by:
   a. Minimum speed points (local minima in speed trace)
   b. Peak lateral G points (max Acceleration X/Y)
   c. Steering angle changes (max steering input duration)
3. Correlate corners across all laps
4. Assign corner numbers (1 to N per lap)
5. Filter out false positives (small bends, pit entry/exit)
```

### 5.2 Corner Analysis Per Corner

```
For each identified corner (per lap):
  1. Locate Brake Point (first significant brake pressure)
  2. Locate Turn-In Point (first significant steering input)
  3. Locate Apex (minimum speed point)
  4. Locate Track-Out Point (steering returns to near zero)
  5. Locate Throttle Application Point (throttle > 50%)
  
  Metrics Calculated:
  6. Entry Speed (speed at Turn-In)
  7. Apex Speed (speed at Apex)
  8. Exit Speed (speed at Track-Out)
  9. Brake Duration (time from Brake to Turn-In)
  10. Trail-Brake Duration (time from Turn-In to Apex with brake)
  11. Throttle Application Delta (distance from Apex to TAP)
  12. Peak Brake Pressure
  13. Minimum RPM
  14. Exit RPM
  15. Gear Used
```

### 5.3 Analysis Rules (Going Faster! Methodology)

| Rule ID | Condition | Feedback |
|---------|-----------|----------|
| R-001 | Throttle Application Point > Apex + 50ft | "Apply throttle earlier and more smoothly at the apex." |
| R-002 | Throttle Application Point < Apex - 50ft | "You're getting to the throttle too early - you may be inducing understeer." |
| R-003 | Steering correction > 10° post-apex | "Suspect early apex. Try turning in later to avoid mid-corner corrections." |
| R-004 | 2+ ft of track unused at Track-Out | "Late apex. Move turn-in and apex earlier to maximize exit speed." |
| R-005 | Brake pressure drops to 0 at Turn-In | "Snap brake release. Try trail-braking deeper into the corner." |
| R-006 | Brake duration > 1.5x average for corner | "Braking too early. Move brake point closer to the corner." |
| R-007 | Exit RPM < 85% of powerband | "Gear too high. Downshift one gear for better corner exit." |
| R-008 | Exit RPM > 95% of redline | "Gear too low. Upshift or use higher gear to avoid hitting limiter." |
| R-009 | TireSlipRatio > 1.2 at exit | "Excessive wheelspin. Be more progressive with the throttle." |
| R-010 | Peak Brake G < 0.8 x max achievable | "Not using full braking potential. Push harder on the brake pedal." |
| R-011 | Trail-braking overlap < 0.2s | "Little to no trail-braking. Carry brakes past turn-in to improve rotation." |
| R-012 | Consecutive laps exit speed variance > 3mph | "Inconsistent corner exit. Focus on smooth throttle application." |

### 5.4 Lap Comparison
- Identify the "best lap" (lowest lap time)
- Compare all other laps to the best lap
- Highlight corners where time was lost relative to best lap
- Show segment time differences (braking, cornering, straight)

---

## 6. PDF Report Specification

### 6.1 Report Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  APEX Telemetry Report                                             │
│  ───────────────────────────────────────────────────────────────── │
│  Session: My Qualifying Stint   │  Date: 2026-08-23               │
│  Car: Forza GTE #92             │  Track: Sebring International   │
│  Laps: 12                       │  Best Lap: 2:13.742            │
│  ───────────────────────────────────────────────────────────────── │
│                                                                     │
│  SECTION 1: OVERALL SUMMARY                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Total Laps: 12                                              │ │
│  │  Best Lap: 2:13.742 (Lap 7)                                 │ │
│  │  Average Lap: 2:15.824                                      │ │
│  │  Top Speed: 172.3 mph                                       │ │
│  │  Max Lateral G: 1.24                                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  SECTION 2: TRACK MAP                                             │
│  [Track map graphic with color-coded path]                         │
│                                                                     │
│  SECTION 3: CORNER-BY-CORNER ANALYSIS                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Turn 1 (Right - 90°)                                        │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │ Metric                  Best Lap   Avg Lap    Delta     │ │ │
│  │  ├─────────────────────────────────────────────────────────┤ │ │
│  │  │ Entry Speed (mph)        82.1      80.3      -1.8      │ │ │
│  │  │ Apex Speed (mph)         54.7      53.9      -0.8      │ │ │
│  │  │ Exit Speed (mph)         76.2      73.1      -3.1  ⚠  │ │ │
│  │  │ Throttle Application     -5.2 ft   +12.1 ft   +17.3   │ │ │
│  │  │ Trail-Braking Overlap    0.45s     0.12s      -0.33s  │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │  ⚠ EXIT SPEED: -3.1 mph from best lap. Significant time      │ │
│  │    loss here. Throttle is applied 17.3 ft after the apex,    │ │
│  │    indicating delayed power application.                     │ │
│  │    RECOMMENDATION: Focus on earlier, smoother throttle       │ │
│  │    application. Squeeze the power on as you unwind the       │ │
│  │    steering wheel towards the exit.                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  SECTION 4: BRAKING ANALYSIS                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Braking Zone        Distance   Peak G   Threshold %        │ │
│  │  ├───────────────────────────────────────────────────────────┤ │ │
│  │  │ Turn 1             245 ft    0.82     68%                │ │
│  │  │ Turn 3             382 ft    0.91     75%   ⚠           │ │
│  │  │ Turn 6             165 ft    0.78     65%                │ │
│  │  │ Turn 10 (Hairpin)  412 ft    0.95     79%   ⚠           │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │  ⚠ Turn 3 & Hairpin: Braking is below threshold (>80%).      │ │
│  │    Apply more force to the brake pedal to maximize           │ │
│  │    deceleration and reduce braking distance.                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  SECTION 5: TIRE MANAGEMENT                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Tire Slip Analysis: Moderate wheelspin detected on exit of  │ │
│  │  Turn 7. Be more progressive with throttle application       │ │
│  │  to preserve rear tire life.                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────── │
│  Report generated by APEX v1.0.0                                   │
│  Data source: Forza Motorsport 2023 UDP Telemetry                │
│  Analysis methodology: "Going Faster!" - Skip Barber Racing School│
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Report Features
- **Page Size**: A4 (210mm x 297mm)
- **Font**: System fonts (Arial/Helvetica)
- **Color**: Grayscale with single accent color
- **File Naming**: `apex-report-YYYY-MM-DD-HHMMSS.pdf`
- **Size**: < 2MB for typical 20-lap report

---

## 7. Test Cases

### 7.1 Functional Test Cases

| TC-ID | Test Case | Expected Result |
|-------|-----------|-----------------|
| TC-001 | Open APEX in browser | Page loads, Connection status shows "Disconnected" |
| TC-002 | Configure UDP port and Save | Settings persist in localStorage |
| TC-003 | Receive telemetry from Forza | Connection status turns green, shows IP:Port |
| TC-004 | Click "Start Recording" | Button disables, lap counter and timer start |
| TC-005 | Complete 5 laps and click "Stop" | Recording stops, PDF download begins |
| TC-006 | No telemetry for 10+ seconds | Connection status turns yellow (timeout) |
| TC-007 | Telemetry resumes after timeout | Connection status turns green automatically |
| TC-008 | Stop recording with 0 laps captured | PDF generated with "No valid laps" message |
| TC-009 | Concurrent session names | Saved name persists after browser reload |
| TC-010 | Click "Start" while already recording | Button remains disabled, no duplicate recording |

### 7.2 Performance Test Cases

| TC-ID | Test Case | Expected Result |
|-------|-----------|-----------------|
| TC-011 | Process 1 hour of continuous telemetry | No memory leaks, stable performance |
| TC-012 | Generate report for 50+ laps | PDF generated in < 15 seconds |
| TC-013 | High-speed UDP packet stream (>100 pkt/sec) | No packet loss, stable buffer |
| TC-014 | Open APEX on low-spec machine (4GB RAM) | UI loads and functions, no lag |

### 7.3 Edge Cases

| TC-ID | Test Case | Expected Result |
|-------|-----------|-----------------|
| TC-015 | Telemetry stops mid-recording | Recording still processes available data |
| TC-016 | Partial lap at start/end of stint | Partial laps are discarded from analysis |
| TC-017 | Corrupted telemetry packet | Packet is ignored, no crash |
| TC-018 | Browser tab goes to background | Recording continues in background |
| TC-019 | TCP port 9999 already in use | App displays error, prompts for different port |

---

## 8. Release Plan

### 8.1 MVP (Minimum Viable Product) - v1.0.0

**Features**:
- UDP telemetry reception (port configurable)
- Basic connection status (connected/disconnected)
- Start/Stop recording
- Lap counter and timer
- PDF report generation with:
  - Overall summary
  - Corner-by-corner metrics (entry, apex, exit speed)
  - Basic "Going Faster!" feedback for exit speed and braking
- Auto-download PDF

**Timeline**: 4 weeks (1 designer, 2 developers)

**Testing**: Internal testing with Forza Motorsport and XBOX

### 8.2 Version 1.1.0 (v1.1.0)

**Additional Features**:
- Track map visualization in PDF
- Trail-braking analysis
- Early apex / late apex detection
- Session name input
- Settings persistence (localStorage)
- Tire management analysis

**Timeline**: 3 weeks

### 8.3 Version 1.2.0 (v1.2.0)

**Additional Features**:
- Lap comparison (best lap vs. average)
- Braking zone G-force analysis
- Gear selection analysis
- Wheelspin detection
- Export raw telemetry as CSV

**Timeline**: 3 weeks

### 8.4 Version 2.0.0 (v2.0.0)

**Additional Features**:
- Multi-session history
- Session comparison
- Export sessions as JSON (data interchange)
- Shareable reports (via PDF only, no cloud)
- Advanced "Going Faster!" metrics (friction circle, etc.)
- UI polish and dark theme improvements

**Timeline**: 4 weeks

---

## 9. Success Metrics

### 9.1 Primary Success Metrics
| Metric | Target |
|--------|--------|
| User satisfaction (survey) | ≥ 80% positive |
| PDF generation success rate | ≥ 99% |
| Average time to first report | ≤ 5 minutes |
| Daily active users (DAU) | 1000+ (for initial release) |

### 9.2 Secondary Success Metrics
| Metric | Target |
|--------|--------|
| Lap time improvement (self-reported) | Average ≥ 1% |
| PDF downloads per session | ≥ 1 |
| Session recording duration average | ≥ 10 laps |
| Bug reports rate (per 1000 users) | ≤ 5 |

### 9.3 User Feedback Collection
- Post-report survey (optional link in PDF)
- Github Issues (as primary feedback channel)
- Email support (optional)

---

## 10. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| UDP packet loss from XBOX | Degraded analysis quality | Medium | Implement interpolation; warn user of data gaps |
| Browser memory limits | Crash on long sessions | Low | Implement ring buffer; warn at 80% capacity |
| PDF generation memory | Crash on large reports | Low | Implement streaming PDF generation; chunk data |
| Forza telemetry spec changes | Analysis breaks | Low | Version-lock known spec; allow manual mapping |
| Network configuration issues | Can't connect to XBOX | Medium | Provide troubleshooting guide; display error messages |
| Browser compatibility | UI works inconsistently | Low | Target modern browsers; polyfill as needed |
| No user authentication | No user history | Low | Use localStorage for limited history |

---

## 11. Documentation Requirements

### 11.1 User Documentation
- **README.md**: Quick start guide
  - How to install (open in browser)
  - How to configure XBOX Forza Motorsport UDP
  - How to use the app
  - How to interpret the PDF report
  - Troubleshooting common issues
- **FAQ.md**: Frequently asked questions
- **Troubleshooting.md**: Common problems and solutions

### 11.2 Developer Documentation
- **ARCHITECTURE.md**: System architecture and data flow
- **API.md**: Internal API documentation (if any)
- **CHANGELOG.md**: Version history and breaking changes
- **ANALYSIS_ENGINE.md**: Detailed analysis algorithms

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **APEX** | The point where the car is closest to the inside edge of the corner |
| **Early Apex** | Touching the inside edge too early, forcing a tighter radius later |
| **Late Apex** | Touching the inside edge too late, leaving unused track at exit |
| **TAP** | Throttle Application Point - when driver begins applying throttle |
| **Trail-Braking** | Continuing to brake while turning into a corner |
| **Threshold Braking** | Maximum braking force without locking the tires |
| **Stint** | A continuous period of driving between recording start/stop |
| **TTO** | Trailing Throttle Oversteer - oversteer caused by lifting off throttle |
| **Powerband** | RPM range where engine produces maximum power |
| **Track-Out** | Point where car reaches outside edge of road at corner exit |

---

## 13. Appendix

### 13.1 References
- "Going Faster!" by Carl Lopez (Skip Barber Racing School)
- Forza Motorsport UDP Telemetry Specification (FM23_UDP (1).md)
- jsPDF Documentation (PDF generation)
- WebSockets API Documentation (UDP listener proxy)

### 13.2 Similar Products (Competitive Analysis)
| Product | Strengths | Weaknesses |
|---------|-----------|------------|
| Forza Data | Simple, free | Limited analysis, no "Going Faster!" methodology |
| VRS Telemetry | Powerful, cloud-based | Requires account, subscription, cloud upload |
| Motec i2 | Industry standard | Complex, overkill for sim racing |
| ACC Official Telemetry | Game-specific | Limited to ACC, not Forza |

### 13.3 Implementation Notes
- **UDP Listener**: Implement with a small local proxy server (Node.js/Electron) that forwards UDP to WebSocket
- **PDF Generation**: Use pdf-lib or jsPDF for client-side PDF creation
- **Data Storage**: Use IndexedDB for local storage of data
- **UI Framework**: Vanilla JS or minimal library (e.g., Alpine.js)
- **Dependencies**: None beyond standard browser APIs
- **Distribution**: Provide as a single executable (Electron) or downloadable archive

---

**Document Version**: 1.0.0
**Status**: Draft
**Last Updated**: 2026-08-23
**Author**: APEX Product Team