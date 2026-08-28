/**
 * APEX Motorsport Practice Stints - Actionable Light-Theme PDF Report Generator
 * Generates an analytical Skip Barber Performance Review & Action Plan
 * in a clean, high-contrast light theme with 3 structured diagnostic pillars:
 * 1. What You Nailed
 * 2. Needs Refinement
 * 3. Critical Attention Required
 */

import { StintDiagnostics } from './analysis/stint-diagnostics.js';

export class PdfReportGenerator {
  /**
   * Generates and triggers download of the Stint Coaching PDF report.
   * @param {Object} stintData - Stint definition from STINTS_DATABASE
   * @param {Object} [evalResult] - Precomputed StintDiagnostics result or liveStats object
   * @param {Array<Object>} [samples] - Telemetry samples buffer
   */
  static async generateStintReport(stintData, evalResult = null, samples = []) {
    try {
      // Strict Enforcement: DO NOT generate PDF if telemetry data is not received
      if (!samples || samples.length === 0) {
        if (!evalResult || !evalResult.hasTelemetry || (evalResult.telemetryKPIs && evalResult.telemetryKPIs.samplesCount === 0)) {
          alert('⚠️ Cannot generate PDF: No telemetry data was received from Forza Motorsport.\n\nPlease connect the APEX telemetry bridge and drive on track to record telemetry before generating a report.');
          return;
        }
      }

      if (!window.PDFLib) {
        console.error('PDFLib not loaded in window');
        alert('PDF Generation Library (pdf-lib) is not available.');
        return;
      }

      // If evalResult is not a complete diagnostic object, run StintDiagnostics
      const diagnosis = (evalResult && evalResult.hasTelemetry && evalResult.nailed)
        ? evalResult
        : StintDiagnostics.evaluate(stintData, samples, evalResult || {});

      if (!diagnosis || !diagnosis.hasTelemetry) {
        alert('⚠️ Cannot generate PDF: No telemetry data recorded for this stint.');
        return;
      }

      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // Standard A4 (595 x 842 pt)
      const { width, height } = page.getSize();

      const fontTitle = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontBody = await doc.embedFont(StandardFonts.Helvetica);
      const fontBodyBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontMono = await doc.embedFont(StandardFonts.CourierBold);

      // 1. Light Theme Page Background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: height,
        color: rgb(1, 1, 1) // Pure White
      });

      // 2. Top Crimson Accent Stripe
      page.drawRectangle({
        x: 0,
        y: height - 7,
        width: width,
        height: 7,
        color: rgb(0.88, 0.02, 0.0) // APEX Crimson Red
      });

      // 3. Header Branding
      page.drawText('APEX MOTORSPORT // SKIP BARBER RACECRAFT TELEMETRY DEBRIEF', {
        x: 40,
        y: height - 35,
        size: 8.5,
        font: fontMono,
        color: rgb(0.88, 0.02, 0.0)
      });

      // Document Title
      page.drawText('STINT PERFORMANCE & COACHING DEBRIEF', {
        x: 40,
        y: height - 58,
        size: 17,
        font: fontTitle,
        color: rgb(0.06, 0.09, 0.16) // Deep Dark Slate #0F172A
      });

      // Module & Discipline Subtitle
      page.drawText(`${diagnosis.tierName.toUpperCase()}  |  MODULE: ${diagnosis.stintName.toUpperCase()}`, {
        x: 40,
        y: height - 76,
        size: 10,
        font: fontBodyBold,
        color: rgb(0.3, 0.35, 0.45)
      });

      // Grade Stamp Box (Top Right)
      const gradeBoxWidth = 130;
      const gradeBoxHeight = 44;
      const gradeBoxX = width - 40 - gradeBoxWidth;
      const gradeBoxY = height - 76;

      page.drawRectangle({
        x: gradeBoxX,
        y: gradeBoxY,
        width: gradeBoxWidth,
        height: gradeBoxHeight,
        color: rgb(0.96, 0.98, 1.0),
        borderColor: rgb(0.2, 0.45, 0.85),
        borderWidth: 1.5
      });

      page.drawText('MASTERY GRADE', {
        x: gradeBoxX + 10,
        y: gradeBoxY + 30,
        size: 7.5,
        font: fontMono,
        color: rgb(0.3, 0.4, 0.6)
      });

      page.drawText(`${diagnosis.gradeScore}% • ${diagnosis.masteryLabel}`, {
        x: gradeBoxX + 10,
        y: gradeBoxY + 12,
        size: 8.5,
        font: fontTitle,
        color: diagnosis.targetAchieved ? rgb(0.05, 0.55, 0.25) : rgb(0.85, 0.45, 0.0)
      });

      // 4. Driver & Session Metadata Card
      const metaY = height - 142;
      page.drawRectangle({
        x: 40,
        y: metaY,
        width: width - 80,
        height: 52,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.88, 0.90, 0.93),
        borderWidth: 1
      });

      const driverName = (window.apexApp && window.apexApp.session && window.apexApp.session.settings && window.apexApp.session.settings.driverName) || 'APEX Driver';
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      page.drawText(`DRIVER: ${driverName.toUpperCase()}`, { x: 52, y: metaY + 34, size: 8.5, font: fontBodyBold, color: rgb(0.1, 0.15, 0.22) });
      page.drawText(`SESSION DATE: ${dateStr}`, { x: 52, y: metaY + 16, size: 8, font: fontBody, color: rgb(0.4, 0.45, 0.55) });

      page.drawText(`CAR: ${diagnosis.prescribedCar.toUpperCase()}`, { x: 215, y: metaY + 34, size: 8.5, font: fontBodyBold, color: rgb(0.1, 0.15, 0.22) });
      page.drawText(`CIRCUIT: ${diagnosis.prescribedTrack.toUpperCase()}`, { x: 215, y: metaY + 16, size: 8, font: fontBody, color: rgb(0.4, 0.45, 0.55) });

      page.drawText(`LAPS: ${diagnosis.telemetryKPIs.totalLaps} COMPLETED`, { x: 420, y: metaY + 34, size: 8.5, font: fontBodyBold, color: rgb(0.1, 0.15, 0.22) });
      page.drawText(`STATUS: ${diagnosis.targetAchieved ? 'TARGET COMPLETED' : 'PRACTICE LOGGED'}`, {
        x: 420,
        y: metaY + 16,
        size: 8,
        font: fontBodyBold,
        color: diagnosis.targetAchieved ? rgb(0.05, 0.55, 0.25) : rgb(0.85, 0.45, 0.0)
      });

      // 5. Telemetry & Target KPI Row
      let curY = metaY - 14;
      page.drawText('TELEMETRY PERFORMANCE SUMMARY', {
        x: 40,
        y: curY,
        size: 9.5,
        font: fontTitle,
        color: rgb(0.1, 0.15, 0.25)
      });
      curY -= 6;

      const kpiCardWidth = (width - 80 - 24) / 4;
      const kpis = [
        { label: 'PEAK VELOCITY', val: `${diagnosis.telemetryKPIs.peakSpeedMph} MPH`, sub: `${diagnosis.telemetryKPIs.peakSpeedKmh} KM/H` },
        { label: 'MAX LATERAL G', val: `${diagnosis.telemetryKPIs.peakLatG} G`, sub: 'Cornering Grip' },
        { label: 'MAX BRAKE DECEL', val: `${diagnosis.telemetryKPIs.peakLongG} G`, sub: 'Threshold Pitch' },
        { label: 'DISCIPLINE SCORE', val: `${diagnosis.gradeScore}%`, sub: diagnosis.primaryMetricLabel || 'Target Metric' }
      ];

      kpis.forEach((kpi, idx) => {
        const kX = 40 + idx * (kpiCardWidth + 8);
        page.drawRectangle({
          x: kX,
          y: curY - 42,
          width: kpiCardWidth,
          height: 42,
          color: rgb(0.97, 0.98, 0.99),
          borderColor: rgb(0.88, 0.90, 0.93),
          borderWidth: 1
        });

        page.drawText(kpi.label, { x: kX + 8, y: curY - 13, size: 7, font: fontMono, color: rgb(0.45, 0.5, 0.6) });
        page.drawText(kpi.val, { x: kX + 8, y: curY - 26, size: 10.5, font: fontTitle, color: rgb(0.08, 0.12, 0.2) });
        page.drawText(kpi.sub, { x: kX + 8, y: curY - 37, size: 6.5, font: fontBody, color: rgb(0.5, 0.55, 0.65) });
      });

      curY -= 56;

      // Helper function to draw a 3-Pillar Actionable Card
      const drawPillarCard = (title, items, theme) => {
        const cardWidth = width - 80;
        const itemSpacing = 16;
        const cardHeight = 24 + (items.length * itemSpacing);
        const cardY = curY - cardHeight;

        // Card Background
        page.drawRectangle({
          x: 40,
          y: cardY,
          width: cardWidth,
          height: cardHeight,
          color: theme.bgColor,
          borderColor: theme.borderColor,
          borderWidth: 1
        });

        // Left Colored Accent Line
        page.drawRectangle({
          x: 40,
          y: cardY,
          width: 4,
          height: cardHeight,
          color: theme.accentColor
        });

        // Card Header Title
        page.drawText(`${theme.icon} ${title.toUpperCase()}`, {
          x: 52,
          y: cardY + cardHeight - 16,
          size: 9,
          font: fontTitle,
          color: theme.titleColor
        });

        // Bullet Items
        items.forEach((itemText, i) => {
          const itemY = cardY + cardHeight - 32 - (i * itemSpacing);
          page.drawText('•', {
            x: 54,
            y: itemY,
            size: 9,
            font: fontBodyBold,
            color: theme.bulletColor
          });

          // Truncate cleanly if extra long
          let displayTxt = itemText;
          if (displayTxt.length > 95) {
            displayTxt = displayTxt.substring(0, 92) + '...';
          }

          page.drawText(displayTxt, {
            x: 64,
            y: itemY,
            size: 8.5,
            font: fontBody,
            color: theme.textColor
          });
        });

        curY = cardY - 12;
      };

      // 6. PILLAR 1: WHAT YOU NAILED (Green)
      drawPillarCard(
        'What You Nailed (Positive Reinforcement)',
        diagnosis.nailed,
        {
          icon: '[+] ',
          bgColor: rgb(0.95, 0.99, 0.96),
          borderColor: rgb(0.7, 0.9, 0.78),
          accentColor: rgb(0.1, 0.65, 0.35),
          titleColor: rgb(0.04, 0.42, 0.22),
          bulletColor: rgb(0.1, 0.65, 0.35),
          textColor: rgb(0.06, 0.3, 0.16)
        }
      );

      // 7. PILLAR 2: NEEDS REFINEMENT (Amber)
      drawPillarCard(
        'Needs Refinement (Technique Optimization)',
        diagnosis.refinement,
        {
          icon: '[~] ',
          bgColor: rgb(1.0, 0.98, 0.92),
          borderColor: rgb(0.95, 0.82, 0.55),
          accentColor: rgb(0.85, 0.55, 0.05),
          titleColor: rgb(0.55, 0.32, 0.02),
          bulletColor: rgb(0.85, 0.55, 0.05),
          textColor: rgb(0.42, 0.24, 0.02)
        }
      );

      // 8. PILLAR 3: CRITICAL ATTENTION REQUIRED (Red)
      drawPillarCard(
        'Critical Attention Required (Direct Correction)',
        diagnosis.attention,
        {
          icon: '[!] ',
          bgColor: rgb(0.99, 0.94, 0.94),
          borderColor: rgb(0.95, 0.75, 0.75),
          accentColor: rgb(0.85, 0.15, 0.15),
          titleColor: rgb(0.65, 0.1, 0.1),
          bulletColor: rgb(0.85, 0.15, 0.15),
          textColor: rgb(0.5, 0.08, 0.08)
        }
      );

      // 9. Skip Barber Principle & Next Steps Box
      const footerCardHeight = 65;
      const footerCardY = curY - footerCardHeight;

      page.drawRectangle({
        x: 40,
        y: footerCardY,
        width: width - 80,
        height: footerCardHeight,
        color: rgb(0.96, 0.97, 0.98),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1
      });

      page.drawText('SKIP BARBER RACECRAFT PRINCIPLE & NEXT STEPS', {
        x: 52,
        y: footerCardY + footerCardHeight - 14,
        size: 8.5,
        font: fontTitle,
        color: rgb(0.12, 0.18, 0.28)
      });

      const quoteClean = (diagnosis.quote || '').replace(/"/g, '');
      const quoteParts = quoteClean.split(' — ');
      let quoteMain = quoteParts[0] || '';
      if (quoteMain.length > 105) quoteMain = quoteMain.substring(0, 102) + '...';

      page.drawText(`"${quoteMain}"`, {
        x: 52,
        y: footerCardY + footerCardHeight - 28,
        size: 8,
        font: fontBody,
        color: rgb(0.25, 0.3, 0.4)
      });

      if (quoteParts[1]) {
        page.drawText(`— ${quoteParts[1]}`, {
          x: 52,
          y: footerCardY + footerCardHeight - 40,
          size: 7.5,
          font: fontMono,
          color: rgb(0.45, 0.5, 0.6)
        });
      }

      page.drawText(`NEXT ACTION: Advance to the subsequent module in ${diagnosis.tierName} or repeat with higher entry velocity.`, {
        x: 52,
        y: footerCardY + 12,
        size: 8,
        font: fontBodyBold,
        color: rgb(0.88, 0.02, 0.0)
      });

      // 10. Footer Bar
      page.drawText('APEX MOTORSPORT TELEMETRY ENGINE // FORZA MOTORSPORT TELEMETRY INTEGRATION', {
        x: 40,
        y: 22,
        size: 7.5,
        font: fontMono,
        color: rgb(0.55, 0.6, 0.7)
      });

      page.drawText(`REPORT ID: APEX-STINT-${diagnosis.stintId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`, {
        x: width - 230,
        y: 22,
        size: 7.5,
        font: fontMono,
        color: rgb(0.55, 0.6, 0.7)
      });

      // Trigger client-side PDF download
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `APEX_Stint_Debrief_${diagnosis.stintId}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return diagnosis;
    } catch (err) {
      console.error('[PDF GENERATOR] Error generating stint PDF:', err);
      alert('Failed to generate PDF coaching report: ' + err.message);
      throw err;
    }
  }
}
