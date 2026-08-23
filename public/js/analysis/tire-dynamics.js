/**
 * APEX Tire Dynamics & Thermal State Management Engine (Browser Client)
 */

export const TIRE_THERMAL_STATUS = {
  COLD: 'COLD',
  OPTIMAL: 'OPTIMAL',
  OVERHEATED: 'OVERHEATED'
};

export const THERMAL_THRESHOLDS = {
  COLD_MAX: 200.0,
  OVERHEAT_MIN: 240.0
};

export class TireDynamicsEngine {
  constructor(options = {}) {
    this.coldThreshold = options.coldThreshold || THERMAL_THRESHOLDS.COLD_MAX;
    this.overheatThreshold = options.overheatThreshold || THERMAL_THRESHOLDS.OVERHEAT_MIN;
  }

  classifyThermalStatus(tempF) {
    if (!tempF || tempF < this.coldThreshold) {
      return TIRE_THERMAL_STATUS.COLD;
    }
    if (tempF > this.overheatThreshold) {
      return TIRE_THERMAL_STATUS.OVERHEATED;
    }
    return TIRE_THERMAL_STATUS.OPTIMAL;
  }

  analyzeTires(samples) {
    const corners = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
    const summary = {
      tires: {
        frontLeft: this.initTireStats(),
        frontRight: this.initTireStats(),
        rearLeft: this.initTireStats(),
        rearRight: this.initTireStats()
      },
      balance: {
        frontAvgTempF: 0,
        rearAvgTempF: 0,
        tempDeltaFrontVsRearF: 0,
        thermalBias: 'NEUTRAL',
        peakAxleSlip: { front: 0, rear: 0 }
      },
      findings: []
    };

    if (!samples || samples.length === 0) {
      return summary;
    }

    for (const s of samples) {
      const tires = s.tires || {};
      const temps = tires.tempF || {};
      const slips = tires.slipRatio || {};
      const combSlips = tires.combinedSlip || {};
      const slipAngles = tires.slipAngle || {};
      const wear = tires.wear || {};

      for (const corner of corners) {
        const stats = summary.tires[corner];
        const t = temps[corner] || 0;
        const sr = Math.abs(slips[corner] || 0);
        const cs = Math.abs(combSlips[corner] || 0);
        const sa = Math.abs(slipAngles[corner] || 0);
        const w = wear[corner] || 0;

        if (t > 0) {
          stats.tempSum += t;
          stats.tempSamples++;
          if (t > stats.peakTempF) stats.peakTempF = t;
          if (t < stats.minTempF) stats.minTempF = t;
        }

        if (sr > stats.peakSlipRatio) stats.peakSlipRatio = sr;
        if (cs > stats.peakCombinedSlip) stats.peakCombinedSlip = cs;
        if (sa > stats.peakSlipAngleRad) stats.peakSlipAngleRad = sa;
        if (w > stats.maxWear) stats.maxWear = w;
      }
    }

    let frontTempSum = 0;
    let frontTempCount = 0;
    let rearTempSum = 0;
    let rearTempCount = 0;

    for (const corner of corners) {
      const stats = summary.tires[corner];
      if (stats.tempSamples > 0) {
        stats.avgTempF = Math.round(stats.tempSum / stats.tempSamples);
        stats.peakTempF = Math.round(stats.peakTempF);
        stats.minTempF = stats.minTempF === Infinity ? 0 : Math.round(stats.minTempF);
        stats.avgTempC = Math.round((stats.avgTempF - 32) * (5 / 9));
        stats.peakTempC = Math.round((stats.peakTempF - 32) * (5 / 9));
        stats.minTempC = Math.round((stats.minTempF - 32) * (5 / 9));
      } else {
        stats.minTempF = 0;
        stats.avgTempC = 0;
        stats.peakTempC = 0;
        stats.minTempC = 0;
      }
      stats.status = this.classifyThermalStatus(stats.avgTempF);
      stats.peakSlipRatio = Number(stats.peakSlipRatio.toFixed(2));
      stats.peakCombinedSlip = Number(stats.peakCombinedSlip.toFixed(2));

      const isFront = corner.startsWith('front');
      if (isFront) {
        frontTempSum += stats.avgTempF;
        frontTempCount++;
        if (stats.peakSlipRatio > summary.balance.peakAxleSlip.front) {
          summary.balance.peakAxleSlip.front = stats.peakSlipRatio;
        }
      } else {
        rearTempSum += stats.avgTempF;
        rearTempCount++;
        if (stats.peakSlipRatio > summary.balance.peakAxleSlip.rear) {
          summary.balance.peakAxleSlip.rear = stats.peakSlipRatio;
        }
      }
    }

    const frontAvg = frontTempCount > 0 ? Math.round(frontTempSum / frontTempCount) : 0;
    const rearAvg = rearTempCount > 0 ? Math.round(rearTempSum / rearTempCount) : 0;
    const delta = frontAvg - rearAvg;

    summary.balance.frontAvgTempF = frontAvg;
    summary.balance.rearAvgTempF = rearAvg;
    summary.balance.tempDeltaFrontVsRearF = delta;
    summary.balance.frontAvgTempC = Math.round((frontAvg - 32) * (5 / 9));
    summary.balance.rearAvgTempC = Math.round((rearAvg - 32) * (5 / 9));
    summary.balance.tempDeltaFrontVsRearC = Math.round(delta * (5 / 9));

    if (delta > 15) {
      summary.balance.thermalBias = 'FRONT_LIMITED';
    } else if (delta < -15) {
      summary.balance.thermalBias = 'REAR_LIMITED';
    } else {
      summary.balance.thermalBias = 'BALANCED';
    }

    const overheatedTires = corners.filter(c => summary.tires[c].status === TIRE_THERMAL_STATUS.OVERHEATED);
    const coldTires = corners.filter(c => summary.tires[c].status === TIRE_THERMAL_STATUS.COLD);
    const overheatThresholdC = Math.round((this.overheatThreshold - 32) * (5 / 9));
    const coldThresholdC = Math.round((this.coldThreshold - 32) * (5 / 9));

    if (overheatedTires.length > 0) {
      summary.findings.push({
        id: 'TIRE-OVERHEAT',
        severity: 'High',
        title: 'Tire Overheating Detected',
        description: `${overheatedTires.map(this.formatCornerName).join(', ')} exceeded ${overheatThresholdC}°C (${this.overheatThreshold}°F) operating window. Reduce aggressive slip angle to avoid thermal degradation.`
      });
    }

    if (coldTires.length > 0 && samples.length > 300) {
      summary.findings.push({
        id: 'TIRE-COLD',
        severity: 'Medium',
        title: 'Tires Below Operating Window',
        description: `${coldTires.map(this.formatCornerName).join(', ')} running below ${coldThresholdC}°C (${this.coldThreshold}°F). Work tires harder on out-lap to achieve optimal grip threshold.`
      });
    }

    if (summary.balance.peakAxleSlip.rear > 1.0) {
      summary.findings.push({
        id: 'R-009-TIRE',
        severity: 'High',
        title: 'Excessive Rear Wheelspin',
        description: `Peak rear slip ratio reached ${summary.balance.peakAxleSlip.rear}. Unnecessary wheelspin overheats rear tires and reduces forward drive.`
      });
    }

    return summary;
  }

  initTireStats() {
    return {
      avgTempF: 0,
      minTempF: Infinity,
      peakTempF: 0,
      avgTempC: 0,
      minTempC: Infinity,
      peakTempC: 0,
      tempSum: 0,
      tempSamples: 0,
      status: TIRE_THERMAL_STATUS.COLD,
      peakSlipRatio: 0,
      peakCombinedSlip: 0,
      peakSlipAngleRad: 0,
      maxWear: 0
    };
  }

  formatCornerName(c) {
    switch (c) {
      case 'frontLeft': return 'Front Left (FL)';
      case 'frontRight': return 'Front Right (FR)';
      case 'rearLeft': return 'Rear Left (RL)';
      case 'rearRight': return 'Rear Right (RR)';
      default: return c;
    }
  }
}
