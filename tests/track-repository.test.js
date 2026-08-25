/**
 * Tests for TrackRepository CRUD, Schema Validation, and Seeding
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

  it('automatically seeds default circuits when directory is empty', () => {
    const tracks = repo.getAllTracks();
    assert.ok(tracks.length >= 4, 'Should seed at least 4 default tracks');
    const ids = tracks.map(t => t.id);
    assert.ok(ids.includes('silverstone-gp'));
    assert.ok(ids.includes('watkins-glen-full'));
    assert.ok(ids.includes('maple-valley'));
    assert.ok(ids.includes('spa-francorchamps'));
  });

  it('fetches track by ID with complete schema', () => {
    const silverstone = repo.getTrackById('silverstone-gp');
    assert.ok(silverstone, 'Silverstone should exist');
    assert.equal(silverstone.name, 'Silverstone Circuit');
    assert.equal(silverstone.direction, 'Clockwise');
    assert.equal(silverstone.lengthMeters, 5891);
    assert.ok(Array.isArray(silverstone.turns) && silverstone.turns.length === 15);
    assert.ok(silverstone.sectors.s1End > 0);
    assert.ok(silverstone.characteristics.totalTurns === 15);
  });

  it('validates required fields on save and throws on invalid data', () => {
    assert.throws(() => {
      repo.saveTrack({ name: 'Incomplete' });
    }, /Invalid track data/);

    assert.throws(() => {
      repo.saveTrack({ lengthMeters: 3000 });
    }, /Invalid track data/);
  });

  it('saves and updates a custom track profile successfully', () => {
    const custom = {
      name: 'Laguna Seca',
      layout: 'Full Road Course',
      lengthMeters: 3602,
      direction: 'Counter-Clockwise',
      turns: [
        { turnNumber: 1, name: 'Andretti Hairpin', type: 'Hairpin', direction: 'Left', entryDist: 400, apexDist: 480, exitDist: 550, refSpeed: 75, refGear: 2, apexLatG: 1.3, brakingDist: 85 },
        { turnNumber: 2, name: 'Turn 2', type: '90° Corner', direction: 'Right', entryDist: 800, apexDist: 870, exitDist: 940, refSpeed: 110, refGear: 3, apexLatG: 1.45, brakingDist: 40 },
        { turnNumber: 8, name: 'The Corkscrew', type: 'Chicane', direction: 'Left', entryDist: 2100, apexDist: 2180, exitDist: 2260, refSpeed: 90, refGear: 2, apexLatG: 1.6, brakingDist: 60 }
      ]
    };

    const saved = repo.saveTrack(custom);
    assert.equal(saved.id, 'laguna-seca-full-road-course');
    assert.equal(saved.lengthMeters, 3602);
    assert.equal(saved.turns.length, 3);

    // Update turn custom name
    const updated = repo.updateTrack(saved.id, {
      driverNotes: 'Attack Corkscrew curb aggressively.'
    });
    assert.equal(updated.driverNotes, 'Attack Corkscrew curb aggressively.');

    const reloaded = repo.getTrackById(saved.id);
    assert.equal(reloaded.driverNotes, 'Attack Corkscrew curb aggressively.');
  });

  it('imports and exports JSON profile properly', () => {
    const exported = repo.getTrackById('silverstone-gp');
    const jsonStr = JSON.stringify(exported);
    
    // Import under modified ID
    const imported = repo.importTrack({
      ...JSON.parse(jsonStr),
      id: 'silverstone-gp-imported',
      name: 'Silverstone GP Imported'
    });

    assert.equal(imported.id, 'silverstone-gp-imported');
    const check = repo.getTrackById('silverstone-gp-imported');
    assert.ok(check);
    assert.equal(check.name, 'Silverstone GP Imported');

    // Delete
    const deleted = repo.deleteTrack('silverstone-gp-imported');
    assert.equal(deleted, true);
    assert.equal(repo.getTrackById('silverstone-gp-imported'), null);
  });
});
