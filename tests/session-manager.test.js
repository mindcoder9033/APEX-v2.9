import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../public/js/session-manager.js';

// Setup Mock DOM environment for Node.js test runner
function setupMockDom() {
  const domStore = new Map();
  const createElement = (id, initialText = '') => {
    const el = {
      id,
      textContent: initialText,
      innerHTML: initialText,
      value: '',
      classList: {
        classes: new Set(),
        add(...cls) { cls.forEach(c => this.classes.add(c)); },
        remove(...cls) { cls.forEach(c => this.classes.delete(c)); },
        contains(c) { return this.classes.has(c); }
      },
      style: {},
      disabled: false,
      focus: () => {},
      blur: () => {},
      scrollIntoView: () => {},
      getAttribute: () => '0',
      setAttribute: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: (sel) => {
        const childId = sel.replace(/^[#.]/, '');
        return domStore.get(childId) || createElement(childId);
      },
      querySelectorAll: () => []
    };
    domStore.set(id, el);
    return el;
  };

  const ids = [
    'btn-record', 'btn-reset-stint', 'btn-export-csv', 'btn-download-pdf',
    'stint-timer-val', 'lap-counter-val', 'best-lap-val', 'last-lap-val', 'samples-count-val',
    'analysis-report-section', 'analysis-laps-summary', 'track-map-container',
    'track-map-issues-tags', 'coaching-feed', 'corner-table-body', 'delta-table-body',
    'delta-priorities-feed', 'delta-total-gain-badge', 'delta-baseline-laps', 'delta-stint-time',
    'delta-corner-straight-split', 'delta-corner-types-count',
    'braking-efficiency-badge', 'braking-peak-decel-val', 'braking-avg-efficiency-val',
    'braking-procedure-score-val', 'braking-total-distance-val', 'braking-table-body',
    'shifting-grade-badge', 'shifting-powerband-eff-val', 'shifting-blip-comp-val',
    'shifting-brake-stab-val', 'shifting-total-downshifts-val', 'powerband-range-text',
    'powerband-faults-text', 'shifting-table-body', 'downshiftSummaryText',
    'car-control-score-badge', 'car-control-balance-val', 'car-control-max-yaw-val',
    'car-control-tto-val', 'car-control-tankslapper-val', 'car-control-notes-feed',
    'braking-entry-score-badge', 'entry-overslow-loss-val', 'entry-downshift-dips-val',
    'entry-slam-events-val', 'braking-entry-notes-feed',
    'chassis-health-badge', 'chassis-bottoming-val', 'chassis-max-roll-val',
    'chassis-max-pitch-val', 'chassis-rake-val', 'chassis-setup-adjustments-list',
    'surface-condition-badge', 'surface-puddle-val', 'surface-asymmetric-val',
    'surface-hydro-val', 'surface-banking-val', 'surface-notes-feed',
    'scorecard-overall-badge', 'scorecard-table-body',
    'stint-metadata-modal', 'stint-input-session-name', 'stint-error-session-name',
    'stint-select-track-container', 'stint-select-layout-container', 'stint-select-car-container',
    'stint-inherited-driver-name', 'btn-confirm-stint-metadata'
  ];

  ids.forEach(id => createElement(id));

  global.document = {
    getElementById: (id) => domStore.get(id) || createElement(id),
    querySelector: (sel) => {
      const childId = sel.replace(/^[#.]/, '');
      return domStore.get(childId) || createElement(childId);
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  global.window = {
    location: { protocol: 'http:', host: 'localhost:3000' },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    confirm: () => true
  };
}

test('SessionManager: resetStint restores stopwatch, lap counters, sample buffer, and buttons', () => {
  setupMockDom();

  const session = new SessionManager();
  
  // Simulate active recording with samples
  session.isRecording = true;
  session.recordedSamples = [{ test: 1 }, { test: 2 }, { test: 3 }];
  session.stintStartTime = Date.now() - 45000;
  session.stintDurationMs = 45000;
  session.currentLap = 4;
  session.bestLapTime = 72.4;
  session.lastLapTime = 73.1;

  // Set mock DOM element values
  document.getElementById('stint-timer-val').textContent = '00:45.0';
  document.getElementById('lap-counter-val').textContent = 'L04';
  document.getElementById('best-lap-val').textContent = '01:12.400';
  document.getElementById('last-lap-val').textContent = '01:13.100';
  document.getElementById('samples-count-val').textContent = '3';

  const btnRecord = document.getElementById('btn-record');
  btnRecord.classList.add('btn-danger', 'recording-pulse');

  // Trigger reset
  const res = session.resetStint(true);
  assert.equal(res, true, 'resetStint should return true');

  // Verify internal state cleared
  assert.equal(session.isRecording, false);
  assert.equal(session.recordedSamples.length, 0);
  assert.equal(session.stintStartTime, 0);
  assert.equal(session.stintDurationMs, 0);
  assert.equal(session.currentLap, 1);
  assert.equal(session.bestLapTime, null);
  assert.equal(session.lastLapTime, null);

  // Verify DOM values reset
  assert.equal(document.getElementById('stint-timer-val').textContent, '00:00.0');
  assert.equal(document.getElementById('lap-counter-val').textContent, 'L00');
  assert.equal(document.getElementById('best-lap-val').textContent, '--:--.---');
  assert.equal(document.getElementById('last-lap-val').textContent, '--:--.---');
  assert.equal(document.getElementById('samples-count-val').textContent, '0');

  // Verify record button restored
  assert.equal(btnRecord.classList.contains('btn-danger'), false);
  assert.equal(btnRecord.classList.contains('btn-primary'), true);
  assert.ok(btnRecord.innerHTML.includes('START RECORDING'));
});
