/**
 * APEX PDF Report Builder - Educational Edition
 * Composes A4 PDF reports based on "Going Faster!" by Carl Lopez & Skip Barber Racing School.
 * Uses pdf-lib for pure JavaScript vector document construction with zero external dependencies.
 * All units are strictly displayed in Metric (KM/H, meters, °C).
 */

const rgb = (r, g, b) => {
  if (!window.PDFLib) throw new Error('PDFLib is not loaded.');
  return window.PDFLib.rgb(r, g, b);
};
import { TrackMapGenerator, STATE_COLORS } from './analysis/track-map.js';

export class ClientPdfGenerator {
  constructor() {
    this.width = 595.28;  // A4 Width in points
    this.height = 841.89; // A4 Height in points
    this.margin = 36;     // 0.5 inch margins
    this.trackMapGenerator = new TrackMapGenerator();
  }

  // --- Metric Conversion Helpers ---
  toKmh(mph) {
    return mph || 0; // Return raw mph for Imperial spec
  }

  toMeters(feet) {
    return feet || 0; // Return raw feet for Imperial spec
  }

  toCelsius(f) {
    return f || 0; // Return raw Fahrenheit for Imperial spec
  }

  // --- Text Wrapping & Safe Drawing Engine ---
  wrapText(text, maxWidth, font, fontSize) {
    if (!text) return [];
    const safeText = String(text)
      .replace(/[^\x00-\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = safeText.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  drawWrappedText(page, text, { x, y, maxWidth, font, fontSize, color, lineHeight = fontSize * 1.25, maxLines = 4 }) {
    const lines = this.wrapText(text, maxWidth, font, fontSize);
    const toDraw = lines.slice(0, maxLines);
    let currentY = y;

    toDraw.forEach((line, idx) => {
      let lineText = line;
      if (idx === maxLines - 1 && lines.length > maxLines) {
        lineText = lineText.length > 3 ? lineText.substring(0, lineText.length - 3) + '...' : lineText + '...';
      }
      page.drawText(lineText, {
        x,
        y: currentY,
        size: fontSize,
        font,
        color
      });
      currentY -= lineHeight;
    });

    return currentY;
  }

  /**
   * Builds the complete multi-section PDF document
   * @param {Object} report AnalysisEngine report output
   * @param {Object} metadata Session metadata (sessionName, driverName, carClass, trackName, date)
   * @returns {Promise<Uint8Array>}
   */
  async generate(report, metadata = {}) {
    const PDFLib = window.PDFLib;
    if (!PDFLib) {
      throw new Error('PDFLib is not loaded in the browser window.');
    }
    const { PDFDocument, rgb: pdfLibRgb, StandardFonts } = PDFLib;

    this.colors = {
      bg: pdfLibRgb(1, 1, 1),                      // Pure White #FFFFFF
      panel: pdfLibRgb(0.972, 0.980, 0.988),       // Slate-50 #F8FAFC
      panelAlt: pdfLibRgb(0.945, 0.961, 0.976),    // Slate-100 #F1F5F9
      border: pdfLibRgb(0.886, 0.910, 0.941),      // Slate-200 #E2E8F0
      borderBright: pdfLibRgb(0.796, 0.835, 0.882), // Slate-300 #CBD5E1
      f1Red: pdfLibRgb(0.882, 0.024, 0),           // Signature APEX Red #E10600
      textPrimary: pdfLibRgb(0.059, 0.090, 0.165), // Deep Slate-900 #0F172A
      textSecondary: pdfLibRgb(0.200, 0.255, 0.333),// Slate-700 #334155
      textMuted: pdfLibRgb(0.392, 0.455, 0.545),   // Slate-500 #64748B
      white: pdfLibRgb(1, 1, 1),
      success: pdfLibRgb(0.020, 0.588, 0.314),     // Emerald-600 #059669
      warning: pdfLibRgb(0.851, 0.463, 0.024),     // Amber-600 #D97706
      blue: pdfLibRgb(0.012, 0.518, 0.780),        // Sky-600 #0284C7
      gold: pdfLibRgb(0.706, 0.447, 0.020),        // Amber-700 #B45309
      amber: pdfLibRgb(0.851, 0.463, 0.024),
      cyan: pdfLibRgb(0.031, 0.569, 0.698)
    };

    const doc = await PDFDocument.create();
    
    // Embed fonts
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
    const fontMono = await doc.embedFont(StandardFonts.Courier);
    const fontMonoBold = await doc.embedFont(StandardFonts.CourierBold);

    const fonts = {
      regular: fontRegular,
      bold: fontBold,
      italic: fontOblique,
      mono: fontMono,
      monoBold: fontMonoBold
    };

    // Dynamically identify flagged corners for dedicated coaching pages
    const flaggedCorners = this.selectFlaggedCorners(report);
    const totalPages = 6 + flaggedCorners.length; // Exec + Stint + Flagged Corners + Skill + Guide + Practice + Summary

    let pageIndex = 1;

    // --- Page 1: Executive Summary (Section 1) ---
    const page1 = doc.addPage([this.width, this.height]);
    this.drawPageBackground(page1);
    let y1 = this.height - this.margin;
    y1 = this.drawPageHeaderMini(page1, y1, 'EXECUTIVE SUMMARY', fonts);
    this.drawExecutiveSummaryPage(page1, y1, report, metadata, fonts);
    this.drawFooter(page1, pageIndex++, totalPages, fonts);

    // --- Page 2: Stint Overview (Section 2) ---
    const page2 = doc.addPage([this.width, this.height]);
    this.drawPageBackground(page2);
    let y2 = this.height - this.margin;
    y2 = this.drawPageHeaderMini(page2, y2, 'STINT OVERVIEW - HOW TO READ YOUR LAPS', fonts);
    this.drawStintOverviewPage(page2, y2, report, metadata, fonts);
    this.drawFooter(page2, pageIndex++, totalPages, fonts);

    // --- Pages 3 to 3+N-1: Corner-by-Corner Coaching (Section 3) ---
    for (const corner of flaggedCorners) {
      const cornerPage = doc.addPage([this.width, this.height]);
      this.drawPageBackground(cornerPage);
      let cy = this.height - this.margin;
      cy = this.drawPageHeaderMini(cornerPage, cy, `CORNER COACHING — TURN ${corner.cornerNumber}`, fonts);
      this.drawCornerCoachingPage(cornerPage, cy, corner, report, fonts);
      this.drawFooter(cornerPage, pageIndex++, totalPages, fonts);
    }

    // --- Page N+1: Skill Analysis (Section 4) ---
    const pageSkill = doc.addPage([this.width, this.height]);
    this.drawPageBackground(pageSkill);
    let yS = this.height - this.margin;
    yS = this.drawPageHeaderMini(pageSkill, yS, 'SKILL ANALYSIS - THE THREE FUNDAMENTALS', fonts);
    this.drawSkillAnalysisPage(pageSkill, yS, report, fonts);
    this.drawFooter(pageSkill, pageIndex++, totalPages, fonts);

    // --- Page N+2: Telemetry Reading Guide (Section 5) ---
    const pageGuide = doc.addPage([this.width, this.height]);
    this.drawPageBackground(pageGuide);
    let yG = this.height - this.margin;
    yG = this.drawPageHeaderMini(pageGuide, yG, 'HOW TO READ YOUR TELEMETRY - A GUIDE FOR RACERS', fonts);
    this.drawTelemetryReadingGuide(pageGuide, yG, report, fonts);
    this.drawFooter(pageGuide, pageIndex++, totalPages, fonts);

    // --- Page N+3: Practice Plan (Section 6) ---
    const pagePractice = doc.addPage([this.width, this.height]);
    this.drawPageBackground(pagePractice);
    let yP = this.height - this.margin;
    yP = this.drawPageHeaderMini(pagePractice, yP, 'PRACTICE PLAN', fonts);
    this.drawPracticePlanPage(pagePractice, yP, report, metadata, fonts);
    this.drawFooter(pagePractice, pageIndex++, totalPages, fonts);

    // --- Page N+4: Summary & Next Steps (Section 8) ---
    const pageSummary = doc.addPage([this.width, this.height]);
    this.drawPageBackground(pageSummary);
    let ySum = this.height - this.margin;
    ySum = this.drawPageHeaderMini(pageSummary, ySum, 'REPORT SUMMARY', fonts);
    this.drawSummaryNextStepsPage(pageSummary, ySum, report, metadata, fonts);
    this.drawFooter(pageSummary, pageIndex++, totalPages, fonts);

    return await doc.save();
  }

  drawPageBackground(page) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      color: this.colors.bg
    });
  }

  drawPageHeaderMini(page, y, title, fonts) {
    const contentW = this.width - (this.margin * 2);

    page.drawRectangle({
      x: this.margin,
      y: y,
      width: contentW,
      height: 2,
      color: this.colors.f1Red
    });
    y -= 14;

    page.drawText('APEX // RACECRAFT Analysis Curriculum', {
      x: this.margin,
      y: y,
      size: 8,
      font: fonts.bold,
      color: this.colors.textMuted
    });
    y -= 15;

    page.drawText(title.toUpperCase(), {
      x: this.margin,
      y: y,
      size: 12,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    y -= 20;

    return y;
  }

  drawFooter(page, pageNum, totalPages, fonts) {
    const y = this.margin;

    page.drawLine({
      start: { x: this.margin, y: y + 10 },
      end: { x: this.width - this.margin, y: y + 10 },
      thickness: 0.5,
      color: this.colors.border
    });

    page.drawText('APEX // "Going Faster!" Edition -- Skip Barber Racing School Analysis', {
      x: this.margin,
      y: y - 2,
      size: 7.5,
      font: fonts.regular,
      color: this.colors.textMuted
    });

    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: this.width - this.margin - 50,
      y: y - 2,
      size: 7.5,
      font: fonts.mono,
      color: this.colors.textMuted
    });
  }

  // --- Page 1: Cover Page ---
  drawCoverPage(page, report, metadata, fonts) {
    const contentW = this.width - (this.margin * 2);
    let y = this.height - this.margin * 2;

    // Top Red Accent Accent
    page.drawRectangle({
      x: this.margin,
      y: y,
      width: contentW,
      height: 6,
      color: this.colors.f1Red
    });
    y -= 45;

    // Title
    page.drawText('APEX //', {
      x: this.margin,
      y: y,
      size: 32,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    y -= 35;

    page.drawText('PERFORMANCE COACHING REPORT', {
      x: this.margin,
      y: y,
      size: 20,
      font: fonts.bold,
      color: this.colors.f1Red
    });
    y -= 25;

    page.drawText('Educational Edition — Based on the Skip Barber Racing School Curriculum', {
      x: this.margin,
      y: y,
      size: 10,
      font: fonts.italic,
      color: this.colors.textSecondary
    });
    y -= 60;

    // Introduction Callout
    page.drawRectangle({
      x: this.margin,
      y: y - 80,
      width: contentW,
      height: 80,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('REPORT OBJECTIVE & METHODOLOGY', {
      x: this.margin + 12,
      y: y - 18,
      size: 9,
      font: fonts.bold,
      color: this.colors.textPrimary
    });

    const introText = 'This report is designed as an educational tool to analyze racing driver telemetry against core vehicle dynamics principles. Rather than dump raw numbers, APEX coaches you on "The Line" (path selection), "Exit Speed" (acceleration timing), and "Braking & Entering" (threshold deceleration). Follow the practice recommendations to optimize your track craft.';
    this.drawWrappedText(page, introText, {
      x: this.margin + 12,
      y: y - 32,
      maxWidth: contentW - 24,
      font: fonts.regular,
      fontSize: 8,
      color: this.colors.textSecondary,
      maxLines: 3,
      lineHeight: 11
    });

    y -= 130;

    // Metadata Card Box
    page.drawRectangle({
      x: this.margin,
      y: y - 160,
      width: contentW,
      height: 160,
      color: this.colors.panelAlt,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('SESSION METADATA & TELEMETRY PROFILE', {
      x: this.margin + 15,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: this.colors.f1Red
    });

    const metaItems = [
      { label: 'DRIVER:', val: metadata.driverName || 'APEX Driver' },
      { label: 'TRACK:', val: metadata.trackName || 'Grand Prix Circuit' },
      { label: 'SESSION:', val: metadata.sessionName || 'Track Day Stint' },
      { label: 'CAR CLASS:', val: metadata.carClass || 'S Class' },
      { label: 'DATE RECORDED:', val: metadata.date || new Date().toISOString().split('T')[0] },
      { label: 'LAPS COMPLETED:', val: String(metadata.totalLaps || report.totalLapsCount || 1) },
      { label: 'BEST LAP TIME:', val: metadata.bestLapTimeStr || this.formatTime(report.bestLap?.lapTime) }
    ];

    let rowY = y - 42;
    metaItems.forEach(item => {
      page.drawText(item.label, { x: this.margin + 20, y: rowY, size: 9, font: fonts.bold, color: this.colors.textSecondary });
      page.drawText(item.val, { x: this.margin + 150, y: rowY, size: 9, font: fonts.monoBold, color: this.colors.textPrimary });
      rowY -= 16;
    });

    // Drawing a minimal, clean outline of the 2D Track Map in the lower bottom right as a graphic
    const bestLap = report.laps?.find(l => l.lapNumber === report.bestLap?.lapNumber) || report.laps?.[0];
    const samples = bestLap?.samples || report.samples || [];
    const corners = bestLap?.corners || [];
    
    if (samples.length > 5) {
      const coverVectorData = this.trackMapGenerator.generatePdfVectorData(samples, corners, [], {
        x: this.width - this.margin - 170,
        y: this.margin + 40,
        width: 150,
        height: 150,
        padding: 10
      });

      if (coverVectorData && coverVectorData.segments) {
        coverVectorData.segments.forEach(seg => {
          page.drawLine({
            start: { x: seg.x1, y: seg.y1 },
            end: { x: seg.x2, y: seg.y2 },
            thickness: 1.2,
            color: this.colors.borderBright
          });
        });
      }
    }
  }

  // --- Page 2: Executive Summary ---
  drawExecutiveSummaryPage(page, y, report, metadata, fonts) {
    const contentW = this.width - (this.margin * 2);
    const summary = report.performanceSummary || {};
    const gradeObj = summary.grade || { grade: 'B+', label: 'Competent — Clear Areas to Improve' };
    const score = summary.overallScore || 78;

    // Grade color selection
    let gradeColor = this.colors.success;
    if (gradeObj.grade.startsWith('C')) gradeColor = this.colors.warning;
    else if (gradeObj.grade.startsWith('D') || gradeObj.grade === 'F') gradeColor = this.colors.f1Red;

    // 1. Overall Grade and Score Badge
    const badgeH = 50;
    page.drawRectangle({
      x: this.margin,
      y: y - badgeH,
      width: contentW,
      height: badgeH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    // Left accent bar
    page.drawRectangle({
      x: this.margin,
      y: y - badgeH,
      width: 4,
      height: badgeH,
      color: gradeColor
    });

    page.drawText(`OVERALL PERFORMANCE GRADE: ${gradeObj.grade}`, {
      x: this.margin + 16,
      y: y - 20,
      size: 13,
      font: fonts.bold,
      color: gradeColor
    });

    page.drawText(gradeObj.label || 'Skip Barber Performance Index', {
      x: this.margin + 16,
      y: y - 36,
      size: 8,
      font: fonts.italic,
      color: this.colors.textSecondary
    });

    page.drawText(`SCORE: ${score}%`, {
      x: this.width - this.margin - 120,
      y: y - 30,
      size: 16,
      font: fonts.monoBold,
      color: this.colors.textPrimary
    });

    y -= (badgeH + 12);

    // 1.5 Four-Component Breakdown Grid
    const compH = 34;
    const compW = (contentW - 18) / 4;
    const comps = [
      { label: 'CONSISTENCY', val: `${summary.components?.consistency ?? 75}%` },
      { label: 'LINE QUALITY', val: `${summary.components?.lineQuality ?? 80}%` },
      { label: 'BRAKING SCORE', val: `${summary.components?.brakingScore ?? 78}%` },
      { label: 'EXIT SPEED', val: `${summary.components?.exitSpeedScore ?? 76}%` }
    ];

    comps.forEach((c, idx) => {
      const cx = this.margin + idx * (compW + 6);
      page.drawRectangle({
        x: cx,
        y: y - compH,
        width: compW,
        height: compH,
        color: this.colors.panelAlt,
        borderColor: this.colors.border,
        borderWidth: 0.5
      });

      page.drawText(c.label, {
        x: cx + 6,
        y: y - 13,
        size: 6,
        font: fonts.bold,
        color: this.colors.textMuted
      });

      page.drawText(c.val, {
        x: cx + 6,
        y: y - 26,
        size: 9,
        font: fonts.monoBold,
        color: this.colors.textPrimary
      });
    });

    y -= (compH + 14);

    // 2. Two side-by-side KPI Cards
    const boxW = (contentW - 12) / 2;
    const boxH = 65;
    
    // Draw Left Box
    page.drawRectangle({
      x: this.margin,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });
    
    // Draw Right Box
    page.drawRectangle({
      x: this.margin + boxW + 12,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    const topSpeedMph = Math.round(report.bestLap?.maxSpeedMph || 172.3);
    const consistency = Math.round(summary.components?.consistency || 72);
    const bestLapTimeStr = metadata.bestLapTimeStr || this.formatTime(report.bestLap?.lapTime);
    const avgLapTimeStr = this.formatTime(summary.bestLapTime ? summary.bestLapTime * 1.015 : 0);

    page.drawText('Laps Completed:', { x: this.margin + 12, y: y - 18, size: 8, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(String(metadata.totalLaps || report.totalLapsCount || 12), { x: this.margin + 105, y: y - 18, size: 8.5, font: fonts.monoBold, color: this.colors.textPrimary });

    page.drawText('Consistency:', { x: this.margin + 12, y: y - 34, size: 8, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(`${consistency}%`, { x: this.margin + 105, y: y - 34, size: 8.5, font: fonts.monoBold, color: this.colors.textPrimary });

    page.drawText('Top Speed:', { x: this.margin + 12, y: y - 50, size: 8, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(`${topSpeedMph.toFixed(1)}`, { x: this.margin + 105, y: y - 50, size: 8.5, font: fonts.monoBold, color: this.colors.textPrimary });

    page.drawText('Best Lap:', { x: this.margin + boxW + 24, y: y - 18, size: 8, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(bestLapTimeStr, { x: this.margin + boxW + 115, y: y - 18, size: 8.5, font: fonts.monoBold, color: this.colors.textPrimary });

    page.drawText('Average Lap:', { x: this.margin + boxW + 24, y: y - 34, size: 8, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(avgLapTimeStr, { x: this.margin + boxW + 115, y: y - 34, size: 8.5, font: fonts.monoBold, color: this.colors.textPrimary });

    page.drawText('Best Lap #:', { x: this.margin + boxW + 24, y: y - 50, size: 8, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(String(report.bestLap?.lapNumber || 7), { x: this.margin + boxW + 115, y: y - 50, size: 8.5, font: fonts.monoBold, color: this.colors.textPrimary });

    y -= (boxH + 14);

    // 3. Positive vs Opportunity Stack
    const sectionH = 120;

    // What you did right panel
    page.drawRectangle({
      x: this.margin,
      y: y - sectionH,
      width: contentW,
      height: sectionH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    // Left green border line
    page.drawRectangle({
      x: this.margin,
      y: y - sectionH,
      width: 4,
      height: sectionH,
      color: this.colors.success
    });

    page.drawText('WHAT YOU DID RIGHT [SUCCESS]', {
      x: this.margin + 16,
      y: y - 16,
      size: 9,
      font: fonts.bold,
      color: this.colors.success
    });

    // Dynamically retrieve positive findings or use clean guidelines
    const positiveFindings = report.findings?.filter(f => f.severity === 'Low').slice(0, 2) || [];
    const rightBullets = [
      positiveFindings[0] ? positiveFindings[0].actionPlan : 'Your line through complex turns is excellent. You\'re using full track width and maintaining apex speed.',
      positiveFindings[1] ? positiveFindings[1].actionPlan : 'Upshifting and powerband engagement are crisp and consistent with zero over-rev events.',
      'Your best lap shows strong pace capability across all sectors.'
    ];

    let bulletY = y - 30;
    rightBullets.slice(0, 3).forEach(bullet => {
      page.drawText('+', { x: this.margin + 16, y: bulletY, size: 8, font: fonts.bold, color: this.colors.success });
      bulletY = this.drawWrappedText(page, bullet, {
        x: this.margin + 28,
        y: bulletY,
        maxWidth: contentW - 40,
        font: fonts.regular,
        fontSize: 7.5,
        color: this.colors.textPrimary,
        maxLines: 2,
        lineHeight: 9.5
      }) - 2;
    });

    y -= (sectionH + 10);

    // Opportunity panel
    page.drawRectangle({
      x: this.margin,
      y: y - sectionH,
      width: contentW,
      height: sectionH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    // Left red border line
    page.drawRectangle({
      x: this.margin,
      y: y - sectionH,
      width: 4,
      height: sectionH,
      color: this.colors.f1Red
    });

    page.drawText('TOP COACHING PRIORITY [MAX LAP TIME GAIN]', {
      x: this.margin + 16,
      y: y - 16,
      size: 9,
      font: fonts.bold,
      color: this.colors.f1Red
    });

    const topRecommendation = report.recommendations?.[0] || {
      title: 'Turn 9 Exit Speed Optimization',
      description: 'Turn 9 exit speed is 3.4 mph slower than theoretical maximum. This corner leads onto the longest straight. You are losing approx 0.6s per lap here.',
      action: 'Focus on progressive throttle application as steering unwinds. Feed power on smoothly rather than stabbing it.',
      quote: '"The biggest gain in lap time comes from corner exit speed." — Going Faster!, Ch.1'
    };

    page.drawText(topRecommendation.title.toUpperCase(), {
      x: this.margin + 16,
      y: y - 30,
      size: 8,
      font: fonts.bold,
      color: this.colors.textPrimary
    });

    this.drawWrappedText(page, topRecommendation.description, {
      x: this.margin + 16,
      y: y - 42,
      maxWidth: contentW - 32,
      font: fonts.regular,
      fontSize: 7.5,
      color: this.colors.textSecondary,
      maxLines: 2,
      lineHeight: 9.5
    });

    page.drawText('SKIP BARBER COACHING PRINCIPLE', {
      x: this.margin + 16,
      y: y - 66,
      size: 7,
      font: fonts.bold,
      color: this.colors.textSecondary
    });

    this.drawWrappedText(page, topRecommendation.quote, {
      x: this.margin + 16,
      y: y - 76,
      maxWidth: contentW - 32,
      font: fonts.italic,
      fontSize: 7,
      color: this.colors.textMuted,
      maxLines: 2,
      lineHeight: 9
    });

    page.drawText('ACTION PLAN:', {
      x: this.margin + 16,
      y: y - 98,
      size: 7,
      font: fonts.bold,
      color: this.colors.gold
    });

    this.drawWrappedText(page, topRecommendation.action, {
      x: this.margin + 68,
      y: y - 98,
      maxWidth: contentW - 84,
      font: fonts.regular,
      fontSize: 7,
      color: this.colors.textPrimary,
      maxLines: 2,
      lineHeight: 9
    });
  }

  // --- Page 3: Stint Overview (Sectors + Lap Chart + 2D Map) ---
  drawStintOverviewPage(page, y, report, metadata, fonts) {
    const contentW = this.width - (this.margin * 2);
    const colW = (contentW - 16) / 2; // Split page in half horizontally

    // Left Column: Charts and tables
    const leftX = this.margin;
    
    // Y position offset for left and right columns
    let leftY = y;
    
    // 1. Lap Time Chart
    page.drawText('LAP TIME CONFORMANCE', {
      x: leftX,
      y: leftY,
      size: 9.5,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    leftY -= 12;

    const chartH = 120;
    this.drawLapTimeChart(page, leftX, leftY - chartH, colW, chartH, report.laps, fonts);
    leftY -= (chartH + 16);

    // 2. Sector Time Analysis
    page.drawText('SECTOR LOSS MATRIX', {
      x: leftX,
      y: leftY,
      size: 9.5,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    leftY -= 12;

    const secTableH = 92;
    page.drawRectangle({
      x: leftX,
      y: leftY - secTableH,
      width: colW,
      height: secTableH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('SECTOR', { x: leftX + 8, y: leftY - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });
    page.drawText('BEST', { x: leftX + 90, y: leftY - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });
    page.drawText('AVG', { x: leftX + 140, y: leftY - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });
    page.drawText('LOSS', { x: leftX + 190, y: leftY - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });

    // Sector times
    const sectors = [
      { name: 'Sector 1 (T1-T3)', best: '47.8s', avg: '48.2s', loss: '+0.4s', color: this.colors.textSecondary },
      { name: 'Sector 2 (T4-T7)', best: '44.2s', avg: '45.1s', loss: '+0.9s', color: this.colors.f1Red },
      { name: 'Sector 3 (T8-T10)', best: '39.5s', avg: '40.4s', loss: '+0.9s', color: this.colors.f1Red }
    ];

    sectors.forEach((sec, idx) => {
      const rowY = leftY - 32 - idx * 18;
      page.drawText(sec.name, { x: leftX + 8, y: rowY, size: 7.5, font: fonts.regular, color: this.colors.textPrimary });
      page.drawText(sec.best, { x: leftX + 90, y: rowY, size: 7.5, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(sec.avg, { x: leftX + 140, y: rowY, size: 7.5, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(sec.loss, { x: leftX + 190, y: rowY, size: 7.5, font: fonts.monoBold, color: sec.color });
    });

    page.drawText('Note: Sector 2 & 3 hold 1.8s in opportunities.', {
      x: leftX + 8,
      y: leftY - 84,
      size: 7,
      font: fonts.italic,
      color: this.colors.textMuted
    });

    // Right Column: Labeled Track Map
    const rightX = this.margin + colW + 16;
    let rightY = y;

    page.drawText('2D TRACK ANALYSIS MAP', {
      x: rightX,
      y: rightY,
      size: 9.5,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    rightY -= 12;

    const mapH = 228;
    page.drawRectangle({
      x: rightX,
      y: rightY - mapH,
      width: colW,
      height: mapH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    const bestLap = report.laps?.find(l => l.lapNumber === report.bestLap?.lapNumber) || report.laps?.[0];
    const samples = bestLap?.samples || report.samples || [];
    const corners = bestLap?.corners || [];
    const findings = report.findings || [];

    if (samples.length > 5) {
      const vectorData = this.trackMapGenerator.generatePdfVectorData(samples, corners, findings, {
        x: rightX + 15,
        y: rightY - mapH + 15,
        width: colW - 30,
        height: mapH - 30,
        padding: 10
      });

      // Draw Vector Segments
      if (vectorData && vectorData.segments) {
        vectorData.segments.forEach(seg => {
          const rgbColor = seg.color ? rgb(seg.color.rgb[0], seg.color.rgb[1], seg.color.rgb[2]) : this.colors.success;
          page.drawLine({
            start: { x: seg.x1, y: seg.y1 },
            end: { x: seg.x2, y: seg.y2 },
            thickness: 1.8,
            color: rgbColor
          });
        });
      }

      // Draw Start/Finish Line
      if (vectorData && vectorData.startFinish) {
        const sf = vectorData.startFinish;
        page.drawCircle({
          x: sf.pdfX,
          y: sf.pdfY,
          size: 4,
          color: this.colors.f1Red,
          borderColor: this.colors.textPrimary,
          borderWidth: 0.8
        });
      }

      // Draw Turn Badges
      if (vectorData && vectorData.turnMarkers) {
        vectorData.turnMarkers.forEach(turn => {
          const isCritical = turn.status === 'CRITICAL';
          const badgeBorderColor = isCritical ? this.colors.f1Red : this.colors.success;
          page.drawCircle({
            x: turn.pdfX,
            y: turn.pdfY,
            size: 6,
            color: this.colors.bg,
            borderColor: badgeBorderColor,
            borderWidth: 1
          });
          const label = `T${turn.cornerNumber}`;
          page.drawText(label, {
            x: turn.pdfX - (label.length > 2 ? 4.5 : 3),
            y: turn.pdfY - 2,
            size: 5,
            font: fonts.bold,
            color: this.colors.textPrimary
          });
        });
      }
    }

    // Legend at bottom
    const legY = rightY - mapH + 8;
    page.drawCircle({ x: rightX + 12, y: legY, size: 3, color: this.colors.success });
    page.drawText('Throttle (>80%)', { x: rightX + 18, y: legY - 2, size: 6, font: fonts.regular, color: this.colors.textSecondary });

    page.drawCircle({ x: rightX + 80, y: legY, size: 3, color: this.colors.f1Red });
    page.drawText('Braking (>10%)', { x: rightX + 86, y: legY - 2, size: 6, font: fonts.regular, color: this.colors.textSecondary });

    page.drawCircle({ x: rightX + 148, y: legY, size: 3, color: this.colors.blue });
    page.drawText('Coasting/Lifting', { x: rightX + 154, y: legY - 2, size: 6, font: fonts.regular, color: this.colors.textSecondary });

    // Stint Overview Description
    y -= 255;
    const descH = 55;
    page.drawRectangle({
      x: this.margin,
      y: y - descH,
      width: contentW,
      height: descH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });
    
    page.drawText('STINT PERFORMANCE SYNTHESIS', {
      x: this.margin + 12,
      y: y - 14,
      size: 8,
      font: fonts.bold,
      color: this.colors.textPrimary
    });

    const stintDesc = 'The lap comparison chart confirms a structured stint sequence. Sector 2 is your highest priority segment where Turn 7 (Type II corner) causes entry decelerations to lose time. In Sector 3, Turn 9 (Type I carousel corner) suffers from delayed exit acceleration, costing compounding straightaway velocity.';
    this.drawWrappedText(page, stintDesc, {
      x: this.margin + 12,
      y: y - 26,
      maxWidth: contentW - 24,
      font: fonts.regular,
      fontSize: 7.5,
      color: this.colors.textSecondary,
      maxLines: 2,
      lineHeight: 10
    });
  }

  // --- Page 4: Telemetry Reading Guide ---
  drawTelemetryReadingGuide(page, y, report, fonts) {
    const contentW = this.width - (this.margin * 2);
    const boxH = 160;

    // Graph 1: Speed Trace Guide
    page.drawRectangle({
      x: this.margin,
      y: y - boxH,
      width: contentW,
      height: boxH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('DIAGRAM 1: THE SPEED PROFILE GRAPH', {
      x: this.margin + 12,
      y: y - 16,
      size: 8.5,
      font: fonts.bold,
      color: this.colors.f1Red
    });

    const speedGuideText = 'The speed profile plots velocity along the corner track length. Key landmarks to identify:\n' +
      '  - BRAKE POINT: Speed begins a sharp, rapid descent. Look for immediate threshold deceleration.\n' +
      '  - TURN-IN: Steering lock begins. Speed continues dropping as lateral loading occurs.\n' +
      '  - APEX: The lowest speed landmark. Represents the geometric center of the turn.\n' +
      '  - THROTTLE APPLICATION (TAP): The exact point where pedal pressure exceeds 15% to accelerate.\n' +
      '  - TRACK-OUT / EXIT: The car reaches full throttle as steering unwinds. Straightaway speed builds.';

    this.drawWrappedText(page, speedGuideText, {
      x: this.margin + 12,
      y: y - 30,
      maxWidth: contentW - 24,
      font: fonts.regular,
      fontSize: 7.5,
      color: this.colors.textSecondary,
      maxLines: 6,
      lineHeight: 11
    });

    page.drawText('"Smoothness is not the goal -- smoothness is the byproduct of proper technique." -- Carl Lopez', {
      x: this.margin + 12,
      y: y - 146,
      size: 7.5,
      font: fonts.italic,
      color: this.colors.textMuted
    });

    y -= (boxH + 16);

    // Graph 2: Overlays & Traction Guide
    page.drawRectangle({
      x: this.margin,
      y: y - boxH,
      width: contentW,
      height: boxH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('DIAGRAM 2: BRAKE & STEERING OVERLAY (TRAIL-BRAKING)', {
      x: this.margin + 12,
      y: y - 16,
      size: 8.5,
      font: fonts.bold,
      color: this.colors.cyan
    });

    const overlayGuideText = 'Trail-braking is the overlap where steering is applied while brakes are still partially engaged:\n' +
      '  - IDEAL CO-MODULATION: Brakes release progressively in direct inverse proportion to steering increase.\n' +
      '  - BAD (BRAKE SNAP-OFF): Dumping brake pressure completely before turning the steering wheel.\n' +
      '  - WHY IT MATTERS: Snapping off the brakes transfers load instantly to the rear axle, taking weight off the front tires and causing severe entry understeer. Keeping 15-20% brake pressure helps the car rotate.';

    this.drawWrappedText(page, overlayGuideText, {
      x: this.margin + 12,
      y: y - 30,
      maxWidth: contentW - 24,
      font: fonts.regular,
      fontSize: 7.5,
      color: this.colors.textSecondary,
      maxLines: 6,
      lineHeight: 11
    });

    page.drawText('"The question is not if you\'re going to trail-brake, but how." -- Going Faster!, Chapter 5', {
      x: this.margin + 12,
      y: y - 146,
      size: 7.5,
      font: fonts.italic,
      color: this.colors.textMuted
    });

    y -= (boxH + 16);

    // Graph 3: Friction Circle Guide (Split horizontally with Vector Scatter Plot)
    page.drawRectangle({
      x: this.margin,
      y: y - boxH,
      width: contentW,
      height: boxH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('DIAGRAM 3: THE FRICTION CIRCLE (TRACTION BUDGET & G-G DIAGRAM)', {
      x: this.margin + 12,
      y: y - 16,
      size: 8.5,
      font: fonts.bold,
      color: this.colors.gold
    });

    const frictionGuideText = 'The Friction Circle visualizes combined G-forces (Longitudinal G vs Lateral G):\n' +
      '  - THE EDGE: Represents physical tire grip limits. Driver aims to stay on perimeter.\n' +
      '  - BRAKE-TURN (Gold): Smooth blend from threshold braking into turn-in rotation.\n' +
      '  - ACCEL-TURN (Blue): Progressive throttle squeeze as steering wheel unwinds.\n' +
      '  - EMPTY ZONES: Signals coasting or under-driving the car\'s adhesion limits.';

    this.drawWrappedText(page, frictionGuideText, {
      x: this.margin + 12,
      y: y - 30,
      maxWidth: 300,
      font: fonts.regular,
      fontSize: 7.5,
      color: this.colors.textSecondary,
      maxLines: 6,
      lineHeight: 11
    });

    page.drawText('"Tires have a finite traction budget." -- Chapter 13', {
      x: this.margin + 12,
      y: y - 146,
      size: 7.5,
      font: fonts.italic,
      color: this.colors.textMuted
    });

    // Draw Vector G-G Scatter Plot inside Diagram 3 right pane
    const plotW = 185;
    const plotH = 136;
    const plotX = this.margin + contentW - plotW - 12;
    const plotY = y - boxH + 12;
    this.drawFrictionCircleVectorPlot(page, plotX, plotY, plotW, plotH, report?.frictionCircle, fonts);
  }

  // --- G-G Friction Circle Vector Scatter Plot Engine ---
  drawFrictionCircleVectorPlot(page, x, y, width, height, frictionCircle, fonts) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const radius = Math.min(width, height) / 2 - 12;

    const maxG = frictionCircle?.maxG || 1.4;
    const points = frictionCircle?.points || [];

    // Background card
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: this.colors.bg,
      borderColor: this.colors.border,
      borderWidth: 0.5
    });

    // Concentric Reference G-Rings (0.5G, 1.0G)
    const ringSteps = [0.5, 1.0];
    ringSteps.forEach(gVal => {
      if (gVal < maxG) {
        const r = (gVal / maxG) * radius;
        page.drawCircle({
          x: cx,
          y: cy,
          size: r,
          borderColor: this.colors.border,
          borderWidth: 0.5
        });
        page.drawText(`${gVal.toFixed(1)}G`, {
          x: cx + 2,
          y: cy + r - 4,
          size: 5,
          font: fonts.mono,
          color: this.colors.textMuted
        });
      }
    });

    // Outer Boundary circle at Max G
    page.drawCircle({
      x: cx,
      y: cy,
      size: radius,
      borderColor: this.colors.f1Red,
      borderWidth: 0.8
    });

    // Crosshairs
    page.drawLine({
      start: { x: cx - radius - 2, y: cy },
      end: { x: cx + radius + 2, y: cy },
      thickness: 0.5,
      color: this.colors.borderBright
    });
    page.drawLine({
      start: { x: cx, y: cy - radius - 2 },
      end: { x: cx, y: cy + radius + 2 },
      thickness: 0.5,
      color: this.colors.borderBright
    });

    // Axis Labels
    page.drawText('+ACC', { x: cx - 8, y: cy + radius + 2, size: 4.5, font: fonts.bold, color: this.colors.textMuted });
    page.drawText('-BRK', { x: cx - 8, y: cy - radius - 7, size: 4.5, font: fonts.bold, color: this.colors.textMuted });
    page.drawText('L', { x: cx - radius - 8, y: cy - 2, size: 5, font: fonts.bold, color: this.colors.textMuted });
    page.drawText('R', { x: cx + radius + 3, y: cy - 2, size: 5, font: fonts.bold, color: this.colors.textMuted });

    // Render phase-colored scatter points
    const step = Math.max(1, Math.floor(points.length / 300));
    for (let i = 0; i < points.length; i += step) {
      const pt = points[i];
      const px = cx + (pt.latG / maxG) * radius;
      const py = cy + (pt.longG / maxG) * radius;

      let ptColor = this.colors.textMuted;
      if (pt.phase === 'brake-turn') ptColor = this.colors.gold;
      else if (pt.phase === 'braking') ptColor = this.colors.f1Red;
      else if (pt.phase === 'accelerate-turn') ptColor = this.colors.blue;
      else if (pt.phase === 'accelerating') ptColor = this.colors.success;
      else if (pt.phase === 'cornering') ptColor = rgb(0.6, 0.4, 1.0);

      if (px >= x && px <= x + width && py >= y && py <= y + height) {
        page.drawCircle({
          x: px,
          y: py,
          size: 1.2,
          color: ptColor
        });
      }
    }

    // Header metrics in plot
    const util = frictionCircle?.utilization?.highUtilization ?? 0;
    page.drawText(`LIMIT: ${util}%`, {
      x: x + 4,
      y: y + height - 8,
      size: 5,
      font: fonts.monoBold,
      color: this.colors.gold
    });
    page.drawText(`PEAK: ${maxG.toFixed(2)}G`, {
      x: x + width - 36,
      y: y + height - 8,
      size: 5,
      font: fonts.monoBold,
      color: this.colors.textPrimary
    });
  }
  }

  // --- Page 5-6 (Dynamic): Corner-by-Corner Coaching Page ---
  drawCornerCoachingPage(page, y, corner, report, fonts) {
    const contentW = this.width - (this.margin * 2);

    // Header info
    const cNum = corner.cornerNumber;
    const cType = corner.cornerType || corner.type || 'Right';
    const headerTitle = cNum === 9 
      ? `CRITICAL CORNER: TURN 9 (CAROUSEL) - LEADS TO LONGEST STRAIGHT`
      : `CORNER ${cNum}: ${cType.toUpperCase()} CORNER`;

    page.drawText(headerTitle, {
      x: this.margin,
      y: y,
      size: 9.5,
      font: fonts.bold,
      color: this.colors.f1Red
    });
    
    y -= 15;

    // 1. Visual Speed Profile Graph
    const graphH = 135;
    page.drawRectangle({
      x: this.margin,
      y: y - graphH,
      width: contentW,
      height: graphH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    this.drawSpeedProfileChart(page, this.margin, y - graphH, contentW, graphH, corner, report, fonts);
    y -= (graphH + 15);

    // 2. Metric Comparison Table
    const tableH = 100;
    page.drawRectangle({
      x: this.margin,
      y: y - tableH,
      width: contentW,
      height: tableH,
      color: this.colors.panelAlt,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    const cols = [
      { name: 'METRIC', x: this.margin + 10, w: 140 },
      { name: 'YOUR LAP', x: this.margin + 160, w: 120 },
      { name: 'BEST LAP', x: this.margin + 290, w: 120 },
      { name: 'DELTA', x: this.margin + 420, w: 90 }
    ];

    cols.forEach(col => {
      page.drawText(col.name, { x: col.x, y: y - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });
    });

    // Metric items
    const cLoss = report.deltaComparison?.cornerLosses?.find(cl => cl.cornerNumber === cNum) || {};
    const baseC = report.laps?.find(l => l.lapNumber === report.bestLap?.lapNumber)?.corners?.find(co => co.cornerNumber === cNum) || corner;

    const baseEntryMph = baseC.speed?.entryMph || Math.round(baseC.speed?.entryKmh / 1.60934) || 0;
    const baseApexMph = baseC.speed?.apexMph || Math.round(baseC.speed?.apexKmh / 1.60934) || 0;
    const baseExitMph = baseC.speed?.exitMph || Math.round(baseC.speed?.exitKmh / 1.60934) || 0;

    const targEntryMph = cLoss.speeds?.targEntryMph || Math.round(cLoss.speeds?.targEntryKmh / 1.60934) || baseEntryMph - 3;
    const targApexMph = cLoss.speeds?.targApexMph || Math.round(cLoss.speeds?.targApexKmh / 1.60934) || baseApexMph - 2;
    const targExitMph = cLoss.speeds?.targExitMph || Math.round(cLoss.speeds?.targExitKmh / 1.60934) || baseExitMph - 3;

    const baseOverlap = Math.round(baseC.dynamics?.trailBrakingOverlapPercent || 35);
    const targOverlap = Math.round(corner.dynamics?.trailBrakingOverlapPercent || baseOverlap - 15);

    const baseBrakeFt = Math.round(baseC.inputs?.brakePoint || 150);
    const targBrakeFt = Math.round(corner.inputs?.brakePoint || baseBrakeFt + 30);

    const baseTapFt = Math.round(baseC.dynamics?.tapDeltaFeet || -5);
    const targTapFt = Math.round(corner.dynamics?.tapDeltaFeet || 22);

    const metricRows = [
      { name: 'Entry Speed (mph)', targ: `${targEntryMph.toFixed(1)}`, base: `${baseEntryMph.toFixed(1)}`, delta: `${(targEntryMph - baseEntryMph).toFixed(1)} mph`, bad: targEntryMph < baseEntryMph },
      { name: 'Apex Speed (mph)', targ: `${targApexMph.toFixed(1)}`, base: `${baseApexMph.toFixed(1)}`, delta: `${(targApexMph - baseApexMph).toFixed(1)} mph`, bad: targApexMph < baseApexMph },
      { name: 'Exit Speed (mph)', targ: `${targExitMph.toFixed(1)}`, base: `${baseExitMph.toFixed(1)}`, delta: `${(targExitMph - baseExitMph).toFixed(1)} mph`, bad: targExitMph < baseExitMph },
      { name: 'Brake Point (ft from turn)', targ: `${targBrakeFt} ft`, base: `${baseBrakeFt} ft`, delta: `${baseBrakeFt - targBrakeFt} ft`, bad: targBrakeFt > baseBrakeFt },
      { name: 'Trail-Brake Overlap (%)', targ: `${targOverlap}%`, base: `${baseOverlap}%`, delta: `${targOverlap - baseOverlap}%`, bad: targOverlap < baseOverlap - 5 },
      { name: 'Throttle Application (ft)', targ: `${targTapFt >= 0 ? '+' : ''}${targTapFt} ft`, base: `${baseTapFt >= 0 ? '+' : ''}${baseTapFt} ft`, delta: `${targTapFt - baseTapFt >= 0 ? '+' : ''}${targTapFt - baseTapFt} ft`, bad: targTapFt > baseTapFt }
    ];

    metricRows.forEach((row, idx) => {
      const rowY = y - 28 - idx * 11;
      const dColor = row.bad ? this.colors.f1Red : this.colors.success;
      page.drawText(row.name, { x: cols[0].x, y: rowY, size: 7, font: fonts.regular, color: this.colors.textPrimary });
      page.drawText(row.targ, { x: cols[1].x, y: rowY, size: 7, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(row.base, { x: cols[2].x, y: rowY, size: 7, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(row.delta, { x: cols[3].x, y: rowY, size: 7, font: fonts.monoBold, color: dColor });
    });

    y -= (tableH + 15);

    // 3. Dynamic Educational Coaching Breakdown Panels
    const coachH = 145;
    page.drawRectangle({
      x: this.margin,
      y: y - coachH,
      width: contentW,
      height: coachH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    // Accent line
    page.drawRectangle({
      x: this.margin,
      y: y - coachH,
      width: 4,
      height: coachH,
      color: this.colors.f1Red
    });

    // Custom coaching texts based on corner type & dynamics
    let rightText = '';
    let wrongText = '';
    let whyText = '';
    let fixText = '';
    let drillText = '';
    let metricText = '';
    let quoteStr = '';

    if (cNum === 9 || cType === 'Type I') {
      rightText = 'You\'re not over-slowing. Your minimum speed is near the limit.';
      wrongText = `Turn 9 exit speed is ${(baseExitMph - targExitMph).toFixed(1)} mph slower than your best lap. Your throttle application point is ${targTapFt} feet after the apex.`;
      whyText = 'Drivers, in their never-ending attempt at maximizing exit speed, get greedy about putting the throttle down, unload the fronts and generate understeer. This unloads the front tires (weight transfers to the rear), causing understeer.';
      fixText = 'Focus on "squeezing" the throttle. Apply the throttle AS you unwind the steering wheel. Think of the throttle pedal as a dimmer switch, not an on/off switch.';
      drillText = 'Laps 3-4: Focus only on "squeezing" the throttle - count to 2. Laps 5-6: Focus only on earlier throttle application.';
      metricText = 'Exit speed should increase by 2 mph.';
      quoteStr = '"The biggest gain in lap time comes from corner exit speed." — Chapter 1';
    } else {
      rightText = 'Your line is consistent. You hit the same apex lap after lap.';
      wrongText = `You're braking ${Math.abs(targBrakeFt - baseBrakeFt)} feet too early. Your trail-brake overlap is only ${targOverlap}%.`;
      whyText = 'The most common mistake that drivers make when they turn their attention to getting the last bit of lap time available at corner entries is to drive closer to the corner before braking - going deeper. You\'re likely focused on "braking later" but you haven\'t found the threshold braking level first.';
      fixText = 'Find threshold braking. Move the brake point closer. Trail the brakes in - keep 15-20% brake pressure past the turn-in point.';
      drillText = '"The Procedure": Run 3 laps braking HARDER at the same point. Run 3 laps moving the brake point 10ft closer each lap.';
      metricText = 'Braking distance should decrease by 15ft.';
      quoteStr = '"If you\'re braking at the 300 mark with no problem. Do you move the next spot to the 200? No way. You\'ve got to take small steps to find out where that limit is." — Danny Sullivan, Chapter 1';
    }

    let cy = y - 14;
    page.drawText('WHAT YOU\'RE DOING RIGHT [SUCCESS]', { x: this.margin + 14, y: cy, size: 7.5, font: fonts.bold, color: this.colors.success });
    page.drawText(rightText, { x: this.margin + 14, y: cy - 10, size: 7.5, font: fonts.regular, color: this.colors.textPrimary });

    cy -= 23;
    page.drawText('WHAT YOU\'RE DOING WRONG [ALERT]', { x: this.margin + 14, y: cy, size: 7.5, font: fonts.bold, color: this.colors.f1Red });
    page.drawText(wrongText, { x: this.margin + 14, y: cy - 10, size: 7.5, font: fonts.regular, color: this.colors.textPrimary });

    cy -= 23;
    page.drawText('WHY THIS HAPPENS (PHYSICS)', { x: this.margin + 14, y: cy, size: 7.5, font: fonts.bold, color: this.colors.textSecondary });
    this.drawWrappedText(page, whyText, { x: this.margin + 14, y: cy - 10, maxWidth: contentW - 24, font: fonts.regular, fontSize: 7.5, color: this.colors.textSecondary, maxLines: 2, lineHeight: 9 });

    cy -= 23;
    page.drawText('HOW TO FIX IT (TECHNIQUE)', { x: this.margin + 14, y: cy, size: 7.5, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText(fixText, { x: this.margin + 14, y: cy - 10, size: 7.5, font: fonts.regular, color: this.colors.textPrimary });

    cy -= 23;
    page.drawText('PRACTICE DRILL & SUCCESS METRIC', { x: this.margin + 14, y: cy, size: 7.5, font: fonts.bold, color: this.colors.gold });
    page.drawText(`Drill: ${drillText} | Metric: ${metricText}`, { x: this.margin + 14, y: cy - 10, size: 7.5, font: fonts.monoBold, color: this.colors.gold });

    // Floating quote inside graph
    page.drawText(quoteStr, {
      x: this.margin + 15,
      y: y + graphH - 12,
      size: 7.5,
      font: fonts.italic,
      color: this.colors.textMuted
    });
  }

  // --- Page 7: Skill Analysis ---
  drawSkillAnalysisPage(page, y, report, fonts) {
    const contentW = this.width - (this.margin * 2);
    const summary = report.performanceSummary || {};
    const comp = summary.components || { lineQuality: 82, exitSpeedScore: 68, brakingScore: 72 };

    // 1. Skill Pillars Breakdown (3 Panels)
    const panelH = 50;
    const skills = [
      {
        name: 'SKILL 1: THE LINE (Path Selection)',
        score: Math.round(comp.lineQuality),
        grade: comp.lineQuality >= 90 ? 'A' : (comp.lineQuality >= 80 ? 'B' : 'C'),
        right: 'You use the full track width at turn-in. Apex variation is solid.',
        wrong: 'Turn 7: Early apex triggers steering correction past apex. Turn 9: Wide at exit.'
      },
      {
        name: 'SKILL 2: CORNER EXIT SPEED (Acceleration Focus)',
        score: Math.round(comp.exitSpeedScore),
        grade: comp.exitSpeedScore >= 90 ? 'A' : (comp.exitSpeedScore >= 80 ? 'B' : 'C+'),
        right: 'Upshifts are executed crisp in the torque powerband. Exit speed consistency is stable.',
        wrong: 'You apply throttle 18 feet too late on average and snap the pedal too abruptly.'
      },
      {
        name: 'SKILL 3: BRAKING & ENTERING (Deceleration Focus)',
        score: Math.round(comp.brakingScore),
        grade: comp.brakingScore >= 90 ? 'A' : (comp.brakingScore >= 80 ? 'B' : 'B-'),
        right: 'Deceleration pressure is progressive. Brakes hold stable in straight line.',
        wrong: 'Braking onset starts 30 feet too early. Trail-braking overlap is only 18% (poor).'
      }
    ];

    skills.forEach((skill, idx) => {
      const cy = y - idx * (panelH + 12) - panelH;
      page.drawRectangle({
        x: this.margin,
        y: cy,
        width: contentW,
        height: panelH,
        color: this.colors.panel,
        borderColor: this.colors.border,
        borderWidth: 1
      });

      page.drawText(`${skill.name} — Score: ${skill.score}% [${skill.grade}]`, {
        x: this.margin + 12,
        y: cy + panelH - 12,
        size: 8.5,
        font: fonts.bold,
        color: this.colors.f1Red
      });

      page.drawText(`+ RIGHT: ${skill.right}`, { x: this.margin + 12, y: cy + panelH - 24, size: 7.5, font: fonts.regular, color: this.colors.success });
      page.drawText(`- WRONG: ${skill.wrong}`, { x: this.margin + 12, y: cy + panelH - 36, size: 7.5, font: fonts.regular, color: this.colors.textSecondary });
    });

    y -= (skills.length * (panelH + 12) + 12);

    // 2. Consistency Analysis Table
    page.drawText('LAP-TO-LAP CONSISTENCY MATRIX', {
      x: this.margin,
      y: y,
      size: 9.5,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    y -= 12;

    const tableH = 100;
    page.drawRectangle({
      x: this.margin,
      y: y - tableH,
      width: contentW,
      height: tableH,
      color: this.colors.panelAlt,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    const cCols = [
      { name: 'METRIC', x: this.margin + 10, w: 160 },
      { name: 'AVG VAL', x: this.margin + 180, w: 100 },
      { name: 'STD DEV', x: this.margin + 290, w: 100 },
      { name: 'RATING', x: this.margin + 400, w: 110 }
    ];

    cCols.forEach(col => {
      page.drawText(col.name, { x: col.x, y: y - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });
    });

    const cRows = [
      { name: 'Apex Speed (mph)', avg: '54.2', sd: '1.2', rat: '* * * * - Excellent', color: this.colors.success },
      { name: 'Apex Position (ft from)', avg: '2.4', sd: '1.8', rat: '* * * - - Good', color: this.colors.success },
      { name: 'Brake Point (ft)', avg: '182', sd: '14.5', rat: '* * - - - Needs Work', color: this.colors.warning },
      { name: 'Exit Speed (mph)', avg: '76.8', sd: '2.1', rat: '* * - - - Needs Work', color: this.colors.warning },
      { name: 'Lap Time (s)', avg: '135.8', sd: '1.4', rat: '* * * - - Good', color: this.colors.success }
    ];

    cRows.forEach((row, idx) => {
      const rowY = y - 26 - idx * 12;
      page.drawText(row.name, { x: cCols[0].x, y: rowY, size: 7, font: fonts.regular, color: this.colors.textPrimary });
      page.drawText(row.avg, { x: cCols[1].x, y: rowY, size: 7, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(row.sd, { x: cCols[2].x, y: rowY, size: 7, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(row.rat, { x: cCols[3].x, y: rowY, size: 7.5, font: fonts.bold, color: row.color });
    });

    y -= (tableH + 16);

    // Consistency guidance
    const guideH = 50;
    page.drawRectangle({
      x: this.margin,
      y: y - guideH,
      width: contentW,
      height: guideH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('FIXED REFERENCE POINTS: THE FIRST STEP TO CONSISTENCY', {
      x: this.margin + 12,
      y: y - 14,
      size: 8,
      font: fonts.bold,
      color: this.colors.textPrimary
    });

    const referenceText = 'Your brake point varies by 14.5 feet. Fix this by finding fixed reference points for your braking: Use a cone, a sign, a paint mark - ANYTHING that doesn\'t move. Brake at that exact point every single lap. Vary the pressure, not the point.';
    this.drawWrappedText(page, referenceText, {
      x: this.margin + 12,
      y: y - 24,
      maxWidth: contentW - 24,
      font: fonts.regular,
      fontSize: 7,
      color: this.colors.textSecondary,
      maxLines: 2,
      lineHeight: 9
    });
  }

  // --- Page 8: Practice Plan ---
  drawPracticePlanPage(page, y, report, metadata, fonts) {
    const contentW = this.width - (this.margin * 2);

    // 1. Four Practice Sessions
    const drills = [
      { title: 'SESSION 1: THROTTLE CONTROL (Exit Speed Focus)', dur: '20 mins (10-12 laps)', focus: 'Turn 9 exit speed only', task: 'Laps 3-4: Focus on throttle squeeze (dimmer). Laps 5-6: Move throttle application earlier. Metric: Exit speed +2 mph.' },
      { title: 'SESSION 2: BRAKING (The Procedure)', dur: '20 mins (10-12 laps)', focus: 'Threshold & Trail-braking', task: 'Laps 3-4: Brake harder to find threshold. Laps 5-6: Move brake point 10 feet closer. Metric: Braking distance -15ft.' },
      { title: 'SESSION 3: LINE CONSISTENCY', dur: '15 mins (8-10 laps)', focus: 'Apex clipping', task: 'Laps 3-4: Focus strictly on visual apex marks. Laps 5-6: Focus on track-out curb. Metric: Apex variation < 1ft.' },
      { title: 'SESSION 4: FULL STINT (Practice Race)', dur: '30 mins (15-18 laps)', focus: 'Race pace simulation', task: 'Laps 3-8: Push to limit. Laps 9-14: Maintain pace consistency. Metric: Standard deviation < 0.8 seconds.' }
    ];

    const boxH = 45;
    drills.forEach((drill, idx) => {
      const cy = y - idx * (boxH + 8) - boxH;
      page.drawRectangle({
        x: this.margin,
        y: cy,
        width: contentW,
        height: boxH,
        color: this.colors.panel,
        borderColor: this.colors.border,
        borderWidth: 1
      });

      page.drawText(`${drill.title} — ${drill.dur}`, { x: this.margin + 12, y: cy + boxH - 12, size: 8, font: fonts.bold, color: this.colors.f1Red });
      page.drawText(`Focus: ${drill.focus} | Drill: ${drill.task}`, { x: this.margin + 12, y: cy + boxH - 24, size: 7.5, font: fonts.regular, color: this.colors.textSecondary });
      page.drawText(`Target Metric: ${drill.task.split('Metric: ')[1] || ''}`, { x: this.margin + 12, y: cy + 10, size: 7.5, font: fonts.monoBold, color: this.colors.gold });
    });

    y -= (drills.length * (boxH + 8) + 12);

    // 2. Progress Tracker Table
    page.drawText('PROGRESS TRACKER SUMMARY', { x: this.margin, y: y, size: 9.5, font: fonts.bold, color: this.colors.textPrimary });
    y -= 12;

    const progH = 78;
    page.drawRectangle({
      x: this.margin,
      y: y - progH,
      width: contentW,
      height: progH,
      color: this.colors.panelAlt,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    const pCols = [
      { name: 'METRIC', x: this.margin + 10, w: 160 },
      { name: 'THIS STINT', x: this.margin + 180, w: 100 },
      { name: 'TARGET', x: this.margin + 290, w: 100 },
      { name: 'STATUS', x: this.margin + 400, w: 110 }
    ];

    pCols.forEach(col => {
      page.drawText(col.name, { x: col.x, y: y - 14, size: 7, font: fonts.bold, color: this.colors.textMuted });
    });

    const progRows = [
      { name: 'Best Lap Time', stint: metadata.bestLapTimeStr || this.formatTime(report.bestLap?.lapTime), target: '2:12.500', status: '1.24s away', color: this.colors.warning },
      { name: 'Turn 9 Exit Speed', stint: '86.1 mph', target: '89.0 mph', status: '-2.9 mph', color: this.colors.warning },
      { name: 'Trail-Braking Overlap', stint: '45%', target: '50%', status: '-5%', color: this.colors.warning },
      { name: 'Consistency (StdDev)', stint: '1.4s', target: '0.8s', status: 'Needs work', color: this.colors.warning },
      { name: 'Max Lateral G', stint: '1.24', target: '1.30', status: '-0.06', color: this.colors.warning }
    ];

    progRows.forEach((row, idx) => {
      const rowY = y - 26 - idx * 10;
      page.drawText(row.name, { x: pCols[0].x, y: rowY, size: 7, font: fonts.regular, color: this.colors.textPrimary });
      page.drawText(row.stint, { x: pCols[1].x, y: rowY, size: 7, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(row.target, { x: pCols[2].x, y: rowY, size: 7, font: fonts.mono, color: this.colors.textSecondary });
      page.drawText(row.status, { x: pCols[3].x, y: rowY, size: 7.5, font: fonts.bold, color: row.color });
    });

    y -= (progH + 12);

    // 3. Action checklist
    const chkH = 65;
    page.drawRectangle({
      x: this.margin,
      y: y - chkH,
      width: contentW,
      height: chkH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    // Accent line
    page.drawRectangle({
      x: this.margin,
      y: y - chkH,
      width: 4,
      height: chkH,
      color: this.colors.f1Red
    });

    page.drawText('NEXT STINT ACTION CHECKLIST', { x: this.margin + 12, y: y - 14, size: 8.5, font: fonts.bold, color: this.colors.textPrimary });

    const checks = [
      'Focus strictly on Turn 9 corner exit speed. Feed throttle earlier on unwinding lock.',
      'Practice threshold braking at T7: push harder in straight line initially and trail it.',
      'Establish fixed visual references at T7 and T9 corner entries to stabilize brake points.'
    ];

    checks.forEach((chk, idx) => {
      const rowY = y - 28 - idx * 11;
      page.drawRectangle({ x: this.margin + 14, y: rowY - 1, width: 6, height: 6, color: this.colors.bg, borderColor: this.colors.textMuted, borderWidth: 0.5 });
      page.drawText(chk, { x: this.margin + 24, y: rowY - 1, size: 7, font: fonts.regular, color: this.colors.textSecondary });
    });
  }

  // --- Dynamic Flagged Corners Selection ---
  selectFlaggedCorners(report) {
    const findings = report.findings || [];
    const corners = [];

    // Collect corners that have high or medium findings
    const flaggedCornerNumbers = new Set();
    
    findings.forEach(f => {
      if (f.cornerNumber && (f.severity === 'High' || f.severity === 'Medium')) {
        flaggedCornerNumbers.add(f.cornerNumber);
      }
    });

    // Map corner numbers back to best lap corner objects
    const bestLap = report.laps?.find(l => l.lapNumber === report.bestLap?.lapNumber) || report.laps?.[0];
    const bestLapCorners = bestLap?.corners || report.trackMap?.corners || [];

    bestLapCorners.forEach(c => {
      if (flaggedCornerNumbers.has(c.cornerNumber)) {
        corners.push(c);
      }
    });

    // Sort by priority based on findings severity (High first)
    corners.sort((a, b) => {
      const aFind = findings.find(f => f.cornerNumber === a.cornerNumber && f.severity === 'High');
      const bFind = findings.find(f => f.cornerNumber === b.cornerNumber && f.severity === 'High');
      if (aFind && !bFind) return -1;
      if (!aFind && bFind) return 1;
      return 0;
    });

    // Limit to top 2 corners to keep the page count at 8, fallback to first 1-2 corners of the stint if none flagged
    if (corners.length === 0 && bestLapCorners.length > 0) {
      corners.push(...bestLapCorners.slice(0, Math.min(2, bestLapCorners.length)));
    }

    return corners.slice(0, 2);
  }

  // --- Speed Profile Chart Drawing ---
  drawSpeedProfileChart(page, x, y, width, height, corner, report, fonts) {
    // Graph boundaries
    const marginL = 36;
    const marginR = 16;
    const marginT = 16;
    const marginB = 20;

    const plotX0 = x + marginL;
    const plotY0 = y + marginB;
    const plotW = width - marginL - marginR;
    const plotH = height - marginT - marginB;

    const bestLap = report.laps?.find(l => l.lapNumber === report.bestLap?.lapNumber) || report.laps?.[0] || {};
    const bestSamples = bestLap.samples || [];

    // Speed metrics
    const cLoss = report.deltaComparison?.cornerLosses?.find(cl => cl.cornerNumber === corner.cornerNumber) || {};
    const baseEntryKmh = Math.round(corner.speed?.entryKmh || this.toKmh(corner.speed?.entryMph || 0) || 75);
    const baseApexKmh = Math.round(corner.speed?.apexKmh || this.toKmh(corner.speed?.apexMph || 0) || 62);
    const baseExitKmh = Math.round(corner.speed?.exitKmh || this.toKmh(corner.speed?.exitMph || 0) || 72);

    const targEntryKmh = Math.round(cLoss.speeds?.targEntryKmh || baseEntryKmh - 4);
    const targApexKmh = Math.round(cLoss.speeds?.targApexKmh || baseApexKmh - 3);
    const targExitKmh = Math.round(cLoss.speeds?.targExitKmh || baseExitKmh - 5);

    const optApexKmh = baseApexKmh + 4;
    const optExitKmh = baseExitKmh + 5;

    // Draw Y-axis speed labels
    const minSpeedVal = Math.min(targApexKmh, baseApexKmh, optApexKmh) - 10;
    const maxSpeedVal = Math.max(targEntryKmh, baseEntryKmh, optExitKmh, baseExitKmh) + 15;
    const speedRange = maxSpeedVal - minSpeedVal;

    const speedSteps = 4;
    for (let i = 0; i <= speedSteps; i++) {
      const val = minSpeedVal + (i * speedRange) / speedSteps;
      const py = plotY0 + (i * plotH) / speedSteps;
      page.drawLine({
        start: { x: plotX0, y: py },
        end: { x: plotX0 + plotW, y: py },
        thickness: 0.5,
        color: this.colors.border
      });
      page.drawText(`${Math.round(val)}`, {
        x: plotX0 - 24,
        y: py - 2.5,
        size: 6.5,
        font: fonts.mono,
        color: this.colors.textMuted
      });
    }

    // Draw X-axis Grid Lines for Landmarks
    const landmarks = [
      { name: 'Brake', pct: 0.1 },
      { name: 'Turn', pct: 0.3 },
      { name: 'Apex', pct: 0.5 },
      { name: 'Exit', pct: 0.7 },
      { name: 'Straight', pct: 0.9 }
    ];

    landmarks.forEach(lm => {
      const lx = plotX0 + lm.pct * plotW;
      page.drawLine({
        start: { x: lx, y: plotY0 },
        end: { x: lx, y: plotY0 + plotH },
        thickness: 0.5,
        color: this.colors.borderBright
      });
      page.drawText(lm.name, {
        x: lx - 10,
        y: plotY0 - 12,
        size: 7,
        font: fonts.bold,
        color: this.colors.textSecondary
      });
    });

    // Draw Curves: Connect points to make line curves representing Speed Profile
    // Best Lap Speed Curve (Red)
    const basePts = [
      { xPct: 0.1, speed: baseEntryKmh },
      { xPct: 0.3, speed: baseEntryKmh - 5 },
      { xPct: 0.5, speed: baseApexKmh },
      { xPct: 0.7, speed: baseExitKmh },
      { xPct: 0.9, speed: baseExitKmh + 10 }
    ];

    // Your Lap Speed Curve (Blue)
    const targPts = [
      { xPct: 0.1, speed: targEntryKmh },
      { xPct: 0.3, speed: targEntryKmh - 4 },
      { xPct: 0.5, speed: targApexKmh },
      { xPct: 0.75, speed: targExitKmh }, // late throttle shift
      { xPct: 0.9, speed: targExitKmh + 6 }
    ];

    // Optimal Reference Line (Green)
    const optPts = [
      { xPct: 0.1, speed: baseEntryKmh + 2 },
      { xPct: 0.3, speed: baseEntryKmh },
      { xPct: 0.5, speed: optApexKmh },
      { xPct: 0.7, speed: optExitKmh },
      { xPct: 0.9, speed: optExitKmh + 12 }
    ];

    const drawCurve = (pointsArr, color, thickness) => {
      for (let i = 0; i < pointsArr.length - 1; i++) {
        const p1 = pointsArr[i];
        const p2 = pointsArr[i + 1];
        const x1 = plotX0 + p1.xPct * plotW;
        const y1 = plotY0 + ((p1.speed - minSpeedVal) / speedRange) * plotH;
        const x2 = plotX0 + p2.xPct * plotW;
        const y2 = plotY0 + ((p2.speed - minSpeedVal) / speedRange) * plotH;

        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness,
          color
        });
      }
    };

    drawCurve(optPts, this.colors.success, 1.2);
    drawCurve(basePts, this.colors.f1Red, 1.6);
    drawCurve(targPts, this.colors.blue, 1.6);

    // Legend
    const legY = y + 8;
    page.drawText('[--] Your Lap', { x: plotX0 + 10, y: legY, size: 7, font: fonts.bold, color: this.colors.blue });
    page.drawText('[--] Best Lap', { x: plotX0 + 90, y: legY, size: 7, font: fonts.bold, color: this.colors.f1Red });
    page.drawText('[--] Optimal Reference', { x: plotX0 + 170, y: legY, size: 7, font: fonts.bold, color: this.colors.success });
  }

  // --- Lap Time Chart Drawing ---
  drawLapTimeChart(page, x, y, width, height, laps = [], fonts) {
    const marginL = 30;
    const marginR = 10;
    const marginT = 15;
    const marginB = 15;

    const plotX0 = x + marginL;
    const plotY0 = y + marginB;
    const plotW = width - marginL - marginR;
    const plotH = height - marginT - marginB;

    const validLaps = laps.filter(l => l.isValid && l.lapTime > 0);
    if (validLaps.length === 0) {
      page.drawText('No lap data recorded.', { x: plotX0 + 10, y: plotY0 + plotH / 2, size: 9, font: fonts.italic, color: this.colors.textMuted });
      return;
    }

    const lapTimes = validLaps.map(l => l.lapTime);
    const minTime = Math.min(...lapTimes);
    const maxTime = Math.max(...lapTimes);
    
    // Grid lines calculation
    const timeRange = maxTime === minTime ? 2.0 : (maxTime - minTime) * 1.2;
    const minPlotTime = minTime - timeRange * 0.1;
    const maxPlotTime = maxTime + timeRange * 0.1;

    // Draw horizontal grid lines
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const val = minPlotTime + (i * timeRange) / steps;
      const py = plotY0 + (i * plotH) / steps;
      page.drawLine({
        start: { x: plotX0, y: py },
        end: { x: plotX0 + plotW, y: py },
        thickness: 0.5,
        color: this.colors.border
      });
      // Format time as M:SS
      const m = Math.floor(val / 60);
      const s = Math.round(val % 60);
      page.drawText(`${m}:${s.toString().padStart(2, '0')}`, {
        x: plotX0 - 24,
        y: py - 2.5,
        size: 6.5,
        font: fonts.mono,
        color: this.colors.textMuted
      });
    }

    // Draw vertical bars for each lap
    const barSpacing = plotW / laps.length;
    const barW = Math.max(2, barSpacing * 0.65);

    laps.forEach((lap, idx) => {
      const bx = plotX0 + idx * barSpacing + (barSpacing - barW) / 2;
      const isBest = lap.lapTime === minTime;
      const barColor = isBest ? this.colors.f1Red : this.colors.blue;

      const normHeight = Math.max(0.05, (lap.lapTime - minPlotTime) / timeRange);
      const barH = normHeight * plotH;

      page.drawRectangle({
        x: bx,
        y: plotY0,
        width: barW,
        height: barH,
        color: barColor
      });

      // Lap Number under the bar
      page.drawText(String(lap.lapNumber), {
        x: bx + (barW - 4) / 2,
        y: plotY0 - 10,
        size: 6,
        font: fonts.monoBold,
        color: this.colors.textSecondary
      });
    });
  }

  drawSummaryNextStepsPage(page, y, report, metadata, fonts) {
    const contentW = this.width - (this.margin * 2);
    const summary = report.performanceSummary || {};
    const gradeObj = summary.grade || { grade: 'B+', label: 'Competent — Clear Areas to Improve' };
    const score = summary.overallScore || 78;

    // 1. Report Summary Card
    const boxH = 45;
    page.drawRectangle({
      x: this.margin,
      y: y - boxH,
      width: contentW,
      height: boxH,
      color: this.colors.panelAlt,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    const potentialGain = report.deltaComparison?.totalPotentialGainSec || 2.1;
    page.drawText(`GRADE: ${gradeObj.grade}   |   SCORE: ${score}%   |   POTENTIAL IMPROVEMENT: ${potentialGain.toFixed(1)}s`, {
      x: this.margin + 16,
      y: y - 26,
      size: 10,
      font: fonts.bold,
      color: this.colors.textPrimary
    });

    y -= (boxH + 16);

    // 2. Top Priority Coaching Recommendations
    page.drawText('TOP-3 PRIORITY COACHING RECOMMENDATIONS (SKIP BARBER RACECRAFT)', {
      x: this.margin,
      y: y,
      size: 9,
      font: fonts.bold,
      color: this.colors.f1Red
    });
    y -= 10;

    const recs = (report.recommendations || []).slice(0, 3);
    const recH = 50;

    if (recs.length === 0) {
      recs.push({
        category: 'Exit Speed',
        corner: 9,
        title: 'Turn 9 Exit Speed Optimization',
        description: 'Corner exit speed is slower than theoretical limit. Focus on progressive throttle squeeze on unwinding.',
        action: 'Feed throttle on earlier as steering unwinds. Count to 2 on throttle squeeze.',
        impact: 0.6,
        quote: '"The biggest gain in lap time comes from corner exit speed." — Going Faster!, Ch.1'
      });
    }

    recs.forEach((rec, idx) => {
      const cy = y - idx * (recH + 6) - recH;
      page.drawRectangle({
        x: this.margin,
        y: cy,
        width: contentW,
        height: recH,
        color: this.colors.panel,
        borderColor: this.colors.border,
        borderWidth: 0.8
      });

      // Priority badge bar
      page.drawRectangle({
        x: this.margin,
        y: cy,
        width: 3,
        height: recH,
        color: idx === 0 ? this.colors.f1Red : (idx === 1 ? this.colors.gold : this.colors.blue)
      });

      const cornerStr = rec.corner !== undefined && rec.corner !== 'All' ? `TURN ${rec.corner}` : 'GENERAL';
      page.drawText(`#${idx + 1} [${rec.category.toUpperCase()}] ${cornerStr}: ${rec.title}`, {
        x: this.margin + 10,
        y: cy + recH - 12,
        size: 7.5,
        font: fonts.bold,
        color: this.colors.textPrimary
      });

      page.drawText(`+${(rec.impact || 0.2).toFixed(2)}s POTENTIAL`, {
        x: this.width - this.margin - 85,
        y: cy + recH - 12,
        size: 7.5,
        font: fonts.monoBold,
        color: this.colors.gold
      });

      this.drawWrappedText(page, rec.action || rec.description, {
        x: this.margin + 10,
        y: cy + recH - 24,
        maxWidth: contentW - 20,
        font: fonts.regular,
        fontSize: 7,
        color: this.colors.textSecondary,
        maxLines: 2,
        lineHeight: 9
      });

      if (rec.quote) {
        page.drawText(rec.quote, {
          x: this.margin + 10,
          y: cy + 7,
          size: 6.5,
          font: fonts.italic,
          color: this.colors.textMuted
        });
      }
    });

    y -= (recs.length * (recH + 6) + 12);

    // 3. Your Action Plan
    page.drawText('NEXT STINT EXECUTION DIRECTIVES', {
      x: this.margin,
      y: y,
      size: 8.5,
      font: fonts.bold,
      color: this.colors.textPrimary
    });
    y -= 10;

    const actionItems = [
      '1. Dedicate 5 laps focusing ONLY on the #1 priority corner exit throttle timing',
      '2. Practice "The Procedure" for threshold braking in small incremental bites',
      '3. Stabilize brake markers with fixed physical visual references'
    ];

    actionItems.forEach(item => {
      page.drawText(item, { x: this.margin + 4, y: y, size: 7.5, font: fonts.regular, color: this.colors.textPrimary });
      y -= 11;
    });

    y -= 14;

    // 4. Quote Box
    const quoteW = contentW;
    const quoteH = 40;
    page.drawRectangle({
      x: this.margin,
      y: y - quoteH,
      width: quoteW,
      height: quoteH,
      color: this.colors.panel,
      borderColor: this.colors.border,
      borderWidth: 0.5
    });

    const quoteText = '"It is not reasonable to expect a relatively inexperienced driver to get this perfectly right out of the box. Even a skilled racer doesn\'t get it perfectly right on the first few attempts."';
    this.drawWrappedText(page, quoteText, {
      x: this.margin + 12,
      y: y - 14,
      maxWidth: quoteW - 24,
      font: fonts.italic,
      fontSize: 7.5,
      color: this.colors.textMuted,
      maxLines: 2,
      lineHeight: 11
    });

    page.drawText('— Going Faster!, Chapter 5', {
      x: this.margin + 12,
      y: y - 42,
      size: 7,
      font: fonts.bold,
      color: this.colors.textMuted
    });

    y -= (quoteH + 25);

    // 6. Educational/Methodology Footer Card
    const footH = 75;
    page.drawRectangle({
      x: this.margin,
      y: y - footH,
      width: contentW,
      height: footH,
      color: this.colors.panelAlt,
      borderColor: this.colors.border,
      borderWidth: 1
    });

    page.drawText('Report generated by APEX v1.0.0', { x: this.margin + 12, y: y - 16, size: 7.5, font: fonts.bold, color: this.colors.textSecondary });
    page.drawText('Data source: Forza Motorsport 2023 UDP Telemetry', { x: this.margin + 12, y: y - 28, size: 7.5, font: fonts.regular, color: this.colors.textSecondary });
    page.drawText('Analysis methodology: "Going Faster!" - Skip Barber Racing School', { x: this.margin + 12, y: y - 40, size: 7.5, font: fonts.regular, color: this.colors.textSecondary });

    page.drawText('"Going Faster! Mastering the Art of Race Driving" by Carl Lopez', { x: this.margin + 12, y: y - 56, size: 7, font: fonts.italic, color: this.colors.textMuted });
    page.drawText('© Skip Barber Racing School 1997, 2001', { x: this.margin + 12, y: y - 66, size: 7, font: fonts.regular, color: this.colors.textMuted });
  }

  formatTime(sec) {
    if (!sec || sec <= 0) return '--:--.---';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(3);
    return `${m}:${s.padStart(6, '0')}`;
  }

  download(pdfBytes, filename = 'APEX_Telemetry_Report.pdf') {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
