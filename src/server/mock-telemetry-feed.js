/**
 * APEX Mock Telemetry Feed Simulator
 * Generates synthetic 60Hz 331-byte binary UDP packets matching Forza Motorsport 2023 specs.
 * Used for automated testing and UI verification without requiring a physical Xbox.
 */

import dgram from 'node:dgram';
import { CONFIG } from './config.js';

export class MockTelemetryGenerator {
  constructor(options = {}) {
    this.targetPort = options.port || CONFIG.udp.port;
    this.targetHost = options.host || '127.0.0.1';
    this.frequencyHz = options.frequencyHz || 60;
    this.carClass = options.carClass || 5; // S Class
    this.carOrdinal = options.carOrdinal || 1234;

    this.socket = null;
    this.intervalHandle = null;
    this.lapNumber = 1;
    this.currentLapTime = 0;
    this.bestLapTime = 72.45;
    this.lastLapTime = 73.12;
    this.distanceTraveled = 0;
    this.tickCount = 0;
  }

  /**
   * Generates a 331-byte binary Buffer for a given synthetic state
   * @param {Object} state 
   * @returns {Buffer}
   */
  static buildPacket(state = {}) {
    const buffer = Buffer.alloc(331);
    const littleEndian = true;

    // Header
    const rawTs = state.timestampMs !== undefined ? state.timestampMs : Date.now();
    const ts = (rawTs % 0xFFFFFFFF) >>> 0;
    buffer.writeUInt32LE(ts, 0);
    buffer.writeInt32LE(state.isRaceOn !== undefined ? (state.isRaceOn ? 1 : 0) : 1, 4);

    // Sled Data
    buffer.writeFloatLE(state.engineMaxRpm ?? 8500.0, 8);
    buffer.writeFloatLE(state.engineIdleRpm ?? 950.0, 12);
    buffer.writeFloatLE(state.currentEngineRpm ?? 6200.0, 16);

    // Accel X, Y, Z
    buffer.writeFloatLE(state.accelX ?? 0.0, 20); // Lateral
    buffer.writeFloatLE(state.accelY ?? 0.0, 24); // Vertical
    buffer.writeFloatLE(state.accelZ ?? 4.5, 28); // Longitudinal

    // Velocity X, Y, Z (m/s)
    buffer.writeFloatLE(state.velocityX ?? 0.0, 32);
    buffer.writeFloatLE(state.velocityY ?? 0.0, 36);
    buffer.writeFloatLE(state.velocityZ ?? 45.0, 40);

    // Angular Velocity X, Y, Z
    buffer.writeFloatLE(state.angVelX ?? 0.0, 44);
    buffer.writeFloatLE(state.angVelY ?? 0.0, 48);
    buffer.writeFloatLE(state.angVelZ ?? 0.0, 52);

    // Yaw, Pitch, Roll
    buffer.writeFloatLE(state.yaw ?? 0.0, 56);
    buffer.writeFloatLE(state.pitch ?? 0.0, 60);
    buffer.writeFloatLE(state.roll ?? 0.0, 64);

    // Norm Suspension Travel (FL, FR, RL, RR)
    buffer.writeFloatLE(state.suspTravelFL ?? 0.45, 68);
    buffer.writeFloatLE(state.suspTravelFR ?? 0.45, 72);
    buffer.writeFloatLE(state.suspTravelRL ?? 0.52, 76);
    buffer.writeFloatLE(state.suspTravelRR ?? 0.52, 80);

    // Tire Slip Ratio (FL, FR, RL, RR)
    buffer.writeFloatLE(state.slipRatioFL ?? 0.02, 84);
    buffer.writeFloatLE(state.slipRatioFR ?? 0.02, 88);
    buffer.writeFloatLE(state.slipRatioRL ?? 0.05, 92);
    buffer.writeFloatLE(state.slipRatioRR ?? 0.05, 96);

    // Wheel Rotation Speed
    buffer.writeFloatLE(state.wheelRotFL ?? 120.0, 100);
    buffer.writeFloatLE(state.wheelRotFR ?? 120.0, 104);
    buffer.writeFloatLE(state.wheelRotRL ?? 120.0, 108);
    buffer.writeFloatLE(state.wheelRotRR ?? 120.0, 112);

    // Wheel on Rumble Strip
    buffer.writeInt32LE(state.rumbleFL ? 1 : 0, 116);
    buffer.writeInt32LE(state.rumbleFR ? 1 : 0, 120);
    buffer.writeInt32LE(state.rumbleRL ? 1 : 0, 124);
    buffer.writeInt32LE(state.rumbleRR ? 1 : 0, 128);

    // Puddles
    buffer.writeFloatLE(0.0, 132);
    buffer.writeFloatLE(0.0, 136);
    buffer.writeFloatLE(0.0, 140);
    buffer.writeFloatLE(0.0, 144);

    // Surface rumble
    buffer.writeFloatLE(0.0, 148);
    buffer.writeFloatLE(0.0, 152);
    buffer.writeFloatLE(0.0, 156);
    buffer.writeFloatLE(0.0, 160);

    // Tire Slip Angle
    buffer.writeFloatLE(state.slipAngleFL ?? 0.01, 164);
    buffer.writeFloatLE(state.slipAngleFR ?? 0.01, 168);
    buffer.writeFloatLE(state.slipAngleRL ?? 0.01, 172);
    buffer.writeFloatLE(state.slipAngleRR ?? 0.01, 176);

    // Combined Slip
    buffer.writeFloatLE(state.combSlipFL ?? 0.02, 180);
    buffer.writeFloatLE(state.combSlipFR ?? 0.02, 184);
    buffer.writeFloatLE(state.combSlipRL ?? 0.05, 188);
    buffer.writeFloatLE(state.combSlipRR ?? 0.05, 192);

    // Suspension Travel Meters
    buffer.writeFloatLE(0.08, 196);
    buffer.writeFloatLE(0.08, 200);
    buffer.writeFloatLE(0.09, 204);
    buffer.writeFloatLE(0.09, 208);

    // Vehicle profile
    buffer.writeInt32LE(state.carOrdinal ?? 1234, 212);
    buffer.writeInt32LE(state.carClass ?? 5, 216); // S Class
    buffer.writeInt32LE(state.carPI ?? 798, 220);
    buffer.writeInt32LE(state.drivetrain ?? 1, 224); // RWD
    buffer.writeInt32LE(state.cylinders ?? 6, 228);

    // Dash Data
    buffer.writeFloatLE(state.posX ?? 100.0, 232);
    buffer.writeFloatLE(state.posY ?? 5.0, 236);
    buffer.writeFloatLE(state.posZ ?? 250.0, 240);

    buffer.writeFloatLE(state.speedMps ?? 45.0, 244); // ~100.6 mph
    buffer.writeFloatLE(state.powerWatts ?? 320000.0, 248); // ~429 HP
    buffer.writeFloatLE(state.torqueNm ?? 520.0, 252);

    // Tire Temps
    buffer.writeFloatLE(state.tireTempFL ?? 210.0, 256);
    buffer.writeFloatLE(state.tireTempFR ?? 210.0, 260);
    buffer.writeFloatLE(state.tireTempRL ?? 215.0, 264);
    buffer.writeFloatLE(state.tireTempRR ?? 215.0, 268);

    // Boost & Fuel
    buffer.writeFloatLE(state.boost ?? 1.1, 272);
    buffer.writeFloatLE(state.fuel ?? 0.85, 276);
    buffer.writeFloatLE(state.distanceTraveled ?? 1250.0, 280);

    // Laps
    buffer.writeFloatLE(state.bestLap ?? 72.45, 284);
    buffer.writeFloatLE(state.lastLap ?? 73.12, 288);
    buffer.writeFloatLE(state.currentLap ?? 24.50, 292);
    buffer.writeFloatLE(state.currentRaceTime ?? 170.0, 296);

    // Inputs
    const rawLapVal = state.rawLapNumber !== undefined
      ? state.rawLapNumber
      : (state.lapNumber !== undefined ? Math.max(0, state.lapNumber - 1) : 0);
    buffer.writeUInt16LE(rawLapVal, 300);
    buffer.writeUInt8(state.racePosition ?? 1, 302);
    buffer.writeUInt8(state.accelByte ?? 255, 303);
    buffer.writeUInt8(state.brakeByte ?? 0, 304);
    buffer.writeUInt8(state.clutchByte ?? 0, 305);
    buffer.writeUInt8(state.handbrakeByte ?? 0, 306);
    buffer.writeUInt8(state.gear ?? 4, 307);
    buffer.writeInt8(state.steerByte ?? 0, 308);
    buffer.writeInt8(state.normDrivingLine ?? 0, 309);
    buffer.writeInt8(state.normAIBrake ?? 0, 310);

    // Tire wear & Track
    buffer.writeFloatLE(0.02, 311);
    buffer.writeFloatLE(0.02, 315);
    buffer.writeFloatLE(0.03, 319);
    buffer.writeFloatLE(0.03, 323);
    buffer.writeInt32LE(state.trackOrdinal ?? 42, 327);

    return buffer;
  }

  /**
   * Start generating and sending 60Hz UDP packets
   */
  start() {
    this.socket = dgram.createSocket('udp4');
    const dt = 1 / this.frequencyHz;

    console.log(`\n🏎️  Starting Mock Telemetry Stream:`);
    console.log(`   Target: ${this.targetHost}:${this.targetPort} @ ${this.frequencyHz}Hz\n`);

    this.intervalHandle = setInterval(() => {
      this.tickCount++;
      this.currentLapTime += dt;
      
      // Simulate lap completion every ~75 seconds
      if (this.currentLapTime >= 75.0) {
        this.lastLapTime = this.currentLapTime;
        if (this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
        }
        this.lapNumber++;
        this.currentLapTime = 0;
        console.log(`🏁 [MOCK] Crossed Start/Finish line! Starting Lap ${this.lapNumber}`);
      }

      // Simulate a synthetic lap phase: Straight -> Braking -> Cornering -> Exit
      const phase = (this.tickCount % 600) / 600; // 10s cycle
      let speedMps = 45.0;
      let accelByte = 255;
      let brakeByte = 0;
      let steerByte = 0;
      let accelX = 0;
      let accelZ = 3.5;
      let gear = 4;

      if (phase < 0.4) {
        // Straightaway acceleration
        speedMps = 35.0 + phase * 60.0; // 35 -> 59 m/s (~132 mph)
        accelByte = 255;
        brakeByte = 0;
        steerByte = 0;
        gear = 4;
        accelZ = 4.0;
      } else if (phase < 0.6) {
        // Threshold Braking zone into Turn
        const brakePhase = (phase - 0.4) / 0.2;
        speedMps = 59.0 - brakePhase * 35.0; // 59 -> 24 m/s (~53 mph)
        accelByte = 0;
        brakeByte = Math.floor(255 * (1 - brakePhase * 0.4)); // 100% -> 60% trail
        steerByte = Math.floor(brakePhase * 40); // Beginning turn-in
        gear = 2;
        accelZ = -12.5; // -1.27G decel
        accelX = brakePhase * 6.0;
      } else if (phase < 0.8) {
        // Mid-corner apex
        const cornerPhase = (phase - 0.6) / 0.2;
        speedMps = 24.0 + cornerPhase * 5.0;
        accelByte = Math.floor(cornerPhase * 180);
        brakeByte = 0;
        steerByte = Math.floor(65 * (1 - cornerPhase * 0.5));
        gear = 2;
        accelX = 11.5; // 1.17G Lateral
        accelZ = 1.0;
      } else {
        // Corner exit acceleration
        const exitPhase = (phase - 0.8) / 0.2;
        speedMps = 29.0 + exitPhase * 25.0;
        accelByte = 255;
        brakeByte = 0;
        steerByte = Math.floor(30 * (1 - exitPhase));
        gear = 3;
        accelZ = 5.0;
        accelX = (1 - exitPhase) * 4.0;
      }

      // Compute 2D circuit position
      const lapProgress = (this.currentLapTime % 75.0) / 75.0;
      const angle = lapProgress * 2 * Math.PI;
      const posX = 400 * Math.cos(angle) + 120 * Math.sin(2 * angle);
      const posZ = 280 * Math.sin(angle) + 70 * Math.cos(3 * angle);

      const packet = MockTelemetryGenerator.buildPacket({
        timestampMs: Date.now(),
        speedMps,
        accelByte,
        brakeByte,
        steerByte,
        gear,
        accelX,
        accelZ,
        posX,
        posZ,
        lapNumber: this.lapNumber,
        currentLap: this.currentLapTime,
        bestLap: this.bestLapTime,
        lastLap: this.lastLapTime,
        distanceTraveled: this.distanceTraveled += speedMps * dt
      });

      this.socket.send(packet, this.targetPort, this.targetHost, (err) => {
        if (err) {
          console.error('[MOCK ERROR] UDP Send error:', err.message);
        }
      });
    }, 1000 / this.frequencyHz);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    console.log('[MOCK] Telemetry stream stopped.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('mock-telemetry-feed.js')) {
  const generator = new MockTelemetryGenerator();
  generator.start();

  process.on('SIGINT', () => {
    generator.stop();
    process.exit(0);
  });
}
