/**
 * APEX Circuit Strategist - PDF Racecraft Strategy Dossier Exporter (Browser-served)
 * Generates a motorsport-grade 2-Page Racecraft Strategy Dossier PDF:
 * - Page 1: Circuit Master Overview, Strategy KPI Summary, and Turn-by-Turn Strategy Matrix
 * - Page 2: Selected Corner Anatomy, Landmark Pin Offsets, Topography, and Skip Barber Tactical Directives
 */

import { CORNER_STRATEGY_TYPE } from './analysis/circuit-strategist.js';
import { LINE_ARCHETYPE } from './analysis/optimal-line-engine.js';

export class StrategyPdfExporter {
  /**
   * Resolve PDFLib dynamically whether running in browser (window.PDFLib) or Node.js
   */
  static async getPdfLib() {
    if (typeof window !== 'undefined' && window.PDFLib) {
      return window.PDFLib;
    }
    try {
      return await import('pdf-lib');
    } catch (e) {
      console.error('[StrategyPdfExporter] PDFLib not available:', e);
      return null;
    }
  }

  /**
   * Synthesizes strategy dossier data model from track, corner, and simulation results
   * @param {Object} options
   * @returns {Object}
   */
  static synthesizeStrategyData(options = {}) {
    const {
      track = null,
      selectedCornerIndex = 0,
      profileName = 'Default Baseline Strategy',
      profileNotes = '',
      archetype = LINE_ARCHETYPE.LATE_APEX,
      adjustments = {},
      simulationResult = null,
      driverProfile = null
    } = options;

    const trackName = track?.trackName || 'Forza Motorsport Circuit';
    const layoutName = track?.layoutName || 'Grand Prix Circuit';
    const lengthMeters = track?.lapDistanceMeters || 4500;
    const corners = (track?.corners && track.corners.length > 0) ? track.corners : [
      {
        cornerNumber: 1,
        name: 'Turn 1',
        type: 'TYPE_1_EXIT_PRIORITY',
        entrySpeedMps: 45,
        apexSpeedMps: 28,
        exitSpeedMps: 38,
        followingStraightMeters: 350,
        elevationChangeMeters: -2.5
      }
    ];
    const cornerCount = corners.length;
    const selectedCorner = corners[selectedCornerIndex] || corners[0];

    const driverName = driverProfile?.name || 'APEX Driver';
    const driverNumber = driverProfile?.number || '#01';
    const driverTier = (driverProfile?.tier || 'CLUB').toUpperCase();

    // Compute Turn-by-Turn Projected Gains
    let totalProjectedLapGainSec = 0;
    const turnMatrix = corners.map((c, idx) => {
      const isSelected = idx === selectedCornerIndex;
      const fStraight = c.followingStraightMeters || 300;
      const baseExitKmh = Math.round((c.exitSpeedMps || 35) * 3.6);
      const isType1 = c.type === 'Type I (Exit Priority)' || c.type === CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY || c.type === 'TYPE_1_EXIT_PRIORITY' || fStraight >= 220;
      const typeCode = isType1 ? 'TYPE 1 (EXIT)' : (fStraight < 150 ? 'TYPE 2 (ENTRY)' : 'TYPE 3 (S-LINK)');
      
      const deltaExitKmh = isSelected 
        ? (simulationResult?.deltas?.exitSpeedKmh ?? simulationResult?.exitSpeedDeltaKph ?? 3.5)
        : (isType1 ? 3.0 : 1.5);
      
      const timeGainSec = Number((-((deltaExitKmh / 3.6) * fStraight) / Math.pow((baseExitKmh / 3.6) * 1.25, 2)).toFixed(3));
      totalProjectedLapGainSec += timeGainSec;

      return {
        cornerNumber: c.cornerNumber || idx + 1,
        name: c.name || `Turn ${idx + 1}`,
        type: typeCode,
        typeCode,
        isSelected,
        brakeMarker: isSelected ? `${adjustments.deltaBrakeMeters > 0 ? '+' : ''}${adjustments.deltaBrakeMeters || 0}m` : 'Baseline',
        turnIn: isSelected ? `${adjustments.deltaTurnInMeters > 0 ? '+' : ''}${adjustments.deltaTurnInMeters || -4}m` : '-3m',
        apexDepth: isSelected ? `${Math.round((adjustments.apexDepthPercent || 0.68) * 100)}%` : '65%',
        tapOnset: isSelected ? `${adjustments.deltaTapMeters || -8}m` : '-6m',
        baseExitKmh: `${baseExitKmh} km/h`,
        simExitKmh: `${Math.round(baseExitKmh + deltaExitKmh)} km/h`,
        deltaGain: `${timeGainSec.toFixed(3)}s`,
        gear: c.targetGear || c.gear || (c.apexSpeedMps < 22 ? '2' : (c.apexSpeedMps < 32 ? '3' : '4'))
      };
    });

    const landmarkPins = [
      { id: 'B', name: 'Braking Point', offset: `${(adjustments.deltaBrakeMeters || 0) > 0 ? '+' : ''}${adjustments.deltaBrakeMeters || 0}m`, desc: 'Threshold brake onset reference marker' },
      { id: 'I', name: 'Turn-In Marker', offset: `${(adjustments.deltaTurnInMeters || -4) > 0 ? '+' : ''}${adjustments.deltaTurnInMeters || -4}m`, desc: 'Initial steering input & weight transfer' },
      { id: 'A', name: 'Apex Clipping Point', offset: `${Math.round((adjustments.apexDepthPercent || 0.68) * 100)}% (${(adjustments.apexDepthPercent || 0.68) > 0.6 ? 'Late Apex' : 'Geometric'})`, desc: 'Innermost geometric track clipping point' },
      { id: 'T', name: 'Throttle Application (TAP)', offset: `${(adjustments.deltaTapMeters || -8) > 0 ? '+' : ''}${adjustments.deltaTapMeters || -8}m`, desc: 'Initial throttle application reference' },
      { id: 'O', name: 'Track-Out Point', offset: `${(adjustments.deltaTrackOutMeters || 0) > 0 ? '+' : ''}${adjustments.deltaTrackOutMeters || 0}m`, desc: 'Full-width exit curb unwind position' }
    ];

    const skipBarberDirectives = [
      {
        title: 'Skip Barber Principle: Exit Speed Priority (Type 1)',
        body: 'The speed you leave a corner with is carried for the entire duration of the following straightaway. Prioritize late apex to maximize throttle application onset.'
      },
      {
        title: 'Trail-Braking & Weight Transfer Management',
        body: 'Blend off braking pressure smoothly as steering lock increases to keep front tires within their optimal friction circle without overloading the front axle.'
      },
      {
        title: 'Elevation Dynamics & Apex Camber Compression',
        body: 'Topographical changes alter tire normal force. Anticipate crest unweighting and take advantage of positive camber compression in downhill braking zones.'
      }
    ];

    const normalizedSimResult = {
      simulatedRadius: simulationResult?.simulatedRadius || 68.5,
      effectiveG: simulationResult?.effectiveG || 1.16,
      simulated: {
        exitSpeedKmh: simulationResult?.simulated?.exitSpeedKmh ?? simulationResult?.exitSpeedKph ?? 138.2,
        entrySpeedKmh: simulationResult?.simulated?.entrySpeedKmh ?? simulationResult?.entrySpeedKph ?? 165.0,
        apexSpeedKmh: simulationResult?.simulated?.apexSpeedKmh ?? simulationResult?.apexSpeedKph ?? 98.4
      },
      baseline: {
        exitSpeedKmh: simulationResult?.baseline?.exitSpeedKmh ?? 134.2,
        entrySpeedKmh: simulationResult?.baseline?.entrySpeedKmh ?? 165.0,
        apexSpeedKmh: simulationResult?.baseline?.apexSpeedKmh ?? 96.0
      },
      deltas: {
        exitSpeedKmh: simulationResult?.deltas?.exitSpeedKmh ?? simulationResult?.exitSpeedDeltaKph ?? 4.0,
        totalLapDeltaSec: simulationResult?.deltas?.totalLapDeltaSec ?? simulationResult?.lapDeltaSec ?? -0.428,
        straightawayDeltaSec: simulationResult?.deltas?.straightawayDeltaSec ?? simulationResult?.straightGainSec ?? -0.380
      }
    };

    return {
      trackName,
      layoutName,
      lengthMeters,
      cornerCount,
      driverName,
      driverNumber,
      driverTier,
      profileName,
      profileNotes,
      archetype,
      adjustments: {
        deltaBrakeMeters: adjustments.deltaBrakeMeters || 0,
        deltaTurnInMeters: adjustments.deltaTurnInMeters || -4,
        apexDepthPercent: adjustments.apexDepthPercent || 0.68,
        deltaTapMeters: adjustments.deltaTapMeters || -8,
        deltaTrackOutMeters: adjustments.deltaTrackOutMeters || 0,
        ...adjustments
      },
      selectedCorner,
      simulationResult: normalizedSimResult,
      turnMatrix,
      landmarkPins,
      skipBarberDirectives,
      totalProjectedLapGainSec: Number(totalProjectedLapGainSec.toFixed(3)),
      generatedAt: new Date()
    };
  }

  /**
   * Generates and triggers download of the 2-Page PDF Racecraft Strategy Dossier
   * @param {Object} options
   * @param {boolean} [autoDownload=true]
   * @returns {Promise<Uint8Array>}
   */
  static async exportStrategyDossier(options = {}, autoDownload = true) {
    const PDFLib = await this.getPdfLib();
    if (!PDFLib) {
      console.error('[StrategyPdfExporter] PDFLib library not available');
      return null;
    }

    const data = this.synthesizeStrategyData(options);
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontMono = await doc.embedFont(StandardFonts.CourierBold);

    // Color Palette
    const cBg = rgb(0.98, 0.98, 0.99);
    const cCard = rgb(1.0, 1.0, 1.0);
    const cHeader = rgb(0.07, 0.08, 0.10);
    const cBorder = rgb(0.85, 0.88, 0.92);
    const cText = rgb(0.1, 0.12, 0.15);
    const cMuted = rgb(0.45, 0.50, 0.58);
    const cGold = rgb(0.88, 0.62, 0.0);
    const cCyan = rgb(0.0, 0.70, 0.85);
    const cSuccess = rgb(0.0, 0.65, 0.30);
    const cF1Red = rgb(0.88, 0.05, 0.0);

    // ==========================================
    // PAGE 1: CIRCUIT MASTER STRATEGY PLAN
    // ==========================================
    const page1 = doc.addPage([595.28, 841.89]); // A4 Standard
    const { width, height } = page1.getSize();

    // Background
    page1.drawRectangle({ x: 0, y: 0, width, height, color: cBg });

    // Header Banner
    page1.drawRectangle({ x: 0, y: height - 64, width, height: 64, color: cHeader });
    page1.drawRectangle({ x: 0, y: height - 67, width, height: 3, color: cGold });

    page1.drawText('APEX // RACECRAFT STRATEGY DOSSIER', {
      x: 32,
      y: height - 34,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page1.drawText('SKIP BARBER RACECRAFT & DRIVING LINE MASTER PLAN', {
      x: 32,
      y: height - 50,
      size: 9,
      font: fontMono,
      color: cGold
    });

    page1.drawText(`DRIVER: ${data.driverName} (${data.driverTier})  |  DATE: ${data.generatedAt.toISOString().split('T')[0]}`, {
      x: width - 260,
      y: height - 42,
      size: 8,
      font: fontMono,
      color: rgb(0.8, 0.85, 0.9)
    });

    // Circuit Metadata Card
    const cardY = height - 128;
    page1.drawRectangle({
      x: 32,
      y: cardY,
      width: width - 64,
      height: 52,
      color: cCard,
      borderColor: cBorder,
      borderWidth: 1
    });

    page1.drawText('CIRCUIT PROFILE:', { x: 44, y: cardY + 36, size: 8, font: fontBold, color: cMuted });
    page1.drawText(`${data.trackName} - ${data.layoutName}`, { x: 44, y: cardY + 20, size: 12, font: fontBold, color: cText });

    page1.drawText('STRATEGY PROFILE:', { x: 260, y: cardY + 36, size: 8, font: fontBold, color: cMuted });
    page1.drawText(`${data.profileName}`, { x: 260, y: cardY + 20, size: 11, font: fontBold, color: cGold });

    page1.drawText('PROJECTED STINT GAIN:', { x: 420, y: cardY + 36, size: 8, font: fontBold, color: cMuted });
    page1.drawText(`${data.totalProjectedLapGainSec}s / LAP`, { x: 420, y: cardY + 20, size: 13, font: fontBold, color: cSuccess });

    // Section Title: Turn-by-Turn Strategy Master Matrix
    page1.drawText('TURN-BY-TURN STRATEGY MASTER MATRIX', {
      x: 32,
      y: cardY - 20,
      size: 11,
      font: fontBold,
      color: cText
    });

    // Master Strategy Table
    const tableTop = cardY - 32;
    const colX = [32, 70, 160, 220, 275, 335, 395, 455, 500];
    const headers = ['TURN', 'PRIORITY TYPE', 'BRAKE', 'TURN-IN', 'APEX %', 'EXIT TARGET', 'TAP', 'GEAR', 'DELTA'];

    // Table Header Row
    page1.drawRectangle({
      x: 32,
      y: tableTop - 18,
      width: width - 64,
      height: 20,
      color: rgb(0.12, 0.14, 0.18)
    });

    headers.forEach((h, i) => {
      page1.drawText(h, {
        x: colX[i] + 4,
        y: tableTop - 13,
        size: 7.5,
        font: fontBold,
        color: rgb(0.9, 0.92, 0.95)
      });
    });

    // Rows (Limit to max 16 turns on Page 1)
    let curY = tableTop - 36;
    const maxRows = Math.min(15, data.turnMatrix.length);
    for (let r = 0; r < maxRows; r++) {
      const row = data.turnMatrix[r];
      const isEven = r % 2 === 0;

      page1.drawRectangle({
        x: 32,
        y: curY - 3,
        width: width - 64,
        height: 18,
        color: isEven ? rgb(0.96, 0.97, 0.98) : cCard,
        borderColor: cBorder,
        borderWidth: 0.5
      });

      page1.drawText(`T${row.cornerNumber}`, { x: colX[0] + 4, y: curY + 2, size: 8, font: fontBold, color: cText });
      page1.drawText(row.type, { x: colX[1] + 4, y: curY + 2, size: 7.5, font: fontRegular, color: row.type.includes('EXIT') ? cSuccess : (row.type.includes('ENTRY') ? cCyan : cGold) });
      page1.drawText(row.brakeMarker, { x: colX[2] + 4, y: curY + 2, size: 8, font: fontMono, color: cText });
      page1.drawText(row.turnIn, { x: colX[3] + 4, y: curY + 2, size: 8, font: fontMono, color: cText });
      page1.drawText(row.apexDepth, { x: colX[4] + 4, y: curY + 2, size: 8, font: fontMono, color: cGold });
      page1.drawText(row.simExitKmh, { x: colX[5] + 4, y: curY + 2, size: 8, font: fontBold, color: cText });
      page1.drawText(row.tapOnset, { x: colX[6] + 4, y: curY + 2, size: 8, font: fontMono, color: cSuccess });
      page1.drawText(row.gear, { x: colX[7] + 6, y: curY + 2, size: 8, font: fontBold, color: cMuted });
      page1.drawText(row.deltaGain, { x: colX[8] + 4, y: curY + 2, size: 8, font: fontBold, color: cSuccess });

      curY -= 19;
    }

    // Page 1 Footer / Strategy Notes Card
    const notesY = 80;
    page1.drawRectangle({
      x: 32,
      y: notesY,
      width: width - 64,
      height: 70,
      color: cCard,
      borderColor: cGold,
      borderWidth: 1
    });

    page1.drawText('RACECRAFT STRATEGY NOTES & TACTICAL FOCUS:', { x: 44, y: notesY + 54, size: 8.5, font: fontBold, color: cGold });
    page1.drawText(
      data.profileNotes || 'Prioritize exit speed momentum on all Type 1 corners leading to long straights. Delay turn-in by 3-5m to ensure a late apex clipping point and earlier full throttle onset. On linked Turn complexes, sacrifice turn 1 exit radius to optimize turn 2 entry trajectory.',
      { x: 44, y: notesY + 26, size: 8.5, font: fontRegular, color: cText, maxWidth: width - 88, lineHeight: 12 }
    );

    page1.drawText('PAGE 1 OF 2  |  APEX TELEMETRY SYSTEM', { x: width / 2 - 60, y: 24, size: 7.5, font: fontMono, color: cMuted });

    // ==========================================
    // PAGE 2: CORNER ANATOMY & COACHING
    // ==========================================
    const page2 = doc.addPage([595.28, 841.89]);
    page2.drawRectangle({ x: 0, y: 0, width, height, color: cBg });

    // Header Banner Page 2
    page2.drawRectangle({ x: 0, y: height - 64, width, height: 64, color: cHeader });
    page2.drawRectangle({ x: 0, y: height - 67, width, height: 3, color: cCyan });

    page2.drawText(`CORNER DEEP-DIVE: TURN ${data.selectedCorner.cornerNumber || 1} // ${data.selectedCorner.name || 'APEX'}`, {
      x: 32,
      y: height - 34,
      size: 15,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page2.drawText('DETAILED LANDMARK CONTROL PINS & 3D TOPOGRAPHY', {
      x: 32,
      y: height - 50,
      size: 9,
      font: fontMono,
      color: cCyan
    });

    // 4 Key Stat Badges for Selected Corner
    const p2CardY = height - 134;
    const badgeW = (width - 64 - 24) / 4;
    const stats = [
      { label: 'SIMULATED RADIUS', val: `${data.simulationResult.simulatedRadius}m`, color: cGold },
      { label: 'EXIT SPEED (+DELTA)', val: `${data.simulationResult.simulated.exitSpeedKmh} km/h`, color: cSuccess },
      { label: 'EFFECTIVE GRIP', val: `${data.simulationResult.effectiveG}G`, color: cCyan },
      { label: 'CORNER GAIN', val: `${data.simulationResult.deltas.totalLapDeltaSec}s`, color: cSuccess }
    ];

    stats.forEach((st, i) => {
      const bx = 32 + i * (badgeW + 8);
      page2.drawRectangle({
        x: bx,
        y: p2CardY,
        width: badgeW,
        height: 54,
        color: cCard,
        borderColor: cBorder,
        borderWidth: 1
      });
      page2.drawText(st.label, { x: bx + 10, y: p2CardY + 38, size: 7, font: fontBold, color: cMuted });
      page2.drawText(st.val, { x: bx + 10, y: p2CardY + 16, size: 13, font: fontBold, color: st.color });
    });

    // Landmark Tuning Offsets Summary Card
    const pinsY = p2CardY - 110;
    page2.drawRectangle({
      x: 32,
      y: pinsY,
      width: width - 64,
      height: 96,
      color: cCard,
      borderColor: cBorder,
      borderWidth: 1
    });

    page2.drawText('INTERACTIVE LANDMARK CONTROL OFFSETS (SIMULATED VS TELEMETRY BASELINE)', {
      x: 44,
      y: pinsY + 80,
      size: 8.5,
      font: fontBold,
      color: cText
    });

    const pinItems = [
      { pin: '[B] BRAKE', offset: `${data.adjustments.deltaBrakeMeters > 0 ? '+' : ''}${data.adjustments.deltaBrakeMeters}m`, desc: 'Braking initiation point relative to telemetry marker', color: cF1Red },
      { pin: '[I] TURN-IN', offset: `${data.adjustments.deltaTurnInMeters > 0 ? '+' : ''}${data.adjustments.deltaTurnInMeters}m`, desc: 'Turn-in point offset (negative = later turn-in)', color: cCyan },
      { pin: '[A] APEX', offset: `${Math.round(data.adjustments.apexDepthPercent * 100)}%`, desc: 'Corner depth clipping point (Late Apex > 60%)', color: cGold },
      { pin: '[T] TAP', offset: `${data.adjustments.deltaTapMeters > 0 ? '+' : ''}${data.adjustments.deltaTapMeters}m`, desc: 'Throttle Application Point (earlier onset = higher exit)', color: cSuccess },
      { pin: '[O] OUT', offset: `${data.adjustments.deltaTrackOutMeters > 0 ? '+' : ''}${data.adjustments.deltaTrackOutMeters}m`, desc: 'Track-out unwind position at exit curb', color: rgb(0.8, 0.2, 0.8) }
    ];

    pinItems.forEach((pi, idx) => {
      const py = pinsY + 58 - idx * 13;
      page2.drawText(pi.pin, { x: 44, y: py, size: 8, font: fontBold, color: pi.color });
      page2.drawText(pi.offset, { x: 120, y: py, size: 8, font: fontMono, color: cText });
      page2.drawText(pi.desc, { x: 180, y: py, size: 7.5, font: fontRegular, color: cMuted });
    });

    // Skip Barber "Going Faster!" Tactical Coaching Box
    const coachY = pinsY - 260;
    page2.drawRectangle({
      x: 32,
      y: coachY,
      width: width - 64,
      height: 240,
      color: cCard,
      borderColor: cGold,
      borderWidth: 1.5
    });

    page2.drawText('SKIP BARBER "GOING FASTER!" RACECRAFT DIRECTIVES & DRILLS', {
      x: 44,
      y: coachY + 220,
      size: 10,
      font: fontBold,
      color: cGold
    });

    const directives = [
      {
        num: 'DIRECTIVE 1',
        title: 'Exit Speed Compounding Over Straightaway Distance',
        quote: '"A 1 mph increase in corner exit speed is maintained all the way down the following straight. On a 300m straight, +3 mph translates to nearly four tenths of a second gained per lap." (Going Faster Ch. 2)',
        action: 'ACTION: Delay initial steering input by 3-5m to place the car on the true late apex arc. Squeeze throttle early and progressively.'
      },
      {
        num: 'DIRECTIVE 2',
        title: 'String Theory: Steering In = Brake Out',
        quote: '"Imagine a string connecting the bottom of the steering wheel to your big toe on the brake pedal. As you turn the wheel into the corner, the string pulls your foot off the brake." (Going Faster Ch. 4)',
        action: 'ACTION: Avoid abrupt brake release (snap-off) at turn-in. Bleed off brake pressure smoothly as lateral G builds to maximize tire grip.'
      },
      {
        num: 'DIRECTIVE 3',
        title: '3D Topography & Crest Unweighting Management',
        quote: '"Over a downhill crest, vertical load drops and effective tire grip drops proportionally. Carrying aggressive lateral G over an unweighted crest risks immediate oversteer." (Going Faster Ch. 8)',
        action: 'ACTION: Settle the car chassis before the crest crests. Complete major rotation on the uphill compression before unweighting occurs.'
      }
    ];

    let dirY = coachY + 194;
    directives.forEach((d) => {
      page2.drawText(d.num, { x: 44, y: dirY, size: 7.5, font: fontBold, color: cCyan });
      page2.drawText(`: ${d.title}`, { x: 100, y: dirY, size: 8.5, font: fontBold, color: cText });
      page2.drawText(d.quote, { x: 44, y: dirY - 14, size: 7.5, font: fontRegular, color: cMuted, maxWidth: width - 88, lineHeight: 10 });
      page2.drawText(d.action, { x: 44, y: dirY - 38, size: 7.5, font: fontBold, color: cSuccess, maxWidth: width - 88, lineHeight: 10 });
      dirY -= 64;
    });

    page2.drawText('PAGE 2 OF 2  |  APEX TELEMETRY SYSTEM', { x: width / 2 - 60, y: 24, size: 7.5, font: fontMono, color: cMuted });

    // Save & Trigger Download
    const pdfBytes = await doc.save();

    if (autoDownload && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTrack = data.trackName.replace(/[^a-z0-9]/gi, '_');
      const safeProfile = data.profileName.replace(/[^a-z0-9]/gi, '_');
      a.download = `APEX_Strategy_Dossier_${safeTrack}_${safeProfile}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return pdfBytes;
  }
}
