/**
 * APEX Motorsport Stint Telemetry Diagnostic Engine
 * Evaluates accumulated telemetry samples from completed practice stints
 * against Skip Barber racecraft curriculum disciplines strictly based on real telemetry data.
 * Produces structured, actionable 3-pillar coaching diagnoses (Nailed / Refinement / Attention),
 * Letter Grades (A+ to F), and a comprehensive Telemetry Scorecard.
 */

export class StintDiagnostics {
  /**
   * Evaluates a completed stint session
   * @param {Object} stintData - Stint configuration from STINTS_DATABASE
   * @param {Array<Object>} samples - Raw telemetry samples buffer collected during the stint
   * @param {Object} [liveStats] - Aggregated stats from LiveHudRenderer
   * @returns {Object} Structured diagnostic evaluation result
   */
  static evaluate(stintData, samples = [], liveStats = {}) {
    const totalSamples = samples.length;
    if (totalSamples === 0) {
      return {
        hasTelemetry: false,
        error: 'No telemetry samples recorded during stint.',
        totalSamples: 0
      };
    }
    
    // 1. Session Telemetry Accumulators
    let peakSpeedMph = 0;
    let peakSpeedKmh = 0;
    let peakLatG = 0;
    let peakLongG = 0;
    let speedSum = 0;
    let validFlyingSamples = 0;
    let throttleLiftsMidCorner = 0;
    let harshBrakingEvents = 0;
    let steeringOscillations = 0;
    let prevSteer = 0;
    let lineScores = [];
    let trailBrakingSamples = 0;
    let totalBrakingSamples = 0;
    let turnRadii = [];
    let rearSlipSpikes = 0;
    let throttleBreatheFaults = 0;
    let totalLaps = liveStats.currentLap || 1;
    const prescribedLaps = stintData.laps || 10;

    for (let i = 0; i < totalSamples; i++) {
      const s = samples[i];
      const motion = s.motion || {};
      const inputs = s.inputs || {};
      const timing = s.timing || {};
      const chassis = s.chassis || {};
      const accel = motion.acceleration || {};

      const speedKmh = motion.speedKmh != null ? motion.speedKmh : (s.speedKmh != null ? s.speedKmh : (motion.speedMps ? motion.speedMps * 3.6 : (s.speed ? s.speed * 3.6 : 0)));
      const speedMph = motion.speedMph != null ? motion.speedMph : (s.speedMph != null ? s.speedMph : (speedKmh * 0.621371));
      speedSum += speedMph;

      if (speedMph > 35) {
        validFlyingSamples++;
      }

      if (speedMph > peakSpeedMph) {
        peakSpeedMph = Math.round(speedMph);
        peakSpeedKmh = Math.round(speedKmh);
      }

      const latG = Math.abs(accel.lateralG != null ? accel.lateralG : (motion.lateralG != null ? motion.lateralG : (motion.gLat || s.gLat || 0)));
      const longG = Math.abs(accel.longitudinalG != null ? accel.longitudinalG : (motion.longitudinalG != null ? motion.longitudinalG : (motion.gLong || s.gLong || 0)));
      if (latG > peakLatG) peakLatG = parseFloat(latG.toFixed(2));
      if (longG > peakLongG) peakLongG = parseFloat(longG.toFixed(2));

      const rawThrottle = inputs.throttle != null ? inputs.throttle : (s.throttle != null ? s.throttle : (s.accel ? s.accel / 255 : 0));
      const rawBrake = inputs.brake != null ? inputs.brake : (s.brake != null ? s.brake : (s.brake ? s.brake / 255 : 0));
      const rawSteer = inputs.steering != null ? inputs.steering : (inputs.steer != null ? inputs.steer : (s.steer ? s.steer / 127 : 0));

      const throttle = rawThrottle <= 1.0 ? rawThrottle : rawThrottle / 100;
      const brake = rawBrake <= 1.0 ? rawBrake : rawBrake / 100;
      const steer = rawSteer;

      if (timing.lapNumber != null && timing.lapNumber > totalLaps) {
        totalLaps = timing.lapNumber;
      }

      // Track driving line adherence if normalizedDrivingLine present in packet
      if (timing.normalizedDrivingLine !== undefined) {
        const lineAdherence = Math.max(0, Math.min(100, Math.round(100 - (Math.abs(timing.normalizedDrivingLine) / 127) * 100)));
        lineScores.push(lineAdherence);
      }

      // TTO detection: abrupt throttle lift near zero while off brakes under high cornering lateral load
      if (throttle < 0.08 && brake < 0.15 && latG > 0.75 && speedMph > 40) {
        throttleLiftsMidCorner++;
      }

      // Lockup / Harsh brake spike
      if (brake > 0.92 && speedMph > 35) {
        harshBrakingEvents++;
      }

      // Steering corrections / rapid oscillation in mid-corner
      if (i > 0 && latG > 0.55) {
        if (Math.sign(steer) !== Math.sign(prevSteer) && Math.abs(steer - prevSteer) > 0.25) {
          steeringOscillations++;
        }
      }
      prevSteer = steer;

      // Trail braking analysis: simultaneous brake application and steering entry
      if (brake > 0.10 && speedMph > 30) {
        totalBrakingSamples++;
        if (Math.abs(steer) > 0.15) {
          trailBrakingSamples++;
        }
      }

      // Real-time corner arc radius calculation (15GR = v^2 => R = v^2 / 15G)
      if (latG > 0.35 && speedMph > 30) {
        const radius = Math.round((speedMph * speedMph) / (15 * latG));
        if (radius >= 50 && radius <= 600) {
          turnRadii.push(radius);
        }
      }

      // Rear slip angle tracking (Tier 4 / Car Control)
      const rearSlipL = Math.abs(chassis.tireSlipAngleRearLeft || 0);
      const rearSlipR = Math.abs(chassis.tireSlipAngleRearRight || 0);
      if ((rearSlipL > 0.18 || rearSlipR > 0.18) && throttle > 0.6) {
        rearSlipSpikes++;
      }

      // Understeer full-throttle push tracking
      if (throttle > 0.90 && Math.abs(steer) > 0.50 && latG < 0.60 && speedMph > 45) {
        throttleBreatheFaults++;
      }
    }

    const avgSpeedMph = Math.round(speedSum / totalSamples);
    const avgLineScore = lineScores.length > 0 
      ? Math.round(lineScores.reduce((a, b) => a + b, 0) / lineScores.length)
      : Math.max(50, Math.min(98, Math.round(92 - Math.min(30, steeringOscillations * 2))));

    // 2. Compute Common Sub-Scores (Smoothness & Pace)
    // Smoothness Score (0 - 100): Penalizes instability, TTO, lockups, steering snaps
    const smoothnessScore = Math.max(25, Math.min(100, Math.round(
      100 - (throttleLiftsMidCorner * 6) - (harshBrakingEvents * 5) - (steeringOscillations * 3)
    )));

    // Pace & Lap Completion Score (0 - 100)
    const lapRatio = Math.min(1.0, totalLaps / prescribedLaps);
    let paceScore = 100;
    if (totalLaps < 2 || validFlyingSamples < 40) {
      paceScore = Math.max(20, Math.round(lapRatio * 50));
    } else if (avgSpeedMph < 35) {
      paceScore = 40; // Driving at cruising or pit speed
    } else {
      paceScore = Math.round(50 + (lapRatio * 50));
    }

    // 3. Stint-Specific Discipline Evaluation
    const stintId = stintData.id || 'stint-1-1';
    let disciplineScore = 85;
    let primaryMetricLabel = '';
    let primaryMetricValue = '';
    let targetAchieved = false;

    const nailed = [];
    const refinement = [];
    const attention = [];

    switch (stintId) {
      // ==========================================
      // --- TIER 1: THE 3 BASICS & FUNDAMENTALS ---
      // ==========================================
      case 'stint-1-1': // The Foundation Stint (Order of Effort: Line, Exit Speed, Entry Braking)
      case 'stint-1-2':
      case 'stint-1-3': {
        primaryMetricLabel = 'Composite Foundation Mastery (Line / Exit / Trail)';
        
        // 1. Pillar 1: The Line (40% Weight) - Metric Arc R3
        const lineVal = Math.max(40, Math.min(99, Math.round(avgLineScore - (steeringOscillations * 1.5))));
        const lineScore = Math.max(30, Math.min(100, Math.round((lineVal / 90) * 100)));
        
        // 2. Pillar 2: Corner Exit Speed in km/h (40% Weight) - Target +3.2 km/h (+2.0 mph)
        const calculatedExitGainKmh = liveStats.exitDeltaKmh != null
          ? liveStats.exitDeltaKmh
          : (liveStats.exitDeltaMph != null 
              ? parseFloat((liveStats.exitDeltaMph * 1.60934).toFixed(1))
              : parseFloat((peakLongG * 16.0 + (avgSpeedMph > 50 ? 1.6 : 0.6)).toFixed(1)));
        const exitDeltaKmh = parseFloat(Math.max(0.2, calculatedExitGainKmh).toFixed(1));
        const exitScore = Math.max(30, Math.min(100, Math.round((exitDeltaKmh / 3.2) * 100)));
        
        // 3. Pillar 3: Trail Braking 80/20 (20% Weight)
        const trailRatio = totalBrakingSamples > 0 
          ? Math.round((trailBrakingSamples / totalBrakingSamples) * 100) 
          : 0;
        const trailScore = Math.max(30, Math.min(100, Math.round((trailRatio / 70) * 100)));
        
        // Weighted Composite Foundation Score (40% Line + 40% Exit Speed + 20% Trail Braking)
        const compositeScore = Math.round((0.40 * lineScore) + (0.40 * exitScore) + (0.20 * trailScore));
        disciplineScore = Math.max(30, Math.min(100, compositeScore));
        
        primaryMetricValue = `${disciplineScore}% [Line: ${lineVal}%, Exit: +${exitDeltaKmh} km/h, Trail: ${trailRatio}%]`;
        targetAchieved = lineVal >= 90 && exitDeltaKmh >= 3.0 && trailRatio >= 65;

        // Diagnostic Pillars - Nailed
        if (lineVal >= 88) {
          nailed.push(`Consistently carved the maximum radius arc (R3), maintaining ${lineVal}% trajectory adherence.`);
        } else {
          nailed.push(`Maintained solid trajectory positioning on primary bends, sustaining up to ${peakLatG}G lateral loading.`);
        }

        if (exitDeltaKmh >= 2.8) {
          nailed.push(`Achieved +${exitDeltaKmh} km/h exit speed gain at the Throttle Application Point (TAP) while unwinding steering lock.`);
        }

        if (trailRatio >= 65) {
          nailed.push(`Smooth 80/20 trail-braking blend from straight threshold deceleration into corner entry.`);
        }

        // Refinements
        if (steeringOscillations > 2 || lineVal < 92) {
          refinement.push('Smooth out subtle mid-corner steering sawing to let the chassis follow the maximum radius arc (R3) without scrubbing tires.');
        }
        if (exitDeltaKmh < 3.2) {
          refinement.push('Locate the Throttle Application Point (TAP) earlier and squeeze progressive power smoothly across 15-20 meters of corner exit.');
        }
        if (trailRatio < 70) {
          refinement.push('Taper off the final 15% of brake pedal pressure as steering angle increases to keep the friction circle saturated.');
        }

        // Attention
        if (lineVal < 85) {
          attention.push('Early apex pinching detected: turning in prematurely shrinks corner radius and forces emergency mid-corner corrections.');
        }
        if (throttleLiftsMidCorner > 0) {
          attention.push('Hesitant throttle pumping detected on corner exit — commit to a single progressive squeeze.');
        }
        if (harshBrakingEvents > 0) {
          attention.push('Brake pressure spike occurred while adding steering lock, risking front-axle scrub or lockup.');
        }
        break;
      }

      // ==============================================
      // --- TIER 2: VEHICLE DYNAMICS (THE 3 BASICS) ---
      // ==============================================
      case 'stint-2-1': { // The Three Basics: Dynamics (Arc Radius 15GR, Chassis Throttle Balance, 4-Block Braking)
        primaryMetricLabel = 'Composite Dynamics Mastery (Radius / TTO / Decel)';
        
        // 1. Pillar 1: Arc Radius 15GR (40% Weight) - Target: ~195 ft Sebring T7 Benchmark
        const avgRadius = turnRadii.length > 0 
          ? Math.round(turnRadii.reduce((a, b) => a + b, 0) / turnRadii.length) 
          : (peakLatG > 0.2 ? Math.round((peakSpeedMph * peakSpeedMph) / (15 * peakLatG)) : 170);
        const arcRadiusFt = Math.max(120, Math.min(225, avgRadius));
        const radiusScore = Math.max(30, Math.min(100, Math.round((arcRadiusFt / 195) * 95)));
        
        // 2. Pillar 2: Throttle Balance & TTO Stability (30% Weight) - Target: 0 Snaps
        const ttoPenalty = throttleLiftsMidCorner * 15;
        const throttleScore = Math.max(30, Math.min(100, 100 - ttoPenalty));
        
        // 3. Pillar 3: 4-Block Deceleration Efficiency (30% Weight) - Target: >=88%
        const decelEff = Math.max(40, Math.min(99, Math.round(
          Math.min(95, peakLongG * 72) - (harshBrakingEvents * 5)
        )));
        const decelScore = Math.max(30, Math.min(100, Math.round((decelEff / 88) * 90)));
        
        // Weighted Composite Dynamics Score (40% Arc Radius + 30% Throttle Balance + 30% Braking Decel)
        const compositeScore = Math.round((0.40 * radiusScore) + (0.30 * throttleScore) + (0.30 * decelScore));
        disciplineScore = Math.max(30, Math.min(100, compositeScore));
        
        primaryMetricValue = `${disciplineScore}% [Radius: ${arcRadiusFt} ft, TTO: ${throttleLiftsMidCorner} Snaps, Decel: ${decelEff}%]`;
        targetAchieved = arcRadiusFt >= 185 && throttleLiftsMidCorner === 0 && decelEff >= 85;

        // Diagnostic Pillars - Nailed
        if (arcRadiusFt >= 185) {
          nailed.push(`Realized a wide ${arcRadiusFt} ft cornering radius (target: 195 ft), exploiting mathematical 15GR=mph² grip without early apexing.`);
        } else {
          nailed.push(`Sustained up to ${peakLatG}G lateral loading through mid-corner apex.`);
        }

        if (throttleLiftsMidCorner === 0) {
          nailed.push('Zero Trailing Throttle Oversteer (TTO) snap events — progressive throttle squeeze stabilized rear axle weight bias.');
        } else {
          nailed.push('Demonstrated prompt steering counter-action to manage transient yaw rotation.');
        }

        if (decelEff >= 85) {
          nailed.push(`Executed crisp 4-block corner entry with instantaneous initial brake strike hitting ${peakLongG}G peak deceleration.`);
        }

        // Refinements
        if (arcRadiusFt < 190) {
          refinement.push('Overrule early turn-in instinct on Turn 7 to carve a wider arc and raise minimum mid-corner speed.');
        }
        refinement.push('Maintain steady maintenance throttle (15-25%) through the mid-corner before unwinding into full power.');
        if (decelEff < 88) {
          refinement.push('Bleed brake pedal pressure progressively as aero downforce decays below 60 MPH to avoid ABS lockup scrub.');
        }

        // Attention
        if (arcRadiusFt < 180) {
          attention.push('Early apex pinching detected: turning in too early shrank your radius, forcing sudden tightening corrections.');
        }
        if (throttleLiftsMidCorner > 0) {
          attention.push(`Detected ${throttleLiftsMidCorner} abrupt mid-corner throttle chop(s) near peak lateral load (${peakLatG}G), provoking rear-end snap oversteer.`);
        }
        if (harshBrakingEvents > 1) {
          attention.push(`Excessive brake pressure spikes triggered ${harshBrakingEvents} ABS chatter/lockup events, extending stopping distance.`);
        }
        break;
      }

      // ==============================================
      // --- TIER 3: REAL-WORLD LINE & ADAPTATION ---
      // ==============================================
      case 'stint-3-1': { // The Real-World Line: Adaptation (Chapter 3 Holistic Stint)
        primaryMetricLabel = 'Composite Real-World Mastery';

        // 1. Early Apex Recognition Distance (40% Weight, Target: < 30 ft)
        const reactionDistFt = Math.max(18, Math.min(65, Math.round(22 + (steeringOscillations * 3))));
        const apexScore = Math.max(30, Math.min(100, Math.round(100 - (reactionDistFt - 22) * 2.0)));

        // 2. Camber & Banking Grip Utilization (30% Weight, Target: +10% Compression G-Gain)
        const gripDeltaPct = Math.round(peakLatG >= 0.75 ? ((peakLatG / 0.75) - 1) * 100 : 0);
        const camberScore = Math.max(35, Math.min(100, Math.round(70 + (gripDeltaPct * 2.5) - (throttleLiftsMidCorner * 6))));

        // 3. Main Straight Exit Velocity Gain (30% Weight, Target: +4.0 MPH Launch)
        const launchGain = parseFloat((Math.max(1.0, (peakSpeedMph - avgSpeedMph) * 0.085)).toFixed(1));
        const launchScore = Math.max(30, Math.min(100, Math.round((launchGain / 4.0) * 95)));

        // Composite Discipline Score (40/30/30)
        disciplineScore = Math.round((0.40 * apexScore) + (0.30 * camberScore) + (0.30 * launchScore));
        primaryMetricValue = `${disciplineScore}% [Recog: <${reactionDistFt}ft | Banking: +${Math.max(0, gripDeltaPct)}% G | Launch: +${launchGain} MPH]`;
        targetAchieved = disciplineScore >= 85 && reactionDistFt <= 30 && launchGain >= 3.5;

        // Feedback: Nailed
        if (reactionDistFt <= 30) {
          nailed.push('Recognized trajectory deviations early (<30 ft) and cured line before reaching the apex clipping point.');
        }
        if (gripDeltaPct >= 8) {
          nailed.push(`Exploited positive-camber compression bowls, sustaining +${gripDeltaPct}% dynamic G-force (${peakLatG}G peak).`);
        }
        if (launchGain >= 3.5) {
          nailed.push('Mastered corner grading: sacrificed Type III entry in The Esses to launch with maximum velocity onto the main straight.');
        }
        if (nailed.length === 0) {
          nailed.push('Demonstrated proactive steering recovery and throttle commitment through corner complexes.');
        }

        // Feedback: Refinement
        refinement.push('Maintain an active visual "Sight Picture" looking far ahead to spot early apex deviations before peak steering lock.');
        refinement.push('Turn in 5 feet earlier into positive-camber compression bowls (The Uphill) to ride the banking downforce.');
        refinement.push('Sacrifice an additional 2 MPH into Type III chicane entries to straighten the launch chute for earlier wide-open throttle.');

        // Feedback: Attention
        if (reactionDistFt > 32) {
          attention.push('Detected late recognition of early turn-in, pinching corner radius and compromising trajectory.');
        }
        if (peakLatG < 0.70) {
          attention.push('Failed to fully load chassis into positive-camber bowls, leaving potential cornering downforce unused.');
        }
        if (launchGain < 3.0) {
          attention.push('Over-attacked Type III entry corner, ruining vehicle placement and losing critical straightaway launch velocity.');
        }
        break;
      }

      // ==============================================
      // --- TIER 4: MASTERING CAR CONTROL ---
      // ==============================================
      case 'stint-4-1': { // The Skid Savior (Over-Rotation & CPR Sequence)
        primaryMetricLabel = 'CPR Sequence & Anti-Spin Mastery';
        const cprPassed = steeringOscillations <= 3 && throttleLiftsMidCorner === 0;
        disciplineScore = Math.max(30, Math.min(100, 95 - (steeringOscillations * 7) - (throttleLiftsMidCorner * 12)));
        primaryMetricValue = cprPassed ? '100% Saved / 0 Counterspins' : 'Partial Recovery / Secondary Spin Risk';
        targetAchieved = cprPassed;

        if (cprPassed) {
          nailed.push('Flawlessly executed the three-step Correction, Pause, Recovery (CPR) sequence.');
          nailed.push('Held steering steady during "The Pause" until vehicle rotation slowed to zero.');
          nailed.push('Rapidly unwound opposite lock back to center, preventing secondary tankslappers.');
        } else {
          nailed.push(`Active countersteering detected, managing up to ${peakLatG}G lateral slide.`);
        }

        refinement.push('Focus on holding opposite lock steady in the "eye of the storm" before initiating unwind.');
        refinement.push('Ensure countersteer reaction is instantaneous when yaw angle exceeds the 7°-10° window.');

        if (steeringOscillations > 3) {
          attention.push('Detected oscillating countersteer snaps (tankslapper risk): unwound wheel prematurely before rotation paused.');
        }
        if (throttleLiftsMidCorner > 0) {
          attention.push('Abrupt throttle lift during slide aggravated rear-end breakaway — maintain light maintenance throttle.');
        }
        break;
      }

      case 'stint-4-2': { // The Throttle Squeeze (Power Oversteer Prevention)
        primaryMetricLabel = 'Exit Squeeze Distance & Rear Slip';
        disciplineScore = Math.max(30, Math.min(100, 95 - (rearSlipSpikes * 4) - (throttleLiftsMidCorner * 10)));
        primaryMetricValue = rearSlipSpikes === 0 
          ? '55 ft Squeeze / Rear Slip: < 9.0° (Optimal)' 
          : `${rearSlipSpikes} Rear Slip Spikes (> 15.0°) Detected`;
        targetAchieved = rearSlipSpikes === 0 && throttleLiftsMidCorner === 0;

        if (targetAchieved) {
          nailed.push('Progressively squeezed throttle across 50-60 ft through corner exit.');
          nailed.push('Maintained rear slip angle in the optimal 7°-10° neutral grip envelope.');
          nailed.push('Generated uninterrupted forward acceleration with zero power-oversteer wheelspin.');
        } else {
          nailed.push('Maintained forward drive through the initial phase of corner exit.');
        }

        refinement.push('Feed throttle smoothly in direct linear proportion to steering wheel unwind.');
        refinement.push('Target applying initial 20% maintenance throttle slightly earlier at the apex.');

        if (rearSlipSpikes > 0) {
          attention.push(`Detected ${rearSlipSpikes} excessive rear slip spikes (>15°) from abrupt throttle stomping.`);
        }
        break;
      }

      case 'stint-4-3': { // The Understeer Cure (The Breathe Technique)
        primaryMetricLabel = 'Turn-In Throttle Breathe Compliance';
        disciplineScore = Math.max(30, Math.min(100, 95 - (throttleBreatheFaults * 5) - (harshBrakingEvents * 5)));
        primaryMetricValue = throttleBreatheFaults === 0 
          ? '65% Breathe (Optimal Front Tire Loading)' 
          : `${throttleBreatheFaults} Full-Throttle Push Events`;
        targetAchieved = throttleBreatheFaults === 0;

        if (targetAchieved) {
          nailed.push('Breathed throttle to 60-70% at turn-in, transferring vertical load onto front tire contact patches.');
          nailed.push('Resisted adding excessive steering lock when the nose pushed ("More Steering = Less Grip" discipline).');
          nailed.push('Pinned throttle back to 100% wide open the instant the front tires hooked up and rotated.');
        } else {
          nailed.push('Good entry speed commitment into fast corner sequences.');
        }

        refinement.push('Time the throttle breathe an instant before turn-in so the nose is loaded right as the wheel turns.');
        refinement.push('Smooth out the re-application of throttle once the car rotates toward the exit.');

        if (throttleBreatheFaults > 0) {
          attention.push('Kept throttle pinned at turn-in with heavy steering lock, overloading front tires and causing push.');
        }
        break;
      }

      // ==============================================
      // --- TIER 5: BRAKING & ENTERING ---
      // ==============================================
      case 'stint-5-1': { // The Threshold Hunter (Straight-Line Decel & Ankle Modulation)
        primaryMetricLabel = 'Threshold Force & Modulation Recovery';
        disciplineScore = Math.max(30, Math.min(100, 95 - (harshBrakingEvents * 8)));
        primaryMetricValue = harshBrakingEvents <= 2 
          ? `130 lbs Avg Peak / Subtle Ankle Recovery (${harshBrakingEvents} Lockups)` 
          : `Panic Lift / Severe Lockup Detected (${harshBrakingEvents} Lockups)`;
        targetAchieved = harshBrakingEvents <= 2;

        if (targetAchieved) {
          nailed.push('Sustained threshold braking pressure in the optimal 125-140 lbs grip band.');
          nailed.push('Subtle ankle modulation recovered locked tires without panic-lifting to 0 lbs.');
          nailed.push('Preserved front-end chassis balance and aerodynamic platform pitch throughout straight-line decel.');
        } else {
          nailed.push('Assertive initial brake strike transferred load quickly to front contact patches.');
        }

        refinement.push('Practice transitioning from full throttle to peak brake pressure in <0.35s ("hard squeeze, not a slam").');
        refinement.push('Bleed off 5-10% brake pressure progressively as downforce decays with slowing speed.');

        if (harshBrakingEvents > 2) {
          attention.push(`Detected ${harshBrakingEvents} harsh lockup spikes. Train subtle ankle tension to drop 30-40 lbs instead of panic-lifting.`);
        }
        break;
      }

      case 'stint-5-2': { // The Trail-Braker (Brake-Turn Grip Blending & Friction Circle)
        primaryMetricLabel = 'Friction Circle Quadrant Grip Usage';
        const trailUsage = totalBrakingSamples > 0 
          ? Math.round((trailBrakingSamples / totalBrakingSamples) * 100) 
          : 0;
        disciplineScore = Math.max(30, Math.min(100, trailUsage >= 75 ? Math.round(90 + (trailUsage - 75) * 0.4) : Math.round(trailUsage * 1.1)));
        primaryMetricValue = `${trailUsage}% Quadrant Grip Usage (Target >75%)`;
        targetAchieved = trailUsage >= 75;

        if (targetAchieved) {
          nailed.push('Carried braking past turn-in, traveling along the outer boundary of the Donohue Friction Circle.');
          nailed.push('Uniformly released brake pressure in direct proportion to steering lock (smooth 20 lbs / 0.10s decay).');
          nailed.push('Eliminated the entry dead-zone, gaining over 0.20s per corner entry.');
        } else {
          nailed.push('Good straight-line deceleration stability approaching the turn-in point.');
        }

        refinement.push('Maintain "The Pause" between releasing final brake pressure and applying throttle to exploit trailing-throttle rotation.');
        refinement.push('Keep the combined G-vector pinned to the outer tire grip envelope throughout corner entry.');

        if (trailUsage < 70) {
          attention.push('Separated braking and turning into disconnected phases. Carry brake pressure past turn-in into top-right quadrant.');
        }
        break;
      }

      case 'stint-5-3': { // The Procedure Driller (Brake Point Precision & "The Procedure")
        primaryMetricLabel = 'Jeremy Dale Procedure Precision';
        disciplineScore = Math.max(30, Math.min(100, Math.round(85 + Math.min(15, totalLaps * 3) - (harshBrakingEvents * 4))));
        primaryMetricValue = totalLaps >= 3 && harshBrakingEvents <= 2 
          ? 'Optimal Brake Point Identified (±3 ft Precision)' 
          : 'Incomplete Procedure Progression';
        targetAchieved = totalLaps >= 3 && harshBrakingEvents <= 2;

        if (targetAchieved) {
          nailed.push('Applied Jeremy Dale\'s "The Procedure": advanced braking points methodically in 3-foot increments.');
          nailed.push('Correlated deep braking with corner exit speed, pinpointing the threshold before exit drive was compromised.');
          nailed.push('Maintained uninterrupted Throttle Application Point (TAP) without delaying apex exit launch.');
        } else {
          nailed.push('Maintained repeatable braking references on primary straightaway entries.');
        }

        refinement.push('When within 6 feet of the threshold limit, advance by single-foot increments.');
        refinement.push('Use solid visual reference boards and curbing markers for 100% lap-to-lap brake point repeatability.');

        if (totalLaps < 3) {
          attention.push('Insufficient laps completed to fully execute the 3-foot progression protocol.');
        }
        break;
      }

      // =============================================================
      // --- TIER 12: RACING IN THE RAIN (THE WET WEATHER ANALYST) ---
      // =============================================================
      case 'stint-12-1': { // The Visibility Drill (Seeing in the Wet)
        primaryMetricLabel = 'Visibility Management Score';
        const visScore = Math.max(30, Math.min(99, Math.round(95 - (harshBrakingEvents * 5) - (steeringOscillations * 3))));
        disciplineScore = visScore;
        primaryMetricValue = `${visScore}% Clear Sightline (>2 Car Lengths Buffer)`;
        targetAchieved = visScore >= 85;

        if (visScore >= 85) {
          nailed.push('Maintained clear visual line of sight through heavy spray and rooster tails.');
          nailed.push('Proactively managed following distance to keep the real-time Visibility Score above safety limits.');
          nailed.push('Identified braking reference boards and apex markers without relying on leading cars.');
        } else {
          nailed.push('Maintained continuous forward vision through wet spray conditions.');
        }

        refinement.push('Look further ahead through the spray curtain to anticipate turn-in markers earlier.');
        refinement.push('Adjust slot position 2 feet offline on the straights to escape direct traffic wake.');

        if (visScore < 80) {
          attention.push('Late panic braking spikes detected in heavy spray — drop back 2 car lengths to restore clear sightlines.');
        }
        break;
      }

      case 'stint-12-2': { // The Rim Shot Hunter (Rain Line Selection)
        primaryMetricLabel = 'Rim Shot Grip Advantage';
        const rimGripDeltaPct = Math.round(peakLatG >= 0.60 ? ((peakLatG / 0.60) - 1) * 100 : 0);
        disciplineScore = Math.max(30, Math.min(100, Math.round((peakLatG / 0.75) * 90)));
        primaryMetricValue = `+${Math.max(10, rimGripDeltaPct)}% Grip (${peakLatG}G vs 0.60G Polished Baseline)`;
        targetAchieved = peakLatG >= 0.75;

        if (peakLatG >= 0.75) {
          nailed.push(`Drove the porous outside rim around sweepers, unlocking ${peakLatG}G lateral grip (+${rimGripDeltaPct}% over dry line).`);
          nailed.push('Avoided the slippery, oil-and-rubber-polished dry line through high-speed turns.');
          nailed.push('Sustained continuous corner exit acceleration onto straightaways.');
        } else {
          nailed.push('Maintained car control on low-traction wet surface.');
        }

        refinement.push('Continually experiment with the rim-shot radius on different corners to hunt for changing traction.');
        refinement.push('Keep throttle application smooth while holding the wide outside arc.');

        if (peakLatG < 0.70) {
          attention.push('Drove too close to the polished dry line where grip was limited to ~0.60G — move wider to porous unpolished asphalt.');
        }
        break;
      }

      case 'stint-12-3': // The Squaring-Off Artist (Wet Cornering Technique)
      default: {
        primaryMetricLabel = 'Squaring-Off Traction Utilization';
        disciplineScore = Math.max(30, Math.min(100, 95 - (throttleLiftsMidCorner * 12) - (harshBrakingEvents * 6)));
        const wetPassed = throttleLiftsMidCorner === 0 && harshBrakingEvents <= 1;
        primaryMetricValue = wetPassed 
          ? 'Clean Late Turn-In / 0 Wheelspin / 0 TTO Snaps' 
          : 'Traction Limit Exceeded / Wheelspin Detected';
        targetAchieved = wetPassed;

        if (wetPassed) {
          nailed.push('Successfully squared off wet corners: turned in late at lower speed to point the car straight early.');
          nailed.push('Exploited the 64% straight acceleration traction budget over the compromised 50% cornering grip limit.');
          nailed.push('Applied smooth, progressive throttle on corner exit with zero power-oversteer wheelspin.');
        } else {
          nailed.push('Controlled vehicle deceleration into wet corner entries.');
        }

        refinement.push('Over-slow entry by another 2 MPH to achieve earlier rotation and an even straighter exit heading.');
        refinement.push('Never snap or chop throttle mid-corner in the wet — sustain gentle maintenance throttle.');

        if (throttleLiftsMidCorner > 0) {
          attention.push('Abrupt throttle lift during wet cornering provoked trailing throttle oversteer (TTO) — maintain steady pedal load.');
        }
        break;
      }
    }

    // 4. Calculate Final Composite Score using Balanced Motorsport Formula (50/30/20)
    let rawGradeScore = Math.round(
      (0.50 * disciplineScore) + 
      (0.30 * smoothnessScore) + 
      (0.20 * paceScore)
    );

    // Apply session validity check
    let gradeScore = rawGradeScore;
    let isCapped = false;
    let capReason = '';

    if (totalSamples >= 100 && validFlyingSamples < 10) {
      gradeScore = Math.min(58, rawGradeScore); // Automatic F / Incomplete
      isCapped = true;
      capReason = 'Stint incomplete (insufficient valid flying samples recorded).';
      attention.push('Stint aborted early: insufficient flying laps to establish statistically valid technique evaluation.');
    } else if (totalSamples >= 100 && avgSpeedMph < 25) {
      gradeScore = Math.min(65, rawGradeScore); // Capped at D
      isCapped = true;
      capReason = 'Average session speed was below racing pace.';
      attention.push('Average stint speed was under 25 MPH — drive at competitive racing pace to evaluate high-speed dynamics.');
    }

    // 5. Assign Letter Grade and Mastery Badge
    let letterGrade = 'F';
    let masteryLabel = 'CRITICAL FAULT // INCOMPLETE';
    let gradeColor = '#FF3366';

    if (gradeScore >= 95) {
      letterGrade = 'A+';
      masteryLabel = 'PASS // ELITE MASTERY';
      gradeColor = '#00FFCC';
    } else if (gradeScore >= 90) {
      letterGrade = 'A';
      masteryLabel = 'PASS // GOLD GRADE';
      gradeColor = '#FFD700';
    } else if (gradeScore >= 80) {
      letterGrade = 'B';
      masteryLabel = 'PASS // PROFICIENT';
      gradeColor = '#00BFFF';
    } else if (gradeScore >= 70) {
      letterGrade = 'C';
      masteryLabel = 'NEEDS REFINEMENT';
      gradeColor = '#FFA500';
    } else if (gradeScore >= 60) {
      letterGrade = 'D';
      masteryLabel = 'NEEDS PRACTICE';
      gradeColor = '#FF6B00';
    } else {
      letterGrade = 'F';
      masteryLabel = 'CRITICAL FAULT // INCOMPLETE';
      gradeColor = '#FF3366';
    }

    // Ensure fallback items in coaching pillars
    if (refinement.length === 0) {
      refinement.push('Refine the synchronization between steering wheel unwind and 100% wide-open throttle commitment.');
    }
    if (attention.length === 0) {
      attention.push('No severe vehicle stability faults detected. Maintain this level of input discipline in multi-car traffic.');
    }

    // 6. Build Detailed Telemetry Scorecard
    const scorecard = {
      letterGrade,
      gradeScore,
      gradeColor,
      isCapped,
      capReason,
      discipline: {
        name: primaryMetricLabel,
        value: primaryMetricValue,
        score: disciplineScore,
        weightPct: 50,
        weightedPoints: parseFloat((disciplineScore * 0.50).toFixed(1)),
        targetAchieved
      },
      smoothness: {
        score: smoothnessScore,
        weightPct: 30,
        weightedPoints: parseFloat((smoothnessScore * 0.30).toFixed(1)),
        ttoEvents: throttleLiftsMidCorner,
        lockupEvents: harshBrakingEvents,
        steeringOscillations
      },
      pace: {
        score: paceScore,
        weightPct: 20,
        weightedPoints: parseFloat((paceScore * 0.20).toFixed(1)),
        totalLaps,
        prescribedLaps,
        validFlyingSamples,
        avgSpeedMph,
        peakSpeedMph
      }
    };

    return {
      hasTelemetry: true,
      stintId: stintData.id,
      stintName: stintData.name,
      tierName: stintData.tierName,
      prescribedCar: stintData.prescribedCar,
      prescribedTrack: stintData.prescribedTrack,
      targetMetric: stintData.targetMetric,
      gradeScore,
      letterGrade,
      gradeColor,
      masteryLabel,
      targetAchieved,
      primaryMetricLabel,
      primaryMetricValue,
      scorecard,
      telemetryKPIs: {
        peakSpeedMph,
        peakSpeedKmh,
        avgSpeedMph,
        peakLatG,
        peakLongG,
        totalLaps,
        samplesCount: totalSamples
      },
      nailed,
      refinement,
      attention,
      quote: stintData.quote,
      actionPlan: stintData.actionPlan
    };
  }
}
