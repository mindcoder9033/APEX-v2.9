/**
 * APEX Driver Profile Store
 * Manages persistent driver identities, dossiers, career statistics,
 * track personal records, and UI preferences.
 * Uses native Electron IPC filesystem storage with graceful localStorage fallback.
 */

const STORAGE_REGISTRY_KEY = 'apex_driver_profiles_v1';
const STORAGE_ACTIVE_KEY = 'apex_active_driver_id_v1';
const STORAGE_PREFIX = 'apex_driver_profile_';

export class DriverProfileStore {
  constructor() {
    this.profiles = [];
    this.activeProfile = null;
    this.initialized = false;
    this.listeners = new Set();
  }

  /**
   * Helper to check if running inside Electron Desktop App
   */
  get isDesktop() {
    return typeof window !== 'undefined' && Boolean(window.apexDesktop && window.apexDesktop.profiles);
  }

  /**
   * Generates a unique driver ID
   */
  generateId() {
    return `driver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Creates a schema-compliant default driver object
   */
  createDefaultProfile(name = 'APEX Driver', number = '01', team = 'Privateer Motorsport', tier = 'Club') {
    const id = this.generateId();
    return {
      id,
      name: name.trim() || 'APEX Driver',
      number: String(number || '01').trim(),
      team: (team || 'Privateer Motorsport').trim(),
      tier: tier || 'Club', // 'Rookie' | 'Club' | 'Pro' | 'Elite'
      color: '#e10600',
      avatar: 'helmet',
      preferences: {
        speedUnit: 'kmh',
        layoutPreset: 'driver',
        autoArchiveReports: true
      },
      careerStats: {
        totalLaps: 0,
        totalDistanceKm: 0,
        totalTrackTimeSec: 0,
        stintsCompleted: 0,
        trackPersonalBests: {}
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Initializes the store, loading profiles and resolving active driver
   * @returns {Promise<{ hasProfiles: boolean, activeProfile: Object }>}
   */
  async init() {
    try {
      if (this.isDesktop) {
        // 1. Load from Electron native IPC filesystem
        const res = await window.apexDesktop.profiles.getAll();
        if (res && res.success && Array.isArray(res.profiles) && res.profiles.length > 0) {
          this.profiles = res.profiles;
          const activeRes = await window.apexDesktop.profiles.getActiveId();
          let activeId = activeRes?.success ? activeRes.activeId : null;

          if (!activeId || !this.profiles.some(p => p.id === activeId)) {
            activeId = this.profiles[0].id;
            await window.apexDesktop.profiles.setActive(activeId);
          }

          const detailRes = await window.apexDesktop.profiles.getDetail(activeId);
          if (detailRes && detailRes.success && detailRes.profile) {
            this.activeProfile = this.normalizeProfile(detailRes.profile);
          }
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        // 2. Browser localStorage fallback
        const raw = window.localStorage.getItem(STORAGE_REGISTRY_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            this.profiles = list;
            let activeId = window.localStorage.getItem(STORAGE_ACTIVE_KEY);
            if (!activeId || !this.profiles.some(p => p.id === activeId)) {
              activeId = this.profiles[0].id;
              window.localStorage.setItem(STORAGE_ACTIVE_KEY, activeId);
            }
            const rawProfile = window.localStorage.getItem(`${STORAGE_PREFIX}${activeId}`);
            if (rawProfile) {
              this.activeProfile = this.normalizeProfile(JSON.parse(rawProfile));
            }
          }
        }
      }

      this.initialized = true;

      if (!this.activeProfile && this.profiles.length > 0) {
        // Fetch first profile as active
        this.activeProfile = await this.getProfileById(this.profiles[0].id);
      }

      if (this.activeProfile) {
        this.notify('active-changed', this.activeProfile);
      }

      return {
        hasProfiles: this.profiles.length > 0,
        activeProfile: this.activeProfile
      };
    } catch (err) {
      console.error('[DriverProfileStore] Initialization error:', err);
      this.initialized = true;
      return { hasProfiles: false, activeProfile: null };
    }
  }

  /**
   * Ensures all schema fields exist on a profile
   */
  normalizeProfile(raw) {
    const base = this.createDefaultProfile(raw.name, raw.number, raw.team, raw.tier);
    return {
      ...base,
      ...raw,
      id: raw.id || base.id,
      preferences: { ...base.preferences, ...(raw.preferences || {}) },
      careerStats: {
        totalLaps: Number(raw.careerStats?.totalLaps || 0),
        totalDistanceKm: Number(raw.careerStats?.totalDistanceKm || 0),
        totalTrackTimeSec: Number(raw.careerStats?.totalTrackTimeSec || 0),
        stintsCompleted: Number(raw.careerStats?.stintsCompleted || 0),
        trackPersonalBests: raw.careerStats?.trackPersonalBests || {}
      }
    };
  }

  /**
   * Returns current active profile (or fallback)
   */
  getActiveProfile() {
    if (this.activeProfile) return this.activeProfile;
    if (this.profiles.length > 0) {
      return this.profiles[0];
    }
    return {
      id: 'driver_guest',
      name: 'APEX Driver',
      number: '01',
      team: 'Privateer',
      tier: 'Club',
      color: '#e10600',
      avatar: 'helmet',
      preferences: { speedUnit: 'kmh', layoutPreset: 'driver', autoArchiveReports: true },
      careerStats: { totalLaps: 0, totalDistanceKm: 0, totalTrackTimeSec: 0, stintsCompleted: 0, trackPersonalBests: {} }
    };
  }

  /**
   * Returns summary list of all profiles
   */
  getAllProfiles() {
    return [...this.profiles];
  }

  /**
   * Gets full detailed profile by ID
   */
  async getProfileById(id) {
    if (!id) return null;
    if (this.activeProfile && this.activeProfile.id === id) {
      return this.activeProfile;
    }

    try {
      if (this.isDesktop) {
        const res = await window.apexDesktop.profiles.getDetail(id);
        if (res && res.success && res.profile) {
          return this.normalizeProfile(res.profile);
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
        if (raw) return this.normalizeProfile(JSON.parse(raw));
      }
    } catch (err) {
      console.warn(`[DriverProfileStore] Failed to fetch profile ${id}:`, err);
    }
    return null;
  }

  /**
   * Saves or updates a driver profile
   * @param {Object} profileData 
   * @returns {Promise<Object>}
   */
  async saveProfile(profileData) {
    if (!profileData) throw new Error('Profile data required');
    const profile = this.normalizeProfile({
      ...profileData,
      updatedAt: new Date().toISOString()
    });

    try {
      if (this.isDesktop) {
        const res = await window.apexDesktop.profiles.save(profile);
        if (!res || !res.success) {
          throw new Error(res?.error || 'IPC save failed');
        }
        // Refresh profile registry list
        const regRes = await window.apexDesktop.profiles.getAll();
        if (regRes && regRes.success) {
          this.profiles = regRes.profiles;
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`${STORAGE_PREFIX}${profile.id}`, JSON.stringify(profile));
        const summary = {
          id: profile.id,
          name: profile.name,
          number: profile.number,
          team: profile.team,
          tier: profile.tier,
          color: profile.color,
          avatar: profile.avatar,
          updatedAt: profile.updatedAt
        };
        const idx = this.profiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) {
          this.profiles[idx] = summary;
        } else {
          this.profiles.push(summary);
        }
        window.localStorage.setItem(STORAGE_REGISTRY_KEY, JSON.stringify(this.profiles));
      }

      // If updating the active profile, refresh memory reference
      if (this.activeProfile && this.activeProfile.id === profile.id) {
        this.activeProfile = profile;
      } else if (!this.activeProfile) {
        this.activeProfile = profile;
        await this.setActiveProfile(profile.id);
      }

      this.notify('profile-saved', profile);
      return profile;
    } catch (err) {
      console.error('[DriverProfileStore] Failed to save profile:', err);
      throw err;
    }
  }

  /**
   * Sets the active driver profile by ID
   * @param {string} id 
   */
  async setActiveProfile(id) {
    if (!id) return;
    const fullProfile = await this.getProfileById(id);
    if (!fullProfile) {
      console.warn(`[DriverProfileStore] Profile not found: ${id}`);
      return;
    }

    this.activeProfile = fullProfile;

    try {
      if (this.isDesktop) {
        await window.apexDesktop.profiles.setActive(id);
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_ACTIVE_KEY, id);
      }
    } catch (err) {
      console.warn('[DriverProfileStore] Failed to persist active ID:', err);
    }

    this.notify('active-changed', this.activeProfile);
    return this.activeProfile;
  }

  /**
   * Deletes a driver profile by ID
   * @param {string} id 
   */
  async deleteProfile(id) {
    if (!id) return false;
    try {
      if (this.isDesktop) {
        await window.apexDesktop.profiles.delete(id);
        const regRes = await window.apexDesktop.profiles.getAll();
        if (regRes && regRes.success) {
          this.profiles = regRes.profiles;
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
        this.profiles = this.profiles.filter(p => p.id !== id);
        window.localStorage.setItem(STORAGE_REGISTRY_KEY, JSON.stringify(this.profiles));
      }

      // If active profile was deleted, switch to another
      if (this.activeProfile && this.activeProfile.id === id) {
        if (this.profiles.length > 0) {
          await this.setActiveProfile(this.profiles[0].id);
        } else {
          this.activeProfile = null;
          this.notify('active-changed', null);
        }
      }

      this.notify('profile-deleted', id);
      return true;
    } catch (err) {
      console.error(`[DriverProfileStore] Failed to delete profile ${id}:`, err);
      return false;
    }
  }

  /**
   * Records telemetry metrics and personal bests from a completed stint
   * @param {Object} stintRecord 
   */
  async recordStintStats(stintRecord) {
    if (!this.activeProfile || !stintRecord) return;

    const profile = { ...this.activeProfile };
    const stats = { ...profile.careerStats };

    const lapCount = Array.isArray(stintRecord.laps) ? stintRecord.laps.length : (stintRecord.lapCount || 1);
    const durationSec = stintRecord.durationSec || (stintRecord.durationMs ? Math.round(stintRecord.durationMs / 1000) : 0);
    const distanceKm = stintRecord.distanceKm || (stintRecord.distanceMeters ? stintRecord.distanceMeters / 1000 : 0);

    stats.totalLaps += lapCount;
    stats.totalTrackTimeSec += durationSec;
    stats.totalDistanceKm = Number((stats.totalDistanceKm + distanceKm).toFixed(2));
    stats.stintsCompleted += 1;

    // Check track PB
    const trackKey = (stintRecord.trackName || stintRecord.metadata?.trackName || 'unknown').toLowerCase().trim();
    const layout = (stintRecord.layout || stintRecord.metadata?.layout || 'Default').toLowerCase().trim();
    const compoundKey = `${trackKey}::${layout}`;

    const bestLapSec = stintRecord.bestLapTimeSec || stintRecord.bestLap || 0;
    if (bestLapSec > 0) {
      stats.trackPersonalBests = { ...stats.trackPersonalBests };
      const existingPB = stats.trackPersonalBests[compoundKey];
      if (!existingPB || bestLapSec < existingPB.lapTimeSec) {
        stats.trackPersonalBests[compoundKey] = {
          trackName: stintRecord.trackName || stintRecord.metadata?.trackName || 'Circuit',
          layout: stintRecord.layout || stintRecord.metadata?.layout || 'Standard',
          lapTimeSec: Number(bestLapSec.toFixed(3)),
          car: stintRecord.car || stintRecord.metadata?.car || 'Race Car',
          carClass: stintRecord.carClass || stintRecord.metadata?.carClass || 'GT',
          date: new Date().toISOString()
        };
      }
    }

    profile.careerStats = stats;
    await this.saveProfile(profile);
  }

  /**
   * Export active or specific profile to external file
   */
  async exportProfile(id) {
    const profile = id ? await this.getProfileById(id) : this.activeProfile;
    if (!profile) throw new Error('No profile to export');

    if (this.isDesktop) {
      return await window.apexDesktop.profiles.export(profile);
    } else {
      // Browser JSON download fallback
      const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `APEX_Driver_${(profile.name || 'Driver').replace(/[^a-zA-Z0-9_-]/g, '_')}_#${profile.number}.apexprofile`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    }
  }

  /**
   * Import external profile file
   */
  async importProfile() {
    if (this.isDesktop) {
      const res = await window.apexDesktop.profiles.import();
      if (res && res.success && res.profile) {
        const imported = this.normalizeProfile(res.profile);
        // Ensure unique ID if already exists to avoid collision
        if (this.profiles.some(p => p.id === imported.id)) {
          imported.id = this.generateId();
        }
        await this.saveProfile(imported);
        await this.setActiveProfile(imported.id);
        return { success: true, profile: imported };
      }
      return res;
    } else {
      // Browser file upload trigger
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.apexprofile,.json';
        input.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return resolve({ success: false, canceled: true });
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const imported = this.normalizeProfile(parsed);
            if (this.profiles.some(p => p.id === imported.id)) {
              imported.id = this.generateId();
            }
            await this.saveProfile(imported);
            await this.setActiveProfile(imported.id);
            resolve({ success: true, profile: imported });
          } catch (err) {
            resolve({ success: false, error: err.message });
          }
        };
        input.click();
      });
    }
  }

  /**
   * Open the local profiles folder on Desktop
   */
  async openFolder() {
    if (this.isDesktop) {
      return await window.apexDesktop.profiles.openFolder();
    }
    return { success: false, error: 'Only supported in desktop app mode' };
  }

  /**
   * Event subscribe
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error('[DriverProfileStore] Listener error:', e);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apex:driver-changed', { detail: { event, profile: this.activeProfile, data } }));
    }
  }
}

// Global Singleton
export const driverProfileStore = new DriverProfileStore();
