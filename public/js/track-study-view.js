/**
 * APEX Track Study View Controller
 * Manages the interactive 5-Phase Track Study tab & pre-stint briefing workflow.
 * Rooted in "Going Faster! Mastering the Art of Race Driving"
 */

import { TrackStudyEngine } from './analysis/track-study-engine.js';
import { TrackStudyPdfBuilder } from './track-study-pdf-builder.js';
import { trackLibraryStore } from './track-library-store.js';

export class TrackStudyView {
  constructor() {
    this.engine = new TrackStudyEngine();
    this.pdfBuilder = new TrackStudyPdfBuilder();
    
    this.currentPhase = 1; // 1 to 5
    this.selectedCornerNumber = 1;
    this.activeCornerNumber = null;
    this.currentTrackProfile = null;
    this.studyData = null;
    this.liveTelemetryActive = false;
    this.hasNotifiedLiveSync = false;
    this.reviewedPhases = new Set([1]);
    this.hasCompletedBriefing = false;

    this.container = null;
  }

  /**
   * Initializes DOM bindings, track selector, stepper tabs, and PDF export
   */
  init() {
    this.container = document.getElementById('view-track-study');
    if (!this.container) return;

    this._bindEvents();
    this._loadInitialTrack();
    this.updateReadinessMeter();
  }

  _bindEvents() {
    // Stepper buttons
    const stepBtns = this.container.querySelectorAll('.study-step-btn');
    stepBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const step = parseInt(btn.dataset.step, 10);
        if (step >= 1 && step <= 5) {
          this.setPhase(step);
        }
      });
    });

    // Track Profile Dropdown Selector
    const trackSelect = this.container.querySelector('#study-track-selector');
    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        const trackId = e.target.value;
        this.loadTrackById(trackId);
      });
    }

    // PDF Export Button
    const btnExport = this.container.querySelector('#btn-study-export-pdf');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.exportDossierPdf();
      });
    }

    // Refresh / Live Ingest Button
    const btnRefresh = this.container.querySelector('#btn-study-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this._loadInitialTrack();
        if (window.PitToast) {
          window.PitToast.info('Track Study profiles reloaded from library', 'CIRCUIT SYNC');
        }
      });
    }
  }

  _loadInitialTrack() {
    const tracks = trackLibraryStore.getAllTracks();
    const trackSelect = this.container?.querySelector('#study-track-selector');
    
    if (trackSelect && tracks.length > 0) {
      trackSelect.innerHTML = '';
      tracks.forEach((t, i) => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.trackName || t.name} (${t.layoutName || t.layout || 'Full'})`;
        if (i === 0) opt.selected = true;
        trackSelect.appendChild(opt);
      });
      this.loadTrackById(tracks[0].id, false);
    } else {
      // Fallback synthetic track (e.g. Sebring Grand Prix)
      const fallbackProfile = {
        id: 'sebring-test-circuit',
        trackName: 'Sebring International Raceway',
        layoutName: '12-Hour Course',
        officialLength: '6.019 km',
        lengthMeters: 6019,
        turnsCount: 17,
        corners: [
          { number: 1, name: 'Turn 1 (Fast Sweeper)', radius: 190, angleDeg: 55, entrySpeedMps: 42, minSpeedMps: 38, exitSpeedMps: 45, gear: 4, followingStraightMeters: 450, camberDeg: 1.0, elevationChangeM: 0, brakingDistanceM: 40 },
          { number: 2, name: 'Turn 2', radius: 140, angleDeg: 40, entrySpeedMps: 40, minSpeedMps: 37, exitSpeedMps: 43, gear: 4, followingStraightMeters: 180, camberDeg: 3.5, elevationChangeM: 0, brakingDistanceM: 20 },
          { number: 3, name: 'Turn 3 (Hairpin Right)', radius: 45, angleDeg: 100, entrySpeedMps: 32, minSpeedMps: 18, exitSpeedMps: 28, gear: 2, followingStraightMeters: 400, camberDeg: 0.5, elevationChangeM: 0, brakingDistanceM: 70 },
          { number: 7, name: 'Turn 7 (90-deg Right)', radius: 60, angleDeg: 90, entrySpeedMps: 35, minSpeedMps: 22, exitSpeedMps: 30, gear: 2, followingStraightMeters: 160, camberDeg: 1.5, elevationChangeM: 0, brakingDistanceM: 55 },
          { number: 8, name: 'Turn 8 (Compromise Right)', radius: 75, angleDeg: 45, entrySpeedMps: 36, minSpeedMps: 32, exitSpeedMps: 35, gear: 3, followingStraightMeters: 60, camberDeg: 0.0, elevationChangeM: 0, brakingDistanceM: 15 },
          { number: 9, name: 'Turn 9 (The Carousel)', radius: 130, angleDeg: 110, entrySpeedMps: 38, minSpeedMps: 27, exitSpeedMps: 36, gear: 3, followingStraightMeters: 680, camberDeg: 2.0, elevationChangeM: 0, brakingDistanceM: 45 },
          { number: 10, name: 'Turn 10 (Hairpin)', radius: 35, angleDeg: 140, entrySpeedMps: 48, minSpeedMps: 15, exitSpeedMps: 24, gear: 2, followingStraightMeters: 550, camberDeg: 0.0, elevationChangeM: 0, brakingDistanceM: 95 }
        ]
      };
      this.setTrackProfile(fallbackProfile, [], false);
    }
  }

  loadTrackById(trackId, notify = true) {
    const track = trackLibraryStore.getTrackById(trackId);
    if (track) {
      this.setTrackProfile(track, [], notify);
    }
  }

  setTrackProfile(trackProfile, telemetrySamples = [], notify = true) {
    this.currentTrackProfile = trackProfile;
    try {
      this.studyData = this.engine.generateStudy(trackProfile, telemetrySamples);
      this.render();

      if (notify && window.PitToast) {
        const trackName = trackProfile.trackName || trackProfile.name || 'Circuit';
        const turns = trackProfile.turnsCount || this.studyData?.circuit?.turnsCount || 'Multi';
        window.PitToast.info(`Loaded ${trackName} (${turns} Turns)`, 'TRACK STUDY READY');
      }
    } catch (err) {
      console.error('[TrackStudyView] Error generating study data:', err);
    }
  }

  updateReadinessMeter() {
    if (!this.container) return;
    const reviewedCount = this.reviewedPhases.size;
    const pct = Math.round((reviewedCount / 5) * 100);

    const badge = this.container.querySelector('#study-readiness-badge');
    if (badge) badge.textContent = `${pct}% (${reviewedCount}/5)`;

    const fill = this.container.querySelector('#study-readiness-fill');
    if (fill) fill.style.width = `${pct}%`;

    // Update checkmark state on stepper buttons
    const stepBtns = this.container.querySelectorAll('.study-step-btn');
    stepBtns.forEach(btn => {
      const step = parseInt(btn.dataset.step, 10);
      btn.classList.toggle('reviewed', this.reviewedPhases.has(step));
    });

    // Notify upon 100% completion
    if (pct === 100 && !this.hasCompletedBriefing) {
      this.hasCompletedBriefing = true;
      if (window.PitToast) {
        window.PitToast.success('All 5 Study Phases Reviewed // Pre-Stint Preparation Complete!', 'BRIEFING READY');
      }
    }
  }

  setPhase(stepNumber) {
    this.currentPhase = stepNumber;
    this.reviewedPhases.add(stepNumber);
    
    // Update Stepper active state & checkmarks
    const stepBtns = this.container.querySelectorAll('.study-step-btn');
    stepBtns.forEach(btn => {
      const step = parseInt(btn.dataset.step, 10);
      btn.classList.toggle('active', step === this.currentPhase);
      btn.classList.toggle('reviewed', this.reviewedPhases.has(step));
    });

    this.updateReadinessMeter();
    this.render();
  }

  setSelectedCorner(cornerNumber) {
    this.selectedCornerNumber = cornerNumber;
    this.renderCornerDetail();
  }

  render() {
    if (!this.studyData || !this.container) return;

    // Header Meta
    const titleEl = this.container.querySelector('#study-circuit-title');
    if (titleEl) titleEl.textContent = this.studyData.circuit.name.toUpperCase();

    const subEl = this.container.querySelector('#study-circuit-sub');
    if (subEl) subEl.textContent = `${this.studyData.circuit.layout} // ${this.studyData.circuit.lengthMiles} MILES // ${this.studyData.circuit.turnsCount} CORNERS`;

    // Render Active Phase View
    const phaseContent = this.container.querySelector('#study-phase-container');
    if (!phaseContent) return;

    // Reset and trigger smooth phase entrance animation
    phaseContent.classList.remove('phase-fade-in');
    void phaseContent.offsetWidth; // trigger reflow
    phaseContent.classList.add('phase-fade-in');

    switch (this.currentPhase) {
      case 1:
        this._renderPhase1(phaseContent);
        break;
      case 2:
        this._renderPhase2(phaseContent);
        break;
      case 3:
        this._renderPhase3(phaseContent);
        break;
      case 4:
        this._renderPhase4(phaseContent);
        break;
      case 5:
        this._renderPhase5(phaseContent);
        break;
    }

    if (this.activeCornerNumber) {
      this._highlightActiveCorner(this.activeCornerNumber);
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE 1: MACRO CORNER GRADING
  // ---------------------------------------------------------------------------
  _renderPhase1(container) {
    const macro = this.studyData.phase1_macro;
    const sortedCorners = [...macro.corners].sort((a, b) => a.priorityRank - b.priorityRank);

    let rowsHtml = sortedCorners.map(c => `
      <tr class="study-table-row ${c.number === this.selectedCornerNumber ? 'selected' : ''}" data-turn="${c.number}">
        <td><span class="rank-badge ${c.priorityRank <= 3 ? 'top-rank' : ''}">#${c.priorityRank}</span></td>
        <td class="font-bold text-accent">Turn ${c.number}</td>
        <td><span class="type-pill ${c.type.toLowerCase().replace(/\s+/g, '-')}">${c.type}</span></td>
        <td>${c.radius}m</td>
        <td>${c.apexSpeedMph} mph</td>
        <td class="font-mono ${c.followingStraightFt > 1000 ? 'text-green' : ''}">${c.followingStraightFt} ft</td>
        <td class="font-bold text-cyan">+${c.compoundLeverageSec}s</td>
        <td class="text-secondary text-sm">${c.disciplineAdvice}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="phase-grid-layout">
        <div class="phase-card lead-banner chamfer-br">
          <div class="card-header">
            <span class="phase-tag">PHASE 1: MACRO CORNER GRADING & PRIORITY</span>
            <span class="coverage-tag">${macro.straightsCoveragePct}% FULL THROTTLE / STRAIGHTS</span>
          </div>
          <p class="phase-mandate-text"><strong>TACTICAL MANDATE:</strong> ${macro.strategySummary}</p>
          <div class="kpi-mini-grid">
            <div class="kpi-item">
              <span class="kpi-label">LONGEST ACCELERATION</span>
              <span class="kpi-val text-gold">T${macro.longestStraight.fromCorner} → T${macro.longestStraight.toCorner} (${macro.longestStraight.distanceMeters}m / ${macro.longestStraight.distanceFt}ft)</span>
            </div>
            <div class="kpi-item">
              <span class="kpi-label">TOTAL FULL THROTTLE DISTANCE</span>
              <span class="kpi-val text-green">${macro.totalStraightMeters} meters</span>
            </div>
            <div class="kpi-item">
              <span class="kpi-label">SKIP BARBER TIME RULE</span>
              <span class="kpi-val text-cyan">+1 mph Exit = 1.46 ft/sec compounding advantage</span>
            </div>
          </div>
        </div>

        <div class="phase-card data-table-card chamfer-br">
          <div class="card-header">
            <span class="card-title">CORNER PRIORITY & TIME LEVERAGE MATRIX</span>
            <span class="text-muted text-xs">Sorted by Potential Lap Time Impact</span>
          </div>
          <div class="study-table-wrap">
            <table class="study-data-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>TURN</th>
                  <th>CLASSIFICATION</th>
                  <th>RADIUS</th>
                  <th>APEX MPH</th>
                  <th>FOLLOWING STRAIGHT</th>
                  <th>LEVERAGE DELTA</th>
                  <th>DISCIPLINE STRATEGY</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this._bindRowSelection(container);
  }

  // ---------------------------------------------------------------------------
  // PHASE 2: SURFACE RECONNAISSANCE
  // ---------------------------------------------------------------------------
  _renderPhase2(container) {
    const surface = this.studyData.phase2_surface;

    let cardsHtml = surface.corners.map(s => `
      <div class="corner-surface-card chamfer-br ${s.camberDeg < -0.5 ? 'hazard-card' : ''}">
        <div class="corner-surface-header">
          <span class="turn-num font-bold">Turn ${s.number}</span>
          <span class="camber-badge ${s.camberDeg < -0.5 ? 'negative' : (s.camberDeg > 0.5 ? 'positive' : 'neutral')}">${s.camberType}</span>
        </div>
        <div class="surface-details-grid">
          <div class="surface-stat">
            <span class="stat-lbl">Elevation & Load</span>
            <span class="stat-val ${s.elevationType.includes('Crest') ? 'text-red' : (s.elevationType.includes('Compression') ? 'text-green' : '')}">${s.elevationType}</span>
          </div>
          <div class="surface-stat">
            <span class="stat-lbl">Pavement</span>
            <span class="stat-val">${s.surfaceMaterial}</span>
          </div>
          <div class="surface-stat">
            <span class="stat-lbl">Bumps / Seams</span>
            <span class="stat-val ${s.bumpSeverity.includes('High') ? 'text-red' : ''}">${s.bumpSeverity}</span>
          </div>
          <div class="surface-stat">
            <span class="stat-lbl">Curb Threat</span>
            <span class="stat-val ${s.curbThreat.includes('Severe') ? 'text-red' : ''}">${s.curbThreat}</span>
          </div>
        </div>
        <div class="recon-note-box">
          <span class="recon-note-label">RECON ADVISORY:</span>
          <span class="recon-note-text">${s.reconNote}</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="phase-grid-layout">
        <div class="phase-card lead-banner chamfer-br">
          <div class="card-header">
            <span class="phase-tag">PHASE 2: SURFACE RECONNAISSANCE & CAMBER DYNAMICS</span>
            <span class="hazard-badge">${surface.surfaceHazardCount} SURFACE HAZARDS IDENTIFIED</span>
          </div>
          <p class="phase-mandate-text"><strong>GOING FASTER! CH. 3 GUIDELINE:</strong> ${surface.generalGuidance}</p>
        </div>

        <div class="surface-cards-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // PHASE 3: REFERENCE POINTS
  // ---------------------------------------------------------------------------
  _renderPhase3(container) {
    const ref = this.studyData.phase3_reference;

    let rowsHtml = ref.corners.map(r => `
      <tr class="study-table-row">
        <td class="font-bold text-accent">Turn ${r.number}</td>
        <td>
          <span class="font-bold ${r.brakePoint.isThresholdBraking ? 'text-red' : 'text-cyan'}">${r.brakePoint.distanceBeforeTurnInM}m (${r.brakePoint.distanceBeforeTurnInFt}ft)</span>
          <div class="sub-text text-muted">${r.brakePoint.markerText}</div>
        </td>
        <td>
          <span class="font-bold text-cyan">${r.turnIn.targetMph} mph</span>
          <div class="sub-text text-muted">${r.turnIn.visualAnchor}</div>
        </td>
        <td>
          <span class="font-bold text-green">${r.apex.targetMph} mph // Yaw: ${r.apex.yawAngleTargetDeg}°</span>
          <div class="sub-text text-muted">${r.apex.attitudeCheck}</div>
        </td>
        <td>
          <span class="waypoint-pill ${r.waypoint.needed ? 'required' : 'none'}">${r.waypoint.needed ? 'WAYPOINT NEEDED' : 'DIRECT LINE'}</span>
          <div class="sub-text text-muted">${r.waypoint.landmark}</div>
        </td>
        <td>
          <span class="font-bold">${r.trackOut.targetMph} mph</span> (Margin: ${r.trackOut.marginSafetyFt}ft)
          <div class="sub-text text-muted">${r.trackOut.visualTarget}</div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="phase-grid-layout">
        <div class="phase-card lead-banner chamfer-br">
          <div class="card-header">
            <span class="phase-tag">PHASE 3: CONCRETE REFERENCE POINTS & SIGHT PICTURES</span>
          </div>
          <p class="phase-mandate-text"><strong>SIGHT PICTURE TEMPLATE:</strong> ${ref.mentalFramework}</p>
        </div>

        <div class="phase-card data-table-card chamfer-br">
          <div class="card-header">
            <span class="card-title">TURN-BY-TURN VISUAL ANCHORS & ATTITUDES</span>
          </div>
          <div class="study-table-wrap">
            <table class="study-data-table">
              <thead>
                <tr>
                  <th>TURN</th>
                  <th>BRAKING MARKER</th>
                  <th>TURN-IN ANCHOR</th>
                  <th>APEX & YAW ATTITUDE</th>
                  <th>BLIND WAYPOINT</th>
                  <th>TRACK-OUT BOUNDARY</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // PHASE 4: ORDER OF EFFORT
  // ---------------------------------------------------------------------------
  _renderPhase4(container) {
    const ooe = this.studyData.phase4_orderOfEffort;

    let rowsHtml = ooe.corners.map(c => `
      <tr class="study-table-row">
        <td class="font-bold text-accent">Turn ${c.number}</td>
        <td><span class="type-pill ${c.type.toLowerCase().replace(/\s+/g, '-')}">${c.type}</span></td>
        <td>
          <span class="font-bold text-gold">${c.step1_lineStrategy.approach}</span>
          <div class="sub-text text-muted">Safety Margin: ${c.step1_lineStrategy.safetyMarginFt}ft</div>
        </td>
        <td>
          <span class="font-bold text-green">TAP: ${c.step2_exitThrottle.tapDistanceBeforeApexM}m (${c.step2_exitThrottle.tapDistanceBeforeApexFt}ft) before apex</span>
          <div class="sub-text text-muted">${c.step2_exitThrottle.squeezeRateText}</div>
        </td>
        <td>
          <span class="font-bold text-cyan">${c.step3_brakingProcedure.thresholdPressureLbs} lbs // ${c.step3_brakingProcedure.trailBrakingSec}s Trail</span>
          <div class="sub-text text-muted">${c.step3_brakingProcedure.brakeStyle}</div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="phase-grid-layout">
        <div class="phase-card lead-banner chamfer-br">
          <div class="card-header">
            <span class="phase-tag">PHASE 4: PLANNING THE "ORDER OF EFFORT"</span>
          </div>
          <div class="order-steps-banner-grid">
            <div class="order-step-item">
              <span class="step-badge">STEP 1</span>
              <span class="step-title">Master the Line</span>
              <p class="step-desc">Start with a Late Apex. Never early-apex (it drops wheels on exit). Use all road.</p>
            </div>
            <div class="order-step-item">
              <span class="step-badge">STEP 2</span>
              <span class="step-title">Maximize Exit Speed</span>
              <p class="step-desc">Locate Throttle Application Point (TAP). Squeeze progressively before apex and unwind.</p>
            </div>
            <div class="order-step-item">
              <span class="step-badge">STEP 3</span>
              <span class="step-title">Optimize Braking</span>
              <p class="step-desc">Use "The Procedure": lock in threshold force first, then advance brake points in 3–5 ft bites.</p>
            </div>
          </div>
        </div>

        <div class="phase-card data-table-card chamfer-br">
          <div class="card-header">
            <span class="card-title">CORNER EXECUTION TARGETS (LINE → EXIT THROTTLE → ENTRY BRAKING)</span>
          </div>
          <div class="study-table-wrap">
            <table class="study-data-table">
              <thead>
                <tr>
                  <th>TURN</th>
                  <th>TYPE</th>
                  <th>STEP 1: LINE DISCIPLINE</th>
                  <th>STEP 2: THROTTLE COMMIT (TAP)</th>
                  <th>STEP 3: BRAKING & TRAIL DURATION</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // PHASE 5: HARDWARE & STINT PREP
  // ---------------------------------------------------------------------------
  _renderPhase5(container) {
    const hw = this.studyData.phase5_hardware;

    let gearRowsHtml = hw.gearingMatrix.map(g => `
      <tr>
        <td class="font-bold text-accent">${g.turn}</td>
        <td class="font-bold text-cyan">GEAR ${g.gear}</td>
        <td>${g.minSpeedMph} mph</td>
        <td class="text-secondary">${g.shiftNote}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="phase-grid-layout">
        <div class="hardware-cards-grid">
          <!-- Tire Thermals -->
          <div class="phase-card chamfer-br">
            <div class="card-header">
              <span class="card-title text-gold">1. TIRE THERMAL MANAGEMENT</span>
            </div>
            <div class="card-content-stack">
              <div class="hw-item">
                <span class="hw-lbl">Optimal Operating Window:</span>
                <span class="hw-val text-green font-bold">${hw.tireThermalManagement.operatingWindowF}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Pace Lap Warm-up:</span>
                <span class="hw-desc">${hw.tireThermalManagement.paceLapWarmupTactic}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Slip Angle Limits:</span>
                <span class="hw-desc">${hw.tireThermalManagement.slipAngleWindow}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Cold-to-Hot Pressure Gain:</span>
                <span class="hw-val text-cyan font-mono">+${hw.tireThermalManagement.coldToHotTargetPressureGainPsi} PSI per axle</span>
              </div>
            </div>
          </div>

          <!-- Brake Bias -->
          <div class="phase-card chamfer-br">
            <div class="card-header">
              <span class="card-title text-cyan">2. BRAKE BIAS & COCKPIT SCANS</span>
            </div>
            <div class="card-content-stack">
              <div class="hw-item">
                <span class="hw-lbl">Mechanical Baseline Bias:</span>
                <span class="hw-val font-bold text-white">${hw.brakeSystemManagement.baselineBias}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Dynamic Bias Tuning:</span>
                <span class="hw-desc">${hw.brakeSystemManagement.dynamicAdjustmentTactic}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Gauge Check Routine:</span>
                <span class="hw-desc">${hw.brakeSystemManagement.heatSoakNotice}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Gearing Matrix -->
        <div class="phase-card data-table-card chamfer-br">
          <div class="card-header">
            <span class="card-title">3. GEARING POWERBAND MATRIX</span>
          </div>
          <div class="study-table-wrap">
            <table class="study-data-table">
              <thead>
                <tr>
                  <th>TURN</th>
                  <th>TARGET GEAR</th>
                  <th>APEX SPEED</th>
                  <th>POWERBAND & SHIFT DISCIPLINE</th>
                </tr>
              </thead>
              <tbody>
                ${gearRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Traffic & Race Strategy -->
        <div class="phase-card lead-banner chamfer-br">
          <div class="card-header">
            <span class="phase-tag text-purple">4. TRAFFIC DYNAMICS, ACCORDION EFFECT & RACE STARTS</span>
          </div>
          <div class="traffic-tactics-stack">
            <p><strong>Race Start Accordion Effect:</strong> ${hw.trafficAndAccordionTactics.gridStartPreparation}</p>
            <p><strong>Drafting Mechanics:</strong> ${hw.trafficAndAccordionTactics.draftingPlan}</p>
            <p><strong>Seeing Independently:</strong> <span class="text-red">${hw.trafficAndAccordionTactics.seeingIndependently}</span></p>
          </div>
        </div>
      </div>
    `;
  }

  _bindRowSelection(container) {
    const rows = container.querySelectorAll('.study-table-row');
    rows.forEach(r => {
      r.addEventListener('click', () => {
        rows.forEach(x => x.classList.remove('selected'));
        r.classList.add('selected');
        const turn = parseInt(r.dataset.turn, 10);
        this.setSelectedCorner(turn);
      });
    });
  }

  renderCornerDetail() {
    // Optional sub-panel highlight
  }

  async exportDossierPdf() {
    if (!this.studyData) return;

    const btnExport = this.container?.querySelector('#btn-study-export-pdf');
    if (btnExport) {
      btnExport.disabled = true;
      btnExport.innerHTML = '<span class="loading-spinner"></span> Generating 5-Page Dossier...';
    }

    if (window.PitToast) {
      window.PitToast.info('Compiling 5-Phase Skip Barber Study Dossier...', 'GENERATING PDF');
    }

    try {
      const pdfBytes = await this.pdfBuilder.generate(this.studyData, this.currentTrackProfile);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (this.studyData.circuit.name || 'Circuit').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.href = url;
      a.download = `APEX_5Phase_Track_Study_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.PitToast) {
        window.PitToast.success(`Exported APEX_5Phase_Track_Study_${safeName}.pdf`, 'PDF EXPORTED');
      }
    } catch (err) {
      console.error('[TrackStudyView] PDF Generation failed:', err);
      if (window.PitToast) {
        window.PitToast.error(err.message, 'PDF GENERATION FAILED');
      } else {
        alert('Failed to generate Track Study PDF: ' + err.message);
      }
    } finally {
      if (btnExport) {
        btnExport.disabled = false;
        btnExport.innerHTML = '<span class="btn-icon">📄</span> Export 5-Phase Study PDF';
      }
    }
  }

  onTelemetrySample(sample) {
    if (!sample || !this.container) return;
    this.liveTelemetryActive = true;

    // Update status pill & dot
    const statusPill = this.container.querySelector('#study-live-status-pill');
    const statusDot = this.container.querySelector('#study-live-status-dot');
    const statusTxt = this.container.querySelector('#study-live-status-text');
    const metricsStrip = this.container.querySelector('#study-live-metrics-strip');

    if (statusPill) statusPill.classList.add('live-active');
    if (statusDot) statusDot.className = 'status-dot live';
    if (statusTxt) statusTxt.textContent = 'TELEMETRY SYNC ACTIVE';
    if (metricsStrip) metricsStrip.style.display = 'inline-flex';

    // Update Lap & Speed metrics
    const lapVal = this.container.querySelector('#study-live-lap-val');
    const speedVal = this.container.querySelector('#study-live-speed-val');
    const turnVal = this.container.querySelector('#study-live-turn-val');

    const lapNumber = sample.lapNumber !== undefined ? sample.lapNumber : (sample.currentLap || 1);
    const speedMph = Math.round(sample.speedMph || (sample.speedKmh ? sample.speedKmh * 0.621371 : (sample.speedMps ? sample.speedMps * 2.23694 : 0)));

    if (lapVal) lapVal.textContent = lapNumber;
    if (speedVal) speedVal.textContent = speedMph;

    // Detect and highlight current on-track corner
    const cornerNum = this._detectCurrentCorner(sample);
    if (cornerNum) {
      if (turnVal) turnVal.textContent = `T${cornerNum}`;
      this._highlightActiveCorner(cornerNum);
    } else {
      if (turnVal) turnVal.textContent = 'STR';
      this._highlightActiveCorner(null);
    }

    // First connection toast alert
    if (!this.hasNotifiedLiveSync) {
      this.hasNotifiedLiveSync = true;
      if (window.PitToast) {
        const trackName = this.studyData?.circuit?.name || 'Circuit';
        window.PitToast.telemetry(`Live Telemetry Synced // Tracking on-track progression for ${trackName}`, 'TRACK STUDY LIVE');
      }
    }
  }

  _detectCurrentCorner(sample) {
    if (!this.studyData?.phase1_macro?.corners) return null;
    const corners = this.studyData.phase1_macro.corners;
    if (corners.length === 0) return null;

    // 1. If sample explicitly carries corner index / active turn
    if (sample.activeCorner !== undefined && sample.activeCorner !== null) {
      return sample.activeCorner;
    }
    if (sample.cornerIndex !== undefined && sample.cornerIndex !== null) {
      return corners[sample.cornerIndex % corners.length]?.number || null;
    }

    // 2. Derive from lap distance progression
    const totalDist = this.currentTrackProfile?.lengthMeters || this.studyData.circuit.lengthMeters || 5000;
    let lapDist = sample.lapDistanceMeters !== undefined ? sample.lapDistanceMeters : (sample.distanceMeters !== undefined ? sample.distanceMeters % totalDist : null);

    if (lapDist === null && sample.normalizedLapPosition !== undefined) {
      lapDist = sample.normalizedLapPosition * totalDist;
    }

    if (lapDist !== null && corners.length > 0) {
      // Approximate corner index by segmenting lap distance
      const segmentSize = totalDist / corners.length;
      const cornerIdx = Math.floor(lapDist / segmentSize);
      const safeIdx = Math.min(Math.max(cornerIdx, 0), corners.length - 1);
      return corners[safeIdx].number;
    }

    // Default to first corner if driving
    return corners[0].number;
  }

  _highlightActiveCorner(cornerNumber) {
    this.activeCornerNumber = cornerNumber;
    if (!this.container) return;

    // 1. Clear previous on-track highlights and badges
    const existingActive = this.container.querySelectorAll('.active-on-track');
    existingActive.forEach(el => el.classList.remove('active-on-track'));

    const existingTags = this.container.querySelectorAll('.on-track-live-tag');
    existingTags.forEach(tag => tag.remove());

    if (!cornerNumber) return;

    // 2. Spotlight matching table row (Phase 1, 3, 4, 5)
    const activeRow = this.container.querySelector(`.study-table-row[data-turn="${cornerNumber}"]`);
    if (activeRow) {
      activeRow.classList.add('active-on-track');
      const turnCell = activeRow.querySelector('td:nth-child(2)') || activeRow.querySelector('td:first-child');
      if (turnCell && !turnCell.querySelector('.on-track-live-tag')) {
        const tag = document.createElement('span');
        tag.className = 'on-track-live-tag';
        tag.textContent = '● ON TRACK';
        turnCell.appendChild(tag);
      }
    }

    // 3. Spotlight matching surface card (Phase 2)
    const surfaceCards = this.container.querySelectorAll('.corner-surface-card');
    surfaceCards.forEach(card => {
      const turnHeader = card.querySelector('.turn-num');
      if (turnHeader && turnHeader.textContent.includes(`Turn ${cornerNumber}`)) {
        card.classList.add('active-on-track');
        if (!card.querySelector('.on-track-live-tag')) {
          const tag = document.createElement('span');
          tag.className = 'on-track-live-tag';
          tag.textContent = '● ON TRACK';
          turnHeader.appendChild(tag);
        }
      }
    });
  }
}
