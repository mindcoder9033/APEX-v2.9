/**
 * APEX Track Study 2-Page Briefing PDF Builder
 * Generates an executive 2-page Track Study & Stint Target PDF using pdf-lib.
 * Page 1: Circuit Overview, Macro Grading Breakdown, 4-Phase Strategy & Acceleration Straights.
 * Page 2: High-Density Turn-by-Turn Matrix (Corner Types, Speeds, Braking, Camber, Reference Markers).
 */

const getPdfLib = () => {
  if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
  if (typeof globalThis !== 'undefined' && globalThis.PDFLib) return globalThis.PDFLib;
  return null;
};

export class TrackStudyPdfBuilder {
  constructor() {
    this.width = 595.28;  // A4 Width
    this.height = 841.89; // A4 Height
    this.margin = 36;
  }

  /**
   * Generates a 2-page Track Study PDF
   * @param {Object} studyData - Analyzed study model from TrackStudyAnalyzer
   * @returns {Promise<Uint8Array>}
   */
  async generate(studyData) {
    if (!studyData) throw new Error('TrackStudyPdfBuilder: No studyData provided');

    const PDFLib = getPdfLib();
    if (!PDFLib) {
      throw new Error('PDFLib is not available. Please ensure pdf-lib.min.js is loaded.');
    }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    // Color Palette
    const cBg = rgb(0.96, 0.97, 0.98);
    const cCard = rgb(1, 1, 1);
    const cBorder = rgb(0.85, 0.88, 0.92);
    const cDark = rgb(0.08, 0.1, 0.13);
    const cGray = rgb(0.4, 0.45, 0.5);
    const cRed = rgb(0.88, 0.05, 0.05);
    const cCyan = rgb(0.0, 0.6, 0.8);
    const cGreen = rgb(0.0, 0.65, 0.3);
    const cYellow = rgb(0.85, 0.55, 0.0);

    // =========================================================================
    // PAGE 1: MACRO STRATEGY & 4-PHASE CIRCUIT BRIEFING
    // =========================================================================
    const page1 = pdfDoc.addPage([this.width, this.height]);
    
    // Background
    page1.drawRectangle({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      color: cBg
    });

    // Top Header Banner
    page1.drawRectangle({
      x: this.margin,
      y: this.height - 80,
      width: this.width - (this.margin * 2),
      height: 52,
      color: cDark
    });
    // Red Accent Strip
    page1.drawRectangle({
      x: this.margin,
      y: this.height - 84,
      width: this.width - (this.margin * 2),
      height: 4,
      color: cRed
    });

    page1.drawText('APEX // MOTORSPORT PIT-WALL TELEMETRY', {
      x: this.margin + 14,
      y: this.height - 48,
      size: 8,
      font: fontMono,
      color: cRed
    });

    page1.drawText('TRACK STUDY & CIRCUIT BRIEFING DOSSIER', {
      x: this.margin + 14,
      y: this.height - 66,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page1.drawText('PAGE 1 OF 2', {
      x: this.width - this.margin - 75,
      y: this.height - 54,
      size: 8,
      font: fontMono,
      color: rgb(0.7, 0.7, 0.7)
    });

    let cursorY = this.height - 100;

    // Track Meta Header Box
    page1.drawRectangle({
      x: this.margin,
      y: cursorY - 50,
      width: this.width - (this.margin * 2),
      height: 50,
      color: cCard,
      borderColor: cBorder,
      borderWidth: 1
    });

    page1.drawText((studyData.trackName || 'CIRCUIT').toUpperCase(), {
      x: this.margin + 14,
      y: cursorY - 22,
      size: 14,
      font: fontBold,
      color: cDark
    });

    page1.drawText(`Layout: ${studyData.layoutName || 'GP'}   |   Length: ${(studyData.trackLengthMeters || 0).toLocaleString()}m   |   Total Turns: ${studyData.turns?.length || 0}`, {
      x: this.margin + 14,
      y: cursorY - 40,
      size: 9,
      font: fontRegular,
      color: cGray
    });

    cursorY -= 65;

    // Section 1: Macro Corner Classification & Hierarchy
    page1.drawText('1. MACRO CORNER CLASSIFICATION & TIME HIERARCHY', {
      x: this.margin,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: cDark
    });
    cursorY -= 8;

    const boxWidth = (this.width - (this.margin * 2) - 16) / 3;
    const cardH = 68;

    // Type I Box
    page1.drawRectangle({
      x: this.margin,
      y: cursorY - cardH,
      width: boxWidth,
      height: cardH,
      color: cCard,
      borderColor: cGreen,
      borderWidth: 1.5
    });
    page1.drawText('TYPE I: EXIT PRIORITY', {
      x: this.margin + 8,
      y: cursorY - 16,
      size: 9,
      font: fontBold,
      color: cGreen
    });
    page1.drawText(`${studyData.macroSummary?.typeICount || 0} Corners`, {
      x: this.margin + 8,
      y: cursorY - 32,
      size: 13,
      font: fontBold,
      color: cDark
    });
    page1.drawText('Leads to major straights. Speed carries\ncompounding lap time advantage.', {
      x: this.margin + 8,
      y: cursorY - 46,
      size: 6.5,
      font: fontRegular,
      color: cGray,
      lineHeight: 8
    });

    // Type II Box
    page1.drawRectangle({
      x: this.margin + boxWidth + 8,
      y: cursorY - cardH,
      width: boxWidth,
      height: cardH,
      color: cCard,
      borderColor: cRed,
      borderWidth: 1.5
    });
    page1.drawText('TYPE II: ENTRY / BRAKING', {
      x: this.margin + boxWidth + 16,
      y: cursorY - 16,
      size: 9,
      font: fontBold,
      color: cRed
    });
    page1.drawText(`${studyData.macroSummary?.typeIICount || 0} Corners`, {
      x: this.margin + boxWidth + 16,
      y: cursorY - 32,
      size: 13,
      font: fontBold,
      color: cDark
    });
    page1.drawText('End of high-speed straights. Heavy\nthreshold straight deceleration.', {
      x: this.margin + boxWidth + 16,
      y: cursorY - 46,
      size: 6.5,
      font: fontRegular,
      color: cGray,
      lineHeight: 8
    });

    // Type III Box
    page1.drawRectangle({
      x: this.margin + (boxWidth * 2) + 16,
      y: cursorY - cardH,
      width: boxWidth,
      height: cardH,
      color: cCard,
      borderColor: cYellow,
      borderWidth: 1.5
    });
    page1.drawText('TYPE III: COMPROMISE', {
      x: this.margin + (boxWidth * 2) + 24,
      y: cursorY - 16,
      size: 9,
      font: fontBold,
      color: cYellow
    });
    page1.drawText(`${studyData.macroSummary?.typeIIICount || 0} Corners`, {
      x: this.margin + (boxWidth * 2) + 24,
      y: cursorY - 32,
      size: 13,
      font: fontBold,
      color: cDark
    });
    page1.drawText('Connected esses / chicanes. Sacrifice\ninitial apex to set up exit radius.', {
      x: this.margin + (boxWidth * 2) + 24,
      y: cursorY - 46,
      size: 6.5,
      font: fontRegular,
      color: cGray,
      lineHeight: 8
    });

    cursorY -= (cardH + 20);

    // Section 2: Going Faster 4-Phase System Principles
    page1.drawText('2. THE 4-PHASE CIRCUIT STUDY METHODOLOGY (SKIP BARBER RACING)', {
      x: this.margin,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: cDark
    });
    cursorY -= 8;

    const phases = [
      {
        tag: 'PHASE 1: MACRO GRADING',
        body: 'Divide the track into Acceleration vs Braking zones. 70-80% of a lap is acceleration; exit speed from corners preceding long straights yields the highest lap-time dividend.'
      },
      {
        tag: 'PHASE 2: MICRO-SCOUTING & SURFACE',
        body: 'Scout banking/camber changes, elevation compression, and asphalt/concrete transitions. Camber can add over 10% cornering grip; off-camber requires tighter entry speed control.'
      },
      {
        tag: 'PHASE 3: REFERENCE POINTS & SIGHT PICTURES',
        body: 'Lock in rigid physical cues for Braking, Turn-In, Apex, and Track-Out. Over time, synthesize these into an intuitive "Sight Picture" to detect line errors early.'
      },
      {
        tag: 'PHASE 4: TELEMETRY TARGET & PROGRESSION',
        body: 'Build pace progressively in 3 steps: 1) Geometric Line Precision -> 2) Throttle Exit Speed & Steering Unwind -> 3) Threshold Braking Depth in 3-foot nibbles.'
      }
    ];

    phases.forEach(p => {
      const pH = 44;
      page1.drawRectangle({
        x: this.margin,
        y: cursorY - pH,
        width: this.width - (this.margin * 2),
        height: pH,
        color: cCard,
        borderColor: cBorder,
        borderWidth: 1
      });

      page1.drawText(p.tag, {
        x: this.margin + 10,
        y: cursorY - 14,
        size: 8,
        font: fontBold,
        color: cCyan
      });

      page1.drawText(p.body, {
        x: this.margin + 10,
        y: cursorY - 26,
        size: 7.5,
        font: fontRegular,
        color: cDark,
        lineHeight: 9
      });

      cursorY -= (pH + 6);
    });

    cursorY -= 10;

    // Section 3: Strategic Stint Rules
    page1.drawText('3. CRITICAL PRE-STINT EXECUTION RULES', {
      x: this.margin,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: cDark
    });
    cursorY -= 8;

    page1.drawRectangle({
      x: this.margin,
      y: cursorY - 70,
      width: this.width - (this.margin * 2),
      height: 70,
      color: rgb(0.92, 0.95, 0.98),
      borderColor: cCyan,
      borderWidth: 1
    });

    const stintRules = [
      '• Order of Effort: Line placement first, corner exit speed second, threshold braking last.',
      '• Early Apex Prevention: If you must steer more past apex, you turned in too early. Correct by turning later next lap.',
      '• Steering Unwind: The earlier you unwind steering lock, the less tire scrub drag resists your straight acceleration.',
      '• "The Procedure" for Braking: Establish threshold brake pressure first, then move the brake point in 1-meter increments.'
    ];

    stintRules.forEach((rule, idx) => {
      page1.drawText(rule, {
        x: this.margin + 10,
        y: cursorY - 16 - (idx * 13),
        size: 7.5,
        font: fontRegular,
        color: cDark
      });
    });

    // =========================================================================
    // PAGE 2: TURN-BY-TURN STUDY MATRIX & REFERENCE MARKERS
    // =========================================================================
    const page2 = pdfDoc.addPage([this.width, this.height]);
    
    page2.drawRectangle({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      color: cBg
    });

    // Page 2 Header Banner
    page2.drawRectangle({
      x: this.margin,
      y: this.height - 65,
      width: this.width - (this.margin * 2),
      height: 40,
      color: cDark
    });
    page2.drawRectangle({
      x: this.margin,
      y: this.height - 68,
      width: this.width - (this.margin * 2),
      height: 3,
      color: cRed
    });

    page2.drawText(`${(studyData.trackName || 'CIRCUIT').toUpperCase()} — TURN-BY-TURN STUDY MATRIX`, {
      x: this.margin + 12,
      y: this.height - 48,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    page2.drawText('PAGE 2 OF 2: REFERENCE MARKERS & TELEMETRY TARGETS', {
      x: this.width - this.margin - 220,
      y: this.height - 48,
      size: 7.5,
      font: fontMono,
      color: rgb(0.7, 0.7, 0.7)
    });

    let tableY = this.height - 85;

    // Table Header Row
    page2.drawRectangle({
      x: this.margin,
      y: tableY - 18,
      width: this.width - (this.margin * 2),
      height: 18,
      color: cDark
    });

    page2.drawText('TURN', { x: this.margin + 4, y: tableY - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
    page2.drawText('TYPE', { x: this.margin + 40, y: tableY - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
    page2.drawText('TARGET / GEAR', { x: this.margin + 90, y: tableY - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
    page2.drawText('BRAKING & TRAIL', { x: this.margin + 165, y: tableY - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
    page2.drawText('SURFACE / CAMBER', { x: this.margin + 250, y: tableY - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });
    page2.drawText('VISUAL REFERENCE & SIGHT PICTURE', { x: this.margin + 360, y: tableY - 12, size: 7, font: fontBold, color: rgb(1, 1, 1) });

    tableY -= 18;

    const turns = studyData.turns || [];
    const maxRows = Math.min(turns.length, 16);
    const rowH = Math.max(34, Math.floor((tableY - this.margin - 20) / maxRows));

    turns.slice(0, maxRows).forEach((t, i) => {
      const isAlt = i % 2 === 1;
      page2.drawRectangle({
        x: this.margin,
        y: tableY - rowH,
        width: this.width - (this.margin * 2),
        height: rowH,
        color: isAlt ? rgb(0.93, 0.94, 0.96) : cCard,
        borderColor: cBorder,
        borderWidth: 0.5
      });

      // Type Color Tag
      const typeColor = t.cornerType === 'Type I' ? cGreen : (t.cornerType === 'Type II' ? cRed : cYellow);
      page2.drawRectangle({
        x: this.margin,
        y: tableY - rowH,
        width: 3,
        height: rowH,
        color: typeColor
      });

      // Turn Num
      page2.drawText(`T${t.turnNumber}`, {
        x: this.margin + 6,
        y: tableY - 14,
        size: 9,
        font: fontBold,
        color: cDark
      });

      // Type Tag
      page2.drawText(t.cornerType, {
        x: this.margin + 40,
        y: tableY - 14,
        size: 7.5,
        font: fontBold,
        color: typeColor
      });
      page2.drawText(t.typeLabel.split(' ')[0], {
        x: this.margin + 40,
        y: tableY - 24,
        size: 6,
        font: fontRegular,
        color: cGray
      });

      // Speed / Gear (Metric: km/h)
      const speedVal = t.targets?.minApexSpeedKmh || (t.targets?.minApexSpeedMph ? Math.round(t.targets.minApexSpeedMph * 1.60934) : 100);
      page2.drawText(`${speedVal} km/h`, {
        x: this.margin + 90,
        y: tableY - 14,
        size: 8,
        font: fontBold,
        color: cDark
      });
      page2.drawText(`Gear: G${t.targets?.targetGear || 3}`, {
        x: this.margin + 90,
        y: tableY - 24,
        size: 6.5,
        font: fontMono,
        color: cGray
      });

      // Braking & Trail
      page2.drawText(`${t.targets?.suggestedBrakePressurePct || 80}% Threshold`, {
        x: this.margin + 165,
        y: tableY - 14,
        size: 7.5,
        font: fontRegular,
        color: cDark
      });
      page2.drawText(`Trail: ${t.targets?.trailBrakeDepthPct || 30}% depth`, {
        x: this.margin + 165,
        y: tableY - 24,
        size: 6.5,
        font: fontRegular,
        color: cGray
      });

      // Surface & Camber
      page2.drawText(t.microFeatures?.camber || 'Neutral', {
        x: this.margin + 250,
        y: tableY - 14,
        size: 7.5,
        font: fontRegular,
        color: cDark
      });
      page2.drawText(t.microFeatures?.surfaceType || 'Asphalt', {
        x: this.margin + 250,
        y: tableY - 24,
        size: 6.5,
        font: fontRegular,
        color: cGray
      });

      // Reference Markers / Sight Picture
      const refText = t.driverNotes || 
        `Brake: ${t.referenceMarkers?.braking || '100m'} | In: ${t.referenceMarkers?.turnIn || 'Curb'} | Apex: ${t.referenceMarkers?.apex || 'Clip'}`;
      
      const cleanRef = refText.length > 55 ? refText.substring(0, 52) + '...' : refText;
      page2.drawText(cleanRef, {
        x: this.margin + 360,
        y: tableY - 14,
        size: 6.5,
        font: fontRegular,
        color: cDark
      });

      page2.drawText(`Throttle: ${t.targets?.throttlePickUpPoint || 'At Apex'}`, {
        x: this.margin + 360,
        y: tableY - 24,
        size: 6,
        font: fontRegular,
        color: cCyan
      });

      tableY -= rowH;
    });

    return await pdfDoc.save();
  }
}

export const trackStudyPdfBuilder = new TrackStudyPdfBuilder();
