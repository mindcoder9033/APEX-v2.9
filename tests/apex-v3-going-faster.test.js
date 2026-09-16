import test from 'node:test';
import assert from 'node:assert/strict';

import { CornerClassifier, CORNER_TYPE } from '../src/analysis/going-faster/corner-classifier.js';
import { TrailBrakingAnalyzer } from '../src/analysis/going-faster/trail-braking.js';
import { CarBalanceAnalyzer } from '../src/analysis/going-faster/car-balance.js';
import { FORZA_18_WEATHER_PRESETS, WeatherMatrixCalculator } from '../src/analysis/weather-matrix.js';
import { CAREER_TIERS } from '../src/career/curriculum-tree.js';
import { LicenseEvaluator } from '../src/career/license-evaluator.js';
import { StintManager } from '../src/pitwall/stint-manager.js';

test('APEX v3.0 // Going Faster Physics & Corner Typology', async (t) => {
  await t.test('CornerClassifier: Accurately classifies Type I, Type II, and Type III corners', () => {
    // Type I: Long straight after (exit priority)
    const typeI = CornerClassifier.classify({
      entrySpeedMph: 90,
      exitSpeedMph: 75,
      straightAfterLengthFt: 850,
      straightBeforeLengthFt: 300
    });
    assert.equal(typeI.type, CORNER_TYPE.TYPE_I);
    assert.match(typeI.rationale, /straightaway/i);

    // Type II: Long straight before into heavy braking (entry priority)
    const typeII = CornerClassifier.classify({
      entrySpeedMph: 130,
      exitSpeedMph: 50,
      straightAfterLengthFt: 250,
      straightBeforeLengthFt: 900
    });
    assert.equal(typeII.type, CORNER_TYPE.TYPE_II);
    assert.match(typeII.coaching, /threshold/i);

    // Type III: Connecting corner complex
    const typeIII = CornerClassifier.classify({
      entrySpeedMph: 80,
      exitSpeedMph: 70,
      straightAfterLengthFt: 300,
      straightBeforeLengthFt: 300
    });
    assert.equal(typeIII.type, CORNER_TYPE.TYPE_III);
    assert.match(typeIII.coaching, /Sacrifice/i);
  });

  await t.test('TrailBrakingAnalyzer: Computes trail-braking overlap and release quality', () => {
    // Create mock braking zone samples: brake smoothly decaying while steering increases
    const mockSamples = [];
    for (let i = 0; i < 30; i++) {
      const progress = i / 30;
      mockSamples.push({
        inputs: {
          brake: Math.max(0, 1.0 - progress), // Releasing 1.0 -> 0.0
          steering: progress * 0.4            // Increasing 0.0 -> 0.4
        },
        motion: {
          acceleration: {
            lateralG: progress * 1.2,
            longitudinalG: (1.0 - progress) * -1.1
          }
        }
      });
    }

    const result = TrailBrakingAnalyzer.analyzeEntry(mockSamples);
    assert.ok(result.score >= 70, `Score should be high, got ${result.score}`);
    assert.ok(result.overlapPercent > 50, 'Overlap percent should be substantial');
    assert.ok(result.releaseLinearity > 80, 'Release should be linear');
  });

  await t.test('CarBalanceAnalyzer: Identifies chassis understeer and oversteer slip tendencies', () => {
    const mockSamples = [];
    for (let i = 0; i < 40; i++) {
      mockSamples.push({
        inputs: { steering: 0.35 },
        motion: {
          speedMs: 35,
          acceleration: { lateralG: 1.1, longitudinalG: 0.1 },
          angularVelocity: { yaw: 0.4 }
        },
        tires: {
          slipAngle: { frontLeft: 0.12, frontRight: 0.12, rearLeft: 0.05, rearRight: 0.05 }
        }
      });
    }

    const balance = CarBalanceAnalyzer.analyzeBalance(mockSamples);
    assert.ok(balance.understeerPct > balance.oversteerPct, 'Front push should register as understeer');
    assert.equal(balance.balanceProfile, 'UNDERSTEER PRONE');
  });

  await t.test('WeatherMatrixCalculator: Handles all 18 Forza Motorsport weather presets', () => {
    assert.equal(FORZA_18_WEATHER_PRESETS.length, 18, 'Must contain exactly 18 presets');

    const heavyRain = WeatherMatrixCalculator.getPreset('wet-heavy-rain');
    assert.equal(heavyRain.gripCoeff, 0.60);
    assert.equal(heavyRain.wetLineNeeded, true);
    assert.equal(heavyRain.tirePressureDeltaPsi, +3.5);

    const cornerImpact = WeatherMatrixCalculator.calculateCornerImpact({ speed: { apexMph: 80 } }, heavyRain);
    assert.ok(cornerImpact.adjustedApexSpeedMph < 80, 'Speed must decrease in rain');
    assert.ok(cornerImpact.extraBrakingFeet > 0, 'Braking distance must increase in rain');
  });

  await t.test('Career Mode: 5-Tier Curriculum Tree & License Evaluator', () => {
    assert.equal(CAREER_TIERS.length, 5, 'Must contain 5 Going Faster tiers');

    const mockStint = {
      weatherPreset: 'Clear (Day)',
      analysis: {
        frictionCircle: { utilization: { highUtilization: 82 } },
        consistencyScore: 90,
        trailBraking: { score: 85 },
        carBalance: { stabilityScore: 88, lateralGPeak: 1.30 },
        masteryIndex: 86
      }
    };

    const initialCareer = {
      unlockedTier: 1,
      completedMilestones: [],
      stats: { totalStints: 0, totalLaps: 0, weatherConditionsDriven: [], radar: {} }
    };

    const evalResult = LicenseEvaluator.evaluateStint(mockStint, initialCareer);
    assert.ok(evalResult.newlyUnlocked.length > 0, 'Should unlock Tier 1 milestones');
    assert.ok(evalResult.state.completedMilestones.includes('m1-1'), 'Traction Circle Foundation must unlock');
    assert.ok(evalResult.state.completedMilestones.includes('m1-2'), 'Smooth Deceleration must unlock');
    assert.ok(evalResult.state.completedMilestones.includes('m1-3'), 'Consistency Baseline must unlock');
    assert.ok(evalResult.state.unlockedTier >= 2, `Should advance at least to Tier 2 license, got Tier ${evalResult.state.unlockedTier}`);
  });

  await t.test('StintManager: Standardizes stint recording, Going Faster scoring, and persistence', async () => {
    const sm = new StintManager();
    const stint = sm.startStint({ trackName: 'Sebring', carName: 'Aston Martin' });
    assert.equal(stint.trackName, 'Sebring');
    assert.equal(stint.status, 'recording');

    stint.samples = [
      {
        inputs: { brake: 0, throttle: 1, steering: 0 },
        motion: { acceleration: { lateralG: 0.1, longitudinalG: 0.6 }, speedMs: 40 }
      },
      {
        inputs: { brake: 0.8, throttle: 0, steering: 0.2 },
        motion: { acceleration: { lateralG: 0.8, longitudinalG: -1.0 }, speedMs: 30 }
      }
    ];

    const finalized = await sm.finalizeAndSaveStint(stint);
    assert.equal(finalized.status, 'saved');
    assert.ok(finalized.analysis.goingFasterMasteryIndex > 0);
    assert.ok(sm.getStint(stint.id) !== null);
  });
});
