/**
 * APEX Weather Simulator
 * Computes all 18 weather condition profiles from a single dry-baseline track profile.
 * Physics algorithms sourced from track-weather.md specification.
 */

// ---------------------------------------------------------------------------
// Weather Condition Catalog — 18 conditions across 4 categories
// ---------------------------------------------------------------------------

export const WEATHER_CONDITIONS = [
  // DRY
  { slug: 'clear',         name: 'Clear',          category: 'Dry',          gripLoss: 0.00, brakingIncrease: 0.00, speedFactor: 1.00, visibility: 1.00, hydroRisk: false, puddleDepth: 0 },
  { slug: 'mostly-clear',  name: 'Mostly Clear',   category: 'Dry',          gripLoss: 0.02, brakingIncrease: 0.01, speedFactor: 0.99, visibility: 0.98, hydroRisk: false, puddleDepth: 0 },
  { slug: 'partly-cloudy', name: 'Partly Cloudy',  category: 'Dry',          gripLoss: 0.04, brakingIncrease: 0.02, speedFactor: 0.98, visibility: 0.96, hydroRisk: false, puddleDepth: 0 },
  { slug: 'cloudy',        name: 'Cloudy',         category: 'Dry',          gripLoss: 0.06, brakingIncrease: 0.03, speedFactor: 0.97, visibility: 0.92, hydroRisk: false, puddleDepth: 0 },
  { slug: 'overcast-dry',  name: 'Overcast (Dry)', category: 'Dry',          gripLoss: 0.08, brakingIncrease: 0.04, speedFactor: 0.96, visibility: 0.88, hydroRisk: false, puddleDepth: 0 },
  // TRANSITIONAL
  { slug: 'looming-clouds',  name: 'Looming Clouds',  category: 'Transitional', gripLoss: 0.12, brakingIncrease: 0.08, speedFactor: 0.93, visibility: 0.82, hydroRisk: false, puddleDepth: 0 },
  { slug: 'thunder-clouds',  name: 'Thunder Clouds',  category: 'Transitional', gripLoss: 0.18, brakingIncrease: 0.12, speedFactor: 0.89, visibility: 0.74, hydroRisk: false, puddleDepth: 0 },
  { slug: 'thin-haze',       name: 'Thin Haze',       category: 'Transitional', gripLoss: 0.10, brakingIncrease: 0.06, speedFactor: 0.94, visibility: 0.70, hydroRisk: false, puddleDepth: 0 },
  { slug: 'patchy-fog',      name: 'Patchy Fog',      category: 'Transitional', gripLoss: 0.14, brakingIncrease: 0.10, speedFactor: 0.91, visibility: 0.55, hydroRisk: false, puddleDepth: 0 },
  { slug: 'dense-fog',       name: 'Dense Fog',       category: 'Transitional', gripLoss: 0.20, brakingIncrease: 0.15, speedFactor: 0.87, visibility: 0.30, hydroRisk: false, puddleDepth: 0 },
  // WET
  { slug: 'drizzle',       name: 'Drizzle',        category: 'Wet',          gripLoss: 0.25, brakingIncrease: 0.20, speedFactor: 0.82, visibility: 0.80, hydroRisk: false, puddleDepth: 1 },
  { slug: 'light-rain',    name: 'Light Rain',     category: 'Wet',          gripLoss: 0.35, brakingIncrease: 0.28, speedFactor: 0.76, visibility: 0.70, hydroRisk: true,  puddleDepth: 2 },
  { slug: 'moderate-rain', name: 'Moderate Rain',  category: 'Wet',          gripLoss: 0.48, brakingIncrease: 0.38, speedFactor: 0.68, visibility: 0.58, hydroRisk: true,  puddleDepth: 3 },
  { slug: 'heavy-rain',    name: 'Heavy Rain',     category: 'Wet',          gripLoss: 0.62, brakingIncrease: 0.48, speedFactor: 0.58, visibility: 0.40, hydroRisk: true,  puddleDepth: 5 },
  { slug: 'rainstorm',     name: 'Rainstorm',      category: 'Wet',          gripLoss: 0.73, brakingIncrease: 0.58, speedFactor: 0.50, visibility: 0.28, hydroRisk: true,  puddleDepth: 7 },
  { slug: 'thunderstorm',  name: 'Thunderstorm',   category: 'Wet',          gripLoss: 0.83, brakingIncrease: 0.68, speedFactor: 0.42, visibility: 0.18, hydroRisk: true,  puddleDepth: 9 },
  { slug: 'overcast-wet',  name: 'Overcast (Wet)', category: 'Wet',          gripLoss: 0.40, brakingIncrease: 0.32, speedFactor: 0.72, visibility: 0.60, hydroRisk: true,  puddleDepth: 2 },
  // DYNAMIC
  { slug: 'rain-at-start', name: 'Rain at Start',  category: 'Dynamic',      gripLoss: 0.60, brakingIncrease: 0.45, speedFactor: 0.62, visibility: 0.50, hydroRisk: true,  puddleDepth: 4, dynamic: true, dynamicMode: 'start' },
  { slug: 'rain-at-end',   name: 'Rain at End',    category: 'Dynamic',      gripLoss: 0.60, brakingIncrease: 0.45, speedFactor: 0.62, visibility: 0.50, hydroRisk: true,  puddleDepth: 4, dynamic: true, dynamicMode: 'end' },
];

// Category display config (for UI rendering)
export const WEATHER_CATEGORIES = ['Dry', 'Transitional', 'Wet', 'Dynamic'];

// ---------------------------------------------------------------------------
// WeatherSimulator
// ---------------------------------------------------------------------------

export class WeatherSimulator {
  /**
   * Simulates a single weather condition's effect on a dry track profile.
   * @param {Object} trackProfile  Stored track profile from TrackLibrarySynthesizer
   * @param {string} conditionSlug One of the slugs from WEATHER_CONDITIONS
   * @returns {Object} WeatherProfile — complete condition-specific briefing data
   */
  simulate(trackProfile, conditionSlug) {
    const condition = WEATHER_CONDITIONS.find(c => c.slug === conditionSlug);
    if (!condition) throw new Error(`Unknown weather condition slug: ${conditionSlug}`);
    if (!trackProfile || !trackProfile.corners) throw new Error('Invalid track profile: missing corners');

    const corners = this._simulateCorners(trackProfile.corners, condition);
    const hydroplaningCorners = condition.hydroRisk
      ? corners.filter(c => c.hydroplaningRisk > 0.6).map(c => c.turnNumber)
      : [];

    return {
      conditionSlug: condition.slug,
      conditionName: condition.name,
      category: condition.category,
      // Global condition stats
      gripFactor: parseFloat((1 - condition.gripLoss).toFixed(3)),
      gripLossPct: Math.round(condition.gripLoss * 100),
      brakingIncreasePct: Math.round(condition.brakingIncrease * 100),
      speedReductionPct: Math.round((1 - condition.speedFactor) * 100),
      visibilityPct: Math.round(condition.visibility * 100),
      hydroRisk: condition.hydroRisk,
      hydroplaningCorners,
      // Per-corner weather-adjusted data
      corners,
      // Strategy guidance
      strategy: this._buildStrategy(condition, hydroplaningCorners),
      checklist: this._buildChecklist(condition),
      // Confidence tier (starts at 1 stint)
      confidencePct: 75,
      confidenceTier: 'initial',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Simulates all 18 conditions for a track profile at once.
   * @param {Object} trackProfile
   * @returns {Object} Map of slug → WeatherProfile
   */
  simulateAll(trackProfile) {
    const profiles = {};
    for (const condition of WEATHER_CONDITIONS) {
      try {
        profiles[condition.slug] = this.simulate(trackProfile, condition.slug);
      } catch (err) {
        console.warn(`[WEATHER SIM] Failed to simulate ${condition.slug}:`, err.message);
      }
    }
    return profiles;
  }

  /**
   * Recalculates confidence level based on stint count for a track.
   * @param {number} stintsCount 
   * @returns {{ confidencePct: number, confidenceTier: string }}
   */
  static getConfidence(stintsCount) {
    if (stintsCount >= 5) return { confidencePct: 97, confidenceTier: 'validated' };
    if (stintsCount >= 3) return { confidencePct: 90, confidenceTier: 'high' };
    if (stintsCount >= 2) return { confidencePct: 82, confidenceTier: 'improving' };
    return { confidencePct: 75, confidenceTier: 'initial' };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Applies weather physics to each corner's dry baseline values.
   * For Dynamic conditions, interpolates grip across corner position in lap.
   */
  _simulateCorners(dryCorners, condition) {
    const total = dryCorners.length;

    return dryCorners.map((corner, idx) => {
      // Dynamic conditions: linear interpolation over corner position
      let effectiveLoss = condition.gripLoss;
      let effectiveBraking = condition.brakingIncrease;
      let effectiveSpeed = condition.speedFactor;

      if (condition.dynamic) {
        const ratio = idx / Math.max(1, total - 1); // 0.0 → 1.0 across lap
        if (condition.dynamicMode === 'start') {
          // Wet at start, drying toward end
          const t = 1 - ratio;
          effectiveLoss = condition.gripLoss * t;
          effectiveBraking = condition.brakingIncrease * t;
          effectiveSpeed = 1 - (1 - condition.speedFactor) * t;
        } else {
          // Dry at start, wetting toward end
          effectiveLoss = condition.gripLoss * ratio;
          effectiveBraking = condition.brakingIncrease * ratio;
          effectiveSpeed = 1 - (1 - condition.speedFactor) * ratio;
        }
      }

      // Spec formulas:
      // Wet Grip = Dry Grip × (1 - Grip Loss Factor)
      // Brake Point = Baseline × (1 + Braking Increase)
      // Wet Speed = √(Dry Speed² × Grip Factor)
      const dryApexKmh = corner.apexSpeedKmh || 0;
      const dryEntryKmh = corner.entrySpeedKmh || 0;
      const dryBrakeM = corner.brakingMarkerMeters || 75;

      const gripFactor = 1 - effectiveLoss;
      const wetApexKmh = Math.round(Math.sqrt(Math.max(0, dryApexKmh * dryApexKmh * gripFactor)));
      const wetEntryKmh = Math.round(Math.sqrt(Math.max(0, dryEntryKmh * dryEntryKmh * gripFactor)));
      const wetBrakeM = Math.round(dryBrakeM * (1 + effectiveBraking));

      // Hydroplaning Risk = (Puddle Depth × Speed²) / Grip
      const puddleDepth = condition.puddleDepth || 0;
      const hydroplaningRisk = condition.hydroRisk && gripFactor > 0
        ? Math.min(1, (puddleDepth * (wetEntryKmh / 100) ** 2) / Math.max(0.01, gripFactor * 10))
        : 0;

      // Gear adjustment: wet conditions may need 1 gear lower in heavy rain
      const wetGear = (effectiveLoss >= 0.55 && corner.targetGear > 1)
        ? corner.targetGear - 1
        : corner.targetGear;

      return {
        turnNumber: corner.turnNumber,
        name: corner.name,
        cornerType: corner.cornerType,
        // Dry baselines (for PDF side-by-side)
        dryApexSpeedKmh: dryApexKmh,
        dryEntrySpeedKmh: dryEntryKmh,
        dryBrakingMarkerMeters: dryBrakeM,
        dryTargetGear: corner.targetGear,
        // Weather-adjusted values
        wetApexSpeedKmh: wetApexKmh,
        wetEntrySpeedKmh: wetEntryKmh,
        wetBrakingMarkerMeters: wetBrakeM,
        wetTargetGear: wetGear,
        // Risk
        hydroplaningRisk: parseFloat(hydroplaningRisk.toFixed(3)),
        hydroplaningFlag: hydroplaningRisk > 0.6,
        // Dynamic interpolation ratio (for UI awareness)
        dynamicRatio: condition.dynamic
          ? (condition.dynamicMode === 'start' ? 1 - idx / Math.max(1, total - 1) : idx / Math.max(1, total - 1))
          : null
      };
    });
  }

  _buildStrategy(condition, hydroCorners) {
    const isHeavy = condition.gripLoss >= 0.6;
    const isMed = condition.gripLoss >= 0.35;
    const isLight = condition.gripLoss >= 0.15;

    const tireRec = isHeavy ? 'Full wet tires recommended' : (isMed ? 'Intermediate tires recommended' : 'Slicks may remain viable — monitor surface');
    const lineRec = isMed ? 'Rim-shot line — avoid polished dry racing line which has lower wet grip' : 'Normal racing line with increased smoothness';
    const throttleRec = isHeavy ? 'Progressive throttle application only — no snap inputs at exit' : (isLight ? 'Smooth, patient throttle — avoid wheelspin' : 'Minor grip reduction — maintain normal approach');
    const brakingRec = isLight ? 'Initiate braking earlier and progressively — no threshold braking' : 'Normal braking with slight early initiation';
    const hydroNote = hydroCorners.length > 0
      ? `Aquaplaning risk at T${hydroCorners.join(', T')} — lift, don't brake, if car starts to float`
      : null;

    return {
      line: lineRec,
      tires: tireRec,
      throttle: throttleRec,
      braking: brakingRec,
      hydroNote
    };
  }

  _buildChecklist(condition) {
    const items = [];
    if (condition.gripLoss >= 0.35) {
      items.push('Switch to wet/intermediate tires before session start');
      items.push('Move brake bias rearward (2-3 clicks)');
      items.push('Increase TC sensitivity / activate wet mode');
    } else if (condition.gripLoss >= 0.15) {
      items.push('Monitor tire temps — wet surface may cool tires faster');
      items.push('Slightly increase brake bias rearward');
    }
    if (condition.gripLoss >= 0.6) {
      items.push('Expect 40-60% speed reduction at high-speed corners');
      items.push('Watch for hydroplaning — lift throttle immediately if car floats');
    }
    if (condition.visibility < 0.5) {
      items.push('Reduce following distance — impaired visibility');
    }
    if (condition.gripLoss >= 0.15) {
      items.push('Expect grip levels to shift as track rubbers in (or dries)');
    }
    if (items.length === 0) {
      items.push('Conditions near-ideal — maintain normal race pace and procedures');
    }
    return items;
  }
}

export const weatherSimulator = new WeatherSimulator();
