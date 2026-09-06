import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrackMap3DPdfBuilder } from '../src/pdf/track-map-3d-pdf-builder.js';
import { CornerDynamics3DEngine } from '../src/analysis/corner-dynamics-3d.js';

describe('TrackMap3DPdfBuilder: 3D Spatial Racecraft PDF Generation Unit Tests', () => {
  const pdfBuilder = new TrackMap3DPdfBuilder();
  const dynamicsEngine = new CornerDynamics3DEngine();

  it('instantiates TrackMap3DPdfBuilder with A4 dimensions and motorsport margins', () => {
    assert.strictEqual(Math.round(pdfBuilder.width), 595);
    assert.strictEqual(Math.round(pdfBuilder.height), 842);
    assert.strictEqual(pdfBuilder.margin, 36);
  });

  it('compiles a full 2-page 3D Spatial Racecraft PDF document without error', async () => {
    // Generate synthetic corner data
    const mockCorners = [
      {
        cornerNumber: 1,
        direction: 'RIGHT',
        radiusMeters: 55,
        elevationDeltaMeters: 1.5,
        entry: { actualSpeedKmh: 140, targetSpeedKmh: 145, recommendedGear: 3, actualGear: 3, brakingStartedEarly: false, thresholdBrakePressure: 90 },
        actualApex: { classification: 'LATE', lateApexDeltaMeters: 4.2, actualSpeedKmh: 86, targetApexSpeedKmh: 88, radiusUtilizationPercent: 96, coachingFeedback: 'Optimal line' },
        exit: { actualSpeedKmh: 178, targetSpeedKmh: 180, recommendedGear: 4, actualGear: 4, tapDistBeforeApexMeters: 5.5 }
      },
      {
        cornerNumber: 2,
        direction: 'LEFT',
        radiusMeters: 35,
        elevationDeltaMeters: -2.0,
        entry: { actualSpeedKmh: 110, targetSpeedKmh: 115, recommendedGear: 2, actualGear: 2, brakingStartedEarly: true, thresholdBrakePressure: 95 },
        actualApex: { classification: 'EARLY', lateApexDeltaMeters: -3.5, actualSpeedKmh: 68, targetApexSpeedKmh: 72, radiusUtilizationPercent: 82, coachingFeedback: 'Early turn-in detected' },
        exit: { actualSpeedKmh: 135, targetSpeedKmh: 142, recommendedGear: 3, actualGear: 3, tapDistBeforeApexMeters: 0 }
      }
    ];

    const pdfBytes = await pdfBuilder.generate({
      mapImageBase64: null,
      corners3D: mockCorners,
      sessionData: {
        trackName: 'Sebring International Raceway',
        lapDistanceM: 6019,
        maxG: 1.28
      },
      trackProfile: {
        trackName: 'Sebring International Raceway',
        trackLengthM: 6019,
        elevationDeltaM: 14.5,
        cornersCount: 17
      }
    });

    assert.strictEqual(pdfBytes instanceof Uint8Array, true);
    assert.strictEqual(pdfBytes.length > 2000, true, 'PDF binary output must be non-empty and valid size');

    // Verify PDF header magic bytes "%PDF-"
    const header = String.fromCharCode(...pdfBytes.slice(0, 5));
    assert.strictEqual(header, '%PDF-', 'Must contain valid PDF header');
  });
});
