/**
 * APEX Going Faster - Trail-Braking Analyzer
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving" Ch. 5 (Braking & Entering):
 *
 * "Trail braking is the technique of keeping a decreasing amount of brake pressure
 *  applied while turning the car into the corner. As the steering angle increases,
 *  brake pressure must decrease to keep the tire within its traction circle."
 */

export class TrailBrakingAnalyzer {
  /**
   * Evaluates trail-braking performance through the entry and turn-in phase.
   * @param {Array<Object>} samples - Telemetry samples between Braking Point and Apex
   * @param {Object} options
   * @returns {Object} Quantitative trail-braking diagnostic
   */
  static analyzeEntry(samples, options = {}) {
    if (!samples || samples.length < 5) {
      return {
        score: 0,
        grade: 'N/A',
        overlapPercent: 0,
        releaseLinearity: 0,
        loadTransitionQuality: 'N/A',
        coaching: 'Insufficient telemetry samples in braking zone.'
      };
    }

    const brakeThreshold = options.brakeThreshold || 0.08;
    const steerThreshold = options.steerThreshold || 0.05;

    let overlapCount = 0;
    let maxBrake = 0;
    let brakeAtTurnIn = 0;
    let turnInIndex = 0;

    // Find turn-in point
    for (let i = 0; i < samples.length; i++) {
      const b = samples[i].inputs?.brake || 0;
      const s = Math.abs(samples[i].inputs?.steering || 0);
      if (b > maxBrake) maxBrake = b;
      if (s >= steerThreshold && turnInIndex === 0) {
        turnInIndex = i;
        brakeAtTurnIn = b;
      }
      if (b >= brakeThreshold && s >= steerThreshold) {
        overlapCount++;
      }
    }

    const overlapPercent = Math.round((overlapCount / samples.length) * 100);

    // Calculate brake release slope from turn-in to apex
    const entryToApexSamples = samples.slice(turnInIndex);
    let releaseSmoothness = 1.0;
    if (entryToApexSamples.length > 3) {
      let spikes = 0;
      for (let i = 1; i < entryToApexSamples.length; i++) {
        const prevB = entryToApexSamples[i - 1].inputs?.brake || 0;
        const currB = entryToApexSamples[i].inputs?.brake || 0;
        // Brake pressure should smoothly decay, not spike or step erratically
        if (currB > prevB + 0.15) spikes++;
      }
      releaseSmoothness = Math.max(0, 1 - (spikes / entryToApexSamples.length));
    }

    // G-G radius compliance during turn-in
    let tractionViolations = 0;
    for (const s of entryToApexSamples) {
      const latG = Math.abs(s.motion?.acceleration?.lateralG || s.latG || 0);
      const longG = Math.abs(s.motion?.acceleration?.longitudinalG || s.longG || 0);
      const totalG = Math.sqrt(latG * latG + longG * longG);
      // Sudden drop in combined G means tire capacity was left unused
      if (totalG < 0.4 && maxBrake > 0.5) tractionViolations++;
    }
    const frictionUtilization = Math.max(0, 1 - (tractionViolations / Math.max(1, entryToApexSamples.length)));

    // Composite Trail Braking Score (0-100)
    const compositeScore = Math.min(100, Math.round(
      (Math.min(1.0, overlapPercent / 35) * 40) +
      (releaseSmoothness * 35) +
      (frictionUtilization * 25)
    ));

    let grade = 'POOR';
    let coaching = 'Releasing brakes too abruptly before turning in. Steer and brake smoothly together.';
    if (compositeScore >= 85) {
      grade = 'OPTIMAL (PRO)';
      coaching = 'Textbook Skip Barber trail braking. Smooth progressive release as lateral load builds.';
    } else if (compositeScore >= 70) {
      grade = 'GOOD';
      coaching = 'Good trail-braking overlap. Aim for a slightly smoother release rate as you approach the apex.';
    } else if (compositeScore >= 50) {
      grade = 'FAIR';
      coaching = 'Brake release is disjointed from steering input. Blend steering angle inversely to brake pressure.';
    }

    return {
      score: compositeScore,
      grade,
      overlapPercent,
      releaseLinearity: Math.round(releaseSmoothness * 100),
      brakeAtTurnIn: Number(brakeAtTurnIn.toFixed(2)),
      peakBrake: Number(maxBrake.toFixed(2)),
      coaching
    };
  }
}
