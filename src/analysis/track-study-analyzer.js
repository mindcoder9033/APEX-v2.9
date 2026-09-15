/**
 * APEX Track Study Analyzer (Node.js backend bundle)
 * Computes 4-Phase Circuit Study parameters based on the methodology in
 * "Going Faster! Mastering the Art of Race Driving" by Carl Lopez & Skip Barber Racing School.
 * 
 * Uses pure Motorsport Metric units: km/h, meters/km, °C, bar, and kg.
 */

export class TrackStudyAnalyzer {
  constructor() {
    this.STRAIGHT_THRESHOLD_METERS = 180; // Distance defining a significant straight
  }

  /**
   * Analyzes a track profile and its corners/turns to produce a structured 4-phase study model.
   * @param {Object} trackProfile - Track object from trackLibraryStore
   * @param {Object} [telemetryLaps] - Optional detailed lap telemetry
   * @returns {Object} Full 4-Phase Study Data
   */
  analyzeTrackStudy(trackProfile, telemetryLaps = null) {
    if (!trackProfile) return null;

    const turns = trackProfile.turns || this.generateDefaultTurns(trackProfile);
    const enrichedTurns = this.classifyAndEnrichTurns(turns, trackProfile);
    
    // Macro metrics
    const typeICount = enrichedTurns.filter(t => t.cornerType === 'Type I').length;
    const typeIICount = enrichedTurns.filter(t => t.cornerType === 'Type II').length;
    const typeIIICount = enrichedTurns.filter(t => t.cornerType === 'Type III').length;

    const totalTrackLengthM = trackProfile.trackLengthMeters || 
      (trackProfile.trackLengthKm ? Math.round(trackProfile.trackLengthKm * 1000) : 4000);
    
    // Calculate straight vs corner ratio (~70-80% acceleration/straights as per Going Faster Ch 1)
    let totalCornerLengthM = 0;
    enrichedTurns.forEach(t => {
      totalCornerLengthM += (t.geometry?.arcLengthMeters || 120);
    });
    const corneringRatio = Math.min(40, Math.max(15, Math.round((totalCornerLengthM / totalTrackLengthM) * 100))) || 26;
    const accelerationRatio = 100 - corneringRatio;

    return {
      trackId: trackProfile.trackId,
      trackName: trackProfile.trackName,
      layoutName: trackProfile.layoutName || 'Grand Prix Circuit',
      trackLengthMeters: totalTrackLengthM,
      trackLengthKm: (totalTrackLengthM / 1000).toFixed(3),
      bestLapTime: trackProfile.bestLapTime || 0,
      vectorMap: trackProfile.vectorMap || null,
      macroSummary: {
        totalCorners: enrichedTurns.length,
        typeICount,
        typeIICount,
        typeIIICount,
        accelerationPercentage: accelerationRatio,
        corneringPercentage: corneringRatio,
        keyExitCorner: enrichedTurns.find(t => t.isKeyExitCorner) || enrichedTurns[0] || null,
        heaviestBrakingCorner: enrichedTurns.find(t => t.isHeavyBraking) || enrichedTurns[0] || null
      },
      turns: enrichedTurns,
      phaseGuidelines: {
        phase1: {
          title: 'Phase 1: Macro-Analysis & Corner Grading',
          concept: 'Identify corner hierarchy. Exit speed out of Type I turns compounds for every second of straightaway acceleration.',
          focus: 'Rank corners by following straight length. Do not treat all corners equally.'
        },
        phase2: {
          title: 'Phase 2: Micro-Scouting & Surface Inspection',
          concept: 'Evaluate road camber, elevation compression, and pavement transitions. Positive camber adds up to 10% cornering grip.',
          focus: 'Watch for off-camber falloffs, crests unweighting tires, and abrasive concrete vs polished asphalt.'
        },
        phase3: {
          title: 'Phase 3: Visual Reference Points & Sight Pictures',
          concept: 'Establish rigid physical visual markers for Braking, Turn-In, Apex, and Track-Out, progressing into a holistic Sight Picture.',
          focus: 'Look far ahead to the apex before turning. Avoid tunnel vision and look where you want the car to go.'
        },
        phase4: {
          title: 'Phase 4: Telemetry Target & Progressive Ladder',
          concept: 'Build speed progressively: 1) Line precision -> 2) Exit speed & unwinding -> 3) Braking threshold nibbles in 1-meter steps.',
          focus: 'Never jump straight to late braking. Target minimum apex speed (km/h) and smooth throttle pickup first.'
        }
      }
    };
  }

  /**
   * Calculates corner radius (R in meters) through 3 coordinates (Turn-In, Apex, Track-Out)
   * Using circumcircle formula: R = (a * b * c) / (4 * Area)
   * @param {Object} p1 - Turn-In {x, z}
   * @param {Object} p2 - Apex {x, z}
   * @param {Object} p3 - Track-Out {x, z}
   * @returns {number} Radius in meters
   */
  calculateCornerRadius(p1, p2, p3) {
    if (!p1 || !p2 || !p3) return 60;
    const a = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const b = Math.hypot(p3.x - p2.x, p3.z - p2.z);
    const c = Math.hypot(p3.x - p1.x, p3.z - p1.z);
    
    // Cross product / 2 for triangle area
    const area = Math.abs((p2.x - p1.x) * (p3.z - p1.z) - (p2.z - p1.z) * (p3.x - p1.x)) / 2;
    if (area < 0.001) return 500; // Straight or near straight

    const radius = (a * b * c) / (4 * area);
    return Math.max(10, Math.min(1000, radius));
  }

  /**
   * Calculates the physics corner speed limit based on "Going Faster!" (Chapter 2 & 13)
   * Equation: 15 * G * R = V_mph^2  ==>  V_kmh = sqrt(127.14 * G_eff * R_m)
   * Camber adjustment: +camber adds download & lateral force (Ch 3, p 47)
   * @param {number} radiusMeters 
   * @param {number} baseG 
   * @param {number} camberDeg 
   * @returns {number} Speed in km/h
   */
  calculateLimitSpeedKmh(radiusMeters = 60, baseG = 1.3, camberDeg = 0) {
    const camberRad = (camberDeg * Math.PI) / 180;
    // Positive camber adds effective grip (~10% for 5 deg)
    const gEff = Math.max(0.4, baseG + Math.sin(camberRad) * 0.8);
    const speedKmh = Math.sqrt(127.14 * gEff * radiusMeters);
    return Math.round(speedKmh);
  }

  /**
   * Decomposes a corner entry and exit into the Skip Barber 4 Building Blocks
   * (Chapter 5: Braking & Entering + Chapter 8: Telemetry Analysis)
   * @param {Object} turn 
   * @param {number} approachSpeedKmh 
   * @param {number} apexSpeedKmh 
   * @returns {Object} 4-Block Breakdown
   */
  decomposeFourBlocks(turn, approachSpeedKmh, apexSpeedKmh) {
    const cornerType = turn.cornerType || 'Type I';
    const speedLossKmh = Math.max(0, approachSpeedKmh - apexSpeedKmh);
    
    // Block 1: Throttle-to-Brake Transition (Ch 5, p 73: Fast squeeze in 0.15 - 0.35s)
    const block1TimeSec = 0.25;
    const block1DistanceM = Math.round((approachSpeedKmh / 3.6) * block1TimeSec);

    // Block 2: Straight-Line Deceleration / Threshold Braking (Ch 5, p 74)
    // Rule: high speed loss puts premium on threshold braking
    const requiresHeavyBraking = speedLossKmh > 40;
    const thresholdDecelG = requiresHeavyBraking ? 1.2 : 0.8;
    const straightDecelLossKmh = speedLossKmh * (cornerType === 'Type II' ? 0.70 : (cornerType === 'Type III' ? 0.50 : 0.60));
    const block2TimeSec = straightDecelLossKmh / (thresholdDecelG * 9.81 * 3.6);
    const avgDecelSpeedMs = ((approachSpeedKmh + (approachSpeedKmh - straightDecelLossKmh)) / 2) / 3.6;
    const block2DistanceM = Math.round(avgDecelSpeedMs * Math.max(0.2, block2TimeSec));

    // Block 3: Brake-Turning / Trail-Braking (Ch 5, p 80-87: Bleed-off vs Constant-level)
    const trailDecelLossKmh = speedLossKmh - straightDecelLossKmh;
    const isConstantTrail = cornerType === 'Type III' || turn.radiusType === 'Decreasing' || turn.radiusType === 'Hairpin';
    const trailStyle = isConstantTrail ? 'Constant-Level' : 'Bleed-Off';
    const block3DistanceM = Math.max(8, Math.round(trailDecelLossKmh * 0.75));


    // Block 4: Brake-to-Throttle Transition & Yaw Pause (Ch 5, p 87-89 & Ch 4)
    const pauseDurationMs = cornerType === 'Type III' ? 250 : (cornerType === 'Type II' ? 150 : 0);
    const throttleApplicationPoint = cornerType === 'Type I' ? 'At or 5m Before Apex' : 
      (cornerType === 'Type II' ? 'Past Apex on Unwind' : 'Deep in Exit Arc');

    return {
      speedLossKmh: Math.round(speedLossKmh),
      block1: {
        name: 'Block 1: Throttle-Brake Transition',
        description: 'Instantaneous lift off throttle to initial brake pedal pressure without slamming.',
        durationSec: block1TimeSec,
        distanceMeters: block1DistanceM,
        targetPedalPressureBar: 10
      },
      block2: {
        name: 'Block 2: Straight-Line Threshold Braking',
        description: requiresHeavyBraking ? 'Maximum 100% threshold braking at limit of wheel lockup.' : 'Light-to-moderate straight deceleration.',
        durationSec: parseFloat(block2TimeSec.toFixed(2)),
        distanceMeters: block2DistanceM,
        targetBrakeEffortPct: requiresHeavyBraking ? 100 : 70,
        isThreshold: requiresHeavyBraking
      },
      block3: {
        name: 'Block 3: Brake-Turning (Trail-Braking)',
        description: `${trailStyle} modulation from Turn-In into the corner apex.`,
        trailStyle,
        distanceMeters: block3DistanceM,
        trailDepthPct: cornerType === 'Type III' ? 65 : (cornerType === 'Type II' ? 45 : 25)
      },
      block4: {
        name: 'Block 4: Brake-Throttle & Pause',
        description: pauseDurationMs > 0 ? `Brake release with ${pauseDurationMs}ms yaw pause before power delivery.` : 'Direct progressive transition to throttle at apex.',
        pauseMs: pauseDurationMs,
        throttlePoint: throttleApplicationPoint,
        exitUnwindRule: 'Unwind steering progressively as throttle increases towards 100% to eliminate tire scrub.'
      }
    };
  }

  /**
   * Classifies corners into Type I, II, or III and enriches them with Going Faster principles.
   * @param {Array<Object>} turns 
   * @param {Object} trackProfile 
   * @returns {Array<Object>}
   */
  classifyAndEnrichTurns(turns, trackProfile) {
    if (!Array.isArray(turns) || turns.length === 0) return [];

    return turns.map((turn, index) => {
      const turnNum = turn.turnNumber || (index + 1);

      // Estimate straight lengths before and after in meters
      const straightAfterM = turn.followingStraightMeters || 
        (turn.straightAfterLength || (turn.isKeyStraight ? 400 : 150));
      const straightBeforeM = turn.precedingStraightMeters || 
        (turn.straightBeforeLength || (turn.isHeavyBraking ? 350 : 120));

      let cornerType = turn.cornerTypeOverride || turn.cornerType || 'Type I';
      let typeLabel = 'Exit Speed Priority';
      let typeRationale = `Leads onto a ${Math.round(straightAfterM)}m acceleration stretch. Exit speed compounds down the entire straight.`;

      // Check if it is a compromise corner (very close to next corner, e.g. chicane or linked esse)
      const distanceToNext = turn.distanceToNextTurn || 100;
      if (!turn.cornerTypeOverride) {
        if (distanceToNext < 140 && index < turns.length - 1) {
          cornerType = 'Type III';
          typeLabel = 'Compromise Sequence';
          typeRationale = `Linked sequence into Turn ${turnNum + 1}. Compromise this line to position the car on the widest radius for the exit corner.`;
        } else if (straightBeforeM >= this.STRAIGHT_THRESHOLD_METERS && straightAfterM < this.STRAIGHT_THRESHOLD_METERS) {
          cornerType = 'Type II';
          typeLabel = 'Entry & Trail-Braking';
          typeRationale = `Follows a ${Math.round(straightBeforeM)}m high-speed straight. Maximize straight-line deceleration and carry speed with progressive trail-braking.`;
        } else if (straightAfterM >= this.STRAIGHT_THRESHOLD_METERS) {
          cornerType = 'Type I';
          typeLabel = 'Exit Speed Priority';
          typeRationale = `Crucial acceleration launch into ${Math.round(straightAfterM)}m straight. Early throttle application and smooth steering unwind are paramount.`;
        } else {
          cornerType = 'Type I';
          typeLabel = 'Technical Connector';
          typeRationale = 'Maintain smooth arc radius and minimize steering tire scrub.';
        }
      } else {
        if (cornerType === 'Type I') {
          typeLabel = 'Exit Speed Priority';
          typeRationale = `Crucial acceleration launch into ${Math.round(straightAfterM)}m straight. Early throttle application and smooth steering unwind are paramount.`;
        } else if (cornerType === 'Type II') {
          typeLabel = 'Entry & Trail-Braking';
          typeRationale = `Follows a ${Math.round(straightBeforeM)}m high-speed straight. Maximize straight-line deceleration and carry speed with progressive trail-braking.`;
        } else {
          typeLabel = 'Compromise Sequence';
          typeRationale = `Linked sequence into Turn ${turnNum + 1}. Compromise this line to position the car on the widest radius for the exit corner.`;
        }
      }

      // Radius & Geometry calculation
      const radiusMeters = turn.radiusMetersOverride || turn.radiusMeters || 65;
      const radiusType = turn.radiusType || (radiusMeters < 35 ? 'Hairpin' : (radiusMeters > 120 ? 'Sweeper' : 'Constant'));
      const camberDeg = turn.camberDeg !== undefined ? turn.camberDeg : (turn.isBanked ? 3 : (turn.isOffCamber ? -2 : 0));

      // Speeds & Telemetry Targets in pure Metric (km/h)
      let minSpeedKmh = turn.targetMinSpeedKmh || turn.minSpeedKmh;
      if (!minSpeedKmh) {
        if (turn.suggestedSpeedMph || turn.minSpeedMph) {
          minSpeedKmh = Math.round((turn.suggestedSpeedMph || turn.minSpeedMph) * 1.60934);
        } else if (turn.suggestedSpeedKmh) {
          minSpeedKmh = Math.round(turn.suggestedSpeedKmh);
        } else if (turn.apexSpeedMps) {
          minSpeedKmh = Math.round(turn.apexSpeedMps * 3.6);
        } else {
          minSpeedKmh = this.calculateLimitSpeedKmh(radiusMeters, 1.25, camberDeg);
        }
      }

      const approachSpeedKmh = turn.approachSpeedKmh || Math.round(minSpeedKmh * (straightBeforeM > 250 ? 1.65 : 1.35));
      const targetGear = turn.gear || turn.suggestedGear || (minSpeedKmh < 80 ? 2 : (minSpeedKmh < 130 ? 3 : 4));


      // Micro surface & camber cues
      const camber = turn.camber || (camberDeg > 0 ? `Positive (+${camberDeg}°)` : (camberDeg < 0 ? `Negative (${camberDeg}°)` : 'Neutral / Flat'));
      const surfaceType = turn.surfaceType || (turnNum % 3 === 0 ? 'Concrete / Asphalt Seam' : 'Standard Asphalt');
      const elevationProfile = turn.elevationProfile || (turnNum % 4 === 0 ? 'Compression Dip' : (turnNum % 5 === 0 ? 'Blind Crest' : 'Level'));
      const curbSeverity = turn.curbSeverity || (minSpeedKmh < 90 ? 'High Serrated (Avoid Hitting)' : 'Flat Paint / Low Usable');

      // 4-Block Decomposition
      const fourBlocks = this.decomposeFourBlocks({ cornerType, radiusType }, approachSpeedKmh, minSpeedKmh);

      return {
        turnIndex: index,
        turnNumber: turnNum,
        name: turn.name || `Turn ${turnNum}`,
        cornerType,
        typeLabel,
        typeRationale,
        radiusType,
        isKeyExitCorner: straightAfterM >= 300,
        isHeavyBraking: straightBeforeM >= 300 || turn.isHeavyBraking,
        followingStraightMeters: Math.round(straightAfterM),
        precedingStraightMeters: Math.round(straightBeforeM),
        geometry: {
          radiusMeters: Math.round(radiusMeters),
          radiusFeet: Math.round(radiusMeters * 3.28084),
          theoreticalMaxSpeedKmh: this.calculateLimitSpeedKmh(radiusMeters, 1.3, camberDeg),
          arcLengthMeters: turn.arcLengthMeters || Math.round(radiusMeters * 1.5),
          turnInCoords: turn.turnInCoords || null,
          apexCoords: turn.apexCoords || null,
          trackOutCoords: turn.trackOutCoords || null
        },
        fourBlocks,
        // Telemetry Targets (Metric)
        targets: {
          approachSpeedKmh,
          minApexSpeedKmh: minSpeedKmh,
          targetGear,
          suggestedBrakePressurePct: cornerType === 'Type II' || straightBeforeM > 250 ? 95 : 70,
          trailBrakeDepthPct: fourBlocks.block3.trailDepthPct,
          throttlePickUpPoint: fourBlocks.block4.throttlePoint
        },
        // Micro & Physical Inspection
        microFeatures: {
          camber,
          camberDeg,
          surfaceType,
          elevationProfile,
          curbSeverity,
          escapeRoad: turn.escapeRoad || 'Run-off Grass / Armco'
        },
        // Reference Points (Default suggestions that driver can customize)
        referenceMarkers: {
          braking: turn.referenceMarkers?.braking || `${Math.max(50, fourBlocks.block2.distanceMeters + 30)}m marker board / bridge shadow`,
          turnIn: turn.referenceMarkers?.turnIn || `Start of outside access curb / track seam`,
          apex: turn.referenceMarkers?.apex || `Center of painted inner curbing seam`,
          trackOut: turn.referenceMarkers?.trackOut || `End of flat exit curbing / paint transition`
        },
        driverNotes: turn.driverNotes || ''
      };
    });
  }

  /**
   * Generates a fallback set of representative turns if the track profile lacks explicit turn definitions.
   * @param {Object} trackProfile 
   * @returns {Array<Object>}
   */
  generateDefaultTurns(trackProfile) {
    const turnCount = trackProfile.turnCount || 10;
    const defaultTurns = [];

    for (let i = 1; i <= turnCount; i++) {
      const isHairpin = i === 1 || i === Math.floor(turnCount / 2);
      const isFastSweeper = i === 2 || i === turnCount - 1;
      const isChicane = i === 3 || i === 4;

      defaultTurns.push({
        turnNumber: i,
        name: isHairpin ? `Turn ${i} (Hairpin)` : (isFastSweeper ? `Turn ${i} (Sweeper)` : `Turn ${i}`),
        suggestedSpeedKmh: isHairpin ? 60 : (isFastSweeper ? 150 : 105),
        suggestedGear: isHairpin ? 2 : (isFastSweeper ? 4 : 3),
        radiusMeters: isHairpin ? 25 : (isFastSweeper ? 140 : 65),
        followingStraightMeters: isHairpin ? 420 : (isFastSweeper ? 180 : 120),
        precedingStraightMeters: isHairpin ? 350 : (isFastSweeper ? 200 : 100),
        distanceToNextTurn: isChicane ? 90 : 250,
        isHeavyBraking: isHairpin,
        isKeyStraight: isHairpin || i === turnCount
      });
    }

    return defaultTurns;
  }
}

export const trackStudyAnalyzer = new TrackStudyAnalyzer();
