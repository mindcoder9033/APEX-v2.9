/**
 * Tests for TrackRepository CRUD, Schema Validation, and Persistence
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TrackRepository } from '../src/server/track-repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.resolve(__dirname, '../data/test-tracks');

describe('TrackRepository', () => {
  let repo;

  before(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    repo = new TrackRepository(TEST_DATA_DIR);
  });

  after(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  it('starts with a clean empty directory without mock data', () => {
    const tracks = repo.getAllTracks();
    assert.equal(tracks.length, 0, 'Should start with empty track library');
  });

  it('saves an uncalibrated track profile (lengthMeters: 0) awaiting telemetry', () => {
    const uncal = repo.saveTrack({
      name: 'Brands Hatch',
      layout: 'Grand Prix Circuit',
      lengthMeters: 0,
      direction: 'Clockwise',
      turns: []
    });

    assert.ok(uncal.id, 'Should generate slug ID');
    assert.equal(uncal.name, 'Brands Hatch');
    assert.equal(uncal.layout, 'Grand Prix Circuit');
    assert.equal(uncal.lengthMeters, 0);
    assert.equal(uncal.status, 'Uncalibrated');

    const fetched = repo.getTrackById(uncal.id);
    assert.ok(fetched, 'Fetched uncalibrated track should exist');
    assert.equal(fetched.lengthMeters, 0);
  });

  it('validates required fields on save and throws on missing name', () => {
    assert.throws(() => {
      repo.saveTrack({ lengthMeters: 3000 });
    }, /Track name is required/);

    assert.throws(() => {
      repo.saveTrack(null);
    }, /Track data must be an object/);
  });

  it('saves and updates a calibrated track profile with full geometry', () => {
    const custom = {
      name: 'Laguna Seca',
      layout: 'Full Road Course',
      lengthMeters: 3602,
      direction: 'Counter-Clockwise',
      turns: [
        { turnNumber: 1, name: 'Andretti Hairpin', type: 'Hairpin', direction: 'Left', entryDist: 400, apexDist: 480, exitDist: 550, refSpeed: 75, refGear: 2, apexLatG: 1.3, brakingDist: 85 },
        { turnNumber: 2, name: 'Turn 2', type: '90° Corner', direction: 'Right', entryDist: 800, apexDist: 870, exitDist: 940, refSpeed: 110, refGear: 3, apexLatG: 1.5, brakingDist: 60 },
        { turnNumber: 8, name: 'The Corkscrew', type: 'Chicane', direction: 'Left', entryDist: 2100, apexDist: 2180, exitDist: 2260, refSpeed: 80, refGear: 2, apexLatG: 1.6, brakingDist: 70 }
      ],
      path2D: [
        { x: 100, z: 200, dist: 0 },
        { x: 300, z: 400, dist: 1800 },
        { x: 100, z: 200, dist: 3602 }
      ],
      driverNotes: 'Brake in a straight line before crest at Turn 8.'
    };

    const saved = repo.saveTrack(custom);
    assert.equal(saved.id, 'laguna-seca-full-road-course');
    assert.equal(saved.turns.length, 3);
    assert.equal(saved.status, 'Calibrated');
    assert.equal(saved.lengthMeters, 3602);
    assert.ok(saved.sectors.s1End > 0);

    // Update turn name
    saved.turns[0].name = 'Andretti Curve';
    const updated = repo.updateTrack(saved.id, { turns: saved.turns });
    assert.equal(updated.turns[0].name, 'Andretti Curve');
  });

  it('imports and exports JSON profile properly', () => {
    const rawTrack = {
      name: 'Spa-Francorchamps',
      layout: 'Grand Prix Circuit',
      lengthMeters: 7004,
      direction: 'Clockwise',
      turns: [
        { turnNumber: 1, name: 'La Source', type: 'Hairpin', refSpeed: 70, refGear: 2 }
      ]
    };

    const imported = repo.importTrack(rawTrack);
    assert.ok(imported.id);
    assert.equal(imported.name, 'Spa-Francorchamps');

    const exported = repo.exportTrack(imported.id);
    assert.equal(exported.name, 'Spa-Francorchamps');
    assert.equal(exported.lengthMeters, 7004);
  });
});
