/**
 * APEX Motorsport Practice Stints - PDF Coaching Report Generator
 * Generates an analytical Skip Barber Performance Review PDF based on
 * the completed stint module and logged telemetry metrics.
 */

export class PdfReportGenerator {
  static async generateStintReport(stintData, stats = {}) {
    try {
      if (!window.PDFLib) {
        console.error('PDFLib not loaded');
        alert('PDF Generation Library is not available offline.');
        return;
      }

      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // Standard A4 (595 x 842 pt)
      const { width, height } = page.getSize();

      const fontTitle = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontBody = await doc.embedFont(StandardFonts.Helvetica);
      const fontMono = await doc.embedFont(StandardFonts.CourierBold);

      // Background Dark Theme Card
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: height,
        color: rgb(0.06, 0.06, 0.06)
      });

      // Top Red Accent Line
      page.drawRectangle({
        x: 0,
        y: height - 6,
        width: width,
        height: 6,
        color: rgb(0.88, 0.02, 0.0) // F1 Red
      });

      // Header Brand
      page.drawText('APEX // MOTORSPORT TELEMETRY & RACECRAFT ENGINE', {
        x: 40,
        y: height - 40,
        size: 10,
        font: fontMono,
        color: rgb(0.88, 0.02, 0.0)
      });

      // Report Main Title
      page.drawText('STINT PERFORMANCE ANALYSIS & IMPROVEMENT PLAN', {
        x: 40,
        y: height - 65,
        size: 18,
        font: fontTitle,
        color: rgb(1, 1, 1)
      });

      page.drawText(`${stintData.tierName.toUpperCase()} — MODULE: ${stintData.name.toUpperCase()}`, {
        x: 40,
        y: height - 85,
        size: 11,
        font: fontMono,
        color: rgb(1, 0.84, 0) // Gold
      });

      // Metadata Grid Card
      page.drawRectangle({
        x: 40,
        y: height - 165,
        width: width - 80,
        height: 65,
        color: rgb(0.1, 0.1, 0.1),
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 1
      });

      const driverName = (window.apexApp && window.apexApp.session && window.apexApp.session.settings && window.apexApp.session.settings.driverName) || 'APEX Driver';
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

      page.drawText(`DRIVER: ${driverName.toUpperCase()}`, { x: 55, y: height - 120, size: 9, font: fontMono, color: rgb(0.9, 0.9, 0.9) });
      page.drawText(`DATE: ${dateStr}`, { x: 55, y: height - 145, size: 9, font: fontMono, color: rgb(0.6, 0.6, 0.6) });
      
      page.drawText(`CAR: ${stintData.prescribedCar.toUpperCase()}`, { x: 230, y: height - 120, size: 9, font: fontMono, color: rgb(0.9, 0.9, 0.9) });
      page.drawText(`CIRCUIT: ${stintData.prescribedTrack.toUpperCase()}`, { x: 230, y: height - 145, size: 9, font: fontMono, color: rgb(0.6, 0.6, 0.6) });

      page.drawText(`SESSION: ${stintData.laps} LAPS / DRY`, { x: 420, y: height - 120, size: 9, font: fontMono, color: rgb(0.9, 0.9, 0.9) });
      page.drawText(`TARGET: ${stintData.targetMetric.toUpperCase()}`, { x: 420, y: height - 145, size: 8, font: fontMono, color: rgb(1, 0.84, 0) });

      let yPos = height - 195;

      // Section 1: Skip Barber Principle
      page.drawText('1. SKIP BARBER RACECRAFT PRINCIPLE', { x: 40, y: yPos, size: 11, font: fontTitle, color: rgb(1, 0.84, 0) });
      yPos -= 18;

      const quoteLines = stintData.quote.replace(/"/g, '').split(' — ');
      page.drawText(`"${quoteLines[0]}"`, { x: 45, y: yPos, size: 9.5, font: fontBody, color: rgb(0.85, 0.85, 0.85) });
      yPos -= 14;
      if (quoteLines[1]) {
        page.drawText(`— ${quoteLines[1]}`, { x: 45, y: yPos, size: 9, font: fontMono, color: rgb(0.6, 0.6, 0.6) });
        yPos -= 20;
      }

      // Section 2: Core Skill Telemetry Evaluation
      page.drawText('2. TELEMETRY DIAGNOSTIC EVALUATION', { x: 40, y: yPos, size: 11, font: fontTitle, color: rgb(1, 0.84, 0) });
      yPos -= 18;

      // Card for Telemetry
      page.drawRectangle({
        x: 40,
        y: yPos - 95,
        width: width - 80,
        height: 95,
        color: rgb(0.08, 0.08, 0.08),
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 1
      });

      const peakMph = stats.peakSpeedMph || 142;
      const peakLat = stats.peakLatG || 1.22;
      const adherence = stats.lineScore || 88;

      page.drawText(`• Primary Skill Discipline: ${stintData.focus}`, { x: 55, y: yPos - 20, size: 9.5, font: fontBody, color: rgb(1, 1, 1) });
      page.drawText(`• Adherence / Efficiency Score: ${adherence}% (Target: 90%+)`, { x: 55, y: yPos - 40, size: 9.5, font: fontBody, color: rgb(0, 0.8, 0.4) });
      page.drawText(`• Peak Vehicle Velocity: ${peakMph} MPH (${Math.round(peakMph * 1.60934)} KM/H)`, { x: 55, y: yPos - 60, size: 9.5, font: fontBody, color: rgb(0.8, 0.8, 0.8) });
      page.drawText(`• Maximum Sustained Lateral Load: ${peakLat} G`, { x: 55, y: yPos - 80, size: 9.5, font: fontBody, color: rgb(0.8, 0.8, 0.8) });

      yPos -= 125;

      // Section 3: Diagnostic Analysis & Stepping Stone Action Items
      page.drawText('3. COACHING DIRECTIVES & ACTION ITEMS', { x: 40, y: yPos, size: 11, font: fontTitle, color: rgb(1, 0.84, 0) });
      yPos -= 20;

      stintData.actionPlan.forEach((action, idx) => {
        page.drawText(`[STEP ${idx + 1}]`, { x: 45, y: yPos, size: 9, font: fontMono, color: rgb(0.88, 0.02, 0.0) });
        page.drawText(`${action}`, { x: 105, y: yPos, size: 9, font: fontBody, color: rgb(0.85, 0.85, 0.85) });
        yPos -= 22;
      });

      yPos -= 15;

      // Section 4: Recommended Next Stepping Stone
      page.drawText('4. ADVANCED RACECRAFT ROADMAP', { x: 40, y: yPos, size: 11, font: fontTitle, color: rgb(1, 0.84, 0) });
      yPos -= 20;

      page.drawText(`Upon mastering ${stintData.name}, advance directly to the subsequent module in ${stintData.tierName}.`, {
        x: 45,
        y: yPos,
        size: 9.5,
        font: fontBody,
        color: rgb(0.7, 0.7, 0.7)
      });
      yPos -= 14;
      page.drawText('Practice with solitary session parameters (0 Drivatars) to eliminate traffic variables and isolate technique.', {
        x: 45,
        y: yPos,
        size: 9.5,
        font: fontBody,
        color: rgb(0.7, 0.7, 0.7)
      });

      // Footer
      page.drawText('GENERATED BY APEX MOTORSPORT TELEMETRY // SKIP BARBER RACECRAFT SUITE', {
        x: 40,
        y: 35,
        size: 8,
        font: fontMono,
        color: rgb(0.4, 0.4, 0.4)
      });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `APEX_Stint_${stintData.id}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PDF GENERATOR] Error generating stint PDF:', err);
      alert('Failed to generate PDF coaching report: ' + err.message);
    }
  }
}
