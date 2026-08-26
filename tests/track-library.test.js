import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackLibrarySynthesizer } from '../src/analysis/track-library-synthesizer.js';
import { AnalysisEngine } from '../src/analysis/index.js';
import { PreStintPdfBuilder } from '../public/js/pre-stint-pdf-builder.js';

// Helper to generate synthetic multi-corner stint samples
function generateStintSamples(sampleCount = 200) {
  const samples = [];
  const radius = 300;
  const centerX = 500;
  const centerZ = 500;

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * 2 * Math.PI;
    const posX = centerX + radius * Math.cos(angle);
    const posZ = centerZ + radius * Math.sin(angle);
    const posY = (i >= 50 && i <= 70) ? 15.0 : 0.0; // Elevation crest

    let throttle = 1.0;
    let brake = 0.0;
    let speedMps = 50.0;
    let gear = 4;
    let verticalG = 1.0;

    if (i >= 20 && i < 40) {
      // Heavy Braking into Turn 1
      brake = 0.9;
      throttle = 0.0;
      speedMps = 22.0;
      gear = 2;
    } else if (i >= 40 && i < 60) {
      // Turn 1 Apex and exit
      brake = 0.0;
      throttle = 0.6;
      speedMps = 28.0;
      gear = 3;
    } else if (i >= 60 && i <= 70) {
      // Crest unweighting
      verticalG = 0.45;
      speedMps = 52.0;
      gear = 5;
    }

    samples.push({
      timestampMs: 100000 + i * 16,
      engine: {
        currentRpm: 4000 + (gear * 600),
        maxRpm: 8500,
        idleRpm: 1000
      },
      vehicle: {
        carOrdinal: 101,
        carClass: 'S',
        drivetrain: 'RWD'
      },
      motion: {
        position: { x: posX, y: posY, z: posZ },
        speedMps,
        speedMph: speedMps * 2.236936,
        speedKmh: speedMps * 3.6,
        acceleration: {
          x: 0.2,
          y: verticalG * 9.81,
          z: brake > 0 ? -12.0 : 4.0,
          lateralG: 0.8,
          verticalG: verticalG,
          longitudinalG: brake > 0 ? -1.22 : 0.4
        }
      },
      inputs: {
        throttle,
        brake,
        steering: (i >= 25 && i < 55) ? 0.35 : 0.02,
        gear
      },
      timing: {
        distanceTraveled: i * 25,
        lapNumber: 1,
        currentLap: i * 0.4,
        bestLap: 80.0
      },
      chassis: {
        wheelOnRumbleStrip: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 }
      }
    });
  }

  return samples;
}

test('TrackLibrarySynthesizer: Generates unique trackId and matches FM23 catalog metadata', () => {
  const trackId = TrackLibrarySynthesizer.generateTrackId('Circuit de Spa-Francorchamps', 'Full Circuit');
  assert.equal(trackId, 'circuit-de-spa-francorchamps--full-circuit');

  const match = TrackLibrarySynthesizer.matchCatalogTrack('Spa-Francorchamps', 'Full Circuit');
  assert.equal(match.trackName, 'Circuit de Spa-Francorchamps');
  assert.equal(match.layoutName, 'Full Circuit');
  assert.equal(match.type, 'Real');
  assert.equal(match.officialLength, '7.004 km');
});

test('TrackLibrarySynthesizer: Synthesizes complete track profile with corners, gears, braking, and hazards', () => {
  const synthesizer = new TrackLibrarySynthesizer();
  const samples = generateStintSamples(200);
  
  const profile = synthesizer.synthesize({
    samples,
    metadata: {
      trackName: 'Circuit de Spa-Francorchamps',
      layoutName: 'Full Circuit',
      carName: '2023 Porsche 911 GT3 R',
      driverName: 'APEX Test Driver'
    }
  });

  assert.ok(profile, 'Track profile should be generated');
  assert.equal(profile.trackName, 'Circuit de Spa-Francorchamps');
  assert.equal(profile.layoutName, 'Full Circuit');
  assert.equal(profile.trackType, 'Real');
  assert.ok(profile.corners.length > 0, 'Should extract corners');
  assert.ok(profile.vectorMap.points.length > 0, 'Should generate vector path points');
  assert.ok(profile.hazards.length > 0, 'Should detect track hazards');
  
  // Verify corner attributes
  const firstCorner = profile.corners[0];
  assert.ok(firstCorner.turnNumber >= 1);
  assert.ok(firstCorner.targetGear > 0 && firstCorner.targetGear <= 8);
  assert.ok(firstCorner.brakingMarkerMeters > 0);
  assert.ok(firstCorner.apexSpeedKmh > 0);
  assert.ok(firstCorner.coachingNotes.length > 10);
});

test('AnalysisEngine: Exposes trackSynthesizer and integrates with analysis pipeline', () => {
  const engine = new AnalysisEngine();
  assert.ok(engine.trackSynthesizer instanceof TrackLibrarySynthesizer, 'Engine should instantiate TrackLibrarySynthesizer');
  
  const samples = generateStintSamples(150);
  const report = engine.analyzeStint(samples, {
    track: 'Brands Hatch',
    layout: 'Indy Circuit'
  });

  assert.ok(report, 'Analysis report should generate');
  const profile = engine.trackSynthesizer.synthesize({
    samples,
    laps: report.laps,
    metadata: { trackName: 'Brands Hatch', layoutName: 'Indy Circuit' },
    analysisReport: report
  });

  assert.equal(profile.trackName, 'Brands Hatch');
  assert.equal(profile.layoutName, 'Indy Circuit');
  assert.equal(profile.officialLength, '1.944 km');
});

test('PreStintPdfBuilder: Compiles full 2-page Pre-Stint Driver Briefing PDF', async () => {
  const synthesizer = new TrackLibrarySynthesizer();
  const samples = generateStintSamples(200);
  const profile = synthesizer.synthesize({
    samples,
    metadata: {
      trackName: 'Circuit de Spa-Francorchamps',
      layoutName: 'Full Circuit',
      carName: '2023 Porsche 911 GT3 R'
    }
  });

  const pdfBuilder = new PreStintPdfBuilder();
  const pdfBytes = await pdfBuilder.generate(profile);

  assert.ok(pdfBytes instanceof Uint8Array, 'Output should be Uint8Array');
  assert.ok(pdfBytes.length > 1000, 'PDF should have valid non-empty byte stream');

  // Verify PDF header magic bytes '%PDF'
  const header = String.fromCharCode(...pdfBytes.slice(0, 4));
  assert.equal(header, '%PDF', 'Buffer should contain valid PDF signature');
});
