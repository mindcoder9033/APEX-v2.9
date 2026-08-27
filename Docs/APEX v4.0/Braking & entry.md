# Braking & Entry Analysis

## 1. Introduction

**Braking & Entry Analysis** is a critical module of the **APEX** sim racing telemetry application. It focuses on the third cornerstone of fast lap times, as described in *Going Faster! Mastering the Art of Race Driving*: **braking and entering**. While the racing line and corner exit speed often yield the biggest initial gains, the braking zone is where the final tenths of a second are found—and where races are won or lost.

The module helps drivers master the four building blocks of corner entry:

1. **Throttle‑Brake Transition** – how quickly and smoothly the driver moves from full throttle to braking.
2. **Straight‑Line Deceleration** – the ability to threshold brake at the maximum possible rate.
3. **Brake‑Turn (Trail‑Braking)** – the skill of blending braking and cornering forces.
4. **Brake‑Throttle Transition** – the smooth handover from brakes to power.

By analysing telemetry from Forza Motorsport (FM23), APEX provides detailed feedback on braking technique, helping drivers brake later, more consistently, and with better car balance—ultimately reducing lap times.

---

## 2. Core Concepts

| Term | Definition |
|------|------------|
| **Threshold Braking** | Braking at the maximum possible rate, where the tyres are operating at ~15% slip (just before lockup). |
| **Brake Point** | The specific reference point on the track where the driver first applies the brakes. |
| **Trail‑Braking** | Continuing to brake after turn‑in, blending deceleration with cornering forces. |
| **Brake Modulation** | The fine control of brake pedal pressure to keep the tyres at their optimal slip ratio, avoiding lockup or under‑utilisation. |
| **Friction Circle** | A graphical representation of a tyre’s available grip, showing the trade‑off between longitudinal (braking/accel) and lateral (cornering) forces. |
| **Brake Bias** | The proportion of braking force allocated to the front versus rear axles. |
| **Throttle Application Point** | The point in the corner where the driver transitions from braking to applying power. |
| **Overslowing** | Braking too much, resulting in a lower corner entry speed and lost time. |

---

## 3. Telemetry Dependencies

The following FM23 UDP fields (Dash structure) are essential for this module:

| Field | Usage |
|-------|-------|
| `Brake` (U8) | Brake input (0–255) – primary indicator of braking force. |
| `Speed` (F32) | Current vehicle speed – used to compute deceleration rates and entry speeds. |
| `PositionX/Y/Z` (F32) | Global position – for locating brake points and assessing braking zone distances. |
| `Accel` (U8) | Throttle input – used to detect throttle‑brake transitions and brake‑throttle transitions. |
| `Steer` (S8) | Steering input – crucial for detecting turn‑in and assessing trail‑braking. |
| `TireSlipRatioFL/FR/RL/RR` (F32) | Indicates the percentage of slip during braking (0 = free rolling, 1.0 = lockup). |
| `TireSlipAngleFL/FR/RL/RR` (F32) | Indicates lateral slip; used in friction circle analysis. |
| `TireCombinedSlipFL/FR/RL/RR` (F32) | Combined slip magnitude; indicates overall tyre grip usage. |
| `AccelerationX/Y/Z` (F32) | Longitudinal and lateral G‑forces – compute deceleration rates and friction circle. |
| `Yaw`, `Pitch`, `Roll` (F32) | Car attitude – helps correlate braking with chassis pitch and roll. |
| `WheelOnRumbleStripFL/FR/RL/RR` (S32) | Detects when the car is on rumble strips, often used as brake point references. |
| `WheelInPuddleDepth` (F32) | Indicates water depth – important for wet weather braking analysis. |
| `TireTemp` (F32) | Tyre temperatures – affects grip and braking performance. |
| `TireWear` (F32) | Tyre wear – changes braking capability over a stint. |
| `CurrentLap`, `BestLap`, `LapNumber` | Lap context for session‑long braking consistency. |
| `Gear` (U8) | Gear selection – downshifts affect engine braking and rear tyre slip. |

---

## 4. Sub‑Features

### 4.1 Threshold Braking Indicator

**Description:**  
Evaluates whether the driver is achieving the maximum deceleration rate in straight‑line braking zones. It compares the actual tyre slip ratios and deceleration G‑forces against theoretical optimal values.

**Telemetry:** `Brake`, `Speed`, `TireSlipRatio`, `AccelerationZ` (longitudinal), `TireCombinedSlip`.

**Output:**  
- A score (0–100%) indicating how close the driver is to threshold braking.  
- A flag: “Optimal”, “Under‑braking” (not enough pressure), or “Lockup” (excessive pressure).  
- A suggested pedal pressure adjustment (e.g., “Increase brake pressure by 5%”).

**Implementation:**  
- Detect straight‑line braking zones where `Steer` is near zero and `Brake` > 0.  
- Compute the average longitudinal deceleration (from `AccelerationZ`) and the average tyre slip ratio (front and rear).  
- Ideal threshold occurs when slip ratio is around 0.15 (15%) and deceleration is at its peak.  
- Score = 100 × (1 – (|actual_slip – 0.15| / 0.15)) capped at 100.  
- Flag lockup if any `TireSlipRatio` exceeds 0.95 (near lock).

### 4.2 Trail‑Braking Score

**Description:**  
Measures the driver’s ability to smoothly blend braking and cornering forces after turn‑in, as described by the friction circle. A good trail‑brake maintains the tyre at the edge of the friction circle, maximising entry speed.

**Telemetry:** `Brake`, `Steer`, `AccelerationX` (lateral), `AccelerationZ` (longitudinal), `TireSlipAngle`, `TireCombinedSlip`, `Yaw`.

**Output:**  
- A score (0–100%) quantifying how well the driver trail‑brakes.  
- A graph showing the brake pedal pressure vs. steering angle over the corner entry.  
- A friction circle plot with the actual trajectory (braking vs. cornering forces) overlaid on the ideal circle.

**Implementation:**  
- For each corner, identify the segment from turn‑in point to the throttle application point.  
- Compute the ratio of brake pressure to steering angle over this segment.  
- An ideal trail‑brake shows a gradual reduction of brake pressure as steering increases (or vice versa), keeping the resultant force near the friction circle boundary.  
- Score based on the RMS error from the ideal curve (a linear or exponential decay model).  
- Provide visual feedback with a friction circle (lateral G vs. longitudinal G) coloured by time, and highlight areas where the driver exceeded the circle (over‑braking) or stayed well inside (under‑utilising).

### 4.3 Brake Point Optimizer

**Description:**  
Suggests earlier or later brake points based on the car’s performance and the driver’s ability. It uses the driver’s own braking performance and a reference lap (or an AI‑generated ideal) to recommend adjustments.

**Telemetry:** `Brake`, `Speed`, `PositionX/Y/Z`, `CurrentLap`, `BestLap`.

**Output:**  
- For each corner, a recommended change in brake point (e.g., “Brake 5 m later”).  
- A confidence level based on the driver’s consistency and tyre condition.  
- A time gain estimate if the recommendation is followed.

**Implementation:**  
- Detect the brake point for each corner (the first sample where `Brake` > threshold and speed starts decreasing).  
- Compute the distance from brake point to turn‑in point.  
- Compare to the reference brake point (from the driver’s best lap or a pre‑computed ideal).  
- If the driver is consistently early, suggest moving the brake point later (in small increments, e.g., 2 m per lap).  
- If the driver is consistently late but has lower entry speed than the reference, suggest braking earlier to improve corner speed.  
- Provide a historical trend to show improvement.

### 4.4 Brake Modulation Graph

**Description:**  
A real‑time or post‑session graph showing the brake pedal pressure (or input value) over time, annotated with key events: turn‑in, downshift blips, and throttle application. This helps drivers see smoothness and identify jerky releases.

**Telemetry:** `Brake`, `Speed`, `Steer`, `Gear`, `Clutch`, `Accel`.

**Output:**  
- A time‑series graph with brake input (0–255) on the y‑axis.  
- Overlays showing throttle, steering, and gear changes.  
- Metrics: peak pressure, time from 0 to peak, release time, number of blips, etc.  
- A smoothness score (0–100%) based on the derivative of brake pressure.

**Implementation:**  
- Collect brake input at each telemetry sample.  
- Smooth the data with a low‑pass filter to remove noise.  
- Identify key points: start of braking, peak pressure, turn‑in (steering increase), downshift blips (clutch dips with throttle blips), throttle application.  
- Compute the derivative (rate of change) of brake pressure. High rates indicate abruptness.  
- Calculate smoothness as 100 × (1 – RMS_derivative / max_derivative_threshold).  
- Display the graph interactively.

### 4.5 Brake‑Throttle Transition Analysis

**Description:**  
Evaluates the transition from braking to throttle application. A smooth, well‑timed transition allows early power application without upsetting the car’s balance.

**Telemetry:** `Brake`, `Accel`, `Speed`, `TireSlipRatio`, `Yaw`.

**Output:**  
- Transition time (from brake release to throttle application).  
- A “Pause” detection – if there is a gap between brake release and throttle application (which can cause trailing‑throttle oversteer).  
- A score for smoothness (0–100%).  
- Recommendation: “Apply throttle immediately after brake release” or “Pause slightly to help rotation”.

**Implementation:**  
- For each corner, find the point where `Brake` drops to near zero and the point where `Accel` increases above a threshold.  
- Compute the time difference.  
- If the difference is positive (brake release before throttle), it’s a pause. Too long a pause (>0.2s) may be suboptimal.  
- If throttle starts before brake is fully released (overlap), that indicates aggressive trail‑braking – score higher for small overlap.  
- Compare to the reference driver for optimal timing.

### 4.6 Overslowing Detection

**Description:**  
Identifies corners where the driver slows down too much relative to the car’s potential, leading to unnecessary time loss. This is common when drivers are over‑cautious at the entry.

**Telemetry:** `Speed`, `PositionX/Y/Z`, `CurrentLap`, `BestLap`.

**Output:**  
- A list of corners where the minimum speed is significantly below the reference.  
- A recommended speed increase (e.g., “Carry 2 m.p.h. more through T3”).  
- A confidence level based on the driver’s line consistency.

**Implementation:**  
- For each corner, record the minimum speed reached (usually near the apex or at the throttle application point).  
- Compare to the reference lap’s minimum speed for that corner.  
- If the driver’s speed is more than 3% lower, flag as overslowing.  
- Suggest incremental speed increases (e.g., 1 m.p.h. per lap).

### 4.7 Brake Bias Recommendation

**Description:**  
Provides feedback on brake bias settings based on the observed front/rear locking tendency and tyre temperatures.

**Telemetry:** `TireSlipRatioFrontLeft/Right`, `TireSlipRatioRearLeft/Right`, `TireTempFront/Rear`, `Brake`.

**Output:**  
- A suggestion to shift bias forward or rearward.  
- An indication of whether the current bias is optimal for the track conditions.

**Implementation:**  
- During hard braking (straight‑line), compare the front and rear slip ratios.  
- If front slip ratios are consistently higher (closer to lock), the bias is too far forward; suggest moving rearward.  
- Conversely, if rear slip ratios are higher, suggest moving forward.  
- Also consider tyre temperatures: if fronts are hotter than rears, forward bias may be overheating fronts.

### 4.8 Wet Weather Braking

**Description:**  
Adapts braking analysis for wet conditions, accounting for reduced grip, hydroplaning risk, and the need for earlier, smoother braking.

**Telemetry:** `WheelInPuddleDepth`, `TireSlipRatio`, `Speed`, `Brake`.

**Output:**  
- A wet braking score.  
- Warnings for potential hydroplaning (when puddle depth > 0.5 and speed > 80 km/h).  
- Recommended adjustments: “Brake 10 m earlier”, “Reduce brake pressure by 10%”.

**Implementation:**  
- Detect wet conditions by checking if `WheelInPuddleDepth` is > 0 on any wheel.  
- Adjust the threshold for ideal slip ratio (lower in wet, e.g., 0.10).  
- Provide modified brake point recommendations.

### 4.9 Brake Consistency Monitor

**Description:**  
Tracks the consistency of brake points and deceleration rates across laps, helping drivers identify if they are varying their braking.

**Telemetry:** `Brake`, `Speed`, `PositionX/Y/Z`, `LapNumber`.

**Output:**  
- A variability score (standard deviation of brake point positions and deceleration).  
- A trend graph showing brake point movement over laps.  
- A flag if inconsistency is high (e.g., > 2 m variation in brake point).

**Implementation:**  
- Over multiple laps, record the brake point distance from turn‑in for each corner.  
- Compute the standard deviation.  
- Also compute the variation in maximum deceleration.  
- Provide a heatmap showing which corners have the highest variability.

### 4.10 Brake‑Turn Balance (using Yaw and Load Transfer)

**Description:**  
Analyses how braking affects yaw and load transfer, helping drivers understand if they are inducing oversteer or understeer under braking.

**Telemetry:** `Yaw`, `Pitch`, `Roll`, `NormalizedSuspensionTravel`, `Brake`, `Steer`.

**Output:**  
- A balance score indicating if the car is neutral, oversteery, or understeery during trail‑braking.  
- Recommendations: “Reduce brake pressure on entry to settle rear” or “Apply more brake to help rotation”.

**Implementation:**  
- Correlate brake pressure with yaw rate during trail‑braking.  
- If yaw rate exceeds expected from steering input, that indicates oversteer – likely due to rear brake bias or abrupt release.  
- Use suspension travel to infer weight transfer, and suggest adjustments.

---

## 5. Implementation Plan

### 5.1 Data Preprocessing

- Parse UDP packets in real time or from recorded sessions.
- Filter out invalid samples (e.g., `IsRaceOn == 0`).
- Apply a low‑pass filter to `Brake`, `Speed`, and `AccelerationZ` to reduce noise.
- Compute derived quantities: deceleration (ΔSpeed/Δt), longitudinal G (`AccelerationZ`), lateral G (`AccelerationX`).

### 5.2 Corner Segmentation (shared with Line module)

- Identify corners using steering input and track geometry (pre‑defined track map).
- For each corner, define:
  - Braking zone start (point where speed starts decreasing due to braking).
  - Turn‑in point (where `Steer` exceeds a threshold).
  - Apex point.
  - Throttle application point (where `Accel` increases from near zero).

### 5.3 Threshold Braking Indicator

- For each straight‑line braking zone (where `Steer` is near zero and `Brake` > 0):
  - Compute average `TireSlipRatio` (front and rear).
  - Compute average deceleration (from `Speed` or `AccelerationZ`).
  - Compare to ideal slip ratio (0.15) and ideal deceleration for the car (from telemetry or model).
  - Score = 100 * (1 - (|avg_slip - 0.15| / 0.15)).
  - If any wheel slip > 0.95, flag lockup.

### 5.4 Trail‑Braking Score

- For each corner, from turn‑in to throttle application:
  - Collect `Brake`, `Steer`, `AccelerationX`, `AccelerationZ`.
  - Normalise brake and steer to [0,1].
  - Compute the correlation between brake reduction and steer increase.
  - Score = 100 * correlation_coefficient (if negative, lower score).
  - Also compute the average lateral G vs. longitudinal G ratio; compare to friction circle.
  - Provide a friction circle plot (lateral G vs. longitudinal G) using `AccelerationX` and `AccelerationZ`.

### 5.5 Brake Point Optimizer

- For each lap, record the distance from a fixed reference (e.g., start/finish line or nearest rumble strip) to the brake point.
- Compare to the driver’s best lap (or a reference lap).
- If the driver’s brake point is > 2 m earlier, suggest moving later.
- If the driver’s entry speed is lower than reference despite similar brake point, suggest braking earlier to improve entry speed.
- Provide incremental suggestions (2 m changes).

### 5.6 Brake Modulation Graph

- Build a time‑series graph:
  - x‑axis: time (or distance).
  - y‑axis: `Brake` input (0‑255).
  - Overlay `Accel`, `Steer`, `Gear` as separate traces.
- Automatically annotate key events: brake application, downshift blips (when `Clutch` dips and `Accel` blips), turn‑in, throttle application.
- Compute smoothness = 100 * (1 - RMS_derivative / 20), where 20 is a typical max derivative threshold.

### 5.7 Brake‑Throttle Transition

- Detect brake release point (`Brake` drops below 5% of max).
- Detect throttle application point (`Accel` rises above 5%).
- Compute transition time.
- If > 0.2s, flag as “pause” and suggest reducing pause.
- If throttle starts before brake fully released (overlap), score higher for smoothness.

### 5.8 Overslowing Detection

- For each corner, compare minimum speed (at apex or throttle application) to the reference lap’s minimum.
- If driver’s speed is < 97% of reference, mark as overslowing.
- Provide a speed increase recommendation (e.g., “Target +2 m.p.h.”).

### 5.9 Brake Bias Recommendation

- During straight‑line braking, compare average front vs. rear slip ratios.
- If front > rear + 0.05, suggest moving bias rearward.
- If rear > front + 0.05, suggest moving forward.
- Also consider tyre temperatures: if fronts are > 10°C hotter, bias may be too forward.

### 5.10 Wet Weather Adaptations

- Detect puddle depths: if any `WheelInPuddleDepth` > 0.3 and speed > 80 km/h, activate wet mode.
- Adjust threshold slip ratio to 0.10.
- Adjust brake point recommendations to be earlier (e.g., +5 m).
- Provide hydroplaning warnings.

### 5.11 Brake Consistency Monitor

- For each corner, collect brake point positions across multiple laps.
- Compute standard deviation.
- If > 1.5 m, flag as inconsistent.
- Show a graph of brake point movement over laps.

### 5.12 Brake‑Turn Balance

- During trail‑braking, compute yaw rate vs. expected yaw from steering (using a simple bicycle model or the game’s yaw rate).
- If actual yaw rate > expected, indicate oversteer; suggest reducing brake pressure or changing bias.
- If actual yaw rate < expected, indicate understeer; suggest more trail‑brake or less steering input.

---

## 6. Integration with Other APEX Modules

- **Line & Corner Analysis**: Brake points and entry speeds are influenced by line choice. The two modules can share corner segmentation and reference data.
- **Car Control Module**: Oversteer/understeer detection during trail‑braking feeds into car control analysis.
- **Tire Management Module**: Braking technique affects tyre temperatures and wear; recommendations can be cross‑referenced.
- **Race Strategy Module**: Brake consistency and tyre condition influence pit stop and fuel strategy.

---

## 7. Technical Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Brake input is discrete (0–255)** | Treat as continuous by scaling; use smoothing. |
| **No direct brake pressure sensor** | Use `Brake` value as a proxy; calibrate using deceleration. |
| **Lockup detection false positives** | Consider `TireSlipRatio` and `TireCombinedSlip` together; lockup is when slip > 0.95. |
| **Varying track conditions** | Use relative comparisons (vs. reference lap) rather than absolute thresholds. |
| **Different car brake performance** | Adaptive thresholds based on car class and tyre compound (from `CarClass`, `TireTemp`). |
| **Real‑time performance** | Use efficient algorithms; pre‑compute reference data; limit real‑time analysis to key metrics (threshold braking, trail‑braking score). |
| **Downshift blips causing noise** | Ignore short‑duration brake pressure drops (by filtering). |

---

## 8. Future Improvements

- **Machine learning** to classify brake points and trail‑braking styles, and provide personalised coaching.
- **Predictive braking** – use AI to anticipate optimal brake points based on upcoming track geometry and car state.
- **Brake pressure mapping** – if the game provides a pressure value (not just 0‑255), use it directly.
- **Integration with telemetry from multiple cars** – allow comparison against a library of pro driver laps.
- **Voice coaching** – real‑time audio alerts for brake point adjustments, overslowing, etc.

---

## 9. Conclusion

The Braking & Entry Analysis module is designed to turn the complex art of braking into measurable, improvable skills. By focusing on the four building blocks of corner entry, and by leveraging the rich telemetry from FM23, APEX gives drivers clear, actionable insights to brake later, smoother, and more effectively. Whether it’s refining threshold braking, perfecting trail‑braking, or finding the optimal brake point, this module helps drivers unlock the final tenths of a second that separate the good from the great.