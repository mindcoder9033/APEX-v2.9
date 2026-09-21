# Skills Hub: Adaptive Driving Coach & Stint Evolution Matrix

> **Plan**: Implementation of the dedicated "Skills Hub" Tab in APEX based on *Going Faster!* (Chapter 1: "A Plan of Attack") with real-time telemetry scoring and persistent attempt history analytics.

---

## 1. Overview & Vision

The **Skills Hub** transforms Skip Barber's *Going Faster!* racing principles into an interactive, telemetry-driven coaching academy inside APEX. Beginning with **Chapter 1: "A Plan of Attack"**, the hub decomposes race driving into concrete, measurable physics-based skills, continuously scores driver corner attempts from live/session telemetry, and persists every attempt into a driver learning matrix to track long-term skill acquisition and eliminate bad habits.

### Core Objectives
1. **Chapter 1 Curriculum Integration**: Codify the 5 foundational skills from Chapter 1 (Exit Speed, The Line, Threshold Braking, Combined Entry, Platform Stability).
2. **Real-Time Telemetry Scoring**: Automatically score corner attempts on a 0–100 scale using APEX's 60Hz telemetry engine.
3. **Attempt Persistence & History**: Log all corner attempts per driver, track, car, and skill with delta metrics into `skills-store.js`.
4. **Learning Evolution Analytics**: Visualize driver progression curves, habit improvement percentages, and radar mastery profiles.
5. **Architectural Compliance**: Maintain dual Node.js (`src/analysis/`) and browser-served (`public/js/analysis/`) symmetry per workspace memory.

---

## 2. Project Type & Tech Stack

- **Project Type**: Web Application (Pit-Wall Telemetry Dashboard)
- **Primary Agents**: `frontend-specialist`, `backend-specialist`
- **Core Stack**:
  - UI: Vanilla JS (ES Modules), HTML5 Canvas, SVG, Glassmorphism CSS design system.
  - State & Storage: `localStorage` / `IndexedDB` with custom reactive event bus.
  - Analysis: Shared JavaScript telemetry math modules (`src/analysis/` & `public/js/analysis/`).
  - Font & Aesthetics: Chakra Petch, JetBrains Mono, Inter; APEX dark theme (`#0d0f12`, `#00ff88`, `#00e5ff`, `#ffb800`).

---

## 3. Chapter 1 Skills Specification

| Skill ID | Skill Name | "Going Faster" Chapter 1 Reference | Telemetry Metrics & Inputs | Scoring Formula (0–100) |
| :--- | :--- | :--- | :--- | :--- |
| `ch1-exit-speed` | **Exit Speed & Throttle Commitment** | *"Car Control for Exit Speed"* (Figs 1-8 to 1-10, p. 8–10) | Throttle ramp rate, time-to-full-throttle, lateral G vs throttle unwind, exit speed delta vs reference. | Combines throttle smoothness (30%), exit speed carried (40%), and lack of hesitation/snap (30%). |
| `ch1-the-line` | **Line Radius & Arc Consistency** | *"Finding the Line"* (Figs 1-5 to 1-6, p. 6–7) | Minimum corner apex speed, steering angle variance (absence of mid-corner saw-toothing), apex proximity. | Evaluates arc geometric smoothness (50%) and apex minimum speed retention (50%). |
| `ch1-threshold-braking` | **Threshold Braking Precision** | *"Slowing for Corners"* (Figs 1-11, 1-15, p. 10–12) | Longitudinal deceleration ramp rate, peak G stability, ABS/lockup oscillations, brake point variance (±m). | Scores braking firmness (40%), distance repeatability (30%), and absence of lockup (30%). |
| `ch1-combined-entry` | **Combined Entry & Trail-Braking** | *"Braking and Entering"* (Fig 1-12, p. 10–11) | Combined G-envelope ($\sqrt{G_{lat}^2 + G_{lon}^2}$), brake bleed rate vs steering ramp. | Measures grip utilization continuity (0.85–1.00 friction budget during turn-in). |
| `ch1-platform-stability` | **Platform Balance & Anti-Lift** | *"Four Mistakes: Careless Lifting"* (p. 14–15) | Throttle pump count, longitudinal jerk ($dG_x/dt$), yaw rate oscillations during mid-corner transition. | Starts at 100, penalizes mid-corner throttle lifting/pumping and sudden chassis pitch snaps. |

---

## 4. UI Layout & Component Architecture

```
+--------------------------------------------------------------------------------------------------+
| APEX // PIT-WALL TELEMETRY [v2.9]        [PIT WALL] [TRACK DOSSIER] [CAREER MODE] [★ SKILLS HUB] |
+--------------------------------------------------------------------------------------------------+
| CHAPTER SELECTOR: [ Chapter 1: A Plan of Attack ▼ ]            DRIVER: [ #01 APEX Driver (CLUB) ] |
+------------------------------------+-------------------------------------------------------------+
| 📚 CHAPTER PLAYBOOK & BRIEFING     | 🎯 LIVE CORNER ATTEMPT CLINIC                               |
| [1. Exit Speed & Throttle Roll]    | Corner: Turn 5 (Hairpin) — Score: 89/100 (GRADE A)          |
| [2. Line Radius & Arc]             | • Throttle Squeeze: 0.34s (Smooth, zero lift)               |
| [3. Threshold Braking]             | • Brake Marker: -1.8m vs Reference (Spot On)                |
| [4. Combined Entry & Trail]        | • Exit Speed: 142.4 km/h (+2.8 km/h gain)                   |
| [5. Platform Balance]              | [ View Split Telemetry Trace ] [ Add Coach Note ]           |
+------------------------------------+-------------------------------------------------------------+
| 📈 DRIVER EVOLUTION MATRIX & HISTORICAL ATTEMPT LOG                                             |
| [Filter: All Skills | T1 | T2 | T5] [Stint History Trendline] [Habit Evolution Diagnostic]      |
|  - Attempt #48: Turn 5 (Exit Speed) -> 92 (▲ +8) [Best Exit: 143.1 km/h]                        |
|  - Attempt #47: Turn 5 (Exit Speed) -> 84                                                       |
|  - Habit Analysis: "Mid-corner throttle lift frequency decreased by 38% across last 20 stints"   |
+--------------------------------------------------------------------------------------------------+
```

---

## 5. File Structure & Changes

```
APEX v2.9/
├── public/
│   ├── index.html                                 [MODIFY: Add Skills Hub Nav Tab & #view-skills container]
│   ├── css/
│   │   ├── index.css                              [MODIFY: Import skills-hub.css]
│   │   └── components/
│   │       └── skills-hub.css                     [NEW: Glassmorphism layout, cards, radar, attempt table]
│   └── js/
│       ├── app.js                                 [MODIFY: Register Skills Hub view router and keyboard shortcut 'K']
│       ├── skills-view.js                         [NEW: Skills Hub UI controller & chart renderer]
│       ├── skills-store.js                        [NEW: Persistent driver attempt store & progression engine]
│       ├── skills-curriculum.js                   [NEW: Chapter 1 skills definition and physics benchmarks]
│       └── analysis/
│           ├── index.js                           [MODIFY: Export skills evaluator]
│           └── going-faster/
│               └── skills-evaluator.js            [NEW: Browser mirror for scoring telemetry against skills]
└── src/
    └── analysis/
        ├── index.js                               [MODIFY: Export skills evaluator]
        └── going-faster/
            └── skills-evaluator.js                [NEW: Node.js telemetry scoring engine]
```

---

## 6. Detailed Task Breakdown

### Phase 1: Core Curriculum & Evaluation Engines (P0/P1)

- **Task 1.1: Chapter 1 Skills Curriculum Model**
  - **Agent**: `backend-specialist`
  - **Skills**: `@[clean-code]`
  - **Files**: `public/js/skills-curriculum.js`
  - **INPUT**: Chapter 1 physics specifications from *Going Faster!*.
  - **OUTPUT**: Structured metadata object containing all 5 skills, criteria, reference thresholds, coaching tips, and diagram references.
  - **VERIFY**: Module exports `GOING_FASTER_CHAPTERS` and `CHAPTER_1_SKILLS` with schema validation.

- **Task 1.2: Telemetry Skills Evaluator (Node & Browser Dual Modules)**
  - **Agent**: `backend-specialist`
  - **Skills**: `@[clean-code]`, `@[api-patterns]`
  - **Files**:
    - `src/analysis/going-faster/skills-evaluator.js`
    - `public/js/analysis/going-faster/skills-evaluator.js`
  - **INPUT**: Telemetry lap/corner slice data (speed, throttle, brake, steer, latG, lonG, distance, time).
  - **OUTPUT**: `evaluateCornerSkills(cornerData, referenceData)` returning numerical scores (0-100), sub-scores, detected errors, and actionable coach feedback.
  - **VERIFY**: Unit tests on simulated telemetry slices prove reproducible scoring across all 5 skills. Both copies are in sync.

---

### Phase 2: Persistence & Attempt Evolution Store (P1)

- **Task 2.1: Driver Skills & Attempt Store (`skills-store.js`)**
  - **Agent**: `backend-specialist`
  - **Skills**: `@[clean-code]`
  - **Files**: `public/js/skills-store.js`
  - **INPUT**: Scored corner attempts from live session or imported CSV/telemetry.
  - **OUTPUT**: Persistent state store managing driver attempt history, skill mastery levels, rolling averages (last 5, 10, 50 attempts), habit detection, and export/import.
  - **VERIFY**: Storage persists across browser refreshes; stats calculations return valid progression deltas.

---

### Phase 3: UI Implementation & Visual Design (P2)

- **Task 3.1: Navigation & Container Markup**
  - **Agent**: `frontend-specialist`
  - **Skills**: `@[frontend-design]`, `@[design-spec]`
  - **Files**: `public/index.html`
  - **INPUT**: Nav tab specification (`#btn-nav-skills`) and view container (`#view-skills`).
  - **OUTPUT**: Semantic HTML5 markup for Chapter Selector, Playbook cards, Live Corner Clinic, Split Telemetry Drawer, and Evolution Matrix Table/Charts.
  - **VERIFY**: Tab button renders with icon `🎓` / `⚡`, hotkey `K` works, view container switches cleanly without DOM collision.

- **Task 3.2: Skills Hub Styling (`skills-hub.css`)**
  - **Agent**: `frontend-specialist`
  - **Skills**: `@[frontend-design]`, `@[tailwind-patterns]`
  - **Files**: `public/css/components/skills-hub.css`, `public/css/index.css`
  - **INPUT**: APEX motorsport design tokens and glassmorphism guidelines.
  - **OUTPUT**: Responsive, dark-themed UI styling with chamfered borders, animated score gauges, radar chart styling, and attempt table styling.
  - **VERIFY**: High-contrast accessibility compliance, responsive down to 1280x720, no horizontal overflow.

- **Task 3.3: Interactive View Controller (`skills-view.js`)**
  - **Agent**: `frontend-specialist`
  - **Skills**: `@[frontend-design]`, `@[clean-code]`
  - **Files**: `public/js/skills-view.js`, `public/js/app.js`
  - **INPUT**: Event hooks from `session-manager.js`, `skills-store.js`, and `skills-curriculum.js`.
  - **OUTPUT**: Dynamic rendering of skill cards, live attempt updates, interactive skill detail modal/drawer with telemetry chart overlays, and progression trendlines.
  - **VERIFY**: When telemetry feeds in or session loads, corner attempts animate with new scores, table updates in real-time, and filtering works smoothly.

---

## 7. Phase X: Final Verification Protocol

1. **Dual-File Sync Verification**:
   - Ensure `src/analysis/going-faster/skills-evaluator.js` and `public/js/analysis/going-faster/skills-evaluator.js` are identical. (✅ Passed - `FC: no differences encountered`)
2. **Telemetry Replay & Live Scoring Test**:
   - Run sample/live telemetry through `session-manager.js` and verify attempts are scored, logged, and rendered without console errors. (✅ Passed)
3. **Storage & Persistence Test**:
   - Verify that adding attempts, switching drivers, and reloading the page retains historical attempt logs and mastery stats. (✅ Passed)
4. **Lint & Code Integrity**:
   - Zero syntax errors in browser console or Node runtime. (✅ Passed)

## ✅ PHASE X COMPLETE
- Evaluator Parity: ✅ Pass (Dual-directory identical)
- Module Imports: ✅ Pass (ES Modules load cleanly in Node & browser)
- UI & CSS: ✅ Pass (Glassmorphism & dark theme compliant)
- Stint Pipeline Hook: ✅ Pass (Auto-scores on stint completion)
- Date: 2026-09-21
