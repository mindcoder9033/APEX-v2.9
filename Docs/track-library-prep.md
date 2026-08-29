# Plan: Covert Track Library & Pre-Stint Preparation Hub

## 🎯 Goal
Develop an automated, background-synthesized **Track Library** in APEX. When a driver completes and saves a stint, APEX covertly parses the telemetry data to extract circuit geometry, corner profiles, braking markers, gear recommendations, and hazard zones. The driver can then explore these saved tracks in a dedicated **Pre-Stint Preparation Hub** and export a high-impact **2-Page Pre-Stint Driver Briefing PDF**.

---

## 🏗️ Architecture & Data Flow

```
[ Driver Saves Stint ]
         │
         ▼
[ TrackLibrarySynthesizer ] ──► Extracts Best Lap (Position X/Y/Z, Speed, Gears, Braking, Curvature)
         │                  ──► Runs Corner & Hazard Detection (Apexes, Min Speeds, Unweighting Crests)
         │                  ──► Correlates with FM23 Catalog Metadata (Length, Layout, Real/Fictional)
         ▼
[ Persistent Track Database ] ──► Stores Track Profiles in IndexedDB / LocalStorage ('apex_track_library')
         │
         ▼
[ Pre-Stint Preparation Hub ] ──► Header Nav View Switcher: [🏎️ PIT WALL] ⇄ [🗺️ TRACK LIBRARY]
         │                    ──► Interactive 2D Vector Track Map with Turn Overlay & Sector Splits
         │                    ──► Turn-by-Turn Telemetry Cheat Sheet (Target Gears, Min Speeds, Braking)
         ▼
[ Pre-Stint PDF Export ] ─────► 2-Page Executive Driver Briefing via pdf-lib:
                                  • Page 1: Vector Track Map + Turn Callouts + Track Hazards
                                  • Page 2: Turn-by-Turn Target Speeds, Gears & Setup Advisories
```

---

## 📋 Task Breakdown

### Phase 1: Covert Track Synthesizer (`src/analysis/track-library-synthesizer.js`)
- [ ] Create `TrackLibrarySynthesizer` module:
  - Ingests stint data and selects the fastest valid recorded lap.
  - Generates normalized 2D/3D spatial coordinate splines using `track-map.js`.
  - Runs `CornerExtractor` / `CornerDetector` to identify all turns, entry/apex/exit points, and minimum cornering speeds.
  - Extracts powerband and gear selection per turn from `ShiftingPowerbandEngine`.
  - Calculates braking markers (distance before apex where threshold braking begins).
  - Flags hazard zones: high vertical G compression, unweighting crests, puddle/wet drag, and curb instability.
  - Correlates with `Docs/FM23 Tracks.md` metadata (official layout name, track category, metric length).

### Phase 2: Persistent Storage Layer (`public/js/track-library-store.js`)
- [ ] Implement `TrackLibraryStore` with IndexedDB / localStorage fallback:
  - `saveTrackProfile(trackData)`: Upserts track record, updating personal best lap times and optimal lines if a faster stint is recorded.
  - `getAllTracks()`: Retrieves all explored circuits (Dynamic Library - Driven Tracks Only).
  - `getTrackById(trackId)`: Fetches a single track profile with full corner and telemetry payload.
  - `deleteTrack(trackId)` / `clearLibrary()`: Management utilities.

### Phase 3: Stint Modal Integration (`public/js/session-manager.js` & `public/js/components/stint-modal.js`)
- [ ] Hook into the stint save lifecycle:
  - When `btn-confirm-stint-metadata` is clicked and the stint is saved, trigger `TrackLibrarySynthesizer.synthesizeAndSave()`.
  - Automatically associate the selected Track and Layout names with the synthesized spatial profile.

### Phase 4: Pre-Stint Preparation Hub UI (`public/index.html`, `public/js/track-library-view.js`, `public/css/index.css`)
- [ ] Add `[🗺️ TRACK LIBRARY]` navigation button to the top header navigation group.
- [ ] Add `#view-track-library` container:
  - **Left Sidebar / Grid**: Search bar, category filter (Real / Fictional), and card list of driven tracks displaying Track Name, Layout, Best Lap, and Corner Count.
  - **Empty State**: Sleek instruction banner informing the driver to record a stint to unlock track profiles.
  - **Main Circuit Stage**:
    - Interactive SVG Track Map visualizer with driving state colorization (Braking, Cornering, Acceleration) and numbered Turn Pins.
    - Track Summary Hero (Length, Sector Splits, Elevation Gain, Benchmark Lap Time).
  - **Turn-by-Turn Telemetry Matrix**:
    - Interactive table listing Turn #, Corner Type, Target Gear, Minimum Corner Speed, Braking Reference Point, and Racing Line Focus.
  - **Track Hazard & Surface Intel Card**:
    - Crest unweighting warnings, heavy braking zones, and aggressive curb alerts.
  - **Top Actions**: `[📄 EXPORT PRE-STINT PREP PDF]` and `[⬅️ BACK TO PIT WALL]`.

### Phase 5: 2-Page Pre-Stint Prep PDF Generator (`public/js/pre-stint-pdf-builder.js`)
- [ ] Implement `PreStintPdfBuilder` using `pdf-lib`:
  - **Page 1: Circuit Overview & Vector Map**:
    - Dark motorsport header with Track Name, Layout, Official Metric Length, and Benchmark Lap.
    - High-resolution vector track map drawing using PDF line/path primitives with colored driving states and turn number badges.
    - Critical Track Hazards & Elevation Advisory panel.
  - **Page 2: Driver Briefing & Turn-by-Turn Cheat Sheet**:
    - Formatted data grid of all turns with Target Gear badges, Apex Min Speed, Braking Distance Marker, and Skip Barber coaching notes.
    - Pre-stint setup recommendations (downforce level, tire thermal wear predictions).
    - Driver signature / Session notes block.

### Phase 6: Testing & Quality Assurance
- [ ] Write unit & integration tests in `tests/track-library.test.js`:
  - Test track synthesis from raw telemetry stint data.
  - Test storage persistence and retrieval.
  - Test PDF generation and page compilation without errors.
  - Verify all 72+ existing tests continue passing without regression.

---

## 🧪 Verification Plan

### Automated Tests
- Run `npm test` to verify unit and integration tests across parser, analysis, synthesis, and PDF generation.

### Manual Verification
1. Start server with `npm start`.
2. Generate or stream telemetry with `npm run mock:stream`.
3. Start recording, record 2 laps, and click Stop / Save Stint.
4. Select "Circuit de Spa-Francorchamps" -> "Full Circuit" in the stint modal and confirm.
5. Click `[🗺️ TRACK LIBRARY]` in the header. Verify Spa-Francorchamps appears with interactive 2D track map, turn list, target gears, and braking markers.
6. Click `[📄 EXPORT PRE-STINT PREP PDF]` and verify the downloaded 2-page PDF renders crisp vector graphics and turn data.

---

## 📌 Deliverable Summary
- **Plan File**: [`track-library-prep.md`](file:///d:/AI%20Workspace/APEX%20v2.9/track-library-prep.md)
- **Status**: Ready for execution via `/create` or implementation approval.
