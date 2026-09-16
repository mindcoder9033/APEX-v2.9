/**
 * APEX Career Mode - Going Faster Driver Curriculum Tree (Browser Mirror)
 * 5-Tier Driver Development Structure based on Skip Barber Racing School:
 *
 * Tier 1: Fundamentals & The Traction Circle
 * Tier 2: Corner Typology & Line Optimization (Type I, II, III)
 * Tier 3: Trail Braking & Dynamic Weight Transfer
 * Tier 4: Dynamic & Wet Weather Mastery (18 Presets)
 * Tier 5: Racecraft & Telemetry Mastery
 */

export const CAREER_TIERS = [
  {
    tier: 1,
    id: 'tier-1-fundamentals',
    name: 'Tier 1: Fundamentals & Traction Circle',
    license: 'CLASS C // NOVICE LICENSE',
    color: '#00CC66',
    description: 'Master car control, smooth input separation, and basic friction circle loading.',
    quote: '"The friction circle allows you to think about what happens to one ability of the tire as you increase demands for another." — Skip Barber',
    milestones: [
      {
        id: 'm1-1',
        title: 'Traction Circle Foundation',
        requirement: 'Achieve >70% Traction Circle limit utilization on a completed stint.',
        metricKey: 'frictionCircleUtil',
        targetValue: 70,
        unit: '%'
      },
      {
        id: 'm1-2',
        title: 'Smooth Deceleration',
        requirement: 'Execute threshold braking without front lockup across 5 consecutive laps.',
        metricKey: 'brakingCleanliness',
        targetValue: 85,
        unit: '%'
      },
      {
        id: 'm1-3',
        title: 'Consistency Baseline',
        requirement: 'Maintain lap time consistency score >= 80%.',
        metricKey: 'consistencyScore',
        targetValue: 80,
        unit: '%'
      }
    ]
  },
  {
    tier: 2,
    id: 'tier-2-typology',
    name: 'Tier 2: Corner Typology & Line Selection',
    license: 'CLASS B // CLUBMAN LICENSE',
    color: '#0099FF',
    description: 'Classify and exploit Type I (exit), Type II (entry), and Type III (sacrifice) corners.',
    quote: '"Exit speed is everything on Type I corners leading onto a straightaway." — Skip Barber',
    milestones: [
      {
        id: 'm2-1',
        title: 'Type I Corner Launch',
        requirement: 'Achieve >90% exit speed efficiency on all Type I corners in a stint.',
        metricKey: 'typeIExitEfficiency',
        targetValue: 90,
        unit: '%'
      },
      {
        id: 'm2-2',
        title: 'Early Throttle Application (TAP)',
        requirement: 'Attain positive TAP delta (accelerating before apex) on 80% of fast sweepers.',
        metricKey: 'tapAccuracy',
        targetValue: 80,
        unit: '%'
      },
      {
        id: 'm2-3',
        title: 'Type III Line Discipline',
        requirement: 'Successfully sacrifice entry in connecting complexes to optimize straightaway drive.',
        metricKey: 'connectingDiscipline',
        targetValue: 85,
        unit: '%'
      }
    ]
  },
  {
    tier: 3,
    id: 'tier-3-trail-braking',
    name: 'Tier 3: Trail Braking & Dynamic Balance',
    license: 'CLASS A // NATIONAL LICENSE',
    color: '#E5A910',
    description: 'Master progressive brake release blended with steering rotation to apex.',
    quote: '"As steering angle increases, brake pressure must decrease to keep the tire within its traction circle." — Skip Barber',
    milestones: [
      {
        id: 'm3-1',
        title: 'Trail-Braking Linear Release',
        requirement: 'Attain a Trail-Braking quality score >= 80/100.',
        metricKey: 'trailBrakingScore',
        targetValue: 80,
        unit: '/100'
      },
      {
        id: 'm3-2',
        title: 'Chassis Neutrality',
        requirement: 'Maintain neutral cornering attitude with <20% excessive understeer/oversteer.',
        metricKey: 'chassisStability',
        targetValue: 85,
        unit: '%'
      },
      {
        id: 'm3-3',
        title: 'Peak Lateral G Exploitation',
        requirement: 'Achieve sustained >1.25G lateral cornering load.',
        metricKey: 'peakLatG',
        targetValue: 1.25,
        unit: 'G'
      }
    ]
  },
  {
    tier: 4,
    id: 'tier-4-weather-mastery',
    name: 'Tier 4: Dynamic & Wet Weather Mastery',
    license: 'PRO // INTERNATIONAL LICENSE',
    color: '#9966FF',
    description: 'Adapt to grip degradation, rain lines, and changing track temperatures across 18 weather presets.',
    quote: '"In the wet, the rubbered-in dry line is slick as ice. The rim-shot line provides the true grip." — Skip Barber',
    milestones: [
      {
        id: 'm4-1',
        title: 'Wet Line Adaptation',
        requirement: 'Complete a stint under Moderate/Heavy Rain with 0 major spins.',
        metricKey: 'wetConsistency',
        targetValue: 85,
        unit: '%'
      },
      {
        id: 'm4-2',
        title: 'Variable Friction Control',
        requirement: 'Score >75% Going Faster Mastery under low-grip (<0.75 grip coeff) conditions.',
        metricKey: 'lowGripMastery',
        targetValue: 75,
        unit: '%'
      },
      {
        id: 'm4-3',
        title: 'Multi-Condition Adaptability',
        requirement: 'Record and log stints across at least 4 distinct weather presets.',
        metricKey: 'weatherVariety',
        targetValue: 4,
        unit: ' presets'
      }
    ]
  },
  {
    tier: 5,
    id: 'tier-5-racecraft-mastery',
    name: 'Tier 5: Racecraft & Telemetry Mastery',
    license: 'APEX MASTER // SUPER LICENSE',
    color: '#E10600',
    description: 'The pinnacle of motorsport racecraft: sub-tenth lap consistency and telemetry self-coaching.',
    quote: '"The champion recognizes mistakes sooner and makes the correction invisible." — Mario Andretti',
    milestones: [
      {
        id: 'm5-1',
        title: 'Pinnacle Consistency',
        requirement: 'Achieve a Stint Consistency Index >= 95% over 10+ consecutive laps.',
        metricKey: 'consistencyScore',
        targetValue: 95,
        unit: '%'
      },
      {
        id: 'm5-2',
        title: 'Complete Traction Envelope',
        requirement: 'Exceed 85% high-utilization friction circle limit driving.',
        metricKey: 'frictionCircleUtil',
        targetValue: 85,
        unit: '%'
      },
      {
        id: 'm5-3',
        title: 'Mastery Grand Slam',
        requirement: 'Achieve composite Going Faster Mastery Index >= 90/100.',
        metricKey: 'masteryIndex',
        targetValue: 90,
        unit: '/100'
      }
    ]
  }
];
