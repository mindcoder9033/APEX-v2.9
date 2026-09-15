/**
 * APEX Track Study Analyzer (Browser-served bundle)
 * Computes 4-Phase Circuit Study parameters based on the methodology in
 * "Going Faster! Mastering the Art of Race Driving" by Carl Lopez & Skip Barber Racing School.
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
      (trackProfile.trackLengthKm ? trackProfile.trackLengthKm * 1000 : 4000);
    
    // Calculate straight vs corner ratio (~70-80% acceleration/straights as per Going Faster)
    const accelerationRatio = 74; // percentage
    const corneringRatio = 26;

    return {
      trackId: trackProfile.trackId,
      trackName: trackProfile.trackName,
      layoutName: trackProfile.layoutName || 'Grand Prix Circuit',
      trackLengthMeters: totalTrackLengthM,
      bestLapTime: trackProfile.bestLapTime || 0,
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
          concept: 'Evaluate road camber, elevation compression, and pavement transitions. Camber adds up to 10% cornering grip.',
          focus: 'Watch for off-camber falloffs, crests unweighting tires, and abrasive concrete vs polished asphalt.'
        },
        phase3: {
          title: 'Phase 3: Visual Reference Points & Sight Pictures',
          concept: 'Establish rigid physical visual markers for Braking, Turn-In, Apex, and Track-Out, progressing into a holistic Sight Picture.',
          focus: 'Look far ahead to the apex before turning. Avoid tunnel vision and look where you want the car to go.'
        },
        phase4: {
          title: 'Phase 4: Telemetry Target & Progressive Ladder',
          concept: 'Build speed progressively: 1) Line precision -> 2) Exit speed & unwinding -> 3) Braking threshold nibbles.',
          focus: 'Never jump straight to late braking. Target minimum apex speed and smooth throttle pickup first.'
        }
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

      // Estimate straight lengths before and after
      const straightAfterM = turn.followingStraightMeters || 
        (turn.straightAfterLength || (turn.isKeyStraight ? 400 : 150));
      const straightBeforeM = turn.precedingStraightMeters || 
        (turn.straightBeforeLength || (turn.isHeavyBraking ? 350 : 120));

      let cornerType = 'Type I';
      let typeLabel = 'Exit Speed Priority';
      let typeRationale = `Leads onto a ${Math.round(straightAfterM)}m acceleration stretch. Exit speed compounds down the entire straight.`;

      // Check if it is a compromise corner (very close to next corner, e.g. chicane or linked esse)
      const distanceToNext = turn.distanceToNextTurn || 100;
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

      // Speeds & Telemetry Targets
      const minSpeedMph = turn.targetMinSpeedMph || turn.minSpeedMph || 
        (turn.suggestedSpeedMph ? Math.round(turn.suggestedSpeedMph * 0.9) : 62);
      const approachSpeedMph = turn.approachSpeedMph || Math.round(minSpeedMph * 1.5);
      const targetGear = turn.gear || turn.suggestedGear || (minSpeedMph < 50 ? 2 : (minSpeedMph < 80 ? 3 : 4));

      // Micro surface & camber cues
      const camber = turn.camber || (turn.isOffCamber ? 'Negative (-2°)' : (turn.isBanked ? 'Positive (+3°)' : 'Neutral / Flat'));
      const surfaceType = turn.surfaceType || (turnNum % 3 === 0 ? 'Concrete / Asphalt Seam' : 'Standard Asphalt');
      const elevationProfile = turn.elevationProfile || (turnNum % 4 === 0 ? 'Compression Dip' : (turnNum % 5 === 0 ? 'Blind Crest' : 'Level'));
      const curbSeverity = turn.curbSeverity || (minSpeedMph < 55 ? 'High Serrated (Avoid Hitting)' : 'Flat Paint / Low Usable');

      return {
        turnIndex: index,
        turnNumber: turnNum,
        name: turn.name || `Turn ${turnNum}`,
        cornerType,
        typeLabel,
        typeRationale,
        isKeyExitCorner: straightAfterM >= 300,
        isHeavyBraking: straightBeforeM >= 300 || turn.isHeavyBraking,
        followingStraightMeters: Math.round(straightAfterM),
        precedingStraightMeters: Math.round(straightBeforeM),
        // Telemetry Targets
        targets: {
          approachSpeedMph,
          minApexSpeedMph: minSpeedMph,
          targetGear,
          suggestedBrakePressurePct: cornerType === 'Type II' || straightBeforeM > 250 ? 95 : 70,
          trailBrakeDepthPct: cornerType === 'Type III' ? 65 : (cornerType === 'Type II' ? 45 : 25),
          throttlePickUpPoint: cornerType === 'Type I' ? 'At or 10ft before Apex' : 'Past Apex during Unwind'
        },
        // Micro & Physical Inspection
        microFeatures: {
          camber,
          surfaceType,
          elevationProfile,
          curbSeverity,
          escapeRoad: turn.escapeRoad || 'Run-off Grass / Armco'
        },
        // Reference Points (Default suggestions that driver can customize)
        referenceMarkers: {
          braking: turn.referenceMarkers?.braking || `100m marker board / bridge shadow`,
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
        suggestedSpeedMph: isHairpin ? 38 : (isFastSweeper ? 92 : 65),
        suggestedGear: isHairpin ? 2 : (isFastSweeper ? 4 : 3),
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
