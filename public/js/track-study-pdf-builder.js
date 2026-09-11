/**
 * APEX 5-Phase Track Study Dossier PDF Builder
 * Generates an executive 5-page motorsport circuit preparation dossier using pdf-lib.
 * Rooted in "Going Faster! Mastering the Art of Race Driving" by Carl Lopez & Skip Barber.
 * 
 * Page 1: Circuit Overview, Annotated Vector Track Map & Type I/II/III Priority Matrix
 * Page 2: Micro Surface Reconnaissance & Camber Dynamics
 * Page 3: Concrete Visual Reference Points, Apex Yaw Attitudes & Waypoints
 * Page 4: Order of Effort Execution Plan (The Skip Barber 3-Step Discipline)
 * Page 5: Hardware Management, Thermal Operating Windows & Stint Strategy
 */

const getPdfLib = () => {
  if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
  return null;
};

export class TrackStudyPdfBuilder {
  constructor() {
    this.width  = 595.28;  // A4 Width in points
    this.height = 841.89;  // A4 Height in points
    this.margin = 36;
  }

  /**
   * Generates a 5-Page Track Study PDF
   * @param {Object} studyData - Generated 5-Phase study object from TrackStudyEngine
   * @param {Object} trackProfile - Optional track profile for vector map points
   * @returns {Promise<Uint8Array>}
   */
  async generate(studyData, trackProfile = null) {
    if (!studyData) throw new Error('TrackStudyPdfBuilder: No studyData provided');

    let PDFLib = getPdfLib();
    if (!PDFLib && typeof globalThis !== 'undefined' && globalThis.PDFLib) PDFLib = globalThis.PDFLib;
    if (!PDFLib) {
      try { const n = await import('pdf-lib'); PDFLib = n; } catch { throw new Error('pdf-lib not loaded'); }
    }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.create();

    const fontBold    = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontMono    = await doc.embedFont(StandardFonts.CourierBold);

    // APEX Professional Light/Motorsport Color Palette
    const C = {
      bg:            rgb(0.97, 0.97, 0.97),
      panelLight:    rgb(1.00, 1.00, 1.00),
      panelMid:      rgb(0.93, 0.94, 0.95),
      panelDark:     rgb(0.88, 0.90, 0.92),
      border:        rgb(0.78, 0.81, 0.86),
      borderStrong:  rgb(0.55, 0.60, 0.68),
      f1Red:         rgb(0.882, 0.024, 0.0),
      cyan:          rgb(0.0,  0.50, 0.72),
      gold:          rgb(0.72, 0.49, 0.0),
      green:         rgb(0.05, 0.56, 0.22),
      purple:        rgb(0.52, 0.12, 0.82),
      blue:          rgb(0.0,  0.42, 0.78),
      textPrimary:   rgb(0.10, 0.11, 0.14),
      textSecondary: rgb(0.35, 0.38, 0.44),
      textMuted:     rgb(0.54, 0.57, 0.63),
      white:         rgb(1.0,  1.0,  1.0),
      black:         rgb(0.0,  0.0,  0.0),
    };

    const typeColor = (type) => {
      if (type === 'Type I') return C.gold;
      if (type === 'Type II') return C.cyan;
      return C.purple;
    };

    const drawHeader = (page, phaseTitle, pageNum) => {
      page.drawRectangle({
        x: this.margin, y: this.height - 68,
        width: this.width - (this.margin * 2), height: 44,
        color: C.panelLight, borderColor: C.border, borderWidth: 1
      });
      page.drawRectangle({ x: this.margin, y: this.height - 68, width: 4, height: 44, color: C.f1Red });

      page.drawText('APEX // 5-PHASE TRACK STUDY & PRE-STINT DOSSIER', {
        x: this.margin + 14, y: this.height - 46, size: 11, font: fontBold, color: C.textPrimary
      });
      page.drawText(phaseTitle.toUpperCase(), {
        x: this.margin + 14, y: this.height - 59, size: 8, font: fontMono, color: C.cyan
      });

      page.drawText(`${studyData.circuit.name.toUpperCase()} // ${studyData.circuit.layout}`, {
        x: this.width - this.margin - 170, y: this.height - 46, size: 7.5, font: fontBold, color: C.textSecondary
      });
      page.drawText(`PAGE ${pageNum} OF 5 // SKIP BARBER METHODOLOGY`, {
        x: this.width - this.margin - 170, y: this.height - 59, size: 7, font: fontMono, color: C.textMuted
      });
    };

    // =========================================================================
    // PAGE 1: MACRO ANALYSIS & PRIORITY CORNER GRADING
    // =========================================================================
    const page1 = doc.addPage([this.width, this.height]);
    page1.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });
    drawHeader(page1, 'Phase 1: Macro Corner Grading & Priority Ranking', 1);

    // KPI row
    let curY = this.height - 85;
    const cardW = (this.width - (this.margin * 2) - 18) / 4;
    const stats = [
      { label: 'TOTAL CORNERS', val: `${studyData.circuit.turnsCount} TURNS`, color: C.cyan },
      { label: 'CIRCUIT LENGTH', val: `${studyData.circuit.lengthMiles} MI (${studyData.circuit.lengthMeters}m)`, color: C.textPrimary },
      { label: 'STRAIGHTS COVERAGE', val: `${studyData.phase1_macro.straightsCoveragePct}% OF LAP`, color: C.green },
      { label: 'LONGEST RUN', val: `T${studyData.phase1_macro.longestStraight.fromCorner} (${studyData.phase1_macro.longestStraight.distanceMeters}m)`, color: C.gold }
    ];

    stats.forEach((s, idx) => {
      const cx = this.margin + idx * (cardW + 6);
      page1.drawRectangle({ x: cx, y: curY - 36, width: cardW, height: 36, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
      page1.drawText(s.label, { x: cx + 6, y: curY - 14, size: 6, font: fontMono, color: C.textMuted });
      page1.drawText(s.val, { x: cx + 6, y: curY - 28, size: 8.5, font: fontBold, color: s.color });
    });

    // Vector Map preview area
    curY -= 48;
    const mapH = 210;
    const mapY = curY - mapH;
    const mapW = this.width - (this.margin * 2);
    page1.drawRectangle({ x: this.margin, y: mapY, width: mapW, height: mapH, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page1.drawText('CIRCUIT MACRO LAYOUT & SECTOR CLASSIFICATION', { x: this.margin + 8, y: curY - 12, size: 7.5, font: fontBold, color: C.textPrimary });

    // Legend
    const legX = this.margin + 260;
    const legList = [
      { label: 'Type I (Lead-on Straight)', color: C.gold },
      { label: 'Type II (End of Straight)', color: C.cyan },
      { label: 'Type III (Compromise)', color: C.purple }
    ];
    legList.forEach((item, i) => {
      const lx = legX + i * 100;
      page1.drawRectangle({ x: lx, y: curY - 14, width: 7, height: 7, color: item.color });
      page1.drawText(item.label, { x: lx + 9, y: curY - 13, size: 5.5, font: fontRegular, color: C.textSecondary });
    });

    // Draw vector path if points available
    const points = trackProfile?.vectorMap?.points || [];
    if (points.length > 2) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      }
      const rangeX = (maxX - minX) || 1, rangeZ = (maxZ - minZ) || 1;
      const pad = 24;
      const usableW = mapW - (pad * 2), usableH = mapH - (pad * 2) - 15;
      const scale = Math.min(usableW / rangeX, usableH / rangeZ);
      const offsetX = this.margin + pad + (usableW - rangeX * scale) / 2;
      const offsetY = mapY + pad + (usableH - rangeZ * scale) / 2;

      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1], p2 = points[i];
        page1.drawLine({
          start: { x: offsetX + (p1.x - minX) * scale, y: offsetY + (p1.z - minZ) * scale },
          end: { x: offsetX + (p2.x - minX) * scale, y: offsetY + (p2.z - minZ) * scale },
          thickness: 2, color: C.borderStrong
        });
      }
    } else {
      page1.drawText('[ Track vector geometry mapped to telemetry coordinates ]', {
        x: this.margin + 120, y: mapY + mapH / 2, size: 8, font: fontMono, color: C.textMuted
      });
    }

    // Priority Ranking Table
    curY = mapY - 16;
    page1.drawText('CORNER LEVERAGE & PRIORITY MATRIX (RANKED BY TIME IMPACT)', {
      x: this.margin, y: curY, size: 8.5, font: fontBold, color: C.textPrimary
    });

    curY -= 14;
    const tableHeaderH = 16;
    page1.drawRectangle({ x: this.margin, y: curY - tableHeaderH, width: mapW, height: tableHeaderH, color: C.panelDark });
    
    const colsP1 = [
      { title: 'RANK', x: this.margin + 6, w: 32 },
      { title: 'TURN', x: this.margin + 40, w: 42 },
      { title: 'CLASS', x: this.margin + 84, w: 55 },
      { title: 'RADIUS', x: this.margin + 142, w: 45 },
      { title: 'APEX MPH', x: this.margin + 190, w: 50 },
      { title: 'STRAIGHT FT', x: this.margin + 242, w: 68 },
      { title: 'LEVERAGE DELTA', x: this.margin + 312, w: 80 },
      { title: 'DISCIPLINE & STRATEGY', x: this.margin + 394, w: 125 }
    ];

    colsP1.forEach(c => {
      page1.drawText(c.title, { x: c.x, y: curY - 11, size: 6, font: fontBold, color: C.textPrimary });
    });

    curY -= tableHeaderH;
    const sortedMacro = [...studyData.phase1_macro.corners].sort((a, b) => a.priorityRank - b.priorityRank);

    sortedMacro.slice(0, 12).forEach((c, idx) => {
      const rowH = 18;
      const rowY = curY - rowH;
      const bgCol = idx % 2 === 0 ? C.panelLight : C.panelMid;
      page1.drawRectangle({ x: this.margin, y: rowY, width: mapW, height: rowH, color: bgCol, borderColor: C.border, borderWidth: 0.5 });

      page1.drawText(`#${c.priorityRank}`, { x: colsP1[0].x, y: rowY + 5, size: 7, font: fontBold, color: c.priorityRank <= 3 ? C.gold : C.textSecondary });
      page1.drawText(`Turn ${c.number}`, { x: colsP1[1].x, y: rowY + 5, size: 7, font: fontBold, color: C.textPrimary });
      page1.drawText(c.type, { x: colsP1[2].x, y: rowY + 5, size: 6.5, font: fontBold, color: typeColor(c.type) });
      page1.drawText(`${c.radius}m`, { x: colsP1[3].x, y: rowY + 5, size: 6.5, font: fontRegular, color: C.textSecondary });
      page1.drawText(`${c.apexSpeedMph} mph`, { x: colsP1[4].x, y: rowY + 5, size: 6.5, font: fontRegular, color: C.textPrimary });
      page1.drawText(`${c.followingStraightFt} ft`, { x: colsP1[5].x, y: rowY + 5, size: 6.5, font: fontMono, color: c.followingStraightFt > 1000 ? C.green : C.textSecondary });
      page1.drawText(`+${c.compoundLeverageSec}s / mph`, { x: colsP1[6].x, y: rowY + 5, size: 6.5, font: fontBold, color: C.cyan });
      page1.drawText(c.disciplineAdvice.slice(0, 36), { x: colsP1[7].x, y: rowY + 5, size: 5.5, font: fontRegular, color: C.textSecondary });

      curY = rowY;
    });

    // Bottom briefing note
    page1.drawRectangle({ x: this.margin, y: 36, width: mapW, height: 28, color: C.panelLight, borderColor: C.gold, borderWidth: 1 });
    page1.drawText(`TACTICAL MANDATE: ${studyData.phase1_macro.strategySummary}`, {
      x: this.margin + 8, y: 50, size: 6.5, font: fontBold, color: C.textPrimary
    });

    // =========================================================================
    // PAGE 2: MICRO SURFACE RECONNAISSANCE & CAMBER DYNAMICS
    // =========================================================================
    const page2 = doc.addPage([this.width, this.height]);
    page2.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });
    drawHeader(page2, 'Phase 2: Micro Surface Reconnaissance & Camber Intelligence', 2);

    curY = this.height - 85;
    page2.drawRectangle({ x: this.margin, y: curY - 45, width: mapW, height: 45, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page2.drawText('SKIP BARBER PRINCIPLE: "BEYOND GEOMETRY & TRACK CAMBER"', { x: this.margin + 8, y: curY - 14, size: 7.5, font: fontBold, color: C.textPrimary });
    page2.drawText('Track surfaces are rarely flat. +1° positive banking delivers over ~3% additional tire download and cornering grip.', { x: this.margin + 8, y: curY - 26, size: 6.5, font: fontRegular, color: C.textSecondary });
    page2.drawText('Off-camber sections lose grip abruptly. Compressions heavily load the chassis, while crests reduce front steering grip to zero.', { x: this.margin + 8, y: curY - 37, size: 6.5, font: fontRegular, color: C.textSecondary });

    curY -= 60;
    page2.drawText('CORNER-BY-CORNER SURFACE & TOPOGRAPHY PROFILE', { x: this.margin, y: curY, size: 8.5, font: fontBold, color: C.textPrimary });

    curY -= 14;
    page2.drawRectangle({ x: this.margin, y: curY - tableHeaderH, width: mapW, height: tableHeaderH, color: C.panelDark });
    
    const colsP2 = [
      { title: 'TURN', x: this.margin + 6, w: 40 },
      { title: 'CAMBER / BANKING', x: this.margin + 48, w: 85 },
      { title: 'ELEVATION / INERTIA', x: this.margin + 135, w: 95 },
      { title: 'PAVEMENT TYPE', x: this.margin + 232, w: 80 },
      { title: 'BUMPS', x: this.margin + 314, w: 45 },
      { title: 'CURB THREAT', x: this.margin + 360, w: 75 },
      { title: 'SURFACE RECON ADVISORY', x: this.margin + 438, w: 85 }
    ];

    colsP2.forEach(c => {
      page2.drawText(c.title, { x: c.x, y: curY - 11, size: 6, font: fontBold, color: C.textPrimary });
    });

    curY -= tableHeaderH;
    studyData.phase2_surface.corners.slice(0, 14).forEach((s, idx) => {
      const rowH = 26;
      const rowY = curY - rowH;
      const bgCol = idx % 2 === 0 ? C.panelLight : C.panelMid;
      page2.drawRectangle({ x: this.margin, y: rowY, width: mapW, height: rowH, color: bgCol, borderColor: C.border, borderWidth: 0.5 });

      page2.drawText(`Turn ${s.number}`, { x: colsP2[0].x, y: rowY + 14, size: 7, font: fontBold, color: C.textPrimary });
      page2.drawText(s.camberType, { x: colsP2[1].x, y: rowY + 14, size: 6.5, font: fontBold, color: s.camberDeg < -0.5 ? C.f1Red : (s.camberDeg > 0.5 ? C.green : C.textSecondary) });
      page2.drawText(s.elevationType, { x: colsP2[2].x, y: rowY + 14, size: 6, font: fontRegular, color: C.textPrimary });
      page2.drawText(s.surfaceMaterial.slice(0, 18), { x: colsP2[3].x, y: rowY + 14, size: 5.5, font: fontRegular, color: C.textSecondary });
      page2.drawText(s.bumpSeverity, { x: colsP2[4].x, y: rowY + 14, size: 6, font: fontMono, color: s.bumpSeverity === 'High (Mid-Corner Seams)' ? C.f1Red : C.textSecondary });
      page2.drawText(s.curbThreat.slice(0, 18), { x: colsP2[5].x, y: rowY + 14, size: 5.5, font: fontRegular, color: C.textSecondary });
      page2.drawText(s.reconNote.slice(0, 32), { x: colsP2[6].x, y: rowY + 14, size: 5.5, font: fontRegular, color: C.cyan });

      // Subtitle line
      page2.drawText(s.gradientAdvice.slice(0, 100), { x: colsP2[1].x, y: rowY + 4, size: 5, font: fontRegular, color: C.textMuted });

      curY = rowY;
    });

    // =========================================================================
    // PAGE 3: VISUAL REFERENCE POINTS & SIGHT PICTURES
    // =========================================================================
    const page3 = doc.addPage([this.width, this.height]);
    page3.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });
    drawHeader(page3, 'Phase 3: Visual Reference Points & Sight Pictures', 3);

    curY = this.height - 85;
    page3.drawRectangle({ x: this.margin, y: curY - 45, width: mapW, height: 45, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page3.drawText('SKIP BARBER PRINCIPLE: "THE SIGHT PICTURE & VISUAL ANCHORS"', { x: this.margin + 8, y: curY - 14, size: 7.5, font: fontBold, color: C.textPrimary });
    page3.drawText('Do not drive by guesswork. Establish fixed physical reference points (boards, curbs, seams) for every corner.', { x: this.margin + 8, y: curY - 26, size: 6.5, font: fontRegular, color: C.textSecondary });
    page3.drawText('Over time, reference points merge into an internal "Sight Picture" template. At apex, verify both car location AND yaw attitude.', { x: this.margin + 8, y: curY - 37, size: 6.5, font: fontRegular, color: C.textSecondary });

    curY -= 60;
    page3.drawText('TURN-BY-TURN VISUAL REFERENCE ANCHORS & ATTITUDES', { x: this.margin, y: curY, size: 8.5, font: fontBold, color: C.textPrimary });

    curY -= 14;
    page3.drawRectangle({ x: this.margin, y: curY - tableHeaderH, width: mapW, height: tableHeaderH, color: C.panelDark });
    
    const colsP3 = [
      { title: 'TURN', x: this.margin + 6, w: 36 },
      { title: 'BRAKING ANCHOR', x: this.margin + 44, w: 90 },
      { title: 'TURN-IN TARGET', x: this.margin + 136, w: 85 },
      { title: 'APEX & YAW ATTITUDE', x: this.margin + 223, w: 100 },
      { title: 'BLIND WAYPOINT', x: this.margin + 325, w: 85 },
      { title: 'TRACK-OUT BOUNDARY', x: this.margin + 412, w: 110 }
    ];

    colsP3.forEach(c => {
      page3.drawText(c.title, { x: c.x, y: curY - 11, size: 6, font: fontBold, color: C.textPrimary });
    });

    curY -= tableHeaderH;
    studyData.phase3_reference.corners.slice(0, 14).forEach((r, idx) => {
      const rowH = 28;
      const rowY = curY - rowH;
      const bgCol = idx % 2 === 0 ? C.panelLight : C.panelMid;
      page3.drawRectangle({ x: this.margin, y: rowY, width: mapW, height: rowH, color: bgCol, borderColor: C.border, borderWidth: 0.5 });

      page3.drawText(`Turn ${r.number}`, { x: colsP3[0].x, y: rowY + 16, size: 7, font: fontBold, color: C.textPrimary });
      
      page3.drawText(`${r.brakePoint.distanceBeforeTurnInM}m (${r.brakePoint.distanceBeforeTurnInFt}ft)`, { x: colsP3[1].x, y: rowY + 16, size: 6.5, font: fontBold, color: r.brakePoint.isThresholdBraking ? C.f1Red : C.textSecondary });
      page3.drawText(r.brakePoint.action.slice(0, 24), { x: colsP3[1].x, y: rowY + 6, size: 5, font: fontRegular, color: C.textMuted });

      page3.drawText(`${r.turnIn.targetMph} mph`, { x: colsP3[2].x, y: rowY + 16, size: 6.5, font: fontBold, color: C.cyan });
      page3.drawText(r.turnIn.visualAnchor.slice(0, 24), { x: colsP3[2].x, y: rowY + 6, size: 5, font: fontRegular, color: C.textMuted });

      page3.drawText(`${r.apex.targetMph} mph // Yaw: ${r.apex.yawAngleTargetDeg}°`, { x: colsP3[3].x, y: rowY + 16, size: 6.5, font: fontBold, color: C.green });
      page3.drawText(r.apex.attitudeCheck.slice(0, 30), { x: colsP3[3].x, y: rowY + 6, size: 5, font: fontRegular, color: C.textMuted });

      page3.drawText(r.waypoint.needed ? 'REQUIRED' : 'NONE', { x: colsP3[4].x, y: rowY + 16, size: 6, font: fontBold, color: r.waypoint.needed ? C.purple : C.textMuted });
      page3.drawText(r.waypoint.landmark.slice(0, 24), { x: colsP3[4].x, y: rowY + 6, size: 5, font: fontRegular, color: C.textMuted });

      page3.drawText(`${r.trackOut.targetMph} mph // Margin: ${r.trackOut.marginSafetyFt}ft`, { x: colsP3[5].x, y: rowY + 16, size: 6.5, font: fontBold, color: C.textPrimary });
      page3.drawText(r.trackOut.visualTarget.slice(0, 30), { x: colsP3[5].x, y: rowY + 6, size: 5, font: fontRegular, color: C.textMuted });

      curY = rowY;
    });

    // =========================================================================
    // PAGE 4: ORDER OF EFFORT EXECUTION PLAN
    // =========================================================================
    const page4 = doc.addPage([this.width, this.height]);
    page4.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });
    drawHeader(page4, 'Phase 4: Planning the "Order of Effort" (Skip Barber 3-Step)', 4);

    curY = this.height - 85;
    page4.drawRectangle({ x: this.margin, y: curY - 55, width: mapW, height: 55, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page4.drawText('THE STRICT 3-STEP ORDER OF PROGRESSION FOR LOWERING LAP TIME', { x: this.margin + 8, y: curY - 14, size: 7.5, font: fontBold, color: C.textPrimary });
    page4.drawText('1. Step 1 — Master the Line: Focus on late apex & road utilization. Never early-apex (drops wheels on exit).', { x: this.margin + 8, y: curY - 26, size: 6.5, font: fontRegular, color: C.textSecondary });
    page4.drawText('2. Step 2 — Maximize Exit Speed: Find Throttle Application Point (TAP). Squeeze power progressively before apex.', { x: this.margin + 8, y: curY - 37, size: 6.5, font: fontRegular, color: C.textSecondary });
    page4.drawText('3. Step 3 — Optimize Corner Entry: Use "The Procedure". Find threshold force early; advance brake points in 3-5 ft bites.', { x: this.margin + 8, y: curY - 48, size: 6.5, font: fontRegular, color: C.textSecondary });

    curY -= 70;
    page4.drawText('CORNER EXECUTION TARGETS (LINE -> EXIT THROTTLE -> ENTRY BRAKING)', { x: this.margin, y: curY, size: 8.5, font: fontBold, color: C.textPrimary });

    curY -= 14;
    page4.drawRectangle({ x: this.margin, y: curY - tableHeaderH, width: mapW, height: tableHeaderH, color: C.panelDark });
    
    const colsP4 = [
      { title: 'TURN', x: this.margin + 6, w: 36 },
      { title: 'CLASS', x: this.margin + 44, w: 50 },
      { title: 'STEP 1: LINE DISCIPLINE', x: this.margin + 96, w: 110 },
      { title: 'STEP 2: THROTTLE COMMIT (TAP)', x: this.margin + 208, w: 125 },
      { title: 'STEP 3: BRAKING & TRAIL DURATION', x: this.margin + 335, w: 185 }
    ];

    colsP4.forEach(c => {
      page4.drawText(c.title, { x: c.x, y: curY - 11, size: 6, font: fontBold, color: C.textPrimary });
    });

    curY -= tableHeaderH;
    studyData.phase4_orderOfEffort.corners.slice(0, 14).forEach((oe, idx) => {
      const rowH = 26;
      const rowY = curY - rowH;
      const bgCol = idx % 2 === 0 ? C.panelLight : C.panelMid;
      page4.drawRectangle({ x: this.margin, y: rowY, width: mapW, height: rowH, color: bgCol, borderColor: C.border, borderWidth: 0.5 });

      page4.drawText(`Turn ${oe.number}`, { x: colsP4[0].x, y: rowY + 14, size: 7, font: fontBold, color: C.textPrimary });
      page4.drawText(oe.type, { x: colsP4[1].x, y: rowY + 14, size: 6.5, font: fontBold, color: typeColor(oe.type) });

      page4.drawText(`${oe.step1_lineStrategy.approach} (Margin: ${oe.step1_lineStrategy.safetyMarginFt}ft)`, { x: colsP4[2].x, y: rowY + 14, size: 6, font: fontBold, color: C.textPrimary });
      page4.drawText(oe.step1_lineStrategy.earlyApexConsequence.slice(0, 36), { x: colsP4[2].x, y: rowY + 4, size: 5, font: fontRegular, color: C.textMuted });

      page4.drawText(`TAP: ${oe.step2_exitThrottle.tapDistanceBeforeApexM}m (${oe.step2_exitThrottle.tapDistanceBeforeApexFt}ft) before apex`, { x: colsP4[3].x, y: rowY + 14, size: 6, font: fontBold, color: C.green });
      page4.drawText(oe.step2_exitThrottle.squeezeRateText.slice(0, 36), { x: colsP4[3].x, y: rowY + 4, size: 5, font: fontRegular, color: C.textMuted });

      page4.drawText(`Force: ${oe.step3_brakingProcedure.thresholdPressureLbs} lbs // Trail: ${oe.step3_brakingProcedure.trailBrakingSec}s`, { x: colsP4[4].x, y: rowY + 14, size: 6, font: fontBold, color: C.cyan });
      page4.drawText(oe.step3_brakingProcedure.brakeStyle, { x: colsP4[4].x, y: rowY + 4, size: 5, font: fontRegular, color: C.textMuted });

      curY = rowY;
    });

    // =========================================================================
    // PAGE 5: HARDWARE MANAGEMENT & STINT REALITY CHECKLIST
    // =========================================================================
    const page5 = doc.addPage([this.width, this.height]);
    page5.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });
    drawHeader(page5, 'Phase 5: Hardware Management & Stint Reality Checklist', 5);

    curY = this.height - 85;

    // 1. Tire Thermal Card
    page5.drawRectangle({ x: this.margin, y: curY - 70, width: mapW, height: 70, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page5.drawRectangle({ x: this.margin, y: curY - 70, width: 4, height: 70, color: C.gold });
    page5.drawText('1. TIRE THERMAL MANAGEMENT & PACE LAP PROTOCOL', { x: this.margin + 12, y: curY - 14, size: 7.5, font: fontBold, color: C.textPrimary });
    page5.drawText(`Target Operating Window: ${studyData.phase5_hardware.tireThermalManagement.operatingWindowF}`, { x: this.margin + 12, y: curY - 26, size: 6.5, font: fontBold, color: C.green });
    page5.drawText(`Pace Lap Scrubbing: ${studyData.phase5_hardware.tireThermalManagement.paceLapWarmupTactic}`, { x: this.margin + 12, y: curY - 38, size: 6, font: fontRegular, color: C.textSecondary });
    page5.drawText(`Slip Angle Operating Limits: ${studyData.phase5_hardware.tireThermalManagement.slipAngleWindow}`, { x: this.margin + 12, y: curY - 50, size: 6, font: fontRegular, color: C.textSecondary });
    page5.drawText(`Cold-to-Hot Target Pressure Gain: +${studyData.phase5_hardware.tireThermalManagement.coldToHotTargetPressureGainPsi} PSI per axle.`, { x: this.margin + 12, y: curY - 62, size: 6, font: fontMono, color: C.cyan });

    // 2. Brake System & Gauge Scan Card
    curY -= 82;
    page5.drawRectangle({ x: this.margin, y: curY - 65, width: mapW, height: 65, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page5.drawRectangle({ x: this.margin, y: curY - 65, width: 4, height: 65, color: C.cyan });
    page5.drawText('2. BRAKE BIAS ADJUSTMENT & IN-STINT COCKPIT SCANS', { x: this.margin + 12, y: curY - 14, size: 7.5, font: fontBold, color: C.textPrimary });
    page5.drawText(`Baseline Mechanical Bias: ${studyData.phase5_hardware.brakeSystemManagement.baselineBias}`, { x: this.margin + 12, y: curY - 26, size: 6.5, font: fontBold, color: C.textPrimary });
    page5.drawText(`Dynamic Tuning: ${studyData.phase5_hardware.brakeSystemManagement.dynamicAdjustmentTactic}`, { x: this.margin + 12, y: curY - 38, size: 6, font: fontRegular, color: C.textSecondary });
    page5.drawText(`Gauge Check Routine: ${studyData.phase5_hardware.brakeSystemManagement.heatSoakNotice}`, { x: this.margin + 12, y: curY - 50, size: 6, font: fontRegular, color: C.textSecondary });

    // 3. Gearing Matrix
    curY -= 77;
    page5.drawText('3. GEARING POWERBAND MATCHING & SHIFT DISCIPLINE', { x: this.margin, y: curY, size: 8, font: fontBold, color: C.textPrimary });
    
    curY -= 12;
    page5.drawRectangle({ x: this.margin, y: curY - tableHeaderH, width: mapW, height: tableHeaderH, color: C.panelDark });
    const colsP5 = [
      { title: 'TURN', x: this.margin + 6, w: 45 },
      { title: 'TARGET GEAR', x: this.margin + 55, w: 75 },
      { title: 'APEX SPEED', x: this.margin + 135, w: 75 },
      { title: 'DOWNSHIFT & POWERBAND DISCIPLINE', x: this.margin + 215, w: 300 }
    ];
    colsP5.forEach(c => {
      page5.drawText(c.title, { x: c.x, y: curY - 11, size: 6, font: fontBold, color: C.textPrimary });
    });

    curY -= tableHeaderH;
    studyData.phase5_hardware.gearingMatrix.slice(0, 10).forEach((g, idx) => {
      const rowH = 16;
      const rowY = curY - rowH;
      const bgCol = idx % 2 === 0 ? C.panelLight : C.panelMid;
      page5.drawRectangle({ x: this.margin, y: rowY, width: mapW, height: rowH, color: bgCol, borderColor: C.border, borderWidth: 0.5 });

      page5.drawText(g.turn, { x: colsP5[0].x, y: rowY + 4, size: 6.5, font: fontBold, color: C.textPrimary });
      page5.drawText(`GEAR ${g.gear}`, { x: colsP5[1].x, y: rowY + 4, size: 6.5, font: fontBold, color: C.cyan });
      page5.drawText(`${g.minSpeedMph} mph`, { x: colsP5[2].x, y: rowY + 4, size: 6.5, font: fontRegular, color: C.textPrimary });
      page5.drawText(g.shiftNote.slice(0, 75), { x: colsP5[3].x, y: rowY + 4, size: 5.5, font: fontRegular, color: C.textSecondary });

      curY = rowY;
    });

    // 4. Stint & Traffic Strategy Card
    curY -= 14;
    page5.drawRectangle({ x: this.margin, y: curY - 70, width: mapW, height: 70, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page5.drawRectangle({ x: this.margin, y: curY - 70, width: 4, height: 70, color: C.purple });
    page5.drawText('4. TRAFFIC DYNAMICS, ACCORDION EFFECT & DEFENSE', { x: this.margin + 12, y: curY - 14, size: 7.5, font: fontBold, color: C.textPrimary });
    page5.drawText(`Race Start Accordion: ${studyData.phase5_hardware.trafficAndAccordionTactics.gridStartPreparation}`, { x: this.margin + 12, y: curY - 26, size: 6, font: fontRegular, color: C.textSecondary });
    page5.drawText(`Drafting Mechanics: ${studyData.phase5_hardware.trafficAndAccordionTactics.draftingPlan}`, { x: this.margin + 12, y: curY - 38, size: 6, font: fontRegular, color: C.textSecondary });
    page5.drawText(`Seeing Independently: ${studyData.phase5_hardware.trafficAndAccordionTactics.seeingIndependently}`, { x: this.margin + 12, y: curY - 50, size: 6, font: fontBold, color: C.f1Red });
    page5.drawText('Defensive Driving Rule: Move once to establish inside approach. Never weave or block reactively in mirrors.', { x: this.margin + 12, y: curY - 62, size: 5.5, font: fontRegular, color: C.textMuted });

    return await doc.save();
  }
}
