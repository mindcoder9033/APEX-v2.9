/**
 * APEX Track Profile Repository
 * Manages CRUD operations, file-based JSON persistence in /data/tracks/,
 * schema validation, import/export, and seed data initialization.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data/tracks');

export class TrackRepository {
  constructor(dataDir = DATA_DIR) {
    this.dataDir = dataDir;
    this.ensureDirectory();
    this.seedDefaultsIfEmpty();
  }

  /**
   * Ensures the storage directory exists
   */
  ensureDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Generates a slug ID from name and layout
   * @param {string} name
   * @param {string} layout
   * @returns {string}
   */
  generateSlug(name, layout = '') {
    const raw = `${name} ${layout}`.toLowerCase().trim();
    return raw
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Validates a track profile against the expected APEX Track schema
   * @param {Object} track
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateTrack(track) {
    const errors = [];
    if (!track || typeof track !== 'object') {
      return { valid: false, errors: ['Track data must be an object'] };
    }

    if (!track.name || typeof track.name !== 'string') {
      errors.push('Track name is required');
    }
    if (!track.lengthMeters || typeof track.lengthMeters !== 'number' || track.lengthMeters <= 0) {
      errors.push('Track length in meters must be a positive number');
    }
    if (track.direction && !['Clockwise', 'Counter-Clockwise'].includes(track.direction)) {
      errors.push('Direction must be either "Clockwise" or "Counter-Clockwise"');
    }
    if (track.sectors) {
      if (typeof track.sectors.s1End !== 'number' || typeof track.sectors.s2End !== 'number') {
        errors.push('Sectors must define numeric s1End and s2End');
      }
    }
    if (track.turns && !Array.isArray(track.turns)) {
      errors.push('Turns must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Retrieves all saved track profiles (metadata summary)
   * @returns {Array<Object>}
   */
  getAllTracks() {
    this.ensureDirectory();
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    const tracks = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.dataDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const track = JSON.parse(content);
        tracks.push({
          id: track.id || file.replace('.json', ''),
          name: track.name,
          layout: track.layout || 'Full Circuit',
          trackOrdinal: track.trackOrdinal || null,
          lengthMeters: track.lengthMeters,
          direction: track.direction || 'Clockwise',
          turnCount: Array.isArray(track.turns) ? track.turns.length : 0,
          updatedDate: track.updatedDate || track.createdDate || new Date().toISOString(),
          calibrationMetadata: track.calibrationMetadata || null
        });
      } catch (err) {
        console.warn(`[TRACK REPO] Failed to read track file ${file}:`, err.message);
      }
    }

    return tracks.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  /**
   * Retrieves a full track profile by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getTrackById(id) {
    if (!id) return null;
    const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(this.dataDir, `${safeId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`[TRACK REPO] Failed to parse track ${id}:`, err);
      return null;
    }
  }

  /**
   * Saves or creates a track profile
   * @param {Object} trackData
   * @returns {Object} Saved track object
   */
  saveTrack(trackData) {
    this.ensureDirectory();
    const validation = this.validateTrack(trackData);
    if (!validation.valid) {
      throw new Error(`Invalid track data: ${validation.errors.join(', ')}`);
    }

    const id = trackData.id || this.generateSlug(trackData.name, trackData.layout);
    const now = new Date().toISOString();

    const fullTrack = {
      id,
      name: trackData.name,
      layout: trackData.layout || 'Full Circuit',
      trackOrdinal: trackData.trackOrdinal ?? null,
      lengthMeters: Math.round(trackData.lengthMeters),
      direction: trackData.direction || 'Clockwise',
      sectors: trackData.sectors || {
        s1End: Math.round(trackData.lengthMeters / 3),
        s2End: Math.round((trackData.lengthMeters / 3) * 2),
        s3End: Math.round(trackData.lengthMeters),
        s1Length: Math.round(trackData.lengthMeters / 3),
        s2Length: Math.round(trackData.lengthMeters / 3),
        s3Length: Math.round(trackData.lengthMeters - ((trackData.lengthMeters / 3) * 2))
      },
      turns: (trackData.turns || []).map((t, idx) => ({
        turnNumber: t.turnNumber || idx + 1,
        name: t.name || `Turn ${t.turnNumber || idx + 1}`,
        type: t.type || 'Medium Corner',
        direction: t.direction || 'Right',
        entryDist: Math.round(t.entryDist || 0),
        apexDist: Math.round(t.apexDist || 0),
        exitDist: Math.round(t.exitDist || 0),
        refSpeed: Math.round(t.refSpeed || 100),
        refGear: t.refGear || 3,
        apexLatG: Number((t.apexLatG || 1.2).toFixed(2)),
        brakingDist: Math.round(t.brakingDist || 50),
        coords: t.coords || null
      })),
      path2D: trackData.path2D || [],
      elevation: trackData.elevation || {
        minElevation: 0,
        maxElevation: 0,
        elevationDelta: 0,
        profile: []
      },
      characteristics: trackData.characteristics || this.synthesizeCharacteristics(trackData),
      calibrationMetadata: trackData.calibrationMetadata || {
        lapsUsed: 3,
        avgSpeedKph: 120,
        calibratedAt: now,
        carModel: 'Calibration Vehicle',
        consistencyScore: 95
      },
      driverNotes: trackData.driverNotes || '',
      createdDate: trackData.createdDate || now,
      updatedDate: now
    };

    const filePath = path.join(this.dataDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(fullTrack, null, 2), 'utf8');
    return fullTrack;
  }

  /**
   * Synthesizes characteristics summary from turns and track distance
   * @param {Object} trackData
   * @returns {Object}
   */
  synthesizeCharacteristics(trackData) {
    const turns = trackData.turns || [];
    let slow = 0, med = 0, fast = 0;
    const danger = [];
    const overtaking = [];

    turns.forEach(t => {
      if ((t.refSpeed || 100) < 90) slow++;
      else if ((t.refSpeed || 100) < 145) med++;
      else fast++;

      if (t.type === 'Hairpin' || (t.brakingDist && t.brakingDist > 80)) {
        danger.push(`Heavy Braking into ${t.name || 'Turn ' + t.turnNumber} (${t.refSpeed || 80} km/h)`);
        overtaking.push(`Entry opportunity into ${t.name || 'Turn ' + t.turnNumber}`);
      } else if (t.type === 'Chicane') {
        danger.push(`Rapid direction change at ${t.name || 'Turn ' + t.turnNumber}`);
      }
    });

    return {
      totalTurns: turns.length,
      slowCorners: slow,
      mediumCorners: med,
      fastCorners: fast,
      longestStraight: Math.round((trackData.lengthMeters || 4000) * 0.22),
      rhythmOverview: `${fast > slow ? 'Flowing & High-Speed' : 'Technical & Stop-and-Go'} circuit demanding ${slow > 4 ? 'heavy braking discipline' : 'precise apex commitment'}.`,
      dangerZones: danger.slice(0, 4),
      overtakingZones: overtaking.slice(0, 3)
    };
  }

  /**
   * Updates fields of an existing track profile
   * @param {string} id
   * @param {Object} updates
   * @returns {Object}
   */
  updateTrack(id, updates) {
    const existing = this.getTrackById(id);
    if (!existing) {
      throw new Error(`Track with id "${id}" not found`);
    }

    const merged = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve id
      createdDate: existing.createdDate,
      updatedDate: new Date().toISOString()
    };

    if (updates.turns) {
      merged.characteristics = this.synthesizeCharacteristics(merged);
    }

    const filePath = path.join(this.dataDir, `${existing.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  /**
   * Deletes a track profile
   * @param {string} id
   * @returns {boolean}
   */
  deleteTrack(id) {
    if (!id) return false;
    const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(this.dataDir, `${safeId}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Imports a track JSON string
   * @param {string|Object} jsonInput
   * @returns {Object}
   */
  importTrack(jsonInput) {
    const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    return this.saveTrack(data);
  }

  /**
   * Seeds realistic default circuits if /data/tracks/ is empty
   */
  seedDefaultsIfEmpty() {
    this.ensureDirectory();
    const existing = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    if (existing.length > 0) {
      return;
    }

    const seeds = [
      this.createSilverstoneGpSeed(),
      this.createWatkinsGlenSeed(),
      this.createMapleValleySeed(),
      this.createSpaFrancorchampsSeed()
    ];

    for (const seed of seeds) {
      try {
        const filePath = path.join(this.dataDir, `${seed.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(seed, null, 2), 'utf8');
      } catch (err) {
        console.warn('[TRACK REPO] Failed to seed default circuit:', err.message);
      }
    }
    console.log(`[TRACK REPO] Seeded ${seeds.length} default circuit profiles in ${this.dataDir}`);
  }

  /**
   * Seed: Silverstone GP
   */
  createSilverstoneGpSeed() {
    const length = 5891;
    // Generate realistic oval/gp loop normalized path
    const path2D = [];
    const numPoints = 120;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = 380 + Math.sin(angle * 3) * 60 + Math.cos(angle * 5) * 40;
      const x = 500 + Math.cos(angle) * r * 1.1;
      const z = 450 + Math.sin(angle) * r * 0.85;
      path2D.push({
        x: Math.round(x),
        z: Math.round(z),
        dist: Math.round((i / numPoints) * length)
      });
    }

    const turns = [
      { turnNumber: 1, name: 'Abbey', type: 'Fast Sweeper', direction: 'Right', entryDist: 340, apexDist: 420, exitDist: 490, refSpeed: 235, refGear: 6, apexLatG: 2.1, brakingDist: 20 },
      { turnNumber: 2, name: 'Farm Curve', type: 'Fast Sweeper', direction: 'Left', entryDist: 530, apexDist: 600, exitDist: 680, refSpeed: 245, refGear: 6, apexLatG: 1.8, brakingDist: 0 },
      { turnNumber: 3, name: 'Village', type: 'Hairpin', direction: 'Right', entryDist: 850, apexDist: 930, exitDist: 990, refSpeed: 82, refGear: 2, apexLatG: 1.3, brakingDist: 95 },
      { turnNumber: 4, name: 'The Loop', type: 'Hairpin', direction: 'Left', entryDist: 1040, apexDist: 1110, exitDist: 1180, refSpeed: 75, refGear: 2, apexLatG: 1.25, brakingDist: 50 },
      { turnNumber: 5, name: 'Aintree', type: 'Medium Corner', direction: 'Left', entryDist: 1220, apexDist: 1290, exitDist: 1360, refSpeed: 155, refGear: 4, apexLatG: 1.5, brakingDist: 30 },
      { turnNumber: 6, name: 'Brooklands', type: '90° Corner', direction: 'Left', entryDist: 2280, apexDist: 2360, exitDist: 2430, refSpeed: 120, refGear: 3, apexLatG: 1.6, brakingDist: 80 },
      { turnNumber: 7, name: 'Luffield', type: 'Medium Corner', direction: 'Right', entryDist: 2460, apexDist: 2560, exitDist: 2650, refSpeed: 95, refGear: 2, apexLatG: 1.45, brakingDist: 40 },
      { turnNumber: 8, name: 'Woodcote', type: 'Fast Sweeper', direction: 'Right', entryDist: 2680, apexDist: 2750, exitDist: 2830, refSpeed: 215, refGear: 5, apexLatG: 1.7, brakingDist: 0 },
      { turnNumber: 9, name: 'Copse', type: 'Fast Sweeper', direction: 'Right', entryDist: 3260, apexDist: 3340, exitDist: 3410, refSpeed: 240, refGear: 6, apexLatG: 2.2, brakingDist: 25 },
      { turnNumber: 10, name: 'Maggotts', type: 'Fast Sweeper', direction: 'Left', entryDist: 3750, apexDist: 3820, exitDist: 3880, refSpeed: 260, refGear: 7, apexLatG: 2.4, brakingDist: 0 },
      { turnNumber: 11, name: 'Becketts', type: 'Chicane', direction: 'Right', entryDist: 3910, apexDist: 3980, exitDist: 4050, refSpeed: 210, refGear: 5, apexLatG: 2.1, brakingDist: 45 },
      { turnNumber: 12, name: 'Chapel', type: 'Fast Sweeper', direction: 'Left', entryDist: 4080, apexDist: 4150, exitDist: 4220, refSpeed: 220, refGear: 6, apexLatG: 1.9, brakingDist: 0 },
      { turnNumber: 13, name: 'Stowe', type: '90° Corner', direction: 'Right', entryDist: 4980, apexDist: 5070, exitDist: 5150, refSpeed: 175, refGear: 4, apexLatG: 1.8, brakingDist: 75 },
      { turnNumber: 14, name: 'Vale', type: 'Chicane', direction: 'Left', entryDist: 5460, apexDist: 5530, exitDist: 5590, refSpeed: 90, refGear: 2, apexLatG: 1.4, brakingDist: 85 },
      { turnNumber: 15, name: 'Club', type: 'Medium Corner', direction: 'Right', entryDist: 5620, apexDist: 5710, exitDist: 5800, refSpeed: 140, refGear: 3, apexLatG: 1.6, brakingDist: 30 }
    ];

    return {
      id: 'silverstone-gp',
      name: 'Silverstone Circuit',
      layout: 'Grand Prix Circuit',
      trackOrdinal: 101,
      lengthMeters: length,
      direction: 'Clockwise',
      sectors: {
        s1End: 1850,
        s2End: 4250,
        s3End: length,
        s1Length: 1850,
        s2Length: 2400,
        s3Length: length - 4250
      },
      turns,
      path2D,
      elevation: {
        minElevation: 145.2,
        maxElevation: 157.8,
        elevationDelta: 12.6,
        profile: [
          { dist: 0, elevation: 150.0 },
          { dist: 1500, elevation: 145.2 },
          { dist: 3500, elevation: 157.8 },
          { dist: 5000, elevation: 149.5 },
          { dist: length, elevation: 150.0 }
        ]
      },
      characteristics: {
        totalTurns: turns.length,
        slowCorners: 3,
        mediumCorners: 5,
        fastCorners: 7,
        longestStraight: 770,
        rhythmOverview: 'Legendary high-downforce temple with ultra-fast Maggotts-Becketts complex and heavy braking zones into Village and Vale.',
        dangerZones: [
          'High G-load transition through Becketts (T11)',
          'Heavy braking from 280+ km/h into Vale (T14)',
          'High-speed commitment at Copse (T9)'
        ],
        overtakingZones: [
          'Hangar Straight slipstream into Stowe (T13)',
          'Wellington Straight into Brooklands (T6)',
          'Hamilton Straight into Abbey (T1)'
        ]
      },
      calibrationMetadata: {
        lapsUsed: 3,
        avgSpeedKph: 188.4,
        calibratedAt: '2026-08-20T14:30:00.000Z',
        carModel: 'Formula APEX 2026',
        consistencyScore: 98.4
      },
      driverNotes: 'Carry maximum entry speed through Abbey and Copse. Be patient on throttle application at Luffield to protect rear tires.',
      createdDate: '2026-08-20T14:30:00.000Z',
      updatedDate: '2026-08-20T14:30:00.000Z'
    };
  }

  /**
   * Seed: Watkins Glen Full Course
   */
  createWatkinsGlenSeed() {
    const length = 5552;
    const path2D = [];
    const numPoints = 110;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = 360 + Math.cos(angle * 2) * 80 + Math.sin(angle * 4) * 35;
      const x = 500 + Math.cos(angle) * r;
      const z = 450 + Math.sin(angle) * r * 0.9;
      path2D.push({
        x: Math.round(x),
        z: Math.round(z),
        dist: Math.round((i / numPoints) * length)
      });
    }

    const turns = [
      { turnNumber: 1, name: 'The Ninety', type: '90° Corner', direction: 'Right', entryDist: 380, apexDist: 460, exitDist: 540, refSpeed: 115, refGear: 3, apexLatG: 1.55, brakingDist: 85 },
      { turnNumber: 2, name: 'The Esses (Entry)', type: 'Fast Sweeper', direction: 'Left', entryDist: 820, apexDist: 900, exitDist: 980, refSpeed: 210, refGear: 5, apexLatG: 1.8, brakingDist: 0 },
      { turnNumber: 3, name: 'The Esses (Mid)', type: 'Fast Sweeper', direction: 'Right', entryDist: 1010, apexDist: 1090, exitDist: 1170, refSpeed: 225, refGear: 6, apexLatG: 1.9, brakingDist: 0 },
      { turnNumber: 4, name: 'The Esses (Exit)', type: 'Fast Sweeper', direction: 'Left', entryDist: 1200, apexDist: 1280, exitDist: 1360, refSpeed: 240, refGear: 6, apexLatG: 1.7, brakingDist: 0 },
      { turnNumber: 5, name: 'Inner Loop (Bus Stop)', type: 'Chicane', direction: 'Right', entryDist: 2150, apexDist: 2240, exitDist: 2330, refSpeed: 130, refGear: 3, apexLatG: 1.75, brakingDist: 90 },
      { turnNumber: 6, name: 'The Carousel (Outer Loop)', type: 'Fast Sweeper', direction: 'Right', entryDist: 2450, apexDist: 2600, exitDist: 2750, refSpeed: 165, refGear: 4, apexLatG: 1.85, brakingDist: 35 },
      { turnNumber: 7, name: 'The Chute', type: 'Medium Corner', direction: 'Left', entryDist: 3100, apexDist: 3180, exitDist: 3260, refSpeed: 135, refGear: 3, apexLatG: 1.6, brakingDist: 55 },
      { turnNumber: 8, name: 'The Toe (The Boot)', type: 'Hairpin', direction: 'Right', entryDist: 3550, apexDist: 3640, exitDist: 3720, refSpeed: 85, refGear: 2, apexLatG: 1.4, brakingDist: 75 },
      { turnNumber: 9, name: 'The Heel', type: '90° Corner', direction: 'Left', entryDist: 4050, apexDist: 4130, exitDist: 4210, refSpeed: 125, refGear: 3, apexLatG: 1.55, brakingDist: 50 },
      { turnNumber: 10, name: 'Turn 10', type: 'Fast Sweeper', direction: 'Left', entryDist: 4620, apexDist: 4700, exitDist: 4780, refSpeed: 195, refGear: 5, apexLatG: 1.7, brakingDist: 20 },
      { turnNumber: 11, name: 'Turn 11', type: '90° Corner', direction: 'Right', entryDist: 5120, apexDist: 5200, exitDist: 5280, refSpeed: 145, refGear: 4, apexLatG: 1.65, brakingDist: 45 }
    ];

    return {
      id: 'watkins-glen-full',
      name: 'Watkins Glen International',
      layout: 'Full Course with Boot',
      trackOrdinal: 102,
      lengthMeters: length,
      direction: 'Clockwise',
      sectors: {
        s1End: 1750,
        s2End: 3800,
        s3End: length,
        s1Length: 1750,
        s2Length: 2050,
        s3Length: length - 3800
      },
      turns,
      path2D,
      elevation: {
        minElevation: 275.0,
        maxElevation: 312.4,
        elevationDelta: 37.4,
        profile: [
          { dist: 0, elevation: 285.0 },
          { dist: 1300, elevation: 312.4 },
          { dist: 3600, elevation: 275.0 },
          { dist: 5000, elevation: 282.0 },
          { dist: length, elevation: 285.0 }
        ]
      },
      characteristics: {
        totalTurns: turns.length,
        slowCorners: 1,
        mediumCorners: 4,
        fastCorners: 6,
        longestStraight: 650,
        rhythmOverview: 'High-speed classic North American road course featuring dramatic elevation changes and the punishing Bus Stop chicane.',
        dangerZones: [
          'High curb aggression through Bus Stop (T5)',
          'Compressive braking into The Toe (T8)',
          'Wall proximity at exit of The Ninety (T1)'
        ],
        overtakingZones: [
          'Down the back straight into the Inner Loop (T5)',
          'Heavy braking zone into The Ninety (T1)',
          'Downhill dive into The Toe (T8)'
        ]
      },
      calibrationMetadata: {
        lapsUsed: 3,
        avgSpeedKph: 195.2,
        calibratedAt: '2026-08-21T10:15:00.000Z',
        carModel: 'GT3 Cup Car',
        consistencyScore: 97.2
      },
      driverNotes: 'Aggressive curb usage at Bus Stop is mandatory for lap time. Watch front-left tire loading in the Carousel.',
      createdDate: '2026-08-21T10:15:00.000Z',
      updatedDate: '2026-08-21T10:15:00.000Z'
    };
  }

  /**
   * Seed: Maple Valley Raceway
   */
  createMapleValleySeed() {
    const length = 4810;
    const path2D = [];
    const numPoints = 100;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = 340 + Math.sin(angle * 2) * 70;
      const x = 500 + Math.cos(angle) * r;
      const z = 450 + Math.sin(angle) * r * 0.8;
      path2D.push({
        x: Math.round(x),
        z: Math.round(z),
        dist: Math.round((i / numPoints) * length)
      });
    }

    const turns = [
      { turnNumber: 1, name: 'Turn 1 (Crest Sweeper)', type: 'Fast Sweeper', direction: 'Right', entryDist: 320, apexDist: 410, exitDist: 490, refSpeed: 190, refGear: 5, apexLatG: 1.7, brakingDist: 20 },
      { turnNumber: 2, name: 'Turn 2 (Downhill Left)', type: 'Medium Corner', direction: 'Left', entryDist: 650, apexDist: 740, exitDist: 820, refSpeed: 130, refGear: 3, apexLatG: 1.5, brakingDist: 50 },
      { turnNumber: 3, name: 'Turn 3 (Bridge Entry)', type: 'Medium Corner', direction: 'Right', entryDist: 1100, apexDist: 1190, exitDist: 1270, refSpeed: 145, refGear: 4, apexLatG: 1.6, brakingDist: 35 },
      { turnNumber: 4, name: 'Turn 4 (Over Bridge)', type: 'Fast Sweeper', direction: 'Right', entryDist: 1550, apexDist: 1640, exitDist: 1720, refSpeed: 215, refGear: 5, apexLatG: 1.8, brakingDist: 0 },
      { turnNumber: 5, name: 'Turn 5 (Blind Left)', type: '90° Corner', direction: 'Left', entryDist: 2200, apexDist: 2290, exitDist: 2370, refSpeed: 110, refGear: 3, apexLatG: 1.45, brakingDist: 70 },
      { turnNumber: 6, name: 'Turn 6 (Hairpin)', type: 'Hairpin', direction: 'Right', entryDist: 2750, apexDist: 2840, exitDist: 2920, refSpeed: 70, refGear: 2, apexLatG: 1.3, brakingDist: 85 },
      { turnNumber: 7, name: 'Turn 7 (Chicane In)', type: 'Chicane', direction: 'Left', entryDist: 3450, apexDist: 3530, exitDist: 3600, refSpeed: 125, refGear: 3, apexLatG: 1.65, brakingDist: 45 },
      { turnNumber: 8, name: 'Turn 8 (Final Carousel)', type: 'Fast Sweeper', direction: 'Left', entryDist: 4100, apexDist: 4280, exitDist: 4450, refSpeed: 175, refGear: 4, apexLatG: 1.8, brakingDist: 30 }
    ];

    return {
      id: 'maple-valley',
      name: 'Maple Valley Raceway',
      layout: 'Full Circuit',
      trackOrdinal: 103,
      lengthMeters: length,
      direction: 'Clockwise',
      sectors: {
        s1End: 1500,
        s2End: 3200,
        s3End: length,
        s1Length: 1500,
        s2Length: 1700,
        s3Length: length - 3200
      },
      turns,
      path2D,
      elevation: {
        minElevation: 110.0,
        maxElevation: 162.5,
        elevationDelta: 52.5,
        profile: [
          { dist: 0, elevation: 140.0 },
          { dist: 800, elevation: 110.0 },
          { dist: 2200, elevation: 162.5 },
          { dist: 3500, elevation: 135.0 },
          { dist: length, elevation: 140.0 }
        ]
      },
      characteristics: {
        totalTurns: turns.length,
        slowCorners: 1,
        mediumCorners: 3,
        fastCorners: 4,
        longestStraight: 600,
        rhythmOverview: 'Iconic roller-coaster circuit with huge elevation swings, high-speed bridge sweepers, and deceptive off-camber crests.',
        dangerZones: [
          'Unweighting over Turn 1 crest into downhill braking',
          'Heavy compression at Turn 6 Hairpin entry'
        ],
        overtakingZones: [
          'Uphill braking zone into Turn 6 Hairpin',
          'Draft down the final front straight'
        ]
      },
      calibrationMetadata: {
        lapsUsed: 3,
        avgSpeedKph: 172.5,
        calibratedAt: '2026-08-22T16:00:00.000Z',
        carModel: 'Spec Racer',
        consistencyScore: 96.0
      },
      driverNotes: 'Stabilize vehicle platform over the crest at Turn 1 before touching the brakes.',
      createdDate: '2026-08-22T16:00:00.000Z',
      updatedDate: '2026-08-22T16:00:00.000Z'
    };
  }

  /**
   * Seed: Circuit de Spa-Francorchamps
   */
  createSpaFrancorchampsSeed() {
    const length = 7004;
    const path2D = [];
    const numPoints = 140;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = 400 + Math.sin(angle * 3) * 80;
      const x = 500 + Math.cos(angle) * r * 1.2;
      const z = 450 + Math.sin(angle) * r * 0.8;
      path2D.push({
        x: Math.round(x),
        z: Math.round(z),
        dist: Math.round((i / numPoints) * length)
      });
    }

    const turns = [
      { turnNumber: 1, name: 'La Source', type: 'Hairpin', direction: 'Right', entryDist: 260, apexDist: 340, exitDist: 410, refSpeed: 68, refGear: 1, apexLatG: 1.2, brakingDist: 95 },
      { turnNumber: 2, name: 'Eau Rouge', type: 'Fast Sweeper', direction: 'Left', entryDist: 1050, apexDist: 1120, exitDist: 1180, refSpeed: 275, refGear: 7, apexLatG: 2.6, brakingDist: 0 },
      { turnNumber: 3, name: 'Raidillon', type: 'Fast Sweeper', direction: 'Right', entryDist: 1190, apexDist: 1270, exitDist: 1350, refSpeed: 270, refGear: 7, apexLatG: 2.5, brakingDist: 0 },
      { turnNumber: 4, name: 'Les Combes', type: 'Chicane', direction: 'Right', entryDist: 2850, apexDist: 2940, exitDist: 3020, refSpeed: 135, refGear: 3, apexLatG: 1.7, brakingDist: 100 },
      { turnNumber: 5, name: 'Malmedy', type: 'Medium Corner', direction: 'Left', entryDist: 3060, apexDist: 3140, exitDist: 3220, refSpeed: 150, refGear: 4, apexLatG: 1.6, brakingDist: 20 },
      { turnNumber: 6, name: 'Bruxelles (Rivage)', type: 'Hairpin', direction: 'Right', entryDist: 3480, apexDist: 3580, exitDist: 3670, refSpeed: 95, refGear: 2, apexLatG: 1.4, brakingDist: 65 },
      { turnNumber: 7, name: 'No Name (Speaker Corner)', type: 'Medium Corner', direction: 'Left', entryDist: 3880, apexDist: 3960, exitDist: 4040, refSpeed: 140, refGear: 3, apexLatG: 1.55, brakingDist: 40 },
      { turnNumber: 8, name: 'Pouhon', type: 'Fast Sweeper', direction: 'Left', entryDist: 4420, apexDist: 4540, exitDist: 4660, refSpeed: 230, refGear: 6, apexLatG: 2.3, brakingDist: 30 },
      { turnNumber: 9, name: 'Les Fagnes (Pif-Paf)', type: 'Chicane', direction: 'Right', entryDist: 5120, apexDist: 5210, exitDist: 5290, refSpeed: 145, refGear: 3, apexLatG: 1.75, brakingDist: 60 },
      { turnNumber: 10, name: 'Campus (Stavelot 1)', type: '90° Corner', direction: 'Right', entryDist: 5460, apexDist: 5540, exitDist: 5620, refSpeed: 160, refGear: 4, apexLatG: 1.6, brakingDist: 35 },
      { turnNumber: 11, name: 'Paul Frere (Stavelot 2)', type: 'Fast Sweeper', direction: 'Right', entryDist: 5720, apexDist: 5810, exitDist: 5900, refSpeed: 210, refGear: 5, apexLatG: 1.8, brakingDist: 0 },
      { turnNumber: 12, name: 'Blanchimont 1', type: 'Fast Sweeper', direction: 'Left', entryDist: 6350, apexDist: 6440, exitDist: 6520, refSpeed: 285, refGear: 7, apexLatG: 2.1, brakingDist: 0 },
      { turnNumber: 13, name: 'Blanchimont 2', type: 'Fast Sweeper', direction: 'Left', entryDist: 6560, apexDist: 6640, exitDist: 6720, refSpeed: 290, refGear: 8, apexLatG: 1.9, brakingDist: 0 },
      { turnNumber: 14, name: 'Bus Stop Chicane', type: 'Chicane', direction: 'Right', entryDist: 6780, apexDist: 6860, exitDist: 6940, refSpeed: 72, refGear: 1, apexLatG: 1.3, brakingDist: 110 }
    ];

    return {
      id: 'spa-francorchamps',
      name: 'Circuit de Spa-Francorchamps',
      layout: 'Grand Prix Circuit',
      trackOrdinal: 104,
      lengthMeters: length,
      direction: 'Clockwise',
      sectors: {
        s1End: 2250,
        s2End: 5200,
        s3End: length,
        s1Length: 2250,
        s2Length: 2950,
        s3Length: length - 5200
      },
      turns,
      path2D,
      elevation: {
        minElevation: 372.0,
        maxElevation: 474.0,
        elevationDelta: 102.0,
        profile: [
          { dist: 0, elevation: 400.0 },
          { dist: 1250, elevation: 474.0 },
          { dist: 4500, elevation: 372.0 },
          { dist: 6500, elevation: 395.0 },
          { dist: length, elevation: 400.0 }
        ]
      },
      characteristics: {
        totalTurns: turns.length,
        slowCorners: 3,
        mediumCorners: 4,
        fastCorners: 7,
        longestStraight: 1950,
        rhythmOverview: 'The cathedral of speed through the Ardennes forest with massive vertical Gs in Eau Rouge and demanding technical sectors.',
        dangerZones: [
          'High compression and blind crest at Eau Rouge / Raidillon',
          'Heavy braking into Bus Stop Chicane from nearly 300 km/h',
          'High commitment double-left at Pouhon'
        ],
        overtakingZones: [
          'Kemmel Straight slipstream into Les Combes (T4)',
          'Heavy braking dive into Bus Stop (T14)',
          'La Source hairpin on lap starts (T1)'
        ]
      },
      calibrationMetadata: {
        lapsUsed: 3,
        avgSpeedKph: 215.8,
        calibratedAt: '2026-08-23T11:45:00.000Z',
        carModel: 'Prototype Hypercar',
        consistencyScore: 98.9
      },
      driverNotes: 'Keep the car balanced through Eau Rouge without abrupt steering inputs. Maximize Kemmel Straight exit.',
      createdDate: '2026-08-23T11:45:00.000Z',
      updatedDate: '2026-08-23T11:45:00.000Z'
    };
  }
}
