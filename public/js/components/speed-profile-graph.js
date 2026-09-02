/**
 * APEX Speed Profile & Pedals Telemetry Graph
 * High-performance 2D Canvas chart plotting Speed vs. Track Distance,
 * with vertical corner landmark bands (T1, T2...), Ghost Lap comparison curve,
 * synchronized Throttle & Brake pedal strip, and bi-directional scrub crosshair.
 */

export class SpeedProfileGraph {
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
    this.scrubDistanceM = null;

    // Callbacks
    this.onScrub = options.onScrub || null;
    this.onCornerSelect = options.onCornerSelect || null;

    // Dimensions & DPR
    this.width = 800;
    this.height = 280;
    this.padding = { top: 24, right: 30, bottom: 44, left: 55 };
    this.pedalHeight = 50; // Bottom strip height

    this.initEvents();
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = rect.height || 280;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  initEvents() {
    if (!this.canvas) return;

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    }

    const handlePointer = (e) => {
      if (!this.primaryLap || !this.primaryLap.path || this.primaryLap.path.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const graphW = this.width - this.padding.left - this.padding.right;

      if (x < this.padding.left || x > this.width - this.padding.right) {
        return;
      }

      const ratio = Math.max(0, Math.min(1, (x - this.padding.left) / graphW));
      const distM = ratio * this.primaryLap.totalDistanceM;
      this.setScrubDistance(distM, true);
    };

    this.canvas.addEventListener('mousemove', handlePointer);
    this.canvas.addEventListener('click', (e) => {
      handlePointer(e);
      // Check if user clicked within a corner band
      if (this.scrubDistanceM !== null && this.corners) {
        const clickedCorner = this.corners.find(c =>
          this.scrubDistanceM >= c.entryDistanceM && this.scrubDistanceM <= c.exitDistanceM
        );
        if (clickedCorner && this.onCornerSelect) {
          this.onCornerSelect(clickedCorner);
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.scrubDistanceM = null;
      this.render();
      if (this.onScrub) this.onScrub(null);
    });
  }

  setData(primaryLap, ghostLap = null) {
    this.primaryLap = primaryLap;
    this.ghostLap = ghostLap;
    this.corners = primaryLap ? (primaryLap.corners || []) : [];
    this.render();
  }

  setActiveCorner(corner) {
    this.activeCorner = corner;
    this.render();
  }

  setScrubDistance(distanceM, emit = false) {
    this.scrubDistanceM = distanceM;
    this.render();

    if (emit && this.onScrub && this.primaryLap && this.primaryLap.path) {
      // Find nearest sample
      const path = this.primaryLap.path;
      let closest = path[0];
      let minDiff = Math.abs(path[0].distanceM - distanceM);

      for (let i = 1; i < path.length; i++) {
        const diff = Math.abs(path[i].distanceM - distanceM);
        if (diff < minDiff) {
          minDiff = diff;
          closest = path[i];
        }
      }
      this.onScrub(closest);
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#0E1015';
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.primaryLap || !this.primaryLap.path || this.primaryLap.path.length === 0) {
      ctx.fillStyle = '#666B7A';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NO LAP TELEMETRY LOADED', this.width / 2, this.height / 2);
      return;
    }

    const { top, right, bottom, left } = this.padding;
    const graphW = Math.max(10, this.width - left - right);
    const speedH = Math.max(10, this.height - top - bottom - this.pedalHeight - 12);
    const pedalTop = top + speedH + 16;
    const pedalH = this.pedalHeight;

    const totalDist = Math.max(10, this.primaryLap.totalDistanceM);
    const maxSpeed = Math.ceil(Math.max(this.primaryLap.maxSpeedKmh, this.ghostLap ? this.ghostLap.maxSpeedKmh : 0, 100) / 20) * 20;

    const getX = (dist) => left + (dist / totalDist) * graphW;
    const getSpeedY = (spd) => top + speedH - (spd / maxSpeed) * speedH;
    const getPedalY = (val) => pedalTop + pedalH - val * pedalH;

    // 1. Grid & Scales
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#7A8293';
    ctx.textAlign = 'right';

    // Speed Horizontal Grid Lines (every 40 km/h)
    const speedStep = maxSpeed > 240 ? 60 : (maxSpeed > 140 ? 40 : 20);
    for (let s = 0; s <= maxSpeed; s += speedStep) {
      const y = getSpeedY(s);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + graphW, y);
      ctx.stroke();
      ctx.fillText(`${s}`, left - 8, y + 3);
    }
    // Unit tag
    ctx.fillText('KM/H', left - 8, top - 6);

    // Distance X Axis ticks
    ctx.textAlign = 'center';
    const distStep = totalDist > 5000 ? 1000 : 500;
    for (let d = 0; d <= totalDist; d += distStep) {
      const x = getX(d);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + speedH);
      ctx.stroke();
      ctx.fillText(`${(d / 1000).toFixed(1)} km`, x, top + speedH + 14);
    }

    // 2. Corner Zone Shading
    for (const c of this.corners) {
      const x1 = getX(c.entryDistanceM);
      const x2 = getX(c.exitDistanceM);
      const isSelected = this.activeCorner && this.activeCorner.turnNumber === c.turnNumber;

      ctx.fillStyle = isSelected ? 'rgba(225, 6, 0, 0.22)' : 'rgba(255, 255, 255, 0.035)';
      ctx.fillRect(x1, top, Math.max(2, x2 - x1), speedH);

      // Border and apex marker
      ctx.strokeStyle = isSelected ? '#E10600' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = isSelected ? 1.5 : 0.8;
      ctx.strokeRect(x1, top, Math.max(2, x2 - x1), speedH);

      // Apex dashed vertical line
      const apexX = getX(c.apexDistanceM);
      ctx.strokeStyle = isSelected ? '#E10600' : 'rgba(255, 215, 0, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(apexX, top);
      ctx.lineTo(apexX, top + speedH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Corner Label (T1, T2...)
      ctx.fillStyle = isSelected ? '#FFFFFF' : '#A0A7B5';
      ctx.font = isSelected ? 'bold 10px "Rajdhani", sans-serif' : '10px "Rajdhani", sans-serif';
      ctx.fillText(`T${c.turnNumber}`, (x1 + x2) / 2, top + 12);
    }

    // 3. Ghost Lap Speed Trace (if present)
    if (this.ghostLap && this.ghostLap.path && this.ghostLap.path.length > 0) {
      const ghostPath = this.ghostLap.path;
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < ghostPath.length; i++) {
        const pt = ghostPath[i];
        const x = getX(pt.distanceM);
        const y = getSpeedY(pt.speedKmh);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Primary Lap Speed Trace & Gradient Area
    const path = this.primaryLap.path;
    if (path.length > 1) {
      // Area Fill
      const gradient = ctx.createLinearGradient(0, top, 0, top + speedH);
      gradient.addColorStop(0, 'rgba(225, 6, 0, 0.35)');
      gradient.addColorStop(0.6, 'rgba(225, 160, 0, 0.15)');
      gradient.addColorStop(1, 'rgba(0, 180, 255, 0.02)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(getX(path[0].distanceM), top + speedH);
      for (let i = 0; i < path.length; i++) {
        ctx.lineTo(getX(path[i].distanceM), getSpeedY(path[i].speedKmh));
      }
      ctx.lineTo(getX(path[path.length - 1].distanceM), top + speedH);
      ctx.closePath();
      ctx.fill();

      // Line Stroke
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const x = getX(path[i].distanceM);
        const y = getSpeedY(path[i].speedKmh);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 5. Pedal Strip (Throttle & Brake)
    // Background for pedal strip
    ctx.fillStyle = '#08090C';
    ctx.fillRect(left, pedalTop, graphW, pedalH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeRect(left, pedalTop, graphW, pedalH);

    // Throttle Trace (Green)
    ctx.strokeStyle = '#00CC66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const x = getX(path[i].distanceM);
      const y = getPedalY(path[i].throttle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Brake Trace (Red)
    ctx.strokeStyle = '#E10600';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const x = getX(path[i].distanceM);
      const y = getPedalY(path[i].brake);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Pedal Strip Labels
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00CC66';
    ctx.fillText('THR', left - 8, pedalTop + 14);
    ctx.fillStyle = '#E10600';
    ctx.fillText('BRK', left - 8, pedalTop + 28);

    // 6. Interactive Scrubber Crosshair & Tooltip
    if (this.scrubDistanceM !== null) {
      const scrubX = getX(this.scrubDistanceM);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 2]);

      // Vertical line across both speed and pedal charts
      ctx.beginPath();
      ctx.moveTo(scrubX, top - 8);
      ctx.lineTo(scrubX, pedalTop + pedalH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Find sample at scrub distance
      let currentPt = path[0];
      let minD = Math.abs(path[0].distanceM - this.scrubDistanceM);
      for (let i = 1; i < path.length; i++) {
        const diff = Math.abs(path[i].distanceM - this.scrubDistanceM);
        if (diff < minD) {
          minD = diff;
          currentPt = path[i];
        }
      }

      // Point dot on speed curve
      const ptY = getSpeedY(currentPt.speedKmh);
      ctx.fillStyle = '#E10600';
      ctx.beginPath();
      ctx.arc(scrubX, ptY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Tooltip pill at top
      const tipText = `${Math.round(currentPt.speedKmh)} km/h • G${currentPt.gear || 0} • Thr: ${Math.round(currentPt.throttle * 100)}% • Brk: ${Math.round(currentPt.brake * 100)}% • ${Math.round(currentPt.distanceM)}m`;
      ctx.font = '10px "JetBrains Mono", monospace';
      const textW = ctx.measureText(tipText).width + 16;
      let tipX = Math.max(left, Math.min(left + graphW - textW, scrubX - textW / 2));

      ctx.fillStyle = 'rgba(15, 17, 23, 0.92)';
      ctx.strokeStyle = '#E10600';
      ctx.lineWidth = 1;
      ctx.fillRect(tipX, top - 20, textW, 18);
      ctx.strokeRect(tipX, top - 20, textW, 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(tipText, tipX + 8, top - 7);
    }
  }
}
