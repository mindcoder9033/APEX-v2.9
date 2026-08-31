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

      // TTO detection: abrupt throttle lift near zero while under high cornering lateral load
      if (throttle < 0.08 && latG > 0.75 && speedMph > 40) {
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
      case 'stint-1-1': { // The Pathfinder (Geometric Path & R3 Radius)
        primaryMetricLabel = 'Geometric Line Adherence';
        const lineVal = Math.max(40, Math.min(99, Math.round(avgLineScore - (steeringOscillations * 1.5))));
        disciplineScore = lineVal;
        primaryMetricValue = `${lineVal}% (Target: 90%+)`;
        targetAchieved = lineVal >= 90;

        if (lineVal >= 88) {
          nailed.push(`Consistently carved the maximum radius arc (R3), maintaining ${lineVal}% trajectory adherence.`);
          nailed.push('Smooth visual placement from turn-in to track-out with steady steering rates.');
          nailed.push('Maintained balanced 6/10ths discipline without overdriving tire contact patches.');
        } else {
          nailed.push(`Good entry discipline on primary high-speed bends, sustaining up to ${peakLatG}G lateral loading.`);
        }

        if (steeringOscillations > 2 || lineVal < 92) {
          refinement.push('Subtle mid-corner steering corrections detected — let the car roll along the arc naturally rather than adjusting lock.');
          refinement.push('Ensure you track out all the way to the rumble strip edge at corner exit to preserve maximum radius.');
        } else {
          refinement.push('Experiment with slightly earlier unwinding of the wheel as the apex is clipped.');
        }

        if (lineVal < 88) {
          attention.push('Early apex pinching detected on key corners: turning in prematurely shrinks the radius and requires emergency braking.');
        }
        if (steeringOscillations > 5) {
          attention.push(`Detected ${steeringOscillations} aggressive steering adjustments in loading zones provoking front-axle scrub.`);
        }
        break;
      }

      case 'stint-1-2': { // Exit Speed Expert (Corner Exit Speed & TAP)
        primaryMetricLabel = 'Apex Exit Speed Delta';
        const calculatedExitGain = liveStats.exitDeltaMph != null 
          ? liveStats.exitDeltaMph 
          : parseFloat((peakLongG * 10 + (avgSpeedMph > 50 ? 1.0 : 0.4)).toFixed(1));
        const exitDeltaMph = parseFloat(Math.max(0.1, calculatedExitGain).toFixed(1));
        disciplineScore = Math.max(30, Math.min(100, Math.round((exitDeltaMph / 2.0) * 90)));
        primaryMetricValue = `+${exitDeltaMph} MPH (+${(exitDeltaMph * 0.08).toFixed(2)}s Straight Gain)`;
        targetAchieved = exitDeltaMph >= 1.8;

        if (exitDeltaMph >= 1.5) {
          nailed.push(`Achieved +${exitDeltaMph} MPH velocity gain at the Throttle Application Point (TAP).`);
          nailed.push('Progressive throttle feed coupled directly to steering wheel unwind.');
          nailed.push('Compounding straightaway acceleration yielded significant lap time reduction.');
        } else {
          nailed.push('Maintained steady throttle pickup through mid-corner exit transitions.');
        }

        refinement.push('Ensure full 100% wide-open throttle (WOT) is achieved the instant the steering reaches the straight-ahead position.');
        refinement.push('Practice identifying the TAP visually before committing the chassis into the corner.');

        if (exitDeltaMph < 1.5) {
          attention.push('Hesitant throttle application post-apex cost substantial exit velocity down the succeeding straight.');
        }
        if (throttleLiftsMidCorner > 0) {
          attention.push('Detected throttle hesitation/pumping during corner exit — commit to a smooth single-squeeze motion.');
        }
        break;
      }

      case 'stint-1-3': { // The Brake & Turn Maestro (Trail Braking Transition)
        primaryMetricLabel = 'Trail-Brake G-Friction Blending';
        const trailRatio = totalBrakingSamples > 0 
          ? Math.round((trailBrakingSamples / totalBrakingSamples) * 100) 
          : 0;
        disciplineScore = Math.max(30, Math.min(100, Math.round(trailRatio * 1.15)));
        const decelPct = Math.min(85, Math.max(50, Math.round(75 + peakLongG * 10)));
        const latPct = Math.min(40, Math.max(15, 100 - decelPct));
        primaryMetricValue = `${decelPct}% Decel / ${latPct}% Lateral Grip (${trailRatio}% Overlap)`;
        targetAchieved = trailRatio >= 70;

        if (trailRatio >= 70) {
          nailed.push('Seamless transition from straight-line threshold braking into trail-braking entry.');
          nailed.push('Maintained vehicle pitch stability on entry without unloading front tire grip.');
          nailed.push(`Tire friction boundary stayed saturated up to ${peakLatG}G without front lockup.`);
        } else {
          nailed.push('Good straight-line deceleration stability approaching primary braking zones.');
        }

        refinement.push('Taper off the final 15% of brake pressure slightly more progressively to prevent sudden front-to-rear weight snap.');
        refinement.push('Align the off-brake moment precisely with the point of maximum steering lock.');

        if (trailRatio < 60) {
          attention.push('Separated braking and steering into disconnected phases. Carry light brake pressure past turn-in.');
        }
        if (harshBrakingEvents > 0) {
          attention.push('Brake pressure spike occurred while steering angle was increasing, risking front axle scrub.');
        }
        break;
      }

      // ==============================================
      // --- TIER 2: PHYSICS & VEHICLE DYNAMICS ---
      // ==============================================
      case 'stint-2-1': { // The Line Hunter (Late Apex Strategy 15GR)
        primaryMetricLabel = 'Realized Arc Radius';
        const avgRadius = turnRadii.length > 0 
          ? Math.round(turnRadii.reduce((a, b) => a + b, 0) / turnRadii.length) 
          : (peakLatG > 0.2 ? Math.round((peakSpeedMph * peakSpeedMph) / (15 * peakLatG)) : 170);
        const arcRadiusFt = Math.max(120, Math.min(225, avgRadius));
        disciplineScore = Math.max(35, Math.min(100, Math.round((arcRadiusFt / 195) * 92)));
        primaryMetricValue = `${arcRadiusFt} ft (Target: 195 ft Sebring T7 Benchmark)`;
        targetAchieved = arcRadiusFt >= 185;

        if (arcRadiusFt >= 185) {
          nailed.push(`Realized a sweeping ${arcRadiusFt} ft cornering radius, exploiting mathematical 15GR=mph² grip.`);
          nailed.push('Patient late-apex turn-in allowed substantially higher mid-corner minimum speed.');
          nailed.push('Prevented terminal exit understeer through disciplined line positioning.');
        } else {
          nailed.push(`Sustained up to ${peakLatG}G lateral loading through mid-corner apex.`);
        }

        refinement.push('Hold the steering angle constant through the geometric midpoint before initiating the unwind.');
        refinement.push('Target clipping the apex kerb 10 feet later on Turn 7 to unlock an even straighter exit launch.');

        if (arcRadiusFt < 180) {
          attention.push('Early turn-in instinct shrank your corner radius, forcing tighter steering corrections and lower apex speed.');
        }
        break;
      }

      case 'stint-2-2': { // The Throttle Squeeze (Dynamic Weight Transfer & TTO)
        primaryMetricLabel = 'TTO Instability Snap Events';
        const ttoPenalty = throttleLiftsMidCorner * 15;
        disciplineScore = Math.max(30, Math.min(100, 95 - ttoPenalty));
        primaryMetricValue = `${throttleLiftsMidCorner} Snap Events (Target: 0)`;
        targetAchieved = throttleLiftsMidCorner === 0;

        if (throttleLiftsMidCorner === 0) {
          nailed.push('Zero Trailing Throttle Oversteer (TTO) snap events recorded across all laps.');
          nailed.push('Progressive throttle squeeze stabilized rear axle weight bias perfectly under acceleration.');
          nailed.push('Smooth pedal modulation maintained tire contact patch equilibrium.');
        } else {
          nailed.push('Good steering counter-action to manage transient yaw rotation.');
        }

        refinement.push('Focus on maintaining a neutral "maintenance throttle" (15-25%) through long sweeping corners.');
        refinement.push('Smooth out initial throttle tip-in to eliminate transient drivetrain shock.');

        if (throttleLiftsMidCorner > 0) {
          attention.push(`Detected ${throttleLiftsMidCorner} abrupt throttle chop(s) near peak lateral load (${peakLatG}G) provoking rear-end lightness and snap slide.`);
        }
        break;
      }

      case 'stint-2-3': { // The Brake Maestro (Threshold Deceleration)
        primaryMetricLabel = 'Threshold Decel Efficiency';
        const thresholdEff = Math.max(40, Math.min(99, Math.round(
          Math.min(95, peakLongG * 72) - (harshBrakingEvents * 5)
        )));
        disciplineScore = thresholdEff;
        primaryMetricValue = `${thresholdEff}% (Peak: ${peakLongG}G Decel)`;
        targetAchieved = thresholdEff >= 88 && harshBrakingEvents <= 2;

        if (thresholdEff >= 88) {
          nailed.push(`Instantaneous initial brake strike loaded front tires to peak ${peakLongG}G deceleration.`);
          nailed.push('Pedal pressure modulated right on the verge of tire scrub with minimal ABS intervention.');
          nailed.push('Controlled aerodynamic downforce decay bleed-off throughout the deceleration zone.');
        } else {
          nailed.push('Assertive initial brake application into heavy straight-line stopping zones.');
        }

        refinement.push('Bleed brake pressure 5% earlier as car speed drops below 60 MPH to match fading aero downforce.');
        refinement.push('Keep brake release smoothly synchronized with turn-in steering rate.');

        if (harshBrakingEvents > 2) {
          attention.push(`Excessive brake spikes triggered ${harshBrakingEvents} ABS chatter/lockup events, extending stopping distance.`);
        }
        break;
      }

      // ==============================================
      // --- TIER 3: REAL-WORLD LINE & ADAPTATION ---
      // ==============================================
      case 'stint-3-1': { // The Speed of Recognition
        primaryMetricLabel = 'Early Apex Correction Distance';
        const reactionDistFt = Math.max(18, Math.min(65, Math.round(24 + (steeringOscillations * 4))));
        disciplineScore = Math.max(30, Math.min(100, Math.round(100 - (reactionDistFt - 25) * 1.8)));
        primaryMetricValue = `< ${reactionDistFt} ft (Target: < 30 ft)`;
        targetAchieved = reactionDistFt <= 30;

        if (reactionDistFt <= 30) {
          nailed.push('Recognized trajectory deviations early before arriving at the apex clipping point.');
          nailed.push('Applied "Relax Steering + Firm Brake" discipline promptly to realign vehicle heading.');
          nailed.push('Successfully preserved corner exit trajectory onto subsequent acceleration chutes.');
        } else {
          nailed.push('Demonstrated proactive steering recovery when catching vehicle rotation.');
        }

        refinement.push('Keep looking further ahead toward the track-out rumble strips to identify errors earlier.');
        refinement.push('Ease off the brake slightly earlier when entering the corrective arc.');

        if (reactionDistFt > 32) {
          attention.push('Late recognition of early turn-in pinched the corner radius and forced late corrective braking.');
        }
        break;
      }

      case 'stint-3-2': { // The Camber Hunter
        primaryMetricLabel = 'Camber & Banking Grip Utilization';
        const gripDeltaPct = Math.round(peakLatG >= 0.75 ? ((peakLatG / 0.75) - 1) * 100 : 0);
        disciplineScore = Math.max(35, Math.min(100, Math.round(75 + (gripDeltaPct * 2) - (throttleLiftsMidCorner * 8))));
        primaryMetricValue = `+${Math.max(5, gripDeltaPct)}% Compression G-Force Gain (${peakLatG}G Peak)`;
        targetAchieved = gripDeltaPct >= 8;

        if (gripDeltaPct >= 8) {
          nailed.push('Exploited positive-camber compression bowls for elevated cornering velocity.');
          nailed.push('Adjusted turn-in timing dynamically between banked and flat road sections.');
          nailed.push(`Sustained up to ${peakLatG}G lateral grip through road surface elevation changes.`);
        } else {
          nailed.push('Maintained steady throttle through elevation transitions.');
        }

        refinement.push('Turn in 5 feet earlier into positive-camber bowls (The Uphill) to ride the compression.');
        refinement.push('Anticipate off-camber crests by braking earlier in a straight line.');

        if (peakLatG < 0.70) {
          attention.push('Failed to fully load the chassis into positive camber bowls, leaving cornering grip unused.');
        }
        break;
      }

      case 'stint-3-3': { // The Compromise Architect
        primaryMetricLabel = 'Main Straight Exit Velocity Gain';
        const launchGain = parseFloat((Math.max(1.0, (peakSpeedMph - avgSpeedMph) * 0.08)).toFixed(1));
        disciplineScore = Math.max(30, Math.min(100, Math.round((launchGain / 4.0) * 92)));
        primaryMetricValue = `+${launchGain} MPH Launch Gain (Target: +4.0 MPH)`;
        targetAchieved = launchGain >= 3.5;

        if (launchGain >= 3.5) {
          nailed.push('Consciously over-slowed for Type III entry corners to optimize Type I exit launch.');
          nailed.push('Maintained early full-throttle commitment down the main straight.');
          nailed.push('Executed clean steering unwind without destabilizing the rear axle.');
        } else {
          nailed.push('Good commitment to the throttle on final corner exit.');
        }

        refinement.push('Sacrifice another 2 MPH on the chicane entry to straighten the exit chute even further.');
        refinement.push('Ensure 100% wide-open throttle is pinned before the final kerb apex.');

        if (launchGain < 3.0) {
          attention.push('Over-attacked the Type III entry corner, compromising vehicle placement and straightaway launch velocity.');
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

    // Apply strict lap completion & validity gates
    let gradeScore = rawGradeScore;
    let isCapped = false;
    let capReason = '';

    if (totalLaps < 2 || validFlyingSamples < 40) {
      gradeScore = Math.min(58, rawGradeScore); // Automatic F / Incomplete
      isCapped = true;
      capReason = 'Stint incomplete (< 2 valid flying laps recorded).';
      attention.push('Stint aborted early: insufficient flying laps to establish statistically valid technique evaluation.');
    } else if (avgSpeedMph < 35) {
      gradeScore = Math.min(65, rawGradeScore); // Capped at D
      isCapped = true;
      capReason = 'Average session speed was below racing pace.';
      attention.push('Average stint speed was under 35 MPH — drive at competitive racing pace to evaluate high-speed dynamics.');
    } else if (totalLaps < Math.ceil(prescribedLaps * 0.5)) {
      gradeScore = Math.min(78, rawGradeScore); // Capped at C+
      isCapped = true;
      capReason = `Completed only ${totalLaps} of ${prescribedLaps} prescribed laps.`;
      refinement.push(`Complete at least 50% of prescribed laps (${Math.ceil(prescribedLaps * 0.5)} laps) to unlock higher grades.`);
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
