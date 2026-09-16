/**
 * APEX Career Mode - License & Milestone Evaluator (Browser Mirror)
 * Validates recorded stint telemetry against Going Faster curriculum requirements.
 */

import { CAREER_TIERS } from './career-curriculum.js';

export class LicenseEvaluator {
  /**
   * Evaluates a completed stint against all career milestones and returns unlocked achievements.
   * @param {Object} stint - Analyzed stint object from Pit Wall
   * @param {Object} currentCareerState - Stored driver career progression
   * @returns {Object} Updated career state with new milestones unlocked
   */
  static evaluateStint(stint, currentCareerState) {
    const state = currentCareerState || {
      unlockedTier: 1,
      completedMilestones: [],
      stats: {
        totalStints: 0,
        totalLaps: 0,
        weatherConditionsDriven: [],
        highestMastery: 0,
        radar: {
          line: 0,
          exitSpeed: 0,
          trailBraking: 0,
          balance: 0,
          wetControl: 0,
          consistency: 0
        }
      }
    };

    if (!stint || !stint.analysis) return { state, newlyUnlocked: [] };

    state.stats.totalStints = (state.stats.totalStints || 0) + 1;
    state.stats.totalLaps = (state.stats.totalLaps || 0) + (stint.laps?.length || stint.lapCount || 1);

    if (stint.weatherPreset) {
      if (!Array.isArray(state.stats.weatherConditionsDriven)) {
        state.stats.weatherConditionsDriven = Array.from(state.stats.weatherConditionsDriven || []);
      }
      if (!state.stats.weatherConditionsDriven.includes(stint.weatherPreset)) {
        state.stats.weatherConditionsDriven.push(stint.weatherPreset);
      }
    }

    const fcUtil = stint.analysis.frictionCircle?.utilization?.highUtilization ?? 0;
    const consistency = stint.analysis.consistencyScore ?? 0;
    const trailBrakeScore = stint.analysis.trailBraking?.score ?? stint.analysis.trailBrakingScore ?? 0;
    const stability = stint.analysis.carBalance?.stabilityScore ?? 0;
    const mastery = stint.analysis.masteryIndex ?? stint.analysis.goingFasterMasteryIndex ?? 0;
    const peakLatG = stint.analysis.carBalance?.lateralGPeak ?? 0;

    if (mastery > (state.stats.highestMastery || 0)) {
      state.stats.highestMastery = mastery;
    }

    const hasExistingRadar = state.stats.radar && Object.values(state.stats.radar).some(v => v > 0);

    // Update Skill Radar: If first stint, directly initialize from telemetry, else moving average (70% previous, 30% new)
    state.stats.radar = {
      line: !hasExistingRadar ? Math.min(99, Math.round(fcUtil)) : Math.min(99, Math.round((state.stats.radar?.line || 0) * 0.7 + (fcUtil * 0.3))),
      exitSpeed: !hasExistingRadar ? Math.min(99, Math.round(mastery)) : Math.min(99, Math.round((state.stats.radar?.exitSpeed || 0) * 0.7 + (mastery * 0.3))),
      trailBraking: !hasExistingRadar ? Math.min(99, Math.round(trailBrakeScore)) : Math.min(99, Math.round((state.stats.radar?.trailBraking || 0) * 0.7 + (trailBrakeScore * 0.3))),
      balance: !hasExistingRadar ? Math.min(99, Math.round(stability)) : Math.min(99, Math.round((state.stats.radar?.balance || 0) * 0.7 + (stability * 0.3))),
      wetControl: stint.weatherPreset?.toLowerCase().includes('rain')
        ? (!hasExistingRadar ? Math.min(99, Math.round(consistency)) : Math.min(99, Math.round((state.stats.radar?.wetControl || 0) * 0.6 + (consistency * 0.4))))
        : (state.stats.radar?.wetControl || 0),
      consistency: !hasExistingRadar ? Math.min(99, Math.round(consistency)) : Math.min(99, Math.round((state.stats.radar?.consistency || 0) * 0.7 + (consistency * 0.3)))
    };

    // Check Milestones
    const newlyUnlocked = [];

    CAREER_TIERS.forEach(tier => {
      tier.milestones.forEach(m => {
        if (!state.completedMilestones.includes(m.id)) {
          let passed = false;

          switch (m.metricKey) {
            case 'frictionCircleUtil':
              passed = fcUtil >= m.targetValue;
              break;
            case 'brakingCleanliness':
            case 'consistencyScore':
              passed = consistency >= m.targetValue;
              break;
            case 'typeIExitEfficiency':
            case 'tapAccuracy':
            case 'connectingDiscipline':
              passed = mastery >= 80;
              break;
            case 'trailBrakingScore':
              passed = trailBrakeScore >= m.targetValue;
              break;
            case 'chassisStability':
              passed = stability >= m.targetValue;
              break;
            case 'peakLatG':
              passed = peakLatG >= m.targetValue;
              break;
            case 'wetConsistency':
            case 'lowGripMastery':
              passed = (stint.weatherPreset?.toLowerCase().includes('rain') || stint.weatherPreset?.toLowerCase().includes('damp')) && consistency >= 75;
              break;
            case 'weatherVariety':
              passed = (state.stats.weatherConditionsDriven?.length || 1) >= m.targetValue;
              break;
            case 'masteryIndex':
              passed = mastery >= m.targetValue;
              break;
          }

          if (passed) {
            state.completedMilestones.push(m.id);
            newlyUnlocked.push(m);
          }
        }
      });
    });

    // Evaluate Tier Advancement
    for (let t = 1; t <= 5; t++) {
      const tierObj = CAREER_TIERS.find(ct => ct.tier === t);
      if (tierObj) {
        const allCompleted = tierObj.milestones.every(m => state.completedMilestones.includes(m.id));
        if (allCompleted && state.unlockedTier <= t && t < 5) {
          state.unlockedTier = t + 1;
        }
      }
    }

    return {
      state,
      newlyUnlocked
    };
  }
}
