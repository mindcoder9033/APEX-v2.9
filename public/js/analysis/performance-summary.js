/**
 * APEX Performance Summary Engine & Recommendation Engine (Browser ES Module)
 * Implements ANALYSIS.md §10.1 (Overall Performance Score) and §10.2 (Priority Recommendations).
 *
 * Based on "Going Faster!" by the Skip Barber Racing School.
 *
 * PerformanceSummaryEngine computes a 0-100 overall score from 4 equally-weighted components:
 *   - Consistency   (lap time standard deviation)
 *   - Line Quality  (% corners without early or late apex)
 *   - Braking Score (threshold % + trail-brake overlap weighted average)
 *   - Exit Speed    (exit efficiency % + TAP score)
 *
 * RecommendationEngine generates sorted, prioritised, per-corner coaching recommendations
 * with authentic "Going Faster!" quotes across 5 categories.
 */

// ---------------------------------------------------------------------------
// Grade Scale — ANALYSIS.md §10.1
// ---------------------------------------------------------------------------

export const PERFORMANCE_GRADES = [
  { minScore: 95, grade: 'A+', label: 'Exceptional — Race-Pace Ready' },
  { minScore: 90, grade: 'A',  label: 'Excellent — Near Limit Driving' },
  { minScore: 85, grade: 'A-', label: 'Very Good — Minor Refinements Needed' },
  { minScore: 80, grade: 'B+', label: 'Good — Above Average Racecraft' },
  { minScore: 75, grade: 'B',  label: 'Competent — Clear Areas to Improve' },
  { minScore: 70, grade: 'B-', label: 'Developing — Consistent Execution Needed' },
  { minScore: 65, grade: 'C+', label: 'Average — Multiple Faults Detected' },
  { minScore: 60, grade: 'C',  label: 'Below Average — Fundamental Work Required' },
  { minScore: 55, grade: 'C-', label: 'Struggling — Focus on The Line First' },
  { minScore: 50, grade: 'D+', label: 'Significant Issues — Back to Basics' },
  { minScore: 45, grade: 'D',  label: 'Poor — Review Going Faster! Fundamentals' },
  { minScore: 0,  grade: 'F',  label: 'Critical — Safety and Technique Review Required' }
];

// ---------------------------------------------------------------------------
// PerformanceSummaryEngine
// ---------------------------------------------------------------------------

export class PerformanceSummaryEngine {
  /**
   * @param {Array<Object>} analyzedLaps  - Laps from analyzeStint() (with .lapTime, .isValid, .corners)
   * @param {Array<Object>} corners       - Best lap corner objects from CornerExtractor
   * @param {Object}        analysisResults - Full results object (brakingAnalysis, shiftingAnalysis, tireDynamics)
   */
  constructor(analyzedLaps, corners, analysisResults = {}) {
    this.laps = analyzedLaps || [];
    this.corners = corners || [];
    this.results = analysisResults;
  }

  /**
   * Generates the full performance summary.
   * @returns {Object} summary with overallScore, grade, component scores, and metadata
   */
  generateSummary() {
    const validLapTimes = this.laps
      .filter(l => l.isValid && l.lapTime > 0)
      .map(l => l.lapTime);

    const bestLapTime = validLapTimes.length > 0 ? Math.min(...validLapTimes) : 0;

    const consistency   = this.calcConsistency(validLapTimes);
    const lineQuality   = this.calcLineQuality();
    const brakingScore  = this.calcBrakingScore();
    const exitSpeedScore = this.calcExitSpeedScore();

    // 25% weight each per ANALYSIS.md §10.1
    const overallScore = Number(
      ((consistency + lineQuality + brakingScore + exitSpeedScore) / 4).toFixed(1)
    );

    return {
      bestLapTime,
      totalLaps: this.laps.length,
      validLaps: validLapTimes.length,
      overallScore,
      grade: this.calcGrade(overallScore),
      components: {
        consistency:    Number(consistency.toFixed(1)),
        lineQuality:    Number(lineQuality.toFixed(1)),
        brakingScore:   Number(brakingScore.toFixed(1)),
        exitSpeedScore: Number(exitSpeedScore.toFixed(1))
      }
    };
  }

  /** Lap time consistency — lower std dev = higher score. */
  calcConsistency(lapTimes) {
    if (lapTimes.length < 2) return 0;
    const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
    const variance = lapTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / lapTimes.length;
    return Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / avg) * 100));
  }

  /** % of corners that are neither early nor late apex. */
  calcLineQuality() {
    if (this.corners.length === 0) return 0;
    const perfectCorners = this.corners.filter(
      c => !c.dynamics?.isEarlyApex && !c.dynamics?.isLateApex
    ).length;
    return (perfectCorners / this.corners.length) * 100;
  }

  /**
   * Braking score: threshold efficiency % + trail-braking overlap %, averaged per corner.
   * Uses brakingAnalysis if available, falls back to corner dynamics.
   */
  calcBrakingScore() {
    if (this.corners.length === 0) return 0;
    let totalScore = 0;

    for (const corner of this.corners) {
      const bz = this.results.brakingAnalysis?.brakingZones?.find(
        b => b.cornerNumber === corner.cornerNumber
      );
      const thresholdPct = bz?.efficiency?.percent ?? (corner.dynamics?.peakDecelG > 0 ? 70 : 0);
      const overlap = corner.dynamics?.trailBrakingOverlapPercent ?? 0;
      const cornerScore = Math.min(100, (thresholdPct / 80) * 50 + (overlap / 50) * 50);
      totalScore += cornerScore;
    }

    return totalScore / this.corners.length;
  }

  /**
   * Exit speed score: exit efficiency % + TAP score per corner, averaged.
   * Uses corner.exitSpeed block from CornerExtractor.
   */
  calcExitSpeedScore() {
    if (this.corners.length === 0) return 0;
    let totalScore = 0;

    for (const corner of this.corners) {
      const efficiencyPct = corner.dynamics?.exitEfficiencyPercent ?? 0;
      const tapDeltaFt = Math.abs(corner.dynamics?.tapDeltaFeet ?? 0);
      const tapScore = Math.max(0, 100 - tapDeltaFt * 2);
      const cornerScore = Math.min(100, efficiencyPct * 0.6 + tapScore * 0.4);
      totalScore += cornerScore;
    }

    return totalScore / this.corners.length;
  }

  /** Maps a numeric score to a letter grade. */
  calcGrade(score) {
    for (const g of PERFORMANCE_GRADES) {
      if (score >= g.minScore) return { grade: g.grade, label: g.label };
    }
    return PERFORMANCE_GRADES[PERFORMANCE_GRADES.length - 1];
  }
}

// ---------------------------------------------------------------------------
// RecommendationEngine
// ---------------------------------------------------------------------------

export class RecommendationEngine {
  /**
   * @param {Array<Object>} corners       - Best lap corners from CornerExtractor
   * @param {Object}        analysisResults - Full results (brakingAnalysis, shiftingAnalysis, tireDynamics)
   */
  constructor(corners, analysisResults = {}) {
    this.corners = corners || [];
    this.results = analysisResults;
  }

  /**
   * Generates prioritised recommendations across all categories.
   * @returns {Array<Object>} Sorted recommendations [{category, corner, title, description, action, priority, impact, quote}]
   */
  generateRecommendations() {
    const recs = [
      ...this._exitSpeedRecs(),
      ...this._brakingRecs(),
      ...this._lineRecs(),
      ...this._shiftingRecs(),
      ...this._tireRecs()
    ];
    return this._sortAndPrioritize(recs);
  }

  // --- Exit Speed (ANALYSIS.md §5) ---
  _exitSpeedRecs() {
    const recs = [];
    for (const corner of this.corners) {
      const es = corner.exitSpeed;
      if (!es || es.potentialGainMph <= 2) continue;

      recs.push({
        category: 'Exit Speed',
        corner: corner.cornerNumber,
        title: `Increase exit speed at Turn ${corner.cornerNumber}`,
        description: `Exit speed ${(corner.speed?.exitMph || 0).toFixed(1)} mph — ${es.exitEfficiencyPercent}% of theoretical maximum. Potential: +${es.potentialGainMph.toFixed(1)} mph.`,
        action: 'Apply throttle earlier as you unwind the steering wheel. Squeeze the power on progressively rather than stabbing it.',
        priority: es.isTypeI ? 1 : 2,
        impact: es.potentialGainSeconds || 0.3,
        quote: '"The biggest gain in lap time comes from corner exit speed." — Going Faster!, Ch.1'
      });
    }
    return recs;
  }

  // --- Braking (ANALYSIS.md §6) ---
  _brakingRecs() {
    const recs = [];
    const brakingData = this.results.brakingAnalysis?.brakingZones || [];

    for (const bz of brakingData) {
      if (bz.efficiency?.percent < 75) {
        recs.push({
          category: 'Braking',
          corner: bz.cornerNumber,
          title: `Improve threshold braking at Turn ${bz.cornerNumber}`,
          description: `Using ${bz.efficiency.percent}% of available braking capability (${bz.gForces.peakDecelG.toFixed(2)}G peak).`,
          action: 'Push harder on the brake pedal. Commit to maximum straight-line deceleration before the turn-in, then trail it off progressively.',
          priority: bz.efficiency.percent < 60 ? 1 : 2,
          impact: 0.2,
          quote: '"If you\'re braking at the 300 mark with no problem, you\'ve got to take small steps to find where that limit is." — Danny Sullivan, Going Faster!, Ch.1'
        });
      }
    }

    // Trail-braking overlap from corner dynamics
    for (const corner of this.corners) {
      const overlap = corner.dynamics?.trailBrakingOverlapPercent ?? 100;
      if (overlap < 30 && (corner.inputs?.peakBrakePressure ?? 0) > 0.30) {
        recs.push({
          category: 'Trail-Braking',
          corner: corner.cornerNumber,
          title: `Improve trail-braking at Turn ${corner.cornerNumber}`,
          description: `Only ${overlap}% brake-steering overlap between turn-in and apex (${corner.dynamics?.trailBrakeQualityLabel || 'POOR'}).`,
          action: 'Carry brake pressure past the turn-in point. Gradually release as you increase steering lock — the two inputs should be complementary.',
          priority: overlap < 15 ? 1 : 2,
          impact: 0.15,
          quote: '"The question is not if you\'re going to trail-brake, but how." — Going Faster!, Ch.5'
        });
      }
    }

    return recs;
  }

  // --- Line (ANALYSIS.md §4.4) ---
  _lineRecs() {
    const recs = [];

    for (const corner of this.corners) {
      if (corner.dynamics?.isEarlyApex) {
        recs.push({
          category: 'Line',
          corner: corner.cornerNumber,
          title: `Correct early apex at Turn ${corner.cornerNumber}`,
          description: `Steering correction of +${corner.dynamics.postApexSteerCorrectionDeg.toFixed(1)}° detected after apex — classic early apex signature.`,
          action: 'Turn in later. Target a deeper apex point. Hold steering steady through the corner and let the car use all the track at exit.',
          priority: 1,
          impact: 0.25,
          quote: '"The primary symptom of early apexing is the need to increase the amount of steering effort past the apex." — Going Faster!, Ch.2'
        });
      }

      if (corner.dynamics?.isLateApex) {
        recs.push({
          category: 'Line',
          corner: corner.cornerNumber,
          title: `Correct late apex at Turn ${corner.cornerNumber}`,
          description: `Premature steering unwind with unused track at exit. Speed sacrificed (apex ${(corner.speed?.apexMph || 0).toFixed(1)} mph).`,
          action: 'Turn in slightly earlier. Move the apex point forward to carry a higher minimum rolling speed.',
          priority: 2,
          impact: 0.15,
          quote: '"If there is road left at the exit of the corner, you have chosen a turn-in and apex that were too late." — Going Faster!, Ch.2'
        });
      }
    }

    return recs;
  }

  // --- Shifting (ANALYSIS.md §8) ---
  _shiftingRecs() {
    const recs = [];
    const shiftData = this.results.shiftingAnalysis?.cornerShifting || [];

    for (const s of shiftData) {
      if (!s.issue || s.issue.severity === 'LOW') continue;

      const isHigh = s.issue.severity === 'HIGH';
      recs.push({
        category: 'Shifting',
        corner: s.cornerNumber,
        title: s.issue.issue,
        description: s.issue.message,
        action: s.issue.issue?.toLowerCase().includes('high')
          ? 'Downshift one gear in the braking zone to exit the corner in the powerband.'
          : 'Use a taller gear. Upshift before corner entry to avoid hitting the rev limiter on exit.',
        priority: isHigh ? 1 : 2,
        impact: 0.2,
        quote: '"You downshift to get the car in the proper gear to exit the corner." — Going Faster!, Ch.6'
      });
    }

    return recs;
  }

  // --- Tire Management (ANALYSIS.md §7) ---
  _tireRecs() {
    const recs = [];
    const tireFindings = this.results.tireDynamics?.findings || [];

    for (const finding of tireFindings) {
      const isHigh = finding.severity === 'High';
      if (!isHigh && finding.severity !== 'Medium') continue;

      recs.push({
        category: 'Tire Management',
        corner: 'All',
        title: finding.title,
        description: finding.description,
        action: this._tireAction(finding.id),
        priority: isHigh ? 1 : 2,
        impact: 0.1,
        quote: '"The driver that has the most grip runs tires at their optimum temperature range." — Going Faster!, Ch.13'
      });
    }

    return recs;
  }

  _tireAction(findingId) {
    if (findingId === 'R-009-TIRE') return 'Be more progressive with throttle application on corner exits. Squeeze the power on rather than stabbing it.';
    if (findingId === 'TIRE-COLD')  return 'Work the tires harder on the out-lap. More aggressive cornering and braking will build heat into the rubber.';
    if (findingId === 'TIRE-OVERHEAT') return 'Drive more smoothly. Reduce wheelspin, sliding, and late braking. Consider adjusting tire pressures.';
    return 'Monitor tire performance and adjust driving style to keep tires in their optimal operating window.';
  }

  /** Sort by priority (1=high) then by impact seconds (highest first). */
  _sortAndPrioritize(recs) {
    return recs.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.impact - a.impact;
    });
  }
}
