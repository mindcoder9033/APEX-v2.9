/**
 * APEX 2.5D Isometric High-Performance Canvas2D Track Map
 * Renders real-time circuit geometry with 3D elevation ribbons,
 * rotatable isometric/top-down camera, ghost lap comparison,
 * live car blip, dynamic Entry/Late-Apex/Exit coaching markers,
 * and active corner HUD banner.
 */

import { CornerDynamics3DEngine, APEX_TYPE, CORNER_PHASE } from '../analysis/corner-dynamics-3d.js';
import { DRIVING_STATE, STATE_COLORS } from '../analysis/track-map.js';

export class IsometricTrackMap {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {Object} options 
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options;

    this.dynamicsEngine = new CornerDynamics3DEngine(options.dynamics);

    // Camera & Projection settings
    this.is3D = options.is3D !== undefined ? options.is3D : true;
    this.pitch = this.is3D ? 0.65 : 0; // ~37 degrees in radians
    this.yaw = options.yaw || 0.45;    // ~25 degrees rotation
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.elevationScale = 1.6; // Visual multiplier for elevation extrusion

    // State data
    this.liveSamples = [];
    this.referenceLap = null;
    this.corners3D = [];
    this.currentSample = null;
    this.activeCornerProgress = null;

    // Track bounding box & normalization
    this.bounds = { minX: 0, maxX: 100, minY: 0, maxY: 10, minZ: 0, maxZ: 100, centerX: 50, centerY: 5, centerZ: 50, range: 100 };
    this.hasFitted = false;

    // Interaction state
    this.hoveredMarker = null;
    this.selectedMarker = null;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartPanX = 0;
    this.dragStartPanY = 0;
    this.dragStartYaw = 0;
    this.dragStartPitch = 0;
    this.isRightClickDrag = false;

    // Active marker click callback
    this.onMarkerClick = options.onMarkerClick || null;
    this.onCornerHover = options.onCornerHover || null;

    this.initEventListeners();
    this.resizeCanvas();
  }

  /**
   * Binds mouse and touch interaction handlers
   */
  initEventListeners() {
    if (!this.canvas) return;

    // Window resize observer
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
        this.render();
      });
      this.resizeObserver.observe(this.canvas);
    }

    // Mouse drag for Orbit / Pan
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      this.dragStartYaw = this.yaw;
      this.dragStartPitch = this.pitch;
      this.isRightClickDrag = (e.button === 2 || e.shiftKey);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;

        if (this.isRightClickDrag || !this.is3D) {
          // Pan camera
          this.panX = this.dragStartPanX + dx;
          this.panY = this.dragStartPanY + dy;
        } else {
          // Orbit yaw & pitch
          this.yaw = this.dragStartYaw + dx * 0.008;
          this.pitch = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, this.dragStartPitch - dy * 0.006));
        }
        this.render();
      } else {
        this.handleMouseMove(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Mouse wheel for Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      this.zoom = Math.max(0.2, Math.min(8.0, this.zoom * zoomFactor));
      this.render();
    }, { passive: false });

    // Click handler for markers
    this.canvas.addEventListener('click', (e) => {
      if (this.hoveredMarker) {
        this.selectedMarker = this.hoveredMarker;
        if (typeof this.onMarkerClick === 'function') {
          this.onMarkerClick(this.selectedMarker);
        }
        this.render();
      }
    });

    // Context menu prevent on right-click orbit
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  /**
   * Resizes canvas to match container's display pixel ratio
   */
  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.viewWidth = rect.width;
    this.viewHeight = rect.height;
  }

  /**
   * Updates the live telemetry stream buffer
   * @param {Object} sample Current 60Hz telemetry sample
   * @param {Array<Object>} lapSamples Rolling buffer of current lap
   */
  updateLiveTelemetry(sample, lapSamples = null) {
    this.currentSample = sample;
    if (lapSamples && Array.isArray(lapSamples)) {
      this.liveSamples = lapSamples;
    } else if (sample) {
      this.liveSamples.push(sample);
      if (this.liveSamples.length > 5000) {
        this.liveSamples.shift();
      }
    }

    // Auto-fit on first received batch of points
    if (!this.hasFitted && this.liveSamples.length >= 30) {
      this.computeBoundingBox(this.liveSamples);
      this.fitToView();
      this.hasFitted = true;
    }

    // Real-time corner dynamics evaluation
    if (this.corners3D.length > 0 && sample) {
      this.activeCornerProgress = this.dynamicsEngine.evaluateLiveProgress(
        sample,
        this.liveSamples,
        this.corners3D
      );
    }
  }

  /**
   * Loads reference lap benchmarks and pre-calculated 3D corners
   * @param {Object} referenceLap 
   * @param {Array<Object>} corners3D 
   */
  setReferenceData(referenceLap, corners3D = null) {
    this.referenceLap = referenceLap;
    if (corners3D && corners3D.length > 0) {
      this.corners3D = corners3D;
    } else if (referenceLap?.samples) {
      this.corners3D = this.dynamicsEngine.analyzeCorners3D(referenceLap.samples);
    }

    if (this.referenceLap?.samples?.length > 10) {
      this.computeBoundingBox(this.referenceLap.samples);
      this.fitToView();
      this.hasFitted = true;
    }
    this.render();
  }

  /**
   * Computes spatial bounding box for coordinate scaling
   */
  computeBoundingBox(samples) {
    if (!samples || samples.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const s of samples) {
      const x = s.motion?.position?.x ?? s.positionX ?? s.posX ?? 0;
      const y = s.motion?.position?.y ?? s.positionY ?? s.posY ?? 0;
      const z = s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? 0;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const rangeX = maxX - minX || 100;
    const rangeZ = maxZ - minZ || 100;
    const maxRange = Math.max(rangeX, rangeZ);

    this.bounds = {
      minX, maxX,
      minY, maxY,
      minZ, maxZ,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      centerZ: (minZ + maxZ) / 2,
      range: maxRange
    };
  }

  /**
   * Fits and centers the track inside the canvas viewport
   */
  fitToView() {
    if (!this.viewWidth || !this.viewHeight) {
      this.resizeCanvas();
    }
    const availDim = Math.min(this.viewWidth || 400, this.viewHeight || 300) * 0.75;
    this.baseScale = availDim / (this.bounds.range || 100);
    this.panX = (this.viewWidth || 400) / 2;
    this.panY = (this.viewHeight || 300) / 2;
    this.zoom = 1.0;
  }

  /**
   * Resets camera to standard isometric orientation
   */
  resetView() {
    this.pitch = this.is3D ? 0.65 : 0;
    this.yaw = 0.45;
    this.fitToView();
    this.render();
  }

  /**
   * Toggles between 2.5D Isometric and 2D Top-Down View
   */
  toggleViewMode() {
    this.is3D = !this.is3D;
    this.pitch = this.is3D ? 0.65 : 0;
    this.render();
    return this.is3D;
  }

  /**
   * 2.5D Isometric World-to-Screen Projection Matrix Math
   * Projects (X, Y, Z) world coordinates to (u, v) 2D canvas coordinates
   * @param {number} x World X
   * @param {number} y World Y (Elevation)
   * @param {number} z World Z
   * @returns {{u: number, v: number, depth: number}}
   */
  project(x, y, z) {
    // 1. Center world coordinates
    const cx = x - this.bounds.centerX;
    const cy = (y - this.bounds.centerY) * this.elevationScale;
    const cz = z - this.bounds.centerZ;

    // 2. Rotate around Y-axis by yaw
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const rx = cx * cosY - cz * sinY;
    const rz = cx * sinY + cz * cosY;

    // 3. Pitch tilt around X-axis for 2.5D isometric perspective
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    let screenX = rx;
    let screenY = rz * cosP - cy * sinP;
    const depth = rz * sinP + cy * cosP; // Depth sorting metric

    // 4. Scale and Pan
    const scale = (this.baseScale || 1.0) * this.zoom;
    const u = this.panX + screenX * scale;
    const v = this.panY + screenY * scale;

    return { u, v, depth };
  }

  /**
   * Main Render Loop
   */
  render() {
    const ctx = this.ctx;
    if (!ctx || !this.viewWidth || !this.viewHeight) return;

    // Clear background
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    // Draw Isometric Floor Grid
    this.drawIsometricGrid();

    // 1. Draw Reference / Ghost Lap Track Ribbon (if available)
    if (this.referenceLap?.samples && this.referenceLap.samples.length > 5) {
      this.drawTrackRibbon(this.referenceLap.samples, {
        isGhost: true,
        ribbonWidth: 6,
        alpha: 0.35,
        strokeColor: 'rgba(0, 240, 255, 0.4)'
      });
    }

    // 2. Draw Live Lap Extruded Track Ribbon
    if (this.liveSamples && this.liveSamples.length > 2) {
      this.drawTrackRibbon(this.liveSamples, {
        isGhost: false,
        ribbonWidth: 8,
        alpha: 0.95
      });
    }

    // 3. Draw Dynamic Coaching Markers (Entry, Geometric Apex, Actual Late Apex, Exit)
    this.drawCoachingMarkers();

    // 4. Draw Live Car Blip
    this.drawLiveCarBlip();

    // 5. Draw Active Corner HUD Banner (if inside or approaching corner)
    this.drawActiveCornerHUD();

    // 6. Draw Marker Tooltip if hovered
    if (this.hoveredMarker) {
      this.drawMarkerTooltip(this.hoveredMarker);
    }
  }

  /**
   * Draws a futuristic isometric floor grid for spatial depth
   */
  drawIsometricGrid() {
    const ctx = this.ctx;
    const gridSize = (this.bounds.range || 100) * 1.3;
    const steps = 10;
    const stepSize = gridSize / steps;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;

    for (let i = -steps / 2; i <= steps / 2; i++) {
      const x = this.bounds.centerX + i * stepSize;
      const p1 = this.project(x, this.bounds.minY, this.bounds.centerZ - gridSize / 2);
      const p2 = this.project(x, this.bounds.minY, this.bounds.centerZ + gridSize / 2);
      ctx.beginPath();
      ctx.moveTo(p1.u, p1.v);
      ctx.lineTo(p2.u, p2.v);
      ctx.stroke();

      const z = this.bounds.centerZ + i * stepSize;
      const p3 = this.project(this.bounds.centerX - gridSize / 2, this.bounds.minY, z);
      const p4 = this.project(this.bounds.centerX + gridSize / 2, this.bounds.minY, z);
      ctx.beginPath();
      ctx.moveTo(p3.u, p3.v);
      ctx.lineTo(p4.u, p4.v);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draws extruded 3D track ribbon with elevation depth shadows & driving state coloring
   */
  drawTrackRibbon(samples, { isGhost = false, ribbonWidth = 8, alpha = 1.0, strokeColor = null }) {
    if (!samples || samples.length < 2) return;
    const ctx = this.ctx;
    const n = samples.length;

    // Projected points
    const points = [];
    const shadows = [];

    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const x = s.motion?.position?.x ?? s.positionX ?? s.posX ?? 0;
      const y = s.motion?.position?.y ?? s.positionY ?? s.posY ?? 0;
      const z = s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? 0;

      const p = this.project(x, y, z);
      const shadowP = this.project(x, this.bounds.minY, z); // Projected to ground floor
      points.push({ ...p, sample: s });
      shadows.push(shadowP);
    }

    ctx.save();

    // A. Draw Ground Drop Shadow Ribbon (Elevation 2.5D visual queue)
    if (this.is3D && !isGhost) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = ribbonWidth * 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(shadows[0].u, shadows[0].v);
      for (let i = 1; i < n; i++) {
        ctx.lineTo(shadows[i].u, shadows[i].v);
      }
      ctx.stroke();

      // Draw vertical elevation contour struts at regular intervals
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const strutStep = Math.max(1, Math.floor(n / 40));
      for (let i = 0; i < n; i += strutStep) {
        ctx.beginPath();
        ctx.moveTo(shadows[i].u, shadows[i].v);
        ctx.lineTo(points[i].u, points[i].v);
        ctx.stroke();
      }
    }

    // B. Draw Main Elevated Track Ribbon
    if (isGhost) {
      // Ghost / Reference lap: dashed line
      ctx.beginPath();
      ctx.strokeStyle = strokeColor || 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = ribbonWidth;
      ctx.setLineDash([6, 6]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(points[0].u, points[0].v);
      for (let i = 1; i < n; i++) {
        ctx.lineTo(points[i].u, points[i].v);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Live Lap: multi-color driving state segments
      ctx.lineWidth = ribbonWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < n - 1; i++) {
        const s = points[i].sample;
        const throttle = s.inputs?.throttle ?? s.accel ?? 0;
        const brake = s.inputs?.brake ?? s.brake ?? 0;

        let color = STATE_COLORS.COASTING.hex;
        if (brake > 0.10) {
          color = STATE_COLORS.BRAKING.hex; // Red
        } else if (throttle > 0.80) {
          color = STATE_COLORS.FULL_THROTTLE.hex; // Green
        } else if (throttle > 0.05) {
          color = STATE_COLORS.PARTIAL_THROTTLE.hex; // Amber
        }

        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[i].u, points[i].v);
        ctx.lineTo(points[i + 1].u, points[i + 1].v);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draws interactive coaching markers: Entry, Geometric Apex, Actual Apex, Exit
   */
  drawCoachingMarkers() {
    if (!this.corners3D || this.corners3D.length === 0) return;
    const ctx = this.ctx;

    this.screenMarkers = []; // Reset clickable screen marker cache

    for (const corner of this.corners3D) {
      // --- 1. ENTRY MARKER (Blue Flag) ---
      const pEntry = this.project(corner.entry.position.x, corner.entry.position.y, corner.entry.position.z);
      this.drawPin(pEntry.u, pEntry.v, {
        color: '#0099FF',
        glowColor: 'rgba(0, 153, 255, 0.6)',
        icon: 'ENTRY',
        badgeText: `${corner.entry.targetSpeedKmh}k · G${corner.entry.recommendedGear}`,
        type: 'ENTRY',
        corner
      });

      // --- 2. GEOMETRIC APEX (Grey Dashed Target) ---
      const pGeom = this.project(corner.geometricApex.position.x, corner.geometricApex.position.y, corner.geometricApex.position.z);
      this.drawGeometricApexTarget(pGeom.u, pGeom.v, corner);

      // --- 3. ACTUAL LATE APEX (Glowing Amber/Orange Sphere) ---
      const pApex = this.project(corner.actualApex.position.x, corner.actualApex.position.y, corner.actualApex.position.z);
      const isLate = corner.actualApex.classification === APEX_TYPE.LATE;
      const apexColor = isLate ? '#FF9900' : (corner.actualApex.classification === APEX_TYPE.EARLY ? '#E10600' : '#00CC66');
      const apexDeltaText = `${corner.actualApex.lateApexDeltaMeters > 0 ? '+' : ''}${corner.actualApex.lateApexDeltaMeters}m`;

      this.drawPin(pApex.u, pApex.v, {
        color: apexColor,
        glowColor: `${apexColor}88`,
        icon: `T${corner.cornerNumber}`,
        badgeText: isLate ? `Late ${apexDeltaText}` : apexDeltaText,
        type: 'APEX',
        corner
      });

      // Connector line between Geometric and Actual Apex
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(pGeom.u, pGeom.v);
      ctx.lineTo(pApex.u, pApex.v);
      ctx.stroke();
      ctx.restore();

      // --- 4. EXIT MARKER (Green Checkered Flag) ---
      const pExit = this.project(corner.exit.position.x, corner.exit.position.y, corner.exit.position.z);
      this.drawPin(pExit.u, pExit.v, {
        color: '#00CC66',
        glowColor: 'rgba(0, 204, 102, 0.6)',
        icon: 'EXIT',
        badgeText: `${corner.exit.targetSpeedKmh}k · G${corner.exit.recommendedGear}`,
        type: 'EXIT',
        corner
      });
    }
  }

  /**
   * Draws a geometric apex dashed target
   */
  drawGeometricApexTarget(u, v, corner) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(u, v, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
    ctx.beginPath();
    ctx.arc(u, v, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.screenMarkers.push({
      u, v, radius: 10,
      data: { type: 'GEOMETRIC_APEX', corner }
    });
  }

  /**
   * Draws a coaching pin with badge text
   */
  drawPin(u, v, { color, glowColor, icon, badgeText, type, corner }) {
    const ctx = this.ctx;
    const isHovered = this.hoveredMarker && this.hoveredMarker.corner?.cornerNumber === corner.cornerNumber && this.hoveredMarker.type === type;
    const radius = isHovered ? 7 : 5.5;

    ctx.save();

    // Glow halo
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(u, v, radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Pin center dot
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(u, v, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Badge Pill Box
    if (this.zoom >= 0.75) {
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      const textWidth = ctx.measureText(badgeText).width;
      const boxWidth = textWidth + 10;
      const boxHeight = 16;
      const boxX = u + 10;
      const boxY = v - 8;

      ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      this.drawChamferedRect(ctx, boxX, boxY, boxWidth, boxHeight, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, boxX + 5, boxY + boxHeight / 2);
    }

    ctx.restore();

    // Register screen marker for hit-testing
    this.screenMarkers.push({
      u, v, radius: 12,
      data: { type, corner, color, badgeText }
    });
  }

  /**
   * Draws live car position blip with heading cone and speed badge
   */
  drawLiveCarBlip() {
    if (!this.currentSample) return;
    const ctx = this.ctx;

    const x = this.currentSample.motion?.position?.x ?? this.currentSample.positionX ?? this.currentSample.posX ?? 0;
    const y = this.currentSample.motion?.position?.y ?? this.currentSample.positionY ?? this.currentSample.posY ?? 0;
    const z = this.currentSample.motion?.position?.z ?? this.currentSample.positionZ ?? this.currentSample.posZ ?? 0;
    const yaw = this.currentSample.motion?.orientation?.yaw ?? this.currentSample.yaw ?? 0;
    const speedKmh = Math.round((this.currentSample.motion?.speedMps ?? this.currentSample.speedMps ?? 0) * 3.6);
    const gear = this.currentSample.engine?.gear ?? this.currentSample.gear ?? 1;

    const p = this.project(x, y, z);

    ctx.save();

    // Heading direction indicator
    const headingLength = 18;
    // Calculate projected heading vector
    const hx = x + Math.sin(yaw) * 6;
    const hz = z + Math.cos(yaw) * 6;
    const pH = this.project(hx, y, hz);

    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.u, p.v);
    ctx.lineTo(pH.u, pH.v);
    ctx.stroke();

    // Car Blip Pulsing Aura
    const pulse = 1 + Math.sin(Date.now() / 150) * 0.2;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(p.u, p.v, 10 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Car Central Indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.u, p.v, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Live Speed & Gear Floating Badge
    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    const tag = `${speedKmh} km/h · G${gear}`;
    const tagWidth = ctx.measureText(tag).width + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 1;
    this.drawChamferedRect(ctx, p.u + 10, p.v - 22, tagWidth, 16, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00F0FF';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, p.u + 14, p.v - 14);

    ctx.restore();
  }

  /**
   * Draws active corner HUD banner at top of canvas
   */
  drawActiveCornerHUD() {
    if (!this.activeCornerProgress || !this.activeCornerProgress.coachingBanner) return;
    const ctx = this.ctx;
    const banner = this.activeCornerProgress.coachingBanner;

    const bannerWidth = Math.min(380, this.viewWidth - 30);
    const bannerHeight = 44;
    const bannerX = (this.viewWidth - bannerWidth) / 2;
    const bannerY = 12;

    ctx.save();

    // Glassmorphic background
    ctx.fillStyle = 'rgba(10, 15, 26, 0.90)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1;
    this.drawChamferedRect(ctx, bannerX, bannerY, bannerWidth, bannerHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Corner title & direction
    ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = '#FF9900';
    ctx.textBaseline = 'top';
    ctx.fillText(`TURN ${banner.cornerNumber} (${banner.direction})`, bannerX + 10, bannerY + 6);

    // Coaching prompt
    ctx.font = '10px "Inter", -apple-system, sans-serif';
    ctx.fillStyle = '#E0E6ED';
    ctx.fillText(banner.text, bannerX + 10, bannerY + 22);

    // Target metrics pill
    ctx.font = '9px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = '#00F0FF';
    const targetInfo = `Entry: ${banner.entryTarget} | Exit: ${banner.exitTarget}`;
    const targetW = ctx.measureText(targetInfo).width;
    ctx.fillText(targetInfo, bannerX + bannerWidth - targetW - 10, bannerY + 6);

    ctx.restore();
  }

  /**
   * Draws detailed marker tooltip on hover
   */
  drawMarkerTooltip(marker) {
    const ctx = this.ctx;
    const c = marker.corner;
    if (!c) return;

    let title = `TURN ${c.cornerNumber} (${c.direction}) · R=${c.radiusMeters}m`;
    let line1 = '';
    let line2 = '';

    if (marker.type === 'ENTRY') {
      line1 = `Target Entry: ${c.entry.targetSpeedKmh} km/h (Gear: ${c.entry.recommendedGear})`;
      line2 = `Actual Entry: ${c.entry.actualSpeedKmh} km/h · ${c.entry.brakingStartedEarly ? 'Braking initiated early' : 'Trail-brake ready'}`;
    } else if (marker.type === 'APEX') {
      line1 = `Apex: ${c.actualApex.classification} (${c.actualApex.lateApexDeltaMeters > 0 ? '+' : ''}${c.actualApex.lateApexDeltaMeters}m delta)`;
      line2 = c.actualApex.coachingFeedback;
    } else if (marker.type === 'EXIT') {
      line1 = `Target Exit: ${c.exit.targetSpeedKmh} km/h (Gear: ${c.exit.recommendedGear})`;
      line2 = `Actual Exit: ${c.exit.actualSpeedKmh} km/h · Full Throttle Unwind`;
    } else if (marker.type === 'GEOMETRIC_APEX') {
      line1 = `Geometric Corner Midpoint (Conventional Center)`;
      line2 = `Actual Apex delta: ${c.actualApex.lateApexDeltaMeters}m`;
    }

    ctx.save();
    ctx.font = '11px "Inter", sans-serif';
    const maxW = Math.max(ctx.measureText(title).width, ctx.measureText(line1).width, ctx.measureText(line2).width) + 24;
    const ttWidth = Math.min(320, maxW);
    const ttHeight = 60;
    const ttX = Math.max(10, Math.min(this.viewWidth - ttWidth - 10, (this.hoveredMarker.screenU || 100) + 12));
    const ttY = Math.max(10, Math.min(this.viewHeight - ttHeight - 10, (this.hoveredMarker.screenV || 100) - 70));

    ctx.fillStyle = 'rgba(12, 18, 30, 0.95)';
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 1;
    this.drawChamferedRect(ctx, ttX, ttY, ttWidth, ttHeight, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF9900';
    ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(title, ttX + 8, ttY + 16);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText(line1, ttX + 8, ttY + 34);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '9px "Inter", sans-serif';
    ctx.fillText(line2.slice(0, 52) + (line2.length > 52 ? '...' : ''), ttX + 8, ttY + 49);

    ctx.restore();
  }

  /**
   * Helper to draw a chamfered rectangle
   */
  drawChamferedRect(ctx, x, y, w, h, chamfer = 4) {
    ctx.beginPath();
    ctx.moveTo(x + chamfer, y);
    ctx.lineTo(x + w - chamfer, y);
    ctx.lineTo(x + w, y + chamfer);
    ctx.lineTo(x + w, y + h - chamfer);
    ctx.lineTo(x + w - chamfer, y + h);
    ctx.lineTo(x + chamfer, y + h);
    ctx.lineTo(x, y + h - chamfer);
    ctx.lineTo(x, y + chamfer);
    ctx.closePath();
  }

  /**
   * Mouse move hit testing for interactive markers
   */
  handleMouseMove(e) {
    if (!this.screenMarkers || this.screenMarkers.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hit = null;
    for (const sm of this.screenMarkers) {
      const dist = Math.sqrt((mx - sm.u) * (mx - sm.u) + (my - sm.v) * (my - sm.v));
      if (dist <= sm.radius) {
        hit = { ...sm.data, screenU: sm.u, screenV: sm.v };
        break;
      }
    }

    if (hit !== this.hoveredMarker) {
      this.hoveredMarker = hit;
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
      this.render();
      if (hit && typeof this.onCornerHover === 'function') {
        this.onCornerHover(hit);
      }
    }
  }
}
