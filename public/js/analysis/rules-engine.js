/**
 * APEX Rules Engine
 * Implements the Skip Barber "Going Faster!" Racecraft Curriculum Rules (R-001 through R-012).
 * Evaluates corner and lap metrics to generate tiered coaching feedback and actionable advice.
 */

export const RULES_SPEC = {
  'R-001': {
    id: 'R-001',
    name: 'Late Throttle Application',
    severity: 'High',
    quote: 'The biggest gain in lap time comes from corner exit speed.',
    actionPlan: 'Squeeze throttle on earlier as you unwind steering towards track-out.'
  },
  'R-002': {
    id: 'R-002',
    name: 'Premature Power Application',
    severity: 'Medium',
    quote: 'Getting to throttle too early induces understeer and pushes the car wide.',
    actionPlan: 'Modulate rolling speed with trail-braking before committing to throttle.'
  },
  'R-003': {
    id: 'R-003',
    name: 'Early Apex',
    severity: 'High',
    quote: 'The primary symptom of early apexing is the need to turn more in the 2nd part of the turn.',
    actionPlan: 'Move your turn-in point deeper and apex later to straighten out corner exit.'
  },
  'R-004': {
    id: 'R-004',
    name: 'Late Apex / Conservative Line',
    severity: 'Medium',
    quote: 'Unused track at exit indicates sacrificed entry and apex speed.',
    actionPlan: 'Turn in slightly earlier to carry a higher rolling minimum speed through apex.'
  },
  'R-005': {
    id: 'R-005',
    name: 'Abrupt Turn-In / No Trail-Brake',
    severity: 'Medium',
    quote: 'The question is not if you trail-brake, but how.',
    actionPlan: 'Carry light brake pressure past turn-in to transfer weight forward and assist rotation.'
  },
  'R-006': {
    id: 'R-006',
    name: 'Brake Snap-Off',
    severity: 'High',
    quote: 'Abrupt brake release causes Trailing Throttle Oversteer (TTO).',
    actionPlan: 'Bleed off the brake pedal progressively as steering lock increases.'
  },
  'R-007': {
    id: 'R-007',
    name: 'Gear Selected Too High',
    severity: 'Medium',
    quote: 'If the engine bogs at corner exit, gear is too high.',
    actionPlan: 'Downshift one additional gear in braking zone to optimize exit powerband.'
  },
  'R-008': {
    id: 'R-008',
    name: 'Gear Selected Too Low',
    severity: 'Medium',
    quote: 'Hitting rev limiter before corner exit kills acceleration.',
    actionPlan: 'Upshift earlier or carry a taller gear to avoid rev limiter bog.'
  },
  'R-009': {
    id: 'R-009',
    name: 'Excessive Wheelspin',
    severity: 'High',
    quote: 'Wheelspin destroys rear tires and wastes forward drive.',
    actionPlan: 'Smooth out initial throttle progression; do not mat the gas on exit.'
  },
  'R-010': {
    id: 'R-010',
    name: 'Sub-Threshold Braking',
    severity: 'Medium',
    quote: 'Practice The Procedure: Step your brake point in small bites to find the limit of deceleration.',
    actionPlan: 'Press harder initially in straight line before trailing into the turn.'
  },
  'R-011': {
    id: 'R-011',
    name: 'Throttle Inconsistency',
    severity: 'Medium',
    quote: 'Focus on consistent reference points for throttle application.',
    actionPlan: 'Align power application with steering unwinding rate.'
  },
  'R-012': {
    id: 'R-012',
    name: 'Parking the Car in Mid-Corner',
    severity: 'High',
    quote: 'Over-slowing at corner entry forces a coasting dead-zone.',
    actionPlan: 'Roll higher minimum rolling speed into the corner without over-slowing.'
  }
};

export class RulesEngine {
  /**
   * Evaluates an individual corner's telemetry features against Going Faster! rules
   * @param {Object} corner CornerData from CornerExtractor
   * @returns {Array<Object>} List of triggered rule violations / findings
   */
  evaluateCorner(corner) {
    const findings = [];
    const d = corner.dynamics;
    const inp = corner.inputs;
    const spd = corner.speed;

    // R-001: Late Throttle Application (TAP > Apex + 15ft / 4.5m)
    if (d.tapDeltaFeet > 15.0 || d.tapDeltaMeters > 4.5) {
      const exitKmhVal = spd.exitKmh != null ? spd.exitKmh : ((spd.exitMps || 0) * 3.6 || (spd.exitMph || 0) * 1.60934);
      findings.push({
        ...RULES_SPEC['R-001'],
        cornerNumber: corner.cornerNumber,
        metric: `TAP Delta: +${(d.tapDeltaMeters || d.tapDeltaFeet * 0.3048).toFixed(1)}m after apex`,
        details: `Throttle applied ${(d.tapDeltaMeters || d.tapDeltaFeet * 0.3048).toFixed(1)}m after apex. Exit speed was ${exitKmhVal.toFixed(1)} km/h.`
      });
    }

    // R-002: Premature Throttle Application (TAP < Apex - 15ft / -4.5m)
    if (d.tapDeltaFeet < -15.0 || d.tapDeltaMeters < -4.5) {
      findings.push({
        ...RULES_SPEC['R-002'],
        cornerNumber: corner.cornerNumber,
        metric: `TAP Delta: ${(d.tapDeltaMeters || d.tapDeltaFeet * 0.3048).toFixed(1)}m before apex`,
        details: `Throttle applied ${Math.abs(d.tapDeltaMeters || d.tapDeltaFeet * 0.3048).toFixed(1)}m before clipping apex.`
      });
    }

    // R-003: Early Apex (Steering angle increase > 5° post-apex)
    if (d.isEarlyApex || d.postApexSteerCorrectionDeg > 5.0) {
      findings.push({
        ...RULES_SPEC['R-003'],
        cornerNumber: corner.cornerNumber,
        metric: `Steering Correction: +${d.postApexSteerCorrectionDeg.toFixed(1)}° post-apex`,
        details: `Steering angle tightened by +${d.postApexSteerCorrectionDeg.toFixed(1)}° post-apex to prevent drifting off-track.`
      });
    }

    // R-004: Late Apex / Over-Conservative Line
    if (d.isLateApex) {
      const speedDropKmh = spd.entryKmh && spd.apexKmh ? (spd.entryKmh - spd.apexKmh) : ((spd.entryMph - spd.apexMph) * 1.60934);
      findings.push({
        ...RULES_SPEC['R-004'],
        cornerNumber: corner.cornerNumber,
        metric: `Speed Drop: ${speedDropKmh.toFixed(1)} km/h`,
        details: `Excessively late apex and premature steering unwind sacrificed mid-corner rolling speed.`
      });
    }

    // R-005: Trail-Braking Overlap (< 20%)
    if (d.trailBrakingOverlapPercent < 20 && inp.peakBrakePressure > 0.30) {
      findings.push({
        ...RULES_SPEC['R-005'],
        cornerNumber: corner.cornerNumber,
        metric: `Trail-Brake Overlap: ${d.trailBrakingOverlapPercent}%`,
        details: `Only ${d.trailBrakingOverlapPercent}% overlap between turn-in and apex.`
      });
    }

    // R-006: Brake Snap-Off (Release rate > 80%/100ms)
    if (d.maxBrakeReleaseRate > 0.80) {
      findings.push({
        ...RULES_SPEC['R-006'],
        cornerNumber: corner.cornerNumber,
        metric: `Brake Release Rate: ${(d.maxBrakeReleaseRate * 100).toFixed(0)}%/100ms`,
        details: `Sudden brake dump prior to turn-in risks unsettling rear axle.`
      });
    }

    // R-007: Gear Selected Too High (Exit RPM < 60% max RPM)
    if (inp.maxRpm > 0 && inp.exitRpm > 0 && inp.exitRpm < (0.60 * inp.maxRpm)) {
      findings.push({
        ...RULES_SPEC['R-007'],
        cornerNumber: corner.cornerNumber,
        metric: `Exit RPM: ${Math.round(inp.exitRpm)} (${Math.round((inp.exitRpm / inp.maxRpm) * 100)}% Max)`,
        details: `Engine bogged at ${Math.round(inp.exitRpm)} RPM on corner exit in Gear ${inp.gear}.`
      });
    }

    // R-008: Gear Selected Too Low (Exit RPM > 95% max RPM)
    if (inp.maxRpm > 0 && inp.exitRpm > (0.95 * inp.maxRpm)) {
      findings.push({
        ...RULES_SPEC['R-008'],
        cornerNumber: corner.cornerNumber,
        metric: `Exit RPM: ${Math.round(inp.exitRpm)} (${Math.round((inp.exitRpm / inp.maxRpm) * 100)}% Max)`,
        details: `Exit RPM touched redline at ${Math.round(inp.exitRpm)} RPM.`
      });
    }

    // R-009: Excessive Wheelspin (Tire Slip Ratio > 1.0)
    if (d.maxTireSlipRatio > 1.0) {
      findings.push({
        ...RULES_SPEC['R-009'],
        cornerNumber: corner.cornerNumber,
        metric: `Tire Slip: ${d.maxTireSlipRatio.toFixed(2)}`,
        details: `Excessive wheelspin detected on exit drive.`
      });
    }

    // R-010: Sub-Threshold Braking (peak deceleration < 0.95G during heavy braking zone)
    const speedBleedKmh = (spd.entryKmh && spd.apexKmh) ? (spd.entryKmh - spd.apexKmh) : ((spd.entryMph - spd.apexMph) * 1.60934);
    if (d.peakDecelG > 0 && d.peakDecelG < 0.95 && inp.peakBrakePressure > 0.25 && speedBleedKmh > 19.3) {
      findings.push({
        ...RULES_SPEC['R-010'],
        cornerNumber: corner.cornerNumber,
        metric: `Peak Decel: ${d.peakDecelG.toFixed(2)}G (Sub-Threshold)`,
        details: `Peak straight-line deceleration reached only ${d.peakDecelG.toFixed(2)}G despite heavy speed bleed (${speedBleedKmh.toFixed(1)} km/h). Step brake marker deeper.`
      });
    }

    // R-012: Parking Mid-Corner (Entry to Apex Delta > 16 km/h / 10 mph)
    const entryKmhVal = spd.entryKmh ?? (spd.entryMph * 1.60934);
    const apexKmhVal = spd.apexKmh ?? (spd.apexMph * 1.60934);
    const deltaEntryApexKmh = entryKmhVal - apexKmhVal;
    if (deltaEntryApexKmh > 16.0 && inp.entryBrakePressure > 0.5) {
      findings.push({
        ...RULES_SPEC['R-012'],
        cornerNumber: corner.cornerNumber,
        metric: `Speed Drop: ${deltaEntryApexKmh.toFixed(1)} km/h`,
        details: `Speed dropped from ${entryKmhVal.toFixed(1)} km/h at entry to ${apexKmhVal.toFixed(1)} km/h at apex.`
      });
    }

    return findings;
  }

  /**
   * Evaluates all corners for a complete lap
   * @param {Array<Object>} corners 
   * @returns {Array<Object>}
   */
  evaluateLap(corners) {
    const allFindings = [];
    for (const corner of corners) {
      const findings = this.evaluateCorner(corner);
      allFindings.push(...findings);
    }
    return allFindings;
  }
}
