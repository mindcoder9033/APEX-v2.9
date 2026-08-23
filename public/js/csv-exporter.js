/**
 * APEX Telemetry CSV Exporter (Browser Client Module)
 * Formats stint and lap telemetry streams into standardized CSV and handles client-side blob downloads.
 */

export class TelemetryCsvExporter {
  /**
   * Generates a CSV formatted string from an array of APEX TelemetryData samples
   */
  static exportToCsv(samples = []) {
    if (!samples || samples.length === 0) {
      return this.getHeaderRow();
    }

    const rows = [this.getHeaderRow()];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const m = s.motion || {};
      const pos = m.position || {};
      const acc = m.acceleration || {};
      const ori = m.orientation || {};
      const inp = s.inputs || {};
      const eng = s.engine || {};
      const lap = s.lap || {};
      const t = s.tires || {};
      const tt = t.temperatures || {};
      const tsr = t.slipRatio || {};
      const tsa = t.slipAngle || {};
      const sus = t.suspensionTravel || {};
      const rum = t.surfaceRumble || {};

      const speedMps = m.speedMps || 0;
      const speedMph = speedMps * 2.23694;
      const speedKmh = speedMps * 3.6;
      const timestampMs = s.timestamp || Math.round(i * 16.6667);

      const cols = [
        timestampMs,
        lap.currentLap || 1,
        (lap.distanceTraveledMeters || 0).toFixed(2),
        (pos.x || 0).toFixed(4),
        (pos.y || 0).toFixed(4),
        (pos.z || 0).toFixed(4),
        speedMph.toFixed(2),
        speedKmh.toFixed(2),
        (acc.longitudinalG || 0).toFixed(3),
        (acc.lateralG || 0).toFixed(3),
        (acc.verticalG || 0).toFixed(3),
        (ori.yaw || 0).toFixed(2),
        (ori.pitch || 0).toFixed(2),
        (ori.roll || 0).toFixed(2),
        Math.round((inp.throttle || 0) * 100),
        Math.round((inp.brake || 0) * 100),
        Math.round((inp.clutch || 0) * 100),
        (inp.steering || 0).toFixed(3),
        (inp.handbrake ? 1 : 0),
        inp.gear ?? 0,
        Math.round(eng.currentRpm || 0),
        Math.round(eng.maxRpm || 8000),
        Math.round(eng.idleRpm || 1000),
        Math.round(tt.frontLeft || 0),
        Math.round(tt.frontRight || 0),
        Math.round(tt.rearLeft || 0),
        Math.round(tt.rearRight || 0),
        (tsr.frontLeft || 0).toFixed(4),
        (tsr.frontRight || 0).toFixed(4),
        (tsr.rearLeft || 0).toFixed(4),
        (tsr.rearRight || 0).toFixed(4),
        (tsa.frontLeft || 0).toFixed(4),
        (tsa.frontRight || 0).toFixed(4),
        (tsa.rearLeft || 0).toFixed(4),
        (tsa.rearRight || 0).toFixed(4),
        (sus.frontLeft || 0).toFixed(4),
        (sus.frontRight || 0).toFixed(4),
        (sus.rearLeft || 0).toFixed(4),
        (sus.rearRight || 0).toFixed(4),
        (rum.frontLeft || 0).toFixed(3),
        (rum.frontRight || 0).toFixed(3),
        (rum.rearLeft || 0).toFixed(3),
        (rum.rearRight || 0).toFixed(3)
      ];

      rows.push(cols.join(','));
    }

    return rows.join('\r\n');
  }

  /**
   * Triggers a browser download of the CSV data
   */
  static downloadCsv(samples = [], filename = 'APEX_Stint_Telemetry.csv') {
    const csvContent = this.exportToCsv(samples);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static getHeaderRow() {
    return [
      'TimestampMs',
      'LapNumber',
      'DistanceTraveledM',
      'PositionX',
      'PositionY',
      'PositionZ',
      'SpeedMph',
      'SpeedKmh',
      'AccelLongG',
      'AccelLatG',
      'AccelVertG',
      'YawDeg',
      'PitchDeg',
      'RollDeg',
      'ThrottlePct',
      'BrakePct',
      'ClutchPct',
      'SteeringNorm',
      'Handbrake',
      'Gear',
      'EngineRpm',
      'EngineMaxRpm',
      'EngineIdleRpm',
      'TempFL_F',
      'TempFR_F',
      'TempRL_F',
      'TempRR_F',
      'SlipRatioFL',
      'SlipRatioFR',
      'SlipRatioRL',
      'SlipRatioRR',
      'SlipAngleFL',
      'SlipAngleFR',
      'SlipAngleRL',
      'SlipAngleRR',
      'SuspensionFL',
      'SuspensionFR',
      'SuspensionRL',
      'SuspensionRR',
      'RumbleFL',
      'RumbleFR',
      'RumbleRL',
      'RumbleRR'
    ].join(',');
  }
}
