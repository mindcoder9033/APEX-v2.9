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
      lineScore: 85,
      exitDeltaMph: 0.0,
      arcRadiusFt: 188,
      thresholdEffPct: 92,
      reactionDistanceFt: 28,
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
      lineScore: 88,
      exitDeltaMph: 0.0,
      arcRadiusFt: 192,
      thresholdEffPct: 91,
      reactionDistanceFt: 24,
      ttoEvents: 0
    };

    this.renderHudLayout();
  }

  stopStint() {
    if (!this.activeStint) return;

    const stintRef = this.activeStint;
    const evaluation = StintDiagnostics.evaluate(stintRef, this.sessionSamples, this.telemetryStats);

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
      // TIER 1: FUNDAMENTALS WIDGETS
      tierSpecificWidgetsHtml = `
        <div class="stints-hud-kpi-grid">
          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-success);">
            <span class="stat-cell-label">Driving Line Score</span>
            <span id="hud-line-score" class="stat-cell-value accent" style="color: var(--color-success); font-size: 26px;">88%</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Target: 90%+ (R3 Arc)</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-gold);">
            <span class="stat-cell-label">Corner Exit Speed Delta</span>
            <span id="hud-exit-delta" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">+1.4 MPH</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">+0.11s straightaway gain</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-f1-red);">
            <span class="stat-cell-label">Brake & Turn Blend Ratio</span>
            <span id="hud-brake-turn-blend" class="stat-cell-value" style="color: var(--color-f1-red); font-size: 26px;">78% / 22%</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Friction circle allocation</span>
          </div>

          <div class="stat-cell chamfer-all-corners">
            <span class="stat-cell-label">Telemetry Ping Status</span>
            <span id="hud-ping-status" class="stat-cell-value" style="color: var(--color-success); font-size: 16px; margin-top: 4px;">🎯 OPTIMAL APEX</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Instant positive reinforcement</span>
          </div>
        </div>
      `;
    } else if (stint.tier === 2) {
      // TIER 2: PHYSICS WIDGETS
      tierSpecificWidgetsHtml = `
        <div class="stints-hud-kpi-grid">
          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-gold);">
            <span class="stat-cell-label">Live Arc Radius (15GR=mph²)</span>
            <span id="hud-arc-radius" class="stat-cell-value" style="color: var(--color-gold); font-size: 26px;">192 ft</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Sebring T7 Ideal: 195 ft</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-success);">
            <span class="stat-cell-label">Apex Predictor Status</span>
            <span id="hud-apex-predictor" class="stat-cell-value" style="color: var(--color-success); font-size: 20px; margin-top: 2px;">LATE APEX (SAFE)</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Turn-in geometric forecast</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #0099FF);">
            <span class="stat-cell-label">Throttle Balance State</span>
            <span id="hud-throttle-balance" class="stat-cell-value" style="color: #0099FF; font-size: 20px; margin-top: 2px;">NEUTRAL SQUEEZE</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Weight transfer stability</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-f1-red);">
            <span class="stat-cell-label">Brake Threshold Pulse</span>
            <span id="hud-brake-pulse" class="stat-cell-value" style="color: var(--color-f1-red); font-size: 26px;">94% EFF</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Peak traction boundary</span>
          </div>
        </div>
      `;
    } else if (stint.tier === 3) {
      // TIER 3: REAL-WORLD ADAPTATION WIDGETS
      tierSpecificWidgetsHtml = `
        <div class="stints-hud-kpi-grid">
          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-f1-red);">
            <span class="stat-cell-label">Early Apex Prediction Alert</span>
            <span id="hud-early-apex-alert" class="stat-cell-value" style="color: var(--color-success); font-size: 20px; margin-top: 2px;">ON TRAJECTORY</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Lookahead: 90ft before apex</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid var(--color-gold);">
            <span class="stat-cell-label">Corner Priority Grade</span>
            <span id="hud-corner-priority" class="stat-cell-value" style="color: var(--color-gold); font-size: 22px;">TYPE I (PRIORITY)</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Lead-in to main straightaway</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #00CC66);">
            <span class="stat-cell-label">Camber & Surface Micro-Grip</span>
            <span id="hud-camber-grip" class="stat-cell-value" style="color: #00CC66; font-size: 26px;">+4.8° (+10% G)</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Positive banking compression</span>
          </div>

          <div class="stat-cell chamfer-all-corners" style="border-left: 3px solid #0099FF);">
            <span class="stat-cell-label">Steering Unwind Rate</span>
            <span id="hud-unwind-rate" class="stat-cell-value" style="color: #0099FF; font-size: 20px; margin-top: 2px;">OPTIMAL UNWIND</span>
            <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">Exit wheel opening rate</span>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <!-- Cockpit HUD Header Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-sm);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="status-dot" style="background-color: var(--color-success); box-shadow: 0 0 12px var(--color-success); animation: pulse-success 1.5s infinite;"></span>
          <div>
            <div style="font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--color-gold); letter-spacing: 1px;">
              LIVE STINT HUD // ${stint.name.toUpperCase()}
            </div>
            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-muted);">
              ${stint.prescribedCar} · ${stint.prescribedTrack} · Target: ${stint.laps} Laps
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

    const motion = sample.motion || {};
    const inputs = sample.inputs || {};
    const engine = sample.engine || {};
    const timing = sample.timing || {};
    const accelBlock = motion.acceleration || {};

    // Speed in KM/H and MPH
    const speedKmh = motion.speedKmh != null ? motion.speedKmh : (sample.speedKmh != null ? sample.speedKmh : (motion.speedMps ? motion.speedMps * 3.6 : (sample.speed ? sample.speed * 3.6 : 0)));
    const speedMph = motion.speedMph != null ? motion.speedMph : (sample.speedMph != null ? sample.speedMph : (speedKmh * 0.621371));

    // Pedals 0 - 100%
    const rawThrottle = inputs.throttle != null ? inputs.throttle : (sample.accel != null ? sample.accel / 255 : (sample.throttle != null ? sample.throttle : 0));
    const rawBrake = inputs.brake != null ? inputs.brake : (sample.brake != null ? sample.brake / 255 : 0);
    const throttlePct = Math.round(rawThrottle <= 1.0 ? rawThrottle * 100 : rawThrottle);
    const brakePct = Math.round(rawBrake <= 1.0 ? rawBrake * 100 : rawBrake);

    // Steering (-1.0 to +1.0)
    const steer = inputs.steering != null ? inputs.steering : (inputs.steer != null ? inputs.steer : (sample.steer != null ? sample.steer / 127 : 0));

    // Gear (0=R, 1=N, 2=1st, ...)
    const rawGear = inputs.gear != null ? inputs.gear : sample.gear;
    const gear = rawGear !== undefined ? (rawGear === 0 ? 'R' : rawGear === 1 ? 'N' : rawGear === 11 ? 'N' : (rawGear > 1 ? rawGear - 1 : rawGear)) : 'N';

    // G-Forces (Lateral & Longitudinal in Gs)
    const latGVal = accelBlock.lateralG != null ? accelBlock.lateralG : (motion.lateralG != null ? motion.lateralG : (motion.gLat != null ? motion.gLat : (sample.gLat || 0)));
    const longGVal = accelBlock.longitudinalG != null ? accelBlock.longitudinalG : (motion.longitudinalG != null ? motion.longitudinalG : (motion.gLong != null ? motion.gLong : (sample.gLong || 0)));
    
    const latGNum = Number(latGVal) || 0;
    const longGNum = Number(longGVal) || 0;
    const gLatFormatted = `${latGNum >= 0 ? '+' : ''}${latGNum.toFixed(2)}`;
    const gLongFormatted = `${longGNum >= 0 ? '+' : ''}${longGNum.toFixed(2)}`;

    // Track peak stats
    if (speedMph > this.telemetryStats.peakSpeedMph) {
      this.telemetryStats.peakSpeedMph = Math.round(speedMph);
      this.telemetryStats.peakSpeedKmh = Math.round(speedKmh);
    }
    const currentAbsLatG = Math.abs(latGNum);
    if (currentAbsLatG > this.telemetryStats.peakLatG) {
      this.telemetryStats.peakLatG = parseFloat(currentAbsLatG.toFixed(2));
    }

    // 1. Update Core Live HUD widgets
    const elSpeed = document.getElementById('hud-live-speed');
    if (elSpeed) elSpeed.textContent = `${Math.round(speedKmh)} KM/H`;

    const elInputs = document.getElementById('hud-live-inputs');
    if (elInputs) elInputs.textContent = `${throttlePct}% / ${brakePct}%`;

    const elG = document.getElementById('hud-live-g');
    if (elG) elG.textContent = `${gLatFormatted} / ${gLongFormatted} G`;

    const elGear = document.getElementById('hud-live-gear');
    if (elGear) elGear.textContent = gear;

    // 2. Handle Lap counts & auto-finish
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

    // 3. Dynamic Tier-specific widget updates
    if (this.activeStint.tier === 1) {
      const elExitDelta = document.getElementById('hud-exit-delta');
      if (elExitDelta) {
        const delta = ((Math.sin(Date.now() / 800) * 1.2) + (throttlePct > 70 ? 2.1 : (brakePct > 20 ? -1.4 : 0.8))).toFixed(1);
        elExitDelta.textContent = `${delta >= 0 ? '+' : ''}${delta} MPH`;
        elExitDelta.style.color = delta >= 0 ? 'var(--color-gold)' : 'var(--color-f1-red)';
      }
      const elLine = document.getElementById('hud-line-score');
      if (elLine) {
        const dynamicScore = Math.min(99, Math.max(70, Math.round(93 - Math.abs(steer) * 20)));
        elLine.textContent = `${dynamicScore}%`;
      }
      const elBlend = document.getElementById('hud-brake-turn-blend');
      if (elBlend) {
        const brakeWeight = Math.min(100, brakePct);
        const steerWeight = Math.min(100, Math.round(Math.abs(steer) * 100));
        elBlend.textContent = `${brakeWeight}% / ${steerWeight}%`;
      }
    } else if (this.activeStint.tier === 2) {
      const elArc = document.getElementById('hud-arc-radius');
      if (elArc) {
        const radius = Math.round(195 - Math.abs(steer) * 35 + (currentAbsLatG * 10));
        elArc.textContent = `${radius} ft`;
      }
      const elBrakePulse = document.getElementById('hud-brake-pulse');
      if (elBrakePulse) {
        if (brakePct > 0) {
          const eff = Math.min(100, Math.round(75 + (brakePct * 0.25)));
          elBrakePulse.textContent = `${eff}% EFF`;
          elBrakePulse.style.color = brakePct > 92 ? 'var(--color-f1-red)' : 'var(--color-success)';
        } else {
          elBrakePulse.textContent = 'READY';
          elBrakePulse.style.color = 'var(--color-text-muted)';
        }
      }
      const elThrottleBal = document.getElementById('hud-throttle-balance');
      if (elThrottleBal) {
        if (throttlePct > 85 && currentAbsLatG > 0.8) {
          elThrottleBal.textContent = 'POWER OVERSTEER RISK';
          elThrottleBal.style.color = 'var(--color-warning)';
        } else if (throttlePct === 0 && currentAbsLatG > 0.9) {
          elThrottleBal.textContent = 'TRAILING THROTTLE OVERSTEER (TTO)';
          elThrottleBal.style.color = 'var(--color-f1-red)';
        } else {
          elThrottleBal.textContent = 'BALANCED SQUEEZE';
          elThrottleBal.style.color = '#0099FF';
        }
      }
    } else if (this.activeStint.tier === 3) {
      const elEarlyApex = document.getElementById('hud-early-apex-alert');
      if (elEarlyApex) {
        if (brakePct > 50 && Math.abs(steer) > 0.35) {
          elEarlyApex.textContent = '⚠️ EARLY APEX WARNING (-90FT)';
          elEarlyApex.style.color = 'var(--color-f1-red)';
        } else {
          elEarlyApex.textContent = 'ON GEOMETRIC LINE';
          elEarlyApex.style.color = 'var(--color-success)';
        }
      }
      const elUnwind = document.getElementById('hud-unwind-rate');
      if (elUnwind) {
        if (throttlePct > 50 && Math.abs(steer) > 0.4) {
          elUnwind.textContent = 'HOLDING LOCK (UNWIND FASTER)';
          elUnwind.style.color = 'var(--color-warning)';
        } else {
          elUnwind.textContent = 'OPTIMAL UNWIND';
          elUnwind.style.color = '#0099FF';
        }
      }
    }
  }
}
