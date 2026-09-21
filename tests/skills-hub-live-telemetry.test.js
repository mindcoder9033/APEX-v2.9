import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// Mock DOM environment for SkillsView tests
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.className = '';
    this.style = {};
    this.innerHTML = '';
    this.textContent = '';
    this.title = '';
    this.classList = new MockClassList();
    this.children = [];
    this.eventListeners = new Map();
  }

  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  querySelector(selector) {
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }
}

describe('Skills Hub // Live Telemetry & Stint Recording Visual Feedback', () => {
  let SkillsView;

  before(async () => {
    global.window = {
      innerWidth: 1440,
      addEventListener: () => {},
      removeEventListener: () => {},
      requestAnimationFrame: (cb) => cb()
    };
    global.localStorage = {
      getItem: () => null,
      setItem: () => {}
    };
    global.document = {
      getElementById: (id) => {
        const el = new MockElement();
        el.id = id;
        return el;
      },
      createElement: (tag) => new MockElement(tag),
      addEventListener: () => {}
    };

    const mod = await import('../public/js/skills-view.js');
    SkillsView = mod.SkillsView;
  });

  test('SkillsView: Initializes with inactive recording state and default live properties', () => {
    const view = new SkillsView('view-skills');
    assert.equal(view.isRecording, false);
    assert.equal(view.liveSample, null);
    assert.equal(view.liveCornerBuffer.length, 0);
    assert.equal(view.isCornering, false);
  });

  test('SkillsView: onRecordingStateChange transitions state and clears live buffers on stop', () => {
    const view = new SkillsView('view-skills');
    view.onRecordingStateChange(true);
    assert.equal(view.isRecording, true);

    view.liveCornerBuffer.push({ sample: 1 });
    view.isCornering = true;

    view.onRecordingStateChange(false);
    assert.equal(view.isRecording, false);
    assert.equal(view.liveCornerBuffer.length, 0);
    assert.equal(view.isCornering, false);
  });

  test('SkillsView: formatDuration formats milliseconds to MM:SS.t correctly', () => {
    const view = new SkillsView('view-skills');
    assert.equal(view.formatDuration(0), '00:00.0');
    assert.equal(view.formatDuration(65400), '01:05.4');
    assert.equal(view.formatDuration(182900), '03:02.9');
  });

  test('SkillsView: _getLiveCornerPhase accurately classifies all racecraft kinematic zones', () => {
    const view = new SkillsView('view-skills');

    // 1. Threshold Braking Zone
    const phaseBrake = view._getLiveCornerPhase({
      inputs: { brake: 0.85, throttle: 0 },
      motion: { acceleration: { lateralG: 0.1 } }
    });
    assert.match(phaseBrake.name, /THRESHOLD BRAKING/i);
    assert.equal(phaseBrake.className, 'braking');

    // 2. Trail-Braking / Apex Entry Zone
    const phaseTrail = view._getLiveCornerPhase({
      inputs: { brake: 0.35, throttle: 0 },
      motion: { acceleration: { lateralG: 0.95 } }
    });
    assert.match(phaseTrail.name, /TRAIL-BRAKING/i);
    assert.equal(phaseTrail.className, 'trail');

    // 3. Pure Lateral Apex Zone
    const phaseApex = view._getLiveCornerPhase({
      inputs: { brake: 0.0, throttle: 0.2 },
      motion: { acceleration: { lateralG: 1.25 } }
    });
    assert.match(phaseApex.name, /PURE LATERAL APEX/i);
    assert.equal(phaseApex.className, 'apex');

    // 4. Throttle Exit Unwind Zone
    const phaseExit = view._getLiveCornerPhase({
      inputs: { brake: 0.0, throttle: 0.75 },
      motion: { acceleration: { lateralG: 0.65 } }
    });
    assert.match(phaseExit.name, /THROTTLE UNWIND/i);
    assert.equal(phaseExit.className, 'exit');

    // 5. Straightaway Full Throttle Zone
    const phaseStraight = view._getLiveCornerPhase({
      inputs: { brake: 0.0, throttle: 0.95 },
      motion: { acceleration: { lateralG: 0.05 } }
    });
    assert.match(phaseStraight.name, /STRAIGHTAWAY/i);
    assert.equal(phaseStraight.className, 'straight');
  });

  test('SkillsView: onLiveTelemetry ingests 60Hz samples and accumulates live corner slices', () => {
    const view = new SkillsView('view-skills');
    
    // Simulate approaching and driving through a corner
    for (let i = 0; i < 25; i++) {
      view.onLiveTelemetry({
        speedKmh: 120 - i * 2,
        inputs: { throttle: 0, brake: 0.6, steering: 0.25 },
        motion: {
          acceleration: { lateralG: 0.85 + i * 0.02, longitudinalG: -0.9 },
          angularVelocity: { yaw: 0.3 }
        }
      }, true, { currentLap: 2, sampleCount: i + 1, durationMs: (i + 1) * 16 });
    }

    assert.equal(view.isCornering, true);
    assert.ok(view.liveCornerBuffer.length >= 20);

    // Straighten out onto the exit straight
    view.onLiveTelemetry({
      speedKmh: 140,
      inputs: { throttle: 1.0, brake: 0, steering: 0.01 },
      motion: {
        acceleration: { lateralG: 0.05, longitudinalG: 0.4 },
        angularVelocity: { yaw: 0.0 }
      }
    }, true, { currentLap: 2, sampleCount: 30, durationMs: 500 });

    // Corner should have completed and triggered evaluation
    assert.equal(view.isCornering, false);
    assert.ok(view.latestAttempt !== null);
    assert.ok(view.cornerEvaluationToast !== null);
    assert.equal(view.cornerEvaluationToast.title, 'Turn 1 Evaluated Live');
  });
});
