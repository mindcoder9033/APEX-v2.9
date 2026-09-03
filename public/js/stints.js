/**
 * APEX Motorsport Practice Stints Controller & Stepping Stones Hub
 * Implements Tier 1 (Fundamentals), Tier 2 (Physics), and Tier 3 (Real-World Line)
 * from Skip Barber "Going Faster!" Racing Curriculum.
 */

import { LiveHudRenderer } from './hud.js';
import { PdfReportGenerator } from './pdf-report.js';

export const STINTS_DATABASE = [
  // --- TIER 1: THE 3 BASICS & FUNDAMENTALS ---
  {
    id: 'stint-1-1',
    tier: 1,
    tierName: 'Tier 1: Fundamentals',
    tierShort: 'T1 // FUNDAMENTALS',
    name: 'The Foundation Stint',
    subtitle: 'Mastering the Order of Effort: Line, Exit Speed & Entry Braking',
    focus: 'The 3 Fundamentals: Path, Exit Drive & Deceleration Transition',
    targetMetric: 'Composite Foundation Mastery >= 85% [Line: 90%+, Exit: +3.2 km/h, Trail: 80/20]',
    prescribedCar: '2019 Aston Martin Vantage',
    prescribedTrack: 'Sebring International Raceway (Full Circuit)',
    gameType: 'Timed Practice / Circuit Session',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 10,
    drivatars: 0,
    quote: '"You need to first determine the correct path on which to drive and then work on increasing your speed on that path... Braking and entering will be our final area of concentration." — Skip Barber (Page 10, 18)',
    briefing: 'Execute a holistic 10-lap practice session uniting the three core racing disciplines from Chapter 1: 1) The Line (carving the maximum radius arc R3), 2) Corner Exit Speed (hitting the Throttle Application Point early and unwinding the wheel to build speed onto the straight), and 3) Braking & Entering (stepping your brake points in small bites and blending 80% straight-line threshold braking into lateral corner entry grip).',
    actionPlan: [
      'The Line: Drive the maximum radius arc — touch the inside curb halfway through and track out completely to the exit white line.',
      'Exit Speed: Locate your Throttle Application Point (TAP) before the apex; squeeze the throttle progressively while unwinding steering lock to gain +3.2 km/h exit speed.',
      'Braking & Entering: Step your braking markers conservatively in small bites; smoothly bleed off brake pressure as you turn into the corner (80% brake / 20% steer).'
    ],
    hudWidgets: ['Driving Line Score', 'Corner Exit Speed Delta (km/h)', 'Brake & Turn G-Meter (Traction Circle)', 'Composite Foundation Mastery Gauge']
  },

  // --- TIER 2: VEHICLE DYNAMICS (CHAPTER 2: THE THREE BASICS) ---
  {
    id: 'stint-2-1',
    tier: 2,
    tierName: 'Tier 2: Vehicle Dynamics',
    tierShort: 'T2 // DYNAMICS',
    name: 'The Three Basics: Dynamics',
    subtitle: 'Arc Radius Optimization (15GR = mph²), Dynamic Weight Transfer & 4-Block Corner Entry',
    focus: 'The 3 Basics: Line Radius (15GR), Chassis Throttle Balance & 4-Block Threshold Braking',
    targetMetric: 'Composite Dynamics Mastery >= 85% [Radius: 195 ft, TTO: 0 Snaps, Decel: >=88% (Peak >1.25G)]',
    prescribedCar: '2020 Chevrolet Corvette Stingray Coupe',
    prescribedTrack: 'Sebring International Raceway (Full Circuit)',
    gameType: 'Circuit Race',
    timeOfDay: 'Late morning',
    weather: 'Clear',
    laps: 12,
    drivatars: 0,
    quote: '"To find out how much faster you can go through Turn 7 on the right line... the radius of the arc that represents the racing line is a whopping 195 feet... A gradual increase in throttle will tend to create understeer; an abrupt application will create oversteer." — Skip Barber (Page 19, 27, 30)',
    briefing: 'Execute a comprehensive 12-lap vehicle dynamics session synthesizing the three core physics fundamentals from Chapter 2: 1) The Line: Carve the 195 ft radius arc (15GR = mph²) at Sebring Turn 7 without early-apex pinching. 2) Exit Speed & Chassis Balance: Squeeze the throttle progressively to transfer load rearward while eliminating trailing throttle oversteer (TTO) snap slides. 3) Braking & Entering: Execute the 4 blocks of corner entry with an assertive initial brake strike, straight-line threshold decel, and smooth load transition into turn-in.',
    actionPlan: [
      'Line Radius: Overrule your early turn-in instinct; turn in at the correct geometric mark to maintain a sweeping 195 ft radius arc.',
      'Throttle Balance: Squeeze throttle smoothly on corner exit to stabilize rear axle loading; never chop throttle mid-corner at peak lateral load.',
      '4-Block Braking: Strike the brake firmly in a straight line at the threshold limit, then bleed off pressure smoothly as you transition into corner entry.'
    ],
    hudWidgets: ['Live Arc Radius (15GR = mph²)', 'Throttle Balance & TTO Risk', '4-Block Threshold Decel Efficiency', 'Composite Dynamics Index']
  },

  // --- TIER 3: REAL-WORLD LINE & ADAPTATION ---
  {
    id: 'stint-3-1',
    tier: 3,
    tierName: 'Tier 3: Real-World Adaptation',
    tierShort: 'T3 // REAL-WORLD',
    name: 'The Speed of Recognition',
    subtitle: 'Speed-Sensitive Diagnosis & Early Mistake Curing',
    focus: 'Catching Early Apexes 90ft Before Point A',
    targetMetric: 'Mistake Detection Reaction Distance: <30 ft',
    prescribedCar: '2015 Chevrolet Corvette Z06 (650 HP RWD)',
    prescribedTrack: 'Lime Rock Park (Full Circuit)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Afternoon (Angled Shadow Light)',
    weather: 'Mostly Clear (Dry Surface)',
    laps: 15,
    drivatars: 0,
    quote: '"The faster you go, the earlier you have to identify and cure mistakes... champions recognize their mistakes sooner." (Page 38)',
    briefing: 'At high racing velocities, early turn-in errors cannot be fixed at the apex — by then the car is trapped on an impossibly tight radius. You must recognize early apexing 90 feet before the corner and apply the "Relax Steering + Firm Brake" procedure immediately.',
    actionPlan: [
      'Maintain an active visual "Sight Picture" looking far ahead of your current braking point.',
      'If the Early Apex Predictor flashes on your HUD, immediately ease steering and brake firmly.',
      'Re-align the car trajectory to clip a safe late apex rather than running off at the exit.'
    ],
    hudWidgets: ['Early Apex Warning Indicator', 'Apex Attitude Vector (Heading Error)', 'Reaction Distance Meter', 'Unwind Rate Monitor']
  },
  {
    id: 'stint-3-2',
    tier: 3,
    tierName: 'Tier 3: Real-World Adaptation',
    tierShort: 'T3 // REAL-WORLD',
    name: 'The Camber Hunter',
    subtitle: 'Dynamic Grip Adaptation (Banking, Crown & Elevation)',
    focus: 'Exploiting Road Camber & Surface Grip',
    targetMetric: 'Grip Utilization on Banking: +10% G-Force Over Crest',
    prescribedCar: '2015 Chevrolet Corvette Z06 (650 HP RWD)',
    prescribedTrack: 'Lime Rock Park (The Uphill & Downhill)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Afternoon (Angled Shadow Light)',
    weather: 'Mostly Clear (Dry Surface)',
    laps: 15,
    drivatars: 0,
    quote: '"Even one degree of road camber can improve cornering grip by over 3%... On a 5-degree banking, centrifugal force contributes downforce, providing over 10% better cornering force." (Page 47-48)',
    briefing: 'Racetracks are not flat geometric sheets. Positive banking provides extra grip and downforce, allowing an earlier apex; off-camber roads shed grip, necessitating a patient, wide line. Read the road surface and adjust your line accordingly.',
    actionPlan: [
      'Turn in earlier on positive-camber corners (The Uphill) to ride the compression bowl.',
      'Delay turn-in and brake conservatively on off-camber crowns to prevent sliding out.',
      'Consult the Traction Variability Map on the HUD for real-time camber and grip readouts.'
    ],
    hudWidgets: ['Traction Variability Map', 'Camber & Banking G-Gain', 'Suspension Compression Ratio', 'Surface Micro-Grip Indicator']
  },
  {
    id: 'stint-3-3',
    tier: 3,
    tierName: 'Tier 3: Real-World Adaptation',
    tierShort: 'T3 // REAL-WORLD',
    name: 'The Compromise Architect',
    subtitle: 'Corner Prioritization & The Esses (Type I vs Type III)',
    focus: 'Sacrificing Entry for Maximum Straight Exit',
    targetMetric: 'Main Straight Exit Velocity Gain: +4.0 MPH',
    prescribedCar: '2015 Chevrolet Corvette Z06 (650 HP RWD)',
    prescribedTrack: 'Lime Rock Park (The Downhill onto Main Straight)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Afternoon (Angled Shadow Light)',
    weather: 'Mostly Clear (Dry Surface)',
    laps: 15,
    drivatars: 0,
    quote: '"Once you realize a corner is a compromise corner, then it turns into a discipline corner... you sacrifice the first to be flat out through the second." — Dorsey Schroeder (Page 52)',
    briefing: 'In complex multi-corner sequences (esses and chicanes), treating each turn equally destroys your lap time. Consciously over-slow for the Type III entry corner to position the car wide for maximum throttle launch through the Type I exit corner.',
    actionPlan: [
      'Identify which corner in a complex leads onto the longest acceleration zone (Type I).',
      'Sacrifice entry speed into the preceding turn (Type III) to achieve ideal car placement.',
      'Pin the throttle early and carry compound velocity all the way down the straight.'
    ],
    hudWidgets: ['Corner Priority Grade Badge (Type I / II / III)', 'Compromise Corner Loss vs Gain Delta', 'Exit Speed Launch Monitor', 'Downhill Steering Unwind Dial']
  },

  // --- TIER 4: MASTERING CAR CONTROL ---
  {
    id: 'stint-4-1',
    tier: 4,
    tierName: 'Tier 4: Mastering Car Control',
    tierShort: 'T4 // CAR CONTROL',
    name: 'The Skid Savior',
    subtitle: 'Over-Rotation & Correction-Pause-Recovery (C/P/R)',
    focus: 'Over-Rotation & C/P/R Sequence',
    targetMetric: 'CPR Recovery Success Rate: 100% / 0 Secondary Spins',
    prescribedCar: '2016 Dodge Viper ACR (High-Power RWD)',
    prescribedTrack: 'Sebring International Raceway (Turn 7 Focus)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 20,
    drivatars: 0,
    quote: '"The rotation begins to slow, then stops... This is the \'pause\' phase, your cue to start taking out the opposite lock." — Skip Barber (Page 64)',
    briefing: 'Intentionally induce over-rotation by trail-braking deep or popping off the brake at turn-in. Practice the strict three-step Correction, Pause, Recovery (CPR) sequence. You must wait for the rotation to halt during "The Pause" before unwinding opposite lock, avoiding fatal second-reaction tankslappers.',
    actionPlan: [
      'Step 1 (Correction): Apply swift opposite steering lock as the rear steps out.',
      'Step 2 (Pause): Hold the wheel steady at opposite lock during the "eye of the storm" as yaw velocity drops to zero.',
      'Step 3 (Recovery): Rapidly unwind the steering back to center as the car grips up, preventing reverse tankslappers.'
    ],
    hudWidgets: ['Yaw Angle Gauge (7°-10° Zone)', 'CPR Step-by-Step Tracker', 'Rotation Velocity (deg/s)', 'Front vs Rear Slip Angle Balance']
  },
  {
    id: 'stint-4-2',
    tier: 4,
    tierName: 'Tier 4: Mastering Car Control',
    tierShort: 'T4 // CAR CONTROL',
    name: 'The Throttle Squeeze',
    subtitle: 'Power Oversteer Prevention & Exit Drive Balance',
    focus: 'Throttle Rate-of-Change & Rear Slip Limit',
    targetMetric: 'Throttle Squeeze Distance: 50-60 ft / Rear Slip: <10°',
    prescribedCar: '2016 Dodge Viper ACR (High-Power RWD)',
    prescribedTrack: 'Sebring International Raceway (Carousel Focus)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 20,
    drivatars: 0,
    quote: '"The elapsed time through the turn was a tenth of a second slower... because you had to interrupt throttle application... reducing corner exit speed by 2 m.p.h." — Skip Barber (Page 67)',
    briefing: 'On corner exit through long sweepers (like Sebring\'s Carousel), avoid treating the throttle like an on/off switch. Stomping from 0% to 100% in 30 feet spikes rear slip angle to 16°, provoking severe power oversteer and costing exit speed. Squeeze power smoothly across 50-60 feet.',
    actionPlan: [
      'Progressively feed the throttle onto the rear axle as you unwind steering lock.',
      'Aim for a steady rear slip angle in the 7°-10° neutral grip envelope rather than snapping to 16°.',
      'Never force a lift-and-catch mid-exit — sustain progressive forward momentum to gain +2 mph exit speed.'
    ],
    hudWidgets: ['Throttle Squeeze Rate Gauge', 'Rear Slip Angle Spike Monitor', 'Exit Speed Delta (+MPH)', 'Throttle Squeeze Distance Bar']
  },
  {
    id: 'stint-4-3',
    tier: 4,
    tierName: 'Tier 4: Mastering Car Control',
    tierShort: 'T4 // CAR CONTROL',
    name: 'The Understeer Cure',
    subtitle: 'The "Breathe" Technique & Front Tire Loading',
    focus: 'Managing Understeer via Throttle Lift',
    targetMetric: 'Turn-In Throttle Breathe: 60-70% / 0 Lock Pinches',
    prescribedCar: '2016 Dodge Viper ACR (High-Power RWD)',
    prescribedTrack: 'Sebring International Raceway (Chicane / T2 Focus)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 20,
    drivatars: 0,
    quote: '"The technique... is to breathe the throttle just an instant before the turn... just enough to settle a little load onto the front tires." — Skip Barber (Page 68)',
    briefing: 'Approaching fast chicanes and bends at full throttle unloads the front tires and causes severe understeer. Adding more steering lock reduces grip further ("More Steering = Less Grip"). Train yourself to "breathe" the throttle to 60-70% at turn-in to transfer weight forward, then squeeze power back on.',
    actionPlan: [
      'Breathe the throttle to 60-70% an instant before turn-in to load the front tires.',
      'Resist the urge to turn the steering wheel further when the front end pushes wide.',
      'Once the nose bites and rotates, immediately feed throttle back to 100% down the ensuing chute.'
    ],
    hudWidgets: ['Front Tire Vertical Load %', 'Throttle Breathe Depth Meter', 'Steering Lock vs Grip Ratio', 'MORE STEERING = LESS GRIP Alert']
  },

  // --- TIER 5: BRAKING & ENTERING (THE ANALYTICAL BRAKER) ---
  {
    id: 'stint-5-1',
    tier: 5,
    tierName: 'Tier 5: Braking & Entering',
    tierShort: 'T5 // BRAKING',
    name: 'The Threshold Hunter',
    subtitle: 'Block 2: Straight-Line Deceleration & Ankle Modulation',
    focus: 'Threshold Modulation & Lockup Recovery',
    targetMetric: 'Modulation Pressure Drop: 30-40 lbs (140 -> 100 lbs) / 0 Panic Lifts',
    prescribedCar: '2014 BAC Mono',
    prescribedTrack: 'Sebring International Raceway (Full Circuit)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 15,
    drivatars: 0,
    quote: '"A lot of drivers forget that you are not locked into one level of pressure on the brake pedal... you can always pull back five per cent on the pedal and kind of float the entry speed." — Jeremy Dale (Page 79)',
    briefing: 'On the high-speed approach to Sebring\'s heavy braking zones, practice squeezing the brakes hard to find the threshold lockup point. When a lockup occurs, do not panic-lift to 0 lbs (which rebounds the chassis and destroys deceleration). Train subtle ankle and lower leg muscle tension to release just 30-40 lbs (from 140 down to 100 lbs) to keep the tires rolling at peak grip.',
    actionPlan: [
      'Execute a hard, instantaneous squeeze into the braking zone (transition in <0.35s) to load the front tires.',
      'Sustain pressure in the green Threshold Zone (125-140 lbs) right on the threshold of tire scrub.',
      'If lockup occurs, make a micro-modulation drop of 30-40 lbs via ankle tension rather than dumping pressure to 0 lbs.'
    ],
    hudWidgets: ['Brake Pressure & Modulation Gauge (0-140 lbs)', 'Threshold Zone Indicator (125-140 lbs)', 'Lockup & Recovery Delta (lbs)', 'Throttle-Brake Transition Timer (<0.35s)']
  },
  {
    id: 'stint-5-2',
    tier: 5,
    tierName: 'Tier 5: Braking & Entering',
    tierShort: 'T5 // BRAKING',
    name: 'The Trail-Braker',
    subtitle: 'Block 3: Brake-Turning & Friction Circle Grip Blending',
    focus: 'Trail-Braking & Traction Circle Quadrant',
    targetMetric: 'Brake-Turn Quadrant Grip Utilization: >75% / Smooth Decay',
    prescribedCar: '2014 BAC Mono',
    prescribedTrack: 'Sebring International Raceway (Full Circuit)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 15,
    drivatars: 0,
    quote: '"In a uniform brake modulation, you would release 20 lbs. of pressure each tenth of a second, going from 140 lbs. to 0 lbs. in a steady progression." — Skip Barber (Page 83)',
    briefing: 'Move beyond straight-line deceleration. Carry brake pressure past the turn-in point and blend braking force into cornering lateral grip. Use the Live 2D Friction Circle HUD to keep your tire grip trace traveling smoothly along the outer boundary of the top-right Brake-Turn quadrant, releasing ~20 lbs per tenth of a second until throttle pick-up.',
    actionPlan: [
      'Begin turn-in while maintaining trail-brake pressure rather than releasing the pedal in a straight line.',
      'Progressively bleed off brake pressure in direct proportion to steering angle increase (release 20 lbs per 0.10s).',
      'Keep the 2D Friction Circle trace on the outer grip envelope and manage "The Pause" before applying throttle.'
    ],
    hudWidgets: ['2D Live Friction Circle (Brake-Turn Trace)', 'Brake & Steering Blend Ratio', 'Trail-Brake Uniform Decay Rate', 'Brake-to-Throttle Pause Counter']
  },
  {
    id: 'stint-5-3',
    tier: 5,
    tierName: 'Tier 5: Braking & Entering',
    tierShort: 'T5 // BRAKING',
    name: 'The Procedure Driller',
    subtitle: 'Brake Point Precision & Jeremy Dale\'s 3-Ft Progression',
    focus: 'The Procedure & Brake Point vs Exit Speed',
    targetMetric: 'Brake Point Precision: ±3 ft Increments / 0 Delayed Throttle (TAP) Exits',
    prescribedCar: '2014 BAC Mono',
    prescribedTrack: 'Sebring International Raceway (Full Circuit)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 15,
    drivatars: 0,
    quote: '"The Procedure... 1) Identify the level of threshold braking... 2) Move the brake point down toward the corner in small increments (three feet at a time)... 3) If entry speed gets so high that... the throttle-application is delayed, move the brake point back." — Jeremy Dale (Page 76)',
    briefing: 'Master Jeremy Dale\'s "The Procedure". Begin with a safe, conservative brake point (50 ft early). Using threshold braking, move your brake point 3 feet closer each lap. Correlate your braking point with corner exit speed and throttle application timing (TAP). The moment braking deeper delays your throttle application and drops exit speed, you have discovered your car\'s true optimal brake point.',
    actionPlan: [
      'Establish a solid, repeatable visual reference marker (brake board/curb) on Lap 1.',
      'Advance the brake application point 3 feet closer each subsequent lap.',
      'Monitor Exit Speed Delta: if exit speed drops due to delayed throttle application, move the brake point back 3 feet.'
    ],
    hudWidgets: ['Brake Point Delta Meter (ft)', 'Exit Speed vs Baseline Correlator', '3-Ft Procedure Progression Tracker', 'Throttle Application Timing (TAP)']
  },

  // --- TIER 12: RACING IN THE RAIN (THE WET WEATHER ANALYST) ---
  {
    id: 'stint-12-1',
    tier: 12,
    tierName: 'Tier 12: Racing in the Rain',
    tierShort: 'T12 // WET RACING',
    name: 'The Visibility Drill',
    subtitle: 'Seeing in the Wet & Spray Following Distance',
    focus: 'Visibility Management & Spray Navigation',
    targetMetric: 'Visibility Score: 85%+ / Spray Distance: >2 Car Lengths',
    prescribedCar: '2014 BAC Mono',
    prescribedTrack: 'Lime Rock Park (Full Circuit)',
    gameType: 'Circuit Race / Wet Practice',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Heavy Rain (Wet Asphalt)',
    laps: 5,
    drivatars: 10,
    quote: '"Obviously, first and foremost, you can\'t control your car if you can\'t see where you\'re going. Maintaining the ability to see comes even before car changes as a priority in wet driving." — Skip Barber (Page 181)',
    briefing: 'In open-wheel cars, rooster tails of water hang in the air, creating severe blinding spray. Practice tracking apexes and brake boards through dense spray while managing your following distance. If your Visibility Score drops below 50%, drop back 2 car lengths or move offline to find clean air.',
    actionPlan: [
      'Look far ahead through the rooster tails to spot brake markers before you arrive at turn-in.',
      'Drop back 2-3 car lengths in traffic to elevate your real-time Visibility Score.',
      'If the POOR VISIBILITY alert flashes, back off immediately and adjust your slot position.'
    ],
    hudWidgets: ['Visibility Score Meter (0-100%)', 'Spray Density & Following Distance', 'Visor Anti-Fog / Ventilation Status', 'POOR VISIBILITY Safety Alert']
  },
  {
    id: 'stint-12-2',
    tier: 12,
    tierName: 'Tier 12: Racing in the Rain',
    tierShort: 'T12 // WET RACING',
    name: 'The Rim Shot Hunter',
    subtitle: 'Rain Line Selection & The Outside Rim Arc',
    focus: 'The Rim Shot vs Polished Dry Line',
    targetMetric: 'Rim Shot Grip Delta: +42% Grip (0.85G vs 0.60G) / +3.0+ MPH Exit Speed',
    prescribedCar: '2014 BAC Mono',
    prescribedTrack: 'Lime Rock Park (Full Circuit)',
    gameType: 'Circuit Race / Wet Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Heavy Rain (Wet Asphalt)',
    laps: 5,
    drivatars: 10,
    quote: '"The average lap time around the outside was eight seconds per lap faster... the cornering force available on the dry line was in the neighborhood of .6 Gs. On the outside, the G readings were in the vicinity of .85 Gs, some 42% better." — Skip Barber (Page 186-187)',
    briefing: 'The traditional rubbered-in dry line becomes an ice rink when wet as oil, rubber, and water create a polished surface. Hunt for grip on the unpolished, porous asphalt on the outside of Lime Rock\'s sweepers (The Big Bend, West Bend, and Downhill). Ride the rim shot line and verify higher corner exit speeds on your HUD.',
    actionPlan: [
      'Steer clear of the shiny, polished rubber line on turn-in and mid-corner sweepers.',
      'Drive wide on the porous outside rim where traction readings jump from 0.60G to 0.85G.',
      'Check the Corner Exit Speed Delta at West Bend to confirm the compounding 8-second lap time advantage.'
    ],
    hudWidgets: ['Rain Line Advisor (Rim Shot vs Dry Line)', 'Grip Surface Indicator (Glossy vs Dull Gray)', 'Exit Speed Delta (+MPH)', 'Lateral Grip Multiplier (0.85G vs 0.60G)']
  },
  {
    id: 'stint-12-3',
    tier: 12,
    tierName: 'Tier 12: Racing in the Rain',
    tierShort: 'T12 // WET RACING',
    name: 'The Squaring-Off Artist',
    subtitle: 'Wet Cornering Technique & Reduced Traction Budget',
    focus: 'Squaring Off Corners & Anti-Wheelspin Throttle',
    targetMetric: 'Late Turn-In & Early Straight Drive / 0 Wheelspin Events / 0 TTO Snaps',
    prescribedCar: '2014 BAC Mono',
    prescribedTrack: 'Lime Rock Park (Full Circuit)',
    gameType: 'Circuit Race / Wet Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Heavy Rain (Wet Asphalt)',
    laps: 5,
    drivatars: 10,
    quote: '"You would do this by trying to square off the corners—that is, turn later at a slower speed and get the car pointing as straight as possible as early as possible... tires lose more cornering ability in the wet than braking or accelerating grip." — Skip Barber (Page 187)',
    briefing: 'Rain reduces cornering grip by 50%, while braking and straight acceleration lose only ~36%. Capitalize on this asymmetry: square off tight corners by turning in later, rotating sharply at lower speed, and pointing the car straight early so you can deploy straight-line acceleration without breaking rear tire traction.',
    actionPlan: [
      'Over-slow entry and delay turn-in to achieve a pointed, straight vehicle heading early.',
      'Squeeze the throttle smoothly once straight — avoid abrupt stomps that trigger wheelspin.',
      'Monitor the Wet Traction Circle on the HUD to respect the reduced 50% lateral grip boundary.'
    ],
    hudWidgets: ['Squaring-Off Trajectory Angle Indicator', '2D Wet Traction Circle (50% Lat vs 64% Long)', 'Throttle Progressive Squeeze & Anti-Wheelspin', 'Trailing Throttle Oversteer (TTO) Alert']
  }
];

export class StintsManager {
  constructor() {
    this.stints = STINTS_DATABASE;
    this.selectedStintId = 'stint-1-1';
    this.activeFilter = 'all'; // 'all' | '1' | '2' | '3'
    this.isStintActive = false;

    this.liveHud = new LiveHudRenderer('stint-active-hud-stage');

    // DOM Elements
    this.viewStints = document.getElementById('view-stints');
    this.btnNavStints = document.getElementById('btn-nav-stints');
    this.btnReturnPitwall = document.getElementById('btn-return-pitwall-from-stints');

    this.stintsListContainer = document.getElementById('stints-list-container');
    this.stintBriefingStage = document.getElementById('stint-briefing-stage');
    this.stintActiveHudStage = document.getElementById('stint-active-hud-stage');
    this.stintsCountBadge = document.getElementById('stints-count-badge');
    this.filterPills = document.querySelectorAll('.stint-filter-pill');

    // Debrief Modal Elements
    this.debriefModal = document.getElementById('stint-debrief-modal');
    this.btnCloseDebrief = document.getElementById('btn-close-stint-debrief');
    this.btnDebriefRetry = document.getElementById('btn-debrief-retry');
    this.btnDebriefDownloadPdf = document.getElementById('btn-debrief-download-pdf');

    this.lastStintEvaluation = null;
    this.lastStintRef = null;
    this.lastStintSamples = [];

    this.init();
  }

  init() {
    this.bindEvents();
    this.renderStintList();
    this.renderSelectedStintDossier();
  }

  bindEvents() {
    // Navigation Toggles
    if (this.btnReturnPitwall) {
      this.btnReturnPitwall.addEventListener('click', () => {
        if (window.apexApp && typeof window.apexApp.switchView === 'function') {
          window.apexApp.switchView('pitwall');
        }
      });
    }

    // Filter pills
    if (this.filterPills) {
      this.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
          this.filterPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeFilter = pill.dataset.filter || 'all';
          this.renderStintList();
        });
      });
    }

    // Debrief Modal Actions
    if (this.btnCloseDebrief) {
      this.btnCloseDebrief.addEventListener('click', () => {
        this.closeDebriefModal();
      });
    }

    if (this.btnDebriefRetry) {
      this.btnDebriefRetry.addEventListener('click', () => {
        this.closeDebriefModal();
        this.startStint();
      });
    }

    if (this.btnDebriefDownloadPdf) {
      this.btnDebriefDownloadPdf.addEventListener('click', () => {
        if (!this.lastStintSamples || this.lastStintSamples.length === 0 || !this.lastStintEvaluation?.hasTelemetry) {
          alert('⚠️ Cannot generate PDF: No telemetry data was recorded for this stint.\n\nPlease connect the APEX telemetry bridge and drive on track.');
          return;
        }
        if (this.lastStintRef && this.lastStintEvaluation) {
          PdfReportGenerator.generateStintReport(this.lastStintRef, this.lastStintEvaluation, this.lastStintSamples);
        }
      });
    }
  }

  onViewOpened() {
    this.renderStintList();
    this.renderSelectedStintDossier();
  }

  getSelectedStint() {
    return this.stints.find(s => s.id === this.selectedStintId) || this.stints[0];
  }

  selectStint(stintId) {
    this.selectedStintId = stintId;
    // Always return to the Briefing Dossier when jumping between stints
    if (this.isStintActive) {
      this.isStintActive = false;
      if (this.liveHud) {
        this.liveHud.cancelStint();
      }
    }
    this.renderStintList();
    this.renderSelectedStintDossier();
  }

  renderStintList() {
    if (!this.stintsListContainer) return;
    this.stintsListContainer.innerHTML = '';

    const filtered = this.stints.filter(s => {
      if (this.activeFilter === 'all') return true;
      return s.tier.toString() === this.activeFilter;
    });

    if (this.stintsCountBadge) {
      this.stintsCountBadge.textContent = `${filtered.length} MODULE${filtered.length === 1 ? '' : 'S'}`;
    }

    filtered.forEach(stint => {
      const isSelected = stint.id === this.selectedStintId;
      const card = document.createElement('div');
      card.className = `stint-card-item chamfer-all-corners ${isSelected ? 'active' : ''}`;
      
      card.innerHTML = `
        <div class="stint-card-top">
          <span class="stint-tier-tag tier-tag-${stint.tier}">${stint.tierShort}</span>
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-muted);">${stint.laps} LAPS</span>
        </div>
        <div style="font-family: var(--font-display); font-size: 14px; font-weight: 700; color: ${isSelected ? 'var(--color-gold)' : 'var(--color-text-primary)'}; margin-bottom: 3px;">
          ${stint.name}
        </div>
        <div style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.3; margin-bottom: 6px;">
          ${stint.focus}
        </div>
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 5px;">
          <span>🏎️ ${stint.prescribedCar.split(' ')[1] || 'Car'}</span>
          <span>📍 ${stint.prescribedTrack.split(' ')[0] || 'Track'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectStint(stint.id);
      });

      this.stintsListContainer.appendChild(card);
    });
  }

  renderSelectedStintDossier() {
    if (!this.stintBriefingStage) return;
    const stint = this.getSelectedStint();
    if (!stint) return;

    // If stint is actively running, show HUD stage; otherwise show Briefing stage
    if (this.isStintActive) {
      this.stintBriefingStage.style.display = 'none';
      this.stintActiveHudStage.style.display = 'flex';
      return;
    }

    this.stintBriefingStage.style.display = 'flex';
    this.stintActiveHudStage.style.display = 'none';

    this.stintBriefingStage.innerHTML = `
      <div class="pit-card-header" style="margin-bottom: 4px;">
        <div class="pit-card-title-group">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="stint-tier-tag tier-tag-${stint.tier}">${stint.tierName}</span>
            <span class="badge" style="background: rgba(255,215,0,0.1); border: 1px solid var(--color-gold); color: var(--color-gold); font-family: var(--font-mono); font-size: 10px;">${stint.targetMetric}</span>
          </div>
          <h2 class="pit-card-title" style="font-size: 22px; color: var(--color-text-primary); letter-spacing: 1px;">
            ${stint.name} // <span style="color: var(--color-gold);">${stint.subtitle}</span>
          </h2>
          <span class="pit-card-subtitle" style="font-size: 12px; margin-top: 4px;">Core Skill Discipline: <strong>${stint.focus}</strong></span>
        </div>
      </div>

      <!-- Coach Directive & Quote -->
      <div class="guide-step-card chamfer-all-corners" style="background: #111111; border-left: 3px solid var(--color-gold); padding: 14px 16px;">
        <div style="font-size: 10px; font-weight: 700; color: var(--color-gold); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px;">
          📖 Skip Barber "Going Faster!" Master Racecraft Principle
        </div>
        <div style="font-family: var(--font-mono); font-size: 11.5px; color: var(--color-text-primary); line-height: 1.5; font-style: italic;">
          ${stint.quote}
        </div>
      </div>

      <!-- Session Parameters Grid (Enforced Prescribed Settings) -->
      <div class="pit-card-header" style="margin-top: 10px; margin-bottom: 4px;">
        <h3 class="pit-card-title" style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-secondary);">
          🔒 Prescribed Xbox Forza Motorsport Session Configuration
        </h3>
      </div>
      <div class="delta-summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-sm); margin-bottom: var(--space-sm);">
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Prescribed Vehicle</span>
          <span class="stat-cell-value" style="font-size: 12px; color: var(--color-gold);">${stint.prescribedCar}</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Circuit / Layout</span>
          <span class="stat-cell-value" style="font-size: 12px; color: var(--color-text-primary);">${stint.prescribedTrack}</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Session Format</span>
          <span class="stat-cell-value" style="font-size: 12px;">${stint.gameType} (${stint.laps} Laps)</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Weather & Time of Day</span>
          <span class="stat-cell-value" style="font-size: 12px;">${stint.weather} · ${stint.timeOfDay}</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Drivatar Traffic</span>
          <span class="stat-cell-value" style="font-size: 12px; color: var(--color-success);">${stint.drivatars} AI (Solitary Learning)</span>
        </div>
      </div>

      <!-- Detailed Practice Briefing -->
      <div class="pit-card-header" style="margin-top: 10px; margin-bottom: 4px;">
        <h3 class="pit-card-title" style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-secondary);">
          🎯 Tactical Briefing & Stepping Stone Objectives
        </h3>
      </div>
      <p style="font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.6; margin: 0;">
        ${stint.briefing}
      </p>

      <ul style="margin: 6px 0 12px 18px; padding: 0; font-size: 12px; color: var(--color-text-muted); line-height: 1.7;">
        ${stint.actionPlan.map(item => `<li>${item}</li>`).join('')}
      </ul>

      <!-- HUD Widgets Breakdown -->
      <div style="background: #0D0D0D; border: 1px solid var(--color-border); padding: 12px 14px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-muted); text-transform: uppercase; display: block; margin-bottom: 3px;">Active Live HUD Cockpit Widgets (Tier ${stint.tier}):</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${stint.hudWidgets.map(w => `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--color-text-secondary); font-size: 10px;">${w}</span>`).join('')}
          </div>
        </div>

        <button id="btn-launch-stint" class="btn btn-primary chamfer-br" style="height: 46px; padding: 0 24px; font-size: 13px; font-weight: 700;">
          <span>🚀</span> LAUNCH LIVE COCKPIT HUD
        </button>
      </div>
    `;

    const btnLaunch = document.getElementById('btn-launch-stint');
    if (btnLaunch) {
      btnLaunch.addEventListener('click', () => {
        this.startStint();
      });
    }
  }

  updateTelemetry(sample) {
    if (this.liveHud) {
      this.liveHud.update(sample);
    }
  }

  startStint() {
    const stint = this.getSelectedStint();
    if (!stint) return;

    this.isStintActive = true;
    this.stintBriefingStage.style.display = 'none';
    this.stintActiveHudStage.style.display = 'flex';

    this.liveHud.startStint(stint, (evaluation, stintRef, samples) => {
      this.handleStintComplete(evaluation, stintRef, samples);
    });
  }

  stopStint() {
    this.isStintActive = false;
    this.liveHud.stopStint();
    this.renderSelectedStintDossier();
  }

  handleStintComplete(evaluation, stintRef, samples) {
    this.isStintActive = false;
    if (!evaluation || !evaluation.hasTelemetry || !samples || samples.length === 0) {
      this.renderSelectedStintDossier();
      alert('⚠️ No live telemetry data was received during this stint.\n\nPlease ensure Forza Motorsport is streaming UDP telemetry to 127.0.0.1:9999 and the APEX bridge is running.');
      return;
    }

    this.lastStintEvaluation = evaluation;
    this.lastStintRef = stintRef;
    this.lastStintSamples = samples || [];

    this.renderSelectedStintDossier();
    this.openDebriefModal(evaluation, stintRef);
  }

  openDebriefModal(evaluation, stint) {
    if (!this.debriefModal || !evaluation) return;

    const elSub = document.getElementById('debrief-stint-subtitle');
    if (elSub) elSub.textContent = `${stint.tierName.toUpperCase()} // ${stint.name.toUpperCase()}`;

    // Letter Grade Badge
    const elLetter = document.getElementById('debrief-letter-grade');
    if (elLetter) {
      elLetter.textContent = evaluation.letterGrade || 'A';
      elLetter.style.color = evaluation.gradeColor || 'var(--color-gold)';
      elLetter.style.textShadow = `0 0 16px ${evaluation.gradeColor || 'rgba(255,215,0,0.4)'}`;
    }

    const elGrade = document.getElementById('debrief-grade-val');
    if (elGrade) elGrade.textContent = `${evaluation.gradeScore}% Composite`;

    const elMastery = document.getElementById('debrief-mastery-label');
    if (elMastery) {
      elMastery.textContent = evaluation.masteryLabel;
      elMastery.style.color = evaluation.gradeColor || (evaluation.targetAchieved ? 'var(--color-success)' : 'var(--color-gold)');
    }

    const elGate = document.getElementById('debrief-stint-gate-status');
    if (elGate) {
      if (evaluation.scorecard?.isCapped) {
        elGate.textContent = `⚠️ Capped: ${evaluation.scorecard.capReason}`;
        elGate.style.color = 'var(--color-f1-red)';
      } else {
        elGate.textContent = 'Formula: 50% Disc + 30% Smooth + 20% Pace';
        elGate.style.color = 'var(--color-text-muted)';
      }
    }

    const elMetricLabel = document.getElementById('debrief-metric-label');
    if (elMetricLabel) elMetricLabel.textContent = evaluation.primaryMetricLabel || 'Target Metric';

    const elMetricVal = document.getElementById('debrief-metric-val');
    if (elMetricVal) elMetricVal.textContent = evaluation.primaryMetricValue || 'Evaluated';

    const elLaps = document.getElementById('debrief-laps-summary');
    if (elLaps) elLaps.textContent = `${evaluation.telemetryKPIs.totalLaps} Laps • Peak: ${evaluation.telemetryKPIs.peakSpeedMph} MPH (${evaluation.telemetryKPIs.peakLatG}G)`;

    // Populate Telemetry Scorecard
    const sc = evaluation.scorecard;
    if (sc) {
      const elDiscPts = document.getElementById('scorecard-discipline-pts');
      if (elDiscPts) elDiscPts.textContent = `${sc.discipline.weightedPoints} / 50 PTS`;

      const elDiscName = document.getElementById('scorecard-discipline-name');
      if (elDiscName) elDiscName.textContent = sc.discipline.name || 'Discipline Metric';

      const elDiscVal = document.getElementById('scorecard-discipline-val');
      if (elDiscVal) elDiscVal.textContent = sc.discipline.value || `${sc.discipline.score}% Adherence`;

      const elSmoothPts = document.getElementById('scorecard-smoothness-pts');
      if (elSmoothPts) elSmoothPts.textContent = `${sc.smoothness.weightedPoints} / 30 PTS`;

      const elSmoothEvents = document.getElementById('scorecard-smoothness-events');
      if (elSmoothEvents) {
        elSmoothEvents.textContent = `${sc.smoothness.ttoEvents} TTO Chops • ${sc.smoothness.lockupEvents} Lockups • ${sc.smoothness.steeringOscillations} Snaps`;
      }

      const elPacePts = document.getElementById('scorecard-pace-pts');
      if (elPacePts) elPacePts.textContent = `${sc.pace.weightedPoints} / 20 PTS`;

      const elPaceSummary = document.getElementById('scorecard-pace-summary');
      if (elPaceSummary) {
        elPaceSummary.textContent = `${sc.pace.totalLaps}/${sc.pace.prescribedLaps} Laps (${sc.pace.validFlyingSamples || 0} Flying Pkts) • ${sc.pace.avgSpeedMph} MPH Avg`;
      }
    }

    const elNailed = document.getElementById('debrief-nailed-list');
    if (elNailed) {
      elNailed.innerHTML = (evaluation.nailed || []).map(item => `<li>${item}</li>`).join('');
    }

    const elRefinement = document.getElementById('debrief-refinement-list');
    if (elRefinement) {
      elRefinement.innerHTML = (evaluation.refinement || []).map(item => `<li>${item}</li>`).join('');
    }

    const elAttention = document.getElementById('debrief-attention-list');
    if (elAttention) {
      elAttention.innerHTML = (evaluation.attention || []).map(item => `<li>${item}</li>`).join('');
    }

    this.debriefModal.classList.add('active');
  }

  closeDebriefModal() {
    if (this.debriefModal) {
      this.debriefModal.classList.remove('active');
    }
  }
}

