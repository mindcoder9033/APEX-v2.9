/**
 * APEX 5-Phase Track Study & Pre-Stint Preparation Engine
 * Implements the full track analysis methodology from "Going Faster! Mastering the Art of Race Driving"
 * by Carl Lopez & Skip Barber Racing School.
 * 
 * Phase 1: Macro Analysis — Priority Corner Grading (Type I / II / III) & Compound Speed Leverage
 * Phase 2: Micro Surface Reconnaissance — Camber, Elevation Compressions/Crests, Bumps & Grip
 * Phase 3: Visual Reference Points — Braking Marks, Turn-in, Apex Yaw Attitudes & Waypoints
 * Phase 4: Order of Effort — Skip Barber 3-Step Discipline (Line -> Exit Throttle -> Entry Braking)
 * Phase 5: Hardware & Stint Reality — Thermal Targets, Brake Bias, Gearing & Traffic/Accordion Prep
 */

export class TrackStudyEngine {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Generates comprehensive 5-phase study from a Track Profile or Telemetry Samples
   * @param {Object} trackProfile - Synthesized track profile or catalog track
   * @param {Array<Object>} [telemetrySamples] - Optional live or historical telemetry
   * @returns {Object} Structured 5-Phase Track Study dataset
   */
  generateStudy(trackProfile, telemetrySamples = []) {
    if (!trackProfile && (!telemetrySamples || telemetrySamples.length === 0)) {
      throw new Error('TrackStudyEngine: No trackProfile or telemetrySamples provided');
    }

    const circuitMeta = this._extractCircuitMeta(trackProfile, telemetrySamples);
    const rawCorners = this._extractCorners(trackProfile, telemetrySamples);

    const phase1_macro = this._buildPhase1Macro(circuitMeta, rawCorners);
    const phase2_surface = this._buildPhase2Surface(rawCorners, telemetrySamples);
    const phase3_reference = this._buildPhase3Reference(rawCorners, telemetrySamples);
    const phase4_orderOfEffort = this._buildPhase4OrderOfEffort(phase1_macro.corners, rawCorners, telemetrySamples);
    const phase5_hardware = this._buildPhase5Hardware(circuitMeta, rawCorners, telemetrySamples);

    return {
      circuit: circuitMeta,
      phase1_macro,
      phase2_surface,
      phase3_reference,
      phase4_orderOfEffort,
      phase5_hardware,
      generatedAt: new Date().toISOString()
    };
  }

  _extractCircuitMeta(trackProfile, samples) {
    if (trackProfile) {
      return {
        id: trackProfile.id || 'custom-circuit',
        name: trackProfile.name || trackProfile.trackName || 'Grand Prix Circuit',
        layout: trackProfile.layout || trackProfile.layoutName || 'Full Course',
        lengthMeters: trackProfile.lengthMeters || trackProfile.lapDistanceMeters || 3800,
        lengthMiles: ((trackProfile.lengthMeters || trackProfile.lapDistanceMeters || 3800) / 1609.34).toFixed(2),
        turnsCount: trackProfile.turnsCount || (trackProfile.corners ? trackProfile.corners.length : 10),
        direction: trackProfile.direction || 'Clockwise',
        country: trackProfile.country || 'International'
      };
    }

    // Fallback from samples
    const maxDist = samples.reduce((m, s) => Math.max(m, s.lapDistance || 0), 0) || 3800;
    return {
      id: 'telemetry-session',
      name: 'Active Circuit Session',
      layout: 'Grand Prix Layout',
      lengthMeters: Math.round(maxDist),
      lengthMiles: (maxDist / 1609.34).toFixed(2),
      turnsCount: 10,
      direction: 'Clockwise',
      country: 'Trackside'
    };
  }

  _extractCorners(trackProfile, samples) {
    if (trackProfile && Array.isArray(trackProfile.corners) && trackProfile.corners.length > 0) {
      return trackProfile.corners.map((c, idx) => ({
        number: c.number || idx + 1,
        name: c.name || `Turn ${c.number || idx + 1}`,
        direction: c.direction || (c.radius < 0 ? 'Left' : 'Right'),
        radius: Math.abs(c.radius || 60),
        angleDeg: Math.abs(c.angleDeg || c.arcAngle || 90),
        entrySpeedMph: Math.round((c.entrySpeedMps || c.minSpeedMps || 25) * 2.23694),
        apexSpeedMph: Math.round((c.minSpeedMps || c.apexSpeedMps || 20) * 2.23694),
        exitSpeedMph: Math.round((c.exitSpeedMps || 30) * 2.23694),
        gear: c.gear || c.targetGear || (c.minSpeedMps < 18 ? 2 : c.minSpeedMps < 32 ? 3 : 4),
        followingStraightMeters: Math.round(c.followingStraightMeters || c.straightLengthMeters || 220),
        camberDeg: c.camberDeg !== undefined ? c.camberDeg : 1.5,
        elevationChangeM: c.elevationChangeM || 0,
        brakingDistanceM: Math.round(c.brakingDistanceM || c.brakeDistM || 45)
      }));
    }

    // Default template synthesized corners if profile lacks explicit corner array
    const count = 10;
    const defaults = [];
    for (let i = 1; i <= count; i++) {
      const isHairpin = i === 10 || i === 3;
      const isSweeper = i === 1 || i === 2 || i === 9;
      const straightM = isSweeper ? 500 : isHairpin ? 350 : 180;
      defaults.push({
        number: i,
        name: `Turn ${i}`,
        direction: i % 2 === 0 ? 'Left' : 'Right',
        radius: isSweeper ? 180 : isHairpin ? 35 : 75,
        angleDeg: isHairpin ? 140 : isSweeper ? 45 : 90,
        entrySpeedMph: isSweeper ? 95 : isHairpin ? 42 : 65,
        apexSpeedMph: isSweeper ? 88 : isHairpin ? 34 : 54,
        exitSpeedMph: isSweeper ? 96 : isHairpin ? 48 : 68,
        gear: isHairpin ? 2 : isSweeper ? 4 : 3,
        followingStraightMeters: straightM,
        camberDeg: i === 7 ? -1.5 : (i === 2 ? 3.5 : 1.0),
        elevationChangeM: i === 4 ? 4.2 : (i === 6 ? -2.5 : 0),
        brakingDistanceM: isHairpin ? 85 : isSweeper ? 25 : 50
      });
    }
    return defaults;
  }

  // ---------------------------------------------------------------------------
  // PHASE 1: MACRO CORNER GRADING & PRIORITY RANKING
  // ---------------------------------------------------------------------------
  _buildPhase1Macro(circuitMeta, corners) {
    const totalStraightLength = corners.reduce((sum, c) => sum + c.followingStraightMeters, 0);
    const longestStraight = corners.reduce((max, c) => c.followingStraightMeters > max.distanceMeters ? {
      fromCorner: c.number,
      toCorner: (c.number % corners.length) + 1,
      distanceMeters: c.followingStraightMeters,
      distanceFt: Math.round(c.followingStraightMeters * 3.28084)
    } : max, { fromCorner: 1, toCorner: 2, distanceMeters: 0, distanceFt: 0 });

    const scoredCorners = corners.map((c, idx) => {
      const straightFt = c.followingStraightMeters * 3.28084;
      // Compound speed leverage: 1 mph = 1.467 ft/sec gain across straight duration
      const avgStraightSpeedMps = ((c.exitSpeedMph + 120) / 2) * 0.44704;
      const straightDurationSec = avgStraightSpeedMps > 0 ? (c.followingStraightMeters / avgStraightSpeedMps) : 4.0;
      const compoundLeverageSec = Number((straightDurationSec * 0.08).toFixed(3));

      // Classify Type I, II, III
      let type = 'Type I';
      let typeLabel = 'Lead-on Straight (Maximum Exit Priority)';
      let typeDescription = 'Directly preceeds significant full-throttle acceleration zone. Exit speed compounding dominates lap time.';
      let priorityScore = straightFt * 1.5;

      const nextCorner = corners[(idx + 1) % corners.length];
      const isShortConnectingToNext = c.followingStraightMeters < 90 && nextCorner;

      if (isShortConnectingToNext) {
        type = 'Type III';
        typeLabel = 'Compromise Corner (Sacrifice for Next Turn)';
        typeDescription = 'Connected turn with negligible straight. Must sacrifice line/entry speed to position car on optimal wide entry for next turn.';
        priorityScore = 400; // lower priority than Type I
      } else if (c.followingStraightMeters < 150 && c.radius < 60) {
        type = 'Type II';
        typeLabel = 'End of Straight (Threshold Braking Focus)';
        typeDescription = 'Sharp deceleration following high-speed run. Lap time is won on late straight-line threshold braking and trail-in.';
        priorityScore = 800 + c.brakingDistanceM * 2;
      }

      // Fast sweepers bonus priority
      if (c.apexSpeedMph > 80) {
        priorityScore += 450;
      }

      return {
        ...c,
        type,
        typeLabel,
        typeDescription,
        followingStraightFt: Math.round(straightFt),
        compoundLeverageSec,
        priorityScore: Math.round(priorityScore),
        disciplineAdvice: type === 'Type I' 
          ? 'Prioritize late apex & early throttle commitment. Do not over-slow entry.'
          : (type === 'Type III' ? 'Surrender apex radius to maximize entry track width for next corner.' : 'Maximize threshold braking; carry controlled brake-turning to throttle pickup.')
      };
    });

    // Sort by priorityScore descending to compute rank
    const sorted = [...scoredCorners].sort((a, b) => b.priorityScore - a.priorityScore);
    const rankedCorners = scoredCorners.map(c => {
      const rank = sorted.findIndex(s => s.number === c.number) + 1;
      return { ...c, priorityRank: rank };
    });

    return {
      corners: rankedCorners,
      longestStraight,
      totalStraightMeters: totalStraightLength,
      straightsCoveragePct: Math.round((totalStraightLength / circuitMeta.lengthMeters) * 100) || 72,
      strategySummary: `Prioritize Turns ${sorted.slice(0, 3).map(c => `T${c.number}`).join(', ')} as top leverage sectors. These lead into ${(longestStraight.distanceMeters)}m+ acceleration zones where +1 mph yields over ${(longestStraight.distanceFt * 0.01).toFixed(1)}s cumulative delta.`
    };
  }

  // ---------------------------------------------------------------------------
  // PHASE 2: MICRO SURFACE RECONNAISSANCE & CAMBER DYNAMICS
  // ---------------------------------------------------------------------------
  _buildPhase2Surface(corners, samples) {
    const surfaceProfiles = corners.map((c) => {
      let camberType = 'Flat / Neutral (0°)';
      let camberEffectPct = 0;
      if (c.camberDeg > 0.5) {
        camberType = `Positive Banking (+${c.camberDeg.toFixed(1)}°)`;
        camberEffectPct = Math.round(c.camberDeg * 2.8);
      } else if (c.camberDeg < -0.5) {
        camberType = `Off-Camber / Crowned (${c.camberDeg.toFixed(1)}°)`;
        camberEffectPct = Math.round(c.camberDeg * 3.5);
      }

      let elevationType = 'Level Plane';
      let gradientAdvice = 'Stable tire loading across platform.';
      if (c.elevationChangeM > 1.5) {
        elevationType = `Compression / Uphill (+${c.elevationChangeM.toFixed(1)}m)`;
        gradientAdvice = 'Vertical inertia compresses chassis, creating gobs of mechanical grip. Squeeze throttle aggressively early.';
      } else if (c.elevationChangeM < -1.5) {
        elevationType = `Crest / Unweighting (${c.elevationChangeM.toFixed(1)}m)`;
        gradientAdvice = 'Chassis unloads over crest; front grip drops to near zero. Steering must be straight before crest!';
      }

      const isConcrete = c.number % 3 === 0;
      const surfaceMaterial = isConcrete ? 'Porous Concrete (High Cold Grip)' : (c.camberDeg < 0 ? 'Polished Asphalt (Slippery Offline)' : 'Coarse Asphalt (Progressive Grip)');
      const bumpSeverity = c.number === 2 || c.number === 7 ? 'High (Mid-Corner Seams)' : (c.elevationChangeM !== 0 ? 'Moderate' : 'Smooth');
      const curbThreat = c.radius < 50 ? 'Severe Drop-Off (Avoid Clouting Inside)' : (c.apexSpeedMph > 85 ? 'Flat FIA Strip (Safe Track-Out Width)' : 'Standard Chamfered Kerb');

      return {
        number: c.number,
        name: c.name,
        camberDeg: c.camberDeg,
        camberType,
        camberEffectPct,
        elevationType,
        gradientAdvice,
        surfaceMaterial,
        bumpSeverity,
        curbThreat,
        reconNote: c.camberDeg < -0.5 
          ? `Off-camber exit will skate wide. Tighten initial entry radius to avoid dropping outside tires into raw dirt.`
          : (c.camberDeg > 2.0 ? `Banked surface allows 2-3 mph higher apex entry. Roll off brakes smoothly.` : `Consistent grip profile. Use all painted curb at track-out.`)
      };
    });

    return {
      corners: surfaceProfiles,
      overallTrackGripIndex: 0.94,
      surfaceHazardCount: surfaceProfiles.filter(s => s.camberDeg < -0.5 || s.bumpSeverity === 'High (Mid-Corner Seams)').length,
      generalGuidance: 'Walk/drive track slowly to inspect pavement joints, drainage crowns, and off-camber transitions. Remember: 1° of positive banking adds ~3% cornering grip.'
    };
  }

  // ---------------------------------------------------------------------------
  // PHASE 3: VISUAL REFERENCE POINTS & APEX ATTITUDES
  // ---------------------------------------------------------------------------
  _buildPhase3Reference(corners, samples) {
    return {
      corners: corners.map((c) => {
        const brakeDistM = c.brakingDistanceM || 45;
        const isThreshold = c.entrySpeedMph - c.apexSpeedMph > 20;
        
        return {
          number: c.number,
          name: c.name,
          brakePoint: {
            distanceBeforeTurnInM: brakeDistM,
            distanceBeforeTurnInFt: Math.round(brakeDistM * 3.28084),
            markerText: `${brakeDistM}m Board // Track Discoloration / Seam`,
            isThresholdBraking: isThreshold,
            action: isThreshold ? '100% Threshold Squeeze (Straight Line)' : 'Progressive Light Brake-Turn'
          },
          turnIn: {
            targetMph: c.entrySpeedMph,
            visualAnchor: `End of Entry Curb // Painted Verge Line`,
            technique: 'Turn steering wheel with smooth, constant pressure. Look ahead past apex.'
          },
          apex: {
            targetMph: c.apexSpeedMph,
            visualTarget: `Center of Red/White Apex Striping`,
            yawAngleTargetDeg: (c.radius < 50 ? 8 : 4),
            slipAngleTargetDeg: 5.5,
            attitudeCheck: 'Car nose pointed tight to inside curb; steering starting to unwind as rear rotates into peak slip angle.'
          },
          waypoint: {
            needed: c.angleDeg > 110 || c.radius > 120,
            landmark: c.angleDeg > 110 ? 'Intermediate Concrete Seam 50ft before apex' : 'None required (Direct line-of-sight)'
          },
          trackOut: {
            targetMph: c.exitSpeedMph,
            visualTarget: `Outer Curb Boundary // End of Exit Rumble Strip`,
            marginSafetyFt: 1.5,
            note: 'Unwind wheel completely as throttle reaches 100% floorboard.'
          }
        };
      }),
      mentalFramework: 'Establish fixed reference points first. With repetition, visual anchors transform into an internal "Sight Picture" (visual transparency) allowing instant micro-corrections.'
    };
  }

  // ---------------------------------------------------------------------------
  // PHASE 4: PLANNING THE "ORDER OF EFFORT" (Skip Barber 3-Step)
  // ---------------------------------------------------------------------------
  _buildPhase4OrderOfEffort(macroCorners, corners, samples) {
    return {
      methodology: [
        { step: 1, name: 'Master the Racing Line', rule: 'Start with a safe Late Apex. Never early-apex. Use every inch of available pavement.' },
        { step: 2, name: 'Maximize Corner Exit Speed', rule: 'Find the Throttle Application Point (TAP). Squeeze power progressively before apex and unwind steering.' },
        { step: 3, name: 'Optimize Braking & Entry', rule: 'Apply "The Procedure": Lock down maximum threshold force first, then move brake points inward in 3-5 ft increments.' }
      ],
      corners: macroCorners.map(c => {
        const isHighSpeedLoss = c.entrySpeedMph - c.apexSpeedMph > 20;
        const tapDistanceBeforeApexM = c.type === 'Type I' ? 15 : (c.type === 'Type III' ? 5 : 8);
        const trailBrakeDurationSec = isHighSpeedLoss ? (c.angleDeg > 100 ? 1.1 : 0.6) : 0.3;

        return {
          number: c.number,
          name: c.name,
          type: c.type,
          step1_lineStrategy: {
            approach: 'Late Apex Bias',
            safetyMarginFt: 2.0,
            earlyApexConsequence: 'Skates wide onto dirty verge; forces mid-corner throttle lift.'
          },
          step2_exitThrottle: {
            tapDistanceBeforeApexM,
            tapDistanceBeforeApexFt: Math.round(tapDistanceBeforeApexM * 3.28084),
            squeezeRateText: c.gear <= 2 ? 'Delicate Progressive Squeeze (Avoid wheelspin)' : 'Aggressive Linear Ramp to 100%',
            exitSpeedTargetMph: c.exitSpeedMph
          },
          step3_brakingProcedure: {
            thresholdPressureLbs: isHighSpeedLoss ? 130 : 65,
            trailBrakingSec: trailBrakeDurationSec,
            brakeStyle: c.angleDeg > 110 ? 'Constant-Level Brake-Turn' : (isHighSpeedLoss ? 'Bleed-Off Trail Braking' : 'Light Throttle Breathe'),
            incrementalRule: 'Advance brake point 3ft per lap once threshold force is proven.'
          }
        };
      })
    };
  }

  // ---------------------------------------------------------------------------
  // PHASE 5: MANAGING STINT REALITIES & HARDWARE PREP
  // ---------------------------------------------------------------------------
  _buildPhase5Hardware(circuitMeta, corners, samples) {
    const gearList = corners.map(c => ({
      turn: `T${c.number}`,
      gear: c.gear,
      minSpeedMph: c.apexSpeedMph,
      shiftNote: c.gear === 2 ? 'Heel-and-toe downshift in straight line; blip cleanly to avoid rear chirp' : 'Maintain gear; throttle modulate on exit'
    }));

    return {
      tireThermalManagement: {
        operatingWindowF: '200°F – 240°F (Slicks) // 160°F – 190°F (Street Radials)',
        coldToHotTargetPressureGainPsi: 4.5,
        paceLapWarmupTactic: 'Weave in long continuous arcs + drag brakes with left foot against engine to build core rim & carcass heat.',
        slipAngleWindow: '5.0° – 6.5° optimal (Slicks have narrow peak; avoid over-sliding which overheats rear compound).'
      },
      brakeSystemManagement: {
        baselineBias: '64% Front / 36% Rear',
        dynamicAdjustmentTactic: 'Adjust knob 1–2 clicks forward if trail-braking induces loose corner entry; move rearward as fuel burn unloads rear axle.',
        heatSoakNotice: 'Check gauges on longest straight (Turn to Turn) on upshift to top gear.'
      },
      gearingMatrix: gearList,
      trafficAndAccordionTactics: {
        gridStartPreparation: 'In multi-car train, brake 100ft earlier for Turn 1 — the accordion effect compresses spacing violently.',
        draftingPlan: 'Leave 2–3 car lengths at corner exit to build closing momentum; pull out smoothly without abrupt steering jolt.',
        seeingIndependently: 'Look past the car ahead to your own visual reference marks; never copy a competitor’s brake point.'
      }
    };
  }
}
