# APEX v3.0: "Going Faster!" Racecraft & Dynamics Expansion

This engineering plan details the end-to-end implementation of the racecraft and vehicle dynamics features derived from *"Going Faster! Mastering the Art of Race Driving"* (Carl Lopez & Skip Barber Racing School). It upgrades APEX from a telemetry logger into a full-fledged intelligent racing coach and dynamics analytics platform.

---

## User Review Required

> [!IMPORTANT]
> **5-Sprint Modular Roadmap Execution**: We have partitioned the implementation into five focused, sequential sprints (Sprints 14 through 18) to maintain test isolation, mathematical rigor, and UI responsiveness.
> 
> **Binary Telemetry Field Utilization**: All required fields (4-corner suspension travel, tire slip angles, lateral/longitudinal velocities, puddle depth, surface rumble, angular rates) are already supported by the 331-byte FM23 telemetry parser (`src/shared/telemetry-parser.js`).

---

## Proposed Changes & Module Architecture

### Sprint 14: Vehicle Dynamics & CPR Skid Control Engine (`car-control.js`)

Add deep vehicle attitude tracking (Vehicle Yaw vs Tire Slip) and a Correction-Pause-Recovery (CPR) oversteer state machine.

#### [NEW] [car-control.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/car-control.js)
- Compute instantaneous trajectory angle $\theta_{vel} = \text{atan2}(v_x, v_z)$ and vehicle yaw angle $\Psi = \text{Yaw}_{rad} - \theta_{vel}$.
- Calculate front-to-rear slip angle differential $\Delta\alpha = \bar{\alpha}_F - \bar{\alpha}_R$ to classify Neutral, Understeer, and Oversteer states.
- Implement the **CPR Skid State Machine**:
  - `CORRECTION`: Triggered on oversteer onset ($|\Psi| > 5^\circ$ or $\Delta\alpha < -2.0^\circ$), measuring countersteer velocity ($\frac{d\delta}{dt}$).
  - `THE PAUSE`: Identifies apex of the slide where rotational yaw rate $\omega_y \approx 0$.
  - `RECOVERY`: Evaluates how fast the driver unwinds steering back to center ($\le 150\text{ms}$).
  - **Tankslapper Detector**: Identifies alternating yaw oscillations ($> 2$ reversals in 2.0s).
  - **TTO (Trailing Throttle Oversteer) Classifier**: Flags oversteer provoked by abrupt throttle lift ($\frac{d\text{Throttle}}{dt} < -0.6/\text{s}$ under lateral G).

#### [NEW] [car-control.test.js](file:///d:/AI%20Workspace/APEX%20v2.9/tests/car-control.test.js)
- Unit tests validating CPR state transitions, $\Delta\alpha$ calculation, TTO event tagging, and tankslapper detection.

---

### Sprint 15: 4-Block Corner Entry & Overslowing Suite (`braking-entry.js`)

Decompose the entire corner entry into Skip Barber's 4 sequential building blocks and calculate straightaway time loss from overslowing.

#### [NEW] [braking-entry.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/braking-entry.js)
- **Block 1 (Throttle-to-Brake Transition)**: Latency ($t_{trans}$), squeeze rate vs hammer slam lockup risk.
- **Block 2 (Straight-Line Decel & Threshold Modulation)**: Peak G efficiency, pedal pressure variation, 15% longitudinal slip probing.
- **Block 3 (Trail-Braking / Brake-Turning)**: Progressive bleed-off vs constant-pressure hold into decreasing-radius corners.
- **Block 4 (Brake-to-Throttle Transition)**: "The Pause" trailing oversteer handover vs abrupt throttle stab.
- **Apex Overslowing Engine**: Computes $V_{min}$ speed deficit against optimal rolling speed and attributes lost time down the following straight.
- **Downshift Brake Pressure Dip Analyzer**: Flags involuntary brake drops ($> 20\%$) during heel-and-toe downshift blips.

#### [NEW] [braking-entry.test.js](file:///d:/AI%20Workspace/APEX%20v2.9/tests/braking-entry.test.js)
- Unit tests for 4-block segmentation, downshift brake dip calculation, and overslowing straightaway delta math.

---

### Sprint 16: Suspension Load Transfer & Chassis Setup Coach (`chassis-advisory.js`)

Leverage 4-corner suspension travel and body rates to detect chassis faults and provide prescriptive setup adjustments.

#### [NEW] [chassis-advisory.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/chassis-advisory.js)
- **4-Corner Travel Tracker**: Monitors `normSuspensionTravel` and `suspensionTravelMeters` (FL, FR, RL, RR).
- **Chassis Bottoming Detector**: Flags `normSuspensionTravel >= 0.98` (bump-stop slam causing sudden tire download loss).
- **Dynamic Aerodynamic Rake**: Evaluates $\Delta h = h_{rear} - h_{front}$ at speed to identify aero balance shifts.
- **Prescriptive Setup Advisory Engine**: Analyzes persistent multi-lap balance tendencies and outputs actionable setup fixes (e.g., soften front ARB, stiffen rear rebound, adjust brake bias by 1-2 clicks).

#### [NEW] [chassis-advisory.test.js](file:///d:/AI%20Workspace/APEX%20v2.9/tests/chassis-advisory.test.js)
- Unit tests verifying bottoming detection, dynamic rake calculation, and setup recommendation logic.

---

### Sprint 17: Wet-Weather & Dynamic Surface Intelligence (`surface-intelligence.js`)

Ingest environmental telemetry (puddles, rumble, elevation, banking) to guide rain and surface racecraft.

#### [NEW] [surface-intelligence.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/surface-intelligence.js)
- **Puddle Telemetry & Hydroplaning Risk**: Evaluates `wheelOnPuddleDepth` and flags asymmetric single-side water drag.
- **Wet Line vs Dry Line Efficiency**: Detects "Rim Shot" (outside wet-line on rubbered-in sweepers) vs "Squaring-Off" (late apex straight-line decel/accel on tight turns).
- **Track Banking & Camber G-Multiplier**: Computes effective download multiplier from road camber and warns of crest unweighting.

#### [NEW] [surface-intelligence.test.js](file:///d:/AI%20Workspace/APEX%20v2.9/tests/surface-intelligence.test.js)
- Unit tests for puddle asymmetry detection, hydroplaning risk scoring, and camber G-factor math.

---

### Sprint 18: Racecraft Engine & Skip Barber 14-Point Scorecard (`racecraft-engine.js`)

Integrate shifting sympathy, drafting calculations, race start accordion alerts, and the full 14-category post-session critique scorecard.

#### [NEW] [racecraft-engine.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/racecraft-engine.js)
- **Downshift Blip & Synchronizer Quality**: Evaluates RPM match accuracy and clutch shock.
- **Upshift Duration & Rev Limiter Tracker**: Tracks shift speed ($< 0.2\text{s}$) and rev limiter bounces.
- **Draft Tow & Drag Reduction Estimator**: Quantifies slipstream speed advantage and closing rate.
- **14-Point Skip Barber Scorecard**: Generates grades (A+ to F), radar metrics, and quotes for all 14 official criteria (Ch. 10).

#### [NEW] [racecraft-engine.test.js](file:///d:/AI%20Workspace/APEX%20v2.9/tests/racecraft-engine.test.js)
- Unit tests for rev-match grading, upshift timing, draft estimation, and 14-point scorecard compilation.

---

### UI & PDF Generator Integration

#### [MODIFY] [src/analysis/index.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/index.js)
- Export and orchestrate all 5 new analysis engines within the main APEX telemetry processing pipeline.

#### [MODIFY] [public/js/components/analysis-report.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/components/analysis-report.js)
- Add interactive UI widgets:
  - **Skid & CPR State Timeline**: Interactive wave graph of steering vs yaw rate and "The Pause" indicator.
  - **4-Block Braking Card**: Visual breakdown of Blocks 1–4 per corner with overslowing time delta.
  - **Chassis Health & Setup Advisory**: 4-corner suspension heatmap and mechanical tuning advice card.
  - **Surface & Wet Conditions Panel**: Puddle depth monitor and camber G-factor overlay.
  - **14-Point Post-Session Scorecard**: Interactive evaluation grid with Skip Barber master quotes.

#### [MODIFY] [public/js/pdf-generator.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/pdf-generator.js)
- Render dedicated vector-drawn PDF sections for each new suite:
  - Vector CPR skid recovery curves & oversteer severity breakdown.
  - 4-Block corner entry diagrams & overslowing delta tables.
  - 4-corner suspension travel charts & setup tuning prescription table.
  - Wet-weather & track surface advisory section.
  - Full-page 14-Point Skip Barber Post-Session Critique Card with authentic quotes.

---

## Verification Plan

### Automated Tests
```bash
# Run all unit and integration test suites
npm test
```
- Validate all 5 test files (`car-control.test.js`, `braking-entry.test.js`, `chassis-advisory.test.js`, `surface-intelligence.test.js`, `racecraft-engine.test.js`).
- Verify 100% pass rate with edge cases (zero inputs, division by zero, missing sensor packets).

### Manual Verification
1. **Mock Telemetry Stream Replay**:
   - Run `npm run mock:stream` to stream realistic Forza Motorsport telemetry packets.
   - Verify that CPR skid events, 4-block corner entries, suspension travel, and 14-point scorecard calculate live in real-time.
2. **Browser UI Visual Audit**:
   - Inspect the Web UI dashboard on `http://localhost:8080` to verify all new widgets, gauges, and cards render crisply with F1 pit-wall aesthetics.
3. **PDF Generation Validation**:
   - Trigger stint export and verify that the generated multi-page PDF contains vector-rendered diagrams, tables, and coaching cards with exact formatting.
