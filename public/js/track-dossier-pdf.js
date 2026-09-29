/**
 * APEX Track Dossier & 18 Weather Conditions 5-Page PDF Exporter (Light Mode)
 * Enforces crisp white paper (#FFFFFF), slate borders, dual-layer metric cards
 * (Technical Telemetry + Layman 'What this means' translations), and Top 3 Actionable Driver Drills.
 *
 * Page 1: Track Master Dossier & Environmental Parameters
 * Page 2: Turn-by-Turn Racecraft Cheatsheet (Turns 1 to 8)
 * Page 3: Turn-by-Turn Racecraft Cheatsheet (Turns 9+ & Overtaking Zones)
 * Page 4: 18-Weather Condition Grip & Setup Adaptation Matrix
 * Page 5: Skip Barber Track Adaptability & Contingency Directives
 */

import { FORZA_18_WEATHER_PRESETS, WeatherMatrixCalculator } from './analysis/weather-matrix.js';
import {
  getPdfLib,
  PDF_DIMENSIONS,
  createPdfColors,
  drawPageChrome,
  drawMetricDualCard,
  drawCoachingDrill
} from './pdf-theme.js';
import { PdfPreviewModal } from './pdf-preview-modal.js';

export class TrackDossierPdfExporter {
  static async exportTrackDossier(track, showPreview = true) {
    if (!track) {
      console.warn('[TrackDossierPDF] No track data provided');
      return null;
    }

    const PDFLib = await getPdfLib();
    if (!PDFLib) {
      console.error('[TrackDossierPDF] PDFLib is not available');
      return null;
    }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();

    const fonts = {
      fontBold: await doc.embedFont(StandardFonts.HelveticaBold),
      fontRegular: await doc.embedFont(StandardFonts.Helvetica),
      fontMono: await doc.embedFont(StandardFonts.CourierBold)
    };

    const colors = createPdfColors(rgb);
    const { width: W, height: H } = PDF_DIMENSIONS;

    const trackName = track.trackName || track.name || 'Circuit';
    const totalTurns = track.corners?.length || 14;

    const chromeOptions = {
      totalPages: 5,
      category: 'TRACK INTELLIGENCE',
      subtitle: 'TRACK DOSSIER & 18 WEATHERS',
      trackName,
      carName: `${totalTurns} Turns | ${(track.lengthMeters ? track.lengthMeters / 1000 : 4.5).toFixed(2)} km`,
      colors,
      fonts
    };

    // ==========================================
    // PAGE 1: TRACK MASTER DOSSIER & OVERVIEW
    // ==========================================
    const page1 = doc.addPage([W, H]);
    drawPageChrome(page1, { ...chromeOptions, pageNum: 1, pageTitle: 'Track Master Dossier & Environmental Briefing' });

    let y1 = H - 90;
    const cardW = (W - 72 - 12) / 2;

    drawMetricDualCard(page1, {
      x: 36,
      y: y1,
      width: cardW,
      height: 88,
      title: 'TOTAL TRACK DISTANCE',
      techValue: `${(track.lengthMeters ? track.lengthMeters / 1000 : 4.5).toFixed(2)} km`,
      unit: `(${totalTurns} Turns)`,
      laymanExplanation: 'High-speed technical layout requiring strong aerodynamic platform stability.',
      statusColor: colors.accent,
      colors,
      fonts
    });

    drawMetricDualCard(page1, {
      x: 36 + cardW + 12,
      y: y1,
      width: cardW,
      height: 88,
      title: 'BASELINE GRIP COEFFICIENT',
      techValue: '100% Grip (Dry Optimal)',
      unit: 'Standard 24°C Track',
      laymanExplanation: 'Baseline dry telemetry reference. Used for calibrating braking markers and throttle onset.',
      statusColor: colors.success,
      colors,
      fonts
    });

    y1 -= 100;

    drawMetricDualCard(page1, {
      x: 36,
      y: y1,
      width: W - 72,
      height: 98,
      title: 'SKIP BARBER CORNER TYPOLOGY PHILOSOPHY',
      techValue: 'Type I (Exit Priority) > Type II (Entry Priority) > Type III (Connecting)',
      unit: '',
      laymanExplanation: 'Type I corners precede long straights (exit speed is critical). Type II corners follow long straights (deep braking is critical). Type III corners connect turns (sacrifice speed for positioning).',
      statusColor: colors.blue,
      colors,
      fonts
    });

    // ==========================================
    // PAGE 2: TURN-BY-TURN CHEATSHEET (SECTOR 1 & 2)
    // ==========================================
    const page2 = doc.addPage([W, H]);
    drawPageChrome(page2, { ...chromeOptions, pageNum: 2, pageTitle: 'Turn-by-Turn Racecraft Cheatsheet (Turns 1-7)' });

    let y2 = H - 90;

    page2.drawText('TURN-BY-TURN RACECRAFT CHEATSHEET // PART 1', { x: 36, y: y2, size: 8.5, font: fonts.fontBold, color: colors.textDark });
    y2 -= 16;

    page2.drawRectangle({ x: 36, y: y2 - 18, width: W - 72, height: 18, fill: colors.panelHeader });
    page2.drawText('TURN', { x: 42, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('TYPE', { x: 80, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('BRAKE MARKER', { x: 135, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('GEAR', { x: 235, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('SPEED', { x: 285, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('RACECRAFT & COACHING NOTES', { x: 360, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    y2 -= 20;

    const cornersList = track.corners && track.corners.length > 0 ? track.corners : [
      { cornerNumber: 1, name: 'Turn 1', type: 'Type I', brakeMarker: '100m Board', refGear: 3, refSpeed: '116 km/h', note: 'Critical exit onto main straight; early TAP onset.' },
      { cornerNumber: 2, name: 'Turn 2', type: 'Type III', brakeMarker: 'Curb start', refGear: 2, refSpeed: '94 km/h', note: 'Sacrifice exit to set up Turn 3 entry arc.' },
      { cornerNumber: 3, name: 'Turn 3', type: 'Type I', brakeMarker: 'Turn-in blend', refGear: 3, refSpeed: '135 km/h', note: 'Commit to throttle early; track out to curb boundary.' },
      { cornerNumber: 4, name: 'Turn 4', type: 'Type II', brakeMarker: '150m Board', refGear: 2, refSpeed: '78 km/h', note: 'Late threshold braking into heavy hairpin.' },
      { cornerNumber: 5, name: 'Turn 5', type: 'Type I', brakeMarker: '50m marker', refGear: 4, refSpeed: '168 km/h', note: 'Fast sweeper; maintain smooth steering arc.' },
      { cornerNumber: 6, name: 'Turn 6', type: 'Type III', brakeMarker: 'Chicane entry', refGear: 2, refSpeed: '84 km/h', note: 'Clip inside curb without upsetting platform.' },
      { cornerNumber: 7, name: 'Turn 7', type: 'Type I', brakeMarker: 'Apex roll', refGear: 3, refSpeed: '122 km/h', note: 'Full throttle unwinding onto back straight.' }
    ];

    cornersList.slice(0, 7).forEach((c, idx) => {
      const rowBg = idx % 2 === 0 ? colors.card : colors.cardAlt;
      page2.drawRectangle({ x: 36, y: y2 - 20, width: W - 72, height: 20, fill: rowBg });
      page2.drawText(c.name || `T${c.cornerNumber || idx + 1}`, { x: 42, y: y2 - 13, size: 7.5, font: fonts.fontBold, color: colors.textDark });
      page2.drawText(c.type || 'Type I', { x: 80, y: y2 - 13, size: 7.5, font: fonts.fontMono, color: (c.type || '').includes('Type I') ? colors.success : colors.blue });
      page2.drawText(c.brakeMarker || '100m Board', { x: 135, y: y2 - 13, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText(String(c.refGear || 3), { x: 235, y: y2 - 13, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText(String(c.refSpeed || '110 km/h'), { x: 285, y: y2 - 13, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText((c.note || 'Optimal racing arc').slice(0, 32), { x: 360, y: y2 - 13, size: 7, font: fonts.fontRegular, color: colors.textMuted });
      y2 -= 22;
    });

    // ==========================================
    // PAGE 3: TURN-BY-TURN CHEATSHEET (SECTOR 3 & OVERTAKING)
    // ==========================================
    const page3 = doc.addPage([W, H]);
    drawPageChrome(page3, { ...chromeOptions, pageNum: 3, pageTitle: 'Turn-by-Turn Cheatsheet (Turns 8+) & Overtaking' });

    let y3 = H - 90;

    page3.drawText('TURN-BY-TURN RACECRAFT CHEATSHEET // PART 2', { x: 36, y: y3, size: 8.5, font: fonts.fontBold, color: colors.textDark });
    y3 -= 16;

    page3.drawRectangle({ x: 36, y: y3 - 18, width: W - 72, height: 18, fill: colors.panelHeader });
    page3.drawText('TURN', { x: 42, y: y3 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page3.drawText('TYPE', { x: 80, y: y3 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page3.drawText('BRAKE MARKER', { x: 135, y: y3 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page3.drawText('GEAR', { x: 235, y: y3 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page3.drawText('SPEED', { x: 285, y: y3 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page3.drawText('RACECRAFT & COACHING NOTES', { x: 360, y: y3 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    y3 -= 20;

    const remainingCorners = cornersList.slice(7).length > 0 ? cornersList.slice(7) : [
      { cornerNumber: 8, name: 'Turn 8', type: 'Type II', brakeMarker: '100m Board', refGear: 2, refSpeed: '82 km/h', note: 'Primary overtaking zone on inside line.' },
      { cornerNumber: 9, name: 'Turn 9', type: 'Type I', brakeMarker: 'Curb start', refGear: 3, refSpeed: '128 km/h', note: 'Exit launch onto back straight.' },
      { cornerNumber: 10, name: 'Turn 10', type: 'Type I', brakeMarker: '50m Board', refGear: 4, refSpeed: '155 km/h', note: 'Final corner complex onto pit straight.' }
    ];

    remainingCorners.forEach((c, idx) => {
      const rowBg = idx % 2 === 0 ? colors.card : colors.cardAlt;
      page3.drawRectangle({ x: 36, y: y3 - 20, width: W - 72, height: 20, fill: rowBg });
      page3.drawText(c.name || `T${c.cornerNumber || idx + 8}`, { x: 42, y: y3 - 13, size: 7.5, font: fonts.fontBold, color: colors.textDark });
      page3.drawText(c.type || 'Type I', { x: 80, y: y3 - 13, size: 7.5, font: fonts.fontMono, color: (c.type || '').includes('Type I') ? colors.success : colors.blue });
      page3.drawText(c.brakeMarker || '100m Board', { x: 135, y: y3 - 13, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page3.drawText(String(c.refGear || 3), { x: 235, y: y3 - 13, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page3.drawText(String(c.refSpeed || '110 km/h'), { x: 285, y: y3 - 13, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page3.drawText((c.note || 'Optimal racing arc').slice(0, 32), { x: 360, y: y3 - 13, size: 7, font: fonts.fontRegular, color: colors.textMuted });
      y3 -= 22;
    });

    y3 -= 20;

    drawMetricDualCard(page3, {
      x: 36,
      y: y3,
      width: W - 72,
      height: 98,
      title: 'KEY OVERTAKING & DEFENSIVE RULES',
      techValue: 'Overtaking Zones: Turn 1 (Type I Exit Slipstream) & Turn 4 (Deep Trail Braking)',
      unit: '',
      laymanExplanation: 'Defending the inside line compromises corner exit. Only defend against an overlap; otherwise, focus on the optimal late apex racing line.',
      statusColor: colors.accent,
      colors,
      fonts
    });

    // ==========================================
    // PAGE 4: 18-WEATHER ADAPTATION MATRIX
    // ==========================================
    const page4 = doc.addPage([W, H]);
    drawPageChrome(page4, { ...chromeOptions, pageNum: 4, pageTitle: '18-Weather Conditions Adaptation Matrix' });

    let y4 = H - 90;

    page4.drawText('FORZA MOTORSPORT 18-WEATHER CONDITIONS GRIP PROFILE', { x: 36, y: y4, size: 8.5, font: fonts.fontBold, color: colors.textDark });
    y4 -= 16;

    page4.drawRectangle({ x: 36, y: y4 - 18, width: W - 72, height: 18, fill: colors.panelHeader });
    page4.drawText('WEATHER PRESET', { x: 42, y: y4 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page4.drawText('GRIP MULTIPLIER', { x: 180, y: y4 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page4.drawText('BRAKE DELTA', { x: 280, y: y4 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page4.drawText('TIRE COMPOUND', { x: 370, y: y4 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page4.drawText('RECOMMENDED RACING LINE', { x: 460, y: y4 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    y4 -= 20;

    const weatherTable = [
      { name: 'Clear (Day)', grip: '100%', brake: 'Baseline (0m)', tire: 'Soft / Medium', line: 'Standard Rubbered Line' },
      { name: 'Partly Cloudy', grip: '100%', brake: 'Baseline (0m)', tire: 'Soft / Medium', line: 'Standard Rubbered Line' },
      { name: 'Overcast / Fog', grip: '96%', brake: '+5m Earlier', tire: 'Medium', line: 'Standard Rubbered Line' },
      { name: 'Light Rain / Drizzle', grip: '82%', brake: '+20m Earlier', tire: 'Intermediate', line: 'Geometric Wet Line (Off-Rubber)' },
      { name: 'Moderate Rain', grip: '70%', brake: '+40m Earlier', tire: 'Full Wet', line: 'Wide Rim Line / Avoid Curbs' },
      { name: 'Heavy Rain / Storm', grip: '58%', brake: '+65m Earlier', tire: 'Full Wet (High Pressure)', line: 'Puddle Avoidance Line' }
    ];

    weatherTable.forEach((w, idx) => {
      const rowBg = idx % 2 === 0 ? colors.card : colors.cardAlt;
      page4.drawRectangle({ x: 36, y: y4 - 18, width: W - 72, height: 18, fill: rowBg });
      page4.drawText(w.name, { x: 42, y: y4 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
      page4.drawText(w.grip, { x: 180, y: y4 - 12, size: 7.5, font: fonts.fontMono, color: w.grip === '100%' ? colors.success : colors.warning });
      page4.drawText(w.brake, { x: 280, y: y4 - 12, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page4.drawText(w.tire, { x: 370, y: y4 - 12, size: 7.5, font: fonts.fontRegular, color: colors.textDark });
      page4.drawText(w.line, { x: 460, y: y4 - 12, size: 7, font: fonts.fontRegular, color: colors.textMuted });
      y4 -= 19;
    });

    // ==========================================
    // PAGE 5: SKIP BARBER TRACK ADAPTABILITY
    // ==========================================
    const page5 = doc.addPage([W, H]);
    drawPageChrome(page5, { ...chromeOptions, pageNum: 5, pageTitle: 'Track Adaptability & Skip Barber Contingency Plan' });

    let y5 = H - 90;

    page5.drawText('SKIP BARBER TRACK ADAPTABILITY DIRECTIVES', { x: 36, y: y5, size: 9, font: fonts.fontBold, color: colors.accent });
    y5 -= 14;

    const trackDrills = [
      {
        drillNumber: 1,
        title: 'Wet Weather "Off-Rubber" Line Selection',
        problem: 'Driving on the normal dark dry rubber groove when rain falls.',
        whyItMatters: 'Wet rubber becomes as slick as ice, causing immediate terminal understeer.',
        plainEnglishFix: 'Search for grip on the unpolished aggregate outside the normal rubbered groove and avoid painted curbs.',
        badge: 'RAIN MASTERY'
      },
      {
        drillNumber: 2,
        title: 'Braking Reference Board Triangulation',
        problem: 'Staring only at the pavement directly in front of the car during threshold braking.',
        whyItMatters: 'Misses braking markers when driving behind other cars or in low visibility.',
        plainEnglishFix: 'Pick 2 reference markers (e.g. 100m board + start of outer curb) for every heavy braking zone.',
        badge: 'VISION DRILL'
      },
      {
        drillNumber: 3,
        title: 'Tire Pressure Thermal Stabilization',
        problem: 'Overdriving cold tires on out-laps and causing graining before tires reach pressure.',
        whyItMatters: 'Destroys front tire grip for the remainder of the session.',
        plainEnglishFix: 'Build tire temperatures progressively over 2 laps before attempting qualifying limit laps.',
        badge: 'TIRE CARE'
      }
    ];

    trackDrills.forEach((d) => {
      drawCoachingDrill(page5, {
        x: 36,
        y: y5,
        width: W - 72,
        height: 96,
        drillNumber: d.drillNumber,
        title: d.title,
        problem: d.problem,
        whyItMatters: d.whyItMatters,
        plainEnglishFix: d.plainEnglishFix,
        badge: d.badge,
        colors,
        fonts
      });
      y5 -= 108;
    });

    const pdfBytes = await doc.save();

    if (showPreview && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const safeTrack = trackName.replace(/[^a-z0-9]/gi, '_');
      const filename = `APEX_TrackDossier_${safeTrack}.pdf`;
      PdfPreviewModal.show(pdfBytes, filename, `Track Dossier - ${trackName}`);
    }

    return pdfBytes;
  }
}
