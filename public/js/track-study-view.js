/**
 * APEX Track Study View Controller
 * Manages the interactive 4-Phase Circuit Study workflow inspired by Going Faster!
 * Provides step-by-step guidance, corner telemetry targets, editable driver sight pictures,
 * and 1-click 2-page PDF export.
 */

import { trackStudyAnalyzer } from './analysis/track-study-analyzer.js';
import { trackStudyStore } from './track-study-store.js';
import { trackStudyPdfBuilder } from './track-study-pdf-builder.js';

export class TrackStudyView {
  constructor() {
    this.activeTrack = null;
    this.studyData = null;
    this.currentPhase = 1; // 1 | 2 | 3 | 4
    this.selectedTurnIndex = 0;

    // DOM Elements
    this.modalOverlay = document.getElementById('track-study-modal');
    this.btnClose = document.getElementById('btn-close-track-study');
    this.btnExportPdf = document.getElementById('btn-export-study-pdf');
    this.trackTitle = document.getElementById('study-track-title');
    this.trackSubtitle = document.getElementById('study-track-subtitle');
    this.turnNavContainer = document.getElementById('study-turn-nav');
    this.phaseStepperTabs = document.querySelectorAll('.study-step-tab');
    this.phasePanels = document.querySelectorAll('.study-phase-panel');

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.hide());
    }

    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.modalOverlay) this.hide();
      });
    }

    // Stepper Navigation
    if (this.phaseStepperTabs) {
      this.phaseStepperTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const step = parseInt(tab.dataset.step, 10) || 1;
          this.setPhase(step);
        });
      });
    }

    // PDF Export
    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => this.exportPdf());
    }
  }

  /**
   * Opens the Track Study modal for a given track profile.
   * @param {Object} trackProfile 
   */
  open(trackProfile) {
    if (!trackProfile) return;
    this.activeTrack = trackProfile;

    // Analyze track and merge with stored driver notes
    this.studyData = trackStudyAnalyzer.analyzeTrackStudy(trackProfile);
    const savedOverrides = trackStudyStore.getStudy(trackProfile.trackId);

    if (savedOverrides && savedOverrides.corners) {
      this.studyData.turns.forEach((turn, idx) => {
        const saved = savedOverrides.corners[idx];
        if (saved) {
          if (saved.driverNotes) turn.driverNotes = saved.driverNotes;
          if (saved.referenceMarkers) {
            turn.referenceMarkers = { ...turn.referenceMarkers, ...saved.referenceMarkers };
          }
        }
      });
    }

    // Populate Header
    if (this.trackTitle) {
      this.trackTitle.textContent = `${trackProfile.trackName || 'Circuit'} // Track Study`;
    }
    if (this.trackSubtitle) {
      this.trackSubtitle.textContent = `Layout: ${trackProfile.layoutName || 'GP'} | Length: ${(trackProfile.trackLengthMeters || 0).toLocaleString()}m`;
    }

    this.currentPhase = 1;
    this.selectedTurnIndex = 0;
    this.renderTurnNavigation();
    this.setPhase(1);

    if (this.modalOverlay) {
      this.modalOverlay.classList.add('active');
    }
  }

  hide() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
  }

  /**
   * Sets the active study phase (1-4)
   * @param {number} phaseNum 
   */
  setPhase(phaseNum) {
    this.currentPhase = phaseNum;

    // Update Stepper Tabs
    if (this.phaseStepperTabs) {
      this.phaseStepperTabs.forEach(tab => {
        const step = parseInt(tab.dataset.step, 10);
        if (step === phaseNum) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    // Update Panels
    if (this.phasePanels) {
      this.phasePanels.forEach(panel => {
        const step = parseInt(panel.dataset.phase, 10);
        if (step === phaseNum) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    }

    this.renderActivePhase();
  }

  /**
   * Renders the horizontal turn navigation pills
   */
  renderTurnNavigation() {
    if (!this.turnNavContainer || !this.studyData) return;
    this.turnNavContainer.innerHTML = '';

    const turns = this.studyData.turns || [];
    turns.forEach((turn, idx) => {
      const btn = document.createElement('button');
      const typeClass = turn.cornerType === 'Type I' ? 'type-i-pill' : 
        (turn.cornerType === 'Type II' ? 'type-ii-pill' : 'type-iii-pill');

      btn.className = `study-turn-pill ${typeClass} ${idx === this.selectedTurnIndex ? 'active' : ''}`;
      btn.innerHTML = `<span>T${turn.turnNumber}</span>`;
      btn.title = `${turn.name} — ${turn.cornerType} (${turn.typeLabel})`;
      
      btn.addEventListener('click', () => {
        this.selectedTurnIndex = idx;
        this.renderTurnNavigation();
        this.renderActivePhase();
      });

      this.turnNavContainer.appendChild(btn);
    });
  }

  /**
   * Renders content for the currently active phase
   */
  renderActivePhase() {
    if (!this.studyData) return;
    const turn = this.studyData.turns[this.selectedTurnIndex] || this.studyData.turns[0];

    switch (this.currentPhase) {
      case 1:
        this.renderPhase1(turn);
        break;
      case 2:
        this.renderPhase2(turn);
        break;
      case 3:
        this.renderPhase3(turn);
        break;
      case 4:
        this.renderPhase4(turn);
        break;
    }
  }

  /**
   * Phase 1: Macro-Analysis & Corner Grading
   */
  renderPhase1(turn) {
    const container = document.getElementById('phase-1-content');
    if (!container) return;

    const macro = this.studyData.macroSummary;
    const typeClass = turn.cornerType === 'Type I' ? 'type-i' : (turn.cornerType === 'Type II' ? 'type-ii' : 'type-iii');

    container.innerHTML = `
      <div class="study-grid-3col">
        <div class="study-card">
          <h4 class="study-card-title">Circuit Ratio Breakdown</h4>
          <div class="metric-row">
            <span class="metric-label">Acceleration / Straights:</span>
            <span class="metric-val" style="color: #00ff66;">${macro.accelerationPercentage}% of Lap</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Cornering & Deceleration:</span>
            <span class="metric-val" style="color: #00e5ff;">${macro.corneringPercentage}% of Lap</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Total Classified Corners:</span>
            <span class="metric-val">${macro.totalCorners}</span>
          </div>
        </div>

        <div class="study-card">
          <h4 class="study-card-title">Corner Type Distribution</h4>
          <div class="metric-row">
            <span class="metric-label">Type I (Exit Priority):</span>
            <span class="metric-val" style="color: #00ff66;">${macro.typeICount}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Type II (Entry / Braking):</span>
            <span class="metric-val" style="color: #ff3b30;">${macro.typeIICount}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Type III (Compromise):</span>
            <span class="metric-val" style="color: #ffb800;">${macro.typeIIICount}</span>
          </div>
        </div>

        <div class="study-card">
          <h4 class="study-card-title">Strategic Priorities</h4>
          <div class="metric-row">
            <span class="metric-label">Key Launch Straight:</span>
            <span class="metric-val" style="color: #00ff66;">T${macro.keyExitCorner?.turnNumber || 1} (${macro.keyExitCorner?.followingStraightMeters || 0}m)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Heaviest Braking Zone:</span>
            <span class="metric-val" style="color: #ff3b30;">T${macro.heaviestBrakingCorner?.turnNumber || 1}</span>
          </div>
        </div>
      </div>

      <div class="study-card" style="border-left: 4px solid var(--accent-cyan, #00e5ff);">
        <h4 class="study-card-title">
          <span>${turn.name} // Corner Grading</span>
          <span class="corner-type-tag ${typeClass}">${turn.cornerType} — ${turn.typeLabel}</span>
        </h4>
        <p class="study-card-body"><strong>Strategic Rationale:</strong> ${turn.typeRationale}</p>
        <div class="study-grid-2col">
          <div class="metric-row">
            <span class="metric-label">Preceding Straight Length:</span>
            <span class="metric-val">${turn.precedingStraightMeters} m</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Following Acceleration Straight:</span>
            <span class="metric-val" style="color: #00ff66;">${turn.followingStraightMeters} m</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Phase 2: Micro-Scouting & Surface Inspection
   */
  renderPhase2(turn) {
    const container = document.getElementById('phase-2-content');
    if (!container) return;

    const micro = turn.microFeatures || {};

    container.innerHTML = `
      <div class="study-grid-2col">
        <div class="study-card">
          <h4 class="study-card-title">Road Camber & Banking Analysis</h4>
          <div class="metric-row">
            <span class="metric-label">Camber Geometry:</span>
            <span class="metric-val" style="color: #00e5ff;">${micro.camber}</span>
          </div>
          <p class="study-card-body" style="font-size: 12px; margin-top: 8px;">
            ${micro.camber.includes('Positive') ? 
              '✅ Positive banking transfers vertical download to tires, boosting cornering grip by 5-10%.' : 
              (micro.camber.includes('Negative') ? '⚠️ Off-camber reduces lateral tire traction. Slower entry and delayed power application required.' : 'Flat road surface; grip is strictly tire & aerodynamic dependent.')}
          </p>
        </div>

        <div class="study-card">
          <h4 class="study-card-title">Surface & Curb Inspection</h4>
          <div class="metric-row">
            <span class="metric-label">Track Surface:</span>
            <span class="metric-val">${micro.surfaceType}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Curb Profile:</span>
            <span class="metric-val">${micro.curbSeverity}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Elevation Dynamic:</span>
            <span class="metric-val">${micro.elevationProfile}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Escape / Run-off Option:</span>
            <span class="metric-val" style="color: #8b9bb4;">${micro.escapeRoad}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Phase 3: Visual Reference Points & Sight Pictures
   */
  renderPhase3(turn) {
    const container = document.getElementById('phase-3-content');
    if (!container) return;

    const refs = turn.referenceMarkers || {};

    container.innerHTML = `
      <div class="study-card">
        <h4 class="study-card-title">${turn.name} // Visual Reference Markers & Landmarks</h4>
        <div class="study-grid-2col">
          <div class="study-input-group">
            <label class="study-input-label">1. Braking Point Cue</label>
            <input type="text" class="study-text-input" id="input-ref-brake" value="${refs.braking || ''}" placeholder="e.g. 100m board / bridge shadow">
          </div>
          <div class="study-input-group">
            <label class="study-input-label">2. Turn-In Reference</label>
            <input type="text" class="study-text-input" id="input-ref-turnin" value="${refs.turnIn || ''}" placeholder="e.g. End of outside access road">
          </div>
          <div class="study-input-group">
            <label class="study-input-label">3. Apex Target / Landmark</label>
            <input type="text" class="study-text-input" id="input-ref-apex" value="${refs.apex || ''}" placeholder="e.g. Center of painted curb seam">
          </div>
          <div class="study-input-group">
            <label class="study-input-label">4. Track-Out Margin</label>
            <input type="text" class="study-text-input" id="input-ref-trackout" value="${refs.trackOut || ''}" placeholder="e.g. End of flat green exit curb">
          </div>
        </div>

        <div class="study-input-group" style="margin-top: 12px;">
          <label class="study-input-label">Driver Sight Picture & Notes (Auto-Saved)</label>
          <textarea class="study-text-input study-textarea" id="input-driver-notes" placeholder="Describe the mental image or sight picture when executing this turn...">${turn.driverNotes || ''}</textarea>
        </div>
      </div>
    `;

    // Bind auto-save handlers
    const inputs = ['input-ref-brake', 'input-ref-turnin', 'input-ref-apex', 'input-ref-trackout', 'input-driver-notes'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.saveCurrentCornerNotes());
      }
    });
  }

  /**
   * Phase 4: Telemetry Target & Progressive Ladder
   */
  renderPhase4(turn) {
    const container = document.getElementById('phase-4-content');
    if (!container) return;

    const targets = turn.targets || {};

    container.innerHTML = `
      <div class="study-grid-2col">
        <div class="study-card">
          <h4 class="study-card-title">Telemetry Targets</h4>
          <div class="metric-row">
            <span class="metric-label">Target Min Apex Speed:</span>
            <span class="metric-val" style="color: #00ff66; font-size: 16px;">${targets.minApexSpeedMph || 60} mph</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Approach Entry Speed:</span>
            <span class="metric-val">${targets.approachSpeedMph || 95} mph</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Suggested Corner Gear:</span>
            <span class="metric-val" style="color: #00e5ff;">Gear ${targets.targetGear || 3}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Peak Braking Pressure:</span>
            <span class="metric-val">${targets.suggestedBrakePressurePct || 80}%</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Trail-Braking Depth:</span>
            <span class="metric-val">${targets.trailBrakeDepthPct || 30}% of turn entry</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Throttle Pick-Up Point:</span>
            <span class="metric-val" style="color: #00ff66;">${targets.throttlePickUpPoint || 'At Apex'}</span>
          </div>
        </div>

        <div class="study-card">
          <h4 class="study-card-title">The 3-Step Stint Progression</h4>
          <p class="study-card-body" style="font-size: 12px; margin-bottom: 8px;">
            <strong>Step 1: The Line</strong> — Place the car within 6 inches of turn-in, apex, and track-out.
          </p>
          <p class="study-card-body" style="font-size: 12px; margin-bottom: 8px;">
            <strong>Step 2: Exit Speed</strong> — Squeeze throttle smoothly and unwind steering to eliminate tire scrub.
          </p>
          <p class="study-card-body" style="font-size: 12px;">
            <strong>Step 3: Braking Depth</strong> — Move braking point closer in 3-foot increments once threshold pressure is mastered.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Saves updated notes from Phase 3 into memory & persistence store
   */
  saveCurrentCornerNotes() {
    if (!this.studyData || !this.activeTrack) return;
    const turn = this.studyData.turns[this.selectedTurnIndex];
    if (!turn) return;

    const refBrake = document.getElementById('input-ref-brake')?.value || '';
    const refTurnIn = document.getElementById('input-ref-turnin')?.value || '';
    const refApex = document.getElementById('input-ref-apex')?.value || '';
    const refTrackOut = document.getElementById('input-ref-trackout')?.value || '';
    const driverNotes = document.getElementById('input-driver-notes')?.value || '';

    turn.referenceMarkers = {
      braking: refBrake,
      turnIn: refTurnIn,
      apex: refApex,
      trackOut: refTrackOut
    };
    turn.driverNotes = driverNotes;

    trackStudyStore.saveCornerStudy(this.activeTrack.trackId, this.selectedTurnIndex, {
      referenceMarkers: turn.referenceMarkers,
      driverNotes: turn.driverNotes
    });
  }

  /**
   * Generates and downloads the 2-Page Track Study PDF
   */
  async exportPdf() {
    if (!this.studyData) return;

    try {
      if (this.btnExportPdf) {
        this.btnExportPdf.disabled = true;
        this.btnExportPdf.textContent = 'Generating PDF...';
      }

      this.saveCurrentCornerNotes();
      const pdfBytes = await trackStudyPdfBuilder.generate(this.studyData);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `APEX_Track_Study_${(this.studyData.trackName || 'Circuit').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (this.btnExportPdf) {
        this.btnExportPdf.disabled = false;
        this.btnExportPdf.innerHTML = '<span>📄</span> Export Track Study PDF (2-Page)';
      }
    } catch (err) {
      console.error('[TRACK STUDY VIEW] Error exporting PDF:', err);
      alert(`Error exporting Track Study PDF: ${err.message}`);
      if (this.btnExportPdf) {
        this.btnExportPdf.disabled = false;
        this.btnExportPdf.innerHTML = '<span>📄</span> Export Track Study PDF (2-Page)';
      }
    }
  }
}

export const trackStudyView = new TrackStudyView();
