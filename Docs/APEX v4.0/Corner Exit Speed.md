# Corner Exit Speed Analysis

## 1. Introduction

**Corner Exit Speed Analysis** is a cornerstone module of the **APEX** sim racing telemetry application. In *Going Faster! Mastering the Art of Race Driving*, the authors emphasise that **corner exit speed is the single most important factor for lap time**—because it directly determines the speed carried onto the following straight, where the car spends the majority of the lap. A gain of just 1 mph at corner exit can translate into a 0.15 second advantage by the end of a long straight.

The module focuses on the driver’s ability to blend acceleration and cornering forces as they exit a turn, maximising the car’s velocity at the track‑out point. It provides actionable feedback on throttle application, traction management, gear selection, and car control—all to help drivers get the power down earlier, smoother, and more effectively.

---

## 2. Core Concepts

| Term | Definition |
|------|------------|
| **Corner Exit Speed** | The car’s speed at the track‑out point, or more generally, the speed at which the car begins its full‑throttle run onto the following straight. |
| **Throttle Application Point** | The point in the corner where the driver transitions from braking to applying power. Earlier application usually yields higher exit speed, provided the car can maintain its line. |
| **Wheelspin** | When the driven wheels rotate faster than the car’s ground speed, causing a loss of longitudinal grip and excessive tyre wear. |
| **Power Oversteer** | Oversteer caused by aggressive throttle application, where the rear tyres lose lateral grip and the rear slides out. |
| **Traction Loss** | A general term for when the tyre’s combined slip exceeds the available grip, resulting in either wheelspin (longitudinal) or sliding (lateral). |
| **Tyre Scrub** | The drag created by running a tyre at a large slip angle, which reduces acceleration efficiency. |
| **Optimal Slip Ratio** | For acceleration, peak longitudinal grip occurs at around 15% slip (i.e., the tyre is rotating 15% faster than free‑rolling). Beyond this, grip falls off. |
| **Unwinding the Steering** | The gradual reduction of steering lock as the car exits a corner, allowing the radius to increase as speed rises. |
| **Gear Selection** | Choosing the correct gear to keep the engine in its power band throughout the exit. |

---

## 3. Telemetry Dependencies

The following FM23 UDP fields (Dash structure) are essential for this module:

| Field | Usage |
|-------|-------|
| `Speed` (F32) | The primary metric – exit speed at track‑out. |
| `Accel` (U8) | Throttle input – used to assess throttle application timing and aggressiveness. |
| `Steer` (S8) | Steering input – indicates when the driver is unwinding the wheel. |
| `PositionX/Y/Z` (F32) | Global position – to locate track‑out points and compute distance travelled. |
| `TireSlipRatioFL/FR/RL/RR` (F32) | Longitudinal slip – primary indicator of wheelspin or traction loss. |
| `TireSlipAngleFL/FR/RL/RR` (F32) | Lateral slip – indicates tyre scrub and potential oversteer. |
| `TireCombinedSlipFL/FR/RL/RR` (F32) | Combined slip magnitude – a comprehensive measure of traction usage. |
| `TireTempFront/Rear` (F32) | Tyre temperatures – excessive slip increases temperature, degrading grip. |
| `TireWearFront/Rear` (F32) | Tyre wear – helps correlate aggressive exits with tyre degradation. |
| `Power` (F32) | Current engine power output – useful for assessing if full power is being utilised. |
| `CurrentEngineRpm` (F32) | Engine RPM – to evaluate gear selection and shift points. |
| `Gear` (U8) | Current gear – to identify if the driver is in the optimal gear for the corner. |
| `DrivetrainType` (S32) | FWD, RWD, or AWD – influences how throttle affects handling. |
| `AccelerationZ` (F32) | Longitudinal acceleration – provides direct measurement of acceleration rate. |
| `Yaw` (F32) | Yaw angle – helps detect oversteer during power application. |
| `NormalizedSuspensionTravel` (F32) | Indicates weight transfer during acceleration (rear squat). |
| `LapNumber`, `CurrentLap`, `BestLap` | Lap context for session‑long exit speed trends. |

---

## 4. Sub‑Features

### 4.1 Exit Speed Comparison

**Description:**  
Compares the driver’s corner exit speed (at the track‑out point) against a reference lap (the driver’s best lap, a teammate’s lap, or a pre‑computed ideal). This is the most direct metric for evaluating exit performance.

**Telemetry:** `Speed`, `PositionX/Y/Z`.

**Output:**  
- For each corner, the exit speed (in m/s or km/h) and the delta vs. reference.  
- A list of corners where the driver is losing the most time.  
- An overall “Exit Speed Score” (0–100%) based on the average deltas.

**Implementation:**  
- Use corner segmentation (from Line & Corner Analysis) to identify the track‑out point for each corner (where the car’s lateral position peaks outward).  
- Record `Speed` at that point.  
- Compare to the reference lap’s speed at the same track‑out location.  
- Score = 100 × (1 – (reference_speed – actual_speed) / reference_speed) (capped at 100).  
- Provide a rank‑ordered list of corners by time lost.

### 4.2 Throttle Application Scoring

**Description:**  
Evaluates the smoothness and timing of throttle application after the braking phase. A good throttle application is progressive, avoiding abrupt inputs that cause wheelspin or oversteer.

**Telemetry:** `Accel`, `Speed`, `TireSlipRatio`, `Steer`, `Yaw`.

**Output:**  
- A throttle application score (0–100%) for each corner.  
- A graph showing throttle input over time, annotated with key events (turn‑in, apex, track‑out).  
- Recommendations: “Apply throttle earlier” or “Squeeze more gradually”.

**Implementation:**  
- For each corner, from the throttle application point to track‑out, collect `Accel` values.  
- Compute the derivative of throttle (rate of change). High rates indicate abrupt inputs.  
- Also compute the correlation between throttle increase and steering unwinding (i.e., as throttle rises, steering should decrease).  
- Score = 100 × (1 – (RMS_derivative / max_acceptable_derivative)) × correlation_factor.  
- Provide a time‑series visual.

### 4.3 Power Oversteer Warning

**Description:**  
Detects when excessive throttle causes the rear axle to lose lateral grip, indicated by a high rear slip angle or yaw rate that exceeds steering input. This warns the driver that they are “lighting up the rear tyres.”

**Telemetry:** `TireSlipAngleRearLeft/Right`, `Yaw`, `Steer`, `Accel`.

**Output:**  
- A flag per corner: “Power Oversteer Detected” or “Clean Exit”.  
- A severity score (0–100%).  
- A recommendation: “Reduce throttle by 10%” or “Apply throttle earlier with less aggression”.

**Implementation:**  
- During acceleration phase, compare the actual yaw rate (from `AngularVelocityY` or derived from `Yaw`) to the expected yaw from steering input (using a simple bicycle model).  
- If actual yaw exceeds expected by more than a threshold (e.g., 15%), and `Accel` is high, flag as power oversteer.  
- Also check rear slip angles: if any rear `TireSlipAngle` > 1.0 (loss of grip), flag.  
- Provide a real‑time warning.

### 4.4 Traction Loss Detection (Wheelspin)

**Description:**  
Identifies when the driven wheels are spinning excessively, causing loss of longitudinal traction and wasting rubber. Optimal acceleration occurs at ~15% slip; anything above that is inefficient.

**Telemetry:** `TireSlipRatioRearLeft/Right` (or front for FWD/AWD).

**Output:**  
- A traction loss score (0–100%) for each exit.  
- A count of “wheelspin events” per lap.  
- A recommendation: “Modulate throttle to reduce slip to 15%”.

**Implementation:**  
- For each corner, during the acceleration phase, compute the average rear slip ratio.  
- Compare to the optimal value (0.15).  
- Score = 100 × (1 – (|avg_slip – 0.15| / 0.15)) (capped at 0 if avg_slip > 0.30).  
- Flag if any rear slip ratio exceeds 0.30 (severe wheelspin).  
- Provide a time‑series graph of slip ratio vs. throttle.

### 4.5 Gear Shift Analysis

**Description:**  
Evaluates whether the driver is using the optimal gear for the corner exit. Incorrect gearing can cause the engine to bog (too high gear) or rev too high (too low gear), both reducing acceleration.

**Telemetry:** `Gear`, `CurrentEngineRpm`, `Speed`, `EngineMaxRpm`, `EngineIdleRpm`.

**Output:**  
- A gear recommendation per corner (e.g., “Use 3rd gear instead of 2nd”).  
- A shift point analysis (at what RPM the driver upshifts).  
- A score for gear utilisation (0–100%).

**Implementation:**  
- For each corner, record the gear used at the throttle application point and at track‑out.  
- Compute the average RPM during the exit phase.  
- Compare to the engine’s power band (e.g., 80–100% of max RPM).  
- If the average RPM is below 70% of max, suggest a lower gear; if it consistently hits the rev limiter, suggest a higher gear.  
- Also evaluate upshift timing: if the driver shifts too early (before peak power) or too late (hitting the limiter), provide feedback.

### 4.6 Throttle‑Steer Correlation (Unwinding)

**Description:**  
Measures how well the driver synchronises throttle application with steering reduction. As throttle increases, steering should gradually decrease to match the increasing radius. A poor correlation often leads to understeer or oversteer.

**Telemetry:** `Accel`, `Steer`.

**Output:**  
- A correlation coefficient (‑1 to 1) per corner, ideally close to ‑1 (steer decreases as throttle increases).  
- A score based on the correlation.

**Implementation:**  
- For the exit phase, collect `Accel` and `Steer` (normalised to [0,1] for steer magnitude).  
- Compute Pearson correlation.  
- Score = 100 × (1 + correlation) / 2 (so that ‑1 -> 0, 0 -> 50, +1 -> 100).  
- Provide a scatter plot for visual inspection.

### 4.7 Tyre Temperature Impact on Exit Speed

**Description:**  
Correlates exit speed with tyre temperatures to detect if the driver is overheating tyres due to excessive slip, causing a drop in grip and exit speed over a stint.

**Telemetry:** `TireTempFront/Rear`, `Speed`, `TireSlipRatio`.

**Output:**  
- A heatmap showing exit speed vs. tyre temperature.  
- A warning when tyre temperatures exceed the optimal window (e.g., > 240°F for slicks).  
- A suggestion: “Tyre temperature too high – reduce wheelspin to preserve grip”.

**Implementation:**  
- Over multiple laps, record exit speed and tyre temperature for each corner.  
- Compute the moving average of exit speed over a stint.  
- If a significant drop in exit speed coincides with rising tyre temperatures, flag the corner.  
- Provide a trend graph.

### 4.8 Exit Speed Consistency Monitor

**Description:**  
Tracks the variation in exit speed across laps, helping drivers identify if they are inconsistent in their corner exits.

**Telemetry:** `Speed`, `PositionX/Y/Z`, `LapNumber`.

**Output:**  
- A consistency score (0–100%) for each corner and overall.  
- A graph showing exit speed variation over laps.  
- A flag for corners with high variability.

**Implementation:**  
- For each corner, record the exit speed for every lap.  
- Compute the standard deviation.  
- Score = 100 × (1 – (std_dev / average_speed)).  
- Highlight corners where std_dev > 2% of average.

### 4.9 Optimal Line vs. Exit Speed

**Description:**  
Correlates exit speed with the driver’s line (from the Line & Corner Analysis module). A poor line (e.g., early apex) often forces the driver to delay throttle application, reducing exit speed.

**Telemetry:** `Speed`, `PositionX/Y/Z`, `Steer`.

**Output:**  
- A scatter plot: line score vs. exit speed.  
- A recommendation: “Improve line to increase exit speed by X mph”.

**Implementation:**  
- Use the line score from the Line module for each corner.  
- Plot exit speed against line score.  
- Compute the correlation.  
- If line score is low and exit speed is low, suggest working on line first (since line determines exit potential).

### 4.10 Acceleration Phase Analysis (Friction Circle)

**Description:**  
Visualises the driver’s usage of the friction circle during the exit phase. An optimal exit keeps the resultant force (lateral + longitudinal) on the circle’s boundary, maximising acceleration without losing grip.

**Telemetry:** `AccelerationX` (lateral), `AccelerationZ` (longitudinal), `Speed`.

**Output:**  
- A friction circle plot for the exit phase, with the trajectory coloured by time.  
- An indication of how close the driver stays to the grip limit.  
- A score based on the area under the circle curve.

**Implementation:**  
- For the exit phase, collect lateral and longitudinal G‑forces (`AccelerationX` and `AccelerationZ`).  
- Plot them on a 2D graph.  
- Compute the radius of the resultant vector; compare to the car’s peak grip (from telemetry or model).  
- Score = 100 × average(resultant / peak_grip) (capped at 100).  
- Provide insights: “You are using 85% of available grip – you can apply more throttle.”

### 4.11 Shift‑to‑Throttle Smoothness

**Description:**  
Evaluates the quality of upshifts during the exit phase, specifically the throttle lift and re‑application. A jerky upshift can unsettle the car and lose time.

**Telemetry:** `Accel`, `Gear`, `Clutch`, `Speed`, `TireSlipRatio`.

**Output:**  
- A shift smoothness score (0–100%).  
- A graph showing throttle, gear, and speed during the shift.  
- Recommendations: “Lift throttle less on upshifts” or “Shift faster to maintain acceleration”.

**Implementation:**  
- Detect upshift events (when `Gear` increases).  
- For each shift, measure the time the throttle is at zero (or reduced) and the rate of re‑application.  
- Also check if the shift causes any spike in slip ratio (indicating a jerky engagement).  
- Score = 100 × (1 – (shift_time / max_acceptable_shift_time)) × (1 – slip_spike_factor).

---

## 5. Implementation Plan

### 5.1 Data Preprocessing

- Parse UDP packets (Dash structure) in real time or from stored sessions.
- Filter out non‑racing data (`IsRaceOn == 0`).
- Smooth `Speed`, `Accel`, and `Steer` with a moving average (window size 3–5 samples).
- Compute derived values: acceleration G (`AccelerationZ`), lateral G (`AccelerationX`), and slip ratios.

### 5.2 Corner Segmentation (shared)

- Use the corner definitions from the Line & Corner Analysis module to identify each corner’s start, apex, and track‑out points.
- The track‑out point is defined as the point where the car’s lateral position relative to the track centre is at a maximum (or the car reaches the outer edge).

### 5.3 Extract Exit Phase

- For each corner, define the exit phase as the segment from the throttle application point to the track‑out point.
- The throttle application point is detected when `Accel` rises from near zero to a positive value after the braking phase.

### 5.4 Compute Core Metrics

- **Exit Speed:** Use `Speed` at the track‑out point.
- **Throttle Application Timing:** The longitudinal distance from apex to throttle application point – earlier is generally better.
- **Slip Ratios:** Average rear slip ratio (for RWD) or front (for FWD) during the exit phase.
- **Steer Unwinding:** Compute correlation between `Steer` magnitude and `Accel` over the exit phase.

### 5.5 Reference Lap Selection

- Use the driver’s **best lap** of the session as the reference (if available) or a pre‑recorded “ideal” lap from a pro driver.
- For each corner, extract the reference exit speed, throttle application point, and slip ratios.

### 5.6 Scoring

- Each sub‑feature produces a score (0–100%) and a recommendation.
- A composite **Exit Speed Score** can be computed as a weighted average:
  - Exit Speed Delta (40%)
  - Throttle Application Smoothness (20%)
  - Traction Usage (20%)
  - Gear Optimisation (10%)
  - Steer‑Throttle Correlation (10%)

### 5.7 Real‑time vs. Post‑Session

- **Real‑time:** Provide immediate feedback after each corner (e.g., “Good exit – speed +2 mph”, “Wheelspin – reduce throttle”).
- **Post‑session:** Generate detailed reports, graphs, and trend analysis.

### 5.8 Visualisation

- **Time‑series graphs** for throttle, slip ratio, and speed during the exit phase.
- **Track map overlay** showing exit speeds for each corner (colour‑coded).
- **Friction circle** for the exit phase.
- **Scatter plots** for line score vs. exit speed.

### 5.9 Integration with Other Modules

- **Line & Corner Analysis:** Provides corner definitions and line scores; used to correlate line quality with exit speed.
- **Car Control Module:** Oversteer/understeer detection during exit feeds into car control feedback.
- **Tire Management Module:** Tyre temperature and wear data help explain exit speed degradation over a stint.

---

## 6. Technical Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Noise in `Speed`** | Smoothing with a low‑pass filter; use `Speed` from the game (which is already filtered). |
| **Detecting throttle application point** | Use a threshold (e.g., `Accel` > 10% of max) and verify with speed increase. |
| **Reference lap availability** | Use the driver’s own best lap; if insufficient laps, use a pre‑computed ideal. |
| **Different track layouts** | Corner definitions must be accurate; use a database of track corner waypoints. |
| **Car class differences** | Optimal slip ratio may vary; use adaptive thresholds based on tyre type and car class. |
| **Real‑time performance** | Limit real‑time analysis to a subset of metrics (exit speed, wheelspin warning, oversteer flag). |

---

## 7. Future Improvements

- **Machine learning** to predict optimal exit speed based on entry speed, line, and car state.
- **Voice coaching** for real‑time throttle application suggestions.
- **Comparison with cloud‑based pro laps** for benchmark exit speeds.
- **Predictive exit speed** – using AI to suggest a target exit speed for each corner based on current grip and fuel load.
- **Automated gear recommendation** based on engine power curve and corner speed.

---

## 8. Conclusion

The Corner Exit Speed Analysis module is designed to help drivers unlock the most valuable part of the lap – the acceleration from apex to the next braking zone. By providing granular feedback on throttle application, traction management, gear selection, and car balance, APEX enables drivers to consistently achieve higher exit speeds. As *Going Faster!* teaches, **exit speed is king**, and this module gives drivers the tools to rule the straights.