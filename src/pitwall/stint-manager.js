/**
 * APEX Pit Wall Stint Manager
 * Central Stint repository & Going Faster Telemetry aggregator.
 * Integrates Friction Circle, Corner Typology (Type I/II/III), Trail Braking, and Car Balance.
 */

import { FrictionCircleAnalyzer } from '../analysis/friction-circle.js';
import { CornerClassifier } from '../analysis/going-faster/corner-classifier.js';
import { TrailBrakingAnalyzer } from '../analysis/going-faster/trail-braking.js';
import { CarBalanceAnalyzer } from '../analysis/going-faster/car-balance.js';
import { globalStintDispatcher } from './stint-dispatcher.js';

export class StintManager {
  constructor(options = {}) {
    this.stints = new Map();
    this.activeStint = null;
    this.storageKey = options.storageKey || 'apex_v3_stints_vault';
  }

  /**
   * Initializes or creates a new recording stint in Pit Wall
   * @param {Object} metadata
   * @returns {Object} Stint
   */
  startStint(metadata = {}) {
    const stintId = `stint_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.activeStint = {
      id: stintId,
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      driverName: metadata.driverName || 'APEX Driver',
      trackName: metadata.trackName || 'Maple Valley',
      trackId: metadata.trackId || 'maple-valley',
      carName: metadata.carName || '2023 GT3 Racecar',
      carClass: metadata.carClass || 'S',
      carPI: metadata.carPI || 798,
      weatherPreset: metadata.weatherPreset || 'Clear (Day)',
      laps: [],
      samples: [],
      bestLap: null,
      analysis: null,
      status: 'recording'
    };
    return this.activeStint;
  }

  /**
   * Saves and finalizes a stint, performing complete Going Faster analysis and dispatching events.
   * @param {Object} rawStint
   * @returns {Promise<Object>} Analyzed Stint
   */
  async finalizeAndSaveStint(rawStint) {
    const stint = rawStint || this.activeStint;
    if (!stint) throw new Error('No active stint to finalize');

    // 1. Friction Circle Analysis
    const fcAnalyzer = new FrictionCircleAnalyzer(stint.samples || []);
    const frictionCircleData = fcAnalyzer.generateFrictionCircle();

    // 2. Car Balance Analysis
    const carBalance = CarBalanceAnalyzer.analyzeBalance(stint.samples || []);

    // 3. Corner Classification & Trail Braking
    const classifiedCorners = stint.corners
      ? CornerClassifier.classifyLapCorners(stint.corners, stint.samples)
      : [];

    let overallTrailBrakingScore = 80;
    if (stint.samples && stint.samples.length > 50) {
      const tbResult = TrailBrakingAnalyzer.analyzeEntry(stint.samples.slice(0, 300));
      overallTrailBrakingScore = tbResult.score;
    }

    // 4. Calculate Skip Barber Consistency & Mastery Rating
    const lapTimes = (stint.laps || []).map(l => l.lapTimeSeconds || l.timeSec).filter(t => t > 0);
    let consistencyScore = 88;
    if (lapTimes.length > 1) {
      const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
      const variance = lapTimes.reduce((a, t) => a + Math.pow(t - avg, 2), 0) / lapTimes.length;
      const stdDev = Math.sqrt(variance);
      consistencyScore = Math.max(50, Math.min(99, Math.round(100 - (stdDev * 10))));
    }

    stint.analysis = {
      frictionCircle: frictionCircleData,
      carBalance,
      classifiedCorners,
      trailBrakingScore: overallTrailBrakingScore,
      consistencyScore,
      goingFasterMasteryIndex: Math.round((frictionCircleData.utilization.highUtilization * 0.4) + (overallTrailBrakingScore * 0.3) + (consistencyScore * 0.3))
    };

    stint.status = 'saved';
    this.stints.set(stint.id, stint);

    // 5. Notify all listeners (triggers Feature 1, Feature 2, Feature 5)
    await globalStintDispatcher.emit('stint:saved', stint);

    return stint;
  }

  getStint(stintId) {
    return this.stints.get(stintId) || null;
  }

  getAllStints() {
    return Array.from(this.stints.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const globalStintManager = new StintManager();
