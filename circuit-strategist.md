# Project Plan: Circuit Strategist (Interactive "What-If" Racecraft & Driving Line Studio)

**Document**: `circuit-strategist.md`  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Lead Agent**: `project-planner` → `orchestrator` / `frontend-specialist` / `racecraft-engineer`

---

## 🎯 Executive Summary & Objectives

**Circuit Strategist** is an interactive racecraft simulation and optimal driving line definition studio for APEX v2.9. Grounded in the engineering and driving principles of *Going Faster! Mastering the Art of Race Driving* by the Skip Barber Racing School, Circuit Strategist enables drivers to:
1. **Interactive Landmark Manipulation**: Drag and fine-tune Braking Points, Turn-In Points, Geometric vs. Real/Late Apexes, Throttle Application Points (TAP), and Track-Out Points directly on a synchronized 2D/3D track canvas and telemetry strip.
2. **Optimal Driving Line Sculpting (Going Faster Ch. 3 & 7)**: Define and visualize the *Real-World Line* across the full track width ($0\%$ inside curb to $100\%$ outside curb), comparing Late-Apex (Exit-Priority), Geometric, Diamond V-Line, Compromised S-Curve, and Rain Lines against actual driven telemetry.
3. **Instantaneous Physics Simulation**: Compute corner radius ($R = v^2 / 15G$), effective grip limits, exit speed optimization ($v_{exit} = \sqrt{15 \mu G R}$), and straightaway delta time accumulation ($\Delta t_{straight} \approx -\frac{\Delta v_{exit} \cdot D_{straight}}{\bar{v}^2}$).
4. **3D Topography & Elevation Dynamics**: Account for vertical acceleration ($a_z$), unweighting over crests (loss of normal force/grip), compression in dips, and slope gradient braking distance adjustments.
5. **Strategy Presets & Export**: Save named strategy profiles per circuit and export professional PDF Racecraft Strategy Sheets.

---

## 🏗️ Architecture & Component Blueprint

```
+----------------------------------------------------------------------------------------------------+
|                                    CIRCUIT STRATEGIST MODULE                                      |
+----------------------------------------------------------------------------------------------------+
|  UI / UX LAYER (public/js/ & public/css/)                                                         |
|  - circuit-strategist-view.js: Interactive 2D/3D Track Canvas + Spline Editor + Telemetry Strip    |
|  - circuit-strategist.css: Motorsport Chamfered UI, Neon Splines, Elevation Badges, Warnings       |
|  - index.html: 4th Primary Navigation Tab [CIRCUIT STRATEGIST (C)] + Pit-Wall Cross-Launch Hook   |
+----------------------------------------------------------------------------------------------------+
|  SIMULATION & RACECRAFT ENGINE (src/analysis/ & public/js/analysis/)                              |
|  - circuit-strategist.js: Going Faster Dynamics Suite, Landmark Delta Math, Straightaway Gains    |
|  - optimal-line-engine.js: Asymmetrical Splines, Lateral Offsets, Curvature & Radius Calculation  |
|  - elevation-dynamics.js: 3D Topography, Vertical G Unweighting, Grade Modifiers & Warnings       |
+----------------------------------------------------------------------------------------------------+
|  PERSISTENCE & EXPORT                                                                              |
|  - LocalStorage Strategy Profile Manager (circuit_strategy_<trackId>_<profileName>)                |
|  - Strategy PDF Dossier Generator (Integrated with APEX pdf-generator pipeline)                   |
+----------------------------------------------------------------------------------------------------+
```

---

## 📋 Phased Task Breakdown

### Phase 1: Core Physics & Optimal Line Engine (Backend + Browser Mirror)
- **Assigned Agent**: `racecraft-engineer` / `backend-architect`
- **Target Files**:
  - `src/analysis/circuit-strategist.js` + `public/js/analysis/circuit-strategist.js`
  - `src/analysis/optimal-line-engine.js` + `public/js/analysis/optimal-line-engine.js`
  - `src/analysis/elevation-dynamics.js` + `public/js/analysis/elevation-dynamics.js`
- **Deliverables**:
  1. `calculateCornerRadius(speed, lateralG, elevationGrade)` ($R = v^2/15G$).
  2. `generateOptimalLine(cornerSamples, archetype, lateralOffsets, trackWidth)`.
  3. `simulateCornerDeltas(baselineCorner, landmarkAdjustments, lineSpline, elevationProfile)`.
  4. `computeStraightawayGain(deltaExitSpeed, straightLength, averageSpeed)`.
  5. `evaluateTopographyRisks(elevationSamples, brakePoint, apexPoint)` (Crest unweighting & compression alerts).
  6. Unit test coverage in `tests/analysis/circuit-strategist.test.js`.

### Phase 2: Interactive Visualizer & Spline Editor (Frontend)
- **Assigned Agent**: `frontend-specialist` / `ui-designer`
- **Target Files**:
  - `public/js/circuit-strategist-view.js`
  - `public/css/components/circuit-strategist.css`
  - `public/index.html`
- **Deliverables**:
  1. Interactive HTML5 Canvas / SVG rendering track boundaries, inner/outer curbs, driven telemetry line (cyan), and optimal line spline (gold/green).
  2. Draggable interactive control pins:
     - `[B]` Braking Point (distance & lateral position)
     - `[I]` Turn-In Point (distance & lateral position)
     - `[A]` Apex / Clipping Point (corner depth % & curb proximity)
     - `[T]` Throttle Application Point (TAP)
     - `[O]` Track-Out Point (unwind point & lateral track usage)
  3. Real-time synchronized telemetry strip:
     - Speed curve: Baseline vs. Simulated
     - Throttle & Brake trace overlays
     - G-G friction circle with trail-braking transition vector
     - 3D Topography strip with elevation gradient %, normal force indicator, and crest warnings.
  4. Racecraft Strategy Dashboard:
     - Corner Type badge (`TYPE 1: Exit Priority`, `TYPE 2: Entry Priority`, `TYPE 3: Compromise`)
     - Live Delta Ticker (e.g. `Simulated Lap: -0.428s Potential Gain`)
     - Exit speed comparison (`Baseline: 84.2 mph` vs `Simulated: 87.4 mph (+3.2 mph)`).

### Phase 3: Presets, Strategy Management & Navigation Integration
- **Assigned Agent**: `frontend-specialist` / `orchestrator`
- **Target Files**:
  - `public/js/app.js` (or main client router)
  - `public/js/circuit-strategist-view.js`
  - `public/index.html`
  - `public/js/session-manager.js`
- **Deliverables**:
  1. [x] Header navigation integration: `CIRCUIT STRATEGIST` tab with hotkey `C` and active tab switching.
  2. [x] Pit-wall widget hook: "Open in Circuit Strategist" (`⚡ STRATEGIZE`) button on Corner Analysis & Braking Zone breakdown.
  3. [x] Preset selector:
     - *Late Apex Exit (Type 1)*
     - *Geometric Radius Benchmark*
     - *Deep Braking / Defense Line (Type 2)*
     - *Linked S-Curve Compromise (Type 3)*
     - *Wet / Low-Grip Line*
  4. [x] Named Profile Manager: Save, Load, Rename, Delete strategy profiles in `localStorage`.
  5. [x] Reset button: Revert modifications back to the telemetry baseline lap.

### Phase 4: Strategy PDF Export & Reporting
- **Assigned Agent**: `document-generator` / `frontend-specialist`
- **Target Files**:
  - `src/pdf/strategy-pdf-exporter.js` & `public/js/strategy-pdf-exporter.js`
  - `public/js/circuit-strategist-view.js`
  - `tests/strategy-pdf-exporter.test.js`
- **Deliverables**:
  1. [x] Generate motorsport-grade 2-page PDF Racecraft Strategy Dossier (Page 1: Circuit Overview, Strategy KPI Summary, Turn-by-Turn Strategy Matrix; Page 2: Selected Corner Anatomy, Landmark Pin Offsets, 3D Topography, and Skip Barber Tactical Directives & Drills).
  2. [x] Embed track metadata, optimal driving line strategy, landmark pin offsets, elevation profile, turn-by-turn projected time delta gains, and Skip Barber racecraft coaching.
  3. [x] Dual-environment architecture: Node.js PDF compilation + client-side browser export via `PDF-Lib` (`window.PDFLib`).
  4. [x] Comprehensive automated unit test coverage with 100% pass rate.

---

## 🧪 Phase X: Verification & Quality Assurance Checklist

- [x] **Physics Accuracy**:
  - [x] Corner radius formula matches Going Faster benchmarks across multiple corner speeds ($30, 60, 100\text{ mph}$).
  - [x] Late Apex line produces larger exit radius $R_{exit}$ and earlier TAP than geometric line.
  - [x] Downhill crest reduces normal force $F_N$ and reduces sustainable lateral Gs.
  - [x] Compounding straightaway calculation matches $\Delta t \approx -\frac{\Delta v \cdot D}{\bar{v}^2}$.
- [x] **Dual-Environment Codebase Sync**:
  - [x] Files created in `src/analysis/` are mirrored in `public/js/analysis/` per project convention.
- [x] **Interactive UI Performance**:
  - [x] Draggable landmark pins move smoothly at 60fps without lag on canvas.
  - [x] Telemetry graphs and delta ticker recalculate in $<16\text{ms}$ upon pin drag.
  - [x] Switching between corners (T1, T2, T3...) is instantaneous.
  - [x] Responsive layout adapts cleanly from 1080p to 4K displays.
- [x] **Persistence & Hotkeys**:
  - [x] Hotkey `C` switches to Circuit Strategist; `P` switches to Pit Wall; `T` to Track Dossier; `K` to Skills Hub.
  - [x] Saved strategy profiles persist across browser reloads.
- [x] **Automated Test Suite**:
  - [x] Run `npm test` to ensure all existing analysis and new strategist unit tests pass with zero regressions.
