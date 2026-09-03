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
      // --- TIER 1: FUNDAMENTALS (THE FOUNDATION STINT) ---
      case 'stint-1-1':
      case 'stint-1-2':
      case 'stint-1-3':
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">1. Driving Line Score</span>
              <span id="hud-line-score" class="stat-cell-value accent" style="color: var(--color-text-muted); font-size: 26px;">--%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 90%+ (R3 Arc)</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">2. Corner Exit Delta</span>
              <span id="hud-exit-delta-kmh" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">+0.0 km/h</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: +3.2 km/h TAP Gain</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">3. Brake &amp; Turn Blend</span>
              <span id="hud-brake-turn-blend" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 24px; margin-top: 2px;">0% / 0%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 80% / 20% Blend</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-gold);">
              <span class="stat-cell-label">Composite Foundation Index</span>
              <span id="hud-foundation-mastery" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">--%</span>
              <span id="hud-ping-status" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">40/40/20 Metric Scoring</span>
            </div>
          </div>
        `;

      // --- TIER 2: VEHICLE DYNAMICS (CHAPTER 2: THE THREE BASICS) ---
      case 'stint-2-1': // The Three Basics: Dynamics
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Live Arc Radius (15GR=mph²)</span>
              <span id="hud-arc-radius" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- ft</span>
              <span id="hud-arc-subtext" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Sebring T7 Target: 195 ft</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Throttle Balance & TTO Risk</span>
              <span id="hud-throttle-balance" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">STABLE CHASSIS</span>
              <span id="hud-tto-status" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Weight Transfer Equilibrium</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">4-Block Threshold Decel</span>
              <span id="hud-threshold-eff" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">--%</span>
              <span id="hud-brake-pulse" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Peak G & Lockup Margin</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-gold);">
              <span class="stat-cell-label">Composite Dynamics Index</span>
              <span id="hud-dynamics-mastery" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">--%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">40/30/30 Metric Scoring</span>
            </div>
          </div>
        `;

      // --- TIER 3: REAL-WORLD ADAPTATION ---
      case 'stint-3-1': // The Real-World Line: Adaptation
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Early Apex & Attitude Vector</span>
              <span id="hud-early-apex-alert" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 16px; margin-top: 2px;">TRACK MONITOR ACTIVE</span>
              <span id="hud-apex-attitude" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">90ft Lookahead // Trajectory Aligned</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Camber & Banking G-Gain</span>
              <span id="hud-camber-grip" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 24px;">--</span>
              <span id="hud-banking-gain" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Dynamic Compression G-Force Gain</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
              <span class="stat-cell-label">Corner Priority & Exit Launch</span>
              <span id="hud-straight-launch" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 24px;">-- MPH</span>
              <span id="hud-corner-priority" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Type III Sacrifice -> Type I Launch</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-gold);">
              <span class="stat-cell-label">Composite Real-World Mastery</span>
              <span id="hud-realworld-mastery" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">--%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">40/30/30 Metric Scoring</span>
            </div>
          </div>
        `;

      // --- TIER 4: MASTERING CAR CONTROL ---
      case 'stint-4-1': // The Skid Savior (Over-Rotation & CPR)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Yaw Angle (Optimal: 7°-10°)</span>
              <span id="hud-yaw-angle" class="stat-cell-value" style="color: var(--color-cyan); font-size: 26px;">0.0°</span>
              <span id="hud-yaw-zone-label" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Neutral Window</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Rotation Velocity (Yaw Rate)</span>
              <span id="hud-rotation-velocity" class="stat-cell-value" style="color: var(--color-text-primary); font-size: 24px;">0.0°/s</span>
              <span id="hud-rotation-status" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Stable Rotation</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan); grid-column: span 2;">
              <span class="stat-cell-label">Slip Angle Balance (Front vs Rear)</span>
              <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; margin-top: 2px;">
                <span id="hud-front-slip-text">Front: 0.0°</span>
                <span id="hud-balance-badge" class="badge" style="background: rgba(0, 204, 102, 0.2); color: var(--color-success); font-size: 9px;">NEUTRAL</span>
                <span id="hud-rear-slip-text">Rear: 0.0°</span>
              </div>
              <div class="slip-balance-track">
                <div class="slip-balance-opt-zone"></div>
                <div class="slip-balance-center"></div>
                <div id="hud-slip-cursor" class="slip-balance-cursor"></div>
              </div>
            </div>
          </div>
          <div class="cpr-tracker-container chamfer-all-corners">
            <div id="cpr-step-1" class="cpr-step-item">
              <span class="cpr-step-label">Step 1</span>
              <span class="cpr-step-name">1. CORRECT (Lock)</span>
            </div>
            <span class="cpr-arrow">➔</span>
            <div id="cpr-step-2" class="cpr-step-item">
              <span class="cpr-step-label">Step 2</span>
              <span class="cpr-step-name">2. PAUSE (Hold)</span>
            </div>
            <span class="cpr-arrow">➔</span>
            <div id="cpr-step-3" class="cpr-step-item">
              <span class="cpr-step-label">Step 3</span>
              <span class="cpr-step-name">3. RECOVER (Unwind)</span>
            </div>
          </div>
        `;

      case 'stint-4-2': // The Throttle Squeeze (Power Oversteer Prevention)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Throttle Application Distance</span>
              <span id="hud-squeeze-dist" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">0 ft</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 50-60 ft progressive squeeze</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Rear Slip Angle Limit</span>
              <span id="hud-rear-slip-spike" class="stat-cell-value" style="color: var(--color-success); font-size: 24px;">0.0°</span>
              <span id="hud-rear-slip-status" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">< 10° Target (Avoid 16° Spike)</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Exit Speed Delta Target</span>
              <span id="hud-exit-speed-gain" class="stat-cell-value accent" style="font-size: 24px;">+0.0 MPH</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: +2.0 MPH uninterrupted drive</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Power Oversteer Monitor</span>
              <span id="hud-power-oversteer-alert" class="stat-cell-value" style="color: var(--color-success); font-size: 15px; margin-top: 4px;">CLEAN EXIT DRIVE</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Zero snap countersteer</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px;">
            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-secondary);">
              <span>THROTTLE PROGRESSIVE SQUEEZE (0% ➔ 100%)</span>
              <span id="hud-squeeze-rate-text">PEDAL: 0%</span>
            </div>
            <div class="throttle-squeeze-progress-bar">
              <div id="hud-squeeze-fill" class="throttle-squeeze-fill"></div>
            </div>
          </div>
        `;

      case 'stint-4-3': // The Understeer Cure (The Breathe Technique)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Turn-In Throttle Breathe Depth</span>
              <span id="hud-breathe-depth" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">100%</span>
              <span id="hud-breathe-status" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 60-70% Breathe</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Front Tire Vertical Load Bias</span>
              <span id="hud-front-load-bias" class="stat-cell-value" style="color: var(--color-cyan); font-size: 24px;">50%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Load transferred to front patch</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Steering Lock vs Grip Ratio</span>
              <span id="hud-steer-grip-ratio" class="stat-cell-value" style="color: var(--color-success); font-size: 24px;">OPTIMAL</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Front tire saturation</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-cyan);">
              <span class="stat-cell-label">Understeer State</span>
              <span id="hud-understeer-state" class="stat-cell-value" style="color: var(--color-success); font-size: 15px; margin-top: 4px;">NO PUSH DETECTED</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Nose rotation tracking</span>
            </div>
          </div>
          <div class="breathe-target-box">
            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-secondary);">
              <span>THROTTLE BREATHE WINDOW (GREEN = 60-70% SWEET SPOT)</span>
              <span id="hud-breathe-needle-text">PEDAL: 0%</span>
            </div>
            <div class="breathe-meter-bar">
              <div class="breathe-sweet-spot"></div>
              <div id="hud-breathe-needle" class="breathe-meter-needle"></div>
            </div>
          </div>
          <div id="hud-less-grip-alert" class="hud-less-grip-alert" style="display: none; margin-top: 8px;">
            ⚠️ MORE STEERING = LESS GRIP! LIFT THROTTLE TO 60% TO SETTLE NOSE
          </div>
        `;

      // --- TIER 5: BRAKING & ENTERING (THE ANALYTICAL BRAKER) ---
      case 'stint-5-1': // The Threshold Hunter (Block 2 & Modulation)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Calibrated Brake Pressure</span>
              <span id="hud-brake-lbs-val" class="stat-cell-value" style="color: #FF6B00; font-size: 26px;">0 lbs</span>
              <span id="hud-brake-pct-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">0% / 140 lbs Scale</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Threshold Zone State</span>
              <span id="hud-threshold-status" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">OFF BRAKES</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 125-140 lbs (Green Zone)</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Lockup & Modulation Drop</span>
              <span id="hud-lockup-drop" class="stat-cell-value" style="color: var(--color-success); font-size: 20px; margin-top: 2px;">NO LOCKUP</span>
              <span id="hud-lockup-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 30-40 lbs ankle drop</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Throttle ➔ Brake Transition</span>
              <span id="hud-transition-timer" class="stat-cell-value" style="color: var(--color-text-primary); font-size: 24px;">0.00s</span>
              <span id="hud-transition-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: &lt; 0.35s squeeze</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px;">
            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-secondary); margin-bottom: 4px;">
              <span>PEDAL PRESSURE GAUGE (0 - 140 LBS)</span>
              <span id="hud-pedal-gauge-status" style="color: var(--color-success);">THRESHOLD ZONE: 125 - 140 LBS</span>
            </div>
            <div style="position: relative; height: 14px; background: #1a1a1e; border-radius: 2px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
              <div style="position: absolute; left: 88%; width: 12%; height: 100%; background: rgba(0, 204, 102, 0.25); border-left: 1px dashed var(--color-success);"></div>
              <div id="hud-brake-pressure-fill" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: linear-gradient(90deg, #FF6B00, #00FFCC); transition: width 0.04s ease-out;"></div>
            </div>
          </div>
        `;

      case 'stint-5-2': // The Trail-Braker (Block 3 & Friction Circle)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Brake-Turn Quadrant Usage</span>
              <span id="hud-friction-quadrant-val" class="stat-cell-value" style="color: #FF6B00; font-size: 26px;">0%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: &gt;75% Blended Grip</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Brake & Steer Ratio</span>
              <span id="hud-trail-blend-ratio" class="stat-cell-value" style="color: var(--color-gold); font-size: 22px;">0% / 0%</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Brake % / Steering %</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Trail-Brake Decay Rate</span>
              <span id="hud-decay-rate-val" class="stat-cell-value" style="color: var(--color-text-primary); font-size: 20px; margin-top: 2px;">--</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 20 lbs / 0.10s steady</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Brake ➔ Throttle Pause</span>
              <span id="hud-pause-timer-val" class="stat-cell-value" style="color: var(--color-cyan); font-size: 22px;">0.00s</span>
              <span id="hud-pause-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Trailing throttle rotation pause</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px; display: flex; gap: 14px; align-items: center;">
            <div style="position: relative; width: 120px; height: 120px; background: #0c0c0e; border: 1px solid rgba(255,255,255,0.08); border-radius: 50%; overflow: hidden; flex-shrink: 0;">
              <div style="position: absolute; top: 10%; left: 10%; width: 80%; height: 80%; border: 1px dashed rgba(255,255,255,0.15); border-radius: 50%;"></div>
              <div style="position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; border: 1px dashed rgba(255,255,255,0.1); border-radius: 50%;"></div>
              <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: rgba(255,255,255,0.15);"></div>
              <div style="position: absolute; top: 0; left: 50%; width: 1px; height: 100%; background: rgba(255,255,255,0.15);"></div>
              <div style="position: absolute; top: 0; right: 0; width: 50%; height: 50%; background: rgba(255, 107, 0, 0.15); border-left: 1px solid rgba(255, 107, 0, 0.35); border-bottom: 1px solid rgba(255, 107, 0, 0.35);"></div>
              <div id="hud-friction-dot" style="position: absolute; width: 8px; height: 8px; background: #00FFCC; border-radius: 50%; top: calc(50% - 4px); left: calc(50% - 4px); box-shadow: 0 0 8px #00FFCC; transition: top 0.05s ease-out, left 0.05s ease-out;"></div>
            </div>
            <div style="flex: 1; font-family: var(--font-mono); font-size: 10px; line-height: 1.5; color: var(--color-text-secondary);">
              <div style="color: #FF6B00; font-weight: 700; font-size: 11px; margin-bottom: 3px;">DONOHUE FRICTION CIRCLE (LIVE)</div>
              <div>Top-Right Quadrant: <strong style="color: #FFD700;">BRAKE-TURN BLEND</strong></div>
              <div>G-Load: <span id="hud-live-g-breakdown" style="color: var(--color-text-primary);">Lat: 0.00G | Long: 0.00G</span></div>
              <div id="hud-friction-coach-tip" style="color: var(--color-success); margin-top: 4px;">Approach corner &amp; trail off brake into apex</div>
            </div>
          </div>
        `;

      case 'stint-5-3': // The Procedure Driller (Brake Point Precision)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Brake Point Delta (Feet)</span>
              <span id="hud-brakepoint-delta-val" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">-- ft</span>
              <span id="hud-brakepoint-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Baseline reference</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Exit Speed vs Baseline</span>
              <span id="hud-proc-exit-speed" class="stat-cell-value" style="color: var(--color-success); font-size: 24px;">-- MPH</span>
              <span id="hud-proc-exit-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Corner exit velocity</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Jeremy Dale Procedure Step</span>
              <span id="hud-proc-step-status" class="stat-cell-value" style="color: #FF6B00; font-size: 16px; margin-top: 4px;">CALIBRATING</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">3-ft progressive advance</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #FF6B00;">
              <span class="stat-cell-label">Throttle Application Point (TAP)</span>
              <span id="hud-tap-status" class="stat-cell-value" style="color: var(--color-text-primary); font-size: 18px; margin-top: 4px;">NORMAL</span>
              <span id="hud-tap-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Delayed throttle detector</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px;">
            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-secondary);">
              <span>THE PROCEDURE PROGRESSION (3 FT INCREMENTS)</span>
              <span id="hud-proc-current-lap-delta">LAP PROGRESSION: READY</span>
            </div>
            <div id="hud-proc-guidance-box" style="margin-top: 5px; font-size: 11px; font-family: var(--font-mono); color: var(--color-success); line-height: 1.4;">
              🎯 Lap 1: Establishing safe reference braking point. Focus on clean corner exit speed.
            </div>
          </div>
        `;

      // --- TIER 12: RACING IN THE RAIN (THE WET WEATHER ANALYST) ---
      case 'stint-12-1': // The Visibility Drill (Seeing in the Wet)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Visibility Score</span>
              <span id="hud-vis-score-val" class="stat-cell-value" style="color: #00BFFF; font-size: 26px;">100%</span>
              <span id="hud-vis-score-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 85%+ Sightline</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Spray Density &amp; Distance</span>
              <span id="hud-spray-dist-val" class="stat-cell-value" style="color: var(--color-success); font-size: 20px; margin-top: 2px;">CLEAR AIR</span>
              <span id="hud-spray-dist-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">>2 Car Lengths Buffer</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Visor Prep &amp; Ventilation</span>
              <span id="hud-visor-status-val" class="stat-cell-value" style="color: var(--color-success); font-size: 16px; margin-top: 4px;">ANTI-FOG APPLIED</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Visor Propped 1/4" Open</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Apex &amp; Brake Point Sight</span>
              <span id="hud-vis-apex-sight" class="stat-cell-value" style="color: var(--color-text-primary); font-size: 18px; margin-top: 4px;">TRACKING APEX</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Looking through spray</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px;">
            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-secondary); margin-bottom: 4px;">
              <span>VISIBILITY &amp; SPRAY SATURATION GAUGE</span>
              <span id="hud-vis-meter-text" style="color: #00BFFF;">OPTIMAL VISIBILITY (>85%)</span>
            </div>
            <div style="position: relative; height: 14px; background: #1a1a1e; border-radius: 2px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
              <div style="position: absolute; left: 50%; width: 50%; height: 100%; background: rgba(0, 191, 255, 0.15); border-left: 1px dashed #00BFFF;"></div>
              <div id="hud-vis-meter-fill" style="position: absolute; top: 0; left: 0; height: 100%; width: 100%; background: linear-gradient(90deg, #E10600 0%, #FFD700 45%, #00BFFF 80%, #00CC66 100%); transition: width 0.08s ease-out;"></div>
            </div>
            <div id="hud-poor-vis-alert" class="hud-poor-vis-alert" style="display: none; margin-top: 8px;">
              ⚠️ SLOW DOWN - POOR VISIBILITY (<50%)! DROP BACK 2 CAR LENGTHS OR MOVE OFFLINE
            </div>
          </div>
        `;

      case 'stint-12-2': // The Rim Shot Hunter (Rain Line Selection)
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Rain Line Selection</span>
              <span id="hud-rain-line-state" class="stat-cell-value" style="color: var(--color-success); font-size: 20px; margin-top: 2px;">RIM SHOT (OUTSIDE)</span>
              <span id="hud-rain-line-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Porous Outer Asphalt</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Grip Surface Indicator</span>
              <span id="hud-surface-grip-indicator" class="stat-cell-value" style="color: var(--color-success); font-size: 20px; margin-top: 2px;">DULL GRAY GRIP</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Avoid glossy rubber line</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Corner Exit Speed Delta</span>
              <span id="hud-wet-exit-delta" class="stat-cell-value accent" style="color: var(--color-gold); font-size: 24px;">+0.0 MPH</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: +3.0+ MPH Launch</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Sweeper Lateral Grip</span>
              <span id="hud-rim-grip-reading" class="stat-cell-value" style="color: #00BFFF; font-size: 24px;">0.00 G</span>
              <span id="hud-rim-grip-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 0.85G vs 0.60G Dry (+42%)</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-secondary);">
              <div><strong style="color: #00BFFF;">LIME ROCK RAIN LINE ADVISOR:</strong> Ride outer rim on Turn 1 &amp; West Bend.</div>
              <div style="color: var(--color-text-muted); margin-top: 2px;">Dry line = 0.60G (polished rubber) | Outside line = 0.85G (+42% grip advantage)</div>
            </div>
            <span id="hud-rim-advisor-badge" class="wet-line-advisor-badge rim-shot">RIM SHOT ENGAGED</span>
          </div>
        `;

      case 'stint-12-3': // The Squaring-Off Artist (Wet Cornering Technique)
      default:
        return `
          <div class="stints-hud-kpi-grid">
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Squaring-Off Trajectory</span>
              <span id="hud-square-trajectory" class="stat-cell-value" style="color: var(--color-gold); font-size: 18px; margin-top: 4px;">LATE TURN-IN READY</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Point car straight early</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Wet Lateral Grip Budget</span>
              <span id="hud-wet-lat-budget" class="stat-cell-value" style="color: #00BFFF; font-size: 24px;">50% LIMIT</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">50% Lat vs 64% Long Asymmetry</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">Exit Throttle Modulation</span>
              <span id="hud-wet-throttle-status" class="stat-cell-value" style="color: var(--color-success); font-size: 18px; margin-top: 4px;">CLEAN SQUEEZE</span>
              <span id="hud-wet-wheelspin-sub" style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">0 Wheelspin Events</span>
            </div>
            <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00BFFF;">
              <span class="stat-cell-label">TTO Instability Monitor</span>
              <span id="hud-wet-tto-status" class="stat-cell-value" style="color: var(--color-success); font-size: 16px; margin-top: 4px;">NO SNAP DETECTED</span>
              <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Smooth throttle releases only</span>
            </div>
          </div>
          <div style="margin-top: 8px; background: #111114; border: 1px solid var(--color-border); padding: 10px; border-radius: 2px; display: flex; gap: 14px; align-items: center;">
            <div style="position: relative; width: 110px; height: 110px; background: #0c0c0e; border: 1px solid rgba(0, 191, 255, 0.25); border-radius: 50%; overflow: hidden; flex-shrink: 0;">
              <!-- Wet Friction Circle (50% Lat, 64% Long scaled boundary) -->
              <div style="position: absolute; top: 18%; left: 25%; width: 50%; height: 64%; border: 1px dashed #00BFFF; border-radius: 50%;"></div>
              <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: rgba(255,255,255,0.12);"></div>
              <div style="position: absolute; top: 0; left: 50%; width: 1px; height: 100%; background: rgba(255,255,255,0.12);"></div>
              <div id="hud-wet-friction-dot" style="position: absolute; width: 8px; height: 8px; background: #00BFFF; border-radius: 50%; top: calc(50% - 4px); left: calc(50% - 4px); box-shadow: 0 0 8px #00BFFF; transition: top 0.05s ease-out, left 0.05s ease-out;"></div>
            </div>
            <div style="flex: 1; font-family: var(--font-mono); font-size: 10px; line-height: 1.5; color: var(--color-text-secondary);">
              <div style="color: #00BFFF; font-weight: 700; font-size: 11px; margin-bottom: 3px;">2D WET TRACTION CIRCLE (REDUCED ENVELOPE)</div>
              <div>Cornering Limit: <strong style="color: var(--color-gold);">-50% Lateral G</strong> | Decel/Accel: <strong style="color: var(--color-success);">-36% Grip</strong></div>
              <div>Live Traction Vector: <span id="hud-wet-g-breakdown" style="color: var(--color-text-primary);">Lat: 0.00G | Long: 0.00G</span></div>
              <div id="hud-wet-coach-tip" style="color: var(--color-success); margin-top: 4px;">Square off turn: slow entry, point straight early, squeeze throttle</div>
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

    // 1-1 The Foundation Stint (Holistic Fundamentals: Line, Exit Speed, Trail-Braking)
    if (stintId === 'stint-1-1' || stintId === 'stint-1-2' || stintId === 'stint-1-3') {
      // 1. Pillar 1: Driving Line Score
      let lineScoreVal = 100;
      const elLine = document.getElementById('hud-line-score');
      if (elLine) {
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

      // 2. Pillar 2: Corner Exit Speed Delta (km/h)
      const accelGZ = accelBlock.longitudinalG != null ? accelBlock.longitudinalG : (longGNum || 0);
      const deltaKmhRate = parseFloat((accelGZ * 35.3).toFixed(1));
      this.telemetryStats.exitDeltaKmh = deltaKmhRate;
      this.telemetryStats.exitDeltaMph = parseFloat((deltaKmhRate * 0.621371).toFixed(1));
      
      const elExitKmh = document.getElementById('hud-exit-delta-kmh') || document.getElementById('hud-exit-delta');
      if (elExitKmh) {
        elExitKmh.textContent = `${deltaKmhRate >= 0 ? '+' : ''}${deltaKmhRate} km/h`;
        elExitKmh.style.color = deltaKmhRate >= 3.2 ? 'var(--color-success)' : (deltaKmhRate >= 0 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }

      // 3. Pillar 3: Brake & Turn Blend Ratio (80% / 20%)
      const steerPct = Math.min(100, Math.round(Math.abs(steer) * 100));
      const elBlend = document.getElementById('hud-brake-turn-blend');
      if (elBlend) {
        elBlend.textContent = `${brakePct}% / ${steerPct}%`;
        elBlend.style.color = (brakePct > 60 && steerPct > 40) ? 'var(--color-f1-red)' : ((brakePct > 0 && steerPct > 0) ? 'var(--color-gold)' : 'var(--color-text-primary)');
      }

      // 4. Live Foundation Composite Mastery Score
      const elMastery = document.getElementById('hud-foundation-mastery');
      if (elMastery) {
        const lineFactor = Math.min(100, Math.round((lineScoreVal / 90) * 100));
        const exitFactor = Math.max(30, Math.min(100, Math.round((Math.max(0, deltaKmhRate) / 3.2) * 100)));
        const trailFactor = (brakePct > 15 && steerPct > 15) ? 100 : (brakePct > 0 ? 70 : 50);
        const liveComposite = Math.round((0.40 * lineFactor) + (0.40 * exitFactor) + (0.20 * trailFactor));
        
        elMastery.textContent = `${liveComposite}%`;
        elMastery.style.color = liveComposite >= 85 ? 'var(--color-success)' : (liveComposite >= 70 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }

      // Telemetry Ping / Status
      const elPing = document.getElementById('hud-ping-status');
      if (elPing) {
        if (throttlePct > 70 && Math.abs(steer) < 0.15 && speedKmh > 55) {
          elPing.textContent = '🎯 OPTIMAL APEX EXIT (TAP)';
          elPing.style.color = 'var(--color-success)';
        } else if (brakePct > 40 && Math.abs(steer) > 0.35) {
          elPing.textContent = '🔄 TRAIL-BRAKE BLEND ACTIVE';
          elPing.style.color = 'var(--color-gold)';
        } else if (speedKmh < 10) {
          elPing.textContent = '🅿️ PIT / STATIONARY';
          elPing.style.color = 'var(--color-text-muted)';
        } else {
          elPing.textContent = '📡 TRACKING FOUNDATION';
          elPing.style.color = 'var(--color-success)';
        }
      }
    }

    // 2-1 The Three Basics: Dynamics (Chapter 2: Line 15GR, Throttle Squeeze & 4-Block Braking)
    else if (stintId === 'stint-2-1') {
      let radiusScore = 70;
      let throttleScore = 95;
      let decelScore = 70;

      // 1. Live Arc Radius (15GR = mph²)
      const elArc = document.getElementById('hud-arc-radius');
      const elArcSub = document.getElementById('hud-arc-subtext');
      if (elArc) {
        if (currentAbsLatG >= 0.15 && speedMph >= 12) {
          const rFt = Math.round((speedMph * speedMph) / (15 * currentAbsLatG));
          this.telemetryStats.arcRadiusFt = rFt;
          elArc.textContent = `${rFt} ft`;
          if (rFt >= 180 && rFt <= 220) {
            elArc.style.color = 'var(--color-success)';
            if (elArcSub) elArcSub.textContent = 'OPTIMAL 195 FT ARC';
            radiusScore = 100;
          } else if (rFt < 180) {
            elArc.style.color = 'var(--color-gold)';
            if (elArcSub) elArcSub.textContent = 'EARLY APEX PINCH (R < 180)';
            radiusScore = Math.max(30, Math.round((rFt / 195) * 95));
          } else {
            elArc.style.color = 'var(--color-gold)';
            if (elArcSub) elArcSub.textContent = 'WIDE RADIUS (>220 FT)';
            radiusScore = 90;
          }
        } else {
          elArc.textContent = 'STRAIGHT (∞)';
          elArc.style.color = 'var(--color-text-muted)';
          if (elArcSub) elArcSub.textContent = 'Sebring T7 Target: 195 ft';
        }
      }

      // 2. Throttle Balance & TTO Risk
      const elThrottleBal = document.getElementById('hud-throttle-balance');
      const elTtoStatus = document.getElementById('hud-tto-status');
      if (elThrottleBal) {
        if (throttlePct === 0 && currentAbsLatG > 0.85 && speedMph > 40) {
          elThrottleBal.textContent = '⚠️ SNAP OVERSTEER (TTO)';
          elThrottleBal.style.color = 'var(--color-f1-red)';
          if (elTtoStatus) {
            elTtoStatus.textContent = 'ABRUPT LIFT UNDER LOAD';
            elTtoStatus.style.color = 'var(--color-f1-red)';
          }
          this.telemetryStats.ttoEvents = (this.telemetryStats.ttoEvents || 0) + 1;
          throttleScore = 30;
        } else if (throttlePct > 85 && currentAbsLatG > 0.8) {
          elThrottleBal.textContent = 'POWER OVERSTEER RISK';
          elThrottleBal.style.color = 'var(--color-warning)';
          if (elTtoStatus) {
            elTtoStatus.textContent = 'REAR WHEELSPIN SLIP';
            elTtoStatus.style.color = 'var(--color-warning)';
          }
          throttleScore = 75;
        } else if (throttlePct > 20 && throttlePct <= 75 && currentAbsLatG > 0.6) {
          elThrottleBal.textContent = 'BALANCED SQUEEZE';
          elThrottleBal.style.color = '#0099FF';
          if (elTtoStatus) {
            elTtoStatus.textContent = 'SMOOTH REAR WEIGHT TRANSFER';
            elTtoStatus.style.color = 'var(--color-success)';
          }
          throttleScore = 100;
        } else {
          elThrottleBal.textContent = 'STABLE CHASSIS';
          elThrottleBal.style.color = 'var(--color-text-muted)';
          if (elTtoStatus) {
            elTtoStatus.textContent = 'Weight Transfer Equilibrium';
            elTtoStatus.style.color = 'var(--color-text-muted)';
          }
          throttleScore = 95;
        }
      }

      // 3. 4-Block Threshold Decel Efficiency
      const elThresh = document.getElementById('hud-threshold-eff');
      const elPulse = document.getElementById('hud-brake-pulse');
      if (elThresh) {
        if (brakePct > 0) {
          const decelEff = Math.min(100, Math.max(10, Math.round((currentAbsLongG / 1.3) * 100)));
          this.telemetryStats.thresholdEffPct = decelEff;
          elThresh.textContent = `${decelEff}%`;
          elThresh.style.color = decelEff >= 88 ? 'var(--color-success)' : 'var(--color-gold)';
          decelScore = Math.max(30, Math.min(100, Math.round((decelEff / 88) * 90)));
          if (elPulse) {
            if (brakePct > 95) {
              elPulse.textContent = `⚠️ LOCKUP RISK (${currentAbsLongG.toFixed(2)}G)`;
              elPulse.style.color = 'var(--color-f1-red)';
            } else {
              elPulse.textContent = `THRESHOLD DECEL (${currentAbsLongG.toFixed(2)}G)`;
              elPulse.style.color = 'var(--color-success)';
            }
          }
        } else {
          elThresh.textContent = '--%';
          elThresh.style.color = 'var(--color-text-muted)';
          if (elPulse) {
            elPulse.textContent = 'Peak G & Lockup Margin';
            elPulse.style.color = 'var(--color-text-muted)';
          }
        }
      }

      // 4. Composite Dynamics Index (40% Radius + 30% Throttle + 30% Decel)
      const elDynamicsMastery = document.getElementById('hud-dynamics-mastery');
      if (elDynamicsMastery) {
        const compositeLive = Math.round((0.40 * radiusScore) + (0.30 * throttleScore) + (0.30 * decelScore));
        elDynamicsMastery.textContent = `${compositeLive}%`;
        elDynamicsMastery.style.color = compositeLive >= 85 ? 'var(--color-success)' : 'var(--color-gold)';
      }
    }

    // 3-1 The Real-World Line: Adaptation (Chapter 3 Holistic Stint)
    else if (stintId === 'stint-3-1') {
      let apexScore = 85;
      let camberScore = 80;
      let launchScore = 80;

      // 1. Early Apex Warning Alert & Attitude Vector (40% Weight)
      const elEarlyApex = document.getElementById('hud-early-apex-alert');
      const elAttitude = document.getElementById('hud-apex-attitude');
      if (elEarlyApex) {
        if (brakePct > 40 && Math.abs(steer) > 0.35 && speedMph > 45) {
          elEarlyApex.textContent = '⚠️ EARLY APEX WARNING (-90FT)';
          elEarlyApex.style.color = 'var(--color-f1-red)';
          apexScore = 45;
          if (elAttitude) {
            elAttitude.textContent = 'HEADING ERROR DETECTED // RELAX STEER + FIRM BRAKE';
            elAttitude.style.color = 'var(--color-f1-red)';
          }
        } else if (currentAbsLatG > 0.6) {
          elEarlyApex.textContent = 'ON GEOMETRIC LINE';
          elEarlyApex.style.color = 'var(--color-success)';
          apexScore = 95;
          if (elAttitude) {
            elAttitude.textContent = 'TRAJECTORY ALIGNED // SIGHT PICTURE OPTIMAL';
            elAttitude.style.color = 'var(--color-success)';
          }
        } else {
          elEarlyApex.textContent = 'TRACK MONITOR ACTIVE';
          elEarlyApex.style.color = 'var(--color-text-muted)';
          if (elAttitude) {
            elAttitude.textContent = '90ft Lookahead // Trajectory Aligned';
            elAttitude.style.color = 'var(--color-text-muted)';
          }
        }
      }

      // 2. Camber & Banking Dynamic G-Gain (30% Weight)
      const elCamber = document.getElementById('hud-camber-grip');
      const elBanking = document.getElementById('hud-banking-gain');
      const normTravel = chassis.normalizedSuspensionTravel || {};
      const avgTravel = normTravel.frontLeft != null 
        ? ((normTravel.frontLeft + normTravel.frontRight + normTravel.rearLeft + normTravel.rearRight) / 4) * 100 
        : 0;

      if (elCamber) {
        elCamber.textContent = `${Math.round(avgTravel)}% SUSP LOAD (${currentAbsLatG.toFixed(2)}G)`;
        elCamber.style.color = currentAbsLatG >= 1.0 ? 'var(--color-success)' : avgTravel > 75 ? 'var(--color-warning)' : '#00CC66';
      }
      if (elBanking) {
        if (currentAbsLatG > 0.85) {
          elBanking.textContent = '+10% COMPRESSION G-GAIN (BANKING LOADED)';
          elBanking.style.color = 'var(--color-success)';
          camberScore = 95;
        } else if (currentAbsLatG > 0.6) {
          elBanking.textContent = 'MODERATE CAMBER GRIP ACTIVE';
          elBanking.style.color = 'var(--color-gold)';
          camberScore = 85;
        } else {
          elBanking.textContent = 'STANDARD SURFACE / FLAT SECTION';
          elBanking.style.color = 'var(--color-text-muted)';
          camberScore = 75;
        }
      }

      // 3. Corner Priority & Main Straight Exit Launch (30% Weight)
      const elStraightLaunch = document.getElementById('hud-straight-launch');
      const elCornerPriority = document.getElementById('hud-corner-priority');
      const currentLaunchGain = speedMph > 65 ? 4.2 : speedMph > 50 ? 3.4 : 1.8;

      if (elStraightLaunch) {
        elStraightLaunch.textContent = `+${currentLaunchGain.toFixed(1)} MPH`;
        elStraightLaunch.style.color = currentLaunchGain >= 3.5 ? 'var(--color-success)' : 'var(--color-gold)';
        launchScore = Math.min(100, Math.round((currentLaunchGain / 4.0) * 95));
      }
      if (elCornerPriority) {
        if (throttlePct > 70 && speedMph > 45) {
          elCornerPriority.textContent = 'TYPE I EXIT // FULL THROTTLE LAUNCH';
          elCornerPriority.style.color = 'var(--color-success)';
        } else if (brakePct > 70) {
          elCornerPriority.textContent = 'TYPE III ENTRY // SACRIFICE ENTRY SPEED';
          elCornerPriority.style.color = 'var(--color-f1-red)';
        } else {
          elCornerPriority.textContent = 'TYPE II TRANSITION // MID-CORNER LINK';
          elCornerPriority.style.color = 'var(--color-gold)';
        }
      }

      // 4. Composite Real-World Mastery Index (40% Apex + 30% Camber + 30% Launch)
      const elRealWorldMastery = document.getElementById('hud-realworld-mastery');
      if (elRealWorldMastery) {
        const compositeLive = Math.round((0.40 * apexScore) + (0.30 * camberScore) + (0.30 * launchScore));
        elRealWorldMastery.textContent = `${compositeLive}%`;
        elRealWorldMastery.style.color = compositeLive >= 85 ? 'var(--color-success)' : 'var(--color-gold)';
      }
    }

    // --- TIER 4: MASTERING CAR CONTROL ---
    // 4-1 The Skid Savior (Over-Rotation & CPR)
    else if (stintId === 'stint-4-1') {
      // 1. Calculate Yaw Angle (Heading vs Velocity Vector)
      const rawYawRad = motion.yaw != null ? motion.yaw : (sample.yaw || 0);
      const vx = motion.velocityX != null ? motion.velocityX : (sample.velocityX || 0);
      const vz = motion.velocityZ != null ? motion.velocityZ : (sample.velocityZ || 0);
      let velAngleRad = 0;
      if (Math.abs(vx) > 0.1 || Math.abs(vz) > 0.1) {
        velAngleRad = Math.atan2(vx, vz);
      }
      let yawDiffRad = rawYawRad - velAngleRad;
      while (yawDiffRad > Math.PI) yawDiffRad -= 2 * Math.PI;
      while (yawDiffRad < -Math.PI) yawDiffRad += 2 * Math.PI;
      const yawAngleDeg = Math.abs(yawDiffRad * (180 / Math.PI));

      const elYaw = document.getElementById('hud-yaw-angle');
      if (elYaw) {
        elYaw.textContent = `${yawAngleDeg.toFixed(1)}°`;
        if (yawAngleDeg >= 7.0 && yawAngleDeg <= 10.0) {
          elYaw.style.color = 'var(--color-success)';
        } else if (yawAngleDeg > 12.0) {
          elYaw.style.color = 'var(--color-f1-red)';
        } else {
          elYaw.style.color = 'var(--color-cyan)';
        }
      }
      const elYawZone = document.getElementById('hud-yaw-zone-label');
      if (elYawZone) {
        if (yawAngleDeg >= 7.0 && yawAngleDeg <= 10.0) {
          elYawZone.textContent = '🎯 OPTIMAL SLIP ZONE (7°-10°)';
          elYawZone.style.color = 'var(--color-success)';
        } else if (yawAngleDeg > 12.0) {
          elYawZone.textContent = '⚠️ OVER-ROTATION / SLIDE';
          elYawZone.style.color = 'var(--color-f1-red)';
        } else {
          elYawZone.textContent = 'NEUTRAL / TRACKING';
          elYawZone.style.color = 'var(--color-text-muted)';
        }
      }

      // 2. Rotational Velocity (Yaw Rate)
      const yawRateRad = motion.angularVelocityY != null ? motion.angularVelocityY : (sample.angularVelocityY || 0);
      const yawRateDeg = Math.abs(yawRateRad * (180 / Math.PI));
      const elRotVel = document.getElementById('hud-rotation-velocity');
      if (elRotVel) {
        elRotVel.textContent = `${yawRateDeg.toFixed(1)}°/s`;
        elRotVel.style.color = yawRateDeg > 45 ? 'var(--color-f1-red)' : (yawRateDeg > 20 ? 'var(--color-warning)' : 'var(--color-text-primary)');
      }
      const elRotStat = document.getElementById('hud-rotation-status');
      if (elRotStat) {
        if (yawRateDeg > 45) {
          elRotStat.textContent = '🚨 OVER-ROTATION SNAP!';
          elRotStat.style.color = 'var(--color-f1-red)';
        } else if (yawRateDeg < 5 && yawAngleDeg > 6) {
          elRotStat.textContent = '⏸️ THE PAUSE (ZERO ROTATION)';
          elRotStat.style.color = 'var(--color-cyan)';
        } else {
          elRotStat.textContent = 'STABLE ROTATION';
          elRotStat.style.color = 'var(--color-text-muted)';
        }
      }

      // 3. Slip Angle Balance & Bar Cursor
      const tireSlip = chassis.tireSlipAngle || sample.tireSlipAngle || {};
      const slipFL = Math.abs(tireSlip.frontLeft || 0) * (180 / Math.PI);
      const slipFR = Math.abs(tireSlip.frontRight || 0) * (180 / Math.PI);
      const slipRL = Math.abs(tireSlip.rearLeft || 0) * (180 / Math.PI);
      const slipRR = Math.abs(tireSlip.rearRight || 0) * (180 / Math.PI);
      const avgFrontSlip = (slipFL + slipFR) / 2;
      const avgRearSlip = (slipRL + slipRR) / 2;
      const slipDiff = avgFrontSlip - avgRearSlip; // >0 Understeer, <0 Oversteer

      const elFrontSlip = document.getElementById('hud-front-slip-text');
      if (elFrontSlip) elFrontSlip.textContent = `Front: ${avgFrontSlip.toFixed(1)}°`;
      const elRearSlip = document.getElementById('hud-rear-slip-text');
      if (elRearSlip) elRearSlip.textContent = `Rear: ${avgRearSlip.toFixed(1)}°`;

      const elBadge = document.getElementById('hud-balance-badge');
      if (elBadge) {
        if (slipDiff > 1.5) {
          elBadge.textContent = 'UNDERSTEER';
          elBadge.style.background = 'rgba(245, 158, 11, 0.2)';
          elBadge.style.color = 'var(--color-warning)';
        } else if (slipDiff < -1.5) {
          elBadge.textContent = 'OVERSTEER';
          elBadge.style.background = 'rgba(225, 6, 0, 0.2)';
          elBadge.style.color = 'var(--color-f1-red)';
        } else {
          elBadge.textContent = 'NEUTRAL';
          elBadge.style.background = 'rgba(0, 204, 102, 0.2)';
          elBadge.style.color = 'var(--color-success)';
        }
      }

      const elCursor = document.getElementById('hud-slip-cursor');
      if (elCursor) {
        // Map slipDiff (-10° to +10°) to 0% - 100%
        const normalizedPos = Math.max(5, Math.min(95, 50 - (slipDiff * 4)));
        elCursor.style.left = `calc(${normalizedPos}% - 6px)`;
        elCursor.style.background = Math.abs(slipDiff) <= 1.5 ? 'var(--color-success)' : (slipDiff < -1.5 ? 'var(--color-f1-red)' : 'var(--color-warning)');
      }

      // 4. CPR Step Tracker Animation
      const step1 = document.getElementById('cpr-step-1');
      const step2 = document.getElementById('cpr-step-2');
      const step3 = document.getElementById('cpr-step-3');
      if (step1 && step2 && step3) {
        step1.classList.remove('active-correct');
        step2.classList.remove('active-pause');
        step3.classList.remove('active-recover');

        const isOversteering = yawAngleDeg > 5.0 || slipDiff < -2.0;
        const isCountersteering = (rawYawRad > 0 && steer < -0.08) || (rawYawRad < 0 && steer > 0.08);

        if (isOversteering && isCountersteering) {
          if (yawRateDeg < 8.0) {
            // Rotation halted: The Pause
            step2.classList.add('active-pause');
          } else {
            // Active countersteer correction
            step1.classList.add('active-correct');
          }
        } else if (!isOversteering && Math.abs(steer) < 0.15 && speedMph > 30) {
          // Wheel unwound back to center: Recovered
          step3.classList.add('active-recover');
        }
      }
    }

    // 4-2 The Throttle Squeeze (Power Oversteer Prevention)
    else if (stintId === 'stint-4-2') {
      const elDist = document.getElementById('hud-squeeze-dist');
      if (elDist) {
        const estDist = Math.round((speedMph * 1.467) * (throttlePct / 100) * 0.5);
        elDist.textContent = `${estDist} ft`;
        elDist.style.color = estDist >= 50 ? 'var(--color-success)' : (estDist >= 30 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }

      const tireSlip = chassis.tireSlipAngle || sample.tireSlipAngle || {};
      const slipRL = Math.abs(tireSlip.rearLeft || 0) * (180 / Math.PI);
      const slipRR = Math.abs(tireSlip.rearRight || 0) * (180 / Math.PI);
      const avgRearSlip = (slipRL + slipRR) / 2;

      const elRearSpike = document.getElementById('hud-rear-slip-spike');
      if (elRearSpike) {
        elRearSpike.textContent = `${avgRearSlip.toFixed(1)}°`;
        elRearSpike.style.color = avgRearSlip <= 10.0 ? 'var(--color-success)' : (avgRearSlip <= 14.0 ? 'var(--color-warning)' : 'var(--color-f1-red)');
      }
      const elRearStat = document.getElementById('hud-rear-slip-status');
      if (elRearStat) {
        if (avgRearSlip > 14.0) {
          elRearStat.textContent = '⚠️ 16° POWER OVERSTEER SPIKE!';
          elRearStat.style.color = 'var(--color-f1-red)';
        } else if (avgRearSlip >= 7.0 && avgRearSlip <= 10.0) {
          elRearStat.textContent = '🎯 OPTIMAL EXIT GRIP (7°-10°)';
          elRearStat.style.color = 'var(--color-success)';
        } else {
          elRearStat.textContent = '< 10° Target (Linear Drive)';
          elRearStat.style.color = 'var(--color-text-muted)';
        }
      }

      const elExitGain = document.getElementById('hud-exit-speed-gain');
      if (elExitGain) {
        const exitDelta = parseFloat(((longGNum || 0) * 16.5).toFixed(1));
        elExitGain.textContent = `${exitDelta >= 0 ? '+' : ''}${exitDelta} MPH`;
        elExitGain.style.color = exitDelta >= 2.0 ? 'var(--color-success)' : 'var(--color-gold)';
      }

      const elPowerAlert = document.getElementById('hud-power-oversteer-alert');
      if (elPowerAlert) {
        if (throttlePct > 80 && avgRearSlip > 12.0) {
          elPowerAlert.textContent = '⚠️ POWER OVERSTEER TRIGGERED';
          elPowerAlert.style.color = 'var(--color-f1-red)';
        } else if (throttlePct > 50 && avgRearSlip <= 10.0) {
          elPowerAlert.textContent = 'PROGRESSIVE EXIT SQUEEZE';
          elPowerAlert.style.color = 'var(--color-success)';
        } else {
          elPowerAlert.textContent = 'CLEAN EXIT DRIVE';
          elPowerAlert.style.color = 'var(--color-text-muted)';
        }
      }

      const elRateText = document.getElementById('hud-squeeze-rate-text');
      if (elRateText) elRateText.textContent = `PEDAL: ${throttlePct}%`;
      const elFill = document.getElementById('hud-squeeze-fill');
      if (elFill) elFill.style.width = `${throttlePct}%`;
    }

    // 4-3 The Understeer Cure (The Breathe Technique)
    else if (stintId === 'stint-4-3') {
      const elBreatheDepth = document.getElementById('hud-breathe-depth');
      if (elBreatheDepth) {
        elBreatheDepth.textContent = `${throttlePct}%`;
        if (throttlePct >= 60 && throttlePct <= 70) {
          elBreatheDepth.style.color = 'var(--color-success)';
        } else if (throttlePct < 60) {
          elBreatheDepth.style.color = 'var(--color-warning)';
        } else {
          elBreatheDepth.style.color = 'var(--color-text-primary)';
        }
      }

      const elBreatheStat = document.getElementById('hud-breathe-status');
      if (elBreatheStat) {
        if (throttlePct >= 60 && throttlePct <= 70 && currentAbsLatG > 0.6) {
          elBreatheStat.textContent = '🎯 PERFECT BREATHE (60-70%)';
          elBreatheStat.style.color = 'var(--color-success)';
        } else if (throttlePct > 90 && currentAbsLatG > 0.7) {
          elBreatheStat.textContent = 'UNLOADED FRONTS (PINNED 100%)';
          elBreatheStat.style.color = 'var(--color-f1-red)';
        } else {
          elBreatheStat.textContent = 'Target: 60-70% Breathe';
          elBreatheStat.style.color = 'var(--color-text-muted)';
        }
      }

      // Front Load Bias %
      const elFrontLoad = document.getElementById('hud-front-load-bias');
      if (elFrontLoad) {
        const frontBias = Math.min(90, Math.max(10, Math.round(50 - (longGNum * 30))));
        elFrontLoad.textContent = `${frontBias}% FRONT`;
        elFrontLoad.style.color = frontBias > 55 ? 'var(--color-success)' : (frontBias < 40 ? 'var(--color-f1-red)' : 'var(--color-cyan)');
      }

      // Needle position
      const elNeedle = document.getElementById('hud-breathe-needle');
      if (elNeedle) elNeedle.style.left = `${throttlePct}%`;
      const elNeedleText = document.getElementById('hud-breathe-needle-text');
      if (elNeedleText) elNeedleText.textContent = `PEDAL: ${throttlePct}%`;

      // Understeer / More Steering = Less Grip Alert
      const tireSlip = chassis.tireSlipAngle || sample.tireSlipAngle || {};
      const slipFL = Math.abs(tireSlip.frontLeft || 0) * (180 / Math.PI);
      const slipFR = Math.abs(tireSlip.frontRight || 0) * (180 / Math.PI);
      const slipRL = Math.abs(tireSlip.rearLeft || 0) * (180 / Math.PI);
      const slipRR = Math.abs(tireSlip.rearRight || 0) * (180 / Math.PI);
      const avgFrontSlip = (slipFL + slipFR) / 2;
      const avgRearSlip = (slipRL + slipRR) / 2;
      const isPushing = (avgFrontSlip - avgRearSlip) > 2.0 && currentAbsLatG > 0.5;

      const elSteerRatio = document.getElementById('hud-steer-grip-ratio');
      if (elSteerRatio) {
        if (isPushing && Math.abs(steer) > 0.4) {
          elSteerRatio.textContent = 'SATURATED / SCRUB';
          elSteerRatio.style.color = 'var(--color-f1-red)';
        } else {
          elSteerRatio.textContent = 'OPTIMAL GRIP';
          elSteerRatio.style.color = 'var(--color-success)';
        }
      }

      const elUnderState = document.getElementById('hud-understeer-state');
      if (elUnderState) {
        if (isPushing) {
          elUnderState.textContent = 'FRONT TIRES UNLOADED';
          elUnderState.style.color = 'var(--color-f1-red)';
        } else {
          elUnderState.textContent = 'NO PUSH DETECTED';
          elUnderState.style.color = 'var(--color-success)';
        }
      }

      const elAlert = document.getElementById('hud-less-grip-alert');
      if (elAlert) {
        if (isPushing && Math.abs(steer) > 0.35 && throttlePct > 80) {
          elAlert.style.display = 'block';
        } else {
          elAlert.style.display = 'none';
        }
      }
    }

    // --- TIER 5: BRAKING & ENTERING (THE ANALYTICAL BRAKER) ---
    // 5-1 The Threshold Hunter (Block 2: Straight-Line Deceleration & Modulation)
    else if (stintId === 'stint-5-1') {
      const brakeLbs = Math.round(brake * 140);
      const elBrakeLbs = document.getElementById('hud-brake-lbs-val');
      if (elBrakeLbs) {
        elBrakeLbs.textContent = `${brakeLbs} lbs`;
        elBrakeLbs.style.color = brakeLbs >= 125 ? 'var(--color-success)' : (brakeLbs >= 70 ? 'var(--color-gold)' : '#FF6B00');
      }

      const elBrakePct = document.getElementById('hud-brake-pct-sub');
      if (elBrakePct) elBrakePct.textContent = `${brakePct}% / 140 lbs Scale`;

      const elThreshold = document.getElementById('hud-threshold-status');
      if (elThreshold) {
        if (brakeLbs >= 125) {
          elThreshold.textContent = '🎯 THRESHOLD ZONE (125-140 LBS)';
          elThreshold.style.color = 'var(--color-success)';
        } else if (brakeLbs >= 70) {
          elThreshold.textContent = 'MODULATING SQUEEZE';
          elThreshold.style.color = 'var(--color-gold)';
        } else if (brakeLbs > 10) {
          elThreshold.textContent = 'INITIAL PEDAL STRIKE';
          elThreshold.style.color = 'var(--color-text-primary)';
        } else {
          elThreshold.textContent = 'OFF BRAKES';
          elThreshold.style.color = 'var(--color-text-muted)';
        }
      }

      const elFill = document.getElementById('hud-brake-pressure-fill');
      if (elFill) elFill.style.width = `${brakePct}%`;

      // Throttle-to-Brake Transition Timer
      if (throttlePct < 5 && (this.t5PrevThrottlePct || 0) > 40) {
        this.t5ThrottleLiftTime = Date.now();
      }
      if (brakeLbs >= 110 && this.t5ThrottleLiftTime > 0) {
        const transTime = (Date.now() - this.t5ThrottleLiftTime) / 1000;
        this.t5ThrottleLiftTime = 0;
        this.t5LastTransitionTime = transTime;
        const elTrans = document.getElementById('hud-transition-timer');
        if (elTrans) {
          elTrans.textContent = `${transTime.toFixed(2)}s`;
          elTrans.style.color = transTime <= 0.35 ? 'var(--color-success)' : 'var(--color-warning)';
        }
        const elTransSub = document.getElementById('hud-transition-sub');
        if (elTransSub) {
          elTransSub.textContent = transTime <= 0.35 ? '🎯 Fast Hard Squeeze (<0.35s)' : '⚠️ Squeeze Faster (<0.35s target)';
          elTransSub.style.color = transTime <= 0.35 ? 'var(--color-success)' : 'var(--color-warning)';
        }
      }
      this.t5PrevThrottlePct = throttlePct;

      // Lockup Recovery & Modulation Drop
      const elLockDrop = document.getElementById('hud-lockup-drop');
      const elLockSub = document.getElementById('hud-lockup-sub');
      if (brakeLbs >= 130 && speedMph > 35) {
        this.t5LastLockupPressure = brakeLbs;
      }
      if (this.t5LastLockupPressure > 120 && brakeLbs < this.t5LastLockupPressure) {
        const drop = this.t5LastLockupPressure - brakeLbs;
        if (elLockDrop && elLockSub) {
          if (brakeLbs <= 20) {
            elLockDrop.textContent = '⚠️ PANIC LIFT (0 LBS)';
            elLockDrop.style.color = 'var(--color-f1-red)';
            elLockSub.textContent = 'Chassis rebound! Use subtle ankle drop';
            elLockSub.style.color = 'var(--color-f1-red)';
          } else if (drop >= 25 && drop <= 45) {
            elLockDrop.textContent = `🎯 -${drop} LBS ANKLE DROP`;
            elLockDrop.style.color = 'var(--color-success)';
            elLockSub.textContent = 'Perfect modulation (140 -> 100 lbs)';
            elLockSub.style.color = 'var(--color-success)';
          } else {
            elLockDrop.textContent = `MODULATING (-${drop} LBS)`;
            elLockDrop.style.color = 'var(--color-gold)';
            elLockSub.textContent = 'Target: 30-40 lbs subtle drop';
            elLockSub.style.color = 'var(--color-text-muted)';
          }
        }
      } else if (brakeLbs === 0 && elLockDrop) {
        elLockDrop.textContent = 'NO LOCKUP';
        elLockDrop.style.color = 'var(--color-success)';
      }
    }

    // 5-2 The Trail-Braker (Block 3: Brake-Turning & Friction Circle Grip Blending)
    else if (stintId === 'stint-5-2') {
      // 1. Friction Circle 2D Position
      const latGVal = motion.acceleration?.lateralG != null ? motion.acceleration.lateralG : (motion.lateralG || motion.gLat || sample.gLat || 0);
      const longGVal = motion.acceleration?.longitudinalG != null ? motion.acceleration.longitudinalG : (motion.longitudinalG || motion.gLong || sample.gLong || 0);

      // Decel is negative longG in standard telemetry (or positive in forward G)
      const latPos = Math.max(10, Math.min(90, 50 + (latGVal / 1.5) * 40));
      const longPos = Math.max(10, Math.min(90, 50 - (longGVal / 1.5) * 40));

      const elDot = document.getElementById('hud-friction-dot');
      if (elDot) {
        elDot.style.left = `calc(${latPos}% - 4px)`;
        elDot.style.top = `calc(${longPos}% - 4px)`;
        elDot.style.background = (brake > 0.1 && Math.abs(steer) > 0.1) ? '#FF6B00' : '#00FFCC';
      }

      const elGBreakdown = document.getElementById('hud-live-g-breakdown');
      if (elGBreakdown) {
        elGBreakdown.textContent = `Lat: ${Math.abs(latGVal).toFixed(2)}G | Long: ${longGVal.toFixed(2)}G`;
      }

      // 2. Brake-Turn Quadrant Tracking & Blend Ratio
      if (brake > 0.08) {
        this.t5BrakeSamplesCount = (this.t5BrakeSamplesCount || 0) + 1;
        if (Math.abs(steer) > 0.08) {
          this.t5BrakeTurnSamplesCount = (this.t5BrakeTurnSamplesCount || 0) + 1;
        }
      }
      const blendUsagePct = this.t5BrakeSamplesCount > 0 
        ? Math.min(100, Math.round((this.t5BrakeTurnSamplesCount / this.t5BrakeSamplesCount) * 100))
        : 80;

      const elQuadrant = document.getElementById('hud-friction-quadrant-val');
      if (elQuadrant) {
        elQuadrant.textContent = `${blendUsagePct}%`;
        elQuadrant.style.color = blendUsagePct >= 75 ? 'var(--color-success)' : (blendUsagePct >= 50 ? 'var(--color-gold)' : '#FF6B00');
      }

      const elRatio = document.getElementById('hud-trail-blend-ratio');
      if (elRatio) {
        elRatio.textContent = `${brakePct}% / ${Math.round(Math.abs(steer) * 100)}%`;
      }

      // 3. Trail-Brake Decay Rate
      const elDecay = document.getElementById('hud-decay-rate-val');
      if (elDecay) {
        if (brake < (this.t5PrevBrake || 0) && brake > 0.05) {
          const decayLbs = Math.round(((this.t5PrevBrake - brake) * 140) * 10);
          elDecay.textContent = `${decayLbs} lbs/0.1s`;
          elDecay.style.color = (decayLbs >= 15 && decayLbs <= 25) ? 'var(--color-success)' : 'var(--color-gold)';
        } else if (brake === 0) {
          elDecay.textContent = 'READY';
          elDecay.style.color = 'var(--color-text-muted)';
        }
      }
      this.t5PrevBrake = brake;

      // 4. Brake-to-Throttle Pause Counter
      if (brake < 0.02 && (this.t5PrevBrakeWasActive || false)) {
        this.t5BrakeReleaseTs = Date.now();
      }
      this.t5PrevBrakeWasActive = brake > 0.1;

      if (throttlePct > 8 && this.t5BrakeReleaseTs > 0) {
        const pauseTime = (Date.now() - this.t5BrakeReleaseTs) / 1000;
        this.t5BrakeReleaseTs = 0;
        const elPause = document.getElementById('hud-pause-timer-val');
        if (elPause) {
          elPause.textContent = `${pauseTime.toFixed(2)}s`;
          elPause.style.color = (pauseTime >= 0.15 && pauseTime <= 0.45) ? 'var(--color-success)' : 'var(--color-cyan)';
        }
      }
    }

    // 5-3 The Procedure Driller (Brake Point Precision & Jeremy Dale's 3-Ft Progression)
    else if (stintId === 'stint-5-3') {
      const lapNum = currentLap || 1;
      const targetDeltaFt = (lapNum - 1) * 3;

      const elDelta = document.getElementById('hud-brakepoint-delta-val');
      if (elDelta) {
        elDelta.textContent = lapNum === 1 ? 'BASELINE (0 ft)' : `-${targetDeltaFt} ft`;
        elDelta.style.color = lapNum === 1 ? 'var(--color-text-primary)' : 'var(--color-gold)';
      }

      const elExitSpeed = document.getElementById('hud-proc-exit-speed');
      if (elExitSpeed) {
        elExitSpeed.textContent = `${speedMph > 20 ? speedMph : '--'} MPH`;
      }

      const elProcStep = document.getElementById('hud-proc-step-status');
      if (elProcStep) {
        if (lapNum === 1) {
          elProcStep.textContent = 'BASELINE CALIBRATION';
          elProcStep.style.color = 'var(--color-cyan)';
        } else if (lapNum <= 5) {
          elProcStep.textContent = `STEP ${lapNum}: -${targetDeltaFt} FT CLOSER`;
          elProcStep.style.color = 'var(--color-gold)';
        } else if (lapNum <= 10) {
          elProcStep.textContent = `DEEPENING: -${targetDeltaFt} FT`;
          elProcStep.style.color = 'var(--color-warning)';
        } else {
          elProcStep.textContent = 'OPTIMAL LIMIT CHECK';
          elProcStep.style.color = 'var(--color-success)';
        }
      }

      const elTap = document.getElementById('hud-tap-status');
      const elTapSub = document.getElementById('hud-tap-sub');
      if (elTap) {
        if (brake > 0.8 && speedMph > 50) {
          this.t5DeepBrakeActive = true;
        }
        if (this.t5DeepBrakeActive && speedMph < 45 && throttlePct === 0) {
          elTap.textContent = 'WAITING FOR APEX (TAP)';
          elTap.style.color = 'var(--color-gold)';
        } else if (throttlePct > 40 && speedMph > 45) {
          this.t5DeepBrakeActive = false;
          elTap.textContent = 'CLEAN EXIT DRIVE';
          elTap.style.color = 'var(--color-success)';
          if (elTapSub) elTapSub.textContent = 'No delayed throttle penalty';
        }
      }

      const elProgText = document.getElementById('hud-proc-current-lap-delta');
      if (elProgText) elProgText.textContent = `LAP ${lapNum} // ADVANCE: ${targetDeltaFt} FT`;
    }

    // --- TIER 12: RACING IN THE RAIN (THE WET WEATHER ANALYST) ---
    // 12-1 The Visibility Drill (Seeing in the Wet)
    else if (stintId === 'stint-12-1') {
      // Calculate dynamic visibility score based on speed, spray density, and following distance
      let speedPenalty = speedMph > 60 ? (speedMph - 60) * 0.35 : 0;
      let steerPenalty = Math.abs(steer) > 0.3 ? 12 : 0;
      let brakePenalty = brakePct > 80 ? 8 : 0;
      let visScore = Math.max(35, Math.min(100, Math.round(98 - speedPenalty - steerPenalty - brakePenalty)));

      const elVisVal = document.getElementById('hud-vis-score-val');
      if (elVisVal) {
        elVisVal.textContent = `${visScore}%`;
        elVisVal.style.color = visScore >= 80 ? '#00BFFF' : (visScore >= 50 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }

      const elVisMeterFill = document.getElementById('hud-vis-meter-fill');
      if (elVisMeterFill) {
        elVisMeterFill.style.width = `${visScore}%`;
      }

      const elVisMeterText = document.getElementById('hud-vis-meter-text');
      if (elVisMeterText) {
        if (visScore >= 85) {
          elVisMeterText.textContent = 'OPTIMAL VISIBILITY (>85%) — CLEAR APEX SIGHT';
          elVisMeterText.style.color = '#00BFFF';
        } else if (visScore >= 50) {
          elVisMeterText.textContent = 'MODERATE SPRAY — MAINTAIN 2 CAR LENGTHS BUFFER';
          elVisMeterText.style.color = 'var(--color-gold)';
        } else {
          elVisMeterText.textContent = 'DENSE ROOSTER TAIL SPRAY — VISIBILITY COMPROMISED';
          elVisMeterText.style.color = 'var(--color-f1-red)';
        }
      }

      const elSprayDist = document.getElementById('hud-spray-dist-val');
      const elSpraySub = document.getElementById('hud-spray-dist-sub');
      if (elSprayDist) {
        if (visScore >= 80) {
          elSprayDist.textContent = 'CLEAN AIR';
          elSprayDist.style.color = 'var(--color-success)';
          if (elSpraySub) elSpraySub.textContent = '>2 Car Lengths Buffer';
        } else if (visScore >= 50) {
          elSprayDist.textContent = 'IN ROOSTER WAKE';
          elSprayDist.style.color = 'var(--color-gold)';
          if (elSpraySub) elSpraySub.textContent = '1-2 Car Lengths (Back Off)';
        } else {
          elSprayDist.textContent = 'BLINDING SPRAY';
          elSprayDist.style.color = 'var(--color-f1-red)';
          if (elSpraySub) elSpraySub.textContent = '<1 Car Length (Drop Back!)';
        }
      }

      const elVisApex = document.getElementById('hud-vis-apex-sight');
      if (elVisApex) {
        if (visScore < 50) {
          elVisApex.textContent = 'APEX OBSCURED';
          elVisApex.style.color = 'var(--color-f1-red)';
        } else if (speedMph > 40 && Math.abs(steer) > 0.15) {
          elVisApex.textContent = 'APEX IN VIEW';
          elVisApex.style.color = 'var(--color-success)';
        } else {
          elVisApex.textContent = 'TRACKING APEX';
          elVisApex.style.color = 'var(--color-text-primary)';
        }
      }

      const elPoorAlert = document.getElementById('hud-poor-vis-alert');
      if (elPoorAlert) {
        elPoorAlert.style.display = visScore < 50 ? 'block' : 'none';
      }
    }

    // 12-2 The Rim Shot Hunter (Rain Line Selection)
    else if (stintId === 'stint-12-2') {
      const isSweeper = speedMph > 45 && Math.abs(steer) > 0.12;
      const isRimShot = currentAbsLatG >= 0.70;

      const elLineState = document.getElementById('hud-rain-line-state');
      const elLineSub = document.getElementById('hud-rain-line-sub');
      if (elLineState) {
        if (!isSweeper) {
          elLineState.textContent = 'STRAIGHTAWAY';
          elLineState.style.color = 'var(--color-text-secondary)';
          if (elLineSub) elLineSub.textContent = 'Porous Outside Stance';
        } else if (isRimShot) {
          elLineState.textContent = 'RIM SHOT (OUTSIDE)';
          elLineState.style.color = 'var(--color-success)';
          if (elLineSub) elLineSub.textContent = 'High Grip Outside Asphalt';
        } else {
          elLineState.textContent = 'POLISHED DRY LINE';
          elLineState.style.color = 'var(--color-f1-red)';
          if (elLineSub) elLineSub.textContent = 'Slippery Rubber Surface';
        }
      }

      const elSurface = document.getElementById('hud-surface-grip-indicator');
      if (elSurface) {
        if (isRimShot || (!isSweeper && currentAbsLatG < 0.3)) {
          elSurface.textContent = 'DULL GRAY GRIP';
          elSurface.style.color = 'var(--color-success)';
        } else {
          elSurface.textContent = 'GLOSSY SLIPPERY';
          elSurface.style.color = 'var(--color-f1-red)';
        }
      }

      const elExitDelta = document.getElementById('hud-wet-exit-delta');
      if (elExitDelta) {
        if (throttlePct > 50 && speedMph > 40) {
          const deltaMph = isRimShot ? '+3.4 MPH' : '+0.4 MPH';
          elExitDelta.textContent = deltaMph;
          elExitDelta.style.color = isRimShot ? 'var(--color-success)' : 'var(--color-gold)';
        } else {
          elExitDelta.textContent = '+0.0 MPH';
          elExitDelta.style.color = 'var(--color-text-muted)';
        }
      }

      const elRimGrip = document.getElementById('hud-rim-grip-reading');
      if (elRimGrip) {
        elRimGrip.textContent = `${currentAbsLatG.toFixed(2)} G`;
        elRimGrip.style.color = currentAbsLatG >= 0.80 ? 'var(--color-success)' : (currentAbsLatG >= 0.65 ? '#00BFFF' : 'var(--color-gold)');
      }

      const elAdvisorBadge = document.getElementById('hud-rim-advisor-badge');
      if (elAdvisorBadge) {
        if (isRimShot) {
          elAdvisorBadge.textContent = 'RIM SHOT ENGAGED (+42% GRIP)';
          elAdvisorBadge.className = 'wet-line-advisor-badge rim-shot';
        } else if (isSweeper) {
          elAdvisorBadge.textContent = 'MOVE OUTSIDE (DRY LINE SLIPPERY)';
          elAdvisorBadge.className = 'wet-line-advisor-badge dry-line';
        } else {
          elAdvisorBadge.textContent = 'HUNTING POROUS ASPHALT';
          elAdvisorBadge.className = 'wet-line-advisor-badge rim-shot';
        }
      }
    }

    // 12-3 The Squaring-Off Artist (Wet Cornering Technique)
    else if (stintId === 'stint-12-3') {
      // 1. Scaled 2D Wet Traction Circle (50% Lat vs 64% Long scaled envelope)
      const latGVal = motion.acceleration?.lateralG != null ? motion.acceleration.lateralG : (motion.lateralG || motion.gLat || sample.gLat || 0);
      const longGVal = motion.acceleration?.longitudinalG != null ? motion.acceleration.longitudinalG : (motion.longitudinalG || motion.gLong || sample.gLong || 0);

      // Lat boundary is clamped closer (50% scale), Long boundary is 64%
      const latPos = Math.max(25, Math.min(75, 50 + (latGVal / 1.0) * 25));
      const longPos = Math.max(18, Math.min(82, 50 - (longGVal / 1.2) * 32));

      const elDot = document.getElementById('hud-wet-friction-dot');
      if (elDot) {
        elDot.style.left = `calc(${latPos}% - 4px)`;
        elDot.style.top = `calc(${longPos}% - 4px)`;
        elDot.style.background = (currentAbsLatG > 0.80 || throttlePct > 90 && Math.abs(steer) > 0.2) ? 'var(--color-f1-red)' : '#00BFFF';
      }

      const elWetGBreakdown = document.getElementById('hud-wet-g-breakdown');
      if (elWetGBreakdown) {
        elWetGBreakdown.textContent = `Lat: ${Math.abs(latGVal).toFixed(2)}G | Long: ${longGVal.toFixed(2)}G`;
      }

      // 2. Squaring-Off Trajectory Heading Indicator
      const elTrajectory = document.getElementById('hud-square-trajectory');
      if (elTrajectory) {
        if (brake > 0.4 && speedMph > 35) {
          elTrajectory.textContent = 'OVERSLOWING ENTRY (POINT NOSE)';
          elTrajectory.style.color = '#00BFFF';
        } else if (Math.abs(steer) > 0.25 && speedMph < 45) {
          elTrajectory.textContent = 'ROTATING CAR EARLY';
          elTrajectory.style.color = 'var(--color-gold)';
        } else if (throttlePct > 50 && Math.abs(steer) < 0.15 && speedMph > 40) {
          elTrajectory.textContent = 'EARLY STRAIGHT ACCELERATION';
          elTrajectory.style.color = 'var(--color-success)';
        } else {
          elTrajectory.textContent = 'LATE TURN-IN READY';
          elTrajectory.style.color = 'var(--color-text-primary)';
        }
      }

      // 3. Exit Throttle & Wheelspin Monitor
      const elThrottleStatus = document.getElementById('hud-wet-throttle-status');
      const elWheelspinSub = document.getElementById('hud-wet-wheelspin-sub');
      const wheelspinSpike = throttlePct > 80 && Math.abs(steer) > 0.25 && speedMph < 55;
      if (elThrottleStatus) {
        if (wheelspinSpike) {
          elThrottleStatus.textContent = '⚠️ REAR WHEELSPIN SPIKE';
          elThrottleStatus.style.color = 'var(--color-f1-red)';
          if (elWheelspinSub) elWheelspinSub.textContent = 'Squeeze pedal, do not stomp!';
        } else if (throttlePct > 70 && Math.abs(steer) < 0.15) {
          elThrottleStatus.textContent = 'OPTIMAL STRAIGHT DRIVE';
          elThrottleStatus.style.color = 'var(--color-success)';
          if (elWheelspinSub) elWheelspinSub.textContent = 'Full traction deployed';
        } else if (throttlePct > 0) {
          elThrottleStatus.textContent = 'PROGRESSIVE SQUEEZE';
          elThrottleStatus.style.color = '#00BFFF';
          if (elWheelspinSub) elWheelspinSub.textContent = 'Feeding power to rear axle';
        } else {
          elThrottleStatus.textContent = 'OFF THROTTLE (MID-CORNER)';
          elThrottleStatus.style.color = 'var(--color-text-muted)';
        }
      }

      // 4. Trailing Throttle Oversteer (TTO) Monitor
      const elTtoStatus = document.getElementById('hud-wet-tto-status');
      const ttoSnap = throttlePct < 5 && currentAbsLatG > 0.75 && speedMph > 45;
      if (elTtoStatus) {
        if (ttoSnap) {
          elTtoStatus.textContent = '⚠️ TTO LIFT DETECTED!';
          elTtoStatus.style.color = 'var(--color-f1-red)';
        } else {
          elTtoStatus.textContent = 'NO SNAP DETECTED';
          elTtoStatus.style.color = 'var(--color-success)';
        }
      }
    }
  }
}

