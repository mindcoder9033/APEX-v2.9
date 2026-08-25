# Implementation Plan - APEX Track Library, Multi-Lap Calibration & Pre-Stint Track Briefing PDF

Build the **Track Library** feature into APEX with a dedicated header navigation tab, 2–3 lap average speed calibration consensus wizard, interactive 2D SVG/Canvas circuit visualizer & turn editor, backend JSON persistence, canonical turn/sector snapping, and **comprehensive 2-page Pre-Stint Track Briefing PDF exports**.

---

## User Review Required

> [!NOTE]
> All core architectural decisions were aligned during the `/grill-me` session:
> - **Calibration Mode:** Dedicated "Start Track Learning Stint" wizard in the Pit Wall HUD with a live lap counter (`Lap 1/3 (Out/Warm-up) -> Lap 2/3 (Calibration Lap 1) -> Lap 3/3 (Calibration Lap 2)`), consistency meter, and clean-lap validation (flags off-tracks or >5% pace variance).
> - **Calibration Protocol:** Driver maintains a consistent, steady average speed over 2–3 laps for accurate apex, curvature, and braking zone extraction.
> - **Pre-Stint Track Briefing PDF (2-Page):**
>   - **Page 1 (Circuit Intelligence):** Circuit Header, Vector Track Map with numbered turns & sector split lines, Track Vital Stats (length, turns, elevation profile, direction, sector distances), Track Characteristics & Rhythm overview.
>   - **Page 2 (Turn-by-Turn Guide):** Comprehensive turn table (Turn ID/Name, Type, Direction, Entry/Apex/Exit distances, Reference Speeds, Reference Gears, Apex Lateral G, Braking Zones), Key Danger/Overtaking zones, and Pre-Stint Driver Notes.
> - **PDF Architecture:** Dual support — Client-side instant export via `pdf-lib` in the browser + Backend endpoint `GET /api/tracks/:id/pdf`.
> - **Persistence:** Local Node backend `/data/tracks/*.json` with import/export support.
> - **Snapping:** Automatic matching on `trackOrdinal` / lap length with manual override in Session Control.

---

## Proposed Changes

### 1. Backend Persistence & Track REST API

#### [NEW] [src/server/track-repository.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/server/track-repository.js)
- Reads, writes, updates, and deletes track profile JSON files in `/data/tracks/`.
- Validates track schema:
  - `id`, `name`, `layout`, `trackOrdinal`, `lengthMeters`, `direction` (Clockwise/Counter-Clockwise)
  - `sectors` (`s1End`, `s2End`, `s3End`, `s1Length`, `s2Length`, `s3Length`)
  - `turns` (`turnNumber`, `name`, `type`, `direction`, `entryDist`, `apexDist`, `exitDist`, `refSpeed`, `refGear`, `apexLatG`, `brakingDist`, `coords`)
  - `path2D` (sampled normalized X/Z coordinates)
  - `elevation` (`minElevation`, `maxElevation`, `elevationDelta`, `profile`)
  - `calibrationMetadata` (`lapsUsed`, `avgSpeedKph`, `calibratedAt`, `carModel`)
  - `createdDate`, `updatedDate`
- Seeds popular default circuits if `/data/tracks/` is empty.

#### [MODIFY] [src/server/udp-proxy.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/server/udp-proxy.js)
- Mounts REST API routes on the existing HTTP server:
  - `GET /api/tracks` — List all saved track profiles
  - `GET /api/tracks/:id` — Get full track profile detail
  - `POST /api/tracks` — Save / register a newly calibrated track
  - `PUT /api/tracks/:id` — Update turn names, notes, or sector markers
  - `DELETE /api/tracks/:id` — Delete a track profile
  - `POST /api/tracks/import` & `GET /api/tracks/:id/export` — Import/export profile JSON
  - `GET /api/tracks/:id/pdf` — Stream generated Pre-Stint Track Briefing PDF

---

### 2. Multi-Lap Consensus Calibration Engine & Driving Protocol

#### [NEW] [src/analysis/track-calibrator.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/track-calibrator.js) & [public/js/analysis/track-calibrator.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/analysis/track-calibrator.js)
- **Calibration Protocol Execution:**
  - Ingests 2–3 consecutive laps driven at a consistent average pace.
  - **Clean Lap & Consistency Filter:** Checks lap-to-lap delta ($\le 5\%$) and path deviation to detect spins or off-tracks, prompting for re-runs if corrupted.
- **Lap Alignment & Normalization:**
  - Resamples $(X, Z)$ spatial trajectory and distance arrays across calibration laps onto a common normalized distance grid ($1\text{m}$ resolution).
- **Consensus Apex & Curvature Extraction:**
  - Identifies apex points via multi-lap consensus clustering: places where speed reaches a local minimum and lateral acceleration peaks within $\pm 15\text{m}$ across all calibration laps.
  - Computes entry points (initial braking/steering inflection) and exit points (steering unwinding & throttle application).
- **Corner Classification:**
  - Automatically classifies corners: Hairpin ($< 60^\circ$ radius), 90° Corner, Fast Sweeper ($> 140\text{ km/h}$), Chicane (rapid alternating lateral G), and direction (Left/Right).
- **Sector & Elevation Synthesis:**
  - Computes 3 equalized timing sectors (S1, S2, S3) and extracts vertical elevation deltas across track distance.
- **Path Smoothing:**
  - Generates a smooth 2D SVG/Canvas vector centerline path with turn anchor markers.

---

### 3. Pre-Stint Track Briefing PDF Generator

#### [NEW] [src/pdf/track-briefing-builder.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/pdf/track-briefing-builder.js) & [public/js/track-briefing-pdf.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/track-briefing-pdf.js)
- Dual client/server engine utilizing `pdf-lib` to generate a high-contrast, motorsport-styled 2-page Pre-Stint Track Guide:
  - **Page 1 — Circuit Intelligence & Track Map:**
    - **Header:** APEX Pre-Stint Track Briefing, Track Name, Layout, Calibration Date, Track Direction (CW/CCW).
    - **Circuit Map:** High-resolution 2D track vector map with color-coded S1/S2/S3 timing sectors, numbered turn callout badges (`T1`, `T2`, ...), Start/Finish line, and Pit Entry/Exit indicators.
    - **Vital Statistics Box:** Total Distance ($\text{meters} / \text{miles}$), Turn Count, Max/Min Elevation, Longest Straight distance, Estimated Sector Targets.
    - **Track Characteristics:** High-speed vs Low-speed turn ratio, heavy braking zones count, circuit rhythm summary.
  - **Page 2 — Turn-by-Turn Guide & Driver Notes:**
    - **Turn Breakdown Table:**
      - Turn ID (`T1`, `T2`, etc.) & Custom Name (`Abbey`, `Maggotts`, `Eau Rouge`, etc.)
      - Corner Type (Hairpin, Medium 90°, Fast Sweeper, Chicane) & Direction (L/R)
      - Entry, Apex, and Exit Distance markers ($\text{meters}$)
      - Reference Gear & Minimum Apex Speed ($\text{km/h}$ / $\text{mph}$)
      - Peak Lateral G target
      - Recommended Braking Zone start point & intensity
    - **Key Danger & Overtaking Sectors:** Highlights high-risk corner complexes, blind crests, and primary overtaking straights.
    - **Pre-Stint Driver Notes:** Space for driver strategy notes and target lap pacing.

---

### 4. Canonical Turn Snapping in Analysis & PDF Engine

#### [MODIFY] [public/js/analysis/corner-detector.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/analysis/corner-detector.js) & [src/analysis/corner-detector.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/analysis/corner-detector.js)
- Add `detectWithTrackProfile(samples, trackProfile)` method:
  - Snaps incoming live/recorded lap telemetry to canonical Turn IDs (`T1`, `T2`, etc.) defined in the loaded Track Library profile.
  - Evaluates actual apex speed, minimum gear, and braking point against reference calibration metrics.
  - Fallback to dynamic corner detection if no track profile is active.

#### [MODIFY] [public/js/analysis/lap-segmenter.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/analysis/lap-segmenter.js) & [public/js/analysis/index.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/analysis/index.js)
- Lock lap segmentation, micro-sector splits, and delta calculations to canonical sector/turn boundaries.

#### [MODIFY] [public/js/pdf-generator.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/pdf-generator.js) & [src/pdf/pdf-builder.js](file:///d:/AI%20Workspace/APEX%20v2.9/src/pdf/pdf-builder.js)
- Embed canonical track metadata, verified turn names, and consistent sector splits in standard telemetry session PDF reports.

---

### 5. Track Library UI & Interactive Calibration Wizard

#### [MODIFY] [public/index.html](file:///d:/AI%20Workspace/APEX%20v2.9/public/index.html)
- Add View Navigation Tabs in `<header class="pit-header">`:
  - `<button id="tab-nav-pitwall" class="nav-tab active">🏎️ PIT WALL</button>`
  - `<button id="tab-nav-tracks" class="nav-tab">🗺️ TRACK LIBRARY</button>`
- Add `<section id="view-track-library" class="track-library-view" style="display: none;">`:
  - **Left Sidebar:** Search bar, "+ Calibrate New Track" trigger, track cards list (showing preview badge, length, turn count, layout).
  - **Center Stage:**
    - Track Hero Banner (Track Name, Layout, Length, Elevation, Turn Stats, Sector Breakdown).
    - Interactive 2D Track Map (SVG/Canvas with zoom, turn badges, heatmap overlay toggle for Speed/Gear/Braking).
    - Quick Action Bar: `[ 📄 Export Track Briefing PDF ]`, `[ 💾 Save Changes ]`, `[ 📥 Export JSON ]`, `[ 🗑️ Delete Track ]`, `[ 🎯 Set as Active Track ]`.
  - **Right Panel:**
    - Interactive Turn Breakdown Table: Turn ID, Name input, Type badge, Entry/Apex/Exit meters, Reference Speed, Reference Gear, Braking Distance.
- Add **Calibration Wizard HUD & Modal** in Pit Wall:
  - Floating Calibration HUD badge during active learning stint:
    - `[ 📡 CALIBRATING TRACK: LAP 2/3 (AVERAGE SPEED PACE) ]`
    - Pace Consistency Indicator & Clean-lap status
  - **Post-Calibration Modal:**
    - Shows synthesized track preview, detected turn count, and length.
    - Buttons: `[ 📄 Export Track Briefing PDF ]`, `[ 💾 Save to Track Library ]`, `[ ❌ Discard ]`.

#### [MODIFY] [public/css/index.css](file:///d:/AI%20Workspace/APEX%20v2.9/public/css/index.css)
- Motorsport dark-mode styles for Track Library & Calibration Wizard:
  - Navigation tab switcher with active neon accents and chamfered edges.
  - Track card grid with mini-track thumbnails and metadata chips.
  - 2D SVG track visualizer with interactive pulsing turn badges and hover popovers.
  - Editable turn data table with inline inputs and sector accent colors.
  - Calibration HUD banner and post-calibration summary modal.

#### [NEW] [public/js/components/track-library.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/components/track-library.js)
- Client-side manager for Track Library:
  - Fetches and displays track profiles from `/api/tracks`.
  - Renders interactive SVG map with clickable turn markers.
  - Handles turn editing, custom naming, sector updates, and JSON import/export.
  - Triggers client-side Pre-Stint Track Briefing PDF generation via `track-briefing-pdf.js`.

#### [MODIFY] [public/js/session-manager.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/session-manager.js) & [public/js/app.js](file:///d:/AI%20Workspace/APEX%20v2.9/public/js/app.js)
- Wire view tab switching between Pit Wall and Track Library.
- Manage Calibration Stint state machine (Idle $\to$ In-Progress (Lap 1, 2, 3) $\to$ Synthesized $\to$ Saved/Exported).
- Trigger post-calibration modal with 1-click Track Briefing PDF export upon completion of the 2–3 average-speed laps.

---

## Verification Plan

### Automated Tests
- Unit tests for `TrackRepository` (CRUD operations, schema validation, and seeding):
  ```powershell
  node tests/track-repository.test.js
  ```
- Unit tests for `TrackCalibrator` (multi-lap 2–3 lap consensus, average speed consistency filtering, outlier rejection, turn geometry extraction):
  ```powershell
  node tests/track-calibrator.test.js
  ```
- Unit tests for `TrackBriefingBuilder` (2-page PDF generation, vector track map rendering, turn table pagination, and formatting):
  ```powershell
  node tests/track-briefing-pdf.test.js
  ```
- Unit tests for canonical turn snapping consistency:
  ```powershell
  node tests/canonical-snapping.test.js
  ```

### Manual & Interactive Verification
- Start the server (`npm start`) and navigate to `http://localhost:3000`.
- Verify header tab navigation switches between **Pit Wall** and **Track Library**.
- Run telemetry mock stream (`npm run mock:stream`):
  1. Click **"Start Track Learning Stint"**.
  2. Drive/simulate 3 laps at steady average speed. Verify calibration HUD advances (`Lap 1/3` $\to$ `Lap 2/3` $\to$ `Lap 3/3`).
  3. Verify the Post-Calibration summary dialog appears with track stats.
  4. Click **"Export Track Briefing PDF"** and confirm the generated 2-page PDF contains:
     - **Page 1:** Circuit map with labeled turns, sector split lines, vital stats, and characteristics.
     - **Page 2:** Complete Turn-by-Turn guide with entry/apex/exit distances, reference gears, speeds, and braking zones.
  5. Verify the track is saved to `/data/tracks/*.json` and appears in the Track Library view.
  6. Subsequent driving stints on that track lock onto canonical Turn IDs with 0 turn count drift.
