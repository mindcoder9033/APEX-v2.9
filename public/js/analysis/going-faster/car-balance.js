/**
 * APEX Going Faster - Car Balance & Chassis Dynamics Analyzer
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving" Ch. 4 (Understeer & Oversteer):
 *
 * "Understeer: Front tires slide more than rear. Car pushes wide.
 *  Oversteer: Rear tires slide more than front. Tail steps out.
 *  Neutral: Both ends slip equally at the limit of the friction circle."
 */

export class CarBalanceAnalyzer {
  /**
   * Analyzes chassis balance and cornering slip characteristics across a stint or lap.
   * @param {Array<Object>} samples
   * @returns {Object} Car balance metrics & balance coaching
   */
  static analyzeBalance(samples) {
    if (!samples || samples.length === 0) {
      return {
        balanceProfile: 'NEUTRAL',
        understeerPct: 0,
        oversteerPct: 0,
        neutralPct: 100,
        stabilityScore: 100,
        lateralGPeak: 0,
        longitudinalGPeak: 0,
        coaching: 'No telemetry samples available.'
      };
    }

    let understeerCount = 0;
    let oversteerCount = 0;
    let neutralCount = 0;
    let corneringSamples = 0;
    let peakLatG = 0;
    let peakLongG = 0;

    for (const s of samples) {
      const latG = Math.abs(s.motion?.acceleration?.lateralG || s.latG || 0);
      const longG = Math.abs(s.motion?.acceleration?.longitudinalG || s.longG || 0);
      const steer = Math.abs(s.inputs?.steering || s.steer || 0);
      const yawRate = Math.abs(s.motion?.angularVelocity?.yaw || s.yawRate || 0);

      if (latG > peakLatG) peakLatG = latG;
      if (longG > peakLongG) peakLongG = longG;

      // Only evaluate during active cornering (> 0.25G lateral)
      if (latG > 0.25 && steer > 0.08) {
        corneringSamples++;

        // Calculate expected vs actual yaw rate ratio (Ackermann approximation)
        // High steer + low yaw rate = Understeer (front pushing)
        // Low steer + high yaw rate = Oversteer (rear rotating)
        const speed = s.speedMph || (s.motion?.speedMs ? s.motion.speedMs * 2.23694 : 0);
        const expectedYawRate = speed > 10 ? (latG * 32.2) / (speed * 1.467) : 0;
        const yawDelta = yawRate - expectedYawRate;

        // Tire slip angle differential if available
        let slipDiff = 0;
        if (s.tires && s.tires.slipAngle) {
          const frontSlip = (Math.abs(s.tires.slipAngle.frontLeft || 0) + Math.abs(s.tires.slipAngle.frontRight || 0)) / 2;
          const rearSlip = (Math.abs(s.tires.slipAngle.rearLeft || 0) + Math.abs(s.tires.slipAngle.rearRight || 0)) / 2;
          slipDiff = frontSlip - rearSlip; // Positive = front slipping more (understeer)
        }

        if (slipDiff > 0.05 || (steer > 0.35 && latG < 0.75 && yawDelta < -0.1)) {
          understeerCount++;
        } else if (slipDiff < -0.05 || (yawDelta > 0.15 && steer < 0.25)) {
          oversteerCount++;
        } else {
          neutralCount++;
        }
      }
    }

    const total = Math.max(1, corneringSamples);
    const understeerPct = Math.round((understeerCount / total) * 100);
    const oversteerPct = Math.round((oversteerCount / total) * 100);
    const neutralPct = Math.max(0, 100 - understeerPct - oversteerPct);

    let balanceProfile = 'BALANCED // NEUTRAL';
    let coaching = 'Chassis behavior is well-balanced across entry, apex, and exit.';
    if (understeerPct > 45) {
      balanceProfile = 'UNDERSTEER PRONE';
      coaching = 'Front-end push detected. Avoid turning the steering wheel past the grip limit; breathe off throttle slightly on entry.';
    } else if (oversteerPct > 35) {
      balanceProfile = 'OVERSTEER PRONE (LOOSE)';
      coaching = 'Rear-end instability detected on exit/entry. Smooth out throttle application and counter-steer early with CPR.';
    }

    const stabilityScore = Math.max(40, 100 - (oversteerPct * 0.8) - (understeerPct * 0.4));

    return {
      balanceProfile,
      understeerPct,
      oversteerPct,
      neutralPct,
      stabilityScore: Math.round(stabilityScore),
      lateralGPeak: Number(peakLatG.toFixed(2)),
      longitudinalGPeak: Number(peakLongG.toFixed(2)),
      coaching
    };
  }
}
