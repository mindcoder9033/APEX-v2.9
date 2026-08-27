# Car Control Mastery

## 1. Introduction

**Car Control Mastery** is the most advanced and nuanced module of the **APEX** sim racing telemetry application. While the racing line, braking, and corner exit speed define *what* the driver should do, car control determines *how well* they execute these techniques at the limit. As emphasised in *Going Faster! Mastering the Art of Race Driving*, genuine car control is not an innate talent—it is a learned skill that requires understanding, practice, and continuous refinement.

The module focuses on the driver's ability to manage the car's **yaw angle**, **slip angles**, and **weight transfer** to keep the tyres operating in their optimal grip window. It provides feedback on oversteer/understeer detection, throttle steering, slide correction, and overall car balance. The goal is to help drivers develop the sensitivity and precision needed to flirt with the car's limits without crossing them.

---

## 2. Core Concepts

| Term | Definition |
|------|------------|
| **Yaw Angle** | The angle between the car's centreline and its direction of travel. A neutral car at the limit typically operates with 5–10° of yaw. |
| **Slip Angle** | The angle between the wheel's pointing direction and the tyre's actual direction of travel. Peak grip occurs at a specific slip angle (varies by tyre type). |
| **Oversteer** | A condition where the rear tyres reach their grip limit before the front, causing the rear to slide outward. |
| **Understeer** | A condition where the front tyres reach their grip limit before the rear, causing the car to "plow" wide. |
| **Neutral Handling** | A balanced state where front and rear tyres operate at similar slip angles, maximising total grip. |
| **Trailing Throttle Oversteer (TTO)** | Oversteer caused by lifting off the throttle mid‑corner, which transfers weight to the front and reduces rear grip. |
| **Power Oversteer** | Oversteer caused by aggressive throttle application, which overwhelms the rear tyres' grip. |
| **Correction‑Pause‑Recovery** | The classic three‑phase steering technique for catching an oversteer slide. |
| **Rotation** | The process of the car yawing into a corner. Controlled rotation is essential for good corner entry. |
| **Opposite Lock** | Steering in the direction of the slide to reduce yaw and regain control. |
| **Tankslapper** | An oscillation where the driver over‑corrects, causing the car to snap back and forth. |
| **Friction Circle** | A graphical representation of the tyre's available grip, showing the trade‑off between longitudinal (accel/brake) and lateral (cornering) forces. |
| **Weight Transfer** | The shift of load between tyres during acceleration, braking, and cornering, which directly affects grip. |

---

## 3. Telemetry Dependencies

The following FM23 UDP fields (Dash structure) are essential for this module:

| Field | Usage |
|-------|-------|
| `Yaw` (F32) | Primary metric – the car's yaw angle. |
| `AngularVelocityY` (F32) | Yaw rate – how fast the car is rotating. |
| `TireSlipAngleFL/FR/RL/RR` (F32) | Lateral slip – indicates if tyres are exceeding their grip limit. |
| `TireSlipRatioFL/FR/RL/RR` (F32) | Longitudinal slip – indicates wheelspin or braking lockup. |
| `TireCombinedSlipFL/FR/RL/RR` (F32) | Combined slip – a comprehensive measure of traction usage. |
| `Steer` (S8) | Steering input – indicates the driver's correction. |
| `Accel` (U8) | Throttle input – used to detect throttle‑induced oversteer/understeer. |
| `Brake` (U8) | Brake input – used to detect brake‑induced rotation. |
| `AccelerationX` (F32) | Lateral G‑force – used for friction circle analysis. |
| `AccelerationZ` (F32) | Longitudinal G‑force – used for friction circle analysis. |
| `Speed` (F32) | Current speed – provides context for slip angles. |
| `DrivetrainType` (S32) | FWD, RWD, or AWD – influences how throttle affects handling. |
| `NormalizedSuspensionTravelFL/FR/RL/RR` (F32) | Indicates weight transfer and chassis pitch/roll. |
| `TireTempFront/Rear` (F32) | Tyre temperatures – excessive slip increases temperature, affecting grip. |
| `TireWearFront/Rear` (F32) | Tyre wear – helps correlate aggressive driving with degradation. |
| `CurrentLap`, `LapNumber` | Lap context for session‑long trends. |

---

## 4. Sub‑Features

### 4.1 Yaw Angle Optimisation

**Description:**  
Evaluates whether the driver is maintaining an optimal yaw angle during cornering. According to *Going Faster!*, a neutral car operates with 5–10° of yaw, depending on the tyre type. Too little yaw means under‑utilisation of grip; too much yaw causes excessive scrub and potential loss of control.

**Telemetry:** `Yaw`, `Speed`, `Steer`, `TireSlipAngle`.

**Output:**  
- A yaw score (0–100%) for each corner.  
- A graph showing yaw angle over the corner, with optimal range highlighted.  
- A recommendation: “Increase yaw by 2° for better grip” or “Reduce yaw – excessive scrub”.

**Implementation:**  
- For each corner, record the average and peak yaw angle during the mid‑corner phase (from apex to throttle application).  
- Compare to the optimal range (e.g., 5–10° for street tyres, 3–6° for slicks, adjustable by tyre type).  
- Score = 100 × (1 – |avg_yaw – optimal_yaw| / optimal_yaw) (capped at 100).  
- Flag if peak yaw exceeds 15° (risk of spin).

### 4.2 Oversteer / Understeer Detection

**Description:**  
Continuously detects whether the car is oversteering or understeering by comparing front and rear slip angles. This is the most direct measure of handling balance.

**Telemetry:** `TireSlipAngleFrontLeft/Right`, `TireSlipAngleRearLeft/Right`, `Yaw`, `Steer`.

**Output:**  
- A live handling state: “Neutral”, “Oversteer”, “Understeer”.  
- A severity score (0–100%) for each state.  
- A per‑corner summary: “T3: Oversteer detected – reduce throttle earlier”.  
- A colour‑coded track map showing handling states.

**Implementation:**  
- Compute the average front slip angle and average rear slip angle for each sample.  
- If front > rear by > 2°, classify as understeer.  
- If rear > front by > 2°, classify as oversteer.  
- Severity = (|front – rear| / 10) × 100 (capped at 100).  
- Provide a time‑series graph of front vs. rear slip angles.

### 4.3 Throttle Steering Score

**Description:**  
Measures the driver's ability to use throttle to influence the car's rotation and balance. In RWD cars, throttle can induce oversteer or understeer depending on application; in FWD cars, it tends to cause understeer.

**Telemetry:** `Accel`, `Yaw`, `Steer`, `DrivetrainType`.

**Output:**  
- A throttle steering score (0–100%) for each corner.  
- A recommendation: “Use more throttle to help rotation” or “Reduce throttle to stabilise rear”.  
- A graph showing throttle vs. yaw rate.

**Implementation:**  
- For the mid‑corner to exit phase, compute the correlation between throttle increase and yaw rate.  
- For RWD: a positive correlation (more throttle → more yaw) indicates power oversteer; a negative correlation indicates understeer.  
- For FWD: throttle tends to reduce yaw (understeer).  
- Score based on whether the driver is using throttle effectively to achieve the desired rotation.  
- Provide a scatter plot: throttle input vs. yaw rate.

### 4.4 Correction‑Pause‑Recovery Detection

**Description:**  
Detects and evaluates the quality of oversteer corrections. The classic technique is: **Correction** (turn into the slide), **Pause** (wait for the rear to settle), **Recovery** (unwind the steering). A good correction is smooth and timely.

**Telemetry:** `Steer`, `Yaw`, `AngularVelocityY`, `Accel`.

**Output:**  
- A correction score (0–100%) per slide event.  
- A count of correction events per lap.  
- A feedback message: “Good correction – quick recovery” or “Slow recovery – risk of tankslapper”.  
- A visual graph showing steering, yaw, and throttle during the correction.

**Implementation:**  
- Detect oversteer events (rear slip angle > front slip angle by > 3°).  
- During the event, identify the **correction** phase (steering opposite to the turn), the **pause** (yaw rate near zero), and the **recovery** (steering returns to straight).  
- Measure the time from correction to recovery.  
- Score = 100 × (1 – (recovery_time / max_acceptable_time)) × (1 – overshoot_factor).  
- Flag if the steering input overshoots the opposite direction (tankslapper risk).

### 4.5 Slip Angle Analysis

**Description:**  
Monitors whether each tyre is operating in its optimal slip angle range for peak grip. For most tyres, peak grip occurs between 5–10° of slip angle (street tyres tend to be higher, slicks lower).

**Telemetry:** `TireSlipAngleFL/FR/RL/RR`, `TireTemp`, `TireWear`.

**Output:**  
- A slip angle score (0–100%) for each tyre and corner.  
- A heatmap showing slip angle distribution across the track.  
- Recommendations: “Front left over‑worked – reduce entry speed” or “Rear right under‑utilised – apply more throttle”.

**Implementation:**  
- For each corner, record the average slip angle per tyre during mid‑corner and exit.  
- Compare to the optimal range (adjustable by tyre type from `TireTemp` and `CarClass`).  
- Score = 100 × (1 – (|avg_slip – optimal_slip| / optimal_slip)).  
- Flag if any tyre exceeds 12° (excessive scrub).

### 4.6 Trailing Throttle Oversteer (TTO) Detection

**Description:**  
Detects oversteer events caused by abrupt lifting of the throttle mid‑corner. This is a common mistake that can snap the car around unexpectedly.

**Telemetry:** `Accel`, `Yaw`, `TireSlipAngleRear`, `Steer`.

**Output:**  
- A TTO flag: “TTO detected – avoid abrupt lifts”.  
- A severity score.  
- A recommendation: “Smoothly trail off throttle” or “Use trail‑braking to rotate instead”.

**Implementation:**  
- Detect when `Accel` drops sharply (e.g., > 50% reduction in 0.1s) while `Steer` is significant (> 30%).  
- If within 0.2s, rear slip angle increases by > 3°, classify as TTO.  
- Provide a warning in real time.

### 4.7 Power Oversteer / Wheelspin Detection

**Description:**  
Identifies oversteer or excessive wheelspin caused by aggressive throttle application during corner exit.

**Telemetry:** `Accel`, `TireSlipRatioRear`, `TireSlipAngleRear`, `Yaw`.

**Output:**  
- A power oversteer flag per corner.  
- A wheelspin score (0–100%) for each exit.  
- A recommendation: “Squeeze throttle more gradually” or “Reduce throttle by 10%”.

**Implementation:**  
- During exit phase, if `Accel` > 80% and rear `TireSlipRatio` > 0.20, flag wheelspin.  
- If rear `TireSlipAngle` increases significantly (> 3°) during this phase, flag power oversteer.  
- Score = 100 × (1 – (avg_slip_ratio – 0.15) / 0.15) (capped at 0 if > 0.30).  
- Provide a time‑series graph of throttle vs. slip ratio.

### 4.8 Weight Transfer Monitoring

**Description:**  
Tracks longitudinal and lateral weight transfer using suspension travel and acceleration data. Excessive or abrupt weight transfer can destabilise the car.

**Telemetry:** `NormalizedSuspensionTravelFL/FR/RL/RR`, `AccelerationX`, `AccelerationZ`, `Pitch`, `Roll`.

**Output:**  
- A weight transfer score (0–100%) for braking and acceleration phases.  
- A recommendation: “Smooth out weight transfer – brake earlier” or “More progressive throttle to reduce rear squat”.  
- A graph showing suspension compression vs. acceleration.

**Implementation:**  
- During braking, compute the average front suspension compression (`NormalizedSuspensionTravelFrontLeft` and `FrontRight`).  
- During acceleration, compute rear compression.  
- Score = 100 × (1 – (|compression – target_compression| / target_compression)).  
- Flag abrupt changes (derivative > threshold).

### 4.9 Friction Circle Analysis (Full Phase)

**Description:**  
Extends the friction circle concept to the entire corner, showing how the driver balances longitudinal and lateral forces. A good driver keeps the resultant force near the circle's boundary without exceeding it.

**Telemetry:** `AccelerationX`, `AccelerationZ`, `Speed`, `TireCombinedSlip`.

**Output:**  
- A full friction circle plot for each corner.  
- A utilisation score (0–100%) – how close the driver stays to the grip limit.  
- Areas of the circle where the driver over‑ or under‑utilises grip.

**Implementation:**  
- For the entire corner (entry to exit), collect lateral and longitudinal G‑forces.  
- Plot them on a 2D graph with the theoretical peak grip circle (from `TireCombinedSlip` or car model).  
- Compute the average radius of the resultant vector as a percentage of peak grip.  
- Score = 100 × average_utilisation.  
- Highlight areas where the trajectory exceeds the circle (over‑braking, over‑throttle) or stays well inside (under‑utilisation).

### 4.10 Chassis Attitude Analysis (Pitch & Roll)

**Description:**  
Monitors the car's pitch and roll angles to assess chassis stability. Excessive pitch under braking or roll during cornering can indicate poor weight transfer management.

**Telemetry:** `Pitch`, `Roll`, `Speed`, `AccelerationX`, `AccelerationZ`.

**Output:**  
- A pitch score (braking) and roll score (cornering).  
- A recommendation: “Reduce pitch – smoother braking” or “Reduce roll – adjust line or suspension”.  
- A graph showing pitch/roll over the lap.

**Implementation:**  
- During braking zones, record the average pitch angle.  
- During cornering, record the average roll angle.  
- Compare to benchmarks (from reference lap or car model).  
- Flag if pitch/roll exceeds 2° change from reference.

### 4.11 Oversteer Oscillation (Tankslapper) Detection

**Description:**  
Identifies the dangerous oscillation known as a "tankslapper," where the car snaps back and forth due to over‑correction.

**Telemetry:** `Yaw`, `AngularVelocityY`, `Steer`.

**Output:**  
- A tankslapper flag if more than 3 yaw reversals occur within 1 second.  
- A severity score.  
- A recommendation: “Freeze the steering wheel – let the car settle”.

**Implementation:**  
- Detect when `Yaw` changes direction (positive to negative or vice versa) more than 3 times in 1 second.  
- Also check if `AngularVelocityY` peaks above 15°/s.  
- Flag and log the event.

### 4.12 Steering Smoothness Score

**Description:**  
Evaluates the smoothness of steering inputs. Jerky or abrupt steering can upset the car's balance, reducing grip.

**Telemetry:** `Steer`, `Yaw`.

**Output:**  
- A steering smoothness score (0–100%) for each corner and overall.  
- A graph showing steering input over time.  
- Recommendations: “Softer turn‑in” or “Less aggressive mid‑corner corrections”.

**Implementation:**  
- Compute the second derivative of `Steer` (jerk).  
- Score = 100 × (1 – (RMS_jerk / max_acceptable_jerk)).  
- Flag if jerk exceeds threshold (indicating abrupt steering).

---

## 5. Implementation Plan

### 5.1 Data Preprocessing

- Parse UDP packets (Dash structure) in real time or from stored sessions.
- Filter out non‑racing data (`IsRaceOn == 0`).
- Smooth `Yaw`, `Steer`, and `Accel` with a moving average (window size 3–5 samples).
- Compute derived values: yaw rate (ΔYaw/Δt), lateral G (`AccelerationX`), longitudinal G (`AccelerationZ`), and average slip angles per axle.

### 5.2 Corner Segmentation (shared)

- Use corner definitions from the Line & Corner Analysis module.
- Identify key phases: entry, mid‑corner (apex), and exit.

### 5.3 Compute Core Metrics

- **Yaw Angle Optimisation:** Compute average and peak yaw per corner.
- **Oversteer/Understeer Detection:** Compare front vs. rear slip angles.
- **Throttle Steering:** Correlation between throttle and yaw rate.
- **Correction‑Pause‑Recovery:** Detect and evaluate oversteer events.
- **Slip Angle Analysis:** Compare tyre slip angles to optimal range.
- **TTO Detection:** Detect throttle‑induced oversteer.
- **Power Oversteer/Wheelspin:** Detect throttle‑induced slip.
- **Weight Transfer:** Monitor suspension travel and acceleration.
- **Friction Circle:** Plot lateral vs. longitudinal G‑forces.
- **Chassis Attitude:** Monitor pitch and roll.
- **Oscillation Detection:** Detect tankslappers.
- **Steering Smoothness:** Compute jerk of steering input.

### 5.4 Reference Lap Selection

- Use the driver's **best lap** as the reference for comparison.
- For some metrics (e.g., yaw optimisation), use a theoretical optimal or a pre‑computed ideal from a pro driver.

### 5.5 Scoring

- Each sub‑feature produces a score (0–100%) and a recommendation.
- A composite **Car Control Score** can be computed as a weighted average:
  - Yaw Optimisation (15%)
  - Oversteer/Understeer Balance (20%)
  - Throttle Steering (15%)
  - Correction Quality (10%)
  - Slip Angle Usage (10%)
  - Steering Smoothness (10%)
  - Weight Transfer (10%)
  - Friction Circle Utilisation (10%)

### 5.6 Real‑time vs. Post‑Session

- **Real‑time:** Provide immediate feedback after each corner (e.g., “Good balance – neutral”, “TTO – avoid abrupt lifts”, “Wheelspin – reduce throttle”).
- **Post‑session:** Generate detailed reports, graphs, and trend analysis.

### 5.7 Visualisation

- **Yaw angle graph** over each corner with optimal range highlighted.
- **Front vs. rear slip angle** graph for oversteer/understeer detection.
- **Friction circle** plot for each corner.
- **Steering input graph** with smoothness annotations.
- **Track map** colour‑coded by handling state (neutral, oversteer, understeer).
- **Correction event logs** with graphs showing steering, yaw, and throttle.

### 5.8 Integration with Other Modules

- **Line & Corner Analysis:** Provides corner definitions and line quality; a poor line can cause understeer/oversteer.
- **Braking & Entry:** Trail‑braking technique affects yaw and balance.
- **Corner Exit Speed:** Throttle steering and wheelspin directly impact exit speed.
- **Tire Management:** Slip angles and temperatures are closely linked.

---

## 6. Technical Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Noisy slip angle data** | Smooth with a moving average; use combined slip for validation. |
| **Distinguishing oversteer from driver‑induced yaw** | Compare to steering input and expected yaw from vehicle model. |
| **Detecting correction events reliably** | Use a combination of yaw rate, steering, and slip angles with a state machine. |
| **Different tyre types** | Adjust optimal slip angle and yaw thresholds based on tyre temperature and car class. |
| **Real‑time performance** | Limit real‑time analysis to high‑impact metrics (oversteer flag, TTO, wheelspin). |
| **Driver technique variation** | Use relative comparisons (vs. reference lap) rather than absolute thresholds. |

---

## 7. Future Improvements

- **Machine learning** to classify driver style (smooth vs. aggressive) and provide personalised coaching.
- **Predictive oversteer warning** using AI to anticipate loss of grip before it happens.
- **Voice coaching** for real‑time corrections: “Steer into the slide” or “Ease off the throttle”.
- **Advanced vehicle model** to calculate expected yaw from steering and speed, improving oversteer/understeer detection.
- **Integration with telemetry from other sims** (e.g., iRacing, Assetto Corsa) for cross‑platform analysis.

---

## 8. Conclusion

The Car Control Mastery module is designed to help drivers develop the most essential, yet hardest‑to‑master, skill in racing: the ability to feel and control the car at its limit. By providing granular feedback on yaw angle, slip angles, throttle steering, and correction techniques, APEX turns the abstract art of car control into measurable, improvable data. As *Going Faster!* teaches, genuine confidence is earned through understanding and practice—and this module gives drivers the insights they need to earn it.