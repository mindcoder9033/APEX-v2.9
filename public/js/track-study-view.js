/**
 * APEX Track Study View Controller
 * Manages the interactive 5-Phase Track Study tab & sequential pre-stint briefing workflow.
 * Rooted in "Going Faster! Mastering the Art of Race Driving"
 */

import { TrackStudyEngine } from './analysis/track-study-engine.js';
import { TrackStudyPdfBuilder } from './track-study-pdf-builder.js';
import { trackStudyLibrary } from './analysis/track-study-library.js';

export class TrackStudyView {
  constructor() {
    this.engine = new TrackStudyEngine();
    this.pdfBuilder = new TrackStudyPdfBuilder();
    
    this.currentPhase = 1; // 1 to 5
    this.selectedCornerNumber = 1;
    this.activeCornerNumber = null;
    this.selectedTrackId = 'sebring-international-raceway--full-circuit';
    this.currentTrackProfile = null;
    this.studyData = null;
    this.customNotes = {};
    this._autoSaveTimer = null;
    this._statusTimer = null;
    this.telemetrySamples = [];
    this.liveTelemetryActive = false;
    this.hasNotifiedLiveSync = false;
    this.lapsCompleted = 0;
    this.unlockedPhases = new Set([1]);
    this.hasCompletedBriefing = false;
    this._hasAutoDownloadedPdf = false;

    this.container = null;
  }

  /**
   * Initializes DOM bindings, track selector dropdown, stepper tabs, and PDF export
   */
  init() {
    this.container = document.getElementById('view-track-study');
    if (!this.container) return;

    if (this._initialized) {
      this.render();
      return;
    }
    this._initialized = true;

    this._populateTrackDropdown();
    this._bindEvents();
    this._loadTrackFromLibrary(this.selectedTrackId, false);
    this.updateReadinessMeter();
  }

  _populateTrackDropdown() {
    const trackSelect = this.container.querySelector('#study-track-selector');
    if (!trackSelect) return;

    const tracks = trackStudyLibrary.getAllCatalogTracks();
    const realTracks = tracks.filter(t => t.type === 'Real');
    const fictionalTracks = tracks.filter(t => t.type !== 'Real');

    let html = '';
    if (realTracks.length > 0) {
      html += `<optgroup label="── Real World Circuits ──">`;
      realTracks.forEach(t => {
        html += `<option value="${t.trackId}">${t.displayName}</option>`;
      });
      html += `</optgroup>`;
    }
    if (fictionalTracks.length > 0) {
      html += `<optgroup label="── Fictional / Fantasy Circuits ──">`;
      fictionalTracks.forEach(t => {
        html += `<option value="${t.trackId}">${t.displayName}</option>`;
      });
      html += `</optgroup>`;
    }

    trackSelect.innerHTML = html;
    if (tracks.some(t => t.trackId === this.selectedTrackId)) {
      trackSelect.value = this.selectedTrackId;
    } else if (tracks.length > 0) {
      this.selectedTrackId = tracks[0].trackId;
      trackSelect.value = this.selectedTrackId;
    }
  }

  _bindEvents() {
    // Track Dropdown Selector
    const trackSelect = this.container.querySelector('#study-track-selector');
    if (trackSelect) {
      trackSelect.addEventListener('change', (e) => {
        const newTrackId = e.target.value;
        if (newTrackId) {
          this.switchTrack(newTrackId);
        }
      });
    }

    // Reset Study Progress Button
    const btnReset = this.container.querySelector('#btn-study-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.resetCurrentTrackStudy();
      });
    }

    // Stepper buttons (enforces sequential progression based on laps completed)
    const stepBtns = this.container.querySelectorAll('.study-step-btn');
    stepBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10);
        if (step >= 1 && step <= 5) {
          this.setPhase(step);
        }
      });
    });

    // Save Track Data Button
    const btnSave = this.container.querySelector('#btn-study-save-data');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.saveCurrentTrackStudy(true);
      });
    }

    // PDF Export Button
    const btnExport = this.container.querySelector('#btn-study-export-pdf');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.exportDossierPdf();
      });
    }

    // Open Track Editor Button
    const btnOpenEditor = this.container.querySelector('#btn-study-open-editor');
    if (btnOpenEditor) {
      btnOpenEditor.addEventListener('click', () => {
        if (window.apexApp) {
          window.apexApp.switchView('track-editor');
          if (window.apexApp.trackEditor) {
            window.apexApp.trackEditor.loadTrack(this.selectedTrackId);
          }
        }
      });
    }

    // Refresh / Live Ingest Button
    const btnRefresh = this.container.querySelector('#btn-study-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this._loadTrackFromLibrary(this.selectedTrackId, true);
        if (window.PitToast) {
          window.PitToast.info('Track Study profile reloaded', 'CIRCUIT SYNC');
        }
      });
    }
  }

  switchTrack(trackId, notify = true) {
    this.selectedTrackId = trackId;
    const trackSelect = this.container.querySelector('#study-track-selector');
    if (trackSelect && trackSelect.value !== trackId) {
      trackSelect.value = trackId;
    }
    this._loadTrackFromLibrary(trackId, notify);
  }

  _loadTrackFromLibrary(trackId, notify = true) {
    const profile = trackStudyLibrary.getTrackStudyProfile(trackId);
    if (!profile) return;

    // Reset session tracking references
    this._prevLapNumber = null;
    this._prevLastLapTime = null;
    this._prevNormPos = null;
    this._sessionBaseLap = undefined;
    this._lastSampleLap = undefined;

    // Load independent persistent study progression and driver notes for this specific track
    const savedState = trackStudyLibrary.getTrackStudyState(trackId);
    this.lapsCompleted = savedState.lapsCompleted || 0;
    this.customNotes = savedState.customNotes || {};
    this._hasAutoDownloadedPdf = this.lapsCompleted >= 5;

    // Asynchronously try to fetch newer server version from REST API
    trackStudyLibrary.fetchServerTrackStudy(trackId).then(serverState => {
      if (serverState && serverState.customNotes && this.selectedTrackId === trackId) {
        let hasNew = false;
        for (const k of Object.keys(serverState.customNotes)) {
          if (!this.customNotes[k]) {
            this.customNotes[k] = serverState.customNotes[k];
            hasNew = true;
          }
        }
        if (hasNew) {
          this._applyCustomNotesToStudyData();
          this.render();
        }
      }
    }).catch(() => {});

    // Compute unlocked phases from laps completed (Stage 1 is always unlocked; Stage k+1 unlocked if lapsCompleted >= k)
    const unlocked = new Set([1]);
    for (let s = 1; s <= Math.min(4, this.lapsCompleted); s++) {
      unlocked.add(s + 1);
    }
    this.unlockedPhases = unlocked;
    this.hasCompletedBriefing = this.lapsCompleted >= 5;

    const targetPhase = savedState.lastPhase && this.unlockedPhases.has(savedState.lastPhase)
      ? savedState.lastPhase
      : Math.max(...Array.from(this.unlockedPhases));

    this.currentPhase = targetPhase || 1;
    this.setTrackProfile(profile, [], notify);
    this.updateReadinessMeter();
  }

  loadTrackById(trackId, notify = true) {
    this.switchTrack(trackId, notify);
  }

  setTrackProfile(trackProfile, telemetrySamples = [], notify = true) {
    this.currentTrackProfile = trackProfile;
    try {
      this.studyData = this.engine.generateStudy(trackProfile, telemetrySamples);
      this._applyCustomNotesToStudyData();
      
      // If telemetry samples are provided, derive completed laps count automatically
      if (Array.isArray(telemetrySamples) && telemetrySamples.length > 0) {
        const detectedLaps = this._computeLapsFromSamples(telemetrySamples);
        if (detectedLaps > this.lapsCompleted) {
          this._applyLapsCompleted(detectedLaps);
        }
      }

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

  _applyCustomNotesToStudyData() {
    if (!this.studyData || !this.customNotes) return;
    for (const [key, val] of Object.entries(this.customNotes)) {
      if (val !== undefined && val !== null) {
        this._applySingleCustomNote(key, val);
      }
    }
  }

  _applySingleCustomNote(key, val) {
    if (!this.studyData) return;

    if (key === 'phase1.mandate' && this.studyData.phase1_macro) {
      this.studyData.phase1_macro.strategySummary = val;
    } else if (key.startsWith('phase1.turn.')) {
      const match = key.match(/^phase1\.turn\.(\d+)\.discipline$/);
      if (match) {
        const turnNum = parseInt(match[1], 10);
        const c = this.studyData.phase1_macro?.corners?.find(x => x.number === turnNum);
        if (c) c.disciplineAdvice = val;
      }
    } else if (key.startsWith('phase2.turn.')) {
      const match = key.match(/^phase2\.turn\.(\d+)\.reconNote$/);
      if (match) {
        const turnNum = parseInt(match[1], 10);
        const s = this.studyData.phase2_surface?.corners?.find(x => x.number === turnNum);
        if (s) s.reconNote = val;
      }
    } else if (key.startsWith('phase3.turn.')) {
      const match = key.match(/^phase3\.turn\.(\d+)\.(brakeMarker|turnInAnchor|apexAttitude|waypoint|trackOut)$/);
      if (match) {
        const turnNum = parseInt(match[1], 10);
        const field = match[2];
        const r = this.studyData.phase3_reference?.corners?.find(x => x.number === turnNum);
        if (r) {
          if (field === 'brakeMarker') r.brakePoint.markerText = val;
          if (field === 'turnInAnchor') r.turnIn.visualAnchor = val;
          if (field === 'apexAttitude') r.apex.attitudeCheck = val;
          if (field === 'waypoint') r.waypoint.landmark = val;
          if (field === 'trackOut') r.trackOut.visualTarget = val;
        }
      }
    } else if (key.startsWith('phase4.turn.')) {
      const match = key.match(/^phase4\.turn\.(\d+)\.(earlyApex|tapNote|brakeStyle)$/);
      if (match) {
        const turnNum = parseInt(match[1], 10);
        const field = match[2];
        const o = this.studyData.phase4_orderOfEffort?.corners?.find(x => x.number === turnNum);
        if (o) {
          if (field === 'earlyApex') o.step1_lineStrategy.earlyApexConsequence = val;
          if (field === 'tapNote') o.step2_exitThrottle.squeezeRateText = val;
          if (field === 'brakeStyle') o.step3_brakingProcedure.brakeStyle = val;
        }
      }
    } else if (key.startsWith('phase5.turn.')) {
      const match = key.match(/^phase5\.turn\.(.+)\.shiftNote$/);
      if (match) {
        const turnName = match[1];
        const g = this.studyData.phase5_hardware?.gearingMatrix?.find(x => x.turn === turnName);
        if (g) g.shiftNote = val;
      }
    } else if (key === 'phase5.tireWarmup' && this.studyData.phase5_hardware) {
      this.studyData.phase5_hardware.tireThermalManagement.paceLapWarmupTactic = val;
    } else if (key === 'phase5.brakeTuning' && this.studyData.phase5_hardware) {
      this.studyData.phase5_hardware.brakeSystemManagement.dynamicAdjustmentTactic = val;
    }
  }

  _bindEditableFields(container) {
    if (!container) return;
    const editables = container.querySelectorAll('.editable-note, .editable-field');
    editables.forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !el.classList.contains('multiline')) {
          e.preventDefault();
          el.blur();
        }
      });

      const handleEdit = () => {
        const key = el.dataset.editKey;
        const val = el.innerText.trim();
        if (key) {
          this.customNotes[key] = val;
          this._applySingleCustomNote(key, val);
          this._debouncedAutoSave();
        }
      };

      el.addEventListener('blur', handleEdit);
    });
  }

  _debouncedAutoSave() {
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      this.saveCurrentTrackStudy(false);
    }, 800);
  }

  saveCurrentTrackStudy(notify = true) {
    if (!this.selectedTrackId) return;

    // Collect any actively focused editable fields
    if (this.container) {
      const activeEl = this.container.querySelector('.editable-note:focus, .editable-field:focus');
      if (activeEl && activeEl.dataset.editKey) {
        const key = activeEl.dataset.editKey;
        const val = activeEl.innerText.trim();
        this.customNotes[key] = val;
        this._applySingleCustomNote(key, val);
      }
    }

    const sampleSlice = Array.isArray(this.telemetrySamples) && this.telemetrySamples.length > 0
      ? this.telemetrySamples.slice(-1500).map(s => ({
          x: s.motion?.position?.x ?? s.positionX ?? s.posX ?? s.x ?? 0,
          z: s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? s.z ?? (s.motion?.position?.y !== undefined ? s.motion.position.y : (s.y ?? 0)),
          speed: s.motion?.speedMps ?? s.speed ?? (s.motion?.speedMph ? s.motion.speedMph / 2.23694 : ((s.speedMph || 0) / 2.23694)),
          speedMph: s.motion?.speedMph ?? s.speedMph ?? (s.motion?.speedMps ? s.motion.speedMps * 2.23694 : ((s.speed || 0) * 2.23694)),
          throttle: s.inputs?.throttle !== undefined ? (s.inputs.throttle <= 1 ? s.inputs.throttle * 100 : s.inputs.throttle) : (s.throttle !== undefined ? (s.throttle <= 1 ? s.throttle * 100 : s.throttle) : 0),
          brake: s.inputs?.brake !== undefined ? (s.inputs.brake <= 1 ? s.inputs.brake * 100 : s.inputs.brake) : (s.brake !== undefined ? (s.brake <= 1 ? s.brake * 100 : s.brake) : 0),
          steer: s.inputs?.steering !== undefined ? s.inputs.steering : (s.steer !== undefined ? s.steer : (s.steerAngle || 0)),
          gLat: s.motion?.acceleration?.lateralG ?? s.gLat ?? s.accelLateral ?? 0,
          lapNumber: s.timing?.lapNumber ?? s.lapNumber ?? 1
        }))
      : [];

    const stateToSave = {
      unlockedPhases: Array.from(this.unlockedPhases),
      lapsCompleted: this.lapsCompleted,
      lastPhase: this.currentPhase,
      customNotes: this.customNotes || {},
      corners: this.currentTrackProfile?.corners || this.studyData?.phase1_macro?.corners || [],
      circuit: this.studyData?.circuit || { name: this.currentTrackProfile?.trackName || 'Circuit' },
      telemetrySamples: sampleSlice,
      updatedAt: new Date().toISOString()
    };

    trackStudyLibrary.saveTrackStudyState(this.selectedTrackId, stateToSave);

    // Sync live data with Track Editor if available
    if (window.apexApp?.trackEditor && window.apexApp.trackEditor.currentTrackId === this.selectedTrackId) {
      window.apexApp.trackEditor.loadTrack(this.selectedTrackId);
    }

    // Update status badge in header
    const statusPill = this.container?.querySelector('#study-save-status');
    if (statusPill) {
      statusPill.style.display = 'inline-block';
      statusPill.textContent = 'SAVED ✓';
      statusPill.classList.add('saved-active');
      if (this._statusTimer) clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        statusPill.classList.remove('saved-active');
      }, 2500);
    }

    if (notify && window.PitToast) {
      const trackName = this.studyData?.circuit?.name || this.currentTrackProfile?.trackName || 'Circuit';
      window.PitToast.success(`Persisted custom notes and telemetry data for ${trackName}.`, 'TRACK STUDY SAVED');
    }
  }

  _computeLapsFromSamples(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return 0;
    
    let maxLap = 0;
    const distinctLaps = new Set();
    let prevLastLapTime = 0;
    let completedFromLapTimes = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const lap = s.timing?.lapNumber !== undefined 
        ? s.timing.lapNumber 
        : (s.lapNumber !== undefined 
            ? s.lapNumber 
            : (s.timing?.rawLapNumber !== undefined ? s.timing.rawLapNumber + 1 : null));
      
      if (lap !== null && lap > 0) {
        distinctLaps.add(lap);
        if (lap > maxLap) maxLap = lap;
      }

      const lastLapTime = s.timing?.lastLapTime !== undefined 
        ? s.timing.lastLapTime 
        : (s.lastLapTime !== undefined ? s.lastLapTime : 0);
      
      if (lastLapTime > 0 && Math.abs(lastLapTime - prevLastLapTime) > 0.05) {
        completedFromLapTimes++;
        prevLastLapTime = lastLapTime;
      }
    }

    const completedFromLapNumbers = maxLap > 1 ? maxLap - 1 : (distinctLaps.size > 1 ? distinctLaps.size - 1 : 0);
    return Math.max(completedFromLapNumbers, completedFromLapTimes);
  }

  resetCurrentTrackStudy() {
    // 1. Clear independent storage for this circuit
    trackStudyLibrary.resetTrackStudyState(this.selectedTrackId);

    // 2. Purge all collected telemetry data and live tracking state
    this.telemetrySamples = [];
    this.liveTelemetryActive = false;
    this.hasNotifiedLiveSync = false;
    this.activeCornerNumber = null;
    this.selectedCornerNumber = 1;

    // 3. Reset lap tracking state
    this.lapsCompleted = 0;
    this._prevLapNumber = null;
    this._prevLastLapTime = null;
    this._prevNormPos = null;
    this._sessionBaseLap = undefined;
    this._lastSampleLap = undefined;

    // 4. Reset 5-stage sequential progression & laps completed to 0
    this.unlockedPhases = new Set([1]);
    this.hasCompletedBriefing = false;
    this.currentPhase = 1;
    this._hasAutoDownloadedPdf = false;

    // 5. Reset UI header live indicators & metrics strip to standby empty state
    if (this.container) {
      const statusPill = this.container.querySelector('#study-live-status-pill');
      const statusDot = this.container.querySelector('#study-live-status-dot');
      const statusTxt = this.container.querySelector('#study-live-status-text');
      const metricsStrip = this.container.querySelector('#study-live-metrics-strip');
      const lapVal = this.container.querySelector('#study-live-lap-val');
      const speedVal = this.container.querySelector('#study-live-speed-val');
      const turnVal = this.container.querySelector('#study-live-turn-val');

      if (statusPill) statusPill.classList.remove('live-active');
      if (statusDot) statusDot.className = 'status-dot';
      if (statusTxt) statusTxt.textContent = 'STANDBY // READY';
      if (metricsStrip) metricsStrip.style.display = 'none';
      if (lapVal) lapVal.textContent = '0';
      if (speedVal) speedVal.textContent = '0';
      if (turnVal) turnVal.textContent = '-';

      // Clear any active on-track corner spotlights
      this._highlightActiveCorner(null);
    }

    // 6. Re-generate pristine baseline study from catalog profile with zero telemetry
    const profile = trackStudyLibrary.getTrackStudyProfile(this.selectedTrackId);
    if (profile) {
      this.currentTrackProfile = profile;
      this.studyData = this.engine.generateStudy(profile, []);
    }

    // 7. Save pristine empty state with 0 laps completed in store
    trackStudyLibrary.saveTrackStudyState(this.selectedTrackId, {
      unlockedPhases: [1],
      lapsCompleted: 0,
      lastPhase: 1
    });

    // 8. Update readiness meter (0% - 0/5 Laps) and re-render Phase 1
    this.updateReadinessMeter();
    this.render();

    // 9. Notify user via PitToast
    if (window.PitToast) {
      const trackName = this.studyData?.circuit?.name || 'Circuit';
      window.PitToast.info(`Collected data & lap count for ${trackName} reset to 0 laps.`, 'STUDY RESET');
    }
  }

  updateReadinessMeter() {
    if (!this.container) return;
    const completedStages = Math.min(5, this.lapsCompleted);
    const pct = Math.min(100, Math.round((completedStages / 5) * 100));

    const badge = this.container.querySelector('#study-readiness-badge');
    if (badge) badge.textContent = `${pct}% (${completedStages}/5 LAPS COMPLETED)`;

    const fill = this.container.querySelector('#study-readiness-fill');
    if (fill) fill.style.width = `${pct}%`;

    // Update locked & reviewed states on stepper buttons
    const stepBtns = this.container.querySelectorAll('.study-step-btn');
    stepBtns.forEach(btn => {
      const step = parseInt(btn.dataset.step, 10);
      const isUnlocked = this.unlockedPhases.has(step);
      const isCompleted = this.lapsCompleted >= step;
      const isActive = step === this.currentPhase;

      btn.classList.toggle('active', isActive);
      btn.classList.toggle('locked', !isUnlocked);
      btn.classList.toggle('reviewed', isCompleted);
      btn.disabled = !isUnlocked;
      
      if (!isUnlocked) {
        btn.setAttribute('title', `Complete ${step - 1} Lap${step - 1 > 1 ? 's' : ''} on-track to Unlock Stage ${step}`);
      } else {
        btn.setAttribute('title', isCompleted ? `Stage ${step} Passed (${this.lapsCompleted}/5 Laps)` : `Stage ${step} (Drive ${step} Lap${step > 1 ? 's' : ''} to Pass)`);
      }
    });
  }

  setPhase(stepNumber) {
    if (!this.unlockedPhases.has(stepNumber)) {
      if (window.PitToast) {
        window.PitToast.warning(`Stage ${stepNumber} is locked. Complete ${stepNumber - 1} lap${stepNumber - 1 > 1 ? 's' : ''} on-track first.`, 'STAGE LOCKED');
      }
      return;
    }

    this.currentPhase = stepNumber;
    trackStudyLibrary.saveTrackStudyState(this.selectedTrackId, {
      unlockedPhases: Array.from(this.unlockedPhases),
      lapsCompleted: this.lapsCompleted,
      lastPhase: this.currentPhase
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
    if (subEl) {
      const km = this.studyData.circuit.lengthKm || (this.studyData.circuit.lengthMeters / 1000).toFixed(2);
      subEl.textContent = `${this.studyData.circuit.layout} // ${km} KM (${this.studyData.circuit.lengthMeters}M) // ${this.studyData.circuit.turnsCount} CORNERS`;
    }

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

    // Sync PDF Export Button State (Block if no telemetry data)
    this._updateExportButtonState();
  }

  _updateExportButtonState() {
    if (!this.container) return;
    const btnExport = this.container.querySelector('#btn-study-export-pdf');
    if (!btnExport) return;

    const hasTelemetryData = (this.studyData?.phase1_macro?.corners?.length > 0) ||
                             (this.currentTrackProfile?.corners?.length > 0);

    if (!hasTelemetryData) {
      btnExport.disabled = true;
      btnExport.classList.add('disabled-telemetry-required');
      btnExport.setAttribute('title', 'Telemetry Required: Drive laps on this circuit in Live UDP mode or upload a stint to enable PDF dossier export');
      btnExport.innerHTML = '<span class="btn-icon">🔒</span> EXPORT PDF (TELEMETRY REQUIRED)';
    } else {
      btnExport.disabled = false;
      btnExport.classList.remove('disabled-telemetry-required');
      btnExport.setAttribute('title', 'Export 5-Page Track Study PDF Dossier');
      btnExport.innerHTML = '<span class="btn-icon">📄</span> EXPORT 5-PHASE STUDY PDF';
    }
  }

  // ---------------------------------------------------------------------------
  // ON-TRACK TELEMETRY LAP GATE CARD COMPONENT
  // ---------------------------------------------------------------------------
  _renderLapGateCard(phaseNum, title) {
    const isStagePassed = this.lapsCompleted >= phaseNum;
    const lapsRemaining = Math.max(0, phaseNum - this.lapsCompleted);

    let lapNodesHtml = '';
    for (let i = 1; i <= 5; i++) {
      let nodeClass = 'locked';
      let nodeStatus = 'LOCKED';
      if (this.lapsCompleted >= i) {
        nodeClass = 'passed';
        nodeStatus = 'PASSED ✓';
      } else if (this.lapsCompleted === i - 1) {
        nodeClass = 'active';
        nodeStatus = 'IN PROGRESS';
      }

      lapNodesHtml += `
        <div class="lap-node-item ${nodeClass}">
          <span class="lap-node-title">LAP ${i}</span>
          <span class="lap-node-status">${nodeStatus}</span>
        </div>
      `;
    }

    const progressPct = Math.min(100, Math.round((Math.min(this.lapsCompleted, phaseNum) / phaseNum) * 100));

    return `
      <div class="phase-card phase-lap-gate-card chamfer-br ${isStagePassed ? 'passed' : 'pending'}">
        <div class="lap-gate-header-row">
          <div class="lap-gate-title-wrap">
            <span class="lap-gate-badge ${isStagePassed ? 'passed' : ''}">STAGE ${phaseNum} TELEMETRY GATE</span>
            <span class="font-bold text-white">${phaseNum} LAP${phaseNum > 1 ? 'S' : ''} ON-TRACK REQUIRED // ${title.toUpperCase()}</span>
          </div>
          <span class="lap-gate-status-tag ${isStagePassed ? 'completed' : ''}">
            ${isStagePassed ? `STAGE ${phaseNum} PASSED (${this.lapsCompleted} LAPS LOGGED) ✓` : `PENDING // ${lapsRemaining} MORE LAP${lapsRemaining > 1 ? 'S' : ''} REQUIRED`}
          </span>
        </div>
        <div class="lap-gate-progress-wrap">
          <div class="lap-gate-progress-bar-bg">
            <div class="lap-gate-progress-bar-fill" style="width: ${progressPct}%"></div>
          </div>
          <div class="lap-nodes-row">
            ${lapNodesHtml}
          </div>
        </div>
        <div class="lap-gate-footer">
          <span class="lap-gate-desc text-secondary text-xs font-mono">
            ${isStagePassed 
              ? (phaseNum < 5 ? `✓ Stage ${phaseNum} requirement met with ${this.lapsCompleted} recorded laps. Stage ${phaseNum + 1} unlocked.` : `✓ All 5 stages certified! Full track dossier ready for export.`)
              : `Drive on-track in Forza Motorsport / Live UDP mode or upload a stint to record lap data and unlock Stage ${phaseNum < 5 ? phaseNum + 1 : 'Certification'}.`
            }
          </span>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // PHASE 1: MACRO CORNER GRADING
  // ---------------------------------------------------------------------------
  _renderPhase1(container) {
    const macro = this.studyData.phase1_macro;
    const hasCorners = macro.corners && macro.corners.length > 0;
    const sortedCorners = hasCorners ? [...macro.corners].sort((a, b) => a.priorityRank - b.priorityRank) : [];

    let rowsHtml = '';
    if (hasCorners) {
      rowsHtml = sortedCorners.map(c => `
        <tr class="study-table-row ${c.number === this.selectedCornerNumber ? 'selected' : ''}" data-turn="${c.number}">
          <td><span class="rank-badge ${c.priorityRank <= 3 ? 'top-rank' : ''}">#${c.priorityRank}</span></td>
          <td class="font-bold text-accent">Turn ${c.number}</td>
          <td><span class="type-pill ${c.type.toLowerCase().replace(/\s+/g, '-')}">${c.type}</span></td>
          <td>${c.radius}m</td>
          <td>${c.apexSpeedKmh || Math.round(c.apexSpeedMph * 1.60934)} km/h</td>
          <td class="font-mono ${c.followingStraightMeters > 300 ? 'text-green' : ''}">${c.followingStraightMeters} m</td>
          <td class="font-bold text-cyan">+${c.compoundLeverageSec}s</td>
          <td class="text-secondary text-sm">
            <span class="editable-note" data-edit-key="phase1.turn.${c.number}.discipline" contenteditable="true" title="Click to edit driver discipline strategy">${c.disciplineAdvice}</span>
          </td>
        </tr>
      `).join('');
    } else {
      rowsHtml = `
        <tr>
          <td colspan="8" class="text-center text-secondary font-mono" style="padding: 32px 16px;">
            AWAITING TELEMETRY // Drive laps on this circuit in Live UDP mode or upload a stint to dynamically parse real corner apexes, speeds, and straights.
          </td>
        </tr>
      `;
    }

    const lapGateCard = this._renderLapGateCard(1, 'Macro Priorities & Exit Speed Commitment');

    container.innerHTML = `
      <div class="phase-grid-layout">
        <div class="phase-card lead-banner chamfer-br">
          <div class="card-header">
            <span class="phase-tag">PHASE 1: MACRO CORNER GRADING & PRIORITY</span>
            <span class="coverage-tag">${macro.straightsCoveragePct}% FULL THROTTLE / STRAIGHTS</span>
          </div>
          <p class="phase-mandate-text"><strong>TACTICAL MANDATE:</strong> <span class="editable-note" data-edit-key="phase1.mandate" contenteditable="true" title="Click to edit tactical mandate">${macro.strategySummary}</span></p>
          <div class="kpi-mini-grid">
            <div class="kpi-item">
              <span class="kpi-label">LONGEST ACCELERATION</span>
              <span class="kpi-val text-gold">${hasCorners ? `T${macro.longestStraight.fromCorner} → T${macro.longestStraight.toCorner} (${macro.longestStraight.distanceMeters} m)` : 'Awaiting Telemetry'}</span>
            </div>
            <div class="kpi-item">
              <span class="kpi-label">TOTAL FULL THROTTLE DISTANCE</span>
              <span class="kpi-val text-green">${hasCorners ? `${macro.totalStraightMeters} meters` : 'Pending On-Track Data'}</span>
            </div>
            <div class="kpi-item">
              <span class="kpi-label">SKIP BARBER TIME RULE</span>
              <span class="kpi-val text-cyan">+1 km/h Exit = +0.28 m/s compounding advantage</span>
            </div>
          </div>
        </div>

        <div class="phase-card data-table-card chamfer-br">
          <div class="card-header">
            <span class="card-title">CORNER PRIORITY & TIME LEVERAGE MATRIX</span>
            <span class="text-muted text-xs">${hasCorners ? `${macro.corners.length} Real Turns Detected from Telemetry` : 'Awaiting Vehicle Telemetry'}</span>
          </div>
          <div class="study-table-wrap">
            <table class="study-data-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>TURN</th>
                  <th>CLASSIFICATION</th>
                  <th>RADIUS</th>
                  <th>APEX KM/H</th>
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

        ${lapGateCard}
      </div>
    `;

    this._bindRowSelection(container);
    this._bindEditableFields(container);
  }

  // ---------------------------------------------------------------------------
  // PHASE 2: SURFACE RECONNAISSANCE
  // ---------------------------------------------------------------------------
  _renderPhase2(container) {
    const surface = this.studyData.phase2_surface;
    const hasCorners = surface.corners && surface.corners.length > 0;

    let cardsHtml = '';
    if (hasCorners) {
      cardsHtml = surface.corners.map(s => `
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
            <span class="recon-note-text editable-note" data-edit-key="phase2.turn.${s.number}.reconNote" contenteditable="true" title="Click to edit surface recon advisory">${s.reconNote}</span>
          </div>
        </div>
      `).join('');
    } else {
      cardsHtml = `
        <div class="phase-card text-center text-secondary font-mono" style="grid-column: 1 / -1; padding: 32px 16px;">
          AWAITING TELEMETRY // Pavement banking, camber angles, and elevation compressions will be mapped dynamically once on-track telemetry is recorded.
        </div>
      `;
    }

    const lapGateCard = this._renderLapGateCard(2, 'Surface Reconnaissance & Camber Intelligence');

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

        ${lapGateCard}
      </div>
    `;

    this._bindEditableFields(container);
  }

  // ---------------------------------------------------------------------------
  // PHASE 3: REFERENCE POINTS
  // ---------------------------------------------------------------------------
  _renderPhase3(container) {
    const ref = this.studyData.phase3_reference;
    const hasCorners = ref.corners && ref.corners.length > 0;

    let rowsHtml = '';
    if (hasCorners) {
      rowsHtml = ref.corners.map(r => `
        <tr class="study-table-row" data-turn="${r.number}">
          <td class="font-bold text-accent">Turn ${r.number}</td>
          <td>
            <span class="font-bold ${r.brakePoint.isThresholdBraking ? 'text-red' : 'text-cyan'}">${r.brakePoint.distanceBeforeTurnInM}m</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase3.turn.${r.number}.brakeMarker" contenteditable="true" title="Click to edit braking visual cue">${r.brakePoint.markerText}</span>
            </div>
          </td>
          <td>
            <span class="font-bold text-cyan">${r.turnIn.targetKmh || Math.round(r.turnIn.targetMph * 1.60934)} km/h</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase3.turn.${r.number}.turnInAnchor" contenteditable="true" title="Click to edit turn-in visual anchor">${r.turnIn.visualAnchor}</span>
            </div>
          </td>
          <td>
            <span class="font-bold text-green">${r.apex.targetKmh || Math.round(r.apex.targetMph * 1.60934)} km/h // Yaw: ${r.apex.yawAngleTargetDeg}°</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase3.turn.${r.number}.apexAttitude" contenteditable="true" title="Click to edit apex attitude check">${r.apex.attitudeCheck}</span>
            </div>
          </td>
          <td>
            <span class="waypoint-pill ${r.waypoint.needed ? 'required' : 'none'}">${r.waypoint.needed ? 'WAYPOINT NEEDED' : 'DIRECT LINE'}</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase3.turn.${r.number}.waypoint" contenteditable="true" title="Click to edit waypoint landmark">${r.waypoint.landmark}</span>
            </div>
          </td>
          <td>
            <span class="font-bold">${r.trackOut.targetKmh || Math.round(r.trackOut.targetMph * 1.60934)} km/h</span> (Margin: ${r.trackOut.marginSafetyM || '0.5'}m)
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase3.turn.${r.number}.trackOut" contenteditable="true" title="Click to edit track-out target">${r.trackOut.visualTarget}</span>
            </div>
          </td>
        </tr>
      `).join('');
    } else {
      rowsHtml = `
        <tr>
          <td colspan="6" class="text-center text-secondary font-mono" style="padding: 32px 16px;">
            AWAITING TELEMETRY // Braking markers, turn-in points, and apex attitudes will be calculated directly from telemetry data.
          </td>
        </tr>
      `;
    }

    const lapGateCard = this._renderLapGateCard(3, 'Visual Reference Points & Sight Pictures');

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
            <span class="text-muted text-xs">${hasCorners ? `${ref.corners.length} Corner Anchors Mapped` : 'Awaiting Telemetry'}</span>
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

        ${lapGateCard}
      </div>
    `;

    this._bindEditableFields(container);
  }

  // ---------------------------------------------------------------------------
  // PHASE 4: ORDER OF EFFORT
  // ---------------------------------------------------------------------------
  _renderPhase4(container) {
    const ooe = this.studyData.phase4_orderOfEffort;
    const hasCorners = ooe.corners && ooe.corners.length > 0;

    let rowsHtml = '';
    if (hasCorners) {
      rowsHtml = ooe.corners.map(c => `
        <tr class="study-table-row" data-turn="${c.number}">
          <td class="font-bold text-accent">Turn ${c.number}</td>
          <td><span class="type-pill ${c.type.toLowerCase().replace(/\s+/g, '-')}">${c.type}</span></td>
          <td>
            <span class="font-bold text-gold">${c.step1_lineStrategy.approach}</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase4.turn.${c.number}.earlyApex" contenteditable="true" title="Click to edit line strategy consequence">${c.step1_lineStrategy.earlyApexConsequence || 'Late Apex Focus'}</span>
            </div>
          </td>
          <td>
            <span class="font-bold text-green">TAP: ${c.step2_exitThrottle.tapDistanceBeforeApexM}m before apex</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase4.turn.${c.number}.tapNote" contenteditable="true" title="Click to edit throttle commit cue">${c.step2_exitThrottle.squeezeRateText}</span>
            </div>
          </td>
          <td>
            <span class="font-bold text-cyan">${c.step3_brakingProcedure.thresholdPressureKg || 60} kg // ${c.step3_brakingProcedure.trailBrakingSec}s Trail</span>
            <div class="sub-text text-muted">
              <span class="editable-note" data-edit-key="phase4.turn.${c.number}.brakeStyle" contenteditable="true" title="Click to edit braking procedure">${c.step3_brakingProcedure.brakeStyle}</span>
            </div>
          </td>
        </tr>
      `).join('');
    } else {
      rowsHtml = `
        <tr>
          <td colspan="5" class="text-center text-secondary font-mono" style="padding: 32px 16px;">
            AWAITING TELEMETRY // Corner discipline, throttle application timing, and trail-braking pressure will be computed from vehicle telemetry.
          </td>
        </tr>
      `;
    }

    const lapGateCard = this._renderLapGateCard(4, 'Planning the Order of Effort');

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
              <p class="step-desc">Use "The Procedure": lock in threshold force first, then advance brake points in 1.0m bites.</p>
            </div>
          </div>
        </div>

        <div class="phase-card data-table-card chamfer-br">
          <div class="card-header">
            <span class="card-title">CORNER EXECUTION TARGETS (LINE → EXIT THROTTLE → ENTRY BRAKING)</span>
            <span class="text-muted text-xs">${hasCorners ? `${ooe.corners.length} Turns Structured` : 'Awaiting Telemetry'}</span>
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

        ${lapGateCard}
      </div>
    `;

    this._bindEditableFields(container);
  }

  // ---------------------------------------------------------------------------
  // PHASE 5: HARDWARE & STINT PREP
  // ---------------------------------------------------------------------------
  _renderPhase5(container) {
    const hw = this.studyData.phase5_hardware;
    const hasGears = hw.gearingMatrix && hw.gearingMatrix.length > 0;

    let gearRowsHtml = '';
    if (hasGears) {
      gearRowsHtml = hw.gearingMatrix.map(g => `
        <tr>
          <td class="font-bold text-accent">${g.turn}</td>
          <td class="font-bold text-cyan">GEAR ${g.gear}</td>
          <td>${g.minSpeedKmh || Math.round(g.minSpeedMph * 1.60934)} km/h</td>
          <td class="text-secondary">
            <span class="editable-note" data-edit-key="phase5.turn.${g.turn}.shiftNote" contenteditable="true" title="Click to edit shift note">${g.shiftNote}</span>
          </td>
        </tr>
      `).join('');
    } else {
      gearRowsHtml = `
        <tr>
          <td colspan="4" class="text-center text-secondary font-mono" style="padding: 24px 16px;">
            Turn gearing will be populated once vehicle telemetry is parsed.
          </td>
        </tr>
      `;
    }

    const lapGateCard = this._renderLapGateCard(5, 'Hardware, Tire Thermals & Racecraft Final Certification');

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
                <span class="hw-val text-green font-bold">${hw.tireThermalManagement.operatingWindowC || '90°C – 115°C'}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Pace Lap Warm-up:</span>
                <span class="hw-desc editable-note" data-edit-key="phase5.tireWarmup" contenteditable="true" title="Click to edit warm-up advice">${hw.tireThermalManagement.paceLapWarmupTactic}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Slip Angle Limits:</span>
                <span class="hw-desc">${hw.tireThermalManagement.slipAngleWindow}</span>
              </div>
              <div class="hw-item">
                <span class="hw-lbl">Cold-to-Hot Pressure Gain:</span>
                <span class="hw-val text-cyan font-mono">+${hw.tireThermalManagement.coldToHotTargetPressureGainBar || '0.30 bar (30 kPa)'} per axle</span>
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
                <span class="hw-desc editable-note" data-edit-key="phase5.brakeTuning" contenteditable="true" title="Click to edit dynamic brake tuning note">${hw.brakeSystemManagement.dynamicAdjustmentTactic}</span>
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
            <span class="card-title">3. GEARING & RPM POWERBAND RECON</span>
          </div>
          <div class="study-table-wrap">
            <table class="study-data-table">
              <thead>
                <tr>
                  <th>TURN</th>
                  <th>TARGET GEAR</th>
                  <th>APEX KM/H</th>
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

        ${lapGateCard}
      </div>
    `;

    this._bindEditableFields(container);
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

    const hasTelemetryData = (this.studyData.phase1_macro?.corners?.length > 0) ||
                             (this.currentTrackProfile?.corners?.length > 0);

    if (!hasTelemetryData) {
      const msg = 'PDF Dossier export blocked: No telemetry data recorded for this track yet. Drive laps in Live mode or upload a stint to map track turns.';
      if (window.PitToast) {
        window.PitToast.warning(msg, 'TELEMETRY REQUIRED');
      } else {
        alert(msg);
      }
      return;
    }

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
      const filename = `APEX_5Phase_Track_Study_${safeName}.pdf`;
      
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Auto-archive a permanent copy on the server / app data directory
      trackStudyLibrary.archivePdfToServer(this.selectedTrackId, pdfBytes, filename).then(res => {
        if (res && res.success) {
          console.log(`[TrackStudyView] Archived PDF dossier to server: ${res.filename}`);
        }
      }).catch(err => {
        console.warn('[TrackStudyView] Server PDF archive non-blocking warning:', err);
      });

      if (window.PitToast) {
        window.PitToast.success(`Exported & Archived ${filename}`, 'PDF SAVED & ARCHIVED');
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
        this._updateExportButtonState();
      }
    }
  }

  onTelemetrySample(sample) {
    if (!sample) return;
    this.liveTelemetryActive = true;
    if (this.telemetrySamples.length < 3000) {
      this.telemetrySamples.push(sample);
    }

    // 1. Process automatic lap progress detection from telemetry signals
    this._trackLapProgress(sample);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Throttled Dynamic Telemetry Ingestion (at most once every 4 seconds)
    if (this.currentTrackProfile && this.telemetrySamples.length >= 30 && (!this._lastAnalysisTime || (now - this._lastAnalysisTime > 4000))) {
      this._lastAnalysisTime = now;
      try {
        const updatedStudy = this.engine.generateStudy(this.currentTrackProfile, this.telemetrySamples);
        const prevTurnCount = this.studyData?.phase1_macro?.corners?.length || 0;
        const newTurnCount = updatedStudy?.phase1_macro?.corners?.length || 0;

        if (newTurnCount > 0 && newTurnCount !== prevTurnCount) {
          this.studyData = updatedStudy;
          this.currentTrackProfile.corners = updatedStudy.phase1_macro.corners;
          this.currentTrackProfile.turnsCount = newTurnCount;
          trackStudyLibrary.updateTrackProfile(this.selectedTrackId, this.currentTrackProfile);
          if (this.container && this.container.style.display !== 'none') {
            this.render();
          }
          if (window.PitToast) {
            window.PitToast.info(`Telemetry parsed: ${newTurnCount} corners mapped for ${this.studyData.circuit.name}`, 'TRACK MAPPED');
          }
        }
      } catch (err) {
        console.warn('[TrackStudyView] Dynamic telemetry parsing error:', err);
      }
    }

    // Throttle UI updates to 10Hz and skip DOM queries if container is hidden or absent
    if (!this.container || this.container.style.display === 'none') return;
    if (this._lastUiUpdateTime && (now - this._lastUiUpdateTime < 100)) return;
    this._lastUiUpdateTime = now;

    // Update status pill & dot
    const statusPill = this.container.querySelector('#study-live-status-pill');
    const statusDot = this.container.querySelector('#study-live-status-dot');
    const statusTxt = this.container.querySelector('#study-live-status-text');
    const metricsStrip = this.container.querySelector('#study-live-metrics-strip');

    if (statusPill && !statusPill.classList.contains('live-active')) statusPill.classList.add('live-active');
    if (statusDot && statusDot.className !== 'status-dot live') statusDot.className = 'status-dot live';
    if (statusTxt && statusTxt.textContent !== 'TELEMETRY SYNC ACTIVE') statusTxt.textContent = 'TELEMETRY SYNC ACTIVE';
    if (metricsStrip && metricsStrip.style.display !== 'inline-flex') metricsStrip.style.display = 'inline-flex';

    // Update Lap & Speed metrics (Metric KM/H)
    const lapVal = this.container.querySelector('#study-live-lap-val');
    const speedVal = this.container.querySelector('#study-live-speed-val');
    const turnVal = this.container.querySelector('#study-live-turn-val');

    const sampleLap = sample.timing?.lapNumber !== undefined 
      ? sample.timing.lapNumber 
      : (sample.lapNumber !== undefined 
          ? sample.lapNumber 
          : (sample.timing?.rawLapNumber !== undefined ? sample.timing.rawLapNumber + 1 : 1));

    const displayLap = Math.max(sampleLap, this.lapsCompleted + 1);
    const speedKmh = Math.round(sample.speedKmh ? sample.speedKmh : (sample.speedMps ? sample.speedMps * 3.6 : (sample.speedMph ? sample.speedMph * 1.60934 : 0)));

    if (lapVal && lapVal.textContent !== String(displayLap)) lapVal.textContent = displayLap;
    if (speedVal && speedVal.textContent !== String(speedKmh)) speedVal.textContent = speedKmh;

    // Detect and highlight current on-track corner
    const cornerNum = this._detectCurrentCorner(sample);
    if (cornerNum) {
      if (turnVal && turnVal.textContent !== `T${cornerNum}`) turnVal.textContent = `T${cornerNum}`;
      this._highlightActiveCorner(cornerNum);
    } else {
      if (turnVal && turnVal.textContent !== 'STR') turnVal.textContent = 'STR';
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

  _trackLapProgress(sample) {
    if (!sample) return;

    // 1. Extract lap number from telemetry
    const sampleLap = sample.timing?.lapNumber !== undefined 
      ? sample.timing.lapNumber 
      : (sample.lapNumber !== undefined 
          ? sample.lapNumber 
          : (sample.timing?.rawLapNumber !== undefined ? sample.timing.rawLapNumber + 1 : null));

    // 2. Extract last lap time
    const lastLapTime = sample.timing?.lastLapTime !== undefined 
      ? sample.timing.lastLapTime 
      : (sample.lastLapTime !== undefined ? sample.lastLapTime : 0);

    // 3. Extract normalized position or distance
    const trackLen = this.currentTrackProfile?.lengthMeters || this.studyData?.circuit?.lengthMeters || 4000;
    let normPos = sample.normalizedLapPosition !== undefined 
      ? sample.normalizedLapPosition 
      : (sample.lapDistanceMeters !== undefined ? (sample.lapDistanceMeters % trackLen) / trackLen : null);

    let lapCompletedEvent = false;

    // Signal A: Telemetry Lap Number incremented
    if (sampleLap !== null) {
      if (this._prevLapNumber !== null && sampleLap > this._prevLapNumber) {
        lapCompletedEvent = true;
      }
      this._prevLapNumber = sampleLap;
    }

    // Signal B: Last Lap Time updated with a new valid lap duration
    if (lastLapTime > 0) {
      if (this._prevLastLapTime !== null && this._prevLastLapTime > 0 && Math.abs(lastLapTime - this._prevLastLapTime) > 0.05) {
        lapCompletedEvent = true;
      }
      this._prevLastLapTime = lastLapTime;
    } else if (this._prevLastLapTime === null) {
      this._prevLastLapTime = 0;
    }

    // Signal C: Normalized lap position wrap-around from > 0.85 to < 0.15 with forward motion
    const speedKmh = sample.speedKmh || (sample.speedMps ? sample.speedMps * 3.6 : (sample.speedMph ? sample.speedMph * 1.60934 : 0));
    if (normPos !== null && this._prevNormPos !== null && speedKmh > 15) {
      if (this._prevNormPos > 0.85 && normPos < 0.15) {
        lapCompletedEvent = true;
      }
    }
    this._prevNormPos = normPos;

    // Direct minimum baseline if game reports lapNumber >= 2
    let calculatedLaps = this.lapsCompleted;
    if (sampleLap !== null && sampleLap > 1) {
      calculatedLaps = Math.max(calculatedLaps, sampleLap - 1);
    }
    if (lapCompletedEvent) {
      calculatedLaps = Math.max(calculatedLaps, this.lapsCompleted + 1);
    }

    if (calculatedLaps > this.lapsCompleted) {
      this._applyLapsCompleted(calculatedLaps);
    }
  }

  _applyLapsCompleted(newLaps) {
    if (newLaps <= this.lapsCompleted) return;
    const prevLaps = this.lapsCompleted;
    this.lapsCompleted = newLaps;

    for (let s = 1; s <= Math.min(4, this.lapsCompleted); s++) {
      this.unlockedPhases.add(s + 1);
    }
    if (this.lapsCompleted >= 5) {
      this.hasCompletedBriefing = true;
    }

    // Automatically advance active stage view as laps progress
    // (Lap 1 -> Stage 2, Lap 2 -> Stage 3, Lap 3 -> Stage 4, Lap 4 -> Stage 5, Lap 5+ -> Stage 5)
    this.currentPhase = Math.min(5, this.lapsCompleted + 1);

    // Save comprehensive study state to persistent storage
    trackStudyLibrary.saveTrackStudyState(this.selectedTrackId, {
      unlockedPhases: Array.from(this.unlockedPhases),
      lapsCompleted: this.lapsCompleted,
      lastPhase: this.currentPhase,
      corners: this.currentTrackProfile?.corners || this.studyData?.phase1_macro?.corners || [],
      certified: this.lapsCompleted >= 5,
      updatedAt: new Date().toISOString()
    });

    this.updateReadinessMeter();
    if (this.container && this.container.style.display !== 'none') {
      this.render();
    }

    if (window.PitToast && this.lapsCompleted > prevLaps) {
      const newlyPassedStage = Math.min(5, this.lapsCompleted);
      const nextStage = newlyPassedStage < 5 ? newlyPassedStage + 1 : null;
      window.PitToast.success(
        `Lap ${this.lapsCompleted} completed! Stage ${newlyPassedStage} passed${nextStage ? ` — Advanced to Stage ${nextStage}` : ' — Track Study Certified'}!`,
        'STAGE REQUIREMENT MET'
      );
    }

    // Requirement: If 5 laps are completed in any track, save data & auto-download the 5-Phase PDF Dossier once
    if (this.lapsCompleted >= 5 && !this._hasAutoDownloadedPdf) {
      this._hasAutoDownloadedPdf = true;
      if (window.PitToast) {
        const trackName = this.studyData?.circuit?.name || this.currentTrackProfile?.trackName || 'Circuit';
        window.PitToast.info(
          `5 Laps completed on ${trackName}! Saved track study data & compiling 5-Phase PDF Dossier...`,
          '5 LAPS COMPLETED // DOSSIER READY'
        );
      }
      setTimeout(() => {
        this.exportDossierPdf().catch(err => {
          console.error('[TrackStudyView] Auto PDF export on 5 laps failed:', err);
        });
      }, 300);
    }
  }

  _detectCurrentCorner(sample) {
    if (!this.studyData?.phase1_macro?.corners) return null;
    const corners = this.studyData.phase1_macro.corners;
    if (corners.length === 0) return null;

    if (sample.activeCorner !== undefined && sample.activeCorner !== null) {
      return sample.activeCorner;
    }
    if (sample.cornerIndex !== undefined && sample.cornerIndex !== null) {
      return corners[sample.cornerIndex % corners.length]?.number || null;
    }

    const totalDist = this.currentTrackProfile?.lengthMeters || this.studyData.circuit?.lengthMeters || 5000;
    let lapDist = sample.lapDistanceMeters !== undefined ? sample.lapDistanceMeters : (sample.distanceMeters !== undefined ? sample.distanceMeters % totalDist : null);

    if (lapDist === null && sample.normalizedLapPosition !== undefined) {
      lapDist = sample.normalizedLapPosition * totalDist;
    }

    if (lapDist !== null && corners.length > 0) {
      const segmentSize = totalDist / corners.length;
      const cornerIdx = Math.floor(lapDist / segmentSize);
      const safeIdx = Math.min(Math.max(cornerIdx, 0), corners.length - 1);
      return corners[safeIdx].number;
    }

    return corners[0].number;
  }

  _highlightActiveCorner(cornerNumber) {
    if (this.activeCornerNumber === cornerNumber) return;
    this.activeCornerNumber = cornerNumber;
    if (!this.container || this.container.style.display === 'none') return;

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
