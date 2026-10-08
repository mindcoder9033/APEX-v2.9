# Implementation Plan: Globally Render Light Theme PDF Exports

## Executive Summary
Following the `/grill-me` architectural review, the APEX PDF generation pipeline will enforce a **Strict Global Light Theme** across all document generators. There is no dark mode toggle or fallback; all exported PDFs are strictly styled for high-contrast, ink-friendly motorsport debriefs adhering to the Skip Barber "Going Faster!" methodology.

---

## 🏛️ Agreed Design Decisions

| Branch | Decision | Rationale & Specification |
| :--- | :--- | :--- |
| **1. Policy & Scope** | **Strict Global Light Mode** | All PDF outputs compile in clean light mode with zero dark theme option, ensuring maximum readability and ink efficiency when printed. |
| **2. Design Tokens** | **Unified `pdf-theme.js` Palette** | Standardized tokens: Pure White `#FFFFFF` page background, Slate-50 `#F8FAFC` card panels, Slate-200 `#E2E8F0` borders, APEX Crimson `#E10600` accents, and Deep Slate `#0F172A` text. |
| **3. Vector Graphics** | **High-Contrast Print Calibration** | Telemetry paths and scatter plots use darkened, print-ready hues: Deep Emerald (`#059669`) for full throttle, Rich Crimson (`#E10600`) for braking, Cobalt Blue (`#006BC7`) for coasting, and Amber (`#D97706`) for partial throttle. |
| **4. Export Flow** | **Direct Frictionless Download** | Direct file download via `downloadPdfDirect()` with zero print modals or intermediate previews; auto-archives to desktop documents and displays a status toast. |
| **5. Verification** | **Automated Suite & Dual Sync** | Automated unit tests asserting page background tokens, byte sizes, magic bytes `%PDF-`, and keeping `src/pdf/` and `public/js/` dual-modules synchronized. |

---

## 📋 Task Breakdown

### Task 1: Audit & Align Color Palettes with Centralized Tokens
- Review [src/pdf/pdf-builder.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/pdf/pdf-builder.js), [public/js/pdf-generator.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/pdf-generator.js), and [public/js/pre-stint-pdf-builder.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/pre-stint-pdf-builder.js).
- Ensure all page backgrounds use pure white `rgb(1.0, 1.0, 1.0)` and all card panels use Slate-50 / Slate-100 fills matching [src/pdf/pdf-theme.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/pdf/pdf-theme.js).
- Replace any lingering hardcoded off-white or dark card elements.

### Task 2: Standardize Vector Telemetry & Chart Visualizations
- Validate [src/analysis/track-map.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/track-map.js) and [public/js/analysis/track-map.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/analysis/track-map.js) `STATE_COLORS` for high-contrast print visibility.
- Ensure G-G friction circle plots, tire thermal dynamics, and waveform sparklines render on white cards with slate gridlines and high-contrast curves.

### Task 3: Verify Frictionless Direct Download Across All UI Triggers
- Confirm all 5 UI export triggers call direct download pipelines:
  1. Main Telemetry Report: `#btn-download-pdf` via [public/js/session-manager.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/session-manager.js)
  2. Pre-Stint Dossier: `#btn-export-pre-stint-pdf` via [public/js/track-library-view.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/track-library-view.js)
  3. Racecraft Strategy: `#btn-export-strategy-pdf` via [public/js/circuit-strategist-view.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/circuit-strategist-view.js)
  4. Practice Stints Review: `#btn-debrief-download-pdf` via [public/js/stints.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/stints.js)
  5. Skills Coach Debrief: `#btn-export-skills-coach-pdf` via [public/js/skills-view.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/skills-view.js)

### Task 4: Synchronize Node.js & Browser Dual-Environment Modules
- Maintain 1:1 synchronization between `src/pdf/` (Node.js/testing) and `public/js/` (browser):
  - `src/pdf/pdf-theme.js` <-> `public/js/pdf-theme.js`
  - `src/pdf/strategy-pdf-exporter.js` <-> `public/js/strategy-pdf-exporter.js`
  - `src/pdf/pdf-builder.js` <-> `public/js/pdf-generator.js`

### Task 5: Phase X — Automated Verification & Regression Suite
- Run `node --test tests/pdf.test.js`
- Run `node --test tests/skills-coach-pdf.test.js`
- Run `node --test tests/strategy-pdf-exporter.test.js`
- Add an explicit assertion test verifying all builders emit valid light-mode PDF buffers with `%PDF-` header and expected page structures.
