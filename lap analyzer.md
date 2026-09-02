# APEX Feature: Lap Analyzer (Self-Discovery Mode)

**Version 1.0** | *"See your line, exit speeds, and braking – no coaching, just data."*

---

## Overview

The **Lap Analyzer** is APEX's "silent observer" mode. Unlike the proactive Voice Coach or the Priority Coach that tells you what to fix, this feature **simply records your telemetry and visualises it** on a detailed 2D track map. You drive, APEX logs everything. After your session, you can review:

- The exact **racing line** you took (your actual path).
- **Exit speed** at every corner exit.
- **Braking points** (where you hit the brakes).
- Speed progression along the track.

The goal is to let you **discover** the optimal line, exit speeds, and braking points on your own – just like the book's philosophy: *"You have to figure it out yourself, but having the data helps."* APEX provides the data, not the answers.

This feature is available to **all driver levels** – beginners can use it to see their progress, while experts can use it to fine-tune every metre.

---

## User Experience (UX)

### Layout

The Lap Analyzer is accessible from the main navigation under **"Session Review"** or **"Track Map"**. After a session, you are presented with:

```
┌──────────────────────────────────────────────────────────────┐
│  SESSION: Sebring – Lap 5 of 12     Car: Mazda MX-5        │
│  Best Lap: 1:24.3                     Gap to reference: +0.8s│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │         2D TRACK MAP (top-down view)                  │ │
│  │                                                        │ │
│  │  [Path with color-coded speed]                        │ │
│  │  [Braking markers]                                    │ │
│  │  [Corner exit speed labels]                           │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  LAP        │  │  CORNER     │  │  SPEED      │       │
│  │  SELECTOR   │  │  DATA       │  │  PROFILE    │       │
│  │  (list of   │  │  (list of   │  │  (graph)    │       │
│  │   laps)     │  │   corners)  │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SESSION SUMMARY:                                      │ │
│  │  • Lap times: 1:25.2 → 1:24.3 (improvement 0.9s)     │ │
│  │  • Most inconsistent corner: Turn 6 (variation 0.4s)  │ │
│  │  • Braking consistency: 78%                           │ │
│  └────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  [Export Data]  [Compare to Best Lap]  [Share Session]     │
└──────────────────────────────────────────────────────────────┘
```

### Key UX Principles

- **No coaching text** – only raw data and visual cues.
- **Color coding** – intuitive speed heatmap (red = fast, blue = slow).
- **Interactivity** – hover over a point to see speed, gear, brake pressure.
- **Multiple lap overlay** – compare your own laps to see improvements.
- **Zoom & Pan** – inspect specific corners in detail.

---

## Widgets & Controls

| Widget | Description | Interaction |
| :--- | :--- | :--- |
| **2D Track Map** | The main view – a top‑down rendering of the track with your driven line overlaid. The line is colour‑coded by speed. | Click on a point to see telemetry (speed, gear, throttle/brake). |
| **Brake Markers** | Red dots or short lines at the exact point where you first applied the brakes (Brake > 0). | Hover to see distance from corner entry. |
| **Exit Speed Labels** | At the track‑out point of each corner (where steering returns to centre), a small label shows the speed and gear. | Shows: "Exit speed: 112 km/h – Gear 4". |
| **Corner Data Panel** | A list of all corners, with entry, apex, and exit speeds, plus braking distance and time. | Click a corner to highlight its segment on the map. |
| **Speed Profile Graph** | A linear graph of speed vs. distance around the track, with vertical markers for corners. | Shows speed variation; can pinpoint where you lose or gain time. |
| **Lap Selector** | Dropdown or list of recorded laps; select one to display. | Toggle between laps, or overlay two laps for comparison. |
| **Session Summary** | Quick stats: best lap, improvement, most inconsistent corner, average exit speed, etc. | Auto-updated; no interaction needed. |

---

## Features (Detailed)

### 1. Recorded Line Path

- APEX logs `PositionX`, `PositionY`, `PositionZ` at 60 Hz.
- The path is smoothed using a moving average to reduce noise.
- The line is drawn on the 2D map with **width** representing speed (e.g., thicker = faster, or colour‑coded).
- The map automatically scales to fit the track bounds.

### 2. Braking Point Detection

- Detected when `Brake` input exceeds a threshold (e.g., > 10% of max).
- The first sample where `Brake > threshold` after a straight is marked as the **braking point**.
- Multiple braking points per lap are stored and can be overlaid for consistency analysis.
- Displayed as red dots or lines on the map.

### 3. Corner Exit Speed & Gear

- A **corner exit** is defined as the point where:
  - The car has passed the apex (minimum speed point of the corner).
  - `Steer` returns to near‑zero (straightening out).
  - The car is at or near the outer edge of the track (track‑out).
- APEX records `Speed` and `Gear` at this point.
- This value is displayed as a label next to the track‑out area on the map.
- The label can be toggled on/off.

### 4. Corner Detection & Segmentation

- APEX automatically detects corners by analysing the curvature of your path (using `Yaw` and `Velocity`).
- Each corner is given a number (e.g., Turn 1, Turn 2) and its entry, apex, and exit points are stored.
- The Corner Data Panel lists each corner with:
  - Entry speed, apex speed, exit speed.
  - Braking distance (from brake point to turn‑in).
  - Time spent in corner.
- This panel is useful for identifying which corners you are losing time on.

### 5. Multiple Lap Overlay

- You can overlay two laps (e.g., your best lap and a recent lap) on the same map.
- The paths are drawn in different colours, allowing you to see line differences.
- Speed profiles can be overlaid as well.

### 6. Export & Share

- Export the map as a PNG image.
- Export telemetry data as CSV for external analysis (e.g., in Excel or other tools).
- Share a session link (if cloud sync is enabled).

---

## Implementation Plan

### Phase 1: Data Collection & Storage (Week 1-2)

| Task | Description | Priority |
| :--- | :--- | :--- |
| **UDP Telemetry Ingestion** | Already in place; ensure we store all necessary fields per sample. | P0 |
| **Lap Segmentation** | Detect start/finish from `Position` and `LapNumber`. | P0 |
| **Session Storage** | Save telemetry data per session (file or database). | P0 |

### Phase 2: Path & Corner Detection (Week 3-4)

| Task | Description | Priority |
| :--- | :--- | :--- |
| **Path Smoothing** | Apply moving average or spline smoothing to `Position`. | P0 |
| **Curvature Calculation** | Compute curvature from `Yaw` or `Velocity` derivatives. | P0 |
| **Corner Detection** | Identify segments where curvature exceeds a threshold; classify entry/apex/exit. | P0 |
| **Brake Point Detection** | Scan for first `Brake > threshold` in each corner approach. | P0 |

### Phase 3: Visualization (Week 5-7)

| Task | Description | Priority |
| :--- | :--- | :--- |
| **2D Map Rendering** | Use a canvas or game engine to render top‑down track with path. | P0 |
| **Speed Colouring** | Map speed to a colour gradient (blue→green→red). | P0 |
| **Brake Markers & Exit Labels** | Place markers and labels on map. | P0 |
| **Corner Data Panel** | Build a list view of corner statistics. | P1 |
| **Speed Profile Graph** | Plot speed vs. distance. | P1 |
| **Lap Selector & Overlay** | UI to select laps and overlay. | P1 |

### Phase 4: Polish & Export (Week 8-10)

| Task | Description | Priority |
| :--- | :--- | :--- |
| **Session Summary** | Compute stats (best lap, improvement, consistency). | P1 |
| **Export PNG** | Save map as image. | P2 |
| **Export CSV** | Export telemetry data. | P2 |
| **User Testing** | Validate with real users. | P0 |

---

## Technical Considerations

- **Track coordinate system**: The `PositionX/Y/Z` from Forza is in global coordinates (metres). We need to determine the track's bounding box and align the map accordingly. We can also use track maps from the FM23 Tracks file to overlay the circuit layout for reference.
- **Speed unit**: Forza provides speed in m/s? Actually in the telemetry, `Speed` is likely in km/h or m/s – we should convert to km/h for readability.
- **Gear**: `Gear` is an integer (0 = neutral, 1-6 etc.). We display it as "Gear: 4".
- **Brake threshold**: Use a value like 10 (out of 255) to avoid false positives from resting foot.
- **Smoothing**: Use a Savitzky‑Golay filter or simple moving average to reduce noise while preserving features.

---

## What This Feature Does NOT Do

- It does **not** provide coaching or suggestions.
- It does **not** compare your line to an ideal line (unless you overlay two of your own laps).
- It does **not** give real‑time audio feedback.

This is purely a **post‑session analysis tool** for self‑guided learning.

---

## Expected User Workflow

1. **Drive** a few laps with APEX running in logging mode (passive).
2. **End the session** and open the Lap Analyzer.
3. **Review** the 2D map, observe your line, braking points, and exit speeds.
4. **Identify** a corner where you think you can improve (e.g., exit speed is low).
5. **Go back out** and try to adjust your line/braking/exit speed for that corner.
6. **Compare** the new lap to the old one using overlay to see the improvement.

---

## Sample Screens (Conceptual)

### Map View
![Map concept: coloured line, brake dots, exit speed labels]

### Corner Data Panel
```
Corner 3 (Right, radius ~80m)
  Entry speed: 95 km/h
  Apex speed:  68 km/h
  Exit speed:  112 km/h (Gear 4)
  Braking distance: 45m
  Time in corner: 2.3s
```

### Speed Profile
```
Speed (km/h)
 160 |          ______________
 140 |         /                \
 120 |        /                  \____
 100 |       /                         \
  80 |______/                           \____
  60 |                                      \
     +------------------------------------------>
        Start   T1   T2   T3   T4   T5   Finish
```

---

## Conclusion

The Lap Analyzer is a powerful self‑discovery tool that embodies the book's core idea: *"You have to learn it yourself, but having the data makes it possible."* By providing a clear visualisation of your line, exit speeds, and braking, APEX gives you the raw material to analyse and improve – without any hand‑holding. This feature is essential for drivers who prefer to figure things out on their own, and it complements the coaching features perfectly.