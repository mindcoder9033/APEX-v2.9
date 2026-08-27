# Line & Corner Analysis

## 1. Introduction

**Line & Corner Analysis** is a core module of the **APEX** sim racing telemetry application. Its purpose is to help drivers improve their lap times by providing detailed, actionable feedback on their racing line and cornering technique. The module is grounded in the principles outlined in *Going Faster! Mastering the Art of Race Driving* by the Skip Barber Racing School, which emphasizes that the racing line is the single most important factor in cornering speed and straight‑away acceleration.

By analysing telemetry data from Forza Motorsport (FM23) UDP packets, APEX quantifies how closely a driver follows the optimal line, detects apex hits and misses, monitors track‑out usage, and warns about early or late apexes. This enables drivers to systematically refine their line, corner entry, and exit strategies—turning abstract theory into measurable improvement.

---

## 2. Core Concepts

Before diving into the implementation, it is essential to understand the racing terminology used throughout this module:

| Term | Definition |
|------|------------|
| **Racing Line** | The path that minimises lap time, typically maximising the radius through corners. It touches the outside of the track at turn‑in, the inside at the apex, and the outside again at track‑out. |
| **Turn‑in Point** | The location where the driver begins steering into the corner. |
| **Apex** | The point where the car is closest to the inside edge of the track during the corner. |
| **Track‑out Point** | The point where the car reaches the outside edge of the track at corner exit. |
| **Early Apex** | Touching the inside edge too soon, leading to a tighter radius in the latter part of the corner and often causing a loss of exit speed. |
| **Late Apex** | Touching the inside edge later than ideal, often safer but slower because it reduces the overall corner radius. |
| **Line Score** | A metric (0–100%) indicating how closely the driver’s path matches the optimal line. |
| **Apex Accuracy** | The percentage of corners where the driver’s actual apex position is within a tolerance of the defined optimal apex. |
| **Track‑out Usage** | The percentage of the available track width used at the exit of each corner. |

---

## 3. Telemetry Dependencies

The following FM23 UDP fields (from the **Dash** structure, which includes all **Sled** fields) are critical for this module:

| Field | Usage |
|-------|-------|
| `PositionX`, `PositionY`, `PositionZ` | Global car position – used to reconstruct the trajectory. |
| `Speed` | Current speed – helps to assess corner entry/exit speeds and identify braking points. |
| `Steer` | Steering input – indicates when and how much the driver turns. |
| `Accel`, `Brake` | Throttle and brake inputs – help correlate line with pedal usage. |
| `Yaw`, `Pitch`, `Roll` | Car attitude – useful for detecting oversteer/understeer but secondary for line analysis. |
| `NormalizedDrivingLine` | A value (0–1) provided by the game that indicates how close the car is to the “ideal” driving line. |
| `WheelOnRumbleStripFL/FR/RL/RR` | Indicates when a wheel is on a rumble strip – helps detect track limits. |
| `TireSlipAngle` and `TireCombinedSlip` | Indicate loss of grip, which can be correlated with line errors (e.g., early apex causing understeer). |
| `LapNumber`, `CurrentLap`, `BestLap` | Lap context for session analysis. |

*Note:* `NormalizedDrivingLine` can be used as a coarse reference, but for precision, we derive the optimal line from the driver’s best lap or from a pre‑computed track model.

---

## 4. Sub‑Features

### 4.1 Racing Line Score

**Description:**  
A composite metric that evaluates how closely the driver’s path matches the optimal racing line for each corner and overall. It is calculated by comparing the actual trajectory (via position data) against a reference optimal line.

**Telemetry:** `PositionX/Y/Z`, `Speed`, `Steer` (to detect corner phases).

**Output:**  
- A percentage score per corner (e.g., 92% for T1).  
- An overall session score (average of all corners).  
- Trend indicator (e.g., +2.1% improvement over last lap).

**Implementation:**  
- Segment the track into corners using a pre‑defined map or by detecting significant steering changes.  
- For each corner, sample points along the actual path and the reference line.  
- Compute the mean lateral deviation (perpendicular distance) between the two paths.  
- Convert deviation to a score using a logarithmic or exponential scale (e.g., score = 100 * exp(-k * deviation²)).  
- Aggregate scores across corners.

### 4.2 Apex Detection

**Description:**  
Identifies whether the car hit the optimal apex and how far it deviated. The apex is defined as the point of minimum radius (closest approach to the inside curb) during a corner.

**Telemetry:** `PositionX/Y/Z`, `Steer`, `Yaw`.

**Output:**  
- Hit/Miss flag per corner.  
- Deviation distance (in meters) from the ideal apex.  
- Apex Accuracy percentage (hits / total corners).

**Implementation:**  
- Use corner segmentation to isolate the apex zone (e.g., the middle 30% of the corner).  
- Within that zone, find the point with the smallest lateral distance to the inside edge (using track boundary data).  
- Compare its longitudinal position to the expected apex position from the optimal line.  
- If the difference is within a threshold (e.g., 0.5 m longitudinally and 0.3 m laterally), mark as hit.

### 4.3 Track‑Out Monitor

**Description:**  
Measures how much of the available track width the driver uses at the exit of each corner. Using full track width maximises the corner radius and exit speed.

**Telemetry:** `PositionX/Y/Z`, `WheelOnRumbleStrip`.

**Output:**  
- Percentage of track width used (0–100%) for each corner exit.  
- Visual indicator (green = >90%, yellow = 70–90%, red = <70%).

**Implementation:**  
- At the track‑out point (defined as the point where the car’s path crosses the outer edge of the corner), compute the lateral distance from the inner edge.  
- Divide by the total track width at that location.  
- Use `WheelOnRumbleStrip` to confirm if the car is actually using the rumble strip (which extends the usable width).

### 4.4 Early / Late Apex Warning

**Description:**  
Alerts the driver when an apex is significantly earlier or later than the optimal apex. This is a critical feedback because early apexes cause understeer and loss of exit speed, while late apexes often indicate overcautious entry.

**Telemetry:** `PositionX/Y/Z`, `Steer`, `Yaw`.

**Output:**  
- Warning type: “Early Apex” or “Late Apex”.  
- Time delta (in seconds) lost due to the deviation.  
- Suggested correction: “Turn in 0.3s later” or “Brake 5 m later”.

**Implementation:**  
- Compare the actual apex longitudinal position to the optimal apex position.  
- If the actual apex is > 0.5 m earlier than optimal, flag as early; if > 0.5 m later, flag as late.  
- Estimate time loss by comparing the actual speed at apex vs. the optimal speed (using speed traces from the reference lap).

### 4.5 Corner‑by‑Corner Analysis

**Description:**  
A detailed table or dashboard showing all the above metrics for every corner on the track. It allows drivers to identify their strengths and weaknesses at a granular level.

**Output:**  
- For each corner: line score, apex hit/miss, track‑out percentage, timing deviation, and status (e.g., “optimal”, “early apex”, “late apex”).  
- Overall best corner and worst corner.

**Implementation:**  
- Aggregate per‑corner data from the sub‑features above.  
- Display in a sortable table with colour‑coded status indicators.

### 4.6 Line Deviation Map

**Description:**  
A visual overlay on a track map showing the driver’s actual line vs. the optimal line, with colour‑coded deviation hot spots.

**Output:**  
- SVG or canvas track map with two paths overlaid.  
- Deviation heatmap (e.g., red where the driver is more than 0.5 m off the optimal line).

**Implementation:**  
- Use `PositionX/Y/Z` data to plot the trajectory.  
- Project both the actual and optimal lines onto a 2D track map.  
- Compute perpendicular deviation at each sample point and colour the actual line accordingly.

### 4.7 Sector Analysis

**Description:**  
Breaks the lap into three or four sectors, showing line score and apex accuracy per sector. This helps drivers focus on problematic sections of the track.

**Output:**  
- Sector line scores and apex accuracies.  
- Sector time compared to reference.

**Implementation:**  
- Use predefined sector boundaries (e.g., from track map).  
- Compute aggregate metrics per sector.

### 4.8 Optimal Line Comparison (using NormalizedDrivingLine)

**Description:**  
Leverages the game’s own `NormalizedDrivingLine` value as a quick indicator, but augments it with the more precise positional analysis described above.

**Output:**  
- A correlation score between the game’s indicator and our calculated line score.  
- A hybrid confidence metric.

**Implementation:**  
- Store `NormalizedDrivingLine` at each telemetry sample.  
- Compare it with our computed line score for cross‑validation.  
- If the game’s line is available and reliable, it can serve as a fallback when position data is noisy.

---

## 5. Implementation Plan

### 5.1 Data Ingestion and Preprocessing

- **Collect UDP packets** in real time or from recorded sessions.  
- **Parse** the telemetry into a structured format (e.g., DataFrame).  
- **Interpolate** missing data if needed (the UDP stream is typically consistent).  
- **Filter** out non‑driving data (e.g., when `IsRaceOn == 0`).  
- **Smooth** position data using a moving average or Kalman filter to reduce noise.

### 5.2 Corner Detection and Segmentation

- **Approach A (Track Map):**  
  Use a pre‑defined track model (from a database) that contains corner start/end coordinates and optimal line points. This is the most accurate method.  
- **Approach B (Dynamic Detection):**  
  Analyse the steering angle (`Steer`) and yaw rate (`AngularVelocityY`) to detect when the car is turning. Group consecutive turning events into corners. This is more flexible but may be less precise.  
- **Recommended:** Combine both – use a track map for known circuits and dynamic detection as a fallback.

**Implementation Steps:**

1. Load track data (corners, optimal line points, track width).  
2. For each telemetry sample, determine its position relative to the track’s centre line.  
3. Using the steering input and lateral acceleration, identify the start and end of each corner.  
4. Assign each point to a corner ID.

### 5.3 Define Optimal Line

- **Option 1: Pre‑computed optimal line** – from a database of known tracks (ideal line from a pro driver or simulation).  
- **Option 2: Best Lap of the session** – use the driver’s own fastest lap as the reference, assuming it is representative.  
- **Option 3: AI or ghost line** – if available from the game, use that.  

In APEX, we will store optimal line data for major tracks in a JSON/GeoJSON format, including waypoints with target speeds.

### 5.4 Compute Metrics per Corner

For each corner, perform the following:

- **Line Score:**  
  - Sample N points along the actual path between turn‑in and track‑out.  
  - For each point, calculate the perpendicular distance to the optimal line.  
  - Compute the root‑mean‑square (RMS) of these distances.  
  - Convert to a score using a function:  
    `score = max(0, 100 * (1 - RMS / allowed_deviation))`, where allowed_deviation = 1.0 m (tunable).  

- **Apex Hit/Miss:**  
  - Find the point of minimum lateral distance to the inside edge within the corner’s middle zone.  
  - Compare to optimal apex position (defined in track data).  
  - If the distance is within 0.5 m, mark as hit.  

- **Track‑out Usage:**  
  - At the track‑out point (defined as the point where the car’s lateral position peaks towards the outside), compute the lateral position relative to the track width.  
  - Usage = (lateral_position / track_width) * 100.  

- **Early/Late Apex:**  
  - Compare the actual apex longitudinal position to the optimal apex position.  
  - If difference > 0.5 m, classify as early or late.  

### 5.5 Real‑time vs Post‑Session Analysis

- **Real‑time:**  
  - Use sliding window analysis to provide instant feedback (e.g., after each corner).  
  - Only show basic metrics (line score, apex warning) to avoid overwhelming the driver.  
- **Post‑session:**  
  - Full detailed report with all sub‑features, visualisations, and historical trends.  

### 5.6 UI/Visualisation

- **Track Map:**  
  - Use HTML5 Canvas or SVG to draw the track (based on waypoints).  
  - Overlay the actual line (blue) and optimal line (green).  
  - Mark apexes with dots (green for hit, yellow for miss).  
- **Dashboard Cards:**  
  - Four main metrics: Line Score, Apex Accuracy, Track‑out Usage, Apex Timing.  
  - Each with a progress bar and trend.  
- **Corner Table:**  
  - Sortable columns with colour‑coded status.  
- **Heatmap Overlay:**  
  - Colour the actual line based on deviation (red = high deviation).  

### 5.7 Integration with Other APEX Modules

- **Car Control Module:** uses slip angles and yaw to correlate line errors with understeer/oversteer.  
- **Braking Module:** uses brake points to evaluate if line errors are caused by braking too early/late.  
- **Tire Management Module:** uses tire temperatures and wear to see if line errors cause overheating.

---

## 6. Technical Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Noisy position data** | Apply a low‑pass filter or moving average. Use the game’s `Speed` and `Steer` to validate position changes. |
| **Corner detection accuracy** | Use a robust algorithm that considers steering angle, lateral acceleration, and track geometry. Fall back to the game’s `NormalizedDrivingLine` for validation. |
| **Optimal line definition** | For tracks without pre‑computed data, generate an optimal line using the best lap of the session, ensuring it’s a clean lap. |
| **Track width variability** | Obtain track width data from a curated database (e.g., from sim racing community resources). |
| **Real‑time performance** | Optimise computations to run within a few milliseconds per sample. Use simple heuristics for real‑time, and full analysis offline. |
| **Different car classes** | The optimal line may vary slightly with car (e.g., high downforce vs. low downforce). Provide multiple reference lines per track (e.g., for GT, Formula, etc.). |

---

## 7. Future Improvements

- **AI‑generated optimal line** using machine learning on telemetry from top drivers.  
- **Adaptive thresholds** – adjust apex tolerance and deviation thresholds based on the driver’s skill level.  
- **Corner type classification** – automatically identify hairpins, sweepers, etc., and apply different scoring weights.  
- **Voice coaching** – provide real‑time audio cues (e.g., “Turn in later for T5”).  
- **Integration with leaderboard data** – compare line scores against other APEX users.

---

## 8. Conclusion

The Line & Corner Analysis module transforms raw telemetry into meaningful, race‑craft focused insights. By systematically evaluating the racing line, apex accuracy, track‑out usage, and timing, APEX empowers drivers to make data‑driven improvements that directly translate to faster lap times. The implementation plan outlined above provides a clear path to building a robust, scalable, and user‑friendly feature that aligns perfectly with the principles of *Going Faster!*.