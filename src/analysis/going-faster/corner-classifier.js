/**
 * APEX Going Faster - Corner Classifier (Type I, Type II, Type III)
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving" Ch. 3 & Ch. 8:
 *
 * - Type I Corner: Leads onto a major straightaway. Exit speed is paramount.
 *   "Exit speed is everything because any speed advantage carries all the way down the straight."
 * - Type II Corner: Located at the end of a major straightaway. Entry/braking is paramount.
 *   "Carrying speed deep into the braking zone gains significant time before apex."
 * - Type III Corner: Connecting corner or complex (e.g. esses, chicanes).
 *   "Must be sacrificed to optimize entry/exit for the following Type I or Type II corner."
 */

export const CORNER_TYPE = {
  TYPE_I: 'Type I',     // Exit speed priority -> leads to straight
  TYPE_II: 'Type II',   // Entry speed / braking priority -> end of straight
  TYPE_III: 'Type III'  // Sacrifice / connecting corner
};

export const CORNER_TYPE_DESCRIPTIONS = {
  [CORNER_TYPE.TYPE_I]: {
    name: 'Type I Corner',
    priority: 'EXIT SPEED',
    rule: 'Sacrifice entry to guarantee early Throttle Application Point (TAP) and wide exit trajectory onto straight.',
    color: '#00CC66'
  },
  [CORNER_TYPE.TYPE_II]: {
    name: 'Type II Corner',
    priority: 'ENTRY & BRAKING',
    rule: 'Brake late, trail-brake deep to the apex, maximize entry speed since exit does not lead to a long straight.',
    color: '#E10600'
  },
  [CORNER_TYPE.TYPE_III]: {
    name: 'Type III Corner',
    priority: 'POSITION & SACRIFICE',
    rule: 'Sacrifice line and speed to set up the entry for the critical subsequent corner.',
    color: '#0099FF'
  }
};

export class CornerClassifier {
  /**
   * Classifies a corner based on preceding and subsequent straight lengths / speed delta.
   * @param {Object} corner
   * @param {number} corner.entrySpeedMph
   * @param {number} corner.exitSpeedMph
   * @param {number} corner.straightAfterLengthFt - Distance of full-throttle straight following this corner
   * @param {number} corner.straightBeforeLengthFt - Distance of braking straight preceding this corner
   * @returns {{ type: string, confidence: number, rationale: string, coaching: string }}
   */
  static classify(corner) {
    const straightAfter = corner.straightAfterLengthFt || 0;
    const straightBefore = corner.straightBeforeLengthFt || 0;

    // Type I: Long straight after (> 600 ft / > 180m)
    if (straightAfter >= 600) {
      return {
        type: CORNER_TYPE.TYPE_I,
        confidence: Math.min(1.0, 0.7 + (straightAfter / 2000)),
        rationale: `Followed by a ${Math.round(straightAfter)} ft straightaway. Every 1 mph higher exit speed yields compound time savings.`,
        coaching: 'Focus 100% on early Throttle Application Point (TAP), unwinding steering, and tracking out to the exit curb.'
      };
    }

    // Type II: Long straight before (> 600 ft) leading into heavy braking, with short straight after
    if (straightBefore >= 600 && straightAfter < 400) {
      return {
        type: CORNER_TYPE.TYPE_II,
        confidence: Math.min(1.0, 0.7 + (straightBefore / 2000)),
        rationale: `Followed by only ${Math.round(straightAfter)} ft before next turn. Late braking and deep apex carry more value than early exit throttle.`,
        coaching: 'Maximize threshold straight-line braking, trail brake smoothly to apex, and do not compromise entry.'
      };
    }

    // Type III: Connecting turn in a complex or chicane
    return {
      type: CORNER_TYPE.TYPE_III,
      confidence: 0.85,
      rationale: 'Connecting turn in a complex. Line positioning must be prioritized over raw apex speed.',
      coaching: 'Sacrifice exit line to place the car on the optimal wide entry for the following corner.'
    };
  }

  /**
   * Analyzes an entire lap of corners and assigns Type I, II, III designations.
   * @param {Array<Object>} corners - Array of extracted corner objects
   * @param {Array<Object>} lapSamples - Telemetry samples for the full lap
   * @returns {Array<Object>} Corners enriched with Going Faster typology
   */
  static classifyLapCorners(corners, lapSamples) {
    if (!corners || corners.length === 0) return [];

    return corners.map((corner, idx) => {
      // Estimate straight lengths before and after if not already calculated
      const straightAfter = corner.exitSpeed?.straightLengthFt || 
        (corner.dynamics?.straightLengthFt) || 
        (idx < corners.length - 1 ? 500 : 800);
      
      const straightBefore = idx > 0 
        ? (corners[idx - 1].exitSpeed?.straightLengthFt || 500) 
        : 900;

      const classification = this.classify({
        entrySpeedMph: corner.speed?.entryMph || 0,
        exitSpeedMph: corner.speed?.exitMph || 0,
        straightAfterLengthFt: straightAfter,
        straightBeforeLengthFt: straightBefore
      });

      return {
        ...corner,
        goingFasterType: classification.type,
        typeDetails: CORNER_TYPE_DESCRIPTIONS[classification.type],
        typeRationale: classification.rationale,
        coachingAdvice: classification.coaching
      };
    });
  }
}
