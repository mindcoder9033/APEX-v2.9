/**
 * APEX Track Study Library & Store
 * Independent Track Study knowledge store and FM23 track catalog manager.
 * Persists per-track study progression (unlocked stages, completed debriefings),
 * driver notes, customized reference markers/gearing, and parsed telemetry corners.
 * Implements dual-layer persistence (LocalStorage + Backend REST API sync).
 */

import { FM23_TRACKS } from '../data/fm23-tracks.js';

const STUDY_STORAGE_KEY = 'apex_track_study_library_v1';

export class TrackStudyLibrary {
  constructor(storageKey = STUDY_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.catalog = [];
    this.inMemoryStore = {};
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
        corners: savedState.corners,
        customNotes: savedState.customNotes || {},
        driverAnnotations: savedState.driverAnnotations || {}
      };
    }

    // Default: No mock corners. Real telemetry parsing will populate corners when driven.
    return {
      ...found,
      turnsCount: 0,
      corners: [],
      customNotes: savedState?.customNotes || {},
      driverAnnotations: savedState?.driverAnnotations || {}
    };
  }

  /**
   * Loads saved study progression and telemetry corners for a track from local cache
   * @param {string} trackId 
   * @returns {Object}
   */
  getTrackStudyState(trackId) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.inMemoryStore?.[trackId] || { unlockedPhases: [1], lapsCompleted: 0, lastPhase: 1, corners: [], certified: false, customNotes: {} };
      }
      const raw = window.localStorage.getItem(`${this.storageKey}_${trackId}`);
      if (!raw) {
        return { unlockedPhases: [1], lapsCompleted: 0, lastPhase: 1, corners: [], certified: false, customNotes: {} };
      }
      const parsed = JSON.parse(raw);
      if (parsed.lapsCompleted === undefined) {
        parsed.lapsCompleted = Array.isArray(parsed.completedDebriefings) ? parsed.completedDebriefings.length : 0;
      }
      if (parsed.certified === undefined) {
        parsed.certified = parsed.lapsCompleted >= 5;
      }
      if (!parsed.customNotes) {
        parsed.customNotes = {};
      }
      return parsed;
    } catch (e) {
      return { unlockedPhases: [1], lapsCompleted: 0, lastPhase: 1, corners: [], certified: false, customNotes: {} };
    }
  }

  /**
   * Saves study progression, certification, driver notes, and telemetry corners for a track.
   * Auto-syncs to backend server REST API asynchronously.
   * @param {string} trackId 
   * @param {Object} state 
   */
  saveTrackStudyState(trackId, state) {
    try {
      const currentState = this.getTrackStudyState(trackId) || {};
      const merged = {
        ...currentState,
        ...state,
        trackId: trackId,
        certified: state.certified !== undefined ? state.certified : (state.lapsCompleted >= 5 || currentState.certified || false),
        updatedAt: state.updatedAt || new Date().toISOString()
      };

      if (typeof window === 'undefined' || !window.localStorage) {
        if (!this.inMemoryStore) this.inMemoryStore = {};
        this.inMemoryStore[trackId] = merged;
      } else {
        window.localStorage.setItem(`${this.storageKey}_${trackId}`, JSON.stringify(merged));
      }

      // Asynchronously sync to backend server API if in browser
      this._syncToServer(trackId, merged);
    } catch (e) {
      console.error('[TrackStudyLibrary] Error saving state:', e);
    }
  }

  /**
   * Syncs track dossier to backend server JSON file
   * @private
   */
  async _syncToServer(trackId, payload) {
    if (typeof fetch === 'undefined') return;
    try {
      const safeId = encodeURIComponent(trackId);
      await fetch(`/api/track-study/${safeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      // Non-blocking: Server might be running in offline/static mode
    }
  }

  /**
   * Loads full track study dossier from server file (merging with local storage)
   * @param {string} trackId 
   * @returns {Promise<Object>}
   */
  async fetchServerTrackStudy(trackId) {
    const local = this.getTrackStudyState(trackId);
    if (typeof fetch === 'undefined') return local;

    try {
      const safeId = encodeURIComponent(trackId);
      const res = await fetch(`/api/track-study/${safeId}`);
      if (res.ok) {
        const serverData = await res.json();
        // Merge server and local data (taking newest or combining notes)
        const merged = {
          ...local,
          ...serverData,
          customNotes: {
            ...(local.customNotes || {}),
            ...(serverData.customNotes || {})
          }
        };
        // Update local cache
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`${this.storageKey}_${trackId}`, JSON.stringify(merged));
        }
        return merged;
      }
    } catch {
      // Fallback to local
    }
    return local;
  }

  /**
   * Archives a generated PDF dossier to the backend server
   * @param {string} trackId 
   * @param {Uint8Array|Blob|string} pdfData 
   * @param {string} filename 
   * @returns {Promise<Object>}
   */
  async archivePdfToServer(trackId, pdfData, filename) {
    if (typeof fetch === 'undefined') return { success: false, error: 'No network' };

    try {
      let pdfBase64 = null;
      if (pdfData instanceof Uint8Array) {
        let binary = '';
        const len = pdfData.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(pdfData[i]);
        }
        pdfBase64 = btoa(binary);
      } else if (typeof pdfData === 'string') {
        pdfBase64 = pdfData;
      }

      if (!pdfBase64) {
        return { success: false, error: 'Unsupported PDF data type' };
      }

      const res = await fetch('/api/track-study/save-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          filename: filename || `APEX_5Phase_Track_Study_${trackId}.pdf`,
          pdfBase64
        })
      });

      if (res.ok) {
        return await res.json();
      }
      return { success: false, status: res.status };
    } catch (err) {
      console.warn('[TrackStudyLibrary] Failed to archive PDF to server:', err);
      return { success: false, error: err.message };
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
   * Retrieves all waypoints for a track
   * @param {string} trackId 
   * @returns {Array<Object>}
   */
  getWaypoints(trackId) {
    const state = this.getTrackStudyState(trackId);
    return Array.isArray(state?.waypoints) ? state.waypoints : [];
  }

  /**
   * Saves or updates a single waypoint for a track
   * @param {string} trackId 
   * @param {Object} waypoint 
   * @returns {Object} Saved waypoint
   */
  saveWaypoint(trackId, waypoint) {
    if (!trackId || !waypoint) return null;
    const currentState = this.getTrackStudyState(trackId) || {};
    const waypoints = Array.isArray(currentState.waypoints) ? [...currentState.waypoints] : [];
    
    if (!waypoint.id) {
      waypoint.id = `wp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
    waypoint.updatedAt = new Date().toISOString();

    const existingIndex = waypoints.findIndex(w => w.id === waypoint.id);
    if (existingIndex >= 0) {
      waypoints[existingIndex] = { ...waypoints[existingIndex], ...waypoint };
    } else {
      waypoint.createdAt = waypoint.createdAt || new Date().toISOString();
      waypoints.push(waypoint);
    }

    // Keep waypoints sorted by distance
    waypoints.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    this.saveTrackStudyState(trackId, {
      ...currentState,
      waypoints
    });

    return waypoint;
  }

  /**
   * Saves an entire collection of waypoints for a track
   * @param {string} trackId 
   * @param {Array<Object>} waypoints 
   */
  saveAllWaypoints(trackId, waypoints) {
    if (!trackId) return;
    const currentState = this.getTrackStudyState(trackId) || {};
    const list = Array.isArray(waypoints) ? [...waypoints] : [];
    list.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    this.saveTrackStudyState(trackId, {
      ...currentState,
      waypoints: list
    });
  }

  /**
   * Deletes a waypoint by ID
   * @param {string} trackId 
   * @param {string} waypointId 
   * @returns {boolean}
   */
  deleteWaypoint(trackId, waypointId) {
    if (!trackId || !waypointId) return false;
    const currentState = this.getTrackStudyState(trackId) || {};
    const waypoints = Array.isArray(currentState.waypoints) ? currentState.waypoints : [];
    const filtered = waypoints.filter(w => w.id !== waypointId);

    if (filtered.length !== waypoints.length) {
      this.saveTrackStudyState(trackId, {
        ...currentState,
        waypoints: filtered
      });
      return true;
    }
    return false;
  }

  /**
   * Resets study progression and purged telemetry corners for a track
   * @param {string} trackId 
   */
  resetTrackStudyState(trackId) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        if (this.inMemoryStore) delete this.inMemoryStore[trackId];
      } else {
        window.localStorage.removeItem(`${this.storageKey}_${trackId}`);
      }

      // Also reset on server
      if (typeof fetch !== 'undefined') {
        const safeId = encodeURIComponent(trackId);
        fetch(`/api/track-study/${safeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId,
            unlockedPhases: [1],
            lapsCompleted: 0,
            lastPhase: 1,
            corners: [],
            waypoints: [],
            customNotes: {},
            certified: false
          })
        }).catch(() => {});
      }
    } catch (e) {
      console.error('[TrackStudyLibrary] Error resetting state:', e);
    }
  }
}

export const trackStudyLibrary = new TrackStudyLibrary();
