/**
 * APEX 2D Lap Analyzer Track Map Engine
 * Renders top-down circuit geometry with continuous speed heatmap gradient,
 * Ghost Lap comparison line, brake point pins, corner exit speed tags,
 * pan & zoom navigation, interactive scrubber car position, and high-res PNG export.
 */

export class LapAnalyzerMap {
  /**
   * @param {HTMLCanvasElement} canvas 
   * @param {Object} options 
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options;

    this.primaryLap = null;
    this.ghostLap = null;
    this.corners = [];
    this.activeCorner = null;
    this.scrubPoint = null;

    // Display Toggles
    this.showBrakeMarkers = true;
    this.showExitSpeedLabels = true;
    this.showSpeedHeatmap = true;

    // View Transform
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.baseScale = 1.0;
    this.bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100, centerX: 50, centerZ: 50 };

    // Pan & Drag State
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartPanX = 0;
    this.dragStartPanY = 0;

    // Callbacks
    this.onCornerSelect = options.onCornerSelect || null;
    this.onHoverPoint = options.onHoverPoint || null;

    this.initEvents();
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = rect.height || 600;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.fitToBounds();
    this.render();
  }

  initEvents() {
    if (!this.canvas) return;

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    }

    // Pan Dragging
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartPanX = this.panX;
        this.dragStartPanY = this.panY;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = this.dragStartPanX + (e.clientX - this.dragStartX);
        this.panY = this.dragStartPanY + (e.clientY - this.dragStartY);
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.canvas) this.canvas.style.cursor = 'grab';
      }
    });

    // Zoom on Wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.4, Math.min(8.0, this.zoom * zoomFactor));

      // Zoom towards mouse position
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.render();
    }, { passive: false });

    // Track Hover / Click Detection
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging || !this.primaryLap || !this.primaryLap.path) return;
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Find nearest point
      const nearest = this.findNearestPathPoint(screenX, screenY);
      if (nearest && nearest.distPx < 30) {
        if (this.onHoverPoint) this.onHoverPoint(nearest.point);
      } else {
        if (this.onHoverPoint) this.onHoverPoint(null);
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (!this.corners || this.corners.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Check click near corner apex or brake markers
      let selected = null;
      let minD = 35; // Pixel threshold
      for (const c of this.corners) {
        const pt = c.apexPoint;
        if (pt) {
          const sPos = this.worldToScreen(pt.x, pt.z);
          const d = Math.hypot(sPos.x - screenX, sPos.y - screenY);
          if (d < minD) {
            minD = d;
            selected = c;
          }
        }
      }

      if (selected && this.onCornerSelect) {
        this.onCornerSelect(selected);
      }
    });
  }

  setData(primaryLap, ghostLap = null) {
    this.primaryLap = primaryLap;
    this.ghostLap = ghostLap;
    this.corners = primaryLap ? (primaryLap.corners || []) : [];
    this.fitToBounds();
    this.render();
  }

  setActiveCorner(corner) {
    this.activeCorner = corner;
    this.render();
  }

  setScrubPoint(point) {
    this.scrubPoint = point;
    this.render();
  }

  setBrakeMarkersVisible(visible) {
    this.showBrakeMarkers = visible;
    this.render();
  }

  setExitSpeedLabelsVisible(visible) {
    this.showExitSpeedLabels = visible;
    this.render();
  }

  setSpeedHeatmapVisible(visible) {
    this.showSpeedHeatmap = visible;
    this.render();
  }

  zoomIn() {
    this.zoom = Math.min(8.0, this.zoom * 1.25);
    this.render();
  }

  zoomOut() {
    this.zoom = Math.max(0.4, this.zoom * 0.8);
    this.render();
  }

  resetView() {
    this.fitToBounds();
    this.render();
  }

  fitToBounds() {
    if (!this.primaryLap || !this.primaryLap.path || this.primaryLap.path.length === 0) {
      return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of this.primaryLap.path) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    this.bounds = {
      minX,
      maxX,
      minZ,
      maxZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      rangeX: Math.max(1, maxX - minX),
      rangeZ: Math.max(1, maxZ - minZ)
    };

    const padding = 60;
    const availW = Math.max(50, this.width - padding * 2);
    const availH = Math.max(50, this.height - padding * 2);

    this.baseScale = Math.min(availW / this.bounds.rangeX, availH / this.bounds.rangeZ);
    this.zoom = 1.0;
    this.panX = this.width / 2;
    this.panY = this.height / 2;
  }

  worldToScreen(x, z) {
    const scale = this.baseScale * this.zoom;
    // Top-down view: X -> X, Z -> Y (inverted standard 2D Cartesian)
    const sx = this.panX + (x - this.bounds.centerX) * scale;
    const sy = this.panY + (z - this.bounds.centerZ) * scale;
    return { x: sx, y: sy };
  }

  findNearestPathPoint(screenX, screenY) {
    if (!this.primaryLap || !this.primaryLap.path) return null;
    let closest = null;
    let minD = Infinity;

    for (const p of this.primaryLap.path) {
      const s = this.worldToScreen(p.x, p.z);
      const d = Math.hypot(s.x - screenX, s.y - screenY);
      if (d < minD) {
        minD = d;
        closest = p;
      }
    }

    return closest ? { point: closest, distPx: minD } : null;
  }

  /**
   * Generates continuous color for speed heatmap (blue -> cyan -> green -> yellow -> red)
   */
  getSpeedColor(speedKmh, minSpeed, maxSpeed) {
    if (!this.showSpeedHeatmap) {
      return '#00E5FF'; // Monochromatic clean accent
    }

    const range = Math.max(1, maxSpeed - minSpeed);
    const norm = Math.max(0, Math.min(1, (speedKmh - minSpeed) / range));

    // Map 0.0 -> 1.0 to HSL Hue: 240 (blue) down to 0 (red)
    // 0.0: Blue (slowest apex, ~240deg)
    // 0.25: Cyan (~180deg)
    // 0.50: Green (~120deg)
    // 0.75: Yellow (~60deg)
    // 1.0: Red (top straightaway speed, 0deg)
    const hue = Math.round(240 * (1.0 - norm));
    return `hsl(${hue}, 95%, 52%)`;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // Dark Motorsport Canvas Background with subtle grid
    ctx.fillStyle = '#090A0E';
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawBackgroundGrid(ctx);

    if (!this.primaryLap || !this.primaryLap.path || this.primaryLap.path.length === 0) {
      ctx.fillStyle = '#5A6072';
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STANDBY // NO LAP TELEMETRY LOADED', this.width / 2, this.height / 2);
      return;
    }

    const path = this.primaryLap.path;
    const minSpeed = this.primaryLap.minSpeedKmh || 40;
    const maxSpeed = this.primaryLap.maxSpeedKmh || 200;

    // 1. Render Ghost Lap Line (if active)
    if (this.ghostLap && this.ghostLap.path && this.ghostLap.path.length > 1) {
      const ghostPath = this.ghostLap.path;
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < ghostPath.length; i++) {
        const pt = this.worldToScreen(ghostPath[i].x, ghostPath[i].z);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Active Corner Highlight Underlay
    if (this.activeCorner) {
      const eIdx = this.activeCorner.entryIndex;
      const xIdx = this.activeCorner.exitIndex;
      if (eIdx !== undefined && xIdx !== undefined && eIdx < xIdx) {
        ctx.strokeStyle = 'rgba(225, 6, 0, 0.45)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = eIdx; i <= xIdx; i++) {
          const pt = this.worldToScreen(path[i].x, path[i].z);
          if (i === eIdx) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // 3. Primary Lap Path (Continuous Speed Gradient Segments)
    ctx.lineWidth = 5.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < path.length - 1; i++) {
      const p1 = this.worldToScreen(path[i].x, path[i].z);
      const p2 = this.worldToScreen(path[i + 1].x, path[i + 1].z);

      ctx.strokeStyle = this.getSpeedColor(path[i].speedKmh, minSpeed, maxSpeed);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Connect last point to first point if closed circuit loop
    if (path.length > 10) {
      const pEnd = this.worldToScreen(path[path.length - 1].x, path[path.length - 1].z);
      const pStart = this.worldToScreen(path[0].x, path[0].z);
      const loopDist = Math.hypot(path[path.length - 1].x - path[0].x, path[path.length - 1].z - path[0].z);
      if (loopDist < 60) {
        ctx.strokeStyle = this.getSpeedColor(path[path.length - 1].speedKmh, minSpeed, maxSpeed);
        ctx.beginPath();
        ctx.moveTo(pEnd.x, pEnd.y);
        ctx.lineTo(pStart.x, pStart.y);
        ctx.stroke();
      }
    }

    // 4. Start/Finish Line Indicator
    const sPos = this.worldToScreen(path[0].x, path[0].z);
    this.drawStartFinishLine(ctx, sPos, path);

    // 5. Brake Markers (Red circular pins with BRK label)
    if (this.showBrakeMarkers && this.corners) {
      for (const c of this.corners) {
        const bp = c.brakePoint;
        if (bp) {
          const pos = this.worldToScreen(bp.x, bp.z);
          this.drawBrakeMarker(ctx, pos, c);
        }
      }
    }

    // 6. Corner Exit Speed Labels
    if (this.showExitSpeedLabels && this.corners) {
      for (const c of this.corners) {
        const ep = c.exitPoint;
        if (ep) {
          const pos = this.worldToScreen(ep.x, ep.z);
          this.drawExitSpeedLabel(ctx, pos, c);
        }
      }
    }

    // 7. Corner Turn Numbers (Apex badges)
    if (this.corners) {
      for (const c of this.corners) {
        const ap = c.apexPoint;
        if (ap) {
          const pos = this.worldToScreen(ap.x, ap.z);
          const isSel = this.activeCorner && this.activeCorner.turnNumber === c.turnNumber;
          this.drawCornerApexBadge(ctx, pos, c, isSel);
        }
      }
    }

    // 8. Scrubber / Car Telemetry Cursor Dot
    if (this.scrubPoint) {
      const pos = this.worldToScreen(this.scrubPoint.x, this.scrubPoint.z);
      this.drawCarScrubber(ctx, pos, this.scrubPoint);
    }

    // 9. Speed Heatmap Scale Legend (Bottom Left)
    this.drawSpeedLegend(ctx, minSpeed, maxSpeed);
  }

  drawBackgroundGrid(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  drawStartFinishLine(ctx, pos, path) {
    // Tangent angle
    let angle = 0;
    if (path.length > 2) {
      const p1 = this.worldToScreen(path[1].x, path[1].z);
      angle = Math.atan2(p1.y - pos.y, p1.x - pos.x) + Math.PI / 2;
    }

    const len = 12;
    const x1 = pos.x + Math.cos(angle) * len;
    const y1 = pos.y + Math.sin(angle) * len;
    const x2 = pos.x - Math.cos(angle) * len;
    const y2 = pos.y - Math.sin(angle) * len;

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Checkered tiny tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('S/F', pos.x + 14, pos.y + 4);
  }

  drawBrakeMarker(ctx, pos, corner) {
    // Red glowing pin
    ctx.fillStyle = '#E10600';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(225, 6, 0, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawExitSpeedLabel(ctx, pos, corner) {
    const isSel = this.activeCorner && this.activeCorner.turnNumber === corner.turnNumber;
    const speedText = `${Math.round(corner.exitSpeedKmh)} km/h • ${corner.exitGear}`;
    const badgeText = `T${corner.turnNumber} Exit: ${speedText}`;

    ctx.font = '9px "JetBrains Mono", monospace';
    const textW = ctx.measureText(badgeText).width + 12;
    const textH = 16;
    const bx = pos.x + 8;
    const by = pos.y - 8;

    ctx.fillStyle = isSel ? 'rgba(225, 6, 0, 0.92)' : 'rgba(18, 20, 26, 0.88)';
    ctx.strokeStyle = isSel ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by - textH, textW, textH);
    ctx.strokeRect(bx, by - textH, textW, textH);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, bx + 6, by - 4);
  }

  drawCornerApexBadge(ctx, pos, corner, isSelected) {
    const r = isSelected ? 11 : 9;
    ctx.fillStyle = isSelected ? '#E10600' : 'rgba(26, 29, 38, 0.92)';
    ctx.strokeStyle = isSelected ? '#FFFFFF' : '#FFD700';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#FFFFFF' : '#FFD700';
    ctx.font = `bold ${isSelected ? 10 : 9}px "Rajdhani", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${corner.turnNumber}`, pos.x, pos.y);
  }

  drawCarScrubber(ctx, pos, sample) {
    // Glowing animated car cursor
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#E10600';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawSpeedLegend(ctx, minSpeed, maxSpeed) {
    const lx = 20;
    const ly = this.height - 35;
    const lw = 130;
    const lh = 8;

    // Gradient bar
    const grad = ctx.createLinearGradient(lx, 0, lx + lw, 0);
    grad.addColorStop(0, 'hsl(240, 95%, 52%)'); // Blue
    grad.addColorStop(0.25, 'hsl(180, 95%, 52%)'); // Cyan
    grad.addColorStop(0.5, 'hsl(120, 95%, 52%)'); // Green
    grad.addColorStop(0.75, 'hsl(60, 95%, 52%)'); // Yellow
    grad.addColorStop(1, 'hsl(0, 95%, 52%)'); // Red

    ctx.fillStyle = grad;
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(lx, ly, lw, lh);

    // Labels
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8E95A5';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(minSpeed)} km/h`, lx, ly - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(maxSpeed)} km/h`, lx + lw, ly - 4);
  }

  /**
   * Generates a high-res PNG image data URL and triggers browser download
   * @param {string} filename 
   */
  exportToPng(filename = 'APEX_Lap_Analyzer_Track_Map.png') {
    if (!this.canvas) return;
    const dataUrl = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Returns high-res PNG data URL for PDF embedding
   */
  getImageDataUrl() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }
}
