/**
 * APEX Stints Live HUD Overlay Renderer
 * Renders isolated, stint-specific motorsport telemetry widgets during an active stint session.
 * Adapts dynamically when the user switches or jumps between practice stints.
 */

import { PdfReportGenerator } from './pdf-report.js';
import { StintDiagnostics } from './analysis/stint-diagnostics.js';

export class LiveHudRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeStint = null;
    this.onFinishCallback = null;
    
    this.sessionSamples = [];
    this.lapsCompleted = 0;
    this.stintStartTime = 0;

    this.telemetryStats = {
      samplesCount: 0,
      currentLap: 1,
      peakSpeedKmh: 0,
      peakSpeedMph: 0,
      avgSpeedMph: 0,
      peakLatG: 0,
      peakLongG: 0,
      lineScore: null,
      exitDeltaMph: null,
      arcRadiusFt: null,
      thresholdEffPct: null,
      ttoEvents: 0
    };
  }

  startStint(stint, onFinishCallback) {
    this.activeStint = stint;
    this.onFinishCallback = onFinishCallback;
    this.sessionSamples = [];
    this.lapsCompleted = 0;
    this.stintStartTime = Date.now();

    this.telemetryStats = {
      samplesCount: 0,
      currentLap: 1,
      peakSpeedKmh: 0,
      peakSpeedMph: 0,
      avgSpeedMph: 0,
      peakLatG: 0,
      peakLongG: 0,
      lineScore: null,
      exitDeltaMph: null,
      arcRadiusFt: null,
      thresholdEffPct: null,
      ttoEvents: 0
    };

    this.renderHudLayout();
  }

  /**
   * Seamlessly switches the active stint and reconfigures the HUD
   * when jumping between stints in the Practice Stints tab.
   * @param {Object} newStint 
   */
  switchStint(newStint) {
    if (!newStint) return;
    this.activeStint = newStint;
    this.renderHudLayout();
  }

  stopStint() {
    if (!this.activeStint) return;

    // Strict Enforcement: DO NOT proceed or generate PDF if telemetry data is not received
    if (!this.sessionSamples || this.sessionSamples.length === 0) {
      alert('⚠️ No telemetry data received for this stint.\n\nPlease ensure Forza Motorsport is running with UDP data output enabled (127.0.0.1:9999) and the APEX bridge is connected before completing a stint.');
      return;
    }

    const stintRef = this.activeStint;
    const evaluation = StintDiagnostics.evaluate(stintRef, this.sessionSamples, this.telemetryStats);

    if (!evaluation || !evaluation.hasTelemetry) {
      alert('⚠️ Insufficient telemetry samples recorded to evaluate stint or generate PDF debrief.');
      return;
    }

    this.activeStint = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
    }

    if (typeof this.onFinishCallback === 'function') {
      this.onFinishCallback(evaluation, stintRef, this.sessionSamples);
    }
  }

  getStintWidgetsHtml(stint) {
    const id = stint.id || 'stint-1-1';

    switch (id) {
      // --- TIER 1: FUNDAMENTALS ---
      case 'stint-1-1': // The Pathfinder
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Driving Line Score</span>
              <span id="hud-line-score" class="stat-cell-value accent" style="color: var(--color-text-muted); font-size: 26px;">--%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 90%+ (R3 Arc)</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Trajectory Centerline Offset</span>
              <span id="hud-path-deviation" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Apex clipping adherence</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Chassis Balance (6/10ths)</span>
              <span id="hud-lat-stability" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Steering rate stability</span>
            </div>
            <div class="stat-cell chamfer-all-corners">
              <span class="stat-cell-label">Telemetry Ping Status</span>
              <span id="hud-ping-status" class="stat-cell-value" style="color: var(--color-warning); font-size: 14px; margin-top: 4px;">📡 AWAITING UDP TELEMETRY</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Geometric arc feedback</span>
            </div>
          </div>
        `;

      case 'stint-1-2': // Exit Speed Expert
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Corner Exit Speed Delta</span>
              <span id="hud-exit-delta" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- MPH/s</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: +2.0 MPH gain</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Throttle Application (TAP)</span>
              <span id="hud-tap-timing" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Pre-apex throttle feed</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Straightaway Gain Projection</span>
              <span id="hud-straight-gain" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Compounded straight delta</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Throttle / Unwind Sync</span>
              <span id="hud-unwind-sync" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Pedal squeeze vs wheel angle</span>
            </div>
          </div>
        `;

      case 'stint-1-3': // The Brake & Turn Maestro
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Brake & Turn Blend Ratio</span>
              <span id="hud-brake-turn-blend" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">0% / 0%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 80% / 20% ratio</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Trail-Brake Decay Rate</span>
              <span id="hud-trail-decay" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Smooth off-brake bleed</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Deceleration Efficiency</span>
              <span id="hud-decel-eff" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">READY</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Peak threshold boundary</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Friction Circle Allocation</span>
              <span id="hud-friction-alloc" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 4px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Grip vector saturation</span>
            </div>
          </div>
        `;

      // --- TIER 2: VEHICLE DYNAMICS ---
      case 'stint-2-1': // The Line Hunter
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Live Arc Radius (15GR=mph²)</span>
              <span id="hud-arc-radius" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- ft</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Sebring T7 Benchmark: 195 ft</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Apex Predictor Status</span>
              <span id="hud-apex-predictor" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Geometric turn-in forecast</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Radius Expansion Advantage</span>
              <span id="hud-radius-delta" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Radius gain vs inside arc</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Tire Lateral Grip Limit</span>
              <span id="hud-lateral-limit" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- G</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">15GR cornering capacity</span>
            </div>
          </div>
        `;

      case 'stint-2-2': // The Throttle Squeeze
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Throttle Balance State</span>
              <span id="hud-throttle-balance" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Weight transfer stability</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">TTO Instability Risk</span>
              <span id="hud-tto-risk" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Trailing throttle oversteer alert</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Throttle Squeeze Smoothness</span>
              <span id="hud-throttle-rate" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Pedal modulation rate</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Axle Weight Bias Readout</span>
              <span id="hud-weight-bias" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Front/rear dynamic load bias</span>
            </div>
          </div>
        `;

      case 'stint-2-3': // The Brake Maestro
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Threshold Pressure Efficiency</span>
              <span id="hud-threshold-eff" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">--%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: >90% deceleration</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Brake Performance Pulse</span>
              <span id="hud-brake-pulse" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">READY</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Lockup boundary monitor</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Peak Deceleration G</span>
              <span id="hud-decel-g" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- G</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Longitudinal deceleration force</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Contact Patch Scrub Index</span>
              <span id="hud-slip-delta" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Tire scrub boundary</span>
            </div>
          </div>
        `;

      // --- TIER 3: REAL-WORLD ADAPTATION ---
      case 'stint-3-1': // The Speed of Recognition
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Early Apex Warning Alert</span>
              <span id="hud-early-apex-alert" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Lookahead: 90ft before apex</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Apex Attitude Vector</span>
              <span id="hud-apex-attitude" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Heading error detection</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Reaction Distance Meter</span>
              <span id="hud-reaction-dist" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- ft</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: <30 ft recognition</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Emergency Cure Procedure</span>
              <span id="hud-cure-procedure" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">READY</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Relax steer + firm brake</span>
            </div>
          </div>
        `;

      case 'stint-3-2': // The Camber Hunter
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Suspension Compression Load</span>
              <span id="hud-camber-grip" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Banking compression readout</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Dynamic Banking G-Gain</span>
              <span id="hud-banking-gain" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">+10% compression G-force</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Road Camber Traction Index</span>
              <span id="hud-surface-grip" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Surface micro-grip readout</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Lateral Roll Gradient</span>
              <span id="hud-chassis-roll" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Chassis roll rate & crown</span>
            </div>
          </div>
        `;

      case 'stint-3-3': // The Compromise Architect
      default:
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Corner Priority Grade</span>
              <span id="hud-corner-priority" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Type I / II / III sequence</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Sacrifice Loss vs Exit Gain</span>
              <span id="hud-compromise-gain" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Compound velocity delta</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Main Straight Launch Delta</span>
              <span id="hud-straight-launch" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- MPH</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: +4.0 MPH launch</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Downhill Steering Unwind</span>
              <span id="hud-unwind-rate" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Exit wheel opening rate</span>
            </div>
          </div>
        `;
    }
  }

  renderHudLayout() {
    if (!this.container || !this.activeStint) return;
    this.container.style.display = 'flex';

    const stint = this.activeStint;
    const stintWidgetsHtml = this.getStintWidgetsHtml(stint);

    this.container.innerHTML = `
      <!-- Cockpit HUD Header Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-sm);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span id="hud-live-status-dot" class="status-dot" style="background-color: var(--color-warning); box-shadow: 0 0 10px var(--color-warning);"></span>
          <div>
            <div style="font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--color-gold); letter-spacing: 1px;">
              LIVE STINT HUD // ${stint.name.toUpperCase()}
            </div>
            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-muted);">
              ${stint.prescribedCar} · ${stint.prescribedTrack} · Target: ${stint.laps} Laps · <span id="hud-live-status-text" style="color: var(--color-warning);">${this.sessionSamples.length > 0 ? `LIVE STREAMING (${this.sessionSamples.length} SAMPLES)` : 'AWAITING UDP TELEMETRY'}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="text-align: right; font-family: var(--font-mono); font-size: 11px;">
            <span style="color: var(--color-text-muted); display: block; font-size: 9px;">PROGRESS</span>
            <strong id="hud-lap-progress" style="color: var(--color-text-primary); font-size: 14px;">LAP ${this.lapsCompleted || 1} / ${stint.laps}</strong>
          </div>

          <button id="btn-stop-active-stint" class="btn btn-primary chamfer-br" style="height: 42px; font-size: 12px; font-weight: 700;">
            <span>⏹</span> FINISH STINT & GENERATE PDF
          </button>
        </div>
      </div>

      <!-- Real-Time Telemetry Gauges Section -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-sm); margin-top: 6px;">
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Speed</span>
          <span id="hud-live-speed" class="stat-cell-value accent">0 KM/H</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Throttle / Brake</span>
          <span id="hud-live-inputs" class="stat-cell-value">0% / 0%</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Lateral / Long G</span>
          <span id="hud-live-g" class="stat-cell-value">0.00 / 0.00 G</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Gear</span>
          <span id="hud-live-gear" class="stat-cell-value" style="color: var(--color-gold);">N</span>
        </div>
      </div>

      <!-- Stint-Specific Live Diagnostic Gauges -->
      <div style="margin-top: 8px;">
        <div style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          ⚡ ${stint.tierShort} Diagnostic Gauges (${stint.name})
        </div>
        ${stintWidgetsHtml}
      </div>

      <!-- Live Coach Guidance Bar -->
      <div class="guide-step-card chamfer-all-corners" style="background: #111111; border-left: 3px solid var(--color-f1-red); padding: 10px 14px; margin-top: 8px;">
        <div style="font-size: 10px; font-weight: 700; color: var(--color-f1-red); text-transform: uppercase; margin-bottom: 2px;">
          🏎️ Real-Time Stint Coaching Directive
        </div>
        <div id="hud-live-coach-tip" style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.4;">
          ${stint.actionPlan[0]}
        </div>
      </div>
    `;

    const btnStop = document.getElementById('btn-stop-active-stint');
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        this.stopStint();
      });
    }
  }

  update(sample) {
    if (!this.activeStint || !sample) return;

    this.telemetryStats.samplesCount++;
    this.sessionSamples.push(sample);

    // Update status indicator
    const elDot = document.getElementById('hud-live-status-dot');
    if (elDot && elDot.style.backgroundColor !== 'var(--color-success)') {
      elDot.style.backgroundColor = 'var(--color-success)';
      elDot.style.boxShadow = '0 0 12px var(--color-success)';
      elDot.style.animation = 'pulse-success 1.5s infinite';
    }
    const elStatusText = document.getElementById('hud-live-status-text');
    if (elStatusText) {
      elStatusText.textContent = `LIVE TELEMETRY STREAMING (${this.sessionSamples.length} SAMPLES)`;
      elStatusText.style.color = 'var(--color-success)';
    }

    const motion = sample.motion || {};
    const inputs = sample.inputs || {};
    const timing = sample.timing || {};
    const chassis = sample.chassis || {};
    const accelBlock = motion.acceleration || {};

    // 1. Speed
    const speedKmh = motion.speedKmh != null ? motion.speedKmh : (sample.speedKmh != null ? sample.speedKmh : (motion.speedMps ? motion.speedMps * 3.6 : (sample.speed ? sample.speed * 3.6 : 0)));
    const speedMph = motion.speedMph != null ? motion.speedMph : (sample.speedMph != null ? sample.speedMph : (speedKmh * 0.621371));

    // 2. Pedals
    const rawThrottle = inputs.throttle != null ? inputs.throttle : (sample.accel != null ? sample.accel / 255 : (sample.throttle != null ? sample.throttle : 0));
    const rawBrake = inputs.brake != null ? inputs.brake : (sample.brake != null ? sample.brake / 255 : 0);
    const throttlePct = Math.min(100, Math.max(0, Math.round(rawThrottle <= 1.0 ? rawThrottle * 100 : rawThrottle)));
    const brakePct = Math.min(100, Math.max(0, Math.round(rawBrake <= 1.0 ? rawBrake * 100 : rawBrake)));

    // 3. Steer
    const steer = inputs.steering != null ? inputs.steering : (inputs.steer != null ? inputs.steer : (sample.steer != null ? sample.steer / 127 : 0));

    // 4. Gear
    const rawGear = inputs.gear != null ? inputs.gear : sample.gear;
    const gear = rawGear !== undefined ? (rawGear === 0 ? 'R' : rawGear === 11 ? 'N' : rawGear === 1 ? 'N' : (rawGear > 1 ? rawGear - 1 : rawGear)) : 'N';

    // 5. G-Forces
    const latGVal = accelBlock.lateralG != null ? accelBlock.lateralG : (motion.lateralG != null ? motion.lateralG : (motion.gLat != null ? motion.gLat : (sample.gLat || 0)));
    const longGVal = accelBlock.longitudinalG != null ? accelBlock.longitudinalG : (motion.longitudinalG != null ? motion.longitudinalG : (motion.gLong != null ? motion.gLong : (sample.gLong || 0)));
    const latGNum = Number(latGVal) || 0;
    const longGNum = Number(longGVal) || 0;
    const currentAbsLatG = Math.abs(latGNum);
    const currentAbsLongG = Math.abs(longGNum);

    const gLatFormatted = `${latGNum >= 0 ? '+' : ''}${latGNum.toFixed(2)}`;
    const gLongFormatted = `${longGNum >= 0 ? '+' : ''}${longGNum.toFixed(2)}`;

    // Track peak stats
    if (speedMph > this.telemetryStats.peakSpeedMph) {
      this.telemetryStats.peakSpeedMph = Math.round(speedMph);
      this.telemetryStats.peakSpeedKmh = Math.round(speedKmh);
    }
    if (currentAbsLatG > this.telemetryStats.peakLatG) {
      this.telemetryStats.peakLatG = parseFloat(currentAbsLatG.toFixed(2));
    }
    if (currentAbsLongG > this.telemetryStats.peakLongG) {
      this.telemetryStats.peakLongG = parseFloat(currentAbsLongG.toFixed(2));
    }

    // Core Gauges update
    const elSpeed = document.getElementById('hud-live-speed');
    if (elSpeed) elSpeed.textContent = `${Math.round(speedKmh)} KM/H`;

    const elInputs = document.getElementById('hud-live-inputs');
    if (elInputs) elInputs.textContent = `${throttlePct}% / ${brakePct}%`;

    const elG = document.getElementById('hud-live-g');
    if (elG) elG.textContent = `${gLatFormatted} / ${gLongFormatted} G`;

    const elGear = document.getElementById('hud-live-gear');
    if (elGear) elGear.textContent = gear;

    // Lap progress
    const currentLapNum = timing.lapNumber != null ? timing.lapNumber : (sample.lapNumber != null ? sample.lapNumber : 1);
    if (currentLapNum && currentLapNum > this.lapsCompleted) {
      this.lapsCompleted = currentLapNum;
      this.telemetryStats.currentLap = this.lapsCompleted;
      const elLap = document.getElementById('hud-lap-progress');
      if (elLap) elLap.textContent = `LAP ${this.lapsCompleted} / ${this.activeStint.laps}`;

      if (this.lapsCompleted >= this.activeStint.laps) {
        this.stopStint();
        return;
      }
    }

    // Update Stint-Specific Live Diagnostic Gauges
    const stintId = this.activeStint.id;

    // 1-1 The Pathfinder
    if (stintId === 'stint-1-1') {
      const elLine = document.getElementById('hud-line-score');
      if (elLine) {
        let lineScoreVal = 100;
        if (timing.normalizedDrivingLine !== undefined) {
          const dev = Math.abs(timing.normalizedDrivingLine);
          lineScoreVal = Math.max(0, Math.min(100, Math.round(100 - (dev / 127) * 100)));
        } else {
          lineScoreVal = Math.max(50, Math.min(100, Math.round(100 - Math.abs(steer) * 40)));
        }
        this.telemetryStats.lineScore = lineScoreVal;
        elLine.textContent = `${lineScoreVal}%`;
        elLine.style.color = lineScoreVal >= 90 ? 'var(--color-success)' : (lineScoreVal >= 80 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }
      const elDev = document.getElementById('hud-path-deviation');
      if (elDev) {
        const dVal = timing.normalizedDrivingLine !== undefined ? timing.normalizedDrivingLine : Math.round(steer * 60);
        elDev.textContent = Math.abs(dVal) < 10 ? 'ON CENTERLINE (R3)' : (dVal < 0 ? `PINCHING INSIDE (${Math.abs(dVal)})` : `TRACKING WIDE (+${dVal})`);
        elDev.style.color = Math.abs(dVal) < 15 ? 'var(--color-success)' : (Math.abs(dVal) < 35 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }
      const elStab = document.getElementById('hud-lat-stability');
      if (elStab) {
        elStab.textContent = Math.abs(steer) < 0.25 ? 'STABLE 6/10THS ARC' : (Math.abs(steer) < 0.5 ? 'MODERATE CORRECTION' : 'ABRUPT INPUT');
        elStab.style.color = Math.abs(steer) < 0.25 ? 'var(--color-success)' : (Math.abs(steer) < 0.5 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }
      const elPing = document.getElementById('hud-ping-status');
      if (elPing) {
        if (throttlePct > 70 && Math.abs(steer) < 0.15 && speedMph > 35) {
          elPing.textContent = '🎯 OPTIMAL APEX CLIPPED';
          elPing.style.color = 'var(--color-success)';
        } else if (Math.abs(steer) > 0.4 && currentAbsLatG < 0.5 && speedMph > 40) {
          elPing.textContent = '⚠️ EARLY TURN-IN PINCH';
          elPing.style.color = 'var(--color-f1-red)';
        } else if (speedMph < 5) {
          elPing.textContent = '🅿️ STATIONARY';
          elPing.style.color = 'var(--color-text-muted)';
        } else {
          elPing.textContent = '📡 TRACKING RACING LINE';
          elPing.style.color = 'var(--color-success)';
        }
      }
    }

    // 1-2 Exit Speed Expert
    else if (stintId === 'stint-1-2') {
      const elExitDelta = document.getElementById('hud-exit-delta');
      if (elExitDelta) {
        const accelGZ = accelBlock.longitudinalG != null ? accelBlock.longitudinalG : (longGNum || 0);
        const deltaMphRate = parseFloat((accelGZ * 21.937).toFixed(1));
        this.telemetryStats.exitDeltaMph = deltaMphRate;
        elExitDelta.textContent = `${deltaMphRate >= 0 ? '+' : ''}${deltaMphRate} MPH/s`;
        elExitDelta.style.color = deltaMphRate >= 2.0 ? 'var(--color-success)' : (deltaMphRate >= 0 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }
      const elTap = document.getElementById('hud-tap-timing');
      if (elTap) {
        if (throttlePct > 50 && currentAbsLatG > 0.7) {
          elTap.textContent = 'EARLY TAP (IDEAL POWER)';
          elTap.style.color = 'var(--color-success)';
        } else if (throttlePct === 0 && currentAbsLatG > 0.7) {
          elTap.textContent = 'MID-CORNER COASTING';
          elTap.style.color = 'var(--color-gold)';
        } else {
          elTap.textContent = 'LOCATING APEX TAP';
          elTap.style.color = 'var(--color-text-muted)';
        }
      }
      const elGain = document.getElementById('hud-straight-gain');
      if (elGain) {
        const projGain = (Math.max(0, (throttlePct / 100) * 0.22)).toFixed(2);
        elGain.textContent = `+${projGain}s / 0.5mi Straight`;
        elGain.style.color = 'var(--color-gold)';
      }
      const elSync = document.getElementById('hud-unwind-sync');
      if (elSync) {
        if (throttlePct > 60 && Math.abs(steer) < 0.25) {
          elSync.textContent = 'SYNCHRONIZED UNWIND';
          elSync.style.color = 'var(--color-success)';
        } else if (throttlePct > 60 && Math.abs(steer) >= 0.35) {
          elSync.textContent = 'UNWIND FASTER (PINCHED)';
          elSync.style.color = 'var(--color-warning)';
        } else {
          elSync.textContent = 'TRACKING ACCELERATION';
          elSync.style.color = 'var(--color-text-muted)';
        }
      }
    }

    // 1-3 The Brake & Turn Maestro
    else if (stintId === 'stint-1-3') {
      const elBlend = document.getElementById('hud-brake-turn-blend');
      if (elBlend) {
        const steerPct = Math.min(100, Math.round(Math.abs(steer) * 100));
        elBlend.textContent = `${brakePct}% / ${steerPct}%`;
        elBlend.style.color = (brakePct > 60 && steerPct > 40) ? 'var(--color-f1-red)' : ((brakePct > 0 && steerPct > 0) ? 'var(--color-gold)' : 'var(--color-text-primary)');
      }
      const elDecay = document.getElementById('hud-trail-decay');
      if (elDecay) {
        if (brakePct > 20 && Math.abs(steer) > 0.2) {
          elDecay.textContent = 'TRAIL BRAKING ACTIVE';
          elDecay.style.color = 'var(--color-success)';
        } else if (brakePct > 80) {
          elDecay.textContent = 'THRESHOLD ENTRY';
          elDecay.style.color = 'var(--color-gold)';
        } else {
          elDecay.textContent = 'OFF BRAKES';
          elDecay.style.color = 'var(--color-text-muted)';
        }
      }
      const elDecelEff = document.getElementById('hud-decel-eff');
      if (elDecelEff) {
        if (brakePct > 0) {
          const eff = Math.min(100, Math.max(10, Math.round((currentAbsLongG / 1.3) * 100)));
          elDecelEff.textContent = `${eff}% EFF (${longGFormatted}G)`;
          elDecelEff.style.color = eff >= 85 ? 'var(--color-success)' : 'var(--color-gold)';
        } else {
          elDecelEff.textContent = 'READY (0% LOAD)';
          elDecelEff.style.color = 'var(--color-text-muted)';
        }
      }
      const elFriction = document.getElementById('hud-friction-alloc');
      if (elFriction) {
        const totalG = Math.sqrt(latGNum * latGNum + longGNum * longGNum);
        elFriction.textContent = totalG > 1.1 ? `FRICTION SATURATED (${totalG.toFixed(2)}G)` : `AVAILABLE GRIP (${totalG.toFixed(2)}G)`;
        elFriction.style.color = totalG > 1.1 ? 'var(--color-f1-red)' : 'var(--color-success)';
      }
    }

    // 2-1 The Line Hunter
    else if (stintId === 'stint-2-1') {
      const elArc = document.getElementById('hud-arc-radius');
      if (elArc) {
        if (currentAbsLatG >= 0.15 && speedMph >= 12) {
          const rFt = Math.round((speedMph * speedMph) / (15 * currentAbsLatG));
          this.telemetryStats.arcRadiusFt = rFt;
          elArc.textContent = `${rFt} ft`;
          elArc.style.color = (rFt >= 180 && rFt <= 220) ? 'var(--color-success)' : 'var(--color-gold)';
        } else {
          elArc.textContent = 'STRAIGHT (∞)';
          elArc.style.color = 'var(--color-text-muted)';
        }
      }
      const elApexPred = document.getElementById('hud-apex-predictor');
      if (elApexPred) {
        if (Math.abs(steer) > 0.4 && currentAbsLatG < 0.5 && speedMph > 35) {
          elApexPred.textContent = 'EARLY TURN-IN (PINCHED)';
          elApexPred.style.color = 'var(--color-f1-red)';
        } else if (Math.abs(steer) < 0.25 && currentAbsLatG > 0.75) {
          elApexPred.textContent = 'LATE APEX (MAX RADIUS)';
          elApexPred.style.color = 'var(--color-success)';
        } else {
          elApexPred.textContent = 'GEOMETRIC ARC';
          elApexPred.style.color = 'var(--color-gold)';
        }
      }
      const elRadDelta = document.getElementById('hud-radius-delta');
      if (elRadDelta) {
        const rCurrent = this.telemetryStats.arcRadiusFt || 195;
        const gainPct = Math.round(((rCurrent - 103) / 103) * 100);
        elRadDelta.textContent = `+${Math.max(0, gainPct)}% Radius vs Inside Arc`;
        elRadDelta.style.color = 'var(--color-gold)';
      }
      const elLatLimit = document.getElementById('hud-lateral-limit');
      if (elLatLimit) {
        elLatLimit.textContent = `${currentAbsLatG.toFixed(2)} G`;
        elLatLimit.style.color = currentAbsLatG > 1.2 ? 'var(--color-f1-red)' : 'var(--color-success)';
      }
    }

    // 2-2 The Throttle Squeeze
    else if (stintId === 'stint-2-2') {
      const elThrottleBal = document.getElementById('hud-throttle-balance');
      if (elThrottleBal) {
        if (throttlePct > 85 && currentAbsLatG > 0.8) {
          elThrottleBal.textContent = 'POWER OVERSTEER RISK';
          elThrottleBal.style.color = 'var(--color-warning)';
        } else if (throttlePct === 0 && currentAbsLatG > 0.85 && speedMph > 40) {
          elThrottleBal.textContent = 'TRAILING THROTTLE OVERSTEER (TTO)';
          elThrottleBal.style.color = 'var(--color-f1-red)';
          this.telemetryStats.ttoEvents++;
        } else if (throttlePct > 20 && throttlePct <= 70 && currentAbsLatG > 0.6) {
          elThrottleBal.textContent = 'BALANCED SQUEEZE';
          elThrottleBal.style.color = '#0099FF';
        } else {
          elThrottleBal.textContent = 'STABLE CHASSIS';
          elThrottleBal.style.color = 'var(--color-text-muted)';
        }
      }
      const elTtoRisk = document.getElementById('hud-tto-risk');
      if (elTtoRisk) {
        elTtoRisk.textContent = (throttlePct === 0 && currentAbsLatG > 0.85) ? '⚠️ SNAP OVERSTEER' : 'ZERO TTO DETECTED';
        elTtoRisk.style.color = (throttlePct === 0 && currentAbsLatG > 0.85) ? 'var(--color-f1-red)' : 'var(--color-success)';
      }
      const elThrotRate = document.getElementById('hud-throttle-rate');
      if (elThrotRate) {
        elThrotRate.textContent = `${throttlePct}% APPLIED`;
        elThrotRate.style.color = 'var(--color-gold)';
      }
      const elBias = document.getElementById('hud-weight-bias');
      if (elBias) {
        const pitchVal = longGNum;
        elBias.textContent = pitchVal > 0.2 ? 'REAR SQUAT (ACCEL)' : (pitchVal < -0.2 ? 'FRONT DIVE (BRAKE)' : 'NEUTRAL 50:50');
        elBias.style.color = '#0099FF';
      }
    }

    // 2-3 The Brake Maestro
    else if (stintId === 'stint-2-3') {
      const elThresh = document.getElementById('hud-threshold-eff');
      if (elThresh) {
        if (brakePct > 0) {
          const decelEff = Math.min(100, Math.max(10, Math.round((currentAbsLongG / 1.3) * 100)));
          this.telemetryStats.thresholdEffPct = decelEff;
          elThresh.textContent = `${decelEff}%`;
          elThresh.style.color = decelEff >= 90 ? 'var(--color-success)' : 'var(--color-gold)';
        } else {
          elThresh.textContent = '--%';
          elThresh.style.color = 'var(--color-text-muted)';
        }
      }
      const elPulse = document.getElementById('hud-brake-pulse');
      if (elPulse) {
        if (brakePct > 95) {
          elPulse.textContent = '⚠️ LOCKUP RISK';
          elPulse.style.color = 'var(--color-f1-red)';
        } else if (brakePct > 50) {
          elPulse.textContent = 'THRESHOLD BRAKING';
          elPulse.style.color = 'var(--color-success)';
        } else {
          elPulse.textContent = 'READY';
          elPulse.style.color = 'var(--color-text-muted)';
        }
      }
      const elDecelG = document.getElementById('hud-decel-g');
      if (elDecelG) {
        elDecelG.textContent = `${currentAbsLongG.toFixed(2)} G`;
        elDecelG.style.color = currentAbsLongG > 1.2 ? 'var(--color-success)' : 'var(--color-text-primary)';
      }
      const elSlip = document.getElementById('hud-slip-delta');
      if (elSlip) {
        elSlip.textContent = brakePct > 90 ? 'TIRE SCRUB PEAK' : 'TRACTION OPTIMAL';
        elSlip.style.color = brakePct > 90 ? 'var(--color-warning)' : 'var(--color-success)';
      }
    }

    // 3-1 The Speed of Recognition
    else if (stintId === 'stint-3-1') {
      const elEarlyApex = document.getElementById('hud-early-apex-alert');
      if (elEarlyApex) {
        if (brakePct > 40 && Math.abs(steer) > 0.35 && speedMph > 45) {
          elEarlyApex.textContent = '⚠️ EARLY APEX WARNING (-90FT)';
          elEarlyApex.style.color = 'var(--color-f1-red)';
        } else if (currentAbsLatG > 0.6) {
          elEarlyApex.textContent = 'ON GEOMETRIC LINE';
          elEarlyApex.style.color = 'var(--color-success)';
        } else {
          elEarlyApex.textContent = 'TRACK MONITOR ACTIVE';
          elEarlyApex.style.color = 'var(--color-text-muted)';
        }
      }
      const elAttitude = document.getElementById('hud-apex-attitude');
      if (elAttitude) {
        elAttitude.textContent = Math.abs(steer) > 0.35 ? 'HEADING ERROR DETECTED' : 'TRAJECTORY ALIGNED';
        elAttitude.style.color = Math.abs(steer) > 0.35 ? 'var(--color-warning)' : 'var(--color-success)';
      }
      const elReaction = document.getElementById('hud-reaction-dist');
      if (elReaction) {
        const rDist = Math.max(10, Math.round(35 - (speedMph * 0.1)));
        elReaction.textContent = `${rDist} ft`;
        elReaction.style.color = rDist < 30 ? 'var(--color-success)' : 'var(--color-gold)';
      }
      const elCure = document.getElementById('hud-cure-procedure');
      if (elCure) {
        if (brakePct > 40 && Math.abs(steer) > 0.35) {
          elCure.textContent = 'RELAX STEER + FIRM BRAKE';
          elCure.style.color = 'var(--color-f1-red)';
        } else {
          elCure.textContent = 'READY / STABLE';
          elCure.style.color = 'var(--color-success)';
        }
      }
    }

    // 3-2 The Camber Hunter
    else if (stintId === 'stint-3-2') {
      const elCamber = document.getElementById('hud-camber-grip');
      if (elCamber) {
        const normTravel = chassis.normalizedSuspensionTravel || {};
        const avgTravel = normTravel.frontLeft != null 
          ? ((normTravel.frontLeft + normTravel.frontRight + normTravel.rearLeft + normTravel.rearRight) / 4) * 100 
          : 0;
        elCamber.textContent = `${Math.round(avgTravel)}% SUSP LOAD`;
        elCamber.style.color = avgTravel > 75 ? 'var(--color-warning)' : '#00CC66';
      }
      const elBanking = document.getElementById('hud-banking-gain');
      if (elBanking) {
        elBanking.textContent = currentAbsLatG > 0.8 ? '+10% COMPRESSION GRIP' : 'FLAT / ZERO BANKING';
        elBanking.style.color = currentAbsLatG > 0.8 ? 'var(--color-success)' : 'var(--color-text-muted)';
      }
      const elSurface = document.getElementById('hud-surface-grip');
      if (elSurface) {
        elSurface.textContent = currentAbsLatG > 1.0 ? 'HIGH BANKING BOWL' : 'STANDARD ASPHALT';
        elSurface.style.color = '#00CC66';
      }
      const elRoll = document.getElementById('hud-chassis-roll');
      if (elRoll) {
        elRoll.textContent = `${(currentAbsLatG * 2.8).toFixed(1)}° ROLL GRADIENT`;
        elRoll.style.color = 'var(--color-gold)';
      }
    }

    // 3-3 The Compromise Architect
    else if (stintId === 'stint-3-3') {
      const elCornerPriority = document.getElementById('hud-corner-priority');
      if (elCornerPriority) {
        if (throttlePct > 70 && speedMph > 45) {
          elCornerPriority.textContent = 'TYPE I (EXIT ACCEL ZONE)';
          elCornerPriority.style.color = 'var(--color-success)';
        } else if (brakePct > 70) {
          elCornerPriority.textContent = 'TYPE III (SACRIFICE ENTRY)';
          elCornerPriority.style.color = 'var(--color-f1-red)';
        } else {
          elCornerPriority.textContent = 'TYPE II (MID-CORNER LINK)';
          elCornerPriority.style.color = 'var(--color-gold)';
        }
      }
      const elCompromise = document.getElementById('hud-compromise-gain');
      if (elCompromise) {
        elCompromise.textContent = throttlePct > 70 ? '+0.25s COMPOUND GAIN' : '-0.10s SACRIFICE LOSS';
        elCompromise.style.color = throttlePct > 70 ? 'var(--color-success)' : 'var(--color-gold)';
      }
      const elStraightLaunch = document.getElementById('hud-straight-launch');
      if (elStraightLaunch) {
        elStraightLaunch.textContent = `+${(speedMph > 60 ? 4.2 : 1.8).toFixed(1)} MPH`;
        elStraightLaunch.style.color = 'var(--color-gold)';
      }
      const elUnwind = document.getElementById('hud-unwind-rate');
      if (elUnwind) {
        if (throttlePct > 50 && Math.abs(steer) <= 0.2 && speedMph > 30) {
          elUnwind.textContent = 'PROGRESSIVE UNWIND (OPTIMAL)';
          elUnwind.style.color = 'var(--color-success)';
        } else if (throttlePct > 50 && Math.abs(steer) > 0.35) {
          elUnwind.textContent = 'HOLDING LOCK (UNWIND FASTER)';
          elUnwind.style.color = 'var(--color-warning)';
        } else {
          elUnwind.textContent = 'NEUTRAL TRACKING';
          elUnwind.style.color = 'var(--color-text-muted)';
        }
      }
    }
  }
}
