/**
 * APEX Skills Hub - Going Faster Curriculum Model
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving"
 * Chapter 1: "A Plan of Attack"
 */

export const GOING_FASTER_CHAPTERS = [
  {
    chapterNumber: 1,
    id: 'ch1-plan-of-attack',
    title: 'Chapter 1: A Plan of Attack',
    subtitle: 'The Three-Tiered Approach to Fast Laps',
    quote: '"Confronted with a twisty piece of asphalt, you need to figure out how to drive around it in the shortest possible time. That\'s it. It\'s a problem of minimizing time." — Skip Barber',
    description: 'Straightaways make up 70% to 80% of any racetrack. Minimizing lap time begins by prioritizing exit speed onto the straights, finding the maximum radius line, and mastering straight-line threshold braking before attempting late-braking heroism.',
    keyRules: [
      'Line selection determines maximum cornering and straightaway speed.',
      'Exit speed onto a straight is far more valuable than late braking.',
      'Carrying 100% cornering limit to the exit leaves 0% traction for acceleration.',
      'Never confuse skill with daring — brains over bravado always wins.'
    ],
    skills: [
      {
        id: 'ch1-exit-speed',
        name: 'Exit Speed & Throttle Commitment',
        tagline: 'Car Control for Exit Speed',
        priority: 'P1 (Highest Return)',
        icon: '🚀',
        color: '#00ff88',
        concept: 'Squeezing throttle progressively as steering unwinds onto straightaway. A 2 mph exit gain carries all the way down the straight.',
        telemetryFocus: 'Throttle ramp linearity, time-to-100%, steering unwind synchronization, exit speed delta.',
        targetThreshold: 'Score >= 85 (Smooth throttle squeeze without hesitation or pinched steering)',
        commonMistake: 'Pinching exit (tightening wheel while on throttle) or hesitating at apex.',
        skipBarberQuote: '"Since the greatest part of a lap is spent on corner exits and straights, any speed improvements on this portion have the greatest effect on decreasing lap time."'
      },
      {
        id: 'ch1-the-line',
        name: 'Line Radius & Arc Consistency',
        tagline: 'Finding the Optimum Arc',
        priority: 'P2 (Geometric Foundation)',
        icon: '📐',
        color: '#00e5ff',
        concept: 'Driving on an arc with the biggest possible radius yields the highest cornering speed and maximum apex minimum velocity.',
        telemetryFocus: 'Steering angle standard deviation (absence of saw-toothing), apex minimum speed retention.',
        targetThreshold: 'Steering fluctuation < 0.05 rad, smooth continuous circular arc.',
        commonMistake: 'Turning in too early and pinching the corner exit, requiring mid-corner saw-tooth corrections.',
        skipBarberQuote: '"In cornering, the biggest radius yields the highest speed. The process of finding the optimum line is a tool to post the fastest possible time."'
      },
      {
        id: 'ch1-threshold-braking',
        name: 'Threshold Braking Precision',
        tagline: 'Slowing the Car in Minimum Distance',
        priority: 'P3 (Entry Control)',
        icon: '🛑',
        color: '#ffb800',
        concept: 'Quickly ramping up to 100% of tire braking capacity while traveling in a straight line before turn-in, without lockup.',
        telemetryFocus: 'Brake ramp time (<0.25s), peak deceleration firmness (>1.2G), lockup/ABS chatter avoidance.',
        targetThreshold: 'Firm initial hit (>85% pressure) within 0.25s, stable longitudinal G.',
        commonMistake: 'Soft initial brake application followed by panicking and locking up deep into the corner.',
        skipBarberQuote: '"Going straight here, you can use 100% of the car\'s potential braking ability. We call it threshold braking, right on the edge of lockup."'
      },
      {
        id: 'ch1-combined-entry',
        name: 'Combined Entry & Trail-Braking',
        tagline: 'Braking and Entering Transition',
        priority: 'P4 (Traction Handoff)',
        icon: '⚡',
        color: '#ff3366',
        concept: 'Mixing deceleration and turning abilities by progressively relaxing brake pedal pressure as steering lock is added.',
        telemetryFocus: 'G-G combined traction utilization (>85%), smooth brake bleed off slope during turn-in.',
        targetThreshold: '20%–60% overlap zone without abrupt brake release spikes.',
        commonMistake: 'Snapping off the brake pedal 100% before turning in, upsetting front-end bite.',
        skipBarberQuote: '"If you reduce some of the braking effort, say to 80%, you get 20% of the tires\' traction available for cornering."'
      },
      {
        id: 'ch1-platform-stability',
        name: 'Platform Balance & Anti-Lift',
        tagline: 'Chassis Weight Transfer Control',
        priority: 'P5 (Dynamic Composure)',
        icon: '⚖️',
        color: '#a855f7',
        concept: 'Maintaining steady dynamic balance and avoiding careless mid-corner throttle lifts that unweight the rear tires.',
        telemetryFocus: 'Zero mid-corner throttle drops (>15%), longitudinal jerk ($dG_x/dt$) < 15 G/s.',
        targetThreshold: '0 throttle lifts mid-corner, smooth progressive weight transfer.',
        commonMistake: 'Carelessly lifting off the throttle mid-corner, causing snap oversteer / spin.',
        skipBarberQuote: '"An abrupt snap off the gas upsets this balance and can steal traction from the rear tires, causing a spin. Small, smooth, and subtle changes are the best bet."'
      }
    ]
  }
];

export function getChapter(chapterNumber = 1) {
  return GOING_FASTER_CHAPTERS.find(c => c.chapterNumber === chapterNumber) || GOING_FASTER_CHAPTERS[0];
}

export function getSkill(skillId) {
  for (const ch of GOING_FASTER_CHAPTERS) {
    const s = ch.skills.find(sk => sk.id === skillId);
    if (s) return { ...s, chapterTitle: ch.title };
  }
  return null;
}
