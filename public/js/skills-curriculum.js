/**
 * APEX Skills Hub - Going Faster Curriculum Model
 * Based on Skip Barber "Going Faster! Mastering the Art of Race Driving"
 */

export const GOING_FASTER_CHAPTERS = [
  {
    chapterNumber: 1,
    id: 'ch1-plan-of-attack',
    title: 'Chapter 1: A Plan of Attack',
    shortTitle: 'Ch 1: Plan of Attack',
    subtitle: 'The Three-Tiered Approach to Fast Laps',
    status: 'active',
    icon: '⚡',
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
        concept: 'Squeezing throttle progressively as steering unwinds onto straightaway. A 3–5 km/h exit speed gain carries all the way down the following straight.',
        telemetryFocus: 'Throttle ramp linearity, time-to-100%, steering unwind synchronization, exit speed delta (km/h).',
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
  },
  {
    chapterNumber: 2,
    id: 'ch2-three-basics',
    title: 'Chapter 2: The Three Basics: Line, Corner Exit Speed, Braking',
    shortTitle: 'Ch 2: The Three Basics',
    subtitle: 'Vehicle Dynamics, 15GR Geometry & The 4 Blocks of Corner Entry',
    status: 'active',
    icon: '⚖️',
    quote: '"There are three basic problems to solve in race driving: 1) driving on the best path, 2) carrying speed through corners and onto straights, and 3) efficiently slowing the car at the entry to corners." — Skip Barber',
    description: 'Mastering the fundamental physics of race driving: calculating optimum arcs with the 15GR law (5% extra distance for 37% speed gain), managing throttle-induced weight transfer and slide recovery (Correction, Pause, Recovery), and executing the 4 distinct blocks of corner entry with dynamic brake balance.',
    keyRules: [
      'The 15GR radius equation (15 * G * R = mph²) dictates maximum cornering speed.',
      'Driving on the true racing line adds ~5% distance but allows 37% higher cornering speed.',
      'Turning in too early (early apex) forces a tight, speed-killing radius at corner exit.',
      'Correction, Pause, Recovery: countersteer into the slide, pause at peak yaw, and unwind before snapback.',
      'Corner entry comprises 4 distinct blocks: Transition, Straight Decel, Brake-Turn, and Throttle Pickup.'
    ],
    skills: [
      {
        id: 'ch2-line-geometry-15gr',
        name: 'Line Geometry & 15GR Arc Optimization',
        tagline: 'Maximizing Radius & Apex Precision',
        priority: 'P1 (Kinematic Limit)',
        icon: '📐',
        color: '#00e5ff',
        concept: 'Driving the true geometric arc with maximum radius R to achieve maximum cornering speed (15*G*R = mph² / V = √(R*g*μ)). Hitting turn-in, apex, and track-out within inches avoids the devastating exit pinch of early apexing.',
        telemetryFocus: 'Achieved corner radius R (m), apex minimum speed vs theoretical 15GR Vmax, steering stability, absence of early-apex exit pinch.',
        targetThreshold: 'Radius efficiency >= 90% of theoretical maximum; apex timing within 0.15s of geometric optimal.',
        commonMistake: 'Turning in too early and clipping an early apex, forcing an emergency late steering pinch down to a tiny 75ft radius.',
        skipBarberQuote: '"Driving on the line results in driving further, but in this case roughly 5% further at 37% greater speed — a very good trade-off."'
      },
      {
        id: 'ch2-balance-slide-control',
        name: 'Throttle Balance & Slide Recovery (CPR)',
        tagline: 'Correction, Pause, and Recovery',
        priority: 'P2 (Vehicle Dynamics)',
        icon: '🔄',
        color: '#00ff88',
        concept: 'Controlling chassis balance through subtle throttle modulation and executing the 3-phase slide recovery rule: 1) Immediate countersteer correction, 2) Brief pause as slide halts, 3) Smooth recovery unwind before the rear swings back.',
        telemetryFocus: 'Yaw rate deviation, countersteer reaction latency (<0.15s), pause stability, recovery unwind timing, zero trailing-throttle lift spikes.',
        targetThreshold: 'Correction latency < 150ms, zero snapback oscillations, smooth throttle support during oversteer.',
        commonMistake: 'Panicking with abrupt throttle lift causing trailing-throttle oversteer, or being too slow to unwind the countersteer during recovery.',
        skipBarberQuote: '"Every tail-out slide should be dealt with by making a correction, then using the pause as a cue for beginning the recovery. If you\'re slow to take out steering correction, momentum will snap the car in the opposite direction."'
      },
      {
        id: 'ch2-four-block-entry',
        name: '4-Block Corner Entry & Dynamic Load Transfer',
        tagline: 'The 4 Phases of Corner Entry',
        priority: 'P3 (Entry Mastery)',
        icon: '🛑',
        color: '#ffb800',
        concept: 'Seamlessly linking the 4 entry blocks: Block 1 (Throttle-Brake transition), Block 2 (Straight-line threshold deceleration & 65% front load transfer), Block 3 (Brake-turn trail braking), and Block 4 (Brake-to-throttle pickup with zero dead-coast delay).',
        telemetryFocus: 'Block 1 transition speed (<0.20s), Block 2 peak deceleration stability (avoiding the 30% grip drop lockup), Block 3 trail overlap, Block 4 seamless throttle handoff.',
        targetThreshold: '100% phase continuity through all 4 blocks, firm initial load transfer, zero wheel lockup.',
        commonMistake: 'Coasting between off-throttle and braking (Block 1 gap), or locking the inside front/rear tire and losing 30% of tractive force.',
        skipBarberQuote: '"We can break the whole process down into four major blocks: 1) Throttle-Brake Transition, 2) Straight-Line Deceleration, 3) Brake-Turn, and 4) Brake-Throttle Transition."'
      }
    ]
  },
  {
    chapterNumber: 3,
    id: 'ch3-types-of-corners',
    title: 'Chapter 3: Types of Corners',
    shortTitle: 'Ch 3: Corner Typology',
    subtitle: 'Type I, Type II, and Type III Strategies',
    status: 'coming-soon',
    icon: '🏁',
    quote: '"Not all corners are created equal. You must know which corner leads to the straightaway and which corner must be sacrificed." — Skip Barber',
    description: 'Classifying corners into exit priority (Type I), entry priority (Type II), and sacrifice corners (Type III).',
    skills: []
  },
  {
    chapterNumber: 4,
    id: 'ch4-braking-entering',
    title: 'Chapter 4: Braking and Entering',
    shortTitle: 'Ch 4: Braking & Entering',
    subtitle: 'Deep Trail Braking & Downshifting Mastery',
    status: 'coming-soon',
    icon: '📉',
    quote: '"Braking is the last thing you should try to do faster, but when mastered, it is what separates the champions." — Skip Barber',
    description: 'Mastering heel-and-toe rev matching and trailing off brakes right down to the apex.',
    skills: []
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
