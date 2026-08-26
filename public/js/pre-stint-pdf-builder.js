/**
 * APEX Pre-Stint Driver Briefing PDF Builder
 * Generates an executive 2-page circuit preparation dossier using pdf-lib.
 * Page 1: Vector Track Map with numbered turns, braking zones, and hazard alerts.
 * Page 2: Turn-by-Turn Telemetry Cheat Sheet, gear targets, apex speeds, and setup notes.
 */

const getPdfLib = () => {
  if (typeof window !== 'undefined' && window.PDFLib) {
    return window.PDFLib;
  }
  return null;
};

export class PreStintPdfBuilder {
  constructor() {
    this.width = 595.28;  // A4 Width in points
    this.height = 841.89; // A4 Height in points
    this.margin = 36;     // 0.5 inch margins
  }

  /**
   * Generates a 2-page PDF document bytes from a Track Profile
   * @param {Object} trackProfile 
   * @returns {Promise<Uint8Array>}
   */
  async generate(trackProfile) {
    if (!trackProfile) {
      throw new Error('PreStintPdfBuilder: No trackProfile provided');
    }

    let PDFLib = getPdfLib();
    if (!PDFLib && typeof globalThis !== 'undefined' && globalThis.PDFLib) {
      PDFLib = globalThis.PDFLib;
    }

    // In Node.js environment fallback
    if (!PDFLib) {
      try {
        const nodePdfLib = await import('pdf-lib');
        PDFLib = nodePdfLib;
      } catch (err) {
        throw new Error('pdf-lib library not loaded in environment');
      }
    }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontMono = await doc.embedFont(StandardFonts.CourierBold);

    // Color definitions
    const colors = {
      bg: rgb(0.05, 0.05, 0.06),             // Deep Charcoal #0D0D0F
      panel: rgb(0.09, 0.10, 0.12),          // Slate Panel #171A1F
      panelAlt: rgb(0.12, 0.14, 0.16),       // Lighter Slate #1F2429
      border: rgb(0.20, 0.22, 0.26),         // Subtle Border #333842
      f1Red: rgb(0.882, 0.024, 0.0),          // APEX F1 Red #E10600
      cyan: rgb(0.0, 0.85, 0.95),             // Accent Cyan #00D8F4
      gold: rgb(1.0, 0.80, 0.0),              // Accent Gold #FFCC00
      green: rgb(0.0, 0.85, 0.40),            // Full Throttle #00D966
      textPrimary: rgb(0.96, 0.97, 0.98),    // Crisp White #F5F7FA
      textSecondary: rgb(0.65, 0.70, 0.76),  // Muted Slate #A6B2C2
      textMuted: rgb(0.45, 0.50, 0.56),      // Dim Slate #73808F
      white: rgb(1.0, 1.0, 1.0)
    };

    // Helper: format lap time
    const formatLapTime = (sec) => {
      if (!sec || isNaN(sec)) return '--:--.---';
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(3);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // =========================================================================
    // PAGE 1: CIRCUIT INTELLIGENCE & VECTOR TRACK MAP
    // =========================================================================
    const page1 = doc.addPage([this.width, this.height]);

    // Background
    page1.drawRectangle({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      color: colors.bg
    });

    // Top Header Banner
    page1.drawRectangle({
      x: this.margin,
      y: this.height - 75,
      width: this.width - (this.margin * 2),
      height: 48,
      color: colors.panel,
      borderColor: colors.border,
      borderWidth: 1
    });

    // Brand accent line
    page1.drawRectangle({
      x: this.margin,
      y: this.height - 75,
      width: 4,
      height: 48,
      color: colors.f1Red
    });

    page1.drawText('APEX // PRE-STINT DRIVER BRIEFING', {
      x: this.margin + 16,
      y: this.height - 52,
      size: 13,
      font: fontBold,
      color: colors.textPrimary
    });

    page1.drawText('CIRCUIT INTELLIGENCE & TACTICAL TRACK DOSSIER', {
      x: this.margin + 16,
      y: this.height - 66,
      size: 8,
      font: fontMono,
      color: colors.cyan
    });

    const dateStr = new Date().toISOString().split('T')[0];
    page1.drawText(`DATE: ${dateStr}`, {
      x: this.width - this.margin - 110,
      y: this.height - 52,
      size: 8,
      font: fontMono,
      color: colors.textSecondary
    });

    page1.drawText(`STATUS: VERIFIED`, {
      x: this.width - this.margin - 110,
      y: this.height - 66,
      size: 8,
      font: fontMono,
      color: colors.green
    });

    // Circuit Title Block
    let curY = this.height - 95;
    page1.drawText((trackProfile.trackName || 'CIRCUIT').toUpperCase(), {
      x: this.margin,
      y: curY,
      size: 18,
      font: fontBold,
      color: colors.textPrimary
    });

    curY -= 16;
    const subTitle = `${trackProfile.layoutName || 'Grand Prix Course'} | ${trackProfile.officialLength || '4.500 km'} | ${trackProfile.trackType || 'Real'} Circuit`;
    page1.drawText(subTitle, {
      x: this.margin,
      y: curY,
      size: 10,
      font: fontRegular,
      color: colors.textSecondary
    });

    // KPI Metrics Bar (4 Stats Cards)
    curY -= 55;
    const cardW = (this.width - (this.margin * 2) - 18) / 4;
    const stats = [
      { label: 'PERSONAL BENCHMARK', val: formatLapTime(trackProfile.bestLapTime), color: colors.gold },
      { label: 'TOTAL CORNERS', val: `${trackProfile.corners?.length || trackProfile.cornersCount || 0} TURNS`, color: colors.cyan },
      { label: 'CIRCUIT LENGTH', val: `${trackProfile.officialLength || '4.500 km'}`, color: colors.textPrimary },
      { label: 'REFERENCE CAR', val: `${(trackProfile.carName || 'GT3').slice(0, 14)}`, color: colors.textSecondary }
    ];

    stats.forEach((s, idx) => {
      const cardX = this.margin + (idx * (cardW + 6));
      page1.drawRectangle({
        x: cardX,
        y: curY,
        width: cardW,
        height: 44,
        color: colors.panel,
        borderColor: colors.border,
        borderWidth: 1
      });

      page1.drawText(s.label, {
        x: cardX + 8,
        y: curY + 28,
        size: 6.5,
        font: fontMono,
        color: colors.textMuted
      });

      page1.drawText(s.val, {
        x: cardX + 8,
        y: curY + 10,
        size: 10,
        font: fontBold,
        color: s.color
      });
    });

    // Vector Track Map Canvas Area
    curY -= 18;
    const mapAreaH = 340;
    const mapAreaY = curY - mapAreaH;
    const mapAreaW = this.width - (this.margin * 2);

    page1.drawRectangle({
      x: this.margin,
      y: mapAreaY,
      width: mapAreaW,
      height: mapAreaH,
      color: rgb(0.07, 0.07, 0.08),
      borderColor: colors.border,
      borderWidth: 1
    });

    // Map Legend in top-left of canvas
    page1.drawText('DRIVING STATES: ', {
      x: this.margin + 12,
      y: curY - 18,
      size: 7,
      font: fontMono,
      color: colors.textMuted
    });
    
    // Legend indicators
    const legX = this.margin + 90;
    page1.drawRectangle({ x: legX, y: curY - 19, width: 8, height: 8, color: colors.green });
    page1.drawText('Full Throttle', { x: legX + 12, y: curY - 18, size: 7, font: fontRegular, color: colors.textSecondary });

    page1.drawRectangle({ x: legX + 75, y: curY - 19, width: 8, height: 8, color: colors.f1Red });
    page1.drawText('Braking', { x: legX + 87, y: curY - 18, size: 7, font: fontRegular, color: colors.textSecondary });

    page1.drawRectangle({ x: legX + 135, y: curY - 19, width: 8, height: 8, color: colors.cyan });
    page1.drawText('Coasting / Apex', { x: legX + 147, y: curY - 18, size: 7, font: fontRegular, color: colors.textSecondary });

    // Draw Vector Track Path Points
    const points = trackProfile.vectorMap?.points || [];
    if (points.length > 2) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }

      const rangeX = (maxX - minX) || 1;
      const rangeZ = (maxZ - minZ) || 1;
      const pad = 35;
      const usableW = mapAreaW - (pad * 2);
      const usableH = mapAreaH - (pad * 2) - 20;
      const scale = Math.min(usableW / rangeX, usableH / rangeZ);

      const offsetX = this.margin + pad + (usableW - (rangeX * scale)) / 2;
      const offsetY = mapAreaY + pad + (usableH - (rangeZ * scale)) / 2;

      // Draw Path Segments
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];

        const x1 = offsetX + (p1.x - minX) * scale;
        const y1 = offsetY + (p1.z - minZ) * scale;
        const x2 = offsetX + (p2.x - minX) * scale;
        const y2 = offsetY + (p2.z - minZ) * scale;

        let segColor = colors.green;
        if (p2.state === 'BRAKING') segColor = colors.f1Red;
        else if (p2.state === 'COASTING') segColor = colors.cyan;
        else if (p2.state === 'PARTIAL_THROTTLE') segColor = colors.gold;

        page1.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: 2.2,
          color: segColor
        });
      }

      // Draw Turn Pins on Track Map
      const corners = trackProfile.corners || [];
      corners.forEach((c) => {
        let pinPoint = null;
        if (c.apexIndex !== undefined && points.length > 0) {
          const ratio = Math.min(1, Math.max(0, c.apexIndex / (points.length * (trackProfile.vectorMap?.step || 10))));
          const pIdx = Math.min(points.length - 1, Math.floor(ratio * points.length));
          pinPoint = points[pIdx];
        }

        if (pinPoint) {
          const pinX = offsetX + (pinPoint.x - minX) * scale;
          const pinY = offsetY + (pinPoint.z - minZ) * scale;

          page1.drawCircle({
            x: pinX,
            y: pinY,
            size: 6,
            color: colors.panel,
            borderColor: colors.cyan,
            borderWidth: 1.2
          });

          page1.drawText(`T${c.turnNumber}`, {
            x: pinX - 4,
            y: pinY - 2.5,
            size: 5.5,
            font: fontBold,
            color: colors.white
          });
        }
      });
    }

    // Critical Track Hazards & Elevation Advisories Panel (Bottom Page 1)
    curY = mapAreaY - 14;
    page1.drawText('CRITICAL TRACK HAZARDS & ELEVATION ADVISORIES', {
      x: this.margin,
      y: curY,
      size: 9,
      font: fontBold,
      color: colors.gold
    });

    curY -= 10;
    const hazards = (trackProfile.hazards && trackProfile.hazards.length > 0)
      ? trackProfile.hazards.slice(0, 3)
      : [
          { title: 'Standard Circuit Profile', turnRef: 'Track', type: 'Surface', description: 'Maintain standard reference line and observe kerb rumble oscillation.' }
        ];

    const hazW = (this.width - (this.margin * 2) - 12) / hazards.length;
    hazards.forEach((h, idx) => {
      const hazX = this.margin + (idx * (hazW + 6));
      page1.drawRectangle({
        x: hazX,
        y: curY - 78,
        width: hazW,
        height: 72,
        color: colors.panel,
        borderColor: colors.border,
        borderWidth: 1
      });

      page1.drawRectangle({
        x: hazX,
        y: curY - 78,
        width: 3,
        height: 72,
        color: h.severity === 'High' ? colors.f1Red : colors.gold
      });

      page1.drawText(`[!] ${h.title}`.replace(/[^\x00-\x7F]/g, ' ').slice(0, 26), {
        x: hazX + 8,
        y: curY - 20,
        size: 7.5,
        font: fontBold,
        color: colors.textPrimary
      });

      page1.drawText(`${h.type}`.replace(/[^\x00-\x7F]/g, ' ').slice(0, 30), {
        x: hazX + 8,
        y: curY - 32,
        size: 6.5,
        font: fontMono,
        color: colors.cyan
      });

      // Wrapped description (max 2 lines)
      const descWords = (h.description || '').split(' ');
      let l1 = '', l2 = '';
      for (const w of descWords) {
        if ((l1 + ' ' + w).length < 32) l1 += (l1 ? ' ' : '') + w;
        else if ((l2 + ' ' + w).length < 32) l2 += (l2 ? ' ' : '') + w;
      }

      page1.drawText(l1, {
        x: hazX + 8,
        y: curY - 48,
        size: 6.5,
        font: fontRegular,
        color: colors.textSecondary
      });

      if (l2) {
        page1.drawText(l2, {
          x: hazX + 8,
          y: curY - 58,
          size: 6.5,
          font: fontRegular,
          color: colors.textSecondary
        });
      }
    });

    // Page 1 Footer
    page1.drawText('APEX MOTORSPORT TELEMETRY - PRE-STINT DRIVER BRIEFING - PAGE 1 OF 2', {
      x: this.margin,
      y: 22,
      size: 7,
      font: fontMono,
      color: colors.textMuted
    });

    // =========================================================================
    // PAGE 2: TURN-BY-TURN TELEMETRY CHEAT SHEET & RACECRAFT STRATEGY
    // =========================================================================
    const page2 = doc.addPage([this.width, this.height]);

    page2.drawRectangle({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      color: colors.bg
    });

    // Header Page 2
    page2.drawRectangle({
      x: this.margin,
      y: this.height - 65,
      width: this.width - (this.margin * 2),
      height: 38,
      color: colors.panel,
      borderColor: colors.border,
      borderWidth: 1
    });

    page2.drawText('TURN-BY-TURN TELEMETRY CHEAT SHEET & RACECRAFT TARGETS', {
      x: this.margin + 14,
      y: this.height - 46,
      size: 11,
      font: fontBold,
      color: colors.textPrimary
    });

    page2.drawText(`${trackProfile.trackName} (${trackProfile.layoutName}) | TARGET METRICS`, {
      x: this.margin + 14,
      y: this.height - 58,
      size: 7.5,
      font: fontMono,
      color: colors.cyan
    });

    // Table Header
    curY = this.height - 90;
    page2.drawRectangle({
      x: this.margin,
      y: curY - 18,
      width: this.width - (this.margin * 2),
      height: 18,
      color: colors.panelAlt
    });

    const cols = [
      { label: 'TURN', x: this.margin + 6, w: 38 },
      { label: 'TYPE', x: this.margin + 44, w: 48 },
      { label: 'BRAKING MARKER', x: this.margin + 96, w: 80 },
      { label: 'GEAR', x: this.margin + 180, w: 40 },
      { label: 'APEX MIN SPD', x: this.margin + 224, w: 68 },
      { label: 'SKIP BARBER COACHING & LINE FOCUS', x: this.margin + 296, w: 220 }
    ];

    cols.forEach(col => {
      page2.drawText(col.label, {
        x: col.x,
        y: curY - 12,
        size: 6.5,
        font: fontBold,
        color: colors.textMuted
      });
    });

    // Table Rows (Up to 14 turns)
    const cornersList = (trackProfile.corners && trackProfile.corners.length > 0)
      ? trackProfile.corners.slice(0, 14)
      : [];

    curY -= 20;
    const rowH = 34;

    cornersList.forEach((c, idx) => {
      const rowY = curY - ((idx + 1) * rowH);
      const isAlt = idx % 2 === 1;

      page2.drawRectangle({
        x: this.margin,
        y: rowY,
        width: this.width - (this.margin * 2),
        height: rowH - 2,
        color: isAlt ? rgb(0.08, 0.08, 0.10) : colors.panel,
        borderColor: colors.border,
        borderWidth: 0.5
      });

      // Turn Pill
      page2.drawText(`T${c.turnNumber}`, {
        x: cols[0].x,
        y: rowY + 14,
        size: 9,
        font: fontBold,
        color: colors.cyan
      });

      // Type
      page2.drawText(`${c.cornerType}`, {
        x: cols[1].x,
        y: rowY + 14,
        size: 7.5,
        font: fontRegular,
        color: c.cornerType === 'Type I' ? colors.gold : colors.textSecondary
      });

      // Braking Marker
      page2.drawText(`${c.brakingMarkerMeters || 75}m before apex`, {
        x: cols[2].x,
        y: rowY + 18,
        size: 7.5,
        font: fontBold,
        color: colors.f1Red
      });
      page2.drawText(`Max Decel: -${c.maxDecelG || 1.2}G`, {
        x: cols[2].x,
        y: rowY + 8,
        size: 6.5,
        font: fontMono,
        color: colors.textMuted
      });

      // Target Gear
      page2.drawText(`Gear ${c.targetGear || 3}`, {
        x: cols[3].x,
        y: rowY + 14,
        size: 8,
        font: fontBold,
        color: colors.green
      });

      // Apex Min Speed
      page2.drawText(`${c.apexSpeedKmh || 100} km/h`, {
        x: cols[4].x,
        y: rowY + 18,
        size: 8,
        font: fontBold,
        color: colors.textPrimary
      });
      page2.drawText(`Entry: ${c.entrySpeedKmh || 160} km/h`, {
        x: cols[4].x,
        y: rowY + 8,
        size: 6.5,
        font: fontMono,
        color: colors.textMuted
      });

      // Coaching Notes (Wrap in 2 lines)
      const noteWords = (c.coachingNotes || 'Maintain smooth steering input and throttle commitment.').split(' ');
      let noteL1 = '', noteL2 = '';
      for (const w of noteWords) {
        if ((noteL1 + ' ' + w).length < 52) noteL1 += (noteL1 ? ' ' : '') + w;
        else if ((noteL2 + ' ' + w).length < 52) noteL2 += (noteL2 ? ' ' : '') + w;
      }

      page2.drawText(noteL1, {
        x: cols[5].x,
        y: rowY + 18,
        size: 6.5,
        font: fontRegular,
        color: colors.textSecondary
      });
      if (noteL2) {
        page2.drawText(noteL2, {
          x: cols[5].x,
          y: rowY + 8,
          size: 6.5,
          font: fontRegular,
          color: colors.textSecondary
        });
      }
    });

    // Setup & Tire Engineering Advisory Card (Bottom Page 2)
    const tableBottomY = curY - (cornersList.length * rowH);
    const setupCardY = Math.max(55, tableBottomY - 100);

    page2.drawRectangle({
      x: this.margin,
      y: setupCardY,
      width: this.width - (this.margin * 2),
      height: 90,
      color: colors.panel,
      borderColor: colors.border,
      borderWidth: 1
    });

    page2.drawText('PRE-STINT CHASSIS & SETUP RECOMMENDATIONS', {
      x: this.margin + 12,
      y: setupCardY + 74,
      size: 8.5,
      font: fontBold,
      color: colors.gold
    });

    const setupCols = [
      { label: 'AERODYNAMIC PROFILE', val: trackProfile.setupAdvisories?.downforce || 'Medium Downforce' },
      { label: 'TIRE THERMAL RISK', val: trackProfile.setupAdvisories?.tireWearRisk || 'Front-Left lateral scrub' },
      { label: 'BRAKE BIAS TARGET', val: trackProfile.setupAdvisories?.brakingBias || '54% Front / 46% Rear' }
    ];

    setupCols.forEach((sc, i) => {
      const scX = this.margin + 12 + (i * 170);
      page2.drawText(sc.label, {
        x: scX,
        y: setupCardY + 54,
        size: 6.5,
        font: fontMono,
        color: colors.textMuted
      });

      page2.drawText(sc.val, {
        x: scX,
        y: setupCardY + 40,
        size: 7.5,
        font: fontBold,
        color: colors.textPrimary
      });
    });

    // Driver Notes Line
    page2.drawText('DRIVER PREPARATION NOTES & TARGET SPLITS:', {
      x: this.margin + 12,
      y: setupCardY + 20,
      size: 6.5,
      font: fontMono,
      color: colors.cyan
    });

    page2.drawLine({
      start: { x: this.margin + 12, y: setupCardY + 8 },
      end: { x: this.width - this.margin - 12, y: setupCardY + 8 },
      thickness: 0.5,
      color: colors.border
    });

    // Page 2 Footer
    page2.drawText('APEX MOTORSPORT TELEMETRY - PRE-STINT DRIVER BRIEFING - PAGE 2 OF 2', {
      x: this.margin,
      y: 22,
      size: 7,
      font: fontMono,
      color: colors.textMuted
    });

    return await doc.save();
  }

  /**
   * Triggers client-side browser file download for the compiled PDF
   * @param {Uint8Array} pdfBytes 
   * @param {string} filename 
   */
  download(pdfBytes, filename = 'APEX_PreStint_Briefing.pdf') {
    if (typeof window === 'undefined') return;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
