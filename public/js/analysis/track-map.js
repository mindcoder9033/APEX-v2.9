/**
 * APEX 2D Vector Track Map & Line Analysis Engine (Browser ES Module)
 * Generates normalized 2D circuit geometry, multi-color driving state paths,
 * turn annotations, and problem zone highlights per Skip Barber "Going Faster!".
 */

export const DRIVING_STATE = {
  FULL_THROTTLE: 'FULL_THROTTLE',       // Throttle > 80%
  PARTIAL_THROTTLE: 'PARTIAL_THROTTLE', // Throttle 5%-80%, Brake <= 10%
  BRAKING: 'BRAKING',                   // Brake > 10%
  COASTING: 'COASTING'                  // Throttle <= 5%, Brake <= 10%
};

export const STATE_COLORS = {
  FULL_THROTTLE: { hex: '#00CC66', rgb: [0.0, 0.80, 0.40], label: 'Full Throttle (>80%)' },
  PARTIAL_THROTTLE: { hex: '#E5A910', rgb: [0.90, 0.66, 0.06], label: 'Partial Throttle' },
  BRAKING: { hex: '#E10600', rgb: [0.882, 0.024, 0.0], label: 'Braking (>10%)' },
  COASTING: { hex: '#0099FF', rgb: [0.0, 0.60, 1.0], label: 'Coasting / Lifting' }
};

export class TrackMapGenerator {
  constructor(options = {}) {
    this.padding = options.padding || 30;
    this.minSegmentDistance = options.minSegmentDistance || 0.5;
  }

  /**
   * Classifies a telemetry sample into a driving state
   * @param {Object} sample Telemetry sample
   * @returns {string} One of DRIVING_STATE values
   */
  classifyDrivingState(sample) {
    const throttle = sample.inputs?.throttle ?? 0;
    const brake = sample.inputs?.brake ?? 0;

    if (brake > 0.10) {
      return DRIVING_STATE.BRAKING;
    }
    if (throttle > 0.80) {
      return DRIVING_STATE.FULL_THROTTLE;
    }
    if (throttle > 0.05) {
      return DRIVING_STATE.PARTIAL_THROTTLE;
    }
    return DRIVING_STATE.COASTING;
  }

  /**
   * Extracts raw coordinates from telemetry samples
   * @param {Array<Object>} samples 
   * @returns {Array<{x: number, z: number, sample: Object, index: number}>}
   */
  extractRawPoints(samples) {
    if (!samples || samples.length === 0) return [];

    return samples.map((s, idx) => {
      const x = s.motion?.position?.x ?? s.positionX ?? s.posX ?? 0;
      const z = s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? 0;
      return { x, z, sample: s, index: idx };
    });
  }

  /**
   * Normalizes 2D coordinates into a target bounding box preserving 1:1 aspect ratio
   * @param {Array<Object>} rawPoints 
   * @param {number} targetWidth 
   * @param {number} targetHeight 
   * @param {number} padding 
   * @param {boolean} flipY Flip Y axis for PDF/SVG coordinates
   * @returns {{points: Array, bounds: Object, scale: number}}
   */
  normalizeCoordinates(rawPoints, targetWidth = 600, targetHeight = 400, padding = 30, flipY = false) {
    if (!rawPoints || rawPoints.length === 0) {
      return { points: [], bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, height: 0 }, scale: 1 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of rawPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const rangeX = (maxX - minX) || 1;
    const rangeZ = (maxZ - minZ) || 1;

    const usableW = Math.max(10, targetWidth - (padding * 2));
    const usableH = Math.max(10, targetHeight - (padding * 2));

    const scale = Math.min(usableW / rangeX, usableH / rangeZ);

    const mappedW = rangeX * scale;
    const mappedH = rangeZ * scale;

    const offsetX = padding + (usableW - mappedW) / 2;
    const offsetZ = padding + (usableH - mappedH) / 2;

    const points = rawPoints.map(p => {
      const normX = offsetX + (p.x - minX) * scale;
      const normY = flipY
        ? offsetZ + (maxZ - p.z) * scale
        : offsetZ + (p.z - minZ) * scale;

      return {
        ...p,
        normX,
        normY,
        state: this.classifyDrivingState(p.sample)
      };
    });

    return {
      points,
      bounds: { minX, maxX, minZ, maxZ, rangeX, rangeZ, mappedW, mappedH, offsetX, offsetZ },
      scale
    };
  }

  /**
   * Segments continuous normalized points into multi-colored path segments
   * @param {Array<Object>} normalizedPoints 
   * @returns {Array<Object>} List of path segments with state, stroke, and point list
   */
  segmentPath(normalizedPoints) {
    if (!normalizedPoints || normalizedPoints.length < 2) return [];

    const segments = [];
    let currentSegment = {
      state: normalizedPoints[0].state,
      color: STATE_COLORS[normalizedPoints[0].state],
      points: [normalizedPoints[0]]
    };

    for (let i = 1; i < normalizedPoints.length; i++) {
      const pt = normalizedPoints[i];
      if (pt.state === currentSegment.state) {
        currentSegment.points.push(pt);
      } else {
        // Close current segment and bridge to next
        currentSegment.points.push(pt);
        segments.push(currentSegment);

        currentSegment = {
          state: pt.state,
          color: STATE_COLORS[pt.state],
          points: [pt]
        };
      }
    }

    if (currentSegment.points.length > 1) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Maps detected corners and coaching findings to normalized coordinates
   * @param {Array<Object>} corners 
   * @param {Array<Object>} normalizedPoints 
   * @param {Array<Object>} findings 
   * @returns {Array<Object>} Turn marker overlays with coordinates and problem tags
   */
  computeTurnOverlays(corners = [], normalizedPoints = [], findings = []) {
    if (!corners || corners.length === 0 || !normalizedPoints || normalizedPoints.length === 0) {
      return [];
    }

    const pointCount = normalizedPoints.length;

    return corners.map((corner) => {
      let targetIndex = 0;
      if (corner.indices && typeof corner.indices.apexIndex === 'number') {
        targetIndex = Math.max(0, Math.min(pointCount - 1, corner.indices.apexIndex));
      } else {
        targetIndex = Math.floor((corner.cornerNumber / (corners.length + 1)) * pointCount);
      }

      const apexPt = normalizedPoints[targetIndex] || normalizedPoints[0];

      const cornerFindings = (findings || []).filter(f => f.cornerNumber === corner.cornerNumber);
      const hasSevereFault = cornerFindings.some(f => f.severity === 'High');
      const hasMediumFault = cornerFindings.some(f => f.severity === 'Medium');

      return {
        cornerNumber: corner.cornerNumber,
        type: corner.type || 'Corner',
        apexSpeedMph: corner.speed?.apexMph || 0,
        entrySpeedMph: corner.speed?.entryMph || 0,
        exitSpeedMph: corner.speed?.exitMph || 0,
        tapDeltaFeet: corner.dynamics?.tapDeltaFeet || 0,
        x: apexPt.normX,
        y: apexPt.normY,
        findings: cornerFindings,
        status: hasSevereFault ? 'CRITICAL' : (hasMediumFault ? 'WARNING' : 'OPTIMAL'),
        badgeColor: hasSevereFault ? '#E10600' : (hasMediumFault ? '#E5A910' : '#00CC66')
      };
    });
  }

  /**
   * Generates complete SVG markup for web UI Pit-Wall dashboard
   * @param {Array<Object>} samples 
   * @param {Array<Object>} corners 
   * @param {Array<Object>} findings 
   * @param {Object} options 
   * @returns {string} SVG HTML string
   */
  generateSvg(samples, corners = [], findings = [], options = {}) {
    const width = options.width || 760;
    const height = options.height || 420;
    const padding = options.padding || 35;

    const rawPoints = this.extractRawPoints(samples);
    if (rawPoints.length < 2) {
      return `<svg viewBox="0 0 ${width} ${height}" class="track-map-svg" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#0A0A0A" rx="8"/>
        <text x="${width / 2}" y="${height / 2}" fill="#666" font-family="monospace" font-size="12" text-anchor="middle">
          Awaiting telemetry track coordinates...
        </text>
      </svg>`;
    }

    const { points } = this.normalizeCoordinates(rawPoints, width, height, padding, false);
    const segments = this.segmentPath(points);
    const turnOverlays = this.computeTurnOverlays(corners, points, findings);
    const startFinish = points[0];

    const pathElements = segments.map((seg, sIdx) => {
      const d = seg.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.normX.toFixed(1)} ${p.normY.toFixed(1)}`).join(' ');
      return `<path id="seg-${sIdx}" d="${d}" stroke="${seg.color.hex}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" class="track-segment ${seg.state.toLowerCase()}" />`;
    }).join('\n');

    const turnElements = turnOverlays.map(turn => {
      const isAlert = turn.status !== 'OPTIMAL';
      const pulseRing = isAlert ? `
        <circle cx="${turn.x.toFixed(1)}" cy="${turn.y.toFixed(1)}" r="14" fill="none" stroke="${turn.badgeColor}" stroke-width="1.5" opacity="0.6">
          <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
        </circle>` : '';

      return `
        <g class="turn-overlay-marker" data-turn="${turn.cornerNumber}" data-status="${turn.status}" transform="translate(0, 0)">
          ${pulseRing}
          <circle cx="${turn.x.toFixed(1)}" cy="${turn.y.toFixed(1)}" r="8" fill="#141414" stroke="${turn.badgeColor}" stroke-width="2" />
          <text x="${turn.x.toFixed(1)}" y="${(turn.y + 3).toFixed(1)}" fill="#FFFFFF" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="bold" text-anchor="middle">T${turn.cornerNumber}</text>
        </g>
      `;
    }).join('\n');

    const sfElement = startFinish ? `
      <g class="start-finish-marker">
        <circle cx="${startFinish.normX.toFixed(1)}" cy="${startFinish.normY.toFixed(1)}" r="10" fill="#E10600" opacity="0.3"/>
        <rect x="${(startFinish.normX - 3).toFixed(1)}" y="${(startFinish.normY - 7).toFixed(1)}" width="6" height="14" fill="#FFFFFF" rx="1"/>
        <rect x="${(startFinish.normX - 3).toFixed(1)}" y="${(startFinish.normY - 7).toFixed(1)}" width="3" height="3.5" fill="#000000"/>
        <rect x="${startFinish.normX.toFixed(1)}" y="${(startFinish.normY - 3.5).toFixed(1)}" width="3" height="3.5" fill="#000000"/>
        <rect x="${(startFinish.normX - 3).toFixed(1)}" y="${startFinish.normY.toFixed(1)}" width="3" height="3.5" fill="#000000"/>
        <rect x="${startFinish.normX.toFixed(1)}" y="${(startFinish.normY + 3.5).toFixed(1)}" width="3" height="3.5" fill="#000000"/>
        <text x="${(startFinish.normX + 12).toFixed(1)}" y="${(startFinish.normY + 4).toFixed(1)}" fill="#AAAAAA" font-family="'Rajdhani', sans-serif" font-size="10" font-weight="700">S/F</text>
      </g>
    ` : '';

    return `<svg viewBox="0 0 ${width} ${height}" class="track-map-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1A1A1A" stroke-width="0.75" />
        </pattern>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Background Grid -->
      <rect width="${width}" height="${height}" fill="#0A0A0A" rx="4"/>
      <rect width="${width}" height="${height}" fill="url(#grid-pattern)" rx="4"/>

      <!-- Track Boundary Glow Base -->
      <g filter="url(#glow)" opacity="0.45">
        ${pathElements}
      </g>

      <!-- Main Track Path Segments -->
      <g class="track-segments-group">
        ${pathElements}
      </g>

      <!-- Start/Finish Gate -->
      ${sfElement}

      <!-- Turn Annotations -->
      <g class="turn-markers-group">
        ${turnElements}
      </g>
    </svg>`;
  }

  /**
   * Prepares vector data specifically formatted for direct pdf-lib drawing
   * @param {Array<Object>} samples 
   * @param {Array<Object>} corners 
   * @param {Array<Object>} findings 
   * @param {Object} bounds Box options { x, y, width, height, padding }
   * @returns {Object} PDF vector primitives
   */
  generatePdfVectorData(samples, corners = [], findings = [], bounds = {}) {
    const originX = bounds.x || 36;
    const originY = bounds.y || 200;
    const boxW = bounds.width || 523.28;
    const boxH = bounds.height || 260;
    const padding = bounds.padding || 24;

    const rawPoints = this.extractRawPoints(samples);
    if (rawPoints.length < 2) {
      return {
        box: { x: originX, y: originY, width: boxW, height: boxH },
        segments: [],
        turnMarkers: [],
        startFinish: null,
        issues: []
      };
    }

    const { points } = this.normalizeCoordinates(rawPoints, boxW, boxH, padding, true);
    
    const pdfPoints = points.map(p => ({
      ...p,
      pdfX: originX + p.normX,
      pdfY: originY + p.normY
    }));

    const segments = [];
    for (let i = 0; i < pdfPoints.length - 1; i++) {
      const p1 = pdfPoints[i];
      const p2 = pdfPoints[i + 1];
      segments.push({
        x1: p1.pdfX,
        y1: p1.pdfY,
        x2: p2.pdfX,
        y2: p2.pdfY,
        state: p1.state,
        color: STATE_COLORS[p1.state]
      });
    }

    const turnOverlays = this.computeTurnOverlays(corners, points, findings);
    const pdfTurnMarkers = turnOverlays.map(turn => ({
      ...turn,
      pdfX: originX + turn.x,
      pdfY: originY + turn.y
    }));

    const lineIssues = [];
    findings.forEach(f => {
      if (['R-001', 'R-002', 'R-003', 'R-004'].includes(f.ruleId)) {
        lineIssues.push({
          ruleId: f.ruleId,
          cornerNumber: f.cornerNumber,
          title: f.name,
          fault: f.fault || f.description,
          severity: f.severity
        });
      }
    });

    return {
      box: { x: originX, y: originY, width: boxW, height: boxH },
      segments,
      turnMarkers: pdfTurnMarkers,
      startFinish: pdfPoints[0] ? { pdfX: pdfPoints[0].pdfX, pdfY: pdfPoints[0].pdfY } : null,
      issues: lineIssues
    };
  }
}
