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
      // Draw a white "halo" stroke first for readability on light bg
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1], p2 = points[i];
        const x1 = offsetX + (p1.x - minX) * scale;
        const y1 = offsetY + (p1.z - minZ) * scale;
        const x2 = offsetX + (p2.x - minX) * scale;
        const y2 = offsetY + (p2.z - minZ) * scale;
        page1.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 5, color: C.panelLight });
      }

      // Colored segments
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

      // ── Section number markers (every ~10% of track, on the centerline) ──
      const sectionCount = 10;
      for (let s = 0; s < sectionCount; s++) {
        const idx = Math.floor((s / sectionCount) * (points.length - 1));
        const p = points[idx];
        const sx = offsetX + (p.x - minX) * scale;
        const sy = offsetY + (p.z - minZ) * scale;
        const sNum = `${s + 1}`;

        // Diamond marker
        page1.drawLine({ start: { x: sx - 4, y: sy }, end: { x: sx, y: sy + 4 }, thickness: 1, color: C.borderStrong });
        page1.drawLine({ start: { x: sx, y: sy + 4 }, end: { x: sx + 4, y: sy }, thickness: 1, color: C.borderStrong });
        page1.drawLine({ start: { x: sx + 4, y: sy }, end: { x: sx, y: sy - 4 }, thickness: 1, color: C.borderStrong });
        page1.drawLine({ start: { x: sx, y: sy - 4 }, end: { x: sx - 4, y: sy }, thickness: 1, color: C.borderStrong });

        page1.drawText(sNum, {
          x: sx - (sNum.length > 1 ? 5 : 3), y: sy - 3,
          size: 5, font: fontBold, color: C.textSecondary
        });
      }

      // ── Turn Pin Annotations (circles + large labels) ─────────────────────
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

        // White halo circle
        page1.drawCircle({ x: pinX, y: pinY, size: 9, color: C.panelLight, borderColor: C.border, borderWidth: 1.5 });
        // Colored fill
        page1.drawCircle({ x: pinX, y: pinY, size: 7, color: C.f1Red });

        // Turn label — offset slightly to avoid overlap with the path
        page1.drawText(label, {
          x: pinX + 9, y: pinY - 3,
          size: 7.5, font: fontBold, color: C.textPrimary
        });
      });
    } else {
      // No GPS data placeholder
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

    page1.drawText('APEX MOTORSPORT TELEMETRY — PRE-STINT DRIVER BRIEFING — PAGE 1', {
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

    page2.drawText('APEX MOTORSPORT TELEMETRY — PRE-STINT DRIVER BRIEFING — PAGE 2', {
      x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
    });

    // =========================================================================
    // WEATHER SECTION: only if profiles are provided
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

      page3.drawText('APEX // WEATHER INTELLIGENCE — ALL CONDITIONS', {
        x: this.margin + 14, y: this.height - 44, size: 12, font: fontBold, color: C.textPrimary
      });
      page3.drawText(`${(trackProfile.trackName || '').toUpperCase()} — 18 CONDITIONS SIMULATED FROM DRY TELEMETRY BASELINE`, {
        x: this.margin + 14, y: this.height - 58, size: 7.5, font: fontMono, color: C.cyan
      });
      page3.drawText('PHYSICS-BASED / SEE P.4+ FOR CORNER DETAIL', {
        x: this.width - this.margin - 190, y: this.height - 50, size: 7, font: fontMono, color: C.textMuted
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
        // Category separator row
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

        // Accent left bar per category
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

      // Legend note at bottom
      if (p3Y > 60) {
        page3.drawText('* Grip Level = % of dry baseline | Confidence improves as more wet sessions are recorded | See Pages 4+ for corner-by-corner detail', {
          x: this.margin, y: p3Y - 16, size: 6, font: fontRegular, color: C.textMuted
        });
      }

      page3.drawText('APEX MOTORSPORT — WEATHER INTELLIGENCE BRIEFING — PAGE 3', {
        x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
      });

      // -----------------------------------------------------------------------
      // PAGES 4+: Per-condition corner tables (grouped by category, 2 per page)
      // -----------------------------------------------------------------------
      let condPage = null;
      let condY = 0;
      let condOnPage = 0;
      let globalPageNum = 4;

      const startNewCondPage = () => {
        condPage = doc.addPage([this.width, this.height]);
        condPage.drawRectangle({ x: 0, y: 0, width: this.width, height: this.height, color: C.bg });
        condPage.drawText(`APEX MOTORSPORT — WEATHER INTELLIGENCE — CORNER DETAIL — PAGE ${globalPageNum}`, {
          x: this.margin, y: 22, size: 7, font: fontMono, color: C.textMuted
        });
        globalPageNum++;
        condY = this.height - 30;
        condOnPage = 0;
      };

      for (const { cond, profile } of profileEntries) {
        if (!profile) continue;

        // Start new page when needed (2 conditions per page)
        if (!condPage || condOnPage >= 2 || condY < 260) {
          startNewCondPage();
        }

        const accent = catAccent[cond.cat];
        const corners = profile.corners || [];

        // Condition section header
        condY -= 8;
        condPage.drawRectangle({
          x: this.margin, y: condY - 24,
          width: this.width - (this.margin * 2), height: 24,
          color: C.panelLight, borderColor: C.border, borderWidth: 1
        });
        condPage.drawRectangle({ x: this.margin, y: condY - 24, width: 4, height: 24, color: accent });

        condPage.drawText(cond.name.toUpperCase(), {
          x: this.margin + 10, y: condY - 10, size: 10, font: fontBold, color: C.textPrimary
        });
        condPage.drawText(`${cond.cat.toUpperCase()} · GRIP: ${100 - profile.gripLossPct}% OF DRY · BRAKE EARLIER: +${profile.brakingIncreasePct}% · SPEED LOSS: -${profile.speedReductionPct}%`, {
          x: this.margin + 10, y: condY - 20, size: 6.5, font: fontMono, color: accent
        });
        condPage.drawText(`${profile.confidencePct || 75}% CONFIDENCE`, {
          x: this.width - this.margin - 90, y: condY - 10, size: 7, font: fontMono, color: C.textMuted
        });

        // Aquaplaning alert
        condY -= 30;
        if (profile.hydroplaningCorners?.length > 0) {
          condPage.drawRectangle({
            x: this.margin, y: condY - 14, width: this.width - (this.margin * 2), height: 14,
            color: rgb(0.90, 0.97, 1.0), borderColor: C.cyan, borderWidth: 1
          });
          condPage.drawText(`AQUAPLANING RISK: T${profile.hydroplaningCorners.join(', T')} — Lift throttle. Do NOT brake while aquaplaning.`, {
            x: this.margin + 6, y: condY - 10, size: 7, font: fontBold, color: C.cyan
          });
          condY -= 18;
        }

        // Corner table header
        const cColW  = [22, 52, 52, 52, 52, 24, 24, 56, 50, 50];
        const cColX  = [this.margin + 2];
        for (let i = 1; i < cColW.length; i++) cColX.push(cColX[i - 1] + cColW[i - 1] + 1);
        const cHdrs  = ['T#', 'DRY BRAKE', 'WET BRAKE', 'DRY APEX', 'WET APEX', 'DGR', 'WGR', 'AQUAPLANE', 'STRATEGY', 'CHECKLIST'];

        condPage.drawRectangle({ x: this.margin, y: condY - 14, width: this.width - (this.margin * 2), height: 14, color: C.panelDark });
        cHdrs.forEach((h, i) => {
          condPage.drawText(h, { x: cColX[i] + 2, y: condY - 10, size: 5.5, font: fontBold, color: C.textMuted });
        });
        condY -= 16;

        // Corner rows
        corners.slice(0, 12).forEach((corner, ri) => {
          if (condY < 60) return;
          const rBg = ri % 2 === 0 ? C.panelLight : C.panelMid;
          condPage.drawRectangle({ x: this.margin, y: condY - 12, width: this.width - (this.margin * 2), height: 12, color: rBg, borderColor: C.border, borderWidth: 0.2 });

          const brakeD = corner.wetBrakingMarkerMeters - corner.dryBrakingMarkerMeters;
          const speedD = corner.wetApexSpeedKmh - corner.dryApexSpeedKmh;
          const gearCh = corner.wetTargetGear < corner.dryTargetGear;

          const rowVals = [
            `T${corner.turnNumber}`,
            `${corner.dryBrakingMarkerMeters}m`,
            `${corner.wetBrakingMarkerMeters}m(+${brakeD})`,
            `${corner.dryApexSpeedKmh}k`,
            `${corner.wetApexSpeedKmh}k(${speedD})`,
            `G${corner.dryTargetGear}`,
            `G${corner.wetTargetGear}${gearCh ? 'v' : ''}`,
            corner.hydroplaningFlag ? 'HIGH' : 'Low',
            '',
            '',
          ];

          const rowColors = [
            C.f1Red, C.textSecondary, accent, C.textSecondary, accent,
            C.textSecondary, gearCh ? accent : C.textSecondary,
            corner.hydroplaningFlag ? C.cyan : C.textMuted,
            C.textMuted, C.textMuted
          ];

          rowVals.forEach((val, i) => {
            if (i >= 8) return; // strategy/checklist columns reserved
            condPage.drawText(val, {
              x: cColX[i] + 2, y: condY - 9,
              size: 6.5, font: i === 2 || i === 4 || i === 6 ? fontBold : fontRegular,
              color: rowColors[i]
            });
          });

          condY -= 12;
        });

        // Strategy note inline
        if (profile.strategy && condY > 60) {
          condY -= 4;
          const stratLine = `Line: ${profile.strategy.line} | Tires: ${profile.strategy.tires}`.slice(0, 95);
          condPage.drawText(stratLine, { x: this.margin + 6, y: condY, size: 6, font: fontRegular, color: C.textSecondary });
          condY -= 10;
        }

        condY -= 10;
        condOnPage++;
      }
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

      // Auto-archive in background to Documents/APEX Telemetry/Reports/
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
