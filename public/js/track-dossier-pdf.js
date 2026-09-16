/**
 * APEX Track Dossier & 18 Weather Conditions PDF Auto-Exporter
 * Implements Feature 2 of APEX v3.0:
 * Generates an analytical Turn-by-Turn Racecraft Cheatsheet and
 * full 18-Weather Condition Adaptation Matrix PDF report.
 */

import { FORZA_18_WEATHER_PRESETS, WeatherMatrixCalculator } from './analysis/weather-matrix.js';

export class TrackDossierPdfExporter {
  /**
   * Generates and triggers download of Track Dossier & Weather Matrix PDF.
   * @param {Object} track - Track data object
   * @param {boolean} [autoDownload=true]
   * @returns {Promise<Uint8Array>}
   */
  static async exportTrackDossier(track, autoDownload = true) {
    if (!track) {
      console.warn('[TrackDossierPDF] No track data provided');
      return null;
    }

    if (!window.PDFLib) {
      console.error('[TrackDossierPDF] window.PDFLib is not available');
      return null;
    }

    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const doc = await PDFDocument.create();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontMono = await doc.embedFont(StandardFonts.CourierBold);

    const cBg = rgb(0.97, 0.98, 0.99);
    const cCard = rgb(1.0, 1.0, 1.0);
    const cBorder = rgb(0.85, 0.88, 0.92);
    const cTextDark = rgb(0.08, 0.10, 0.14);
    const cTextMuted = rgb(0.40, 0.45, 0.52);
    const cAccent = rgb(0.88, 0.02, 0.0);
    const cSuccess = rgb(0.0, 0.65, 0.35);
    const cBlue = rgb(0.0, 0.50, 0.90);

    const W = 595.28;
    const H = 841.89;

    const drawHeaderFooter = (page, pageNum, title) => {
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, fill: cBg });
      page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, fill: cAccent });

      page.drawText('APEX // TRACK INTELLIGENCE', { x: 36, y: H - 28, size: 10, font: fontBold, color: cAccent });
      page.drawText('TRACK DOSSIER & 18 WEATHERS', { x: 210, y: H - 28, size: 10, font: fontBold, color: cTextDark });
      page.drawText(`${track.trackName || track.name || 'Circuit'} (${track.corners?.length || 14} Turns)`, { x: 36, y: H - 42, size: 8, font: fontRegular, color: cTextMuted });
      page.drawText(`GENERATED: ${new Date().toLocaleDateString()}`, { x: W - 180, y: H - 42, size: 8, font: fontMono, color: cTextMuted });

      page.drawLine({ start: { x: 36, y: H - 50 }, end: { x: W - 36, y: H - 50 }, thickness: 1, color: cBorder });

      page.drawRectangle({ x: 36, y: H - 76, width: W - 72, height: 20, fill: rgb(0.92, 0.94, 0.96) });
      page.drawText(`SECTION ${pageNum} // ${title.toUpperCase()}`, { x: 46, y: H - 71, size: 8.5, font: fontBold, color: cTextDark });

      page.drawLine({ start: { x: 36, y: 36 }, end: { x: W - 36, y: 36 }, thickness: 0.8, color: cBorder });
      page.drawText('APEX MOTORSPORT INTELLIGENCE // TURN-BY-TURN & WEATHER PROTOCOL', { x: 36, y: 22, size: 7, font: fontRegular, color: cTextMuted });
      page.drawText(`PAGE ${pageNum}`, { x: W - 70, y: 22, size: 8, font: fontBold, color: cAccent });
    };

    // ==========================================
    // PAGE 1: TURN-BY-TURN CHEATSHEET
    // ==========================================
    const page1 = doc.addPage([W, H]);
    drawHeaderFooter(page1, 1, 'Turn-by-Turn Racecraft Cheatsheet');

    let y = H - 96;

    // Track Profile Banner
    page1.drawRectangle({ x: 36, y: y - 55, width: W - 72, height: 55, fill: cCard, borderColor: cBorder, borderWidth: 1 });
    page1.drawText(`${(track.trackName || track.name || 'Circuit').toUpperCase()} // MASTER DOSSIER`, { x: 46, y: y - 18, size: 9, font: fontBold, color: cAccent });
    page1.drawText(`Total Distance: ${track.lengthMeters ? (track.lengthMeters / 1000).toFixed(2) + ' km' : '4.25 km'} | Turns: ${track.corners?.length || 14} | Grip Baseline: 100%`, { x: 46, y: y - 34, size: 8.5, font: fontRegular, color: cTextDark });
    page1.drawText('Typology: Type I = Exit Speed onto Straight | Type II = Late Braking End of Straight | Type III = Connecting', { x: 46, y: y - 48, size: 7.5, font: fontRegular, color: cTextMuted });

    y -= 70;

    // Cheatsheet Table Header
    page1.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 18, fill: rgb(0.88, 0.90, 0.93) });
    page1.drawText('TURN', { x: 42, y: y - 12, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('TYPE', { x: 80, y: y - 12, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('BRAKE MARKER', { x: 135, y: y - 12, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('APEX GEAR', { x: 235, y: y - 12, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('REF SPEED', { x: 300, y: y - 12, size: 7.5, font: fontBold, color: cTextDark });
    page1.drawText('RACECRAFT & COACHING NOTES', { x: 375, y: y - 12, size: 7.5, font: fontBold, color: cTextDark });
    y -= 20;

    const cornersList = track.corners && track.corners.length > 0 ? track.corners : [
      { cornerNumber: 1, name: 'Turn 1', type: 'Type I', brakeMarker: '100m Board', refGear: 3, refSpeed: '72 mph', note: 'Critical exit onto main straight; early TAP.' },
      { cornerNumber: 2, name: 'Turn 2', type: 'Type III', brakeMarker: 'Curb start', refGear: 2, refSpeed: '58 mph', note: 'Sacrifice exit to set up Turn 3 line.' },
      { cornerNumber: 3, name: 'Turn 3', type: 'Type I', brakeMarker: 'Turn-in blend', refGear: 3, refSpeed: '84 mph', note: 'Commit to throttle early; track out to white line.' },
      { cornerNumber: 4, name: 'Turn 4', type: 'Type II', brakeMarker: '150m Board', refGear: 2, refSpeed: '48 mph', note: 'Late threshold braking into heavy hairpin.' },
      { cornerNumber: 5, name: 'Turn 5', type: 'Type I', brakeMarker: '50m marker', refGear: 4, refSpeed: '105 mph', note: 'High speed sweeper; maintain smooth steering arc.' },
      { cornerNumber: 6, name: 'Turn 6', type: 'Type III', brakeMarker: 'Chicane entry', refGear: 2, refSpeed: '52 mph', note: 'Clip inside curb without upsetting chassis.' },
      { cornerNumber: 7, name: 'Turn 7', type: 'Type I', brakeMarker: 'Apex roll', refGear: 3, refSpeed: '76 mph', note: 'Full throttle unwinding onto back straight.' }
    ];

    cornersList.slice(0, 16).forEach((c, idx) => {
      const rowBg = idx % 2 === 0 ? cCard : rgb(0.95, 0.96, 0.98);
      page1.drawRectangle({ x: 36, y: y - 16, width: W - 72, height: 16, fill: rowBg });
      page1.drawText(c.name || `T${c.cornerNumber || idx + 1}`, { x: 42, y: y - 11, size: 7.5, font: fontBold, color: cTextDark });
      page1.drawText(c.type || 'Type I', { x: 80, y: y - 11, size: 7.5, font: fontMono, color: c.type === 'Type I' ? cSuccess : (c.type === 'Type II' ? cAccent : cBlue) });
      page1.drawText(c.brakeMarker || '100m Board', { x: 135, y: y - 11, size: 7.5, font: fontRegular, color: cTextDark });
      page1.drawText(`Gear ${c.refGear || 3}`, { x: 235, y: y - 11, size: 7.5, font: fontMono, color: cTextDark });
      page1.drawText(c.refSpeed || '65 mph', { x: 300, y: y - 11, size: 7.5, font: fontMono, color: cTextDark });
      page1.drawText((c.note || 'Hit apex').slice(0, 32), { x: 375, y: y - 11, size: 7, font: fontRegular, color: cTextMuted });
      y -= 17;
    });

    // ==========================================
    // PAGE 2: 18 WEATHER CONDITIONS MATRIX
    // ==========================================
    const page2 = doc.addPage([W, H]);
    drawHeaderFooter(page2, 2, '18 Forza Motorsport Weather Conditions Adaptation Matrix');

    y = H - 96;

    // Weather Matrix Header
    page2.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 18, fill: rgb(0.88, 0.90, 0.93) });
    page2.drawText('WEATHER PRESET', { x: 42, y: y - 12, size: 7, font: fontBold, color: cTextDark });
    page2.drawText('GRIP', { x: 160, y: y - 12, size: 7, font: fontBold, color: cTextDark });
    page2.drawText('TRACK TEMP', { x: 200, y: y - 12, size: 7, font: fontBold, color: cTextDark });
    page2.drawText('PSI OFFSET', { x: 270, y: y - 12, size: 7, font: fontBold, color: cTextDark });
    page2.drawText('EST. LAP DELTA', { x: 340, y: y - 12, size: 7, font: fontBold, color: cTextDark });
    page2.drawText('WET LINE STRATEGY & BRAKE BIAS', { x: 425, y: y - 12, size: 7, font: fontBold, color: cTextDark });
    y -= 20;

    const weatherDossier = WeatherMatrixCalculator.generateTrackWeatherDossier(track);

    weatherDossier.forEach((w, idx) => {
      const rowBg = idx % 2 === 0 ? cCard : rgb(0.95, 0.96, 0.98);
      page2.drawRectangle({ x: 36, y: y - 15, width: W - 72, height: 15, fill: rowBg });
      page2.drawText(w.name, { x: 42, y: y - 10, size: 7, font: fontBold, color: cTextDark });
      page2.drawText(`${Math.round(w.gripCoeff * 100)}%`, { x: 160, y: y - 10, size: 7, font: fontMono, color: w.gripCoeff < 0.8 ? cAccent : cSuccess });
      page2.drawText(`${w.trackTempC}°C`, { x: 200, y: y - 10, size: 7, font: fontMono, color: cTextDark });
      page2.drawText(`${w.tirePressureDeltaPsi >= 0 ? '+' : ''}${w.tirePressureDeltaPsi} PSI`, { x: 270, y: y - 10, size: 7, font: fontMono, color: cTextDark });
      page2.drawText(`+${w.estimatedLapTimeDeltaSec}s`, { x: 340, y: y - 10, size: 7, font: fontMono, color: w.estimatedLapTimeDeltaSec > 5 ? cAccent : cTextMuted });
      page2.drawText((w.coachingNotes || 'Standard line').slice(0, 30), { x: 425, y: y - 10, size: 6.5, font: fontRegular, color: cTextMuted });
      y -= 16;
    });

    const pdfBytes = await doc.save();

    if (autoDownload && typeof window !== 'undefined') {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTrack = (track.trackName || track.name || 'track').toLowerCase().replace(/\s+/g, '-');
      a.href = url;
      a.download = `APEX_v3_TrackDossier_${safeTrack}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[TrackDossierPDF] Track Dossier PDF automatically exported and downloaded.');
    }

    return pdfBytes;
  }
}
