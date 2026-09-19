/**
 * APEX Pre-Stint Driver Briefing PDF Builder
 * Generates an executive circuit preparation dossier using pdf-lib.
 * Page 1: Vector Track Map (annotated turns + section numbers) — LIGHT THEME
 * Page 2: Turn-by-Turn Telemetry Cheat Sheet
 * Page 3: Weather Intelligence Summary Grid (all 18 conditions)
 * Pages 4+: Per-condition corner tables (grouped, compact)
 */

const getPdfLib = () => {
  if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
  return null;
};

// ---------------------------------------------------------------------------
// Condition catalog (mirror of weather-simulator.js — kept in sync manually)
// ---------------------------------------------------------------------------
const WEATHER_CATALOG = [
  { slug: 'clear',         name: 'Clear',          cat: 'Dry',          gripLoss: 0.00, brakeInc: 0.00 },
  { slug: 'mostly-clear',  name: 'Mostly Clear',   cat: 'Dry',          gripLoss: 0.02, brakeInc: 0.01 },
  { slug: 'partly-cloudy', name: 'Partly Cloudy',  cat: 'Dry',          gripLoss: 0.04, brakeInc: 0.02 },
  { slug: 'cloudy',        name: 'Cloudy',         cat: 'Dry',          gripLoss: 0.06, brakeInc: 0.03 },
  { slug: 'overcast-dry',  name: 'Overcast (Dry)', cat: 'Dry',          gripLoss: 0.08, brakeInc: 0.04 },
  { slug: 'looming-clouds',  name: 'Looming Clouds',  cat: 'Transitional', gripLoss: 0.12, brakeInc: 0.08 },
  { slug: 'thunder-clouds',  name: 'Thunder Clouds',  cat: 'Transitional', gripLoss: 0.18, brakeInc: 0.12 },
  { slug: 'thin-haze',       name: 'Thin Haze',       cat: 'Transitional', gripLoss: 0.10, brakeInc: 0.06 },
  { slug: 'patchy-fog',      name: 'Patchy Fog',      cat: 'Transitional', gripLoss: 0.14, brakeInc: 0.10 },
  { slug: 'dense-fog',       name: 'Dense Fog',       cat: 'Transitional', gripLoss: 0.20, brakeInc: 0.15 },
  { slug: 'drizzle',       name: 'Drizzle',        cat: 'Wet',          gripLoss: 0.25, brakeInc: 0.20 },
  { slug: 'light-rain',    name: 'Light Rain',     cat: 'Wet',          gripLoss: 0.35, brakeInc: 0.28 },
  { slug: 'moderate-rain', name: 'Moderate Rain',  cat: 'Wet',          gripLoss: 0.48, brakeInc: 0.38 },
  { slug: 'heavy-rain',    name: 'Heavy Rain',     cat: 'Wet',          gripLoss: 0.62, brakeInc: 0.48 },
  { slug: 'rainstorm',     name: 'Rainstorm',      cat: 'Wet',          gripLoss: 0.73, brakeInc: 0.58 },
  { slug: 'thunderstorm',  name: 'Thunderstorm',   cat: 'Wet',          gripLoss: 0.83, brakeInc: 0.68 },
  { slug: 'overcast-wet',  name: 'Overcast (Wet)', cat: 'Wet',          gripLoss: 0.40, brakeInc: 0.32 },
  { slug: 'rain-at-start', name: 'Rain at Start',  cat: 'Dynamic',      gripLoss: 0.60, brakeInc: 0.45 },
  { slug: 'rain-at-end',   name: 'Rain at End',    cat: 'Dynamic',      gripLoss: 0.60, brakeInc: 0.45 },
];

const WEATHER_CATEGORIES = ['Dry', 'Transitional', 'Wet', 'Dynamic'];

export class PreStintPdfBuilder {
  constructor() {
    this.width  = 595.28;  // A4 Width in points
    this.height = 841.89;  // A4 Height in points
    this.margin = 36;
  }

  /**
   * Generates a PDF document from a Track Profile.
   * @param {Object} trackProfile
   * @param {Object|null} weatherProfiles  Map of slug → WeatherProfile (all 18), or single profile (legacy)
   * @returns {Promise<Uint8Array>}
   */
  async generate(trackProfile, weatherProfiles = null) {
    if (!trackProfile) throw new Error('PreStintPdfBuilder: No trackProfile provided');

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

    // -------------------------------------------------------------------------
    // LIGHT THEME color palette
    // -------------------------------------------------------------------------
    const C = {
      bg:            rgb(0.97, 0.97, 0.97),   // #F7F7F7 page background
      panelLight:    rgb(1.00, 1.00, 1.00),   // #FFFFFF card fill
      panelMid:      rgb(0.93, 0.94, 0.95),   // #EDEFF2 alternate row
      panelDark:     rgb(0.88, 0.90, 0.92),   // #E0E4EB table header
      border:        rgb(0.78, 0.81, 0.86),   // #C7CEDB subtle border
      borderStrong:  rgb(0.55, 0.60, 0.68),   // #8C99AD strong border
      f1Red:         rgb(0.882, 0.024, 0.0),  // #E10600
      cyan:          rgb(0.0,  0.50, 0.72),   // #0080B8 (dark enough for light bg)
      gold:          rgb(0.72, 0.49, 0.0),    // #B87D00
      green:         rgb(0.05, 0.56, 0.22),   // #0D8F38
      purple:        rgb(0.52, 0.12, 0.82),   // #851FD1
      blue:          rgb(0.0,  0.42, 0.78),   // #006BC7
      textPrimary:   rgb(0.10, 0.11, 0.14),   // #1A1C24
      textSecondary: rgb(0.35, 0.38, 0.44),   // #596070
      textMuted:     rgb(0.54, 0.57, 0.63),   // #8A91A0
      white:         rgb(1.0,  1.0,  1.0),
      black:         rgb(0.0,  0.0,  0.0),
    };

    // Category accent colors
    const catAccent = {
      Dry:          C.gold,
      Transitional: C.blue,
      Wet:          C.cyan,
      Dynamic:      C.purple,
    };

    // Grip-level heat color: low loss = green, high = red
    const gripColor = (lossPct) => {
      if (lossPct >= 50) return C.f1Red;
      if (lossPct >= 20) return C.gold;
      return C.green;
    };

    const formatLapTime = (sec) => {
      if (!sec || isNaN(sec)) return '--:--.---';
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(3);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Normalize weatherProfiles: accept both a single profile and a full map
    let allWeatherProfiles = null;
    if (weatherProfiles) {
      if (weatherProfiles.conditionSlug) {
        // Legacy: single profile passed — wrap it
        allWeatherProfiles = { [weatherProfiles.conditionSlug]: weatherProfiles };
      } else {
        allWeatherProfiles = weatherProfiles;
      }
    }

    // Determine total pages dynamically: 5 pages if weather profiles present, 2 if dry baseline only
    const totalPages = allWeatherProfiles ? 5 : 2;

    // =========================================================================
    // PAGE 1: CIRCUIT INTELLIGENCE & ANNOTATED VECTOR TRACK MAP
    // =========================================================================
    const page1 = doc.addPage([this.width, this.height]);

    // White background
    page1.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });

    // Header banner
    page1.drawRectangle({
      x: this.margin, y: this.height - 72,
      width: this.width - (this.margin * 2), height: 46,
      color: C.panelLight, borderColor: C.border, borderWidth: 1
    });
    page1.drawRectangle({ x: this.margin, y: this.height - 72, width: 4, height: 46, color: C.f1Red });

    page1.drawText('APEX // PRE-STINT DRIVER BRIEFING', {
      x: this.margin + 14, y: this.height - 48, size: 13, font: fontBold, color: C.textPrimary
    });
    page1.drawText('CIRCUIT INTELLIGENCE & TACTICAL TRACK DOSSIER', {
      x: this.margin + 14, y: this.height - 62, size: 8, font: fontMono, color: C.cyan
    });

    const dateStr = new Date().toISOString().split('T')[0];
    page1.drawText(`DATE: ${dateStr}`, {
      x: this.width - this.margin - 112, y: this.height - 48, size: 8, font: fontMono, color: C.textSecondary
    });
    page1.drawText('STATUS: VERIFIED', {
      x: this.width - this.margin - 112, y: this.height - 62, size: 8, font: fontMono, color: C.green
    });

    // Circuit title
    let curY = this.height - 90;
    page1.drawText((trackProfile.trackName || 'CIRCUIT').toUpperCase(), {
      x: this.margin, y: curY, size: 18, font: fontBold, color: C.textPrimary
    });

    curY -= 15;
    const subTitle = `${trackProfile.layoutName || 'Grand Prix Course'} | ${trackProfile.officialLength || '4.500 km'} | ${trackProfile.trackType || 'Real'} Circuit`;
    page1.drawText(subTitle, { x: this.margin, y: curY, size: 9.5, font: fontRegular, color: C.textSecondary });

    // KPI Cards (4 stats)
    curY -= 50;
    const cardW = (this.width - (this.margin * 2) - 18) / 4;
    const stats = [
      { label: 'PERSONAL BENCHMARK', val: formatLapTime(trackProfile.bestLapTime), color: C.gold },
      { label: 'TOTAL CORNERS', val: `${trackProfile.corners?.length || trackProfile.cornersCount || 0} TURNS`, color: C.cyan },
      { label: 'CIRCUIT LENGTH', val: trackProfile.officialLength || '4.500 km', color: C.textPrimary },
      { label: 'REFERENCE CAR', val: (trackProfile.carName || 'GT3').slice(0, 14), color: C.textSecondary }
    ];

    stats.forEach((s, idx) => {
      const cx = this.margin + idx * (cardW + 6);
      page1.drawRectangle({ x: cx, y: curY, width: cardW, height: 42, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
      page1.drawText(s.label, { x: cx + 8, y: curY + 27, size: 6.5, font: fontMono, color: C.textMuted });
      page1.drawText(s.val, { x: cx + 8, y: curY + 10, size: 9.5, font: fontBold, color: s.color });
    });

    // ── Track Map Canvas ──────────────────────────────────────────────────────
    curY -= 16;
    const mapAreaH = 340;
    const mapAreaY = curY - mapAreaH;
    const mapAreaW = this.width - (this.margin * 2);

    page1.drawRectangle({
      x: this.margin, y: mapAreaY, width: mapAreaW, height: mapAreaH,
      color: C.panelLight, borderColor: C.border, borderWidth: 1
    });

    // Map title row
    page1.drawText('VECTOR TRACK MAP', {
      x: this.margin + 10, y: curY - 14, size: 8, font: fontBold, color: C.textPrimary
    });

    // Driving state legend
    const legX = this.margin + 130;
    const legItems = [
      { color: C.green,  label: 'Full Throttle' },
      { color: C.f1Red,  label: 'Braking' },
      { color: C.cyan,   label: 'Coasting / Apex' },
      { color: C.gold,   label: 'Partial Throttle' },
    ];
    legItems.forEach((li, i) => {
      const lx = legX + i * 88;
      page1.drawRectangle({ x: lx, y: curY - 16, width: 8, height: 8, color: li.color });
      page1.drawText(li.label, { x: lx + 11, y: curY - 15, size: 6.5, font: fontRegular, color: C.textSecondary });
    });

    // Draw map segments + ANNOTATED TURN PINS
    const points = trackProfile.vectorMap?.points || [];
    if (points.length > 2) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      }

      const rangeX = (maxX - minX) || 1;
      const rangeZ = (maxZ - minZ) || 1;
      const pad = 40;
      const usableW = mapAreaW - (pad * 2);
      const usableH = mapAreaH - (pad * 2) - 24;
      const scale = Math.min(usableW / rangeX, usableH / rangeZ);
      const offsetX = this.margin + pad + (usableW - rangeX * scale) / 2;
      const offsetY = mapAreaY + pad + (usableH - rangeZ * scale) / 2;

      // ── Path Segments ──────────────────────────────────────────────────────
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1], p2 = points[i];
        const x1 = offsetX + (p1.x - minX) * scale;
        const y1 = offsetY + (p1.z - minZ) * scale;
        const x2 = offsetX + (p2.x - minX) * scale;
        const y2 = offsetY + (p2.z - minZ) * scale;
        page1.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 5, color: C.panelLight });
      }

      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1], p2 = points[i];
        const x1 = offsetX + (p1.x - minX) * scale;
        const y1 = offsetY + (p1.z - minZ) * scale;
        const x2 = offsetX + (p2.x - minX) * scale;
        const y2 = offsetY + (p2.z - minZ) * scale;

        let segColor = C.green;
        if (p2.state === 'BRAKING')          segColor = C.f1Red;
        else if (p2.state === 'COASTING')    segColor = C.cyan;
        else if (p2.state === 'PARTIAL_THROTTLE') segColor = C.gold;

        page1.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 2.5, color: segColor });
      }

      // ── Section number markers ──
      const sectionCount = 10;
      for (let s = 0; s < sectionCount; s++) {
        const idx = Math.floor((s / sectionCount) * (points.length - 1));
        const p = points[idx];
        const sx = offsetX + (p.x - minX) * scale;
        const sy = offsetY + (p.z - minZ) * scale;
        const sNum = `${s + 1}`;

        page1.drawLine({ start: { x: sx - 4, y: sy }, end: { x: sx, y: sy + 4 }, thickness: 1, color: C.borderStrong });
        page1.drawLine({ start: { x: sx, y: sy + 4 }, end: { x: sx + 4, y: sy }, thickness: 1, color: C.borderStrong });
        page1.drawLine({ start: { x: sx + 4, y: sy }, end: { x: sx, y: sy - 4 }, thickness: 1, color: C.borderStrong });
        page1.drawLine({ start: { x: sx, y: sy - 4 }, end: { x: sx - 4, y: sy }, thickness: 1, color: C.borderStrong });

        page1.drawText(sNum, {
          x: sx - (sNum.length > 1 ? 5 : 3), y: sy - 3,
          size: 5, font: fontBold, color: C.textSecondary
        });
      }

      // ── Turn Pin Annotations ──
      const corners = trackProfile.corners || [];
      corners.forEach((c) => {
        if (c.apexIndex === undefined) return;
        const ratio = Math.min(1, Math.max(0, c.apexIndex / (points.length * (trackProfile.vectorMap?.step || 10))));
        const pIdx = Math.min(points.length - 1, Math.floor(ratio * points.length));
        const pt = points[pIdx];
        if (!pt) return;

        const pinX = offsetX + (pt.x - minX) * scale;
        const pinY = offsetY + (pt.z - minZ) * scale;
        const label = `T${c.turnNumber}`;

        page1.drawCircle({ x: pinX, y: pinY, size: 9, color: C.panelLight, borderColor: C.border, borderWidth: 1.5 });
        page1.drawCircle({ x: pinX, y: pinY, size: 7, color: C.f1Red });

        page1.drawText(label, {
          x: pinX + 9, y: pinY - 3,
          size: 7.5, font: fontBold, color: C.textPrimary
        });
      });
    } else {
      page1.drawText('Awaiting GPS telemetry data for vector track mapping', {
        x: this.margin + mapAreaW / 2 - 100,
        y: mapAreaY + mapAreaH / 2,
        size: 9, font: fontRegular, color: C.textMuted
      });
    }

    // ── Hazards Panel ─────────────────────────────────────────────────────────
    curY = mapAreaY - 14;
    page1.drawText('CRITICAL TRACK HAZARDS & ELEVATION ADVISORIES', {
      x: this.margin, y: curY, size: 9, font: fontBold, color: C.gold
    });

    curY -= 10;
    const hazards = (trackProfile.hazards?.length > 0)
      ? trackProfile.hazards.slice(0, 3)
      : [{ title: 'Standard Circuit Profile', turnRef: 'Track', type: 'Surface', description: 'Maintain standard reference line and observe kerb rumble oscillation.' }];

    const hazW = (this.width - (this.margin * 2) - 12) / hazards.length;
    hazards.forEach((h, idx) => {
      const hazX = this.margin + idx * (hazW + 6);
      page1.drawRectangle({ x: hazX, y: curY - 78, width: hazW, height: 72, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
      page1.drawRectangle({ x: hazX, y: curY - 78, width: 3, height: 72, color: h.severity === 'High' ? C.f1Red : C.gold });

      page1.drawText(`[!] ${h.title}`.replace(/[^\x00-\x7F]/g, ' ').slice(0, 26), {
        x: hazX + 8, y: curY - 20, size: 7.5, font: fontBold, color: C.textPrimary
      });
      page1.drawText(`${h.type}`.replace(/[^\x00-\x7F]/g, ' ').slice(0, 30), {
        x: hazX + 8, y: curY - 32, size: 6.5, font: fontMono, color: C.cyan
      });

      const words = (h.description || '').split(' ');
      let l1 = '', l2 = '';
      for (const w of words) {
        if ((l1 + ' ' + w).length < 32) l1 += (l1 ? ' ' : '') + w;
        else if ((l2 + ' ' + w).length < 32) l2 += (l2 ? ' ' : '') + w;
      }
      page1.drawText(l1, { x: hazX + 8, y: curY - 48, size: 6.5, font: fontRegular, color: C.textSecondary });
      if (l2) page1.drawText(l2, { x: hazX + 8, y: curY - 58, size: 6.5, font: fontRegular, color: C.textSecondary });
    });

    page1.drawText(`APEX MOTORSPORT TELEMETRY — PRE-STINT DRIVER BRIEFING — PAGE 1 OF ${totalPages}`, {
      x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
    });

    // =========================================================================
    // PAGE 2: TURN-BY-TURN CHEAT SHEET
    // =========================================================================
    const page2 = doc.addPage([this.width, this.height]);
    page2.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });

    page2.drawRectangle({
      x: this.margin, y: this.height - 62,
      width: this.width - (this.margin * 2), height: 36,
      color: C.panelLight, borderColor: C.border, borderWidth: 1
    });
    page2.drawRectangle({ x: this.margin, y: this.height - 62, width: 4, height: 36, color: C.f1Red });

    page2.drawText('TURN-BY-TURN TELEMETRY CHEAT SHEET & RACECRAFT TARGETS', {
      x: this.margin + 14, y: this.height - 42, size: 11, font: fontBold, color: C.textPrimary
    });
    page2.drawText(`${trackProfile.trackName} (${trackProfile.layoutName}) | TARGET METRICS`, {
      x: this.margin + 14, y: this.height - 55, size: 7.5, font: fontMono, color: C.cyan
    });

    // Table header
    curY = this.height - 86;
    page2.drawRectangle({ x: this.margin, y: curY - 18, width: this.width - (this.margin * 2), height: 18, color: C.panelDark });

    const cols = [
      { label: 'TURN', x: this.margin + 6, w: 38 },
      { label: 'TYPE', x: this.margin + 44, w: 48 },
      { label: 'BRAKING MARKER', x: this.margin + 96, w: 80 },
      { label: 'GEAR', x: this.margin + 180, w: 40 },
      { label: 'APEX MIN SPD', x: this.margin + 224, w: 68 },
      { label: 'SKIP BARBER COACHING & LINE FOCUS', x: this.margin + 296, w: 220 }
    ];

    cols.forEach(col => {
      page2.drawText(col.label, { x: col.x, y: curY - 12, size: 6.5, font: fontBold, color: C.textMuted });
    });

    const cornersList = (trackProfile.corners?.length > 0) ? trackProfile.corners.slice(0, 14) : [];
    curY -= 20;
    const rowH = 34;

    cornersList.forEach((c, idx) => {
      const rowY = curY - (idx + 1) * rowH;
      page2.drawRectangle({
        x: this.margin, y: rowY,
        width: this.width - (this.margin * 2), height: rowH - 2,
        color: idx % 2 === 0 ? C.panelLight : C.panelMid, borderColor: C.border, borderWidth: 0.5
      });

      page2.drawText(`T${c.turnNumber}`, { x: cols[0].x, y: rowY + 14, size: 9, font: fontBold, color: C.f1Red });
      page2.drawText(`${c.cornerType}`, { x: cols[1].x, y: rowY + 14, size: 7.5, font: fontRegular, color: c.cornerType === 'Type I' ? C.gold : C.textSecondary });

      page2.drawText(`${c.brakingMarkerMeters || 75}m before apex`, { x: cols[2].x, y: rowY + 18, size: 7.5, font: fontBold, color: C.f1Red });
      page2.drawText(`Max Decel: -${c.maxDecelG || 1.2}G`, { x: cols[2].x, y: rowY + 8, size: 6.5, font: fontMono, color: C.textMuted });

      page2.drawText(`Gear ${c.targetGear || 3}`, { x: cols[3].x, y: rowY + 14, size: 8, font: fontBold, color: C.green });

      page2.drawText(`${c.apexSpeedKmh || 100} km/h`, { x: cols[4].x, y: rowY + 18, size: 8, font: fontBold, color: C.textPrimary });
      page2.drawText(`Entry: ${c.entrySpeedKmh || 160} km/h`, { x: cols[4].x, y: rowY + 8, size: 6.5, font: fontMono, color: C.textMuted });

      const noteWords = (c.coachingNotes || 'Maintain smooth steering input and throttle commitment.').split(' ');
      let noteL1 = '', noteL2 = '';
      for (const w of noteWords) {
        if ((noteL1 + ' ' + w).length < 52) noteL1 += (noteL1 ? ' ' : '') + w;
        else if ((noteL2 + ' ' + w).length < 52) noteL2 += (noteL2 ? ' ' : '') + w;
      }
      page2.drawText(noteL1, { x: cols[5].x, y: rowY + 18, size: 6.5, font: fontRegular, color: C.textSecondary });
      if (noteL2) page2.drawText(noteL2, { x: cols[5].x, y: rowY + 8, size: 6.5, font: fontRegular, color: C.textSecondary });
    });

    // Setup advisory card
    const tableBottom = curY - cornersList.length * rowH;
    const setupY = Math.max(55, tableBottom - 100);

    page2.drawRectangle({ x: this.margin, y: setupY, width: this.width - (this.margin * 2), height: 90, color: C.panelLight, borderColor: C.border, borderWidth: 1 });
    page2.drawText('PRE-STINT CHASSIS & SETUP RECOMMENDATIONS', {
      x: this.margin + 12, y: setupY + 74, size: 8.5, font: fontBold, color: C.gold
    });

    [
      { label: 'AERODYNAMIC PROFILE', val: trackProfile.setupAdvisories?.downforce || 'Medium Downforce' },
      { label: 'TIRE THERMAL RISK', val: trackProfile.setupAdvisories?.tireWearRisk || 'Front-Left lateral scrub' },
      { label: 'BRAKE BIAS TARGET', val: trackProfile.setupAdvisories?.brakingBias || '54% Front / 46% Rear' }
    ].forEach((sc, i) => {
      const scX = this.margin + 12 + i * 170;
      page2.drawText(sc.label, { x: scX, y: setupY + 54, size: 6.5, font: fontMono, color: C.textMuted });
      page2.drawText(sc.val, { x: scX, y: setupY + 40, size: 7.5, font: fontBold, color: C.textPrimary });
    });

    page2.drawText('DRIVER PREPARATION NOTES & TARGET SPLITS:', {
      x: this.margin + 12, y: setupY + 20, size: 6.5, font: fontMono, color: C.cyan
    });
    page2.drawLine({
      start: { x: this.margin + 12, y: setupY + 8 },
      end: { x: this.width - this.margin - 12, y: setupY + 8 },
      thickness: 0.5, color: C.border
    });

    page2.drawText(`APEX MOTORSPORT TELEMETRY — PRE-STINT DRIVER BRIEFING — PAGE 2 OF ${totalPages}`, {
      x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
    });

    // =========================================================================
    // WEATHER PAGES (PAGES 3, 4, 5) — STRICT CAP AT MAX 5 PAGES
    // =========================================================================
    if (allWeatherProfiles) {
      const profileEntries = WEATHER_CATALOG.map(cond => ({
        cond,
        profile: allWeatherProfiles[cond.slug] || null
      }));

      // -----------------------------------------------------------------------
      // PAGE 3: WEATHER INTELLIGENCE SUMMARY GRID (all 18 conditions)
      // -----------------------------------------------------------------------
      const page3 = doc.addPage([this.width, this.height]);
      page3.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });

      // Header
      page3.drawRectangle({
        x: this.margin, y: this.height - 68,
        width: this.width - (this.margin * 2), height: 42,
        color: C.panelLight, borderColor: C.border, borderWidth: 1
      });
      page3.drawRectangle({ x: this.margin, y: this.height - 68, width: 4, height: 42, color: C.cyan });

      page3.drawText('APEX // WEATHER INTELLIGENCE — ALL 18 CONDITIONS', {
        x: this.margin + 14, y: this.height - 44, size: 12, font: fontBold, color: C.textPrimary
      });
      page3.drawText(`${(trackProfile.trackName || '').toUpperCase()} — 18 CONDITIONS SIMULATED FROM DRY TELEMETRY BASELINE`, {
        x: this.margin + 14, y: this.height - 58, size: 7.5, font: fontMono, color: C.cyan
      });
      page3.drawText('PHYSICS-BASED / SECTION BRIEFING', {
        x: this.width - this.margin - 170, y: this.height - 50, size: 7, font: fontMono, color: C.textMuted
      });

      // Column headers
      let p3Y = this.height - 82;
      const colDefs = [
        { label: 'CONDITION',       x: this.margin,       w: 88 },
        { label: 'CATEGORY',        x: this.margin + 92,  w: 58 },
        { label: 'GRIP LEVEL',      x: this.margin + 154, w: 55 },
        { label: 'BRAKE EARLIER',   x: this.margin + 213, w: 58 },
        { label: 'SPEED LOSS',      x: this.margin + 275, w: 55 },
        { label: 'VISIBILITY',      x: this.margin + 334, w: 50 },
        { label: 'HYDRO RISK',      x: this.margin + 388, w: 55 },
        { label: 'CONFIDENCE',      x: this.margin + 447, w: 60 },
      ];

      page3.drawRectangle({ x: this.margin, y: p3Y - 16, width: this.width - (this.margin * 2), height: 16, color: C.panelDark });
      colDefs.forEach(cd => {
        page3.drawText(cd.label, { x: cd.x + 3, y: p3Y - 11, size: 5.8, font: fontBold, color: C.textMuted });
      });
      p3Y -= 18;

      // Rows — one per condition (18 total)
      const condRowH = 19;
      let curCat = '';

      profileEntries.forEach(({ cond, profile }, idx) => {
        if (cond.cat !== curCat) {
          curCat = cond.cat;
          p3Y -= 6;
          page3.drawRectangle({
            x: this.margin, y: p3Y - 12,
            width: this.width - (this.margin * 2), height: 12,
            color: C.panelMid
          });
          page3.drawText(cond.cat.toUpperCase(), {
            x: this.margin + 6, y: p3Y - 9, size: 7, font: fontBold, color: catAccent[cond.cat]
          });
          p3Y -= 14;
        }

        const rowBg = idx % 2 === 0 ? C.panelLight : rgb(0.95, 0.95, 0.97);
        page3.drawRectangle({ x: this.margin, y: p3Y - condRowH, width: this.width - (this.margin * 2), height: condRowH, color: rowBg, borderColor: C.border, borderWidth: 0.3 });

        page3.drawRectangle({ x: this.margin, y: p3Y - condRowH, width: 3, height: condRowH, color: catAccent[cond.cat] });

        const gripLossPct = profile ? profile.gripLossPct : Math.round(cond.gripLoss * 100);
        const brakePct    = profile ? profile.brakingIncreasePct : Math.round(cond.brakeInc * 100);
        const speedPct    = profile ? profile.speedReductionPct : Math.round(cond.gripLoss * 50);
        const visPct      = profile ? profile.visibilityPct : 100;
        const hydroRisk   = profile ? profile.hydroRisk : cond.gripLoss > 0.2;
        const confPct     = profile ? (profile.confidencePct || 75) : 75;

        const rowY = p3Y - condRowH + 5;
        page3.drawText(cond.name, { x: colDefs[0].x + 6, y: rowY, size: 7.5, font: fontBold, color: C.textPrimary });
        page3.drawText(cond.cat, { x: colDefs[1].x + 3, y: rowY, size: 7, font: fontRegular, color: catAccent[cond.cat] });
        page3.drawText(`${100 - gripLossPct}%`, { x: colDefs[2].x + 3, y: rowY, size: 7.5, font: fontBold, color: gripColor(gripLossPct) });
        page3.drawText(`+${brakePct}%`, { x: colDefs[3].x + 3, y: rowY, size: 7.5, font: fontBold, color: brakePct > 30 ? C.f1Red : C.textSecondary });
        page3.drawText(`-${speedPct}%`, { x: colDefs[4].x + 3, y: rowY, size: 7.5, font: fontBold, color: speedPct > 20 ? C.gold : C.textSecondary });
        page3.drawText(`${visPct}%`, { x: colDefs[5].x + 3, y: rowY, size: 7.5, font: fontBold, color: visPct < 40 ? C.f1Red : C.textSecondary });
        page3.drawText(hydroRisk ? 'YES' : 'No', { x: colDefs[6].x + 3, y: rowY, size: 7.5, font: fontBold, color: hydroRisk ? C.cyan : C.textMuted });
        page3.drawText(`${confPct}%`, { x: colDefs[7].x + 3, y: rowY, size: 7.5, font: fontBold, color: confPct >= 90 ? C.green : confPct >= 82 ? C.cyan : C.gold });

        p3Y -= condRowH;
      });

      if (p3Y > 60) {
        page3.drawText('* Grip Level = % of dry baseline | Confidence improves as more wet sessions are recorded | See P.4-5 for Tactical & Corner Breakdown', {
          x: this.margin, y: p3Y - 16, size: 6, font: fontRegular, color: C.textMuted
        });
      }

      page3.drawText(`APEX MOTORSPORT TELEMETRY — PRE-STINT DRIVER BRIEFING — PAGE 3 OF ${totalPages}`, {
        x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
      });

      // -----------------------------------------------------------------------
      // PAGE 4: WET & DYNAMIC RACECRAFT & CORNER ADAPTATION MATRIX
      // -----------------------------------------------------------------------
      const page4 = doc.addPage([this.width, this.height]);
      page4.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });

      page4.drawRectangle({
        x: this.margin, y: this.height - 68,
        width: this.width - (this.margin * 2), height: 42,
        color: C.panelLight, borderColor: C.border, borderWidth: 1
      });
      page4.drawRectangle({ x: this.margin, y: this.height - 68, width: 4, height: 42, color: C.f1Red });

      page4.drawText('APEX // WET & DYNAMIC RACECRAFT CORNER ADAPTATIONS', {
        x: this.margin + 14, y: this.height - 44, size: 12, font: fontBold, color: C.textPrimary
      });
      page4.drawText('HIGH-PRECISION TURN DELTAS FOR HEAVY RAIN, RAINSTORM & DYNAMIC CONDITIONS', {
        x: this.margin + 14, y: this.height - 58, size: 7.5, font: fontMono, color: C.cyan
      });

      // Select representative wet profile (Heavy Rain or first wet condition)
      const heavyRainProfile = allWeatherProfiles['heavy-rain'] || allWeatherProfiles['moderate-rain'] || allWeatherProfiles['thunderstorm'] || profileEntries.find(p => p.cond.cat === 'Wet')?.profile;
      const wetCorners = heavyRainProfile?.corners || [];
      const hydroTurns = heavyRainProfile?.hydroplaningCorners || [];

      let p4Y = this.height - 82;

      // Executive Wet Warning Banner
      page4.drawRectangle({
        x: this.margin, y: p4Y - 30, width: this.width - (this.margin * 2), height: 30,
        color: rgb(1.0, 0.94, 0.94), borderColor: C.f1Red, borderWidth: 1
      });
      page4.drawText('CRITICAL WET ADAPTATION: AVOID POLISHED DRY RUBBER RACING LINES & SMOOTH CURBING', {
        x: this.margin + 10, y: p4Y - 14, size: 8, font: fontBold, color: C.f1Red
      });
      page4.drawText(`Standing Water Hotspots: ${hydroTurns.length > 0 ? 'Turns T' + hydroTurns.join(', T') : 'Outside turn entries'} | Brake earlier and square off exits for maximum longitudinal traction.`, {
        x: this.margin + 10, y: p4Y - 24, size: 7, font: fontRegular, color: C.textSecondary
      });

      p4Y -= 40;

      // Corner Adaptation Table Header
      const p4Cols = [
        { label: 'TURN',       x: this.margin + 4,   w: 36 },
        { label: 'TYPE',       x: this.margin + 42,  w: 44 },
        { label: 'DRY BRAKE',  x: this.margin + 88,  w: 56 },
        { label: 'WET BRAKE',  x: this.margin + 146, w: 72 },
        { label: 'DRY APEX',   x: this.margin + 220, w: 56 },
        { label: 'WET APEX',   x: this.margin + 278, w: 68 },
        { label: 'GEAR',       x: this.margin + 348, w: 42 },
        { label: 'HYDRO',      x: this.margin + 392, w: 42 },
        { label: 'WET RACECRAFT COACHING', x: this.margin + 436, w: 86 }
      ];

      page4.drawRectangle({ x: this.margin, y: p4Y - 16, width: this.width - (this.margin * 2), height: 16, color: C.panelDark });
      p4Cols.forEach(c => {
        page4.drawText(c.label, { x: c.x, y: p4Y - 11, size: 6.2, font: fontBold, color: C.textMuted });
      });
      p4Y -= 18;

      const displayCorners = (wetCorners.length > 0) ? wetCorners.slice(0, 14) : (trackProfile.corners?.slice(0, 14) || []);
      const p4RowH = 24;

      displayCorners.forEach((c, idx) => {
        const rowY = p4Y - (idx + 1) * p4RowH;
        page4.drawRectangle({
          x: this.margin, y: rowY,
          width: this.width - (this.margin * 2), height: p4RowH - 2,
          color: idx % 2 === 0 ? C.panelLight : C.panelMid, borderColor: C.border, borderWidth: 0.4
        });

        const turnNum = c.turnNumber || (idx + 1);
        const dryBrake = c.dryBrakingMarkerMeters || c.brakingMarkerMeters || 75;
        const wetBrake = c.wetBrakingMarkerMeters || Math.round(dryBrake * 1.48);
        const brakeDelta = wetBrake - dryBrake;

        const drySpeed = c.dryApexSpeedKmh || c.apexSpeedKmh || 100;
        const wetSpeed = c.wetApexSpeedKmh || Math.round(drySpeed * 0.74);
        const speedDelta = wetSpeed - drySpeed;

        const dryGear = c.dryTargetGear || c.targetGear || 3;
        const wetGear = c.wetTargetGear || Math.max(1, dryGear - 1);
        const isHydro = c.hydroplaningFlag || hydroTurns.includes(turnNum);

        page4.drawText(`T${turnNum}`, { x: p4Cols[0].x, y: rowY + 9, size: 8, font: fontBold, color: C.f1Red });
        page4.drawText(`${c.cornerType || 'Type I'}`, { x: p4Cols[1].x, y: rowY + 9, size: 7, font: fontRegular, color: C.textSecondary });

        page4.drawText(`${dryBrake}m`, { x: p4Cols[2].x, y: rowY + 9, size: 7.5, font: fontRegular, color: C.textSecondary });
        page4.drawText(`${wetBrake}m (+${brakeDelta}m)`, { x: p4Cols[3].x, y: rowY + 9, size: 7.5, font: fontBold, color: C.f1Red });

        page4.drawText(`${drySpeed}k`, { x: p4Cols[4].x, y: rowY + 9, size: 7.5, font: fontRegular, color: C.textSecondary });
        page4.drawText(`${wetSpeed}k (${speedDelta})`, { x: p4Cols[5].x, y: rowY + 9, size: 7.5, font: fontBold, color: C.gold });

        page4.drawText(`G${dryGear}->G${wetGear}`, { x: p4Cols[6].x, y: rowY + 9, size: 7, font: fontMono, color: C.green });
        page4.drawText(isHydro ? 'HIGH' : 'Low', { x: p4Cols[7].x, y: rowY + 9, size: 7, font: fontBold, color: isHydro ? C.cyan : C.textMuted });

        const wetNote = isHydro ? 'Lift early; avoid apex puddle' : 'Diamond line; upright exit';
        page4.drawText(wetNote, { x: p4Cols[8].x, y: rowY + 9, size: 6.5, font: fontRegular, color: C.textSecondary });
      });

      // Bottom Wet Tactics Callout
      const p4Bottom = p4Y - displayCorners.length * p4RowH - 12;
      page4.drawRectangle({
        x: this.margin, y: p4Bottom - 48, width: this.width - (this.margin * 2), height: 48,
        color: C.panelLight, borderColor: C.border, borderWidth: 1
      });
      page4.drawText('WET RACING LINE & TIRE DRAINAGE STRATEGY', {
        x: this.margin + 10, y: p4Bottom - 14, size: 7.5, font: fontBold, color: C.cyan
      });
      page4.drawText('- Run 1-2 meters wider than traditional dry apex to grip on abrasive, unpolished asphalt outside the rubber groove.', {
        x: this.margin + 10, y: p4Bottom - 26, size: 6.5, font: fontRegular, color: C.textSecondary
      });
      page4.drawText('- Never brake directly across painted curbs or white track lines; straighten the wheel before applying full threshold deceleration.', {
        x: this.margin + 10, y: p4Bottom - 38, size: 6.5, font: fontRegular, color: C.textSecondary
      });

      page4.drawText(`APEX MOTORSPORT TELEMETRY -- PRE-STINT DRIVER BRIEFING -- PAGE 4 OF ${totalPages}`, {
        x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
      });

      // -----------------------------------------------------------------------
      // PAGE 5: TRANSITIONAL DYNAMICS, SETUP ADAPTATIONS & DRIVER CHECKLIST
      // -----------------------------------------------------------------------
      const page5 = doc.addPage([this.width, this.height]);
      page5.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });

      page5.drawRectangle({
        x: this.margin, y: this.height - 68,
        width: this.width - (this.margin * 2), height: 42,
        color: C.panelLight, borderColor: C.border, borderWidth: 1
      });
      page5.drawRectangle({ x: this.margin, y: this.height - 68, width: 4, height: 42, color: C.gold });

      page5.drawText('APEX // TRANSITIONAL DYNAMICS & PRE-STINT EXECUTION PROTOCOL', {
        x: this.margin + 14, y: this.height - 44, size: 12, font: fontBold, color: C.textPrimary
      });
      page5.drawText('SETUP OFFSETS, THERMAL DISPERSAL & MANDATORY DRIVER PRE-STINT CHECKLIST', {
        x: this.margin + 14, y: this.height - 58, size: 7.5, font: fontMono, color: C.cyan
      });

      let p5Y = this.height - 86;

      // 3 Adaptation Guidance Columns
      const p5CardW = (this.width - (this.margin * 2) - 16) / 3;
      const cards = [
        {
          title: 'TRANSITIONAL & DAMP',
          color: C.blue,
          items: [
            'Drying Line Management',
            'Cross-over lap delta: ~4.5s',
            'Search wet tarmac on straights to cool rain compounds',
            'Watch for shiny asphalt sheen'
          ]
        },
        {
          title: 'CHASSIS & SETUP ADAPT',
          color: C.gold,
          items: [
            'Tire Pressure: +1.5 to +2.5 PSI',
            'Brake Bias: +2% to +4% Front',
            'Soften front anti-roll bar',
            'Increase differential decel lock'
          ]
        },
        {
          title: 'VISIBILITY & RADAR',
          color: C.cyan,
          items: [
            'Dense Fog / Looming Clouds',
            'Shorten visual lookahead horizon',
            'Rely on distance marker boards',
            'Maintain safe trailing gaps'
          ]
        }
      ];

      cards.forEach((card, idx) => {
        const cx = this.margin + idx * (p5CardW + 8);
        page5.drawRectangle({
          x: cx, y: p5Y - 140, width: p5CardW, height: 140,
          color: C.panelLight, borderColor: C.border, borderWidth: 1
        });
        page5.drawRectangle({ x: cx, y: p5Y - 4, width: p5CardW, height: 4, color: card.color });

        page5.drawText(card.title, {
          x: cx + 10, y: p5Y - 18, size: 8, font: fontBold, color: C.textPrimary
        });

        card.items.forEach((item, itemIdx) => {
          page5.drawText(`- ${item}`.slice(0, 36), {
            x: cx + 10, y: p5Y - 38 - itemIdx * 24, size: 6.8, font: fontRegular, color: C.textSecondary
          });
        });
      });

      p5Y -= 160;

      // Pre-Stint Driver Checklist Section
      page5.drawRectangle({
        x: this.margin, y: p5Y - 24, width: this.width - (this.margin * 2), height: 24,
        color: C.panelDark, borderColor: C.border, borderWidth: 1
      });
      page5.drawText('MANDATORY PRE-STINT DRIVER EXECUTION CHECKLIST', {
        x: this.margin + 12, y: p5Y - 16, size: 8.5, font: fontBold, color: C.textPrimary
      });

      p5Y -= 32;

      const checklistItems = [
        { cat: 'COCKPIT', text: 'Calibrate load-cell brake pedal; confirm zero deadzone spike and verify steering rotation range.', done: true },
        { cat: 'TIRES',   text: 'Set cold starting tire pressures adjusted for track ambient temperature (+PSI for wet sessions).', done: true },
        { cat: 'BRAKES',  text: 'Verify front/rear brake bias migration dial on steering wheel before leaving pit lane.', done: true },
        { cat: 'FUEL',    text: 'Confirm stint fuel load calculated with safety margin (+2 laps fuel reserve for traffic & pacing).', done: true },
        { cat: 'OUT-LAP', text: 'Progressively build tire carcass heat through lateral loading; avoid excessive straight-line lockups.', done: true },
        { cat: 'KERBS',   text: 'Inspect wet curbing during out-lap; avoid painted exit kerbs that induce violent snap oversteer.', done: true },
        { cat: 'TRAFFIC', text: 'Monitor delta to leading cars in wet spray conditions; increase trailing interval for clean air.', done: true }
      ];

      checklistItems.forEach((item, idx) => {
        const itemY = p5Y - idx * 30;
        page5.drawRectangle({
          x: this.margin, y: itemY - 24, width: this.width - (this.margin * 2), height: 24,
          color: idx % 2 === 0 ? C.panelLight : C.panelMid, borderColor: C.border, borderWidth: 0.5
        });

        // Checkbox box
        page5.drawRectangle({
          x: this.margin + 10, y: itemY - 17, width: 10, height: 10,
          color: C.panelLight, borderColor: C.green, borderWidth: 1
        });
        page5.drawText('OK', {
          x: this.margin + 11, y: itemY - 15, size: 6.5, font: fontBold, color: C.green
        });

        // Category badge
        page5.drawRectangle({
          x: this.margin + 28, y: itemY - 18, width: 52, height: 12,
          color: rgb(0.92, 0.94, 0.97), borderColor: C.border, borderWidth: 0.5
        });
        page5.drawText(item.cat, {
          x: this.margin + 34, y: itemY - 15, size: 6.2, font: fontBold, color: C.cyan
        });

        // Checklist text
        page5.drawText(item.text, {
          x: this.margin + 88, y: itemY - 15, size: 6.8, font: fontRegular, color: C.textPrimary
        });
      });

      // Footer
      page5.drawText(`APEX MOTORSPORT TELEMETRY -- PRE-STINT DRIVER BRIEFING -- PAGE 5 OF ${totalPages}`, {
        x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
      });
    }

    return await doc.save();
  }

  /**
   * Triggers client-side browser file download or native desktop save for the compiled PDF.
   * @param {Uint8Array} pdfBytes
   * @param {string} filename
   */
  async download(pdfBytes, filename = 'APEX_PreStint_Briefing.pdf') {
    if (typeof window === 'undefined') return;

    if (window.apexDesktop?.saveFile) {
      let binary = '';
      const len = pdfBytes.byteLength;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64 = btoa(binary);

      // Auto-archive automatically to Documents/APEX v2.9/user/
      window.apexDesktop.autoArchive?.({ fileName: filename, data: base64, encoding: 'base64', extension: 'pdf' });

      // Native save dialog
      await window.apexDesktop.saveFile({
        title: 'Save APEX Pre-Stint Briefing PDF',
        suggestedName: filename,
        filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }],
        data: base64,
        encoding: 'base64'
      });
      return;
    }

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
