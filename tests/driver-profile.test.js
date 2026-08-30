import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DriverProfileStore } from '../public/js/driver-profile-store.js';

// In-memory mock localStorage for Node.js test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('Driver Profiles System & State Store', () => {
  let store;
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    global.window = {
      localStorage: mockStorage,
      dispatchEvent: () => {}
    };
    global.CustomEvent = class CustomEvent {
      constructor(type, detail) {
        this.type = type;
        this.detail = detail;
      }
    };
    store = new DriverProfileStore();
  });

  test('createDefaultProfile: generates valid schema-compliant driver dossier', () => {
    const profile = store.createDefaultProfile('Max Verstappen', '1', 'Red Bull Racing', 'Elite');
    assert.ok(profile.id.startsWith('driver_'), 'ID must start with driver_ prefix');
    assert.strictEqual(profile.name, 'Max Verstappen');
    assert.strictEqual(profile.number, '1');
    assert.strictEqual(profile.team, 'Red Bull Racing');
    assert.strictEqual(profile.tier, 'Elite');
    assert.strictEqual(profile.preferences.speedUnit, 'kmh');
    assert.strictEqual(profile.careerStats.totalLaps, 0);
    assert.strictEqual(profile.careerStats.totalDistanceKm, 0);
    assert.deepStrictEqual(profile.careerStats.trackPersonalBests, {});
  });

  test('init: detects empty state and returns hasProfiles=false on first launch', async () => {
    const res = await store.init();
    assert.strictEqual(res.hasProfiles, false);
    assert.strictEqual(res.activeProfile, null);
    assert.strictEqual(store.getActiveProfile().name, 'APEX Driver');
  });

  test('saveProfile & setActiveProfile: persists profile to localStorage and sets as active', async () => {
    const p1 = store.createDefaultProfile('Lewis Hamilton', '44', 'Mercedes-AMG', 'Elite');
    p1.color = '#00d2be';

    const saved = await store.saveProfile(p1);
    assert.strictEqual(saved.name, 'Lewis Hamilton');
    assert.strictEqual(store.getAllProfiles().length, 1);
    assert.strictEqual(store.getActiveProfile().id, p1.id);
    assert.strictEqual(store.getActiveProfile().color, '#00d2be');

    // Create and save second profile
    const p2 = store.createDefaultProfile('Charles Leclerc', '16', 'Scuderia Ferrari', 'Pro');
    p2.color = '#e10600';
    await store.saveProfile(p2);

    assert.strictEqual(store.getAllProfiles().length, 2);

    // Switch active driver to p2
    await store.setActiveProfile(p2.id);
    assert.strictEqual(store.getActiveProfile().name, 'Charles Leclerc');
    assert.strictEqual(store.getActiveProfile().number, '16');
  });

  test('recordStintStats: aggregates laps, distance, time, and updates track PB', async () => {
    const driver = store.createDefaultProfile('Lando Norris', '04', 'McLaren Racing', 'Pro');
    await store.saveProfile(driver);
    await store.setActiveProfile(driver.id);

    // Stint 1: 5 laps at Silverstone, best lap 92.450s
    await store.recordStintStats({
      trackName: 'Silverstone Grand Prix Circuit',
      layout: 'Grand Prix',
      car: 'McLaren 720S GT3',
      carClass: 'R Class',
      lapCount: 5,
      durationMs: 462000,
      distanceMeters: 29450,
      bestLapTimeSec: 92.450
    });

    let active = store.getActiveProfile();
    assert.strictEqual(active.careerStats.totalLaps, 5);
    assert.strictEqual(active.careerStats.stintsCompleted, 1);
    assert.strictEqual(active.careerStats.totalTrackTimeSec, 462);
    assert.strictEqual(active.careerStats.totalDistanceKm, 29.45);

    const pbKey = 'silverstone grand prix circuit::grand prix';
    assert.ok(active.careerStats.trackPersonalBests[pbKey], 'PB must be registered');
    assert.strictEqual(active.careerStats.trackPersonalBests[pbKey].lapTimeSec, 92.450);

    // Stint 2: Slower best lap (93.100s) -> PB should remain 92.450s, but laps & distance increase
    await store.recordStintStats({
      trackName: 'Silverstone Grand Prix Circuit',
      layout: 'Grand Prix',
      car: 'McLaren 720S GT3',
      carClass: 'R Class',
      lapCount: 3,
      durationMs: 279000,
      distanceMeters: 17670,
      bestLapTimeSec: 93.100
    });

    active = store.getActiveProfile();
    assert.strictEqual(active.careerStats.totalLaps, 8);
    assert.strictEqual(active.careerStats.stintsCompleted, 2);
    assert.strictEqual(active.careerStats.trackPersonalBests[pbKey].lapTimeSec, 92.450);

    // Stint 3: Faster best lap (91.800s) -> PB must update!
    await store.recordStintStats({
      trackName: 'Silverstone Grand Prix Circuit',
      layout: 'Grand Prix',
      car: 'McLaren 720S GT3',
      carClass: 'R Class',
      lapCount: 4,
      durationMs: 367000,
      distanceMeters: 23560,
      bestLapTimeSec: 91.800
    });

    active = store.getActiveProfile();
    assert.strictEqual(active.careerStats.totalLaps, 12);
    assert.strictEqual(active.careerStats.trackPersonalBests[pbKey].lapTimeSec, 91.800);
  });

  test('deleteProfile: removes profile and auto-switches active driver', async () => {
    const p1 = store.createDefaultProfile('Driver Alpha', '01');
    const p2 = store.createDefaultProfile('Driver Beta', '02');

    await store.saveProfile(p1);
    await store.saveProfile(p2);
    await store.setActiveProfile(p1.id);

    assert.strictEqual(store.getAllProfiles().length, 2);
    assert.strictEqual(store.getActiveProfile().id, p1.id);

    // Delete active profile p1
    const success = await store.deleteProfile(p1.id);
    assert.strictEqual(success, true);
    assert.strictEqual(store.getAllProfiles().length, 1);
    // Active profile should automatically switch to remaining profile p2
    assert.strictEqual(store.getActiveProfile().id, p2.id);
    assert.strictEqual(store.getActiveProfile().name, 'Driver Beta');
  });

  test('Desktop IPC Bridge Emulation: interacts with native file persistence', async () => {
    let mockFileStore = new Map();
    let activeId = null;

    global.window.apexDesktop = {
      isDesktop: true,
      profiles: {
        getAll: async () => ({
          success: true,
          profiles: Array.from(mockFileStore.values()).map(p => ({
            id: p.id,
            name: p.name,
            number: p.number,
            team: p.team,
            tier: p.tier,
            color: p.color
          }))
        }),
        getActiveId: async () => ({ success: true, activeId }),
        getDetail: async (id) => ({ success: true, profile: mockFileStore.get(id) }),
        save: async (profile) => {
          mockFileStore.set(profile.id, profile);
          return { success: true, profile };
        },
        setActive: async (id) => {
          activeId = id;
          return { success: true, activeId: id };
        },
        delete: async (id) => {
          mockFileStore.delete(id);
          if (activeId === id) activeId = null;
          return { success: true };
        },
        openFolder: async () => ({ success: true, path: 'C:\\Users\\User\\Documents\\APEX Telemetry\\Profiles' })
      }
    };

    const desktopStore = new DriverProfileStore();
    assert.strictEqual(desktopStore.isDesktop, true);

    const p = desktopStore.createDefaultProfile('Fernando Alonso', '14', 'Aston Martin F1', 'Elite');
    await desktopStore.saveProfile(p);
    await desktopStore.setActiveProfile(p.id);

    assert.strictEqual(desktopStore.getActiveProfile().name, 'Fernando Alonso');
    assert.strictEqual(mockFileStore.size, 1);

    const folderRes = await desktopStore.openFolder();
    assert.strictEqual(folderRes.success, true);
  });
});
