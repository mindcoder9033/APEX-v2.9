/**
 * APEX 3D Track Map & Spatial Racecraft PDF Builder
 * Generates an executive 2-page publication-grade PDF debrief using pdf-lib:
 * - Page 1: 3D Isometric Trajectory Visualization & Circuit Elevation Profile
 * - Page 2: Going Faster! Chapter 2 Corner Dynamics & Three Radii Benchmark Debrief
 */

const getPdfLib = async () => {
  if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
  if (typeof globalThis !== 'undefined' && globalThis.PDFLib) return globalThis.PDFLib;
  try {
    const n = await import('pdf-lib');
    return n;
  } catch {
    throw new Error('pdf-lib not available');
  }
};

export class TrackMap3DPdfBuilder {
  constructor() {
    this.width = 595.28;  // A4 Width in points
    this.height = 841.89; // A4 Height in points
    this.margin = 36;
  }

  /**
   * Generates a 2-page 3D Spatial Racecraft PDF report
   * @param {Object} options
   * @param {string} options.mapImageBase64 High-res PNG data URL of the 3D map
   * @param {Array<Object>} options.corners3D Analyzed 3D corners array
   * @param {Object} options.sessionData Session & vehicle metadata
   * @param {Object} options.trackProfile Track profile metadata
   * @returns {Promise<Uint8Array>}
   */
  async generate({ mapImageBase64, corners3D = [], sessionData = {}, trackProfile = {} }) {
    const PDFLib = await getPdfLib();
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const doc = await PDFDocument.create();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontMono = await doc.embedFont(StandardFonts.CourierBold);

    // Dark Motorsport Palette
    const C = {
      bg: rgb(0.04, 0.05, 0.08),          // #0A0D14
      panelDark: rgb(0.08, 0.10, 0.15),   // #141A26
      panelMid: rgb(0.12, 0.15, 0.22),    // #1F2638
      border: rgb(0.20, 0.25, 0.35),      // #334059
      f1Red: rgb(0.882, 0.024, 0.0),      // #E10600
      cyan: rgb(0.0, 0.94, 1.0),          // #00F0FF
      gold: rgb(1.0, 0.80, 0.0),          // #FFCC00
      green: rgb(0.0, 0.80, 0.40),        // #00CC66
      purple: rgb(0.60, 0.0, 1.0),        // #9900FF
      textPrimary: rgb(0.95, 0.96, 0.98), // #F2F5FA
      textSecondary: rgb(0.65, 0.70, 0.80),
      textMuted: rgb(0.40, 0.45, 0.55),
      white: rgb(1.0, 1.0, 1.0)
    };

    // Embed High-Res 3D Map Image if provided
    let embeddedMapImage = null;
    if (mapImageBase64) {
      try {
        const cleanBase64 = mapImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const imageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        embeddedMapImage = await doc.embedPng(imageBytes);
      } catch (err) {
        console.warn('TrackMap3DPdfBuilder: Failed to embed 3D map image', err);
      }
    }

    // =========================================================================
    // PAGE 1: 3D SPATIAL TRAJECTORY & ELEVATION OVERVIEW
    // =========================================================================
    const page1 = doc.addPage([this.width, this.height]);
    let y = this.height - this.margin;

    // Background fill
    page1.drawRectangle({
      x: 0, y: 0, width: this.width, height: this.height, color: C.bg
    });

    // Top Header Banner
    page1.drawRectangle({
      x: this.margin, y: y - 56, width: this.width - this.margin * 2, height: 56,
      color: C.panelDark, borderColor: C.f1Red, borderWidth: 1
    });

    // F1 Red Left Accent Tab
    page1.drawRectangle({
      x: this.margin, y: y - 56, width: 4, height: 56, color: C.f1Red
    });

    page1.drawText('APEX // 3D SPATIAL RACECRAFT & ELEVATION REPORT', {
      x: this.margin + 16, y: y - 20, size: 14, font: fontBold, color: C.textPrimary
    });

    const trackName = trackProfile.trackName || sessionData.trackName || 'Circuit Overview';
    const subTitle = `CIRCUIT: ${trackName.toUpperCase()} · METRIC SI TELEMETRY`;
    page1.drawText(subTitle, {
      x: this.margin + 16, y: y - 36, size: 9, font: fontMono, color: C.cyan
    });

    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    page1.drawText(dateStr, {
      x: this.width - this.margin - 90, y: y - 20, size: 9, font: fontMono, color: C.textSecondary
    });

    y -= 70;

    // 3D Map Viewport Frame
    const mapW = this.width - this.margin * 2;
    const mapH = 340;

    page1.drawRectangle({
      x: this.margin, y: y - mapH, width: mapW, height: mapH,
      color: C.panelDark, borderColor: C.border, borderWidth: 1
    });

    if (embeddedMapImage) {
      page1.drawImage(embeddedMapImage, {
        x: this.margin + 2, y: y - mapH + 2, width: mapW - 4, height: mapH - 4
      });
    } else {
      page1.drawText('[ 3D ISOMETRIC TRACK TRAJECTORY RENDER ]', {
        x: this.margin + mapW / 2 - 120, y: y - mapH / 2, size: 11, font: fontMono, color: C.textMuted
      });
    }

    // Viewport Overlay Badge
    page1.drawRectangle({
      x: this.margin + 10, y: y - 26, width: 140, height: 18, color: rgb(0.04, 0.05, 0.08)
    });
    page1.drawText('2.5D ISOMETRIC ELEVATION', {
      x: this.margin + 14, y: y - 22, size: 8, font: fontMono, color: C.gold
    });

    y -= (mapH + 16);

    // Key Stat Metric Cards Grid
    const cardW = (mapW - 18) / 4;
    const cardH = 50;

    const stats = [
      { label: 'TRACK DISTANCE', val: `${Math.round(trackProfile.trackLengthM || sessionData.lapDistanceM || 4100)} m`, color: C.cyan },
      { label: 'ELEVATION RANGE', val: `+/- ${Math.round(trackProfile.elevationDeltaM || 28.5)} m`, color: C.gold },
      { label: 'IDENTIFIED TURNS', val: `${corners3D.length || trackProfile.cornersCount || 12}`, color: C.green },
      { label: 'MAX LATERAL GRIP', val: `${(sessionData.maxG || 1.25).toFixed(2)} G`, color: C.f1Red }
    ];

    stats.forEach((st, idx) => {
      const cx = this.margin + idx * (cardW + 6);
      page1.drawRectangle({
        x: cx, y: y - cardH, width: cardW, height: cardH,
        color: C.panelDark, borderColor: C.border, borderWidth: 1
      });
      page1.drawText(st.label, {
        x: cx + 8, y: y - 16, size: 7, font: fontMono, color: C.textMuted
      });
      page1.drawText(st.val, {
        x: cx + 8, y: y - 38, size: 14, font: fontBold, color: st.color
      });
    });

    y -= (cardH + 16);

    // 7-Phase Telemetry Legend Box
    page1.drawRectangle({
      x: this.margin, y: y - 64, width: mapW, height: 64,
      color: C.panelDark, borderColor: C.border, borderWidth: 1
    });

    page1.drawText('3D TELEMETRY RIBBON COLOR MAPPING & DRIVING PHASES', {
      x: this.margin + 10, y: y - 16, size: 8, font: fontBold, color: C.textPrimary
    });

    const phases = [
      { name: '100% Throttle', col: C.green },
      { name: 'Threshold Brake', col: C.f1Red },
      { name: 'Trail-Brake', col: C.purple },
      { name: 'Coast / Balance', col: C.cyan },
      { name: 'Apex Min Speed', col: C.gold },
      { name: 'Power Exit', col: rgb(0.0, 0.8, 0.4) }
    ];

    phases.forEach((ph, i) => {
      const px = this.margin + 10 + i * 85;
      page1.drawRectangle({
        x: px, y: y - 46, width: 8, height: 8, color: ph.col
      });
      page1.drawText(ph.name, {
        x: px + 12, y: y - 45, size: 7, font: fontRegular, color: C.textSecondary
      });
    });

    // Page 1 Footer
    page1.drawText('PAGE 1 OF 2 // APEX MOTORSPORT COMMAND CENTER', {
      x: this.margin, y: 20, size: 8, font: fontMono, color: C.textMuted
    });

    // =========================================================================
    // PAGE 2: CHAPTER 2 RACECRAFT & CORNER DYNAMICS DEBRIEF
    // =========================================================================
    const page2 = doc.addPage([this.width, this.height]);
    let y2 = this.height - this.margin;

    page2.drawRectangle({
      x: 0, y: 0, width: this.width, height: this.height, color: C.bg
    });

    // Page 2 Header
    page2.drawRectangle({
      x: this.margin, y: y2 - 44, width: this.width - this.margin * 2, height: 44,
      color: C.panelDark, borderColor: C.border, borderWidth: 1
    });

    page2.drawRectangle({
      x: this.margin, y: y2 - 44, width: 4, height: 44, color: C.cyan
    });

    page2.drawText('GOING FASTER! CHAPTER 2: CORNER DYNAMICS & THREE RADII DEBRIEF', {
      x: this.margin + 14, y: y2 - 18, size: 11, font: fontBold, color: C.textPrimary
    });
    page2.drawText('PHYSICS GOVERNING EQUATION: v (km/h) = sqrt(127.14 * G * R_meters)', {
      x: this.margin + 14, y: y2 - 32, size: 8, font: fontMono, color: C.gold
    });

    y2 -= 58;

    // Corner Diagnostics Table
    const tableW = this.width - this.margin * 2;
    const cols = [
      { name: 'TURN', w: 42 },
      { name: 'DIR', w: 32 },
      { name: 'RADIUS', w: 55 },
      { name: 'ENTRY (ACT/TGT)', w: 90 },
      { name: 'GEAR', w: 38 },
      { name: 'APEX TYPE', w: 75 },
      { name: 'DELTA', w: 48 },
      { name: 'EXIT SPD', w: 65 },
      { name: 'TAP (PRE-APEX)', w: 75 }
    ];

    // Table Header
    page2.drawRectangle({
      x: this.margin, y: y2 - 20, width: tableW, height: 20, color: C.panelMid
    });

    let curX = this.margin + 6;
    cols.forEach(col => {
      page2.drawText(col.name, {
        x: curX, y: y2 - 14, size: 7, font: fontBold, color: C.textPrimary
      });
      curX += col.w;
    });

    y2 -= 20;

    // Table Rows (Display up to 14 corners)
    const displayCorners = corners3D.slice(0, 14);
    const rowH = 22;

    displayCorners.forEach((c, idx) => {
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        page2.drawRectangle({
          x: this.margin, y: y2 - rowH, width: tableW, height: rowH, color: rgb(0.06, 0.08, 0.12)
        });
      }

      let rowX = this.margin + 6;

      // Turn #
      page2.drawText(`T${c.cornerNumber}`, { x: rowX, y: y2 - 15, size: 8, font: fontBold, color: C.textPrimary });
      rowX += cols[0].w;

      // Dir
      page2.drawText(c.direction || 'R', { x: rowX, y: y2 - 15, size: 8, font: fontRegular, color: C.textSecondary });
      rowX += cols[1].w;

      // Radius (m)
      page2.drawText(`${c.radiusMeters} m`, { x: rowX, y: y2 - 15, size: 8, font: fontMono, color: C.cyan });
      rowX += cols[2].w;

      // Entry Speed
      const entryText = `${c.entry.actualSpeedKmh}/${c.entry.targetSpeedKmh}k`;
      page2.drawText(entryText, { x: rowX, y: y2 - 15, size: 8, font: fontMono, color: C.textPrimary });
      rowX += cols[3].w;

      // Gear
      page2.drawText(`G${c.entry.actualGear || c.entry.recommendedGear}`, { x: rowX, y: y2 - 15, size: 8, font: fontMono, color: C.gold });
      rowX += cols[4].w;

      // Apex Type
      const apexCol = c.actualApex.classification === 'LATE' ? C.gold : (c.actualApex.classification === 'EARLY' ? C.f1Red : C.green);
      page2.drawText(c.actualApex.classification || 'GEOMETRIC', { x: rowX, y: y2 - 15, size: 7, font: fontBold, color: apexCol });
      rowX += cols[5].w;

      // Delta (m)
      const deltaText = `${c.actualApex.lateApexDeltaMeters > 0 ? '+' : ''}${c.actualApex.lateApexDeltaMeters}m`;
      page2.drawText(deltaText, { x: rowX, y: y2 - 15, size: 8, font: fontMono, color: apexCol });
      rowX += cols[6].w;

      // Exit Speed
      page2.drawText(`${c.exit.actualSpeedKmh} km/h`, { x: rowX, y: y2 - 15, size: 8, font: fontMono, color: C.green });
      rowX += cols[7].w;

      // TAP
      page2.drawText(`${c.exit.tapDistBeforeApexMeters || 0} m`, { x: rowX, y: y2 - 15, size: 8, font: fontMono, color: C.textSecondary });

      y2 -= rowH;
    });

    y2 -= 16;

    // Three Radii Benchmark Box (Chapter 2 Theory)
    page2.drawRectangle({
      x: this.margin, y: y2 - 90, width: tableW, height: 90,
      color: C.panelDark, borderColor: C.border, borderWidth: 1
    });

    page2.drawText('SKIP BARBER THREE RADII COMPARISON (SEBRING TURN 7 STANDARD)', {
      x: this.margin + 12, y: y2 - 18, size: 8, font: fontBold, color: C.gold
    });

    page2.drawText('• R1 (Inside Arc - 31.4m): Theoretical limit 63.2 km/h (Hugging curb; worst line)', {
      x: this.margin + 12, y: y2 - 36, size: 8, font: fontRegular, color: C.textSecondary
    });
    page2.drawText('• R2 (Middle Arc - 45.7m): Theoretical limit 76.3 km/h (+13.1 km/h / +20.7% gain)', {
      x: this.margin + 12, y: y2 - 50, size: 8, font: fontRegular, color: C.textSecondary
    });
    page2.drawText('• R3 (Racing Line - 59.4m): Theoretical limit 86.9 km/h (+23.7 km/h / +37.5% gain over inside curb)', {
      x: this.margin + 12, y: y2 - 64, size: 8, font: fontBold, color: C.green
    });
    page2.drawText('Racing line maximizes radius across track width, providing massive compound straightaway speed.', {
      x: this.margin + 12, y: y2 - 78, size: 7, font: fontMono, color: C.cyan
    });

    y2 -= 104;

    // Automated Coaching Summary Box
    page2.drawRectangle({
      x: this.margin, y: y2 - 64, width: tableW, height: 64,
      color: C.panelDark, borderColor: C.f1Red, borderWidth: 1
    });

    page2.drawText('AUTOMATED RACECRAFT COACHING SUMMARY', {
      x: this.margin + 12, y: y2 - 16, size: 8, font: fontBold, color: C.f1Red
    });

    const earlyApexCount = corners3D.filter(c => c.actualApex?.classification === 'EARLY').length;
    const lateApexCount = corners3D.filter(c => c.actualApex?.classification === 'LATE').length;
    const coachMsg1 = `• Late Apexes Achieved: ${lateApexCount} corners | Early Apex Mistakes: ${earlyApexCount} corners.`;
    const coachMsg2 = earlyApexCount > 0
      ? '• Notice: Early apexes reduce available exit radius. Focus on delaying turn-in and trail-braking deeper.'
      : '• Outstanding line discipline! Late apex execution maximizes throttle application before track-out.';

    page2.drawText(coachMsg1, { x: this.margin + 12, y: y2 - 34, size: 8, font: fontRegular, color: C.textPrimary });
    page2.drawText(coachMsg2, { x: this.margin + 12, y: y2 - 48, size: 8, font: fontRegular, color: C.textSecondary });

    // Page 2 Footer
    page2.drawText('PAGE 2 OF 2 // APEX MOTORSPORT COMMAND CENTER', {
      x: this.margin, y: 20, size: 8, font: fontMono, color: C.textMuted
    });

    return await doc.save();
  }
}
