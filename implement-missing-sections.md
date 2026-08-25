# Implement Missing APEX v3.0 Sections in UI & PDF Generator

## Goal
Implement the missing APEX v3.0 "Going Faster!" racecraft and vehicle dynamics sections into both the browser UI dashboard and the multi-page vector PDF report generator (`pdf-generator.js`), fulfilling the specification in `apex 3.md`.

---

## Analysis & Current State
- **Analysis Engines**: All 5 backend engines (`car-control.js`, `braking-entry.js`, `chassis-advisory.js`, `surface-intelligence.js`, `racecraft-engine.js`) are complete, tested, and orchestrated in `src/analysis/index.js` & `public/js/analysis/index.js`.
- **Missing in PDF Generator (`public/js/pdf-generator.js`)**:
  1. Dedicated Vector CPR Skid Recovery & Oversteer Breakdown section.
  2. 4-Block Corner Entry & Apex Overslowing Straightaway Delta section.
  3. 4-Corner Suspension Travel, Bottoming, Aero Rake & Setup Advisory section.
  4. Wet-Weather & Track Surface Intelligence section.
  5. Full-page 14-Point Skip Barber Post-Session Critique Card with authentic quotes.
- **Missing in Web UI (`public/index.html`, `public/js/session-manager.js`)**:
  1. Skid & CPR State Timeline widget.
  2. 4-Block Braking Breakdown Card with overslowing time loss display.
  3. Chassis Health & Setup Advisory card (4-corner heatmap & tuning tips).
  4. Surface & Wet Conditions Panel (puddle depth & camber G overlay).
  5. 14-Point Post-Session Scorecard interactive grid.

---

## Tasks

- [x] **Task 1: Vector CPR Skid Dynamics PDF Section**
  - Add `drawCarControlPage()` to `public/js/pdf-generator.js` and `src/pdf/pdf-builder.js`.
  - Draw CPR state transitions (Correction, Pause, Recovery), tankslapper flags, and slip angle differential ($\Delta\alpha$).
  - → *Verify*: PDF includes vector-rendered CPR skid state wave graphs and TTO metrics.

- [x] **Task 2: 4-Block Corner Entry & Overslowing PDF Section**
  - Add `drawBrakingEntryPage()` to `public/js/pdf-generator.js` and `src/pdf/pdf-builder.js`.
  - Render 4 sequential entry blocks per corner, overslowing straightaway delta table, and downshift brake dip warnings.
  - → *Verify*: PDF contains 4-block phase bars, brake dip percentages, and $V_{min}$ time loss calculations.

- [x] **Task 3: Suspension Load Transfer & Setup Advisory PDF Section**
  - Add `drawChassisAdvisoryPage()` to `public/js/pdf-generator.js` and `src/pdf/pdf-builder.js`.
  - Render 4-corner suspension travel meters/heatmap, bottoming alerts, aero rake shifts, and prescriptive setup adjustments table.
  - → *Verify*: PDF includes mechanical setup recommendations and suspension travel charts.

- [x] **Task 4: Wet-Weather & Track Surface Intelligence PDF Section**
  - Add `drawSurfaceIntelligencePage()` to `public/js/pdf-generator.js` and `src/pdf/pdf-builder.js`.
  - Render puddle depth, hydroplaning risk gauges, wet line vs dry line ("Rim Shot" vs "Squaring-Off") comparison, and banking G multipliers.
  - → *Verify*: PDF renders surface telemetry cards and weather racecraft guidance.

- [x] **Task 5: Full-Page 14-Point Skip Barber Scorecard PDF Section**
  - Add `drawSkipBarberScorecardPage()` to `public/js/pdf-generator.js` and `src/pdf/pdf-builder.js`.
  - Render the 14-criteria evaluation matrix with grades (A+ to F), radar metrics, rev-matching scores, shift latency, draft estimation, and Chapter 10 quotes.
  - → *Verify*: PDF contains full-page Skip Barber critique scorecard with authentic coaching quotes.

- [x] **Task 6: Web UI Interactive Widgets Integration**
  - Updated and verified `public/index.html` and `public/js/session-manager.js` with:
    - CPR Skid & Yaw Rate Timeline widget
    - 4-Block Braking Card with overslowing delta
    - Chassis Health & Setup Advisory card
    - Dynamic Surface & Wet Conditions panel
    - 14-Point Post-Session Scorecard grid
  - → *Verify*: Web UI dashboard displays all 5 interactive modules with live telemetry values.

- [x] **Task 7: Automated Tests & PDF Verification**
  - Updated `tests/pdf.test.js` to assert presence of all new pages and sections.
  - Executed full test suite with `npm test` (71/71 tests passing).
  - → *Verify*: All unit and PDF generation tests pass with 100% success.

---

## Done When
- [ ] Multi-page PDF report includes all 5 APEX v3.0 dedicated vector sections and Skip Barber 14-point scorecard.
- [ ] Web UI dashboard renders all 5 interactive widgets cleanly.
- [ ] `npm test` passes without errors.
