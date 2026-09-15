/**
 * APEX Track Study Store
 * Persists driver-customized reference markers, notes, 4-block telemetry boundaries,
 * and track editor geometry overrides.
 * Backed by localStorage (apex_track_study_v1).
 */

const STORAGE_KEY = 'apex_track_study_v1';
const EDITOR_STORAGE_KEY = 'apex_track_editor_v1';

export class TrackStudyStore {
  constructor(storageKey = STORAGE_KEY, editorKey = EDITOR_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.editorKey = editorKey;
    this.cache = null;
    this.editorCache = null;
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
   * Loads all track editor overrides from localStorage
   * @returns {Object}
   */
  getAllEditorModels() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.editorCache || {};
      }
      const raw = window.localStorage.getItem(this.editorKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      this.editorCache = (typeof data === 'object' && data !== null) ? data : {};
      return this.editorCache;
    } catch (err) {
      console.error('[TRACK EDITOR STORE] Error reading editor storage:', err);
      return this.editorCache || {};
    }
  }

  /**
   * Retrieves editor model for a specific circuit
   * @param {string} trackId 
   * @returns {Object|null}
   */
  getEditorModel(trackId) {
    if (!trackId) return null;
    const all = this.getAllEditorModels();
    return all[trackId] || null;
  }

  /**
   * Saves full track editor geometry, corner classifications, 4-block brackets, and rain lines
   * @param {string} trackId 
   * @param {Object} editorData 
   * @returns {Object}
   */
  saveTrackEditorModel(trackId, editorData) {
    if (!trackId || !editorData) return null;
    const all = this.getAllEditorModels();
    
    all[trackId] = {
      trackId,
      updatedAt: new Date().toISOString(),
      ...editorData
    };

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.editorKey, JSON.stringify(all));
      }
      this.editorCache = all;
    } catch (err) {
      console.error('[TRACK EDITOR STORE] Error saving editor model:', err);
    }

    return all[trackId];
  }

  /**
   * Resets all custom edits for a track back to default telemetry
   * @param {string} trackId 
   */
  resetEditorModel(trackId) {
    if (!trackId) return;
    const all = this.getAllEditorModels();
    delete all[trackId];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.editorKey, JSON.stringify(all));
      }
      this.editorCache = all;
    } catch (err) {
      console.error('[TRACK EDITOR STORE] Error resetting editor storage:', err);
    }
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
