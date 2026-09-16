/**
 * APEX Career Mode Store
 * Local storage manager for Going Faster driver progression, licenses, and skill radar.
 */

import { CAREER_TIERS } from './career-curriculum.js';
import { LicenseEvaluator } from './license-evaluator.js';

export class CareerStore {
  constructor() {
    this.storageKey = 'apex_v3_career_profile';
    this.state = this._loadState();
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[CareerStore] Could not read localStorage:', e);
    }
    return {
      unlockedTier: 1,
      completedMilestones: [],
      stats: {
        totalStints: 0,
        totalLaps: 0,
        weatherConditionsDriven: [],
        highestMastery: 82,
        radar: {
          line: 82,
          exitSpeed: 78,
          trailBraking: 72,
          balance: 85,
          wetControl: 65,
          consistency: 80
        }
      }
    };
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[CareerStore] Storage write failed:', e);
    }
  }

  /**
   * Process a recorded stint from Pit Wall and update career milestones
   * @param {Object} stint
   * @returns {Array<Object>} Newly unlocked milestones
   */
  processStint(stint) {
    const result = LicenseEvaluator.evaluateStint(stint, this.state);
    this.state = result.state;
    this.saveState();
    return result.newlyUnlocked;
  }

  getState() {
    return this.state;
  }

  getTiers() {
    return CAREER_TIERS;
  }
}

export const globalCareerStore = new CareerStore();
