/**
 * APEX Track Library Store
 * Persistent storage manager for covertly synthesized circuit profiles.
 * Backed by localStorage with structured schema validation and multi-stint merging.
 */

const STORAGE_KEY = 'apex_track_library_v1';

export class TrackLibraryStore {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.cache = null;
  }

  /**
   * Loads all stored tracks from persistence
   * @returns {Array<Object>}
   */
  getAllTracks() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.cache || [];
      }
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const data = JSON.parse(raw);
      this.cache = Array.isArray(data) ? data : [];
      return this.cache;
    } catch (err) {
      console.error('[TRACK STORE] Error loading tracks from storage:', err);
      return this.cache || [];
    }
  }

  /**
   * Retrieves a single track by its unique trackId
   * @param {string} trackId 
   * @returns {Object|null}
   */
  getTrackById(trackId) {
    if (!trackId) return null;
    const tracks = this.getAllTracks();
    return tracks.find(t => t.trackId === trackId) || null;
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
        // Preserve all-time personal best lap time if existing was faster
        bestLapTime: isFaster ? newTrack.bestLapTime : (existing.bestLapTime > 0 ? existing.bestLapTime : newTrack.bestLapTime),
        bestLapNumber: isFaster ? (newTrack.bestLapNumber || 1) : (existing.bestLapNumber || newTrack.bestLapNumber || 1),
        // Preserve optimal vector map if existing was faster and not more detailed, otherwise update
        vectorMap: (!isFaster && existing.vectorMap?.points?.length > 0 && !isMoreDetailed)
          ? existing.vectorMap
          : (newTrack.vectorMap || existing.vectorMap),
        // Update cumulative telemetry counters and timestamps
        stintsRecordedCount: (existing.stintsRecordedCount || 1) + 1,
        totalLapsDriven: (existing.totalLapsDriven || 0) + (newTrack.totalLapsDriven || 1),
        createdAt: existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      tracks[existingIndex] = savedRecord;
    } else {
      savedRecord = {
        ...newTrack,
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
   * Deletes a track profile by trackId
   * @param {string} trackId 
   * @returns {boolean} True if deleted
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
   * Clears all tracks from the library
   */
  clearLibrary() {
    this.cache = [];
    this.persist([]);
  }

  /**
   * Returns the count of explored tracks
   * @returns {number}
   */
  getTracksCount() {
    return this.getAllTracks().length;
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
