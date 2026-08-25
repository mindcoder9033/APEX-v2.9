/**
 * Tests for TrackBriefingBuilder 2-Page Pre-Stint Track Briefing PDF generator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrackBriefingBuilder } from '../src/pdf/track-briefing-builder.js';
import { TrackRepository } from '../src/server/track-repository.js';
import { PDFDocument } from 'pdf-lib';

describe('TrackBriefingBuilder', () => {
  const builder = new TrackBriefingBuilder();
  const repo = new TrackRepository();

  it('generates a valid 2-page PDF document for Silverstone GP', async () => {
    const silverstone = repo.getTrackById('silverstone-gp');
    assert.ok(silverstone);

    const pdfBytes = await builder.build(silverstone);
    assert.ok(pdfBytes instanceof Uint8Array);
    assert.ok(pdfBytes.length > 5000, 'PDF should have substantive binary content');

    // Verify PDF header magic bytes "%PDF-"
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('utf8');
    assert.equal(header, '%PDF-');

    // Parse back with PDFDocument to verify page count and validity
    const doc = await PDFDocument.load(pdfBytes);
    assert.equal(doc.getPageCount(), 2, 'Pre-Stint Track Briefing PDF must be exactly 2 pages');
  });

  it('generates a valid 2-page PDF document for Watkins Glen with Boot', async () => {
    const watkins = repo.getTrackById('watkins-glen-full');
    assert.ok(watkins);

    const pdfBytes = await builder.build(watkins);
    assert.ok(pdfBytes.length > 5000);

    const doc = await PDFDocument.load(pdfBytes);
    assert.equal(doc.getPageCount(), 2);
  });
});
