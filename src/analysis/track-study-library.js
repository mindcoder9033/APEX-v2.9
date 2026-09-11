/**
 * APEX Track Study Library & Store
 * Independent Track Study knowledge store and FM23 track catalog manager.
 * Persists per-track study progression (unlocked stages, completed debriefings)
 * and parsed telemetry corners without any synthetic or mock corner data.
 */

import { FM23_TRACKS } from '../data/fm23-tracks.js';

const STUDY_STORAGE_KEY = 'apex_track_study_library_v1';

export class TrackStudyLibrary {
  constructor(storageKey = STUDY_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.catalog = [];
    this._buildCatalog();
  }

  /**
   * Builds the comprehensive catalog of all 29 locations / 71+ layouts from Docs/FM23 Tracks.md
   */
  _buildCatalog() {
    const list = [];
    FM23_TRACKS.forEach(loc => {
      const locName = loc.name;
      const type = loc.type || 'Real';
      (loc.layouts || []).forEach(layout => {
        const layoutName = layout.name;
        const officialLength = layout.length;
        const trackId = this._slugify(locName, layoutName);
        
        let lengthKm = 4.0;
        const numMatch = officialLength.match(/([0-9.]+)/);
        if (numMatch) lengthKm = parseFloat(numMatch[1]);
        const lengthMeters = Math.round(lengthKm * 1000);

        list.push({
          trackId,
          trackName: locName,
          layoutName: layoutName,
          type: type,
          officialLength: officialLength,
          lengthMeters: lengthMeters,
          displayName: `${locName} — ${layoutName} (${officialLength})`
        });
      });
    });
    this.catalog = list;
  }

  _slugify(trackName, layoutName) {
    const s1 = String(trackName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const s2 = String(layoutName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `${s1}--${s2}`;
  }

  /**
   * Retrieves all catalog track entries
   * @returns {Array<Object>}
   */
  getAllCatalogTracks() {
    return this.catalog;
  }

  /**
   * Retrieves a track study profile.
   * If telemetry has previously populated corners for this track, returns them;
   * otherwise returns an empty corner profile with 0 mock data.
   * @param {string} trackId 
   * @returns {Object} Track study profile
   */
  getTrackStudyProfile(trackId) {
    const found = this.catalog.find(t => t.trackId === trackId) || this.catalog[0];
    if (!found) return null;

    // Check if real corners were previously parsed from telemetry and stored
    const savedState = this.getTrackStudyState(found.trackId);
    if (savedState && Array.isArray(savedState.corners) && savedState.corners.length > 0) {
      return {
        ...found,
        turnsCount: savedState.corners.length,
        corners: savedState.corners
      };
    }

    // Default: No mock corners. Real telemetry parsing will populate corners when driven.
    return {
      ...found,
      turnsCount: 0,
      corners: []
    };
  }

  /**
   * Loads saved study progression and telemetry corners for a track
   * @param {string} trackId 
   * @returns {Object}
   */
  getTrackStudyState(trackId) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.inMemoryStore?.[trackId] || { unlockedPhases: [1], lapsCompleted: 0, lastPhase: 1, corners: [] };
      }
      const raw = window.localStorage.getItem(`${this.storageKey}_${trackId}`);
      if (!raw) {
        return { unlockedPhases: [1], lapsCompleted: 0, lastPhase: 1, corners: [] };
      }
      const parsed = JSON.parse(raw);
      if (parsed.lapsCompleted === undefined) {
        parsed.lapsCompleted = Array.isArray(parsed.completedDebriefings) ? parsed.completedDebriefings.length : 0;
      }
      return parsed;
    } catch (e) {
      return { unlockedPhases: [1], lapsCompleted: 0, lastPhase: 1, corners: [] };
    }
  }

  /**
   * Saves study progression and telemetry corners for a track
   * @param {string} trackId 
   * @param {Object} state 
   */
  saveTrackStudyState(trackId, state) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        if (!this.inMemoryStore) this.inMemoryStore = {};
        this.inMemoryStore[trackId] = state;
        return;
      }
      window.localStorage.setItem(`${this.storageKey}_${trackId}`, JSON.stringify(state));
    } catch (e) {
      console.error('[TrackStudyLibrary] Error saving state:', e);
    }
  }

  /**
   * Updates parsed telemetry corners for a track
   * @param {string} trackId 
   * @param {Array<Object>} corners 
   */
  saveParsedCorners(trackId, corners) {
    const currentState = this.getTrackStudyState(trackId) || {};
    this.saveTrackStudyState(trackId, {
      ...currentState,
      corners: corners || []
    });
  }

  /**
   * Updates track profile with parsed telemetry corners
   * @param {string} trackId 
   * @param {Object} profile 
   */
  updateTrackProfile(trackId, profile) {
    if (profile && Array.isArray(profile.corners)) {
      this.saveParsedCorners(trackId, profile.corners);
    }
  }

  /**
   * Resets study progression and purged telemetry corners for a track
   * @param {string} trackId 
   */
  resetTrackStudyState(trackId) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        if (this.inMemoryStore) delete this.inMemoryStore[trackId];
        return;
      }
      window.localStorage.removeItem(`${this.storageKey}_${trackId}`);
    } catch (e) {
      console.error('[TrackStudyLibrary] Error resetting state:', e);
    }
  }
}

export const trackStudyLibrary = new TrackStudyLibrary();
