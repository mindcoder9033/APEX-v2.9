/**
 * APEX Track Library Store
 * Persistent storage manager for covertly synthesized circuit profiles.
 * Backed by localStorage with structured schema validation and multi-stint merging.
 */

import { TrackLibrarySynthesizer } from './analysis/track-library-synthesizer.js';
import { FM23_TRACKS } from './data/fm23-tracks.js';
import { weatherProfileStore } from './weather-profile-store.js';
import { WeatherSimulator } from './analysis/weather-simulator.js';

const STORAGE_KEY = 'apex_track_library_v1';

export class TrackLibraryStore {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.cache = null;
    this.autoPopulateCatalog();
  }

  /**
   * Automatically populates and synchronizes all FM23 catalog tracks into the library
   * Preserves all user-recorded stint data, best laps, and custom vector maps.
   */
  autoPopulateCatalog() {
    try {
      const storedTracks = this._getRawStoredTracks();
      const catalogBaselines = TrackLibrarySynthesizer.generateAllCatalogBaselines();
      
      if (catalogBaselines.length === 0) return;

      const mergedMap = new Map();

      // 1. Seed with catalog baselines
      catalogBaselines.forEach(baseline => {
        mergedMap.set(baseline.trackId, baseline);
      });

      // 2. Overlay user's stored tracks (preserving telemetry, PB lap times, stints, custom points)
      storedTracks.forEach(userTrack => {
        if (!userTrack || !userTrack.trackId) return;
        const existing = mergedMap.get(userTrack.trackId);
        if (existing) {
          mergedMap.set(userTrack.trackId, {
            ...existing,
            ...userTrack,
            hasRecordedTelemetry: userTrack.hasRecordedTelemetry || (userTrack.bestLapTime > 0) || (userTrack.stintsRecordedCount > 0),
            corners: (userTrack.corners && userTrack.corners.length > 0) ? userTrack.corners : existing.corners,
            vectorMap: (userTrack.vectorMap?.points?.length > 0) ? userTrack.vectorMap : existing.vectorMap,
            hazards: (userTrack.hazards && userTrack.hazards.length > 0) ? userTrack.hazards : existing.hazards
          });
        } else {
          mergedMap.set(userTrack.trackId, {
            ...userTrack,
            hasRecordedTelemetry: userTrack.hasRecordedTelemetry || (userTrack.bestLapTime > 0) || (userTrack.stintsRecordedCount > 0)
          });
        }
      });

      const fullList = Array.from(mergedMap.values());
      fullList.sort((a, b) => {
        const cmp = (a.trackName || '').localeCompare(b.trackName || '');
        return cmp !== 0 ? cmp : (a.layoutName || '').localeCompare(b.layoutName || '');
      });

      this.cache = fullList;
      this.persist(fullList);

      // Seed weather simulation profiles for baseline tracks if missing
      this._seedBaselineWeatherProfiles(fullList);
    } catch (err) {
      console.warn('[TRACK STORE] Catalog auto-population warning:', err);
    }
  }

  /**
   * Internal helper to read raw items from localStorage without auto-populating recursion
   * @private
   */
  _getRawStoredTracks() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.cache || [];
      }
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /**
   * Seeds 18-weather matrices for tracks that do not have them yet
   * @private
   */
  _seedBaselineWeatherProfiles(tracks) {
    try {
      const simulator = new WeatherSimulator();
      tracks.forEach(track => {
        if (!weatherProfileStore.hasProfiles(track.trackId)) {
          const profiles = simulator.simulateAll(track);
          weatherProfileStore.saveProfiles(track.trackId, profiles);
        }
      });
    } catch (wErr) {
      // Non-blocking warning
    }
  }

  /**
   * Loads all stored tracks from persistence. Always returns a populated circuit list.
   * @returns {Array<Object>}
   */
  getAllTracks() {
    if (!this.cache || this.cache.length === 0) {
      this.autoPopulateCatalog();
    }
    return this.cache || [];
  }

  /**
   * Retrieves a single track by its unique trackId or track name
   * @param {string} trackId 
   * @returns {Object|null}
   */
  getTrackById(trackId) {
    if (!trackId) return null;
    const tracks = this.getAllTracks();
    return tracks.find(t => t.trackId === trackId || t.trackName.toLowerCase() === trackId.toLowerCase()) || null;
  }

  /**
   * Retrieves a track by name or id (alias for compatibility)
   * @param {string} identifier 
   * @returns {Object|null}
   */
  getTrack(identifier) {
    return this.getTrackById(identifier);
  }

  /**
   * Saves or merges a synthesized track profile into the library
   * @param {Object} newTrack 
   * @returns {Object} Saved track record
   */
  saveTrack(newTrack) {
    if (!newTrack || !newTrack.trackId) {
      throw new Error('Invalid track profile: missing trackId');
    }

    const tracks = this.getAllTracks();
    const existingIndex = tracks.findIndex(t => t.trackId === newTrack.trackId);

    let savedRecord;

    if (existingIndex >= 0) {
      const existing = tracks[existingIndex];
      const isFaster = newTrack.bestLapTime > 0 && 
        (existing.bestLapTime <= 0 || newTrack.bestLapTime < existing.bestLapTime);
        
      const isMoreDetailed = (newTrack.vectorMap?.originalSamplesCount || 0) > (existing.vectorMap?.originalSamplesCount || 0);

      savedRecord = {
        ...existing,
        ...newTrack,
        hasRecordedTelemetry: true,
        // Preserve all-time personal best lap time if existing was faster
        bestLapTime: isFaster ? newTrack.bestLapTime : (existing.bestLapTime > 0 ? existing.bestLapTime : newTrack.bestLapTime),
        bestLapNumber: isFaster ? (newTrack.bestLapNumber || 1) : (existing.bestLapNumber || newTrack.bestLapNumber || 1),
        // Preserve optimal vector map if existing was faster and not more detailed, otherwise update
        vectorMap: (!isFaster && existing.vectorMap?.points?.length > 0 && !isMoreDetailed)
          ? existing.vectorMap
          : (newTrack.vectorMap || existing.vectorMap),
        // Update cumulative telemetry counters and timestamps
        stintsRecordedCount: (existing.stintsRecordedCount || 0) + (newTrack.stintsRecordedCount || 1),
        totalLapsDriven: (existing.totalLapsDriven || 0) + (newTrack.totalLapsDriven || 1),
        createdAt: existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      tracks[existingIndex] = savedRecord;
    } else {
      savedRecord = {
        ...newTrack,
        hasRecordedTelemetry: true,
        stintsRecordedCount: 1,
        totalLapsDriven: newTrack.totalLapsDriven || 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      tracks.push(savedRecord);
    }

    // Sort alphabetically by track name, then layout
    tracks.sort((a, b) => {
      const cmp = (a.trackName || '').localeCompare(b.trackName || '');
      return cmp !== 0 ? cmp : (a.layoutName || '').localeCompare(b.layoutName || '');
    });

    this.cache = tracks;
    this.persist(tracks);
    return savedRecord;
  }

  /**
   * Deletes a track profile by trackId (or resets to catalog baseline)
   * @param {string} trackId 
   * @returns {boolean} True if deleted/reset
   */
  deleteTrack(trackId) {
    if (!trackId) return false;
    const tracks = this.getAllTracks();
    const filtered = tracks.filter(t => t.trackId !== trackId);
    if (filtered.length !== tracks.length) {
      this.cache = filtered;
      this.persist(filtered);
      return true;
    }
    return false;
  }

  /**
   * Clears all recorded tracks and re-initializes from catalog
   */
  clearLibrary() {
    this.cache = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(this.storageKey);
    }
    this.autoPopulateCatalog();
  }

  /**
   * Returns the count of total available tracks in the catalog
   * @returns {number}
   */
  getTracksCount() {
    return this.getAllTracks().length;
  }

  /**
   * Returns the count of tracks with actual recorded telemetry
   * @returns {number}
   */
  getRecordedTracksCount() {
    return this.getAllTracks().filter(t => t.hasRecordedTelemetry || t.bestLapTime > 0 || t.stintsRecordedCount > 0).length;
  }

  /**
   * Internal persistence write
   * @private
   */
  persist(tracks) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(tracks));
      }
    } catch (err) {
      console.error('[TRACK STORE] Failed to write to localStorage:', err);
    }
  }
}

export const trackLibraryStore = new TrackLibraryStore();

