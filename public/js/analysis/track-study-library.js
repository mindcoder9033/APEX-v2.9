/**
 * APEX Track Study Library & Store
 * Independent Track Study knowledge store and FM23 track catalog manager.
 * Persists per-track study progression (unlocked stages, completed debriefings)
 * and generates high-fidelity 5-phase corner telemetry profiles for all FM23 layouts.
 */

import { FM23_TRACKS } from '../data/fm23-tracks.js';

const STUDY_STORAGE_KEY = 'apex_track_study_library_v1';

// Hand-tuned rich corner metadata for iconic FM23 racing circuits
const PRESET_CORNER_DATABASE = {
  'sebring-international-raceway--full-circuit': {
    turnsCount: 17,
    corners: [
      { number: 1, name: 'Turn 1 (Fast Left Sweeper)', radius: 190, angleDeg: 55, entrySpeedMps: 45, minSpeedMps: 38, exitSpeedMps: 44, gear: 4, followingStraightMeters: 480, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 40, bumpSeverity: 'High (Concrete Seams)', curbThreat: 'Moderate' },
      { number: 2, name: 'Turn 2', radius: 140, angleDeg: 40, entrySpeedMps: 42, minSpeedMps: 37, exitSpeedMps: 43, gear: 4, followingStraightMeters: 180, camberDeg: 2.0, elevationChangeM: 0, brakingDistanceM: 20, bumpSeverity: 'Low', curbThreat: 'Low' },
      { number: 3, name: 'Turn 3 (Hairpin Right)', radius: 45, angleDeg: 100, entrySpeedMps: 36, minSpeedMps: 18, exitSpeedMps: 28, gear: 2, followingStraightMeters: 420, camberDeg: 0.5, elevationChangeM: 0, brakingDistanceM: 70, bumpSeverity: 'Moderate', curbThreat: 'High' },
      { number: 4, name: 'Turn 4', radius: 110, angleDeg: 45, entrySpeedMps: 40, minSpeedMps: 32, exitSpeedMps: 38, gear: 3, followingStraightMeters: 220, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 30, bumpSeverity: 'Low', curbThreat: 'Low' },
      { number: 5, name: 'Turn 5', radius: 95, angleDeg: 50, entrySpeedMps: 38, minSpeedMps: 30, exitSpeedMps: 36, gear: 3, followingStraightMeters: 190, camberDeg: 0.0, elevationChangeM: 0, brakingDistanceM: 35, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 7, name: 'Turn 7 (Hairpin Fangio)', radius: 35, angleDeg: 130, entrySpeedMps: 46, minSpeedMps: 16, exitSpeedMps: 26, gear: 2, followingStraightMeters: 550, camberDeg: 0.0, elevationChangeM: 0, brakingDistanceM: 85, bumpSeverity: 'Moderate', curbThreat: 'High' },
      { number: 8, name: 'Turn 8', radius: 85, angleDeg: 60, entrySpeedMps: 38, minSpeedMps: 28, exitSpeedMps: 35, gear: 3, followingStraightMeters: 140, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 40, bumpSeverity: 'Low', curbThreat: 'Low' },
      { number: 9, name: 'Turn 9', radius: 90, angleDeg: 65, entrySpeedMps: 36, minSpeedMps: 26, exitSpeedMps: 33, gear: 3, followingStraightMeters: 160, camberDeg: -0.5, elevationChangeM: 0, brakingDistanceM: 45, bumpSeverity: 'Moderate', curbThreat: 'Moderate' },
      { number: 10, name: 'Turn 10 (Cunningham)', radius: 75, angleDeg: 90, entrySpeedMps: 37, minSpeedMps: 24, exitSpeedMps: 32, gear: 2, followingStraightMeters: 280, camberDeg: 1.5, elevationChangeM: 0, brakingDistanceM: 50, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 13, name: 'Turn 13 (Tower Turn)', radius: 65, angleDeg: 95, entrySpeedMps: 40, minSpeedMps: 22, exitSpeedMps: 30, gear: 2, followingStraightMeters: 360, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 60, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 15, name: 'Turn 15', radius: 120, angleDeg: 55, entrySpeedMps: 44, minSpeedMps: 34, exitSpeedMps: 42, gear: 4, followingStraightMeters: 250, camberDeg: 0.5, elevationChangeM: 0, brakingDistanceM: 35, bumpSeverity: 'Low', curbThreat: 'Low' },
      { number: 16, name: 'Turn 16', radius: 110, angleDeg: 65, entrySpeedMps: 42, minSpeedMps: 32, exitSpeedMps: 40, gear: 3, followingStraightMeters: 980, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 40, bumpSeverity: 'Low', curbThreat: 'Low' },
      { number: 17, name: 'Turn 17 (Sunset Bend)', radius: 180, angleDeg: 145, entrySpeedMps: 52, minSpeedMps: 35, exitSpeedMps: 46, gear: 4, followingStraightMeters: 880, camberDeg: -1.0, elevationChangeM: 0, brakingDistanceM: 65, bumpSeverity: 'Severe (Concrete Slabs)', curbThreat: 'Severe' }
    ]
  },
  'circuit-de-spa-francorchamps--full-circuit': {
    turnsCount: 19,
    corners: [
      { number: 1, name: 'Turn 1 (La Source Hairpin)', radius: 32, angleDeg: 135, entrySpeedMps: 48, minSpeedMps: 16, exitSpeedMps: 25, gear: 1, followingStraightMeters: 650, camberDeg: 1.5, elevationChangeM: -4, brakingDistanceM: 90, bumpSeverity: 'Low', curbThreat: 'High' },
      { number: 2, name: 'Turn 2 (Eau Rouge Bottom)', radius: 220, angleDeg: 30, entrySpeedMps: 65, minSpeedMps: 62, exitSpeedMps: 64, gear: 6, followingStraightMeters: 80, camberDeg: 3.5, elevationChangeM: 12, brakingDistanceM: 0, bumpSeverity: 'High Compression', curbThreat: 'Severe' },
      { number: 3, name: 'Turn 3 (Raidillon Crest)', radius: 210, angleDeg: 40, entrySpeedMps: 64, minSpeedMps: 60, exitSpeedMps: 63, gear: 6, followingStraightMeters: 950, camberDeg: -1.0, elevationChangeM: 18, brakingDistanceM: 0, bumpSeverity: 'Blind Crest / Light Load', curbThreat: 'Severe' },
      { number: 5, name: 'Turn 5 (Les Combes Right)', radius: 65, angleDeg: 90, entrySpeedMps: 68, minSpeedMps: 28, exitSpeedMps: 34, gear: 3, followingStraightMeters: 120, camberDeg: 1.0, elevationChangeM: -2, brakingDistanceM: 110, bumpSeverity: 'Low', curbThreat: 'High' },
      { number: 8, name: 'Turn 8 (Bruxelles Hairpin)', radius: 50, angleDeg: 150, entrySpeedMps: 46, minSpeedMps: 22, exitSpeedMps: 28, gear: 2, followingStraightMeters: 240, camberDeg: -3.0, elevationChangeM: -8, brakingDistanceM: 65, bumpSeverity: 'Moderate', curbThreat: 'Moderate' },
      { number: 10, name: 'Turn 10 (Pouhon Left Double-Apex)', radius: 140, angleDeg: 130, entrySpeedMps: 58, minSpeedMps: 45, exitSpeedMps: 52, gear: 5, followingStraightMeters: 450, camberDeg: 2.0, elevationChangeM: -6, brakingDistanceM: 35, bumpSeverity: 'Low', curbThreat: 'High' },
      { number: 14, name: 'Turn 14 (Campus / Stavelot)', radius: 85, angleDeg: 80, entrySpeedMps: 46, minSpeedMps: 32, exitSpeedMps: 40, gear: 3, followingStraightMeters: 380, camberDeg: 1.0, elevationChangeM: 2, brakingDistanceM: 50, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 16, name: 'Turn 16 (Blanchimont)', radius: 280, angleDeg: 40, entrySpeedMps: 68, minSpeedMps: 65, exitSpeedMps: 67, gear: 6, followingStraightMeters: 620, camberDeg: 1.5, elevationChangeM: 0, brakingDistanceM: 0, bumpSeverity: 'Low', curbThreat: 'High' },
      { number: 18, name: 'Turn 18 (Bus Stop Chicane)', radius: 30, angleDeg: 110, entrySpeedMps: 66, minSpeedMps: 15, exitSpeedMps: 24, gear: 1, followingStraightMeters: 520, camberDeg: 0.5, elevationChangeM: 0, brakingDistanceM: 115, bumpSeverity: 'Moderate', curbThreat: 'Severe' }
    ]
  },
  'weathertech-raceway-laguna-seca--full-circuit': {
    turnsCount: 11,
    corners: [
      { number: 1, name: 'Turn 1 (Crest Left Sweep)', radius: 220, angleDeg: 25, entrySpeedMps: 58, minSpeedMps: 52, exitSpeedMps: 56, gear: 5, followingStraightMeters: 280, camberDeg: -1.0, elevationChangeM: 4, brakingDistanceM: 15, bumpSeverity: 'Blind Crest', curbThreat: 'Low' },
      { number: 2, name: 'Turn 2 (Andretti Hairpin Double-Apex)', radius: 35, angleDeg: 150, entrySpeedMps: 54, minSpeedMps: 17, exitSpeedMps: 26, gear: 2, followingStraightMeters: 320, camberDeg: 1.5, elevationChangeM: -3, brakingDistanceM: 85, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 3, name: 'Turn 3 (90-deg Right)', radius: 70, angleDeg: 90, entrySpeedMps: 38, minSpeedMps: 26, exitSpeedMps: 34, gear: 3, followingStraightMeters: 180, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 45, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 4, name: 'Turn 4 (Fast Right Sweeper)', radius: 95, angleDeg: 75, entrySpeedMps: 42, minSpeedMps: 32, exitSpeedMps: 39, gear: 3, followingStraightMeters: 260, camberDeg: 2.0, elevationChangeM: 2, brakingDistanceM: 35, bumpSeverity: 'Low', curbThreat: 'Moderate' },
      { number: 5, name: 'Turn 5 (Uphill Left)', radius: 80, angleDeg: 85, entrySpeedMps: 44, minSpeedMps: 28, exitSpeedMps: 36, gear: 3, followingStraightMeters: 300, camberDeg: 3.0, elevationChangeM: 14, brakingDistanceM: 50, bumpSeverity: 'High Compression', curbThreat: 'Moderate' },
      { number: 6, name: 'Turn 6 (Fast Uphill Left Dip)', radius: 110, angleDeg: 60, entrySpeedMps: 48, minSpeedMps: 38, exitSpeedMps: 44, gear: 4, followingStraightMeters: 350, camberDeg: 1.5, elevationChangeM: 16, brakingDistanceM: 30, bumpSeverity: 'Dip / Compression', curbThreat: 'High' },
      { number: 8, name: 'Turn 8 (The Corkscrew Left Drop)', radius: 38, angleDeg: 110, entrySpeedMps: 48, minSpeedMps: 20, exitSpeedMps: 27, gear: 2, followingStraightMeters: 60, camberDeg: -4.0, elevationChangeM: -18, brakingDistanceM: 65, bumpSeverity: 'Severe Drop / Weightless', curbThreat: 'Severe' },
      { number: 8.5, name: 'Turn 8A (Corkscrew Right Drop)', radius: 45, angleDeg: 80, entrySpeedMps: 30, minSpeedMps: 22, exitSpeedMps: 32, gear: 2, followingStraightMeters: 190, camberDeg: -2.0, elevationChangeM: -10, brakingDistanceM: 10, bumpSeverity: 'Severe Drop', curbThreat: 'Severe' },
      { number: 9, name: 'Turn 9 (Rainey Curve Fast Left)', radius: 120, angleDeg: 85, entrySpeedMps: 46, minSpeedMps: 36, exitSpeedMps: 42, gear: 4, followingStraightMeters: 220, camberDeg: -1.5, elevationChangeM: -6, brakingDistanceM: 30, bumpSeverity: 'Off-Camber Drop', curbThreat: 'High' },
      { number: 10, name: 'Turn 10 (Fast Downhill Right)', radius: 105, angleDeg: 80, entrySpeedMps: 44, minSpeedMps: 34, exitSpeedMps: 41, gear: 3, followingStraightMeters: 280, camberDeg: 2.5, elevationChangeM: -4, brakingDistanceM: 35, bumpSeverity: 'Moderate', curbThreat: 'Moderate' },
      { number: 11, name: 'Turn 11 (Slow Left Hairpin)', radius: 28, angleDeg: 115, entrySpeedMps: 48, minSpeedMps: 15, exitSpeedMps: 24, gear: 1, followingStraightMeters: 450, camberDeg: 0.5, elevationChangeM: 0, brakingDistanceM: 80, bumpSeverity: 'Low', curbThreat: 'High' }
    ]
  }
};

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
   * Generates or retrieves a high-fidelity track study profile
   * @param {string} trackId 
   * @returns {Object} Complete track study profile
   */
  getTrackStudyProfile(trackId) {
    const found = this.catalog.find(t => t.trackId === trackId) || this.catalog[0];
    if (!found) return null;

    // Check if hand-tuned database exists
    if (PRESET_CORNER_DATABASE[found.trackId]) {
      const preset = PRESET_CORNER_DATABASE[found.trackId];
      return {
        ...found,
        turnsCount: preset.turnsCount,
        corners: preset.corners
      };
    }

    // Procedural synthesis for all other FM23 layouts based on track length & layout
    return this._synthesizeProceduralProfile(found);
  }

  _synthesizeProceduralProfile(entry) {
    const lenM = entry.lengthMeters || 4000;
    // Estimate realistic turn count: approx 3.5 turns per kilometer
    const estimatedTurns = Math.max(6, Math.min(24, Math.round((lenM / 1000) * 3.5)));
    const corners = [];

    const avgStraight = Math.round(lenM / (estimatedTurns + 1));
    let accumulatedDist = 0;

    for (let i = 1; i <= estimatedTurns; i++) {
      const isHairpin = i % 4 === 0;
      const isFastSweeper = i % 5 === 0;
      const isChicane = i % 7 === 0;

      let radius = isHairpin ? 35 : (isFastSweeper ? 160 : 75 + (i * 7) % 55);
      let angleDeg = isHairpin ? 130 : (isFastSweeper ? 50 : 80 + (i * 11) % 40);
      let gear = isHairpin ? 2 : (isFastSweeper ? 4 : (radius < 65 ? 2 : 3));
      let minSpeedMps = isHairpin ? 18 : (isFastSweeper ? 42 : 28);
      let entrySpeedMps = minSpeedMps + 12 + (i % 3) * 4;
      let exitSpeedMps = minSpeedMps + 7 + (i % 2) * 3;
      let straightAfter = isHairpin ? avgStraight * 1.4 : avgStraight * (0.7 + ((i % 5) * 0.15));
      straightAfter = Math.round(straightAfter);

      let camberDeg = (i % 3 === 0) ? -1.0 : ((i % 2 === 0) ? 2.0 : 0.5);
      let elev = (i % 4 === 1) ? 5 : ((i % 4 === 3) ? -4 : 0);
      let bump = (i % 3 === 0) ? 'Moderate (Seams)' : 'Low';
      let curb = isHairpin ? 'High (Apex Serrated)' : 'Moderate';

      corners.push({
        number: i,
        name: `Turn ${i}${isHairpin ? ' (Hairpin)' : (isFastSweeper ? ' (High-Speed Sweeper)' : (isChicane ? ' (Chicane Entry)' : ''))}`,
        radius: radius,
        angleDeg: angleDeg,
        entrySpeedMps: entrySpeedMps,
        minSpeedMps: minSpeedMps,
        exitSpeedMps: exitSpeedMps,
        gear: gear,
        followingStraightMeters: straightAfter,
        camberDeg: camberDeg,
        elevationChangeM: elev,
        brakingDistanceM: Math.round((entrySpeedMps - minSpeedMps) * 2.2),
        bumpSeverity: bump,
        curbThreat: curb
      });

      accumulatedDist += straightAfter;
    }

    return {
      ...entry,
      turnsCount: estimatedTurns,
      corners: corners
    };
  }

  /**
   * Loads saved study progression (unlocked stages, completed debriefings) for a track
   * @param {string} trackId 
   * @returns {Object}
   */
  getTrackStudyState(trackId) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return this.inMemoryStore?.[trackId] || { unlockedPhases: [1], completedDebriefings: [], lastPhase: 1 };
      }
      const raw = window.localStorage.getItem(`${this.storageKey}_${trackId}`);
      if (!raw) {
        return { unlockedPhases: [1], completedDebriefings: [], lastPhase: 1 };
      }
      return JSON.parse(raw);
    } catch (e) {
      return { unlockedPhases: [1], completedDebriefings: [], lastPhase: 1 };
    }
  }

  /**
   * Saves study progression for a track
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
   * Resets study progression for a track
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

