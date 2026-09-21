/**
 * APEX Skills Hub - Persistent Driver Attempt Store & Evolution Matrix
 * Stores driver attempts, computes rolling averages, mastery progression, and habit diagnostics.
 */

const STORAGE_KEY_PREFIX = 'apex_skills_attempts_';

export class SkillsStore {
  constructor() {
    this.currentDriverId = 'driver_01';
    this.attempts = [];
    this.listeners = new Set();
    this.loadDriverAttempts(this.currentDriverId);
  }

  /**
   * Set active driver profile and load their attempt records
   * @param {string} driverId 
   */
  setDriver(driverId) {
    if (!driverId || driverId === this.currentDriverId) return;
    this.currentDriverId = driverId;
    this.loadDriverAttempts(driverId);
    this._notifyListeners();
  }

  /**
   * Load attempts from localStorage
   * @param {string} driverId 
   */
  loadDriverAttempts(driverId) {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${driverId}`);
        if (raw) {
          this.attempts = JSON.parse(raw);
          return;
        }
      }
      this.attempts = [];
      this._generateInitialSeedAttempts(driverId);
    } catch (e) {
      console.warn('[SkillsStore] Failed to parse stored attempts:', e);
      this.attempts = [];
    }
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${this.currentDriverId}`, JSON.stringify(this.attempts));
      }
      this._notifyListeners();
    } catch (e) {
      console.error('[SkillsStore] Failed to save attempts:', e);
    }
  }

  /**
   * Record a new corner attempt evaluation
   * @param {Object} evaluation - Evaluation object from SkillsEvaluator
   * @param {Object} metadata - Track, Car, Lap, Stint metadata
   */
  recordAttempt(evaluation, metadata = {}) {
    if (!evaluation || !evaluation.skills) return null;

    const attemptRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      stintId: metadata.stintId || `stint_${new Date().toISOString().slice(0, 10)}`,
      timestamp: Date.now(),
      driverId: this.currentDriverId,
      trackName: metadata.trackName || 'Sebring International Raceway',
      carName: metadata.carName || 'Dodge Viper GTS-R',
      lapNumber: metadata.lapNumber || 1,
      cornerId: evaluation.cornerId || 'T1',
      cornerName: evaluation.cornerName || 'Turn 1',
      cornerType: evaluation.cornerType || 'Type I (Exit Priority)',
      overallScore: evaluation.overallScore || 0,
      grade: evaluation.grade || 'C',
      skills: evaluation.skills,
      summary: evaluation.summary || ''
    };

    this.attempts.unshift(attemptRecord); // newest first

    // Keep max 500 attempts per driver to prevent memory bloat
    if (this.attempts.length > 500) {
      this.attempts = this.attempts.slice(0, 500);
    }

    this.save();
    return attemptRecord;
  }

  /**
   * Get all attempts with optional filtering
   * @param {Object} filter - { skillId, cornerId, trackName, stintId, grade, limit }
   */
  getAttempts(filter = {}) {
    let list = [...this.attempts];

    if (filter.stintId && filter.stintId !== 'ALL') {
      list = list.filter(a => (a.stintId === filter.stintId || a.trackName === filter.stintId));
    }
    if (filter.cornerId && filter.cornerId !== 'ALL') {
      list = list.filter(a => a.cornerId === filter.cornerId);
    }
    if (filter.trackName && filter.trackName !== 'ALL') {
      list = list.filter(a => a.trackName.toLowerCase().includes(filter.trackName.toLowerCase()));
    }
    if (filter.grade && filter.grade !== 'ALL') {
      list = list.filter(a => a.grade === filter.grade);
    }
    if (filter.skillId && filter.skillId !== 'ALL') {
      list = list.filter(a => a.skills && a.skills[filter.skillId]);
    }
    if (filter.limit) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  /**
   * Extract distinct stints recorded in the attempts history
   */
  getStintsList() {
    const stintMap = new Map();

    this.attempts.forEach(a => {
      const sId = a.stintId || a.trackName || 'General Stint';
      if (!stintMap.has(sId)) {
        stintMap.set(sId, {
          stintId: sId,
          trackName: a.trackName,
          carName: a.carName,
          timestamp: a.timestamp,
          attemptsCount: 0,
          totalScore: 0,
          bestScore: 0
        });
      }
      const item = stintMap.get(sId);
      item.attemptsCount++;
      item.totalScore += a.overallScore;
      if (a.overallScore > item.bestScore) item.bestScore = a.overallScore;
    });

    return Array.from(stintMap.values()).map(s => ({
      ...s,
      avgScore: Math.round(s.totalScore / s.attemptsCount)
    }));
  }

  /**
   * Calculate cumulative mastery scores (0-100) and progression stats for all Chapter 1 skills
   */
  getMasteryStats() {
    const skillKeys = [
      'ch1-exit-speed',
      'ch1-the-line',
      'ch1-threshold-braking',
      'ch1-combined-entry',
      'ch1-platform-stability'
    ];

    const stats = {};
    const totalAttemptsCount = this.attempts.length;

    skillKeys.forEach(k => {
      const skillAttempts = this.attempts.filter(a => a.skills && a.skills[k]);
      if (skillAttempts.length === 0) {
        stats[k] = {
          currentScore: 0,
          rollingAvg5: 0,
          rollingAvg20: 0,
          bestScore: 0,
          trend: 'neutral',
          deltaScore: 0,
          totalAttempts: 0
        };
        return;
      }

      const scores = skillAttempts.map(a => a.skills[k].score);
      const bestScore = Math.max(...scores);
      const recent5 = scores.slice(0, 5);
      const recent20 = scores.slice(0, 20);

      const avg5 = Math.round(recent5.reduce((a, b) => a + b, 0) / recent5.length);
      const avg20 = Math.round(recent20.reduce((a, b) => a + b, 0) / recent20.length);

      // Trend calculation (recent 5 vs prior 5)
      let trend = 'neutral';
      let delta = 0;
      if (scores.length >= 10) {
        const prior5 = scores.slice(5, 10);
        const avgPrior5 = Math.round(prior5.reduce((a, b) => a + b, 0) / prior5.length);
        delta = avg5 - avgPrior5;
        if (delta > 2) trend = 'improving';
        else if (delta < -2) trend = 'declining';
      }

      stats[k] = {
        currentScore: avg5,
        rollingAvg5: avg5,
        rollingAvg20: avg20,
        bestScore,
        trend,
        deltaScore: delta,
        totalAttempts: skillAttempts.length
      };
    });

    const overallRolling = Math.round(
      (stats['ch1-exit-speed'].rollingAvg5 * 0.35) +
      (stats['ch1-the-line'].rollingAvg5 * 0.25) +
      (stats['ch1-threshold-braking'].rollingAvg5 * 0.15) +
      (stats['ch1-combined-entry'].rollingAvg5 * 0.15) +
      (stats['ch1-platform-stability'].rollingAvg5 * 0.10)
    );

    return {
      totalAttempts: totalAttemptsCount,
      overallMasteryScore: overallRolling,
      grade: this._scoreToGrade(overallRolling),
      skills: stats
    };
  }

  /**
   * Compute Habit Diagnostics & Coach Feedback
   */
  getHabitDiagnostics() {
    if (this.attempts.length < 3) {
      return [
        { type: 'info', title: 'Telemetry Calibration', message: 'Complete at least 3 corner attempts in live session or replay to unlock habit evolution analytics.' }
      ];
    }

    const insights = [];
    const exitSpeedAttempts = this.attempts.filter(a => a.skills && a.skills['ch1-exit-speed']);
    const stabilityAttempts = this.attempts.filter(a => a.skills && a.skills['ch1-platform-stability']);
    const brakingAttempts = this.attempts.filter(a => a.skills && a.skills['ch1-threshold-braking']);

    // Check throttle hesitation habit
    if (exitSpeedAttempts.length >= 5) {
      const recentHesitations = exitSpeedAttempts.slice(0, 5).reduce((acc, a) => acc + (a.skills['ch1-exit-speed'].metrics?.throttleHesitations || 0), 0);
      if (recentHesitations === 0) {
        insights.push({
          type: 'positive',
          title: 'Clean Throttle Commitment',
          message: 'Zero mid-corner throttle hesitations in the last 5 attempts. Optimal exit speed execution.'
        });
      } else {
        insights.push({
          type: 'warning',
          title: 'Hesitant Exit Roll-On',
          message: `Detected ${recentHesitations} throttle hesitations over the last 5 attempts. Squeeze the accelerator progressively without stuttering.`
        });
      }
    }

    // Check throttle lifting habit
    if (stabilityAttempts.length >= 5) {
      const recentLifts = stabilityAttempts.slice(0, 5).reduce((acc, a) => acc + (a.skills['ch1-platform-stability'].metrics?.throttleLifts || 0), 0);
      if (recentLifts > 2) {
        insights.push({
          type: 'danger',
          title: 'Habitual Throttle Lifting',
          message: 'Careless mid-corner throttle lifting detected. Abrupt lifts unweight rear tires; maintain maintenance throttle.'
        });
      }
    }

    // Check braking firmness
    if (brakingAttempts.length >= 5) {
      const avgPressure = Math.round(
        brakingAttempts.slice(0, 5).reduce((acc, a) => acc + (a.skills['ch1-threshold-braking'].metrics?.peakBrakePressurePercent || 0), 0) / 5
      );
      if (avgPressure >= 85) {
        insights.push({
          type: 'positive',
          title: 'Firm Threshold Deceleration',
          message: `Average initial braking pressure is ${avgPressure}%. Solid straight-line stopping discipline.`
        });
      }
    }

    return insights;
  }

  /**
   * Generate CSV content for exporting attempts
   * @param {Object} filter
   */
  exportCsv(filter = {}) {
    const attempts = this.getAttempts(filter);
    const headers = [
      'Timestamp',
      'Date Time',
      'Track',
      'Car',
      'Lap',
      'Corner ID',
      'Corner Name',
      'Corner Type',
      'Overall Score',
      'Grade',
      'Exit Speed Score',
      'The Line Score',
      'Threshold Braking Score',
      'Combined Entry Score',
      'Platform Stability Score',
      'Coaching Summary'
    ];

    const rows = attempts.map(a => [
      a.timestamp,
      `"${new Date(a.timestamp).toISOString()}"`,
      `"${a.trackName}"`,
      `"${a.carName}"`,
      a.lapNumber,
      `"${a.cornerId}"`,
      `"${a.cornerName}"`,
      `"${a.cornerType}"`,
      a.overallScore,
      `"${a.grade}"`,
      a.skills?.['ch1-exit-speed']?.score ?? '',
      a.skills?.['ch1-the-line']?.score ?? '',
      a.skills?.['ch1-threshold-braking']?.score ?? '',
      a.skills?.['ch1-combined-entry']?.score ?? '',
      a.skills?.['ch1-platform-stability']?.score ?? '',
      `"${(a.summary || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Clear attempts for current driver
   */
  clearAttempts() {
    this.attempts = [];
    this.save();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notifyListeners() {
    this.listeners.forEach(fn => {
      try { fn(this.attempts); } catch (e) { console.error(e); }
    });
  }

  _scoreToGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  _generateInitialSeedAttempts(driverId) {
    const seedCorners = [
      { id: 'T9', name: 'Turn 9 (Carousel)', type: 'Type I (Exit Priority)' },
      { id: 'T10', name: 'Turn 10 (Hairpin)', type: 'Type I (Exit Priority)' },
      { id: 'T1', name: 'Turn 1 (Fast Sweeper)', type: 'Type II (Entry Priority)' },
      { id: 'T5', name: 'Turn 5 (S-Bend)', type: 'Type III (Sacrifice Corner)' }
    ];

    const baseScores = [
      { exit: 88, line: 84, brake: 90, trail: 82, stab: 95 },
      { exit: 78, line: 80, brake: 72, trail: 75, stab: 70 },
      { exit: 92, line: 89, brake: 88, trail: 86, stab: 100 },
      { exit: 84, line: 82, brake: 85, trail: 80, stab: 90 }
    ];

    seedCorners.forEach((c, idx) => {
      const s = baseScores[idx];
      const overall = Math.round(s.exit * 0.35 + s.line * 0.25 + s.brake * 0.15 + s.trail * 0.15 + s.stab * 0.10);
      this.attempts.push({
        id: `seed_${idx}`,
        stintId: 'stint_sebring_demo_01',
        timestamp: Date.now() - ((4 - idx) * 120000),
        driverId,
        trackName: 'Sebring International Raceway',
        carName: 'Dodge Viper GTS-R',
        lapNumber: idx + 1,
        cornerId: c.id,
        cornerName: c.name,
        cornerType: c.type,
        overallScore: overall,
        grade: this._scoreToGrade(overall),
        skills: {
          'ch1-exit-speed': {
            score: s.exit,
            grade: this._scoreToGrade(s.exit),
            feedback: 'Progressive throttle squeeze down the straight.',
            metrics: { speedGainKmh: 14.2, timeToFullThrottleSec: 0.38, throttleHesitations: 0 }
          },
          'ch1-the-line': {
            score: s.line,
            grade: this._scoreToGrade(s.line),
            feedback: 'Consistent cornering arc through apex.',
            metrics: { minApexSpeedKmh: 68.4, steeringFluctuation: 0.042 }
          },
          'ch1-threshold-braking': {
            score: s.brake,
            grade: this._scoreToGrade(s.brake),
            feedback: 'Firm initial deceleration.',
            metrics: { peakBrakePressurePercent: 88, peakDecelG: 1.34, rampTimeSec: 0.22, lockupDetected: false }
          },
          'ch1-combined-entry': {
            score: s.trail,
            grade: this._scoreToGrade(s.trail),
            feedback: 'Smooth brake bleed off on turn-in.',
            metrics: { peakCombinedG: 1.42, trailBrakingOverlapPercent: 42 }
          },
          'ch1-platform-stability': {
            score: s.stab,
            grade: this._scoreToGrade(s.stab),
            feedback: 'Stable chassis balance with no mid-corner throttle lifting.',
            metrics: { throttleLifts: 0, maxJerkGPerSec: 6.8 }
          }
        },
        summary: 'Solid execution of Chapter 1 fundamentals.'
      });
    });

    this.save();
  }
}

export const skillsStore = new SkillsStore();
