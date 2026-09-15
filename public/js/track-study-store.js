/**
 * APEX Track Study Store
 * Persists driver-customized reference markers, notes, and study progress.
 * Backed by localStorage (apex_track_study_v1).
 */

const STORAGE_KEY = 'apex_track_study_v1';

export class TrackStudyStore {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.cache = null;
  }

  /**
   * Loads all track study records from localStorage
   * @returns {Object} Map of trackId -> Study Record
   */
  getAllStudies() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.cache || {};
      }
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      this.cache = (typeof data === 'object' && data !== null) ? data : {};
      return this.cache;
    } catch (err) {
      console.error('[TRACK STUDY STORE] Error reading localStorage:', err);
      return this.cache || {};
    }
  }

  /**
   * Gets study data for a specific track ID
   * @param {string} trackId 
   * @returns {Object|null}
   */
  getStudy(trackId) {
    if (!trackId) return null;
    const all = this.getAllStudies();
    return all[trackId] || null;
  }

  /**
   * Saves or updates corner study details (notes, reference markers, target speed adjustments)
   * @param {string} trackId 
   * @param {number} turnIndex 
   * @param {Object} cornerData 
   * @returns {Object}
   */
  saveCornerStudy(trackId, turnIndex, cornerData) {
    if (!trackId || turnIndex === undefined) return null;
    const all = this.getAllStudies();
    
    if (!all[trackId]) {
      all[trackId] = {
        trackId,
        updatedAt: new Date().toISOString(),
        corners: {}
      };
    }

    all[trackId].corners[turnIndex] = {
      ...(all[trackId].corners[turnIndex] || {}),
      ...cornerData,
      updatedAt: new Date().toISOString()
    };
    all[trackId].updatedAt = new Date().toISOString();

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(all));
      }
      this.cache = all;
    } catch (err) {
      console.error('[TRACK STUDY STORE] Error saving to storage:', err);
    }

    return all[trackId];
  }

  /**
   * Resets customized notes for a track
   * @param {string} trackId 
   */
  resetStudy(trackId) {
    if (!trackId) return;
    const all = this.getAllStudies();
    delete all[trackId];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(all));
      }
      this.cache = all;
    } catch (err) {
      console.error('[TRACK STUDY STORE] Error resetting storage:', err);
    }
  }
}

export const trackStudyStore = new TrackStudyStore();
