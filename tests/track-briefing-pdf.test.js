/**
 * Tests for TrackBriefingBuilder 2-Page Pre-Stint Track Briefing PDF generator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrackBriefingBuilder } from '../src/pdf/track-briefing-builder.js';
import { PDFDocument } from 'pdf-lib';

describe('TrackBriefingBuilder', () => {
  const builder = new TrackBriefingBuilder();

  const silverstoneTrack = {
    id: 'silverstone-gp',
    name: 'Silverstone Circuit',
    layout: 'Grand Prix Circuit',
    lengthMeters: 5891,
    direction: 'Clockwise',
    sectors: { s1End: 1960, s2End: 3920, s3End: 5891 },
    elevation: { minElevation: 140, maxElevation: 153, elevationDelta: 12.6, profile: [] },
    characteristics: {
      totalTurns: 15,
      slowCorners: 3,
      mediumCorners: 4,
      fastCorners: 8,
      longestStraight: 770,
      rhythmOverview: 'High-downforce flowing circuit with iconic fast complexes Copse and Maggotts-Becketts.'
    },
    turns: [
      { turnNumber: 1, name: 'Abbey', type: 'Fast Sweeper', direction: 'Right', entryDist: 340, apexDist: 420, exitDist: 490, refSpeed: 235, refGear: 6, apexLatG: 2.1, brakingDist: 20 },
      { turnNumber: 2, name: 'Farm Curve', type: 'Fast Sweeper', direction: 'Left', entryDist: 530, apexDist: 600, exitDist: 680, refSpeed: 245, refGear: 6, apexLatG: 1.8, brakingDist: 0 },
      { turnNumber: 3, name: 'Village', type: 'Hairpin', direction: 'Right', entryDist: 850, apexDist: 930, exitDist: 990, refSpeed: 82, refGear: 2, apexLatG: 1.3, brakingDist: 95 }
    ],
    path2D: [
      { x: 100, z: 100, dist: 0 },
      { x: 500, z: 200, dist: 2500 },
      { x: 100, z: 100, dist: 5891 }
    ],
    driverNotes: 'Commit to full throttle through Abbey & Farm Curve.'
  };

  const watkinsTrack = {
    id: 'watkins-glen-full',
    name: 'Watkins Glen International',
    layout: 'Grand Prix Course (with Boot)',
    lengthMeters: 5472,
    direction: 'Clockwise',
    sectors: { s1End: 1824, s2End: 3648, s3End: 5472 },
    elevation: { minElevation: 300, maxElevation: 334, elevationDelta: 34.0, profile: [] },
    characteristics: {
      totalTurns: 11,
      slowCorners: 2,
      mediumCorners: 5,
      fastCorners: 4,
      longestStraight: 820,
      rhythmOverview: 'Fast, historic high-speed road course with the high-commitment Esses and undulating Boot section.'
    },
    turns: [
      { turnNumber: 1, name: 'The Ninety', type: '90° Corner', direction: 'Right', entryDist: 420, apexDist: 510, exitDist: 580, refSpeed: 125, refGear: 3, apexLatG: 1.6, brakingDist: 85 },
      { turnNumber: 5, name: 'Inner Loop Bus Stop', type: 'Chicane', direction: 'Right', entryDist: 2340, apexDist: 2420, exitDist: 2500, refSpeed: 140, refGear: 3, apexLatG: 1.8, brakingDist: 95 }
    ],
    path2D: [
      { x: 100, z: 100, dist: 0 },
      { x: 400, z: 500, dist: 2800 },
      { x: 100, z: 100, dist: 5472 }
    ],
    driverNotes: 'Maximize entry curb usage through Bus Stop.'
  };

  it('generates a valid 2-page PDF document for Silverstone GP', async () => {
    const pdfBytes = await builder.build(silverstoneTrack);
    assert.ok(pdfBytes instanceof Uint8Array);
    assert.ok(pdfBytes.length > 2000, 'PDF should have substantive binary content');

    // Verify PDF header magic bytes "%PDF-"
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('utf8');
    assert.equal(header, '%PDF-');

    // Parse back with PDFDocument to verify page count and validity
    const doc = await PDFDocument.load(pdfBytes);
    assert.equal(doc.getPageCount(), 2, 'Pre-Stint Track Briefing PDF must be exactly 2 pages');
  });

  it('generates a valid 2-page PDF document for Watkins Glen with Boot', async () => {
    const pdfBytes = await builder.build(watkinsTrack);
    assert.ok(pdfBytes.length > 2000);

    const doc = await PDFDocument.load(pdfBytes);
    assert.equal(doc.getPageCount(), 2);
  });
});
