/**
 * APEX Stints Live HUD Overlay Renderer
 * Renders isolated, tier-specific motorsport telemetry widgets during an active stint session.
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

  renderHudLayout() {
    if (!this.container || !this.activeStint) return;
    this.container.style.display = 'flex';

    const stint = this.activeStint;

    let tierSpecificWidgetsHtml = '';

    if (stint.tier === 1) {
      // TIER 1: FUNDAMENTALS WIDGETS (Initial awaiting telemetry state - NO MOCK NUMBERS)
      tierSpecificWidgetsHtml = `
        <div class="stints-hud-kpi-grid">
          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Driving Line Score</span>
            <span id="hud-line-score" class="stat-cell-value accent" style="color: var(--color-text-muted); font-size: 26px;">--%</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 90%+ (R3 Arc)</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Corner Exit Speed Delta</span>
            <span id="hud-exit-delta" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- MPH/s</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Instantaneous longitudinal drive</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Brake & Turn Blend Ratio</span>
            <span id="hud-brake-turn-blend" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">0% / 0%</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Friction circle allocation</span>
          </div>

          <div class="stat-cell chamfer-all-corners">
            <span class="stat-cell-label">Telemetry Ping Status</span>
            <span id="hud-ping-status" class="stat-cell-value" style="color: var(--color-warning); font-size: 14px; margin-top: 4px;">📡 AWAITING UDP TELEMETRY</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Awaiting Forza telemetry feed</span>
          </div>
        </div>
      `;
    } else if (stint.tier === 2) {
      // TIER 2: PHYSICS WIDGETS (Initial awaiting telemetry state)
      tierSpecificWidgetsHtml = `
        <div class="stints-hud-kpi-grid">
          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Live Arc Radius (15GR=mph²)</span>
            <span id="hud-arc-radius" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">-- ft</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 195 ft geometric benchmark</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Apex Predictor Status</span>
            <span id="hud-apex-predictor" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Turn-in geometric forecast</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Throttle Balance State</span>
            <span id="hud-throttle-balance" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Weight transfer stability</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Brake Threshold Pulse</span>
            <span id="hud-brake-pulse" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">READY</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Deceleration boundary</span>
          </div>
        </div>
      `;
    } else if (stint.tier === 3) {
      // TIER 3: REAL-WORLD ADAPTATION WIDGETS (Initial awaiting telemetry state)
      tierSpecificWidgetsHtml = `
        <div class="stints-hud-kpi-grid">
          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Early Apex Prediction Alert</span>
            <span id="hud-early-apex-alert" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Lookahead: 90ft before apex</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Corner Priority Grade</span>
            <span id="hud-corner-priority" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px;">--</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Dynamic sequence priority</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Camber & Suspension Load</span>
            <span id="hud-camber-grip" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 26px;">--</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Suspension compression load</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-border-bright);">
            <span class="stat-cell-label">Steering Unwind Rate</span>
            <span id="hud-unwind-rate" class="stat-cell-value" style="color: var(--color-text-muted); font-size: 18px; margin-top: 2px;">--</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Exit wheel opening rate</span>
          </div>
        </div>
      `;
    }

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
              ${stint.prescribedCar} · ${stint.prescribedTrack} · Target: ${stint.laps} Laps · <span id="hud-live-status-text" style="color: var(--color-warning);">AWAITING UDP TELEMETRY (0 SAMPLES)</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="text-align: right; font-family: var(--font-mono); font-size: 11px;">
            <span style="color: var(--color-text-muted); display: block; font-size: 9px;">PROGRESS</span>
            <strong id="hud-lap-progress" style="color: var(--color-text-primary); font-size: 14px;">LAP 1 / ${stint.laps}</strong>
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

      <!-- Tier-Specific Live HUD Widgets -->
      <div style="margin-top: 8px;">
        <div style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          ⚡ Tier ${stint.tier} Live Diagnostic Gauges (${stint.tierName})
        </div>
        ${tierSpecificWidgetsHtml}
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

    // Update status indicator to active live stream
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

    // 1. Precise Speed in KM/H and MPH
    const speedKmh = motion.speedKmh != null ? motion.speedKmh : (sample.speedKmh != null ? sample.speedKmh : (motion.speedMps ? motion.speedMps * 3.6 : (sample.speed ? sample.speed * 3.6 : 0)));
    const speedMph = motion.speedMph != null ? motion.speedMph : (sample.speedMph != null ? sample.speedMph : (speedKmh * 0.621371));

    // 2. Pedals (0 - 100%)
    const rawThrottle = inputs.throttle != null ? inputs.throttle : (sample.accel != null ? sample.accel / 255 : (sample.throttle != null ? sample.throttle : 0));
    const rawBrake = inputs.brake != null ? inputs.brake : (sample.brake != null ? sample.brake / 255 : 0);
    const throttlePct = Math.min(100, Math.max(0, Math.round(rawThrottle <= 1.0 ? rawThrottle * 100 : rawThrottle)));
    const brakePct = Math.min(100, Math.max(0, Math.round(rawBrake <= 1.0 ? rawBrake * 100 : rawBrake)));

    // 3. Steering (-1.0 to +1.0)
    const steer = inputs.steering != null ? inputs.steering : (inputs.steer != null ? inputs.steer : (sample.steer != null ? sample.steer / 127 : 0));

    // 4. Gear
    const rawGear = inputs.gear != null ? inputs.gear : sample.gear;
    const gear = rawGear !== undefined ? (rawGear === 0 ? 'R' : rawGear === 11 ? 'N' : rawGear === 1 ? 'N' : (rawGear > 1 ? rawGear - 1 : rawGear)) : 'N';

    // 5. G-Forces (Lateral & Longitudinal in Gs)
    const latGVal = accelBlock.lateralG != null ? accelBlock.lateralG : (motion.lateralG != null ? motion.lateralG : (motion.gLat != null ? motion.gLat : (sample.gLat || 0)));
    const longGVal = accelBlock.longitudinalG != null ? accelBlock.longitudinalG : (motion.longitudinalG != null ? motion.longitudinalG : (motion.gLong != null ? motion.gLong : (sample.gLong || 0)));
    
    const latGNum = Number(latGVal) || 0;
    const longGNum = Number(longGVal) || 0;
    const currentAbsLatG = Math.abs(latGNum);
    const currentAbsLongG = Math.abs(longGNum);

    const gLatFormatted = `${latGNum >= 0 ? '+' : ''}${latGNum.toFixed(2)}`;
    const gLongFormatted = `${longGNum >= 0 ? '+' : ''}${longGNum.toFixed(2)}`;

    // Track peak stats strictly from real data
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

    // Update Core Live HUD widgets
    const elSpeed = document.getElementById('hud-live-speed');
    if (elSpeed) elSpeed.textContent = `${Math.round(speedKmh)} KM/H`;

    const elInputs = document.getElementById('hud-live-inputs');
    if (elInputs) elInputs.textContent = `${throttlePct}% / ${brakePct}%`;

    const elG = document.getElementById('hud-live-g');
    if (elG) elG.textContent = `${gLatFormatted} / ${gLongFormatted} G`;

    const elGear = document.getElementById('hud-live-gear');
    if (elGear) elGear.textContent = gear;

    // Lap counts & progress
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

    // Dynamic Tier-specific widget calculations from actual telemetry
    if (this.activeStint.tier === 1) {
      // 1. Driving Line Score
      const elLine = document.getElementById('hud-line-score');
      if (elLine) {
        let lineScoreVal = 100;
        if (timing.normalizedDrivingLine !== undefined) {
          const dev = Math.abs(timing.normalizedDrivingLine);
          lineScoreVal = Math.max(0, Math.min(100, Math.round(100 - (dev / 127) * 100)));
        } else {
          const steerInstability = Math.abs(steer) * 40;
          lineScoreVal = Math.max(50, Math.min(100, Math.round(100 - steerInstability)));
        }
        this.telemetryStats.lineScore = lineScoreVal;
        elLine.textContent = `${lineScoreVal}%`;
        elLine.style.color = lineScoreVal >= 90 ? 'var(--color-success)' : (lineScoreVal >= 80 ? 'var(--color-gold)' : 'var(--color-f1-red)');
      }

      // 2. Corner Exit Speed Delta (Real rate of acceleration delta)
      const elExitDelta = document.getElementById('hud-exit-delta');
      if (elExitDelta) {
        const accelGZ = accelBlock.longitudinalG != null ? accelBlock.longitudinalG : (longGNum || 0);
        const deltaMphRate = parseFloat((accelGZ * 21.937).toFixed(1));
        this.telemetryStats.exitDeltaMph = deltaMphRate;
        elExitDelta.textContent = `${deltaMphRate >= 0 ? '+' : ''}${deltaMphRate} MPH/s`;
        elExitDelta.style.color = deltaMphRate >= 0 ? 'var(--color-gold)' : 'var(--color-f1-red)';
      }

      // 3. Brake & Turn Blend Ratio
      const elBlend = document.getElementById('hud-brake-turn-blend');
      if (elBlend) {
        const steerPct = Math.min(100, Math.round(Math.abs(steer) * 100));
        elBlend.textContent = `${brakePct}% / ${steerPct}%`;
        elBlend.style.color = (brakePct > 60 && steerPct > 40) ? 'var(--color-f1-red)' : ((brakePct > 0 && steerPct > 0) ? 'var(--color-gold)' : 'var(--color-text-primary)');
      }

      // 4. Telemetry Ping Status
      const elPing = document.getElementById('hud-ping-status');
      if (elPing) {
        if (throttlePct > 80 && Math.abs(steer) < 0.15 && speedMph > 35) {
          elPing.textContent = '🎯 OPTIMAL APEX EXIT (FULL POWER)';
          elPing.style.color = 'var(--color-success)';
        } else if (brakePct > 70 && Math.abs(steer) > 0.3) {
          elPing.textContent = '⚠️ TRAIL-BRAKE OVERLOAD';
          elPing.style.color = 'var(--color-f1-red)';
        } else if (brakePct > 80 && Math.abs(steer) <= 0.1) {
          elPing.textContent = '🛑 THRESHOLD BRAKING';
          elPing.style.color = 'var(--color-gold)';
        } else if (currentAbsLatG > 0.8 && throttlePct > 10 && throttlePct < 60) {
          elPing.textContent = '⚖️ BALANCED APEX SQUEEZE';
          elPing.style.color = 'var(--color-success)';
        } else if (currentAbsLatG > 0.85 && throttlePct === 0 && brakePct === 0) {
          elPing.textContent = '⚠️ COASTING MID-CORNER';
          elPing.style.color = 'var(--color-warning)';
        } else if (speedMph < 5) {
          elPing.textContent = '🅿️ STATIONARY';
          elPing.style.color = 'var(--color-text-muted)';
        } else {
          elPing.textContent = '📡 STREAMING LIVE 60Hz';
          elPing.style.color = 'var(--color-success)';
        }
      }
    } else if (this.activeStint.tier === 2) {
      // 1. Live Arc Radius (15GR = mph² -> R = v² / (15 * |G_lat|))
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

      // 2. Apex Predictor Status
      const elApexPred = document.getElementById('hud-apex-predictor');
      if (elApexPred) {
        if (Math.abs(steer) > 0.4 && currentAbsLatG < 0.5 && speedMph > 35) {
          elApexPred.textContent = 'EARLY TURN-IN (PINCHED)';
          elApexPred.style.color = 'var(--color-f1-red)';
        } else if (Math.abs(steer) < 0.25 && currentAbsLatG > 0.75) {
          elApexPred.textContent = 'LATE APEX (MAX RADIUS)';
          elApexPred.style.color = 'var(--color-success)';
        } else if (currentAbsLatG > 0.4) {
          elApexPred.textContent = 'GEOMETRIC ARC (ON-LINE)';
          elApexPred.style.color = 'var(--color-gold)';
        } else {
          elApexPred.textContent = 'APPROACHING CORNER';
          elApexPred.style.color = 'var(--color-text-muted)';
        }
      }

      // 3. Throttle Balance State
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

      // 4. Brake Threshold Pulse
      const elBrakePulse = document.getElementById('hud-brake-pulse');
      if (elBrakePulse) {
        if (brakePct > 0) {
          const decelEff = Math.min(100, Math.max(10, Math.round((currentAbsLongG / 1.3) * 100)));
          this.telemetryStats.thresholdEffPct = decelEff;
          elBrakePulse.textContent = `${decelEff}% EFF (${longGFormatted}G)`;
          elBrakePulse.style.color = brakePct > 95 ? 'var(--color-f1-red)' : 'var(--color-success)';
        } else {
          elBrakePulse.textContent = 'READY (0% LOAD)';
          elBrakePulse.style.color = 'var(--color-text-muted)';
        }
      }
    } else if (this.activeStint.tier === 3) {
      // 1. Early Apex Prediction Alert
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

      // 2. Corner Priority Grade
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

      // 3. Camber & Surface Micro-Grip / Suspension Compression
      const elCamber = document.getElementById('hud-camber-grip');
      if (elCamber) {
        const normTravel = chassis.normalizedSuspensionTravel || {};
        const avgTravel = normTravel.frontLeft != null 
          ? ((normTravel.frontLeft + normTravel.frontRight + normTravel.rearLeft + normTravel.rearRight) / 4) * 100 
          : 0;
        if (avgTravel > 0) {
          elCamber.textContent = `${Math.round(avgTravel)}% SUSP LOAD (${currentAbsLatG.toFixed(2)}G)`;
          elCamber.style.color = avgTravel > 75 ? 'var(--color-warning)' : '#00CC66';
        } else {
          elCamber.textContent = `${currentAbsLatG.toFixed(2)}G LATERAL LOAD`;
          elCamber.style.color = '#00CC66';
        }
      }

      // 4. Steering Unwind Rate
      const elUnwind = document.getElementById('hud-unwind-rate');
      if (elUnwind) {
        if (throttlePct > 50 && Math.abs(steer) > 0.35) {
          elUnwind.textContent = 'HOLDING LOCK (UNWIND FASTER)';
          elUnwind.style.color = 'var(--color-warning)';
        } else if (throttlePct > 50 && Math.abs(steer) <= 0.2 && speedMph > 30) {
          elUnwind.textContent = 'PROGRESSIVE UNWIND (OPTIMAL)';
          elUnwind.style.color = 'var(--color-success)';
        } else {
          elUnwind.textContent = 'NEUTRAL / TRACKING';
          elUnwind.style.color = 'var(--color-text-muted)';
        }
      }
    }
  }
}
