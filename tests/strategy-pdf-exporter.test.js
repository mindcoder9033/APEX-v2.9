import test from 'node:test';
import assert from 'node:assert/strict';

import { StrategyPdfExporter } from '../src/pdf/strategy-pdf-exporter.js';
import { CORNER_STRATEGY_TYPE } from '../src/analysis/circuit-strategist.js';
import { LINE_ARCHETYPE } from '../src/analysis/optimal-line-engine.js';

test('StrategyPdfExporter // Motorsport-Grade 2-Page Racecraft Dossier', async (t) => {
  const mockTrack = {
    trackId: 'silverstone-gp',
    trackName: 'Silverstone Grand Prix Circuit',
    layoutName: 'Grand Prix',
    lapDistanceMeters: 5891,
    corners: [
      {
        cornerNumber: 1,
        name: 'Copse',
        type: 'TYPE_1_EXIT_PRIORITY',
        entrySpeedMps: 72,
        apexSpeedMps: 65,
        exitSpeedMps: 70,
        followingStraightMeters: 450,
        precedingStraightMeters: 280,
        elevationChangeMeters: -0.8
      },
      {
        cornerNumber: 2,
        name: 'Maggotts',
        type: 'TYPE_2_LINKED_SEQUENCE',
        entrySpeedMps: 78,
        apexSpeedMps: 68,
        exitSpeedMps: 64,
        followingStraightMeters: 120,
        precedingStraightMeters: 100,
        elevationChangeMeters: 1.2
      },
      {
        cornerNumber: 3,
        name: 'Becketts',
        type: 'TYPE_2_LINKED_SEQUENCE',
        entrySpeedMps: 64,
        apexSpeedMps: 52,
        exitSpeedMps: 56,
        followingStraightMeters: 140,
        precedingStraightMeters: 120,
        elevationChangeMeters: -1.5
      },
      {
        cornerNumber: 4,
        name: 'Chapel',
        type: 'TYPE_1_EXIT_PRIORITY',
        entrySpeedMps: 56,
        apexSpeedMps: 50,
        exitSpeedMps: 66,
        followingStraightMeters: 770,
        precedingStraightMeters: 140,
        elevationChangeMeters: -2.1
      },
      {
        cornerNumber: 5,
        name: 'Stowe',
        type: 'TYPE_3_ENTRY_PRIORITY',
        entrySpeedMps: 76,
        apexSpeedMps: 42,
        exitSpeedMps: 48,
        followingStraightMeters: 220,
        precedingStraightMeters: 770,
        elevationChangeMeters: 0.5
      }
    ]
  };

  const mockSimulationResult = {
    lapDeltaSec: -0.142,
    exitSpeedDeltaKph: 4.8,
    exitSpeedDeltaMps: 1.33,
    entrySpeedKph: 245.0,
    apexSpeedKph: 180.0,
    exitSpeedKph: 238.0,
    minRadiusMeters: 62.5,
    effectiveG: 1.85,
    tractionDemandPercent: 88,
    straightGainSec: -0.095,
    cornerGainSec: -0.047,
    topographyRisk: 'LOW'
  };

  const mockAdjustments = {
    deltaBrakeMeters: 4,
    deltaTurnInMeters: -5,
    apexDepthPercent: 0.68,
    deltaTapMeters: -8,
    deltaTrackOutMeters: 2,
    apexLateralOffset: 0.05,
    archetype: LINE_ARCHETYPE.LATE_APEX
  };

  const mockDriver = {
    name: 'Alex Albon',
    number: '23',
    tier: 'Pro'
  };

  await t.test('synthesizeStrategyData: Compiles complete racecraft data model', () => {
    const data = StrategyPdfExporter.synthesizeStrategyData({
      track: mockTrack,
      selectedCornerIndex: 3, // Chapel
      profileName: 'Hangar Straight Launch V2',
      profileNotes: 'Sacrifice Becketts entry to carry maximum speed onto Hangar Straight.',
      archetype: LINE_ARCHETYPE.LATE_APEX,
      adjustments: mockAdjustments,
      simulationResult: mockSimulationResult,
      driverProfile: mockDriver
    });

    assert.strictEqual(data.trackName, 'Silverstone Grand Prix Circuit');
    assert.strictEqual(data.layoutName, 'Grand Prix');
    assert.strictEqual(data.profileName, 'Hangar Straight Launch V2');
    assert.strictEqual(data.driverName, 'Alex Albon');
    assert.strictEqual(data.cornerCount, 5);
    assert.strictEqual(data.selectedCorner.cornerNumber, 4);
    assert.strictEqual(data.selectedCorner.name, 'Chapel');

    // Turn Matrix
    assert.strictEqual(data.turnMatrix.length, 5);
    assert.strictEqual(data.turnMatrix[3].name, 'Chapel');
    assert.strictEqual(data.turnMatrix[3].typeCode, 'TYPE 1 (EXIT)');
    assert.strictEqual(data.turnMatrix[3].isSelected, true);

    // Landmark Pins
    assert.strictEqual(data.landmarkPins.length, 5);
    const brakePin = data.landmarkPins.find(p => p.id === 'B');
    assert.ok(brakePin, 'Brake pin should be present');
    assert.strictEqual(brakePin.offset, '+4m');

    const apexPin = data.landmarkPins.find(p => p.id === 'A');
    assert.ok(apexPin, 'Apex pin should be present');
    assert.strictEqual(apexPin.offset, '68% (Late Apex)');

    // Skip Barber Coaching Directives
    assert.ok(data.skipBarberDirectives.length >= 3, 'Should generate at least 3 coaching directives');
    assert.ok(data.skipBarberDirectives.some(d => d.title.includes('Type 1')), 'Should highlight Type 1 exit priority');
  });

  await t.test('synthesizeStrategyData: Provides robust fallbacks for empty inputs', () => {
    const data = StrategyPdfExporter.synthesizeStrategyData({});

    assert.ok(data.trackName);
    assert.ok(data.driverName);
    assert.ok(data.selectedCorner);
    assert.ok(data.turnMatrix.length > 0);
    assert.ok(data.landmarkPins.length === 5);
  });

  await t.test('exportStrategyDossier: Compiles valid 2-Page PDF binary buffer', async () => {
    const pdfBytes = await StrategyPdfExporter.exportStrategyDossier({
      track: mockTrack,
      selectedCornerIndex: 0,
      profileName: 'Copse High-Speed Baseline',
      profileNotes: 'Commit early on throttle, absorb curb on exit.',
      archetype: LINE_ARCHETYPE.LATE_APEX,
      adjustments: mockAdjustments,
      simulationResult: mockSimulationResult,
      driverProfile: mockDriver
    }, false);

    assert.ok(pdfBytes, 'PDF bytes should be returned');
    assert.ok(pdfBytes instanceof Uint8Array, 'PDF output must be Uint8Array');
    assert.ok(pdfBytes.length > 5000, `PDF size should be substantial (got ${pdfBytes.length} bytes)`);

    // Validate PDF magic number %PDF-
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    assert.strictEqual(header, '%PDF-', 'Must contain valid PDF header');
  });
});
