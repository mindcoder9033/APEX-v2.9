/**
 * APEX Dynamic Surface & Wet-Weather Intelligence Engine (Client-Side)
 * Implements Puddle & Hydroplaning risk estimation, single-side water drag detection,
 * Wet-line efficiency ("Rim Shot" vs "Squaring off"), and Road Camber G-multipliers.
 * Rooted in "Going Faster!" Ch. 3 (Beyond Geometry) & Ch. 12 (Racing in the Rain).
 */

export class SurfaceIntelligenceEngine {
  constructor(options = {}) {
    this.puddleDepthThresholdM = options.puddleDepthThresholdM || 0.05;
    this.hydroplaneSpeedMph = options.hydroplaneSpeedMph || 55.0;
    this.asymmetricPuddleDiffM = options.asymmetricPuddleDiffM || 0.04;
  }

  analyze(samples, corners = []) {
    if (!samples || samples.length === 0) {
      return this._getEmptyResult();
    }

    let maxPuddleDepthM = 0;
    let asymmetricDragEvents = 0;
    let hydroplaningRiskEvents = 0;
    let wetSamplesCount = 0;
    let maxRumbleIntensity = 0;
    let maxBankingAngleDeg = 0;
    let maxCrestUnweightingPct = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const speedMph = (s.speed || 0) * 2.23694;

      const pFL = s.wheelOnPuddleDepth?.frontLeft || 0;
      const pFR = s.wheelOnPuddleDepth?.frontRight || 0;
      const pRL = s.wheelOnPuddleDepth?.rearLeft || 0;
      const pRR = s.wheelOnPuddleDepth?.rearRight || 0;

      const avgPuddle = (pFL + pFR + pRL + pRR) / 4;
      const maxPuddle = Math.max(pFL, pFR, pRL, pRR);
      const leftPuddle = (pFL + pRL) / 2;
      const rightPuddle = (pFR + pRR) / 2;
      const puddleDiff = Math.abs(leftPuddle - rightPuddle);

      if (avgPuddle > maxPuddleDepthM) maxPuddleDepthM = avgPuddle;
      if (avgPuddle > 0.01 || maxPuddle > 0.02) wetSamplesCount++;

      if (puddleDiff > this.asymmetricPuddleDiffM && speedMph > 40) {
        asymmetricDragEvents++;
      }

      if ((maxPuddle > this.puddleDepthThresholdM || avgPuddle > 0.03) && speedMph > this.hydroplaneSpeedMph) {
        hydroplaningRiskEvents++;
      }

      const rFL = s.surfaceRumble?.frontLeft || 0;
      const rFR = s.surfaceRumble?.frontRight || 0;
      const maxRumble = Math.max(rFL, rFR);
      if (maxRumble > maxRumbleIntensity) maxRumbleIntensity = maxRumble;

      const rollDeg = Math.abs((s.roll || 0) * (180 / Math.PI));
      if (rollDeg > maxBankingAngleDeg) maxBankingAngleDeg = rollDeg;

      const vertG = (s.accelerationY || 9.80665) / 9.80665;
      if (vertG < 0.7 && speedMph > 50) {
        const unweighting = (1.0 - vertG) * 100;
        if (unweighting > maxCrestUnweightingPct) maxCrestUnweightingPct = unweighting;
      }
    }

    const isWetSession = wetSamplesCount > (samples.length * 0.15);
    const wetLineStrategy = isWetSession ? 'Rim-Shot on Fast Sweepers & Square-Off Tight Turns' : 'Optimal Geometric Dry Line';

    let surfaceScore = 100;
    if (isWetSession) {
      surfaceScore -= Math.min(30, asymmetricDragEvents * 4);
      surfaceScore -= Math.min(30, hydroplaningRiskEvents * 3);
    }
    surfaceScore = Math.max(0, Math.min(100, Math.round(surfaceScore)));

    return {
      surfaceScore,
      isWetSession,
      wetLineStrategy,
      maxPuddleDepthMm: Number((maxPuddleDepthM * 1000).toFixed(1)),
      asymmetricDragEvents,
      hydroplaningRiskEvents,
      maxRumbleIntensity: Number(maxRumbleIntensity.toFixed(2)),
      maxBankingAngleDeg: Number(maxBankingAngleDeg.toFixed(1)),
      maxCrestUnweightingPct: Number(maxCrestUnweightingPct.toFixed(1)),
      coachingNotes: this._generateCoachingNotes(isWetSession, asymmetricDragEvents, hydroplaningRiskEvents, maxCrestUnweightingPct)
    };
  }

  _generateCoachingNotes(isWet, asymmetricHits, hydroRisk, crestUnweight) {
    const notes = [];
    if (isWet && asymmetricHits > 0) {
      notes.push({
        category: 'Wet Weather Safety',
        severity: 'High',
        title: 'Single-Side Puddle Drag Detected',
        text: 'Hitting standing water with only one side of the car creates an asymmetric braking force that snaps the car into instant rotation. Hit unavoidable puddles square or stay on the dryer crown.',
        quote: '"Hitting deep water with only one side of the car at speed can spin it right out from under you. If there is no way around it, hit it square." — Going Faster!'
      });
    }
    if (isWet && hydroRisk > 0) {
      notes.push({
        category: 'Aquaplaning Control',
        severity: 'High',
        title: 'Hydroplaning Threshold Exceeded',
        text: 'Tires lost direct contact with asphalt due to water wedge buildup. Avoid the polished dry line where rubber and water form a sheet; seek porous unpolished pavement on the outside (Rim Shot).',
        quote: '"The average lap time around the outside rain line was 8 seconds per lap faster because the unpolished asphalt has 40% more grip in the wet." — Skip Barber'
      });
    }
    if (crestUnweight > 30) {
      notes.push({
        category: 'Track Elevation',
        severity: 'Medium',
        title: 'Crest Unweighting (Tire Download Loss)',
        text: `The car experienced ${crestUnweight.toFixed(0)}% tire download loss over a hill crest. Ensure the steering wheel is dead straight when cresting rises to prevent immediate breakaway.`,
        quote: '"If the car comes over a crest, it reduces traction to nil. You had better get the steering wheel dead straight over the crest." — Carl Lopez'
      });
    }
    return notes;
  }

  _getEmptyResult() {
    return {
      surfaceScore: 100,
      isWetSession: false,
      wetLineStrategy: 'Optimal Geometric Dry Line',
      maxPuddleDepthMm: 0,
      asymmetricDragEvents: 0,
      hydroplaningRiskEvents: 0,
      maxRumbleIntensity: 0,
      maxBankingAngleDeg: 0,
      maxCrestUnweightingPct: 0,
      coachingNotes: []
    };
  }
}
