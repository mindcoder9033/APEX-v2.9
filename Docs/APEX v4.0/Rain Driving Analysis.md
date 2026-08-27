# Rain Driving Analysis

## 1. Introduction

**Rain Driving Analysis** is a specialised module of the **APEX** sim racing telemetry application, designed to help drivers adapt their technique to wet conditions. As described in *Going Faster! Mastering the Art of Race Driving*, racing in the rain requires a fundamentally different approach: visibility is compromised, grip is reduced, and the optimal line shifts away from the polished dry line. Drivers who master wet‑weather techniques can gain a significant advantage over those who struggle to adapt.

The module leverages telemetry to provide actionable feedback on rain‑specific challenges: maintaining visibility, finding grip, adjusting braking points, modulating throttle, and choosing the right line. It also helps with car setup changes (brake bias, suspension, tyre pressures) and offers real‑time warnings for hydroplaning and traction loss.

---

## 2. Core Concepts

| Term | Definition |
|------|------------|
| **Hydroplaning** | When a layer of water separates the tyre from the road, causing total loss of grip. Occurs at speeds roughly proportional to the square root of tyre inflation pressure. |
| **Wet Grip** | The reduced friction between tyre and road due to water. Tyres lose more cornering grip (up to 50%) than braking/acceleration grip (≈36%). |
| **Rain Line** | An alternate racing line that avoids the polished, rubber‑coated dry line. Often on the outside of corners where the pavement is more abrasive and drains better. |
| **Rim Shot** | A wet‑weather technique where the driver stays on the outside edge of the track to find more grip, avoiding the slippery apex. |
| **Squaring Off** | A technique for tight corners where the driver turns later, does most of the direction change early, then accelerates straight, minimising time spent cornering. |
| **Wet Tyres** | Treaded tyres with soft compounds designed to evacuate water and reach optimal temperature (≈200°F) in wet conditions. |
| **Tyre Pressures** | Higher pressures can raise the hydroplaning speed, but lower pressures improve contact patch. A balance is needed. |
| **Brake Bias** | In the wet, less load transfer occurs under braking, so bias should be shifted rearward to prevent front lockup. |
| **Suspension** | Softer settings allow more gradual load transfer and better compliance on wet, bumpy surfaces. |
| **Throttle Modulation** | Smoother, more gradual throttle application is essential to avoid wheelspin. |

---

## 3. Telemetry Dependencies

The following FM23 UDP fields (Dash structure) are critical for rain analysis:

| Field | Usage |
|-------|-------|
| `WheelInPuddleDepthFL/FR/RL/RR` (F32) | Indicates water depth under each wheel (0–1). Primary wet‑condition indicator. |
| `Speed` (F32) | Used to assess hydroplaning risk (higher speed + deeper puddle = risk). |
| `TireSlipRatioFL/FR/RL/RR` (F32) | Longitudinal slip – indicates wheelspin or lockup; thresholds are lower in wet. |
| `TireSlipAngleFL/FR/RL/RR` (F32) | Lateral slip – cornering grip loss is more pronounced in wet. |
| `TireCombinedSlipFL/FR/RL/RR` (F32) | Combined slip – overall grip utilisation. |
| `TireTempFront/Rear` (F32) | Tyre temperatures – wet tyres need to stay in their optimal window; cooling from water can drop temperatures. |
| `TireWearFront/Rear` (F32) | Tyre wear – wet driving can be gentler on tyres if done correctly, but wheelspin can accelerate wear. |
| `Accel` (U8) | Throttle input – used to detect aggressive throttle in wet. |
| `Brake` (U8) | Brake input – used to detect lockup and adjust brake points. |
| `Steer` (S8) | Steering input – used to detect over‑correction and line choice. |
| `Speed`, `PositionX/Y/Z` | Used for line analysis and braking point adjustments. |
| `CurrentLap`, `LapNumber` | Lap context for tracking changing conditions. |
| `NormalizedDrivingLine` (S8) | Game’s indication of line adherence; can be cross‑checked with wet line. |

---

## 4. Sub‑Features

### 4.1 Wet Condition Detection

**Description:**  
Determines if the track is wet based on puddle depths across all wheels. Activates wet‑mode analysis and adjusts all thresholds accordingly.

**Telemetry:** `WheelInPuddleDepthFL/FR/RL/RR`.

**Output:**  
- A wetness indicator: “Dry”, “Damp”, “Wet”, “Flooded”.  
- A confidence score based on the average puddle depth.

**Implementation:**  
- Compute average puddle depth across all four wheels.  
- Thresholds: 0–0.1 = Dry, 0.1–0.3 = Damp, 0.3–0.6 = Wet, >0.6 = Flooded.  
- Use this to toggle wet‑specific analysis and recommendations.

### 4.2 Hydroplaning Warning

**Description:**  
Warns the driver when a wheel is in deep water at high speed, indicating a high risk of hydroplaning and total loss of control.

**Telemetry:** `WheelInPuddleDepth`, `Speed`, `TireSlipRatio`.

**Output:**  
- A real‑time warning: “Hydroplaning risk – reduce speed”.  
- A severity score (0–100%) based on depth and speed.  
- Recommendation: “Lift throttle gradually” or “Avoid puddles”.

**Implementation:**  
- If any wheel’s puddle depth > 0.5 and speed > 80 km/h (adjustable), calculate risk = depth × (speed / 100).  
- If risk > 0.7, trigger a warning.  
- Also check if `TireSlipRatio` spikes suddenly (indicating loss of contact).

### 4.3 Rain Line Optimisation

**Description:**  
Suggests an alternate racing line for wet conditions, typically avoiding the polished dry line. It compares the driver’s actual line to a pre‑defined “rain line” (outside of corners) and scores adherence.

**Telemetry:** `PositionX/Y/Z`, `Steer`, `Speed`.

**Output:**  
- A rain line score (0–100%) for each corner.  
- Recommendations: “Move to the outside – more grip” or “Avoid the apex puddle”.  
- A track map overlay showing the dry line vs. rain line.

**Implementation:**  
- Use a pre‑computed rain line for each track (from a database) or dynamically generate it by shifting the optimal line outward by a certain offset (e.g., 2 m).  
- For each corner, compute the lateral deviation from the rain line.  
- Score = 100 × (1 – (RMS_deviation / allowed_deviation)), where allowed_deviation = 1.0 m (adjustable).  
- Provide real‑time guidance: “Stay left – wet line”.

### 4.4 Wet Brake Point Adjustment

**Description:**  
Compares the driver’s brake points in the wet to their dry brake points, and suggests moving brake points earlier to account for reduced grip.

**Telemetry:** `Brake`, `Speed`, `PositionX/Y/Z`.

**Output:**  
- For each corner, the recommended brake point shift (e.g., “Brake 10 m earlier”).  
- A score indicating how well the driver has adapted.  
- A graph showing brake point movement over laps as conditions change.

**Implementation:**  
- Record the brake point distance from turn‑in for dry and wet laps.  
- In wet conditions, compare to the driver’s dry reference (if available) or to a wet reference.  
- Suggest a shift: recommended = dry_brake_point + (dry_brake_point × 0.10) (10% earlier).  
- Score = 100 × (1 – |actual_wet_brake_point – recommended| / recommended).

### 4.5 Wet Throttle Modulation Score

**Description:**  
Evaluates the smoothness of throttle application in the wet. Abrupt throttle can easily cause wheelspin; gradual squeezing is essential.

**Telemetry:** `Accel`, `TireSlipRatio`, `Speed`.

**Output:**  
- A throttle modulation score (0–100%) for each corner.  
- A flag: “Wheelspin detected – smooth out throttle”.  
- A time‑series graph of throttle vs. slip ratio.

**Implementation:**  
- Compute the derivative of throttle input.  
- In wet conditions, the acceptable rate of change is lower (e.g., half of dry threshold).  
- Score = 100 × (1 – (RMS_derivative / wet_acceptable_derivative)).  
- Flag if rear slip ratio exceeds 0.15 (dry optimal is 0.15, wet should be lower, e.g., 0.10).

### 4.6 Wet Brake Modulation Score

**Description:**  
Evaluates the smoothness of brake application in the wet. Lockup is more common; a smoother, more progressive squeeze is needed.

**Telemetry:** `Brake`, `TireSlipRatio`, `Speed`.

**Output:**  
- A brake modulation score (0–100%) for each braking zone.  
- Recommendations: “Squeeze brakes more progressively” or “Reduce peak pressure”.  
- A graph of brake pressure vs. slip ratio.

**Implementation:**  
- Similar to throttle modulation, but for brake input.  
- Wet acceptable rate of change is lower.  
- Flag if any `TireSlipRatio` exceeds 0.90 (lockup).  
- Score based on smoothness and absence of lockup.

### 4.7 Traction Loss Comparison (Wet vs. Dry)

**Description:**  
Compares the driver’s traction usage (slip ratios and angles) in wet vs. dry conditions, highlighting areas where grip loss is most significant.

**Telemetry:** `TireSlipRatio`, `TireSlipAngle`, `Speed`, `Accel`, `Brake`.

**Output:**  
- A grip loss percentage per corner and overall.  
- A graph showing slip ratios in dry vs. wet for each corner.  
- A recommendation: “Reduce speed by X% in corner Y”.

**Implementation:**  
- For each corner, compute the average slip ratio and slip angle in dry reference laps and in wet laps.  
- Grip loss = (dry_grip – wet_grip) / dry_grip × 100.  
- Provide a list of corners with the highest grip loss.

### 4.8 Wet Tyre Temperature Management

**Description:**  
Monitors tyre temperatures to ensure they stay in the optimal window for wet tyres (typically 180–220°F). Water cools tyres; if they get too cold, grip drops.

**Telemetry:** `TireTempFront/Rear`, `TireSlipAngle`, `Speed`.

**Output:**  
- A tyre temperature score (0–100%) for each tyre.  
- A warning: “Tyre temperature too low – increase aggression” or “Too high – reduce slip”.  
- A graph showing temperature trends over the lap.

**Implementation:**  
- Define optimal wet temperature range (e.g., 180–220°F).  
- Score = 100 × (1 – (|temp – optimal_temp| / optimal_temp)), capped.  
- Flag if temp < 160°F (too cold) or > 240°F (overheating).  
- Correlate temperature with slip angles to identify cause.

### 4.9 Water Evacuation Monitor

**Description:**  
Assesses how effectively the tyres are evacuating water. This is influenced by tread depth, tyre pressure, and speed. The module can recommend pressure adjustments.

**Telemetry:** `WheelInPuddleDepth`, `TireSlipRatio`, `Speed`, `TireTemp`.

**Output:**  
- A water evacuation score (0–100%).  
- A recommendation: “Increase tyre pressure to improve water clearance” or “Reduce pressure for better contact”.  
- A graph showing puddle depth vs. slip ratio.

**Implementation:**  
- Monitor the relationship between puddle depth and slip ratio.  
- If slip ratio increases significantly with puddle depth, evacuation is poor.  
- Use a lookup table for optimal pressure based on car weight and tyre type (from telemetry).  
- Provide pressure adjustment suggestions.

### 4.10 Rim Shot Detection & Scoring

**Description:**  
Detects if the driver is using the “rim shot” technique—staying on the outside edge of corners where grip is better. Scores adherence.

**Telemetry:** `PositionX/Y/Z`, `Steer`, `Speed`.

**Output:**  
- A rim shot score (0–100%) per corner.  
- A flag: “Use rim shot – outside line has more grip”.  
- A visual overlay on the track map.

**Implementation:**  
- For each corner, define the outer edge of the track as the “rim shot” line.  
- Compute the lateral deviation from the outside edge.  
- Score = 100 × (1 – (RMS_deviation / allowed_deviation)), where allowed_deviation = 1.0 m.  
- If the driver is consistently on the outside, score is high.

### 4.11 Squaring Off Detection

**Description:**  
Identifies if the driver is using the “squaring off” technique for tight corners—turning late, changing direction quickly, and then accelerating straight. This minimises time spent cornering.

**Telemetry:** `Steer`, `Yaw`, `Speed`, `PositionX/Y/Z`.

**Output:**  
- A squaring off score (0–100%) for hairpins and tight corners.  
- A recommendation: “Turn later – square off the corner” or “Be more patient – use wider arc”.

**Implementation:**  
- For hairpin‑type corners (angle > 120°), measure the yaw rate vs. steering input.  
- A high yaw rate in a short distance indicates squaring off.  
- Score based on how quickly the direction change is completed relative to the corner’s length.

### 4.12 Wet Setup Recommendations

**Description:**  
Provides car setup suggestions based on wet conditions, derived from telemetry and the principles in *Going Faster!*.

**Telemetry:** `TireSlipRatio`, `TireSlipAngle`, `Brake`, `Accel`, `TireTemp`, `SuspensionTravel`.

**Output:**  
- Recommendations:  
  - Brake bias: shift rearward X%  
  - Tyre pressures: increase/decrease X psi  
  - Suspension: soften front/rear by X clicks  
  - Anti‑roll bars: soften front/rear  
  - Ride height: adjust to lower CG (if not bottoming)  
  - Throttle pedal: lengthen travel for finer modulation  
- A confidence score for each recommendation.

**Implementation:**  
- Analyse front vs. rear slip ratios under braking to suggest bias changes.  
- Use tyre temperatures and hydroplaning risk to suggest pressure changes.  
- Use suspension travel and pitch/roll to suggest softening.  
- Provide a summary dashboard with before/after setups.

### 4.13 Wet Race Strategy

**Description:**  
Advises on strategy decisions: when to switch to wet tyres, how to manage fuel, and how to adapt to changing conditions.

**Telemetry:** `WheelInPuddleDepth`, `CurrentLap`, `LapNumber`, `Fuel`, `TireWear`.

**Output:**  
- A pit window recommendation: “Pit now for wet tyres” or “Stay out – track drying”.  
- A fuel strategy adjustment: “Reduce fuel load – wet conditions use less fuel”.  
- A tyre compound recommendation.

**Implementation:**  
- Monitor puddle depth trends over laps. If depth increases, recommend wet tyres.  
- If depth decreases, recommend slicks.  
- Adjust fuel calculations based on reduced grip (less wheelspin, lower fuel consumption).  
- Provide a decision tree based on race length and weather forecast (simulated).

---

## 5. Implementation Plan

### 5.1 Data Preprocessing

- Parse UDP packets (Dash structure).  
- Filter out non‑racing data (`IsRaceOn == 0`).  
- Identify wet conditions by checking `WheelInPuddleDepth`.  
- Apply smoothing to `Speed`, `Accel`, `Brake`, and `Steer`.  
- Compute derived values: deceleration, lateral G, slip ratios, etc.

### 5.2 Condition Detection

- Compute average puddle depth.  
- Set wetness level (Dry/Damp/Wet/Flooded).  
- Adjust all thresholds (slip ratio optimal, brake point shifts, throttle modulation limits) based on wetness level.

### 5.3 Corner Segmentation (shared)

- Use corner definitions from Line & Corner Analysis module.  
- Identify corner type (hairpin, sweeper, etc.) for specific analysis.

### 5.4 Compute Rain‑Specific Metrics

- **Hydroplaning Risk:** For each sample, calculate risk = depth × speed_factor.  
- **Rain Line Score:** Compare actual line to pre‑defined rain line.  
- **Brake Point Adjustment:** Compare to dry reference and suggest earlier braking.  
- **Throttle Smoothness:** Derivative of throttle, with wet threshold.  
- **Brake Smoothness:** Derivative of brake, with wet threshold.  
- **Traction Loss:** Compare dry vs. wet slip ratios and angles.  
- **Tyre Temperature:** Monitor against wet optimal range.  
- **Water Evacuation:** Correlate puddle depth with slip ratio.  
- **Rim Shot Detection:** Measure outside line adherence.  
- **Squaring Off:** Measure yaw rate in tight corners.  
- **Setup Recommendations:** Analyse braking balance, pressures, suspension.  
- **Race Strategy:** Puddle trend and lap counting.

### 5.5 Reference Lap

- Use the driver’s own dry best lap as a reference for comparison.  
- If no dry lap exists, use a pre‑computed ideal wet lap (from a database or AI).

### 5.6 Scoring

- Each sub‑feature produces a score (0–100%) and recommendations.  
- A composite **Rain Driving Score** can be computed as a weighted average:  
  - Hydroplaning Avoidance (15%)  
  - Rain Line Adherence (15%)  
  - Brake Point Adaptation (15%)  
  - Throttle Smoothness (15%)  
  - Traction Management (15%)  
  - Tyre Temperature (10%)  
  - Setup Optimisation (10%)  
- Provide an overall wet‑weather competency rating.

### 5.7 Real‑time vs. Post‑Session

- **Real‑time:** Provide immediate warnings (hydroplaning, wheelspin), line guidance, and brake point suggestions.  
- **Post‑session:** Generate a detailed wet‑weather report with graphs, trend analysis, and setup recommendations.

### 5.8 Visualisation

- **Track map** with dry line (green) and rain line (blue) overlaid, and the driver’s actual line.  
- **Puddle depth heatmap** on the track.  
- **Time‑series graphs** for throttle, brake, slip ratios, and temperatures.  
- **Hydroplaning risk** gauge.  
- **Setup recommendation** dashboard.

### 5.9 Integration with Other Modules

- **Line & Corner Analysis:** Rain line is a variant of the optimal line.  
- **Braking & Entry:** Brake point adjustments and brake modulation are directly affected.  
- **Corner Exit Speed:** Throttle modulation and traction loss impact exit speed.  
- **Car Control Mastery:** Oversteer/understeer detection thresholds change in wet.  
- **Tire Management:** Tyre temperatures and wear are critical in rain.

---

## 6. Technical Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Puddle depth data may be noisy or unrealistic** | Smooth over time; use a moving average. Validate with other sensors (slip ratios). |
| **Different rain intensities** | Use wetness level to adjust thresholds dynamically. |
| **No dry reference lap** | Use a pre‑computed ideal wet line or a database of reference laps. |
| **Hydroplaning speed varies with tyre and car** | Use a model: hydroplaning speed (mph) = 9 × sqrt(tyre_pressure_psi). Derive pressure from telemetry or car data. |
| **Real‑time performance** | Limit real‑time analysis to critical warnings (hydroplaning, wheelspin, brake point). |
| **Track drying during a race** | Monitor puddle depth trends; update recommendations accordingly. |

---

## 7. Future Improvements

- **Machine learning** to predict grip loss based on puddle depth, speed, and tyre state.  
- **Dynamic rain line generation** based on actual grip distribution (using tyre slip angles).  
- **Voice coaching** for wet‑weather techniques: “Smooth throttle” or “Move to the outside”.  
- **Integration with live weather APIs** for race strategy.  
- **Advanced hydroplaning model** considering tread depth, tyre wear, and water film thickness.  
- **Personalised wet‑weather coaching** based on driver’s tendencies.

---

## 8. Conclusion

The Rain Driving Analysis module equips drivers with the tools to master one of the most challenging conditions in motorsport. By providing real‑time warnings, adaptive line guidance, and setup recommendations, APEX helps drivers maintain control, find grip, and preserve tyres in the wet. As *Going Faster!* emphasises, rain racing is a thinking game—and this module turns that thinking into data‑driven action, giving drivers the confidence to excel when the track is wet.