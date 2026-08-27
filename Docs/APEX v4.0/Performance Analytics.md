# Performance Analytics

## 1. Introduction

**Performance Analytics** is the strategic intelligence layer of the **APEX** sim racing telemetry application. While individual modules (Line & Corner, Braking & Entry, Corner Exit Speed, Car Control Mastery, Rain Driving) provide granular feedback on specific techniques, Performance Analytics synthesises all this data to answer the most important question: **"Where am I losing time, and how do I fix it?"**

Drawing on the principles of *Going Faster! Mastering the Art of Race Driving*, this module helps drivers identify the corners and sections of the track that offer the greatest potential for improvement. It provides sector-by-sector analysis, consistency tracking, mistake logging, and comparative benchmarking—turning raw telemetry into a clear, actionable race strategy.

The module also serves as the **command centre** for the APEX application, aggregating scores from all other modules and presenting a unified performance dashboard that tracks progress over time.

---

## 2. Core Concepts

| Term | Definition |
|------|------------|
| **Sector** | A subdivision of the track (typically 3–4 sectors per circuit) used for comparative timing and analysis. |
| **Sector Time** | The elapsed time from one sector boundary to the next. |
| **Delta** | The time difference between two laps or between a driver and a reference. Positive delta = slower, negative delta = faster. |
| **Consistency** | The variation in lap times or sector times across multiple laps. Low variation indicates high consistency. |
| **Benchmark** | A reference lap (best lap, teammate, or pro driver) used for comparison. |
| **Mistake** | A driving error that costs time, such as an early apex, a lockup, or a missed shift. |
| **Trend** | The direction of performance over time (improving, stable, or declining). |
| **Time Loss** | The amount of time lost in a specific section of the track compared to the benchmark. |
| **Potential Lap Time** | The theoretical best lap time achievable by combining the best sector times from a session. |
| **Session Summary** | An overview of a complete practice, qualifying, or race session, including key metrics and trends. |

---

## 3. Telemetry Dependencies

Performance Analytics relies on data from all other APEX modules, plus the following core FM23 fields:

| Field | Usage |
|-------|-------|
| `PositionX/Y/Z` (F32) | Global position – for sector boundaries and track position. |
| `Speed` (F32) | Current speed – for speed traces and time calculations. |
| `CurrentLap` (F32) | Current lap time – primary metric. |
| `BestLap` (F32) | Best lap time – the benchmark. |
| `LastLap` (F32) | Last lap time – for consistency tracking. |
| `LapNumber` (U16) | Lap number – for session-level analysis. |
| `RacePosition` (U8) | Current race position – for race strategy context. |
| `DistanceTraveled` (F32) | Total distance – for normalising position data. |
| `Accel` (U8) | Throttle input – for phase detection. |
| `Brake` (U8) | Brake input – for phase detection. |
| `Steer` (S8) | Steering input – for phase detection. |
| `TireSlipAngle` (F32) | Slip angle – for car control context. |
| `TireSlipRatio` (F32) | Slip ratio – for braking/exit context. |
| `TimestampMS` (U32) | Timestamp – for time-series analysis. |
| `TrackOrdinal` (S32) | Track ID – for track-specific analysis. |

**Module Integration:** Performance Analytics also consumes scores and recommendations from:
- Line & Corner Analysis (line score, apex accuracy)
- Braking & Entry (threshold score, trail-braking score)
- Corner Exit Speed (exit speed score)
- Car Control Mastery (yaw score, oversteer/understeer count)
- Rain Driving (wet condition adaptation score)

---

## 4. Sub‑Features

### 4.1 Lap Time Analysis

**Description:**  
The foundation of performance analytics. Displays lap times with delta comparisons to the best lap, session average, and a reference lap. Highlights the fastest and slowest laps.

**Telemetry:** `CurrentLap`, `BestLap`, `LastLap`, `LapNumber`.

**Output:**  
- A table of lap times with deltas.  
- A lap time trend graph (lap time vs. lap number).  
- Best lap, worst lap, average lap, and standard deviation.  
- A flag if lap time variability exceeds a threshold.

**Implementation:**  
- Store lap times as they are completed.  
- Compute basic statistics (min, max, mean, std).  
- Calculate delta = lap_time - best_lap.  
- Plot a line chart of lap times over the session.

### 4.2 Sector Time Breakdown

**Description:**  
Breaks each lap into sectors (typically 3–4 per track) and analyses sector times individually. This helps identify which parts of the track are strong or weak.

**Telemetry:** `PositionX/Y/Z`, `Speed`, `CurrentLap`.

**Output:**  
- A table of sector times per lap.  
- A graph showing sector time deltas vs. best sector.  
- A list of sectors where the driver is consistently losing time.  
- An optimal lap time (sum of best sectors).

**Implementation:**  
- Define sector boundaries (from track database).  
- For each lap, record the time at each sector boundary.  
- Compute sector times = time at sector_end - time at sector_start.  
- Compare to the driver's best sector times.  
- Flag sectors where average delta > 0.2s.

### 4.3 Consistency Analysis

**Description:**  
Measures the variability of lap times and sector times across a session. Consistent driving is essential for race success, especially in endurance events.

**Telemetry:** `CurrentLap`, `LapNumber`, `SectorTimes`.

**Output:**  
- Consistency score (0–100%) for the session.  
- A graph showing lap time variation (scatter plot).  
- A flag if inconsistency is high (e.g., std > 0.5s).  
- A recommendation: “Focus on sector 3 – most variable.”

**Implementation:**  
- Compute the standard deviation of lap times.  
- Score = 100 × (1 – (std_dev / avg_lap_time)) – higher is more consistent.  
- Also compute the coefficient of variation (CV = std/mean).  
- Highlight the sector with the highest variation.

### 4.4 Delta Analysis (vs. Reference)

**Description:**  
Compares the driver’s lap to a reference lap (best lap, teammate, or pro) and visualises where time is gained or lost around the track.

**Telemetry:** `Speed`, `PositionX/Y/Z`, `CurrentLap`.

**Output:**  
- A delta graph (time difference vs. distance or position).  
- A list of corners where the driver loses time.  
- An estimated time loss per corner.  
- A cumulative time gain/loss over the lap.

**Implementation:**  
- Align the driver’s lap to the reference lap using position or distance.  
- Compute the time difference at each sample point.  
- Plot delta vs. distance.  
- For each corner (from segmentation), calculate the net delta.  
- If a corner's net delta > 0.1s, flag it for attention.

### 4.5 Mistakes Log

**Description:**  
Automatically detects and logs driving mistakes from other APEX modules, providing a summary of errors per session.

**Telemetry:** Consumed from all modules.

**Output:**  
- A table of mistakes with corner, lap, type, and severity.  
- A count of mistakes per lap and per corner.  
- A trend: “Mistakes decreasing” or “Mistakes increasing”.  
- A recommendation: “Focus on corner T5 – 3 early apexes.”

**Implementation:**  
- Each module (Line, Braking, Car Control, Rain) flags mistakes when thresholds are exceeded.  
- Performance Analytics stores these events with a timestamp, lap number, corner ID, and type.  
- Provides a summary view and a detailed log.

### 4.6 Performance Score Dashboard

**Description:**  
Aggregates scores from all APEX modules into a single, unified dashboard. Provides an at-a-glance view of driver performance.

**Telemetry:** Consumed from all modules.

**Output:**  
- A card for each module with score (0–100%) and trend.  
- An overall performance score (weighted average).  
- A radar chart showing strengths and weaknesses.  
- A summary recommendation: “Work on braking consistency.”

**Implementation:**  
- Receive scores from Line, Braking, Exit, Car Control, and Rain modules.  
- Compute weighted average (default weights: Line 20%, Braking 20%, Exit 25%, Car Control 20%, Rain 15%).  
- Display as a dashboard with colour-coded indicators (green > 80%, yellow 60–80%, red < 60%).  
- Generate a radar chart for visual comparison.

### 4.7 Performance Trends

**Description:**  
Tracks key metrics over multiple sessions (or across a race weekend) to show improvement or decline.

**Telemetry:** Stored session data.

**Output:**  
- Trend graphs for lap time, consistency score, line score, braking score, etc.  
- A progress indicator: “Improving”, “Stable”, or “Declining”.  
- A best-ever performance record.

**Implementation:**  
- Store session summaries in a database.  
- Plot metrics over session number or date.  
- Compute linear regression to determine trend direction.

### 4.8 Session Summary

**Description:**  
Provides a comprehensive overview of a practice, qualifying, or race session, including key metrics, best laps, and recommendations.

**Telemetry:** All session data.

**Output:**  
- Session type, track, date, car.  
- Best lap time, average lap time, total laps.  
- Sector bests and optimal lap.  
- Module scores (Line, Braking, Exit, Car Control, Rain).  
- Top 3 recommendations for improvement.  
- A graph of lap times over the session.

**Implementation:**  
- Aggregate all data from the session.  
- Compute summary statistics.  
- Generate recommendations based on the module with the lowest score.  
- Provide a downloadable report (PDF/CSV).

### 4.9 Corner Performance Ranking

**Description:**  
Ranks corners by performance, identifying the best and worst corners for the driver. Helps prioritise practice efforts.

**Telemetry:** Consumed from Line, Braking, Exit, Car Control modules.

**Output:**  
- A list of corners sorted by performance score.  
- A “Top 3” and “Bottom 3” list.  
- A recommendation: “Focus on corner T9 – lowest score of 62%.”

**Implementation:**  
- For each corner, combine scores from Line, Braking, Exit, and Car Control.  
- Compute a weighted average (Line 30%, Braking 20%, Exit 30%, Car Control 20%).  
- Sort corners by score.  
- Highlight the bottom 3 for improvement.

### 4.10 Tyre and Fuel Strategy

**Description:**  
Provides strategic recommendations based on tyre wear, fuel consumption, and lap time trends.

**Telemetry:** `TireWear`, `Fuel`, `CurrentLap`, `LapNumber`.

**Output:**  
- Tyre life estimate (laps remaining).  
- Fuel consumption rate (litres/lap).  
- A pit stop recommendation: “Pit in 3 laps for tyres.”  
- A fuel strategy: “Add 2 litres to complete race distance.”

**Implementation:**  
- Track tyre wear per lap and extrapolate to a threshold (e.g., 80% wear).  
- Track fuel consumption per lap and calculate range.  
- Provide pit stop timing advice based on tyre and fuel.

### 4.11 Traffic Analysis

**Description:**  
Analyses the impact of traffic (other cars) on lap times. Helps drivers assess whether a slow lap was due to a mistake or traffic.

**Telemetry:** `RacePosition`, `Speed`, `PositionX/Y/Z`.

**Output:**  
- A traffic impact score: percentage of laps affected by traffic.  
- A list of corners where traffic caused time loss.  
- A recommendation: “Qualify higher to avoid traffic.”

**Implementation:**  
- Detect when another car is within a certain distance (from position data).  
- Compare lap times with and without traffic.  
- Flag laps where traffic caused a time loss > 0.5s.

### 4.12 Comparative Benchmarking (Teammate/Pro)

**Description:**  
Compares the driver’s performance against a teammate or a professional reference lap. Uses data from the Telemetry Comparison module.

**Telemetry:** Reference lap data from a database or teammate.

**Output:**  
- A delta graph vs. the reference.  
- A list of strengths (where the driver is faster) and weaknesses.  
- A score: “You are 95% of the reference pace.”

**Implementation:**  
- Load reference lap data from the database.  
- Align and compare as in delta analysis.  
- Provide summary statistics.

---

## 5. Implementation Plan

### 5.1 Data Ingestion and Storage

- Parse UDP packets in real time (Dash structure).  
- Store session data in a time-series database (e.g., InfluxDB) or a structured file format (e.g., Parquet).  
- For post-session analysis, load the session data into memory.

### 5.2 Corner Segmentation (shared)

- Use corner definitions from the Line & Corner Analysis module.  
- For sector boundaries, use a pre-defined track database.

### 5.3 Core Analytics Pipeline

1. **Lap Time Analysis:**  
   - Track `CurrentLap` and store completed lap times.  
   - Compute best, worst, average, and std.

2. **Sector Time Breakdown:**  
   - Define sector boundaries.  
   - Record sector times per lap.  
   - Compute sector bests and optimal lap.

3. **Consistency Analysis:**  
   - Compute std of lap times.  
   - Compute std of sector times.  
   - Generate consistency score.

4. **Delta Analysis:**  
   - Align laps by position or distance.  
   - Compute delta vs. reference.  
   - Identify time loss per corner.

5. **Mistakes Log:**  
   - Consume mistakes from other modules.  
   - Store and summarise.

6. **Performance Score Dashboard:**  
   - Consume scores from all modules.  
   - Compute weighted average.  
   - Generate radar chart.

7. **Performance Trends:**  
   - Store session summaries.  
   - Plot trends over time.

8. **Session Summary:**  
   - Aggregate all data.  
   - Generate recommendations.

9. **Corner Ranking:**  
   - Combine module scores per corner.  
   - Sort and highlight.

10. **Tyre and Fuel Strategy:**  
    - Track tyre wear and fuel consumption.  
    - Provide pit recommendations.

11. **Traffic Analysis:**  
    - Detect nearby cars.  
    - Flag traffic-affected laps.

12. **Comparative Benchmarking:**  
    - Load reference lap.  
    - Align and compare.

### 5.4 Scoring and Weighting

- **Module Scores:** Each module provides a score (0–100%).  
- **Overall Performance Score:** Weighted average (weights can be adjusted by the user).  
- **Corner Score:** Weighted average of line, braking, exit, and car control scores per corner.  
- **Consistency Score:** 100 × (1 – (std_dev / avg_lap_time)).  
- **Traffic Impact Score:** Percentage of laps not affected by traffic.

### 5.5 Real-time vs. Post-Session

- **Real-time:**  
  - Live lap time display.  
  - Sector times with delta to best.  
  - Basic consistency tracking.  
  - Real-time delta to reference (if available).  
- **Post-session:**  
  - Full summary with all sub-features.  
  - Detailed graphs and reports.  
  - Historical trend analysis.

### 5.6 Visualisation

- **Lap Time Graph:** Lap time vs. lap number with trend line.  
- **Sector Time Graph:** Sector times per lap with best highlighted.  
- **Delta Graph:** Time difference vs. distance around the track.  
- **Radar Chart:** Module scores (Line, Braking, Exit, Car Control, Rain).  
- **Dashboard:** Cards for each module with scores and trends.  
- **Corner Ranking Table:** Sortable by score.  
- **Mistakes Log:** Filterable by corner, lap, or type.

### 5.7 Integration with Other Modules

- **All Modules:** Consume scores and mistake data.  
- **Data Flow:**  
  1. Raw telemetry → individual modules → scores and mistakes.  
  2. Scores and mistakes → Performance Analytics.  
  3. Performance Analytics → unified dashboard and reports.  
- **Feedback Loop:** Recommendations from Performance Analytics can feed back into other modules (e.g., “Focus on braking” → Braking module highlights braking-related data).

---

## 6. Technical Challenges and Mitigations

| Challenge | Mitigation |
|-----------|------------|
| **Large data volumes** | Use efficient storage (time-series DB). Limit real-time data retention to the current session. |
| **Sector boundary accuracy** | Use a curated track database with precise sector positions. |
| **Reference lap alignment** | Use distance-based alignment rather than time-based. |
| **Traffic detection** | Use `RacePosition` changes and positional data; may not be perfect in all sims. |
| **Recommendation quality** | Use rule-based heuristics initially; incorporate ML for personalised advice over time. |
| **User overwhelm** | Keep the default view simple; allow users to drill down for detail. |
| **Cross-session comparison** | Normalise for track conditions (weather, temperature) using data from other modules. |

---

## 7. Future Improvements

- **Machine learning for personalised recommendations** – train on the driver’s historical data.  
- **Predictive performance** – forecast lap times based on current trends.  
- **Race simulation** – use performance data to simulate race outcomes and suggest strategies.  
- **Cloud-based benchmarking** – compare against a global database of laps.  
- **Automated coaching** – generate a training plan based on weaknesses.  
- **Advanced traffic modelling** – integrate with multi-car telemetry for full race analysis.  
- **Voice output** – real-time performance summaries during practice.

---

## 8. Conclusion

The Performance Analytics module serves as the **intelligence centre** of the APEX application, transforming raw telemetry and module-specific scores into a clear, actionable picture of driver performance. By providing lap time analysis, sector breakdowns, consistency tracking, mistake logging, and strategic recommendations, it helps drivers answer the fundamental question: **“Where am I losing time, and what do I do about it?”**

As *Going Faster!* teaches, the difference between a good driver and a great one is often the ability to analyse, adapt, and improve systematically. Performance Analytics gives drivers the tools to do exactly that—turning data into speed.