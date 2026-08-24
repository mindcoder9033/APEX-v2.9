/**
 * APEX HUD Renderer
 * High-performance, 60fps telemetry visualizer for Speed, RPM, Pedals, G-Force, and Tires.
 */

export class HudRenderer {
  constructor() {
    // DOM Elements Cache
    this.speedVal = document.getElementById('speed-val');
    this.speedUnit = document.getElementById('speed-unit');
    this.gearVal = document.getElementById('gear-val');
    this.rpmVal = document.getElementById('rpm-val');
    this.rpmMax = document.getElementById('rpm-max');
    this.shiftLightsBar = document.getElementById('shift-lights-bar');

    this.throttleFill = document.getElementById('throttle-fill');
    this.throttleText = document.getElementById('throttle-text');
    this.brakeFill = document.getElementById('brake-fill');
    this.brakeText = document.getElementById('brake-text');
    this.clutchFill = document.getElementById('clutch-fill');
    this.clutchText = document.getElementById('clutch-text');
    this.steeringIndicator = document.getElementById('steering-indicator');
    this.steeringText = document.getElementById('steering-text');

    this.gLatVal = document.getElementById('g-lat-val');
    this.gLongVal = document.getElementById('g-long-val');
    this.ggCanvas = document.getElementById('gg-canvas');
    this.ggCtx = this.ggCanvas ? this.ggCanvas.getContext('2d') : null;

    this.tireFL = document.getElementById('tire-temp-fl');
    this.tireFR = document.getElementById('tire-temp-fr');
    this.tireRL = document.getElementById('tire-temp-rl');
    this.tireRR = document.getElementById('tire-temp-rr');

    this.carClassBadge = document.getElementById('car-class-badge');
    this.carPiVal = document.getElementById('car-pi-val');

    // G-G diagram trail history
    this.gTrail = [];
    this.maxTrail = 30;

    this.initShiftLights();
    this.initGgCanvas();
  }

  initShiftLights() {
    if (!this.shiftLightsBar) return;
    this.shiftLightsBar.innerHTML = '';
    // 16 LED segments: 6 Green, 4 Yellow, 4 Red, 2 Purple
    for (let i = 0; i < 16; i++) {
      const led = document.createElement('div');
      led.className = 'shift-led';
      if (i < 6) led.classList.add('green');
      else if (i < 10) led.classList.add('yellow');
      else if (i < 14) led.classList.add('red');
      else led.classList.add('purple');
      this.shiftLightsBar.appendChild(led);
    }
  }

  initGgCanvas() {
    if (!this.ggCanvas || !this.ggCtx) return;
    this.drawGgBackground(0, 0);
  }

  drawGgBackground(currentLatG = 0, currentLongG = 0) {
    if (!this.ggCtx || !this.ggCanvas) return;
    const ctx = this.ggCtx;
    const w = this.ggCanvas.width;
    const h = this.ggCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = (w / 2) / 2.0; // 2.0G outer boundary

    ctx.clearRect(0, 0, w, h);

    // Grid circles: 0.5G, 1.0G, 1.5G
    ctx.lineWidth = 1;
    [0.5, 1.0, 1.5].forEach((g) => {
      ctx.beginPath();
      ctx.arc(cx, cy, g * scale, 0, Math.PI * 2);
      ctx.strokeStyle = g === 1.0 ? '#E10600' : '#2A2A2A';
      ctx.stroke();
      // Label
      ctx.fillStyle = '#666';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText(`${g}G`, cx + 3, cy - g * scale + 10);
    });

    // Crosshairs
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Draw G-G trail
    this.gTrail.push({ lat: currentLatG, long: currentLongG });
    if (this.gTrail.length > this.maxTrail) {
      this.gTrail.shift();
    }

    for (let i = 0; i < this.gTrail.length; i++) {
      const pt = this.gTrail[i];
      const alpha = (i + 1) / this.gTrail.length;
      const px = cx + (pt.lat * scale);
      const py = cy - (pt.long * scale);

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(225, 6, 0, ${alpha * 0.4})`;
      ctx.fill();
    }

    // Draw Current G Dot
    const curX = cx + (currentLatG * scale);
    const curY = cy - (currentLongG * scale);

    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#E10600';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /**
   * Updates all HUD elements from a single telemetry sample
   * @param {Object} sample 
   * @param {string} unitPreference 'kmh' or 'mph'
   */
  update(sample, unitPreference = 'kmh') {
    if (!sample) return;

    // 1. Speed & Gear (Strictly Metric KM/H)
    const speed = sample.motion.speedKmh != null ? sample.motion.speedKmh : (sample.motion.speedMps ? sample.motion.speedMps * 3.6 : (sample.motion.speedMph ? sample.motion.speedMph * 1.60934 : 0));
    if (this.speedVal) this.speedVal.textContent = Math.round(speed);
    if (this.speedUnit) this.speedUnit.textContent = 'KM/H';

    if (this.gearVal) {
      const g = sample.inputs.gear;
      this.gearVal.textContent = g === 0 ? 'R' : g === 1 ? 'N' : g - 1;
    }

    // 2. RPM & Shift Lights
    const currentRpm = sample.engine.currentRpm || 0;
    const maxRpm = sample.engine.maxRpm || 8000;
    const idleRpm = sample.engine.idleRpm || 1000;

    if (this.rpmVal) this.rpmVal.textContent = Math.round(currentRpm).toLocaleString();
    if (this.rpmMax) this.rpmMax.textContent = `/ ${Math.round(maxRpm)}`;

    if (this.shiftLightsBar) {
      const usableRange = maxRpm - idleRpm;
      const rpmPercent = Math.max(0, Math.min(1, (currentRpm - idleRpm) / usableRange));
      const activeLeds = Math.round(rpmPercent * 16);
      const leds = this.shiftLightsBar.children;

      for (let i = 0; i < leds.length; i++) {
        if (i < activeLeds) {
          leds[i].classList.add('active');
        } else {
          leds[i].classList.remove('active');
        }
      }
    }

    // 3. Driver Inputs (Pedals)
    const throttle = Math.round(sample.inputs.throttle * 100);
    const brake = Math.round(sample.inputs.brake * 100);
    const clutch = Math.round(sample.inputs.clutch * 100);

    if (this.throttleFill) this.throttleFill.style.height = `${throttle}%`;
    if (this.throttleText) this.throttleText.textContent = `${throttle}%`;

    if (this.brakeFill) this.brakeFill.style.height = `${brake}%`;
    if (this.brakeText) this.brakeText.textContent = `${brake}%`;

    if (this.clutchFill) this.clutchFill.style.height = `${clutch}%`;
    if (this.clutchText) this.clutchText.textContent = `${clutch}%`;

    // Steering
    const steer = sample.inputs.steering; // -1.0 to +1.0
    const steerPct = 50 + (steer * 45); // 5% to 95%
    if (this.steeringIndicator) this.steeringIndicator.style.left = `${steerPct}%`;
    if (this.steeringText) this.steeringText.textContent = `${Math.round(steer * 100)}%`;

    // 4. G-Forces
    const latG = sample.motion.acceleration.lateralG || 0;
    const longG = sample.motion.acceleration.longitudinalG || 0;

    if (this.gLatVal) this.gLatVal.textContent = `${latG >= 0 ? '+' : ''}${latG.toFixed(2)}G`;
    if (this.gLongVal) this.gLongVal.textContent = `${longG >= 0 ? '+' : ''}${longG.toFixed(2)}G`;

    this.drawGgBackground(latG, longG);

    // 5. Tires (Strictly Metric Celsius °C)
    if (sample.tires && (sample.tires.tempC || sample.tires.tempF)) {
      const getFormattedTemp = (tempCVal, tempFVal) => {
        const valC = tempCVal != null ? tempCVal : (tempFVal != null ? (tempFVal - 32) * (5 / 9) : 0);
        return `${Math.round(valC)}°C`;
      };

      if (this.tireFL) this.tireFL.textContent = getFormattedTemp(sample.tires.tempC?.frontLeft, sample.tires.tempF?.frontLeft);
      if (this.tireFR) this.tireFR.textContent = getFormattedTemp(sample.tires.tempC?.frontRight, sample.tires.tempF?.frontRight);
      if (this.tireRL) this.tireRL.textContent = getFormattedTemp(sample.tires.tempC?.rearLeft, sample.tires.tempF?.rearLeft);
      if (this.tireRR) this.tireRR.textContent = getFormattedTemp(sample.tires.tempC?.rearRight, sample.tires.tempF?.rearRight);
    }

    // 6. Car Profile
    if (this.carClassBadge && sample.vehicle.carClass) {
      this.carClassBadge.textContent = sample.vehicle.carClass;
    }
    if (this.carPiVal && sample.vehicle.carPerformanceIndex) {
      this.carPiVal.textContent = `PI ${sample.vehicle.carPerformanceIndex}`;
    }
  }
}
