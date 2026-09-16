/**
 * APEX Pit Wall Browser Hub & Stint Dispatcher
 * Manages stint persistence in localStorage, Going Faster analytics pipeline,
 * and automated PDF export dispatchers.
 */

import { FrictionCircleAnalyzer } from './analysis/friction-circle.js';
import { CornerClassifier } from './analysis/going-faster/corner-classifier.js';
import { TrailBrakingAnalyzer } from './analysis/going-faster/trail-braking.js';
import { CarBalanceAnalyzer } from './analysis/going-faster/car-balance.js';

class PitWallDispatcher {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) this.listeners.get(event).delete(callback);
  }

  async emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const cb of this.listeners.get(event)) {
      try {
        await cb(data);
      } catch (err) {
        console.error(`[PitWallDispatcher] Error in listener for ${event}:`, err);
      }
    }
  }
}

export const pitWallDispatcher = new PitWallDispatcher();

export class PitWallHub {
  constructor() {
    this.storageKey = 'apex_v3_pitwall_stints';
    this.stints = this._loadStints();
  }

  _loadStints() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  _saveStints() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stints.slice(0, 30)));
    } catch (e) {
      console.warn('[PitWallHub] Storage write error:', e);
    }
  }

  /**
   * Process raw stint samples with Going Faster math and store into Pit Wall.
   * @param {Object} rawStint
   * @returns {Object} Stint
   */
  async processAndSaveStint(rawStint) {
    const stint = {
      id: rawStint.id || `stint_${Date.now()}`,
      timestamp: rawStint.timestamp || Date.now(),
      dateFormatted: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      driverName: rawStint.driverName || 'APEX Driver',
      trackName: rawStint.trackName || 'Maple Valley',
      trackId: rawStint.trackId || 'maple-valley',
      carName: rawStint.carName || '2023 GT3 Racecar',
      carClass: rawStint.carClass || 'S',
      carPI: rawStint.carPI || 798,
      weatherPreset: rawStint.weatherPreset || 'Clear (Day)',
      lapCount: rawStint.laps?.length || rawStint.lapCount || 1,
      bestLapTime: rawStint.bestLapTime || '1:32.450',
      samples: rawStint.samples || []
    };

    // 1. Friction Circle Analysis
    const fcAnalyzer = new FrictionCircleAnalyzer(stint.samples);
    const frictionCircleData = fcAnalyzer.generateFrictionCircle();

    // 2. Car Balance Analysis
    const carBalance = CarBalanceAnalyzer.analyzeBalance(stint.samples);

    // 3. Trail Braking
    const trailBraking = TrailBrakingAnalyzer.analyzeEntry(stint.samples.slice(0, 300));

    // 4. Going Faster Composite Rating
    const masteryIndex = Math.min(99, Math.round((frictionCircleData.utilization.highUtilization * 0.45) + (trailBraking.score * 0.35) + (carBalance.stabilityScore * 0.20)));

    stint.analysis = {
      frictionCircle: frictionCircleData,
      carBalance,
      trailBraking,
      masteryIndex
    };

    // Prepend to catalog
    this.stints.unshift(stint);
    this._saveStints();

    // Notify all subscribers
    await pitWallDispatcher.emit('stint:saved', stint);

    return stint;
  }

  getAllStints() {
    return this.stints;
  }
}

export const globalPitWallHub = new PitWallHub();
