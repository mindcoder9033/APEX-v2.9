import { PdfReportGenerator } from './pdf-report.js';

export class LiveHudRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeStint = null;
    this.lapsCompleted = 0;
    this.telemetryStats = {
      avgSpeed: 0,
      maxGForce: 0,
    };
    this.sampleCount = 0;
  }

  startStint(stint) {
    this.activeStint = stint;
    this.lapsCompleted = 0;
    this.sampleCount = 0;
    this.telemetryStats = { avgSpeed: 0, maxGForce: 0 };
    this.renderTierWidgets();
  }

  stopStint() {
    if (!this.activeStint) return;
    
    // Generate PDF before clearing
    PdfReportGenerator.generateStintReport(this.activeStint, this.telemetryStats);
    
    this.activeStint = null;
    this.container.innerHTML = '';
  }

  renderTierWidgets() {
    if (!this.activeStint) return;
    this.container.innerHTML = '';

    const tier = this.activeStint.tier;
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '20px';

    if (tier === 1) {
      wrapper.innerHTML = `
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Driving Line Score: <span id="hud-line-score">--</span>%</div>
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Corner Exit Speed Delta: <span id="hud-exit-speed">--</span> km/h</div>
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Brake & Turn G-Meter (X/Y): <span id="hud-g-meter">-- / --</span></div>
      `;
    } else if (tier === 2) {
      wrapper.innerHTML = `
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Arc Radius: <span id="hud-arc-radius">--</span> ft</div>
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Apex Predictor: <span id="hud-apex-pred">--</span></div>
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Throttle Balance: <span id="hud-throttle-bal">--</span></div>
      `;
    } else if (tier === 3) {
      wrapper.innerHTML = `
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Early Apex Predictor: <span id="hud-early-apex">--</span></div>
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Traction Variability: <span id="hud-traction-var">--</span></div>
        <div class="stat-cell chamfer-all-corners" style="font-size: 20px;">Corner Priority: <span id="hud-corner-pri">--</span></div>
      `;
    }

    this.container.appendChild(wrapper);
  }

  update(telemetry) {
    if (!this.activeStint) return;

    // Very basic mock stats update
    this.sampleCount++;
    this.telemetryStats.avgSpeed = ((this.telemetryStats.avgSpeed * (this.sampleCount - 1)) + telemetry.speed) / this.sampleCount;
    const gForce = Math.sqrt(telemetry.gLat * telemetry.gLat + Math.gLong * telemetry.gLong) || 0;
    if (gForce > this.telemetryStats.maxGForce) this.telemetryStats.maxGForce = gForce;

    // Update specific widgets
    if (this.activeStint.tier === 1) {
      const el = document.getElementById('hud-exit-speed');
      if (el) el.textContent = telemetry.speed.toFixed(1);
    } else if (this.activeStint.tier === 2) {
      const el = document.getElementById('hud-arc-radius');
      if (el) el.textContent = (Math.random() * 200).toFixed(1); // placeholder
    }
  }
}
