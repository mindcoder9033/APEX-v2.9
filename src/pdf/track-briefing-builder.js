/**
 * APEX Pre-Stint Track Briefing PDF Builder (Server-Side)
 * Generates a motorsport-grade 2-Page Pre-Stint Track Briefing PDF using pdf-lib.
 * Page 1: Circuit Intelligence, 2D Vector Track Map with Sectors & Turns, Vital Stats.
 * Page 2: Turn-by-Turn Guide Table, Danger/Overtaking Zones, and Driver Strategy Notes.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export class TrackBriefingBuilder {
  constructor() {
    this.width = 595.28;  // A4 Width
    this.height = 841.89; // A4 Height
    this.margin = 36;

    this.colors = {
      bg: rgb(1, 1, 1),
      panel: rgb(0.972, 0.980, 0.988),       // Slate-50 #F8FAFC
      panelAlt: rgb(0.945, 0.961, 0.976),    // Slate-100 #F1F5F9
      panelDark: rgb(0.059, 0.090, 0.165),   // Slate-900 #0F172A
      border: rgb(0.886, 0.910, 0.941),      // Slate-200 #E2E8F0
      borderBright: rgb(0.796, 0.835, 0.882),// Slate-300 #CBD5E1
      f1Red: rgb(0.882, 0.024, 0),           // #E10600 APEX Red
      textPrimary: rgb(0.059, 0.090, 0.165),
      textSecondary: rgb(0.200, 0.255, 0.333),
      textMuted: rgb(0.392, 0.455, 0.545),
      white: rgb(1, 1, 1),
      sector1: rgb(0.882, 0.024, 0),         // Red / Sector 1
      sector2: rgb(0.012, 0.518, 0.780),     // Blue / Sector 2
      sector3: rgb(0.020, 0.588, 0.314),     // Green / Sector 3
      amber: rgb(0.851, 0.463, 0.024),
      gold: rgb(0.706, 0.447, 0.020)
    };
  }

  /**
   * Generates a 2-page PDF document buffer from a track profile object
   * @param {Object} trackProfile
   * @returns {Promise<Uint8Array>}
   */
  async build(trackProfile) {
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await doc.embedFont(StandardFonts.CourierBold);

    const fonts = { regular: fontRegular, bold: fontBold, mono: fontMono };

    // PAGE 1: Circuit Intelligence & Vector Track Map
    const page1 = doc.addPage([this.width, this.height]);
    this.drawPage1(page1, trackProfile, fonts);

    // PAGE 2: Turn-by-Turn Guide & Pre-Stint Notes
    const page2 = doc.addPage([this.width, this.height]);
    this.drawPage2(page2, trackProfile, fonts);

    return await doc.save();
  }

  /**
   * Draws Page 1: Circuit Intelligence & Track Map
   */
  drawPage1(page, track, fonts) {
    const { width, height, margin, colors } = this;
    const contentWidth = width - margin * 2;

    // Header Banner
    page.drawRectangle({
      x: margin,
      y: height - margin - 54,
      width: contentWidth,
      height: 54,
      color: colors.panelDark
    });

    // Accent line on header
    page.drawRectangle({
      x: margin,
      y: height - margin - 54,
      width: 4,
      height: 54,
      color: colors.f1Red
    });

    page.drawText('APEX // PRE-STINT TRACK BRIEFING', {
      x: margin + 14,
      y: height - margin - 22,
      size: 13,
      font: fonts.bold,
      color: colors.white
    });

    const subTitle = `${track.name || 'Circuit'} — ${track.layout || 'Full Course'} (${track.direction || 'Clockwise'})`;
    page.drawText(subTitle, {
      x: margin + 14,
      y: height - margin - 40,
      size: 10,
      font: fonts.regular,
      color: rgb(0.8, 0.85, 0.9)
    });

    const lengthMi = ((track.lengthMeters || 0) * 0.000621371).toFixed(2);
    const metaRight = `${track.lengthMeters || 0}m (${lengthMi} mi) | ${track.turns?.length || 0} Turns`;
    const metaWidth = fonts.bold.widthOfTextAtSize(metaRight, 10);
    page.drawText(metaRight, {
      x: margin + contentWidth - metaWidth - 14,
      y: height - margin - 22,
      size: 10,
      font: fonts.bold,
      color: colors.f1Red
    });

    const calDate = track.calibrationMetadata?.calibratedAt ? new Date(track.calibrationMetadata.calibratedAt).toLocaleDateString() : 'Active Consensus';
    const calText = `Calibrated: ${calDate} | ${track.calibrationMetadata?.carModel || 'APEX Vehicle'}`;
    const calWidth = fonts.regular.widthOfTextAtSize(calText, 8.5);
    page.drawText(calText, {
      x: margin + contentWidth - calWidth - 14,
      y: height - margin - 40,
      size: 8.5,
      font: fonts.regular,
      color: rgb(0.7, 0.75, 0.8)
    });

    // Top Section: Vector Track Map Box
    const mapBoxY = height - margin - 64 - 360;
    const mapBoxH = 360;

    page.drawRectangle({
      x: margin,
      y: mapBoxY,
      width: contentWidth,
      height: mapBoxH,
      color: colors.panel,
      borderColor: colors.border,
      borderWidth: 1
    });

    // Sector Legend on Map
    const legendY = mapBoxY + mapBoxH - 18;
    this.drawSectorBadge(page, margin + 14, legendY, 'SECTOR 1', colors.sector1, fonts);
    this.drawSectorBadge(page, margin + 85, legendY, 'SECTOR 2', colors.sector2, fonts);
    this.drawSectorBadge(page, margin + 156, legendY, 'SECTOR 3', colors.sector3, fonts);

    // Draw Vector Track Map
    this.drawVectorTrackMap(page, track, margin + 20, mapBoxY + 15, contentWidth - 40, mapBoxH - 40, fonts);

    // Middle Section: Vital Statistics Grid (4 columns)
    const statsY = mapBoxY - 76;
    const statBoxH = 68;

    page.drawRectangle({
      x: margin,
      y: statsY,
      width: contentWidth,
      height: statBoxH,
      color: colors.panelAlt,
      borderColor: colors.border,
      borderWidth: 1
    });

    const colW = contentWidth / 4;
    const elev = track.elevation || { minElevation: 0, maxElevation: 0, elevationDelta: 0 };
    const chars = track.characteristics || {};

    this.drawStatCard(page, margin, statsY, colW, statBoxH, 'CIRCUIT LENGTH', `${track.lengthMeters}m`, `${lengthMi} miles`, fonts);
    this.drawStatCard(page, margin + colW, statsY, colW, statBoxH, 'ELEVATION PROFILE', `+${elev.elevationDelta || 0}m`, `Min: ${elev.minElevation || 0}m / Max: ${elev.maxElevation || 0}m`, fonts);
    this.drawStatCard(page, margin + colW * 2, statsY, colW, statBoxH, 'CORNER DISTRIBUTION', `${track.turns?.length || 0} Turns`, `Slow: ${chars.slowCorners || 0} | Med: ${chars.mediumCorners || 0} | Fast: ${chars.fastCorners || 0}`, fonts);
    this.drawStatCard(page, margin + colW * 3, statsY, colW, statBoxH, 'LONGEST STRAIGHT', `${chars.longestStraight || Math.round(track.lengthMeters * 0.2)}m`, `Ref Pace: ${track.calibrationMetadata?.avgSpeedKph || 150} km/h`, fonts);

    // Bottom Section: Circuit Characteristics & Rhythm
    const charY = statsY - 180;
    const charH = 172;

    page.drawRectangle({
      x: margin,
      y: charY,
      width: contentWidth,
      height: charH,
      color: colors.panel,
      borderColor: colors.border,
      borderWidth: 1
    });

    page.drawText('CIRCUIT CHARACTERISTICS & RACECRAFT RHYTHM', {
      x: margin + 14,
      y: charY + charH - 20,
      size: 10,
      font: fonts.bold,
      color: colors.textPrimary
    });

    // Rhythm Overview text
    const rhythmText = chars.rhythmOverview || 'High-speed technical circuit requiring smooth weight transfer and precise braking.';
    this.drawWrappedText(page, rhythmText, {
      x: margin + 14,
      y: charY + charH - 36,
      maxWidth: contentWidth - 28,
      fontSize: 9,
      font: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 12
    });

    // Danger Zones & Overtaking Sectors columns
    const splitW = (contentWidth - 36) / 2;

    // Danger Zones
    page.drawText('KEY DANGER & BRAKING HOTSPOTS', {
      x: margin + 14,
      y: charY + 95,
      size: 8.5,
      font: fonts.bold,
      color: colors.f1Red
    });

    const dangerList = chars.dangerZones?.length ? chars.dangerZones : ['High-G corner entry transitions', 'Heavy braking zones at end of straight'];
    dangerList.slice(0, 3).forEach((item, idx) => {
      page.drawText(`*  ${item}`, {
        x: margin + 14,
        y: charY + 78 - idx * 14,
        size: 8,
        font: fonts.regular,
        color: colors.textSecondary
      });
    });

    // Overtaking Zones
    page.drawText('PRIMARY OVERTAKING OPPORTUNITIES', {
      x: margin + 20 + splitW,
      y: charY + 95,
      size: 8.5,
      font: fonts.bold,
      color: colors.sector3
    });

    const overtakeList = chars.overtakingZones?.length ? chars.overtakingZones : ['Main straight slipstream into T1', 'Deep trail braking entry'];
    overtakeList.slice(0, 3).forEach((item, idx) => {
      page.drawText(`>  ${item}`, {
        x: margin + 20 + splitW,
        y: charY + 78 - idx * 14,
        size: 8,
        font: fonts.regular,
        color: colors.textSecondary
      });
    });

    // Footer
    this.drawFooter(page, 1, 2, fonts);
  }

  /**
   * Draws Page 2: Turn-by-Turn Guide & Pre-Stint Notes
   */
  drawPage2(page, track, fonts) {
    const { width, height, margin, colors } = this;
    const contentWidth = width - margin * 2;

    // Header Banner
    page.drawRectangle({
      x: margin,
      y: height - margin - 44,
      width: contentWidth,
      height: 44,
      color: colors.panelDark
    });

    page.drawRectangle({
      x: margin,
      y: height - margin - 44,
      width: 4,
      height: 44,
      color: colors.sector2
    });

    page.drawText(`TURN-BY-TURN REFERENCE GUIDE // ${track.name || 'Circuit'}`, {
      x: margin + 14,
      y: height - margin - 20,
      size: 11,
      font: fonts.bold,
      color: colors.white
    });

    page.drawText('APEX Canonical Turn Boundaries, Reference Speeds, Gears & Braking Zones', {
      x: margin + 14,
      y: height - margin - 34,
      size: 8.5,
      font: fonts.regular,
      color: rgb(0.8, 0.85, 0.9)
    });

    // Turn Table
    const tableY = height - margin - 52;
    const turns = track.turns || [];
    const maxTableTurns = Math.min(turns.length, 18);
    const rowH = 22;
    const headerH = 24;

    // Table Header
    page.drawRectangle({
      x: margin,
      y: tableY - headerH,
      width: contentWidth,
      height: headerH,
      color: colors.panelAlt,
      borderColor: colors.borderBright,
      borderWidth: 1
    });

    const cols = [
      { label: 'TURN', w: 42, align: 'left' },
      { label: 'NAME', w: 100, align: 'left' },
      { label: 'TYPE', w: 85, align: 'left' },
      { label: 'DIR', w: 32, align: 'center' },
      { label: 'APEX (m)', w: 55, align: 'right' },
      { label: 'REF SPEED', w: 65, align: 'right' },
      { label: 'GEAR', w: 38, align: 'center' },
      { label: 'LAT G', w: 45, align: 'right' },
      { label: 'BRAKE DIST', w: 61, align: 'right' }
    ];

    let currentX = margin + 6;
    cols.forEach(col => {
      page.drawText(col.label, {
        x: currentX,
        y: tableY - headerH + 7,
        size: 7.5,
        font: fonts.bold,
        color: colors.textPrimary
      });
      currentX += col.w;
    });

    // Table Rows
    let rowY = tableY - headerH;

    if (turns.length === 0) {
      rowY -= rowH * 2;
      page.drawRectangle({
        x: margin,
        y: rowY,
        width: contentWidth,
        height: rowH * 2,
        color: colors.panel,
        borderColor: colors.border,
        borderWidth: 0.5
      });
      page.drawText('Awaiting Telemetry Calibration to map corner apexes, reference speeds, and braking zones.', {
        x: margin + 20,
        y: rowY + rowH - 4,
        size: 8.5,
        font: fonts.regular,
        color: colors.textMuted
      });
    } else {
      turns.slice(0, maxTableTurns).forEach((turn, idx) => {
        rowY -= rowH;
        const isEven = idx % 2 === 0;

      page.drawRectangle({
        x: margin,
        y: rowY,
        width: contentWidth,
        height: rowH,
        color: isEven ? colors.white : colors.panel,
        borderColor: colors.border,
        borderWidth: 0.5
      });

      let cx = margin + 6;

      // Turn ID
      page.drawText(`T${turn.turnNumber}`, {
        x: cx,
        y: rowY + 6,
        size: 8,
        font: fonts.bold,
        color: colors.f1Red
      });
      cx += cols[0].w;

      // Name
      const name = turn.name || `Turn ${turn.turnNumber}`;
      page.drawText(name.slice(0, 18), {
        x: cx,
        y: rowY + 6,
        size: 7.5,
        font: fonts.regular,
        color: colors.textPrimary
      });
      cx += cols[1].w;

      // Type
      page.drawText(turn.type || 'Corner', {
        x: cx,
        y: rowY + 6,
        size: 7.5,
        font: fonts.regular,
        color: colors.textSecondary
      });
      cx += cols[2].w;

      // Direction
      const dirColor = turn.direction === 'Right' ? colors.sector2 : colors.amber;
      page.drawText(turn.direction === 'Right' ? 'R' : 'L', {
        x: cx + 6,
        y: rowY + 6,
        size: 8,
        font: fonts.bold,
        color: dirColor
      });
      cx += cols[3].w;

      // Apex Dist
      page.drawText(`${turn.apexDist}m`, {
        x: cx,
        y: rowY + 6,
        size: 7.5,
        font: fonts.mono,
        color: colors.textSecondary
      });
      cx += cols[4].w;

      // Ref Speed
      page.drawText(`${turn.refSpeed} km/h`, {
        x: cx,
        y: rowY + 6,
        size: 7.5,
        font: fonts.bold,
        color: colors.textPrimary
      });
      cx += cols[5].w;

      // Ref Gear
      page.drawText(`${turn.refGear}`, {
        x: cx + 10,
        y: rowY + 6,
        size: 8,
        font: fonts.mono,
        color: colors.sector3
      });
      cx += cols[6].w;

      // Lat G
      page.drawText(`${turn.apexLatG || 1.2}G`, {
        x: cx,
        y: rowY + 6,
        size: 7.5,
        font: fonts.regular,
        color: colors.textSecondary
      });
      cx += cols[7].w;

      // Braking Dist
      page.drawText(`${turn.brakingDist || 50}m`, {
        x: cx,
        y: rowY + 6,
        size: 7.5,
        font: fonts.mono,
        color: colors.f1Red
      });
    });
    }

    // Bottom Box: Pre-Stint Driver Strategy & Setup Notes
    const notesY = margin + 30;
    const notesH = Math.max(80, rowY - notesY - 14);

    page.drawRectangle({
      x: margin,
      y: notesY,
      width: contentWidth,
      height: notesH,
      color: colors.panelAlt,
      borderColor: colors.borderBright,
      borderWidth: 1
    });

    page.drawText('PRE-STINT DRIVER STRATEGY & TARGET PACING', {
      x: margin + 14,
      y: notesY + notesH - 18,
      size: 9.5,
      font: fonts.bold,
      color: colors.textPrimary
    });

    const driverNotes = track.driverNotes || 'Target clean braking releases and progressive throttle application. Maintain consistent turn entry speeds across stint.';
    this.drawWrappedText(page, `Driver Focus: ${driverNotes}`, {
      x: margin + 14,
      y: notesY + notesH - 34,
      maxWidth: contentWidth - 28,
      fontSize: 8.5,
      font: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 12
    });

    // Footer
    this.drawFooter(page, 2, 2, fonts);
  }

  /**
   * Renders 2D Vector Track Map onto page canvas with Sectors & Turn Markers
   */
  drawVectorTrackMap(page, track, mapX, mapY, mapW, mapH, fonts) {
    const { colors } = this;
    const path2D = track.path2D || [];
    if (path2D.length < 3) {
      page.drawText('Vector track map available upon multi-lap calibration.', {
        x: mapX + 30,
        y: mapY + mapH / 2,
        size: 9,
        font: fonts.regular,
        color: colors.textMuted
      });
      return;
    }

    // Find bounding box
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    path2D.forEach(pt => {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minZ = Math.min(minZ, pt.z);
      maxZ = Math.max(maxZ, pt.z);
    });

    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const scale = Math.min((mapW - 40) / spanX, (mapH - 40) / spanZ);

    const offsetX = mapX + 20 + (mapW - 40 - spanX * scale) / 2;
    const offsetY = mapY + 20 + (mapH - 40 - spanZ * scale) / 2;

    const transform = (x, z) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (z - minZ) * scale
    });

    const sectors = track.sectors || { s1End: track.lengthMeters / 3, s2End: (track.lengthMeters / 3) * 2 };

    // Draw path segments color-coded by sector
    for (let i = 0; i < path2D.length; i++) {
      const p1 = path2D[i];
      const p2 = path2D[(i + 1) % path2D.length];

      const t1 = transform(p1.x, p1.z);
      const t2 = transform(p2.x, p2.z);

      const d = p1.dist || 0;
      let strokeColor = colors.sector1;
      if (d > sectors.s1End && d <= sectors.s2End) {
        strokeColor = colors.sector2;
      } else if (d > sectors.s2End) {
        strokeColor = colors.sector3;
      }

      page.drawLine({
        start: { x: t1.x, y: t1.y },
        end: { x: t2.x, y: t2.y },
        thickness: 3.5,
        color: strokeColor
      });
    }

    // Draw Start/Finish Line Indicator
    const startPt = transform(path2D[0].x, path2D[0].z);
    page.drawCircle({
      x: startPt.x,
      y: startPt.y,
      size: 5,
      color: colors.white,
      borderColor: colors.panelDark,
      borderWidth: 2
    });

    // Draw Turn Badges
    const turns = track.turns || [];
    turns.forEach(t => {
      // Find closest path point to turn apex
      let closest = path2D[0];
      let minDelta = Infinity;
      path2D.forEach(pt => {
        const delta = Math.abs((pt.dist || 0) - (t.apexDist || 0));
        if (delta < minDelta) {
          minDelta = delta;
          closest = pt;
        }
      });

      const pos = transform(closest.x, closest.z);

      // Badge circle
      page.drawCircle({
        x: pos.x,
        y: pos.y,
        size: 6.5,
        color: colors.panelDark,
        borderColor: colors.white,
        borderWidth: 1
      });

      const label = `T${t.turnNumber}`;
      const lw = fonts.bold.widthOfTextAtSize(label, 6);
      page.drawText(label, {
        x: pos.x - lw / 2,
        y: pos.y - 2,
        size: 6,
        font: fonts.bold,
        color: colors.white
      });
    });
  }

  /**
   * Draws a sector pill badge
   */
  drawSectorBadge(page, x, y, text, color, fonts) {
    page.drawRectangle({
      x,
      y,
      width: 60,
      height: 12,
      color,
      borderColor: this.colors.border,
      borderWidth: 0.5
    });

    const tw = fonts.bold.widthOfTextAtSize(text, 6.5);
    page.drawText(text, {
      x: x + (60 - tw) / 2,
      y: y + 3,
      size: 6.5,
      font: fonts.bold,
      color: this.colors.white
    });
  }

  /**
   * Draws stat card inside 4-column row
   */
  drawStatCard(page, x, y, w, h, label, mainVal, subVal, fonts) {
    const { colors } = this;

    page.drawText(label, {
      x: x + 10,
      y: y + h - 16,
      size: 7,
      font: fonts.bold,
      color: colors.textMuted
    });

    page.drawText(mainVal, {
      x: x + 10,
      y: y + h - 34,
      size: 13,
      font: fonts.bold,
      color: colors.textPrimary
    });

    page.drawText(subVal, {
      x: x + 10,
      y: y + 10,
      size: 7,
      font: fonts.regular,
      color: colors.textSecondary
    });
  }

  /**
   * Safe text wrapping
   */
  drawWrappedText(page, text, { x, y, maxWidth, font, fontSize, color, lineHeight = fontSize * 1.25 }) {
    if (!text) return;
    const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
    let line = '';
    let currentY = y;

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const testW = font.widthOfTextAtSize(test, fontSize);
      if (testW > maxWidth && line) {
        page.drawText(line, { x, y: currentY, size: fontSize, font, color });
        line = w;
        currentY -= lineHeight;
      } else {
        line = test;
      }
    }

    if (line) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color });
    }
  }

  /**
   * Draws page footer
   */
  drawFooter(page, pageNum, totalPages, fonts) {
    const { width, margin, colors } = this;
    const footerY = margin - 14;

    page.drawLine({
      start: { x: margin, y: footerY + 12 },
      end: { x: width - margin, y: footerY + 12 },
      thickness: 0.5,
      color: colors.border
    });

    page.drawText('APEX MOTORSPORT TELEMETRY // PRE-STINT BRIEFING REPORT', {
      x: margin,
      y: footerY,
      size: 7,
      font: fonts.regular,
      color: colors.textMuted
    });

    const pageText = `PAGE ${pageNum} OF ${totalPages}`;
    const pageW = fonts.mono.widthOfTextAtSize(pageText, 7);
    page.drawText(pageText, {
      x: width - margin - pageW,
      y: footerY,
      size: 7,
      font: fonts.mono,
      color: colors.f1Red
    });
  }
}
