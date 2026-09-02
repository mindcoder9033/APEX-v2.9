/**
 * APEX Lap Analyzer PDF Report Generator
 * Compiles an official high-contrast motorsport debrief document using client-side pdf-lib.
 * Includes session context, embedded high-res 2D track map snapshot,
 * summary metrics (Best Lap, Progression, Inconsistent Corner, Braking Consistency %),
 * and a comprehensive corner-by-corner landmark telemetry table.
 */

export class LapAnalyzerPdfGenerator {
  /**
   * Generates and downloads the official Lap Analyzer PDF report
   * @param {Object} options
   * @param {Object} options.sessionMetadata Driver, car, track, date
   * @param {Object} options.summary Session summary metrics from LapAnalyzerMetrics
   * @param {Object} options.primaryLap Selected primary lap object
   * @param {string} options.mapImageDataUrl High-res PNG data URL of track map
   */
  static async generateReport({ sessionMetadata = {}, summary = {}, primaryLap = null, mapImageDataUrl = null }) {
    if (!window.PDFLib) {
      alert('PDF generation library (pdf-lib) is not loaded.');
      return;
    }

    try {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // A4 (595 x 842 pt)
      const { width, height } = page.getSize();

      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
      const fontMono = await doc.embedFont(StandardFonts.CourierBold);

      // 1. Page Background (Pure White)
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(0.98, 0.98, 0.99)
      });

      // 2. Top Red Crimson Motorsport Accent Header
      page.drawRectangle({
        x: 0,
        y: height - 8,
        width,
        height: 8,
        color: rgb(0.88, 0.02, 0.0)
      });

      // 3. Header Branding & Context
      page.drawText('APEX // MOTORSPORT PIT-WALL TELEMETRY', {
        x: 40,
        y: height - 32,
        size: 9,
        font: fontMono,
        color: rgb(0.88, 0.02, 0.0)
      });

      page.drawText('LAP ANALYZER // SELF-DISCOVERY TELEMETRY DEBRIEF', {
        x: 40,
        y: height - 54,
        size: 16,
        font: fontBold,
        color: rgb(0.08, 0.10, 0.14)
      });

      // Session Subtitle Line
      const driver = sessionMetadata.driverName || 'APEX Driver';
      const track = sessionMetadata.trackName || 'Circuit Track Day';
      const car = sessionMetadata.carName || 'Track Vehicle';
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

      page.drawText(`TRACK: ${track.toUpperCase()}  |  CAR: ${car.toUpperCase()}  |  DRIVER: ${driver.toUpperCase()}  |  ${dateStr}`, {
        x: 40,
        y: height - 72,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.40, 0.44, 0.52)
      });

      // Divider Line
      page.drawLine({
        start: { x: 40, y: height - 82 },
        end: { x: width - 40, y: height - 82 },
        thickness: 1,
        color: rgb(0.86, 0.88, 0.92)
      });

      // 4. Session Summary Metrics KPI Cards
      const cardY = height - 142;
      const cardH = 50;
      const cardW = (width - 80 - 24) / 4;

      const kpis = [
        {
          label: 'BEST LAP',
          value: this.formatLapTime(summary.bestLapTime || (primaryLap ? primaryLap.lapTime : 0)),
          sub: `Lap ${primaryLap ? primaryLap.lapNumber : 1}`
        },
        {
          label: 'PROGRESSION',
          value: summary.improvementSec > 0 ? `-${summary.improvementSec}s` : '±0.00s',
          sub: summary.firstLapTime ? `${this.formatLapTime(summary.firstLapTime)} → Best` : 'Single Lap'
        },
        {
          label: 'MOST INCONSISTENT',
          value: summary.mostInconsistentCorner ? summary.mostInconsistentCorner.label : 'None',
          sub: summary.mostInconsistentCorner ? `±${summary.mostInconsistentCorner.timeVariationSec}s delta` : 'Consistent'
        },
        {
          label: 'BRAKING CONSISTENCY',
          value: `${summary.brakingConsistencyScore || 85}%`,
          sub: 'Threshold Accuracy'
        }
      ];

      kpis.forEach((kpi, idx) => {
        const cx = 40 + idx * (cardW + 8);
        // Card background
        page.drawRectangle({
          x: cx,
          y: cardY,
          width: cardW,
          height: cardH,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 1
        });

        // Left accent bar
        page.drawRectangle({
          x: cx,
          y: cardY,
          width: 3,
          height: cardH,
          color: idx === 0 ? rgb(0.88, 0.02, 0.0) : rgb(0.12, 0.50, 0.95)
        });

        page.drawText(kpi.label, {
          x: cx + 10,
          y: cardY + 36,
          size: 7.5,
          font: fontBold,
          color: rgb(0.45, 0.50, 0.58)
        });

        page.drawText(kpi.value, {
          x: cx + 10,
          y: cardY + 20,
          size: 13,
          font: fontBold,
          color: rgb(0.08, 0.10, 0.14)
        });

        page.drawText(kpi.sub, {
          x: cx + 10,
          y: cardY + 8,
          size: 7,
          font: fontRegular,
          color: rgb(0.55, 0.58, 0.65)
        });
      });

      // 5. Embedded 2D Track Map Snapshot
      let currentY = cardY - 18;
      if (mapImageDataUrl) {
        try {
          const mapImgBytes = await fetch(mapImageDataUrl).then(res => res.arrayBuffer());
          const embeddedMap = await doc.embedPng(mapImgBytes);

          const mapDisplayW = width - 80;
          const mapDisplayH = 260;

          // Map card frame
          page.drawRectangle({
            x: 40,
            y: currentY - mapDisplayH,
            width: mapDisplayW,
            height: mapDisplayH,
            color: rgb(0.04, 0.05, 0.07),
            borderColor: rgb(0.80, 0.82, 0.86),
            borderWidth: 1
          });

          page.drawImage(embeddedMap, {
            x: 40,
            y: currentY - mapDisplayH,
            width: mapDisplayW,
            height: mapDisplayH
          });

          currentY -= (mapDisplayH + 16);
        } catch (imgErr) {
          console.warn('[PDF] Failed to embed track map image:', imgErr);
        }
      }

      // 6. Corner Landmarks & Speed Progression Table
      page.drawText('CORNER DATA & EXIT SPEED BREAKDOWN', {
        x: 40,
        y: currentY,
        size: 10,
        font: fontBold,
        color: rgb(0.08, 0.10, 0.14)
      });
      currentY -= 14;

      // Table Header
      const colX = [40, 95, 175, 255, 345, 435, 515];
      const tableHeaders = ['TURN', 'ENTRY SPD', 'APEX SPD', 'EXIT SPEED & GEAR', 'BRAKE DIST', 'DURATION', 'GAP'];

      page.drawRectangle({
        x: 40,
        y: currentY - 16,
        width: width - 80,
        height: 18,
        color: rgb(0.92, 0.94, 0.96)
      });

      tableHeaders.forEach((h, i) => {
        page.drawText(h, {
          x: colX[i] + 4,
          y: currentY - 12,
          size: 7.5,
          font: fontBold,
          color: rgb(0.30, 0.35, 0.42)
        });
      });
      currentY -= 20;

      // Table Rows
      const corners = primaryLap ? (primaryLap.corners || []) : [];
      const rowCount = Math.min(corners.length, 14); // Fit neatly on A4

      for (let i = 0; i < rowCount; i++) {
        const c = corners[i];
        const isEven = i % 2 === 0;

        if (isEven) {
          page.drawRectangle({
            x: 40,
            y: currentY - 14,
            width: width - 80,
            height: 16,
            color: rgb(0.97, 0.98, 0.99)
          });
        }

        const rowData = [
          `Turn ${c.turnNumber}`,
          `${Math.round(c.entrySpeedKmh)} km/h`,
          `${Math.round(c.apexSpeedKmh)} km/h`,
          `${Math.round(c.exitSpeedKmh)} km/h (${c.exitGear})`,
          `${Math.round(c.brakingDistanceM)}m`,
          `${c.durationSec.toFixed(2)}s`,
          'REF'
        ];

        rowData.forEach((val, colIdx) => {
          page.drawText(val, {
            x: colX[colIdx] + 4,
            y: currentY - 10,
            size: 8,
            font: colIdx === 0 ? fontBold : fontRegular,
            color: colIdx === 3 ? rgb(0.88, 0.02, 0.0) : rgb(0.12, 0.15, 0.20)
          });
        });

        currentY -= 17;
      }

      // 7. Footer
      page.drawLine({
        start: { x: 40, y: 35 },
        end: { x: width - 40, y: 35 },
        thickness: 0.8,
        color: rgb(0.85, 0.88, 0.92)
      });

      page.drawText('APEX MOTORSPORT TELEMETRY // SELF-DISCOVERY MODE (NO COACHING BIAS)', {
        x: 40,
        y: 22,
        size: 7,
        font: fontRegular,
        color: rgb(0.50, 0.55, 0.62)
      });

      page.drawText(`GENERATED: ${new Date().toISOString()}`, {
        x: width - 180,
        y: 22,
        size: 7,
        font: fontMono,
        color: rgb(0.50, 0.55, 0.62)
      });

      // Save & Download
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTrack = (track || 'Session').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `APEX_Lap_Analyzer_${safeTrack}_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PDF] Error generating Lap Analyzer PDF:', err);
      alert(`Error generating PDF report: ${err.message}`);
    }
  }

  static formatLapTime(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}
