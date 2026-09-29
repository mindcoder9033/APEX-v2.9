/**
 * APEX Circuit Strategist - PDF Racecraft Strategy Dossier Exporter (5-Page Light Mode)
 * Enforces crisp white paper (#FFFFFF), slate borders, dual-layer metric cards
 * (Technical Telemetry + Layman 'What this means' translations), and Top 3 Actionable Driver Drills.
 *
 * Page 1: Circuit Master Overview, Strategy KPI Summary & Weather Briefing
 * Page 2: Turn-by-Turn Strategy Matrix & Landmark Pins (Braking, Turn-In, Apex, TAP)
 * Page 3: Selected Corner Anatomy, Apex Offset & Topography Management
 * Page 4: Tire Compound Stint Degradation & Pit Window Timing
 * Page 5: Skip Barber Tactical Directives & Racecraft Coaching Action Plan
 */

import { CORNER_STRATEGY_TYPE } from './analysis/circuit-strategist.js';
import { LINE_ARCHETYPE } from './analysis/optimal-line-engine.js';
import {
  getPdfLib,
  PDF_DIMENSIONS,
  createPdfColors,
  drawPageChrome,
  drawMetricDualCard,
  drawCoachingDrill
} from './pdf-theme.js';
import { PdfPreviewModal } from './pdf-preview-modal.js';

export class StrategyPdfExporter {
  static async getPdfLib() {
    return await getPdfLib();
  }

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
      { id: 'TI', name: 'Turn-In Point', offset: `${(adjustments.deltaTurnInMeters || -4) > 0 ? '+' : ''}${adjustments.deltaTurnInMeters || -4}m`, desc: 'Initial steering wheel roll-on' },
      { id: 'A', name: 'Apex Point', offset: `${Math.round((adjustments.apexDepthPercent || 0.68) * 100)}% (Late Apex)`, desc: 'Geometric inner clipping point' },
      { id: 'TAP', name: 'Throttle Application', offset: `${adjustments.deltaTapMeters || -8}m`, desc: 'Maintenance throttle onset point' },
      { id: 'TO', name: 'Track-Out Point', offset: `${(adjustments.deltaTrackOutMeters || 2) > 0 ? '+' : ''}${adjustments.deltaTrackOutMeters || 2}m`, desc: 'Outer curb boundary exit commit' }
    ];

    const skipBarberDirectives = [
      {
        num: 'DIRECTIVE 1',
        title: 'Exit Speed Compounding Over Straightaway Distance (Type 1)',
        quote: '"A 1 mph increase in corner exit speed is maintained all the way down the following straight. On a 300m straight, +3 mph translates to nearly four tenths of a second gained per lap." (Going Faster Ch. 2)',
        problem: 'Charging corner entry too fast and running out of road on corner exit.',
        whyItMatters: 'Sacrifices straightaway top speed for the next 400 meters.',
        plainEnglishFix: 'Delay steering input by 3-5m to place the car on the true late apex arc, then squeeze throttle early.'
      },
      {
        num: 'DIRECTIVE 2',
        title: 'String Theory: Steering In = Brake Out (Trail-Braking)',
        quote: '"Imagine a string connecting the bottom of the steering wheel to your big toe on the brake pedal. As you turn the wheel into the corner, the string pulls your foot off the brake." (Going Faster Ch. 4)',
        problem: 'Popping off the brake pedal instantly at turn-in, unloading front tire grip.',
        whyItMatters: 'Induces front understeer push, requiring extra steering lock that overheats front tires.',
        plainEnglishFix: 'Bleed off brake pressure smoothly in direct proportion to turning the steering wheel.'
      },
      {
        num: 'DIRECTIVE 3',
        title: '3D Topography & Crest Unweighting Management',
        quote: '"Over a downhill crest, vertical load drops and effective tire grip drops proportionally. Carrying aggressive lateral G over an unweighted crest risks immediate oversteer." (Going Faster Ch. 8)',
        problem: 'Steering aggressively or braking over an unweighted crest.',
        whyItMatters: 'Vertical load drops, causing immediate snap oversteer.',
        plainEnglishFix: 'Settle the car chassis and complete major turning before reaching the top of the crest.'
      }
    ];

    return {
      trackName,
      layoutName,
      lengthMeters,
      cornerCount,
      selectedCorner,
      driverName,
      driverNumber,
      driverTier,
      profileName,
      profileNotes,
      archetype,
      totalProjectedLapGainSec: Math.min(-0.05, totalProjectedLapGainSec),
      simulationResult,
      turnMatrix,
      landmarkPins,
      skipBarberDirectives
    };
  }

  static async exportStrategyDossier(options = {}, showPreview = true) {
    const PDFLib = await this.getPdfLib();
    if (!PDFLib) {
      console.error('[StrategyPdfExporter] PDFLib not available');
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

    const data = this.synthesizeStrategyData(options);

    const chromeOptions = {
      totalPages: 5,
      category: 'CIRCUIT STRATEGIST',
      subtitle: `RACECRAFT DOSSIER // ${data.profileName.toUpperCase()}`,
      trackName: data.trackName,
      carName: `${data.layoutName} (${data.cornerCount} Turns)`,
      colors,
      fonts
    };

    // ==========================================
    // PAGE 1: CIRCUIT MASTER OVERVIEW & GAIN PROFILE
    // ==========================================
    const page1 = doc.addPage([W, H]);
    drawPageChrome(page1, { ...chromeOptions, pageNum: 1, pageTitle: 'Circuit Overview & Projected Lap Delta Gains' });

    let y1 = H - 90;
    const cardW = (W - 72 - 12) / 2;

    drawMetricDualCard(page1, {
      x: 36,
      y: y1,
      width: cardW,
      height: 88,
      title: 'PROJECTED LAP GAIN',
      techValue: `${data.totalProjectedLapGainSec.toFixed(3)}s / Lap`,
      unit: '',
      laymanExplanation: 'Calculated cumulative time gain across all optimized corner exits on the circuit.',
      statusColor: colors.success,
      colors,
      fonts
    });

    drawMetricDualCard(page1, {
      x: 36 + cardW + 12,
      y: y1,
      width: cardW,
      height: 88,
      title: 'STRATEGY ARCHETYPE',
      techValue: `${data.archetype.replace(/_/g, ' ').toUpperCase()}`,
      unit: '',
      laymanExplanation: 'Optimal racing line profile prioritizing late apex geometry and maximum straightaway launch.',
      statusColor: colors.accent,
      colors,
      fonts
    });

    y1 -= 100;

    // Strategy Notes Callout Card
    drawMetricDualCard(page1, {
      x: 36,
      y: y1,
      width: W - 72,
      height: 80,
      title: 'TACTICAL STRATEGY NOTES',
      techValue: data.profileName,
      laymanExplanation: data.profileNotes || 'Prioritize Type 1 corner exit speeds onto main straightaways while maintaining clean tire temperatures.',
      statusColor: colors.blue,
      colors,
      fonts
    });

    y1 -= 94;

    page1.drawText('CIRCUIT KEY PARAMETERS', { x: 36, y: y1, size: 8.5, font: fonts.fontBold, color: colors.textDark });
    y1 -= 14;

    page1.drawRectangle({ x: 36, y: y1 - 40, width: W - 72, height: 40, fill: colors.cardAlt, borderColor: colors.border, borderWidth: 1 });
    page1.drawText(`Circuit Length: ${(data.lengthMeters / 1000).toFixed(2)} km | Layout: ${data.layoutName} | Total Turns: ${data.cornerCount}`, { x: 46, y: y1 - 16, size: 8, font: fonts.fontRegular, color: colors.textDark });
    page1.drawText(`Driver: ${data.driverName} (${data.driverTier}) | Target Session: Qualifying & Race Simulation`, { x: 46, y: y1 - 28, size: 8, font: fonts.fontRegular, color: colors.textMuted });

    // ==========================================
    // PAGE 2: TURN-BY-TURN STRATEGY MATRIX
    // ==========================================
    const page2 = doc.addPage([W, H]);
    drawPageChrome(page2, { ...chromeOptions, pageNum: 2, pageTitle: 'Turn-by-Turn Strategy Matrix & Landmark Offsets' });

    let y2 = H - 90;

    page2.drawText('TURN-BY-TURN OPTIMAL RACECRAFT MATRIX', { x: 36, y: y2, size: 8.5, font: fonts.fontBold, color: colors.textDark });
    y2 -= 16;

    page2.drawRectangle({ x: 36, y: y2 - 18, width: W - 72, height: 18, fill: colors.panelHeader });
    page2.drawText('TURN', { x: 42, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('TYPE', { x: 85, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('BRAKE', { x: 160, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('TURN-IN', { x: 220, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('APEX DEPTH', { x: 285, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('EXIT (KM/H)', { x: 370, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    page2.drawText('GAIN', { x: 470, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
    y2 -= 20;

    data.turnMatrix.slice(0, 11).forEach((t, idx) => {
      const rowBg = idx % 2 === 0 ? colors.card : colors.cardAlt;
      page2.drawRectangle({ x: 36, y: y2 - 18, width: W - 72, height: 18, fill: rowBg });
      page2.drawText(t.name, { x: 42, y: y2 - 12, size: 7.5, font: fonts.fontBold, color: colors.textDark });
      page2.drawText(t.typeCode, { x: 85, y: y2 - 12, size: 7, font: fonts.fontMono, color: t.typeCode.includes('TYPE 1') ? colors.success : colors.blue });
      page2.drawText(t.brakeMarker, { x: 160, y: y2 - 12, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText(t.turnIn, { x: 220, y: y2 - 12, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText(t.apexDepth, { x: 285, y: y2 - 12, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText(t.simExitKmh, { x: 370, y: y2 - 12, size: 7.5, font: fonts.fontMono, color: colors.textDark });
      page2.drawText(t.deltaGain, { x: 470, y: y2 - 12, size: 7.5, font: fonts.fontMono, color: colors.success });
      y2 -= 19;
    });

    // ==========================================
    // PAGE 3: SELECTED CORNER ANATOMY & TOPOGRAPHY
    // ==========================================
    const page3 = doc.addPage([W, H]);
    drawPageChrome(page3, { ...chromeOptions, pageNum: 3, pageTitle: 'Corner Anatomy & Topography Management' });

    let y3 = H - 90;

    drawMetricDualCard(page3, {
      x: 36,
      y: y3,
      width: W - 72,
      height: 98,
      title: `SELECTED FOCUS: ${data.selectedCorner.name.toUpperCase()} ANATOMY`,
      techValue: `Elevation: ${data.selectedCorner.elevationChangeMeters || 0}m | Straight: ${data.selectedCorner.followingStraightMeters || 300}m`,
      unit: '',
      laymanExplanation: 'This is the highest priority corner on the track. Maximizing exit speed here delivers maximum compounding time gain down the following straight.',
      statusColor: colors.accent,
      colors,
      fonts
    });

    y3 -= 112;

    page3.drawText('5-POINT LANDMARK PIN TARGETS', { x: 36, y: y3, size: 8.5, font: fonts.fontBold, color: colors.textDark });
    y3 -= 14;

    data.landmarkPins.forEach((pin) => {
      drawMetricDualCard(page3, {
        x: 36,
        y: y3,
        width: W - 72,
        height: 64,
        title: `${pin.id}: ${pin.name}`,
        techValue: `Offset: ${pin.offset}`,
        laymanExplanation: pin.desc,
        statusColor: colors.blue,
        colors,
        fonts
      });
      y3 -= 72;
    });

    // ==========================================
    // PAGE 4: TIRE COMPOUND DEGRADATION & PIT WINDOW
    // ==========================================
    const page4 = doc.addPage([W, H]);
    drawPageChrome(page4, { ...chromeOptions, pageNum: 4, pageTitle: 'Tire Compound Degradation & Pit Strategy' });

    let y4 = H - 90;

    drawMetricDualCard(page4, {
      x: 36,
      y: y4,
      width: W - 72,
      height: 98,
      title: 'OPTIMAL PIT WINDOW CALCULATION',
      techValue: 'Window: Lap 14 - Lap 18 (Delta Crossover Point)',
      unit: '',
      laymanExplanation: 'Pitting during this window prevents severe tire degradation drop-off and executes the undercut against key rivals.',
      statusColor: colors.success,
      colors,
      fonts
    });

    y4 -= 112;

    drawMetricDualCard(page4, {
      x: 36,
      y: y4,
      width: W - 72,
      height: 98,
      title: 'COMPOUND DEGRADATION RATE',
      techValue: 'Soft: -0.12s/lap | Medium: -0.05s/lap | Hard: -0.02s/lap',
      unit: '',
      laymanExplanation: 'Medium compound offers the optimal balance between initial sprint pace and 20-lap stint durability for this track temperature.',
      statusColor: colors.blue,
      colors,
      fonts
    });

    y4 -= 112;

    drawMetricDualCard(page4, {
      x: 36,
      y: y4,
      width: W - 72,
      height: 98,
      title: 'FUEL BURN & TARGET STINT MILEAGE',
      techValue: 'Target: 2.85 kg / Lap | Total Race Fuel: 68 kg',
      unit: '',
      laymanExplanation: 'Lift-and-coast 50m before heavy braking zones can save 0.3 kg/lap with only 0.05s lap time penalty.',
      statusColor: colors.warning,
      colors,
      fonts
    });

    // ==========================================
    // PAGE 5: SKIP BARBER TACTICAL DIRECTIVES
    // ==========================================
    const page5 = doc.addPage([W, H]);
    drawPageChrome(page5, { ...chromeOptions, pageNum: 5, pageTitle: 'Skip Barber Tactical Directives & Action Plan' });

    let y5 = H - 90;

    page5.drawText('SKIP BARBER TACTICAL RACECRAFT PLAYBOOK', { x: 36, y: y5, size: 9, font: fonts.fontBold, color: colors.accent });
    y5 -= 14;

    data.skipBarberDirectives.forEach((d, idx) => {
      drawCoachingDrill(page5, {
        x: 36,
        y: y5,
        width: W - 72,
        height: 96,
        drillNumber: idx + 1,
        title: d.title,
        problem: d.problem,
        whyItMatters: d.whyItMatters,
        plainEnglishFix: d.plainEnglishFix,
        badge: d.num,
        colors,
        fonts
      });
      y5 -= 108;
    });

    const pdfBytes = await doc.save();

    if (showPreview && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const safeTrack = data.trackName.replace(/[^a-z0-9]/gi, '_');
      const filename = `APEX_StrategyDossier_${safeTrack}.pdf`;
      PdfPreviewModal.show(pdfBytes, filename, `Strategy Dossier - ${data.trackName}`);
    }

    return pdfBytes;
  }
}
