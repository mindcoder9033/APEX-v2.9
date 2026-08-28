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
    name: 'The Pathfinder',
    subtitle: 'Geometric Path & Maximum Radius (R3)',
    focus: 'The Racing Line (Finding the Line)',
    targetMetric: 'Line Adherence Score: 90%+',
    prescribedCar: '2019 Aston Martin Vantage',
    prescribedTrack: 'Sebring International Raceway',
    gameType: 'Timed Practice / Circuit Session',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 10,
    drivatars: 0,
    quote: '"The first subject a racer needs to learn about is \'the line,\' since it has such a great effect on both cornering speed and straightaway speed." — Skip Barber (Page 18)',
    briefing: 'Learn the fastest path around the circuit by mastering the largest possible radius arc (R3). Drive at a disciplined 6/10ths pace to visually cement your turn-in, apex clipping point, and track-out mark. Do not rush into threshold braking or maximum attack speed.',
    actionPlan: [
      'Focus purely on matching the geometric radius without abrupt steering corrections.',
      'Touch the inside edge of the road halfway through the turn, and track out to the outer white line at corner exit.',
      'Maintain steady mid-corner balance rather than attacking the corner entry.'
    ],
    hudWidgets: ['Driving Line Score', 'Sector Mini-Map', 'Trajectory Adherence Bar', 'Telemetry Ping']
  },
  {
    id: 'stint-1-2',
    tier: 1,
    tierName: 'Tier 1: Fundamentals',
    tierShort: 'T1 // FUNDAMENTALS',
    name: 'Exit Speed Expert',
    subtitle: 'Corner Exit Speed & Drive to the Straight',
    focus: 'Throttle Timing & Unwinding Steering',
    targetMetric: 'Exit Speed Delta: +2.0 MPH (+0.16s straightaway gain)',
    prescribedCar: '2019 Aston Martin Vantage',
    prescribedTrack: 'Sebring International Raceway',
    gameType: 'Timed Practice / Circuit Session',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 10,
    drivatars: 0,
    quote: '"It\'s much more important to get to your throttle application point at the appropriate speed and experiment with driving the car faster and faster through the last half of the corner, under power." — Bryan Herta (Page 10)',
    briefing: 'Corner exit speed dictates the entire velocity profile of the succeeding straightaway. Gaining just 2 mph at the apex exit compounds to over a tenth and a half along a 1/2 mile straight. Train progressive throttle application while unwinding the steering lock.',
    actionPlan: [
      'Locate your Throttle Application Point (TAP) before the geometric apex.',
      'Squeeze the throttle progressively as you unwind the steering wheel.',
      'Monitor your Corner Exit Speed Delta on the HUD — aim for positive delta on every corner exit.'
    ],
    hudWidgets: ['Corner Exit Speed Delta', 'Throttle Application Timing (TAP)', 'Exit Speed Target Gauge', 'Straightaway Projected Gain']
  },
  {
    id: 'stint-1-3',
    tier: 1,
    tierName: 'Tier 1: Fundamentals',
    tierShort: 'T1 // FUNDAMENTALS',
    name: 'The Brake & Turn Maestro',
    subtitle: 'Trail Braking Transition & Friction Allocation',
    focus: 'Brake & Turn Blending (Trail Braking)',
    targetMetric: 'Brake & Turn G-Friction Blending: 80% / 20% Ratio',
    prescribedCar: '2019 Aston Martin Vantage',
    prescribedTrack: 'Sebring International Raceway (Hairpin Focus)',
    gameType: 'Timed Practice / Circuit Session',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Asphalt)',
    laps: 10,
    drivatars: 0,
    quote: '"By continuing to brake and turn into the corner... you can average 55 across the same stretch of track, rather than 53 when you were only braking on a straight line. The lap time... .24 seconds less." — Danny Sullivan (Page 9)',
    briefing: 'Transition from pure straight-line threshold braking into simultaneous braking and steering. Trade braking traction for lateral cornering grip continuously along the tire friction boundary.',
    actionPlan: [
      'Execute maximum straight-line threshold braking up to the turn-in point.',
      'As steering angle increases, smoothly taper off brake pressure (80% brake / 20% steer -> 50/50 -> 20/80).',
      'Avoid abrupt off-brake snaps which destabilize the rear axle and trigger trailing-throttle oversteer.'
    ],
    hudWidgets: ['Brake & Turn G-Meter', 'Traction Circle HUD', 'Trail-Brake Decay Rate', 'Deceleration Efficiency Gauge']
  },

  // --- TIER 2: PHYSICS & VEHICLE DYNAMICS ---
  {
    id: 'stint-2-1',
    tier: 2,
    tierName: 'Tier 2: Physics',
    tierShort: 'T2 // DYNAMICS',
    name: 'The Line Hunter',
    subtitle: 'Late Apex Strategy & Arc Radius Optimization (15GR = mph²)',
    focus: 'Constant Radius vs Late Apexing',
    targetMetric: 'Realized Arc Radius: 195 ft (Sebring T7 Baseline)',
    prescribedCar: '2020 Chevrolet Corvette Stingray (C8 Mid-Engine)',
    prescribedTrack: 'Sebring International Raceway (Full Circuit)',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Track)',
    laps: 12,
    drivatars: 0,
    quote: '"To find out how much faster you can go through Turn 7 on the right line... the radius of the arc that represents the racing line... is a whopping 195 feet. That\'s 89% bigger than the inside arc." (Page 19)',
    briefing: 'Tire lateral grip obeys 15GR = mph². A wider radius arc allows mathematically higher speed for the exact same cornering G-load. Early apexing shrinks the radius and forces panic steering corrections.',
    actionPlan: [
      'Overrule your early-turn instinct: turn in later than your eye initially suggests.',
      'Keep steering angle steady through the mid-corner to maintain a clean 195 ft radius.',
      'Check the Live Arc Radius gauge and Apex Predictor to catch early turn-in errors.'
    ],
    hudWidgets: ['Arc Radius Gauge (ft/m)', 'Apex Predictor (Early / Late)', 'Radius Expansion Delta', 'Tire G-Load Limit']
  },
  {
    id: 'stint-2-2',
    tier: 2,
    tierName: 'Tier 2: Physics',
    tierShort: 'T2 // DYNAMICS',
    name: 'The Throttle Squeeze',
    subtitle: 'Dynamic Weight Transfer & Trailing Throttle Oversteer',
    focus: 'Throttle Modulation & Chassis Balance',
    targetMetric: 'Throttle Rate-of-Change Smoothness & 0 TTO Snap Events',
    prescribedCar: '2020 Chevrolet Corvette Stingray (C8 Mid-Engine)',
    prescribedTrack: 'Sebring International Raceway',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Track)',
    laps: 12,
    drivatars: 0,
    quote: '"A gradual increase in throttle will tend to create understeer. An abrupt application of throttle will tend to create oversteer... Lifting off while near the limit creates oversteer in direct proportion to the severity of the lift." (Page 27)',
    briefing: 'Understand how throttle inputs shift vertical load between the front and rear tire contact patches. Learn to "dance on the throttle" and execute Countersteer-Pause-Recovery (CPR) without provoking secondary tankslappers.',
    actionPlan: [
      'Never chop or lift throttle abruptly at peak mid-corner lateral loading.',
      'Squeeze the throttle progressively to settle the rear tires and produce stable forward drive.',
      'Monitor the Throttle Balance Dial on your Live Cockpit HUD.'
    ],
    hudWidgets: ['Throttle Balance Dial', 'Oversteer / Understeer Balance Index', 'Throttle Squeeze Smoothness Gauge', 'Axle Weight Bias Readout']
  },
  {
    id: 'stint-2-3',
    tier: 2,
    tierName: 'Tier 2: Physics',
    tierShort: 'T2 // DYNAMICS',
    name: 'The Brake Maestro',
    subtitle: 'Threshold Deceleration & Peak Grip Maintenance',
    focus: 'Threshold Braking & Lockup Prevention',
    targetMetric: 'Deceleration Time: 6.36s (157 mph to 54 mph) / Peak G: >1.25G',
    prescribedCar: '2020 Chevrolet Corvette Stingray (C8 Mid-Engine)',
    prescribedTrack: 'Sebring International Raceway',
    gameType: 'Circuit Race / Solitary Testing',
    timeOfDay: 'Late Morning (10:00 AM)',
    weather: 'Clear (Dry Track)',
    laps: 12,
    drivatars: 0,
    quote: '"The goal is to stay at this maximum traction point... at a particular level of pressure on the brake pedal you\'re right there at the peak. We call it the threshold." (Page 30)',
    briefing: 'Hit the brake pedal with immediate, assertive pressure, then modulate right on the edge of tire scrub before wheel lockup or ABS intervention. Maximize deceleration while maintaining car directional control.',
    actionPlan: [
      'Initial brake strike must be instant to transfer load onto the front contact patches.',
      'Bleed off pressure slightly as aerodynamic downforce decays with slowing speed.',
      'Watch the Brake Performance Pulse bar on the HUD — avoid the flashing red lockup zone.'
    ],
    hudWidgets: ['Brake Performance Pulse', 'Threshold Pressure Efficiency %', 'Deceleration G-Meter', 'Front/Rear Brake Bias Readout']
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

    this.liveHud.startStint(stint, () => {
      this.stopStint();
    });
  }

  stopStint() {
    this.isStintActive = false;
    this.liveHud.stopStint();
    this.renderSelectedStintDossier();
  }
}
