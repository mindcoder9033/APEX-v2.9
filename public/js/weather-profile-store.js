/**
 * APEX Weather Profile Store
 * Decoupled localStorage store for pre-computed weather simulation profiles.
 * Keyed by trackId, independent of the base track library.
 */

const STORAGE_KEY = 'apex_weather_profiles_v1';

export class WeatherProfileStore {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this._cache = null;
  }

  /**
   * Loads the full weather store map from localStorage.
   * @returns {Object} map of trackId → { conditionSlug: WeatherProfile }
   */
  _loadAll() {
    if (this._cache) return this._cache;
    try {
      if (typeof window === 'undefined' || !window.localStorage) return {};
      const raw = window.localStorage.getItem(this.storageKey);
      this._cache = raw ? JSON.parse(raw) : {};
      return this._cache;
    } catch (err) {
      console.error('[WEATHER STORE] Failed to load:', err);
      return {};
    }
  }

  _persist(data) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(data));
      }
    } catch (err) {
      console.error('[WEATHER STORE] Failed to persist:', err);
    }
  }

  /**
   * Returns all weather profiles for a given trackId.
   * @param {string} trackId
   * @returns {Object|null} map of conditionSlug → WeatherProfile, or null if not found
   */
  getProfiles(trackId) {
    if (!trackId) return null;
    const store = this._loadAll();
    return store[trackId] || null;
  }

  /**
   * Returns a single condition profile for a track.
   * @param {string} trackId
   * @param {string} conditionSlug
   * @returns {Object|null}
   */
  getProfile(trackId, conditionSlug) {
    const profiles = this.getProfiles(trackId);
    return profiles ? (profiles[conditionSlug] || null) : null;
  }

  /**
   * Saves (or replaces) all 18 weather profiles for a given trackId.
   * @param {string} trackId
   * @param {Object} profilesMap  conditionSlug → WeatherProfile
   */
  saveProfiles(trackId, profilesMap) {
    if (!trackId || !profilesMap) return;
    const store = this._loadAll();
    store[trackId] = profilesMap;
    this._cache = store;
    this._persist(store);
  }

  /**
   * Removes weather profiles for a deleted track.
   * @param {string} trackId
   */
  deleteProfiles(trackId) {
    if (!trackId) return;
    const store = this._loadAll();
    if (store[trackId]) {
      delete store[trackId];
      this._cache = store;
      this._persist(store);
    }
  }

  /**
   * Checks if weather profiles exist for a trackId.
   * @param {string} trackId
   * @returns {boolean}
   */
  hasProfiles(trackId) {
    return !!this.getProfiles(trackId);
  }

  /**
   * Returns all trackIds that have weather profiles stored.
   * @returns {string[]}
   */
  getTrackedIds() {
    return Object.keys(this._loadAll());
  }

  /** Wipes the entire weather profile store. */
  clear() {
    this._cache = {};
    this._persist({});
  }
}

export const weatherProfileStore = new WeatherProfileStore();
