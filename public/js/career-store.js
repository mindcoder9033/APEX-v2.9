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
    let state = null;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) state = JSON.parse(raw);
    } catch (e) {
      console.warn('[CareerStore] Could not read localStorage:', e);
    }

    if (!state) {
      state = {
        unlockedTier: 1,
        completedMilestones: [],
        stats: {
          totalStints: 0,
          totalLaps: 0,
          weatherConditionsDriven: [],
          highestMastery: 0,
          radar: {
            line: 0,
            exitSpeed: 0,
            trailBraking: 0,
            balance: 0,
            wetControl: 0,
            consistency: 0
          }
        }
      };
    } else {
      // Clean / sanitize legacy mock data if no stints have actually been logged
      if (!state.stats || state.stats.totalStints === 0) {
        state.stats = {
          totalStints: 0,
          totalLaps: 0,
          weatherConditionsDriven: [],
          highestMastery: 0,
          radar: {
            line: 0,
            exitSpeed: 0,
            trailBraking: 0,
            balance: 0,
            wetControl: 0,
            consistency: 0
          }
        };
      }
    }
    return state;
  }

  reset() {
    this.state = {
      unlockedTier: 1,
      completedMilestones: [],
      stats: {
        totalStints: 0,
        totalLaps: 0,
        weatherConditionsDriven: [],
        highestMastery: 0,
        radar: {
          line: 0,
          exitSpeed: 0,
          trailBraking: 0,
          balance: 0,
          wetControl: 0,
          consistency: 0
        }
      }
    };
    this.saveState();
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
