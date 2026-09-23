/**
 * APEX Circuit Strategist View
 * Interactive "What-If" Racecraft & Driving Line Studio (Frontend Controller)
 * Grounded in Skip Barber "Going Faster!" racecraft principles.
 */

import { CircuitStrategistEngine, CORNER_STRATEGY_TYPE } from './analysis/circuit-strategist.js';
import { LINE_ARCHETYPE } from './analysis/optimal-line-engine.js';
import { TOPOGRAPHY_RISK } from './analysis/elevation-dynamics.js';
import { trackLibraryStore } from './track-library-store.js';
import { StrategyPdfExporter } from './strategy-pdf-exporter.js';
import { getIcon } from './icons.js';

const STORAGE_PROFILES_KEY = 'apex_circuit_strategy_profiles_v1';

export class CircuitStrategistView {
  constructor() {
    this.engine = new CircuitStrategistEngine();
    this.currentTrack = null;
    this.currentCornerIndex = 0;
    this.activePreset = LINE_ARCHETYPE.LATE_APEX;
    this.activeProfileId = 'default';
    
    // Landmark Adjustments State
    this.adjustments = {
      deltaBrakeMeters: 0,
      deltaTurnInMeters: -4,
      apexDepthPercent: 0.68,
      deltaTapMeters: -8,
      deltaTrackOutMeters: 0,
      apexLateralOffset: 0.05, // 0 = inner curb, 1 = outer curb
      archetype: LINE_ARCHETYPE.LATE_APEX
    };

    // Canvas Interaction & Transform State
    this.transform = {
      zoom: 1.0,
      panX: 0,
      panY: 0
    };
    this.draggingPin = null;
    this.isPanning = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.hoveredPin = null;

    // Pin Screen Positions for Hit Testing
    this.pinScreenCoords = {
      B: { x: 0, y: 0, id: 'B', label: 'Brake', color: '#FF3B30' },
      I: { x: 0, y: 0, id: 'I', label: 'Turn-In', color: '#00E5FF' },
      A: { x: 0, y: 0, id: 'A', label: 'Apex', color: '#FFB800' },
      T: { x: 0, y: 0, id: 'T', label: 'TAP', color: '#00E676' },
      O: { x: 0, y: 0, id: 'O', label: 'Track-Out', color: '#D946EF' }
    };

    this.cacheDom();
    this.bindEvents();
    this.initTrackData();
  }

  cacheDom() {
    // Containers
    this.viewContainer = document.getElementById('view-circuit-strategist');
    
    // Header & Selectors
    this.trackSelect = document.getElementById('strategist-track-select');
    this.cornerSelect = document.getElementById('strategist-corner-select');
    this.profileSelect = document.getElementById('strategist-profile-select');
    this.btnSaveProfile = document.getElementById('btn-save-strategy-profile');
    this.btnDeleteProfile = document.getElementById('btn-delete-strategy-profile');

    this.btnPrevCorner = document.getElementById('btn-prev-corner');
    this.btnNextCorner = document.getElementById('btn-next-corner');
    this.btnResetStrategist = document.getElementById('btn-reset-strategist');
    this.btnExportPdf = document.getElementById('btn-export-strategy-pdf');
    this.btnReturnPitwall = document.getElementById('btn-return-pitwall-from-strategist');

    // Save Profile Modal Elements
    this.modalSaveProfile = document.getElementById('modal-save-strategy-profile');
    this.inputProfileName = document.getElementById('input-strategy-profile-name');
    this.inputProfileNotes = document.getElementById('input-strategy-profile-notes');
    this.btnConfirmSaveProfile = document.getElementById('btn-confirm-save-profile');
    this.btnCancelSaveProfile = document.getElementById('btn-cancel-save-profile');
    this.btnCloseSaveProfileModal = document.getElementById('btn-close-save-profile-modal');

    // Ticker Elements
    this.tickerCornerType = document.getElementById('ticker-corner-type');
    this.tickerLapDelta = document.getElementById('ticker-lap-delta');
    this.tickerExitSpeed = document.getElementById('ticker-exit-speed');
    this.tickerExitDelta = document.getElementById('ticker-exit-delta');
    this.tickerRadius = document.getElementById('ticker-radius');
    this.tickerEffectiveG = document.getElementById('ticker-effective-g');

    // Canvas & Viewport
    this.trackCanvas = document.getElementById('strategist-track-canvas');
    this.trackCtx = this.trackCanvas ? this.trackCanvas.getContext('2d') : null;
    this.telemetryCanvas = document.getElementById('strategist-telemetry-canvas');
    this.telemetryCtx = this.telemetryCanvas ? this.telemetryCanvas.getContext('2d') : null;
    this.frictionCanvas = document.getElementById('strategist-friction-canvas');
    this.frictionCtx = this.frictionCanvas ? this.frictionCanvas.getContext('2d') : null;
    this.elevationCanvas = document.getElementById('strategist-elevation-canvas');
    this.elevationCtx = this.elevationCanvas ? this.elevationCanvas.getContext('2d') : null;

    // Canvas Floating Controls
    this.btnZoomIn = document.getElementById('btn-canvas-zoom-in');
    this.btnZoomOut = document.getElementById('btn-canvas-zoom-out');
    this.btnResetView = document.getElementById('btn-canvas-reset-view');

    // Preset Buttons
    this.presetChips = document.querySelectorAll('.preset-chip');

    // Sliders
    this.sliderBrake = document.getElementById('slider-brake-point');
    this.sliderTurnIn = document.getElementById('slider-turn-in');
    this.sliderApexDepth = document.getElementById('slider-apex-depth');
    this.sliderTap = document.getElementById('slider-tap-point');
    this.sliderTrackOut = document.getElementById('slider-track-out');

    // Slider Value Readouts
    this.valBrake = document.getElementById('val-brake-point');
    this.valTurnIn = document.getElementById('val-turn-in');
    this.valApexDepth = document.getElementById('val-apex-depth');
    this.valTap = document.getElementById('val-tap-point');
    this.valTrackOut = document.getElementById('val-track-out');

    // Topography Risk Banner
    this.topographyBanner = document.getElementById('strategist-topography-banner');
    this.topographyText = document.getElementById('topography-banner-text');

    // Coaching Card
    this.coachingTitle = document.getElementById('strategist-coaching-title');
    this.coachingBody = document.getElementById('strategist-coaching-body');
  }

  bindEvents() {
    // Navigation back to pitwall
    if (this.btnReturnPitwall) {
      this.btnReturnPitwall.addEventListener('click', () => {
        if (window.apexApp && typeof window.apexApp.switchView === 'function') {
          window.apexApp.switchView('pitwall');
        }
      });
    }

    // Track Select Change
    if (this.trackSelect) {
      this.trackSelect.addEventListener('change', (e) => {
        this.selectTrack(e.target.value);
      });
    }

    // Corner Select Change
    if (this.cornerSelect) {
      this.cornerSelect.addEventListener('change', (e) => {
        this.selectCorner(parseInt(e.target.value, 10));
      });
    }

    // Prev / Next Corner Buttons
    if (this.btnPrevCorner) {
      this.btnPrevCorner.addEventListener('click', () => {
        this.selectCorner(this.currentCornerIndex - 1);
      });
    }
    if (this.btnNextCorner) {
      this.btnNextCorner.addEventListener('click', () => {
        this.selectCorner(this.currentCornerIndex + 1);
      });
    }

    // Profile Select Change
    if (this.profileSelect) {
      this.profileSelect.addEventListener('change', (e) => {
        this.loadProfile(e.target.value);
      });
    }

    // Save Profile Modal Trigger
    if (this.btnSaveProfile) {
      this.btnSaveProfile.addEventListener('click', () => {
        this.openSaveProfileModal();
      });
    }

    // Delete Profile Button
    if (this.btnDeleteProfile) {
      this.btnDeleteProfile.addEventListener('click', () => {
        this.deleteActiveProfile();
      });
    }

    // Save Profile Modal Confirm
    if (this.btnConfirmSaveProfile) {
      this.btnConfirmSaveProfile.addEventListener('click', () => {
        this.handleSaveProfileConfirm();
      });
    }

    // Close Save Profile Modal Buttons
    if (this.btnCancelSaveProfile) {
      this.btnCancelSaveProfile.addEventListener('click', () => {
        this.closeSaveProfileModal();
      });
    }
    if (this.btnCloseSaveProfileModal) {
      this.btnCloseSaveProfileModal.addEventListener('click', () => {
        this.closeSaveProfileModal();
      });
    }

    // Export Strategy PDF Button
    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => {
        this.exportStrategyPdf();
      });
    }

    // Reset Button
    if (this.btnResetStrategist) {
      this.btnResetStrategist.addEventListener('click', () => {
        this.resetAdjustments();
      });
    }

    // Preset Chips Click
    if (this.presetChips) {
      this.presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const archetype = chip.dataset.archetype;
          this.applyPreset(archetype);
        });
      });
    }

    // Sliders Input Events
    this.bindSlider(this.sliderBrake, 'deltaBrakeMeters', this.valBrake, 'm', (v) => `${v > 0 ? '+' : ''}${v}m`);
    this.bindSlider(this.sliderTurnIn, 'deltaTurnInMeters', this.valTurnIn, 'm', (v) => `${v > 0 ? '+' : ''}${v}m`);
    this.bindSlider(this.sliderApexDepth, 'apexDepthPercent', this.valApexDepth, '%', (v) => `${Math.round(v * 100)}% (${v > 0.6 ? 'Late' : v < 0.4 ? 'Early' : 'Geo'})`, 0.01);
    this.bindSlider(this.sliderTap, 'deltaTapMeters', this.valTap, 'm', (v) => `${v > 0 ? '+' : ''}${v}m`);
    this.bindSlider(this.sliderTrackOut, 'deltaTrackOutMeters', this.valTrackOut, 'm', (v) => `${v > 0 ? '+' : ''}${v}m`);

    // Canvas Mouse & Touch Events
    if (this.trackCanvas) {
      this.trackCanvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
      window.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
      window.addEventListener('mouseup', () => this.onCanvasMouseUp());
      this.trackCanvas.addEventListener('wheel', (e) => this.onCanvasWheel(e), { passive: false });

      // Touch events for tablets/touchscreens
      this.trackCanvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
      this.trackCanvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      this.trackCanvas.addEventListener('touchend', () => this.onCanvasMouseUp());
    }

    // Canvas Floating Zoom Buttons
    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', () => {
        this.transform.zoom = Math.min(3.0, this.transform.zoom * 1.25);
        this.render();
      });
    }
    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', () => {
        this.transform.zoom = Math.max(0.4, this.transform.zoom / 1.25);
        this.render();
      });
    }
    if (this.btnResetView) {
      this.btnResetView.addEventListener('click', () => {
        this.resetCanvasView();
      });
    }

    // Window Resize Observer for DPI scaling
    window.addEventListener('resize', () => {
      this.resizeCanvases();
      this.render();
    });
  }

  bindSlider(element, property, valDisplay, unit, formatter, stepMultiplier = 1) {
    if (!element) return;
    element.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) * stepMultiplier;
      this.adjustments[property] = val;
      if (valDisplay) {
        valDisplay.textContent = formatter ? formatter(val) : `${val}${unit}`;
      }
      this.render();
    });
  }

  // --- Profile Storage & Management ---
  getStoredProfiles() {
    try {
      const data = localStorage.getItem(STORAGE_PROFILES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('[CIRCUIT STRATEGIST] Error reading profiles from localStorage:', e);
      return {};
    }
  }

  saveStoredProfiles(profilesMap) {
    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(profilesMap));
    } catch (e) {
      console.warn('[CIRCUIT STRATEGIST] Error saving profiles to localStorage:', e);
    }
  }

  populateProfileDropdown() {
    if (!this.profileSelect || !this.currentTrack) return;
    const trackId = this.currentTrack.trackId;
    const allProfiles = this.getStoredProfiles();
    const trackProfiles = allProfiles[trackId] || [];

    this.profileSelect.innerHTML = '';
    
    // Default baseline option
    const defOpt = document.createElement('option');
    defOpt.value = 'default';
    defOpt.textContent = '[Baseline Strategy]';
    this.profileSelect.appendChild(defOpt);

    trackProfiles.forEach(prof => {
      const opt = document.createElement('option');
      opt.value = prof.id;
      opt.textContent = prof.name;
      this.profileSelect.appendChild(opt);
    });

    this.profileSelect.value = this.activeProfileId;
    if (this.btnDeleteProfile) {
      this.btnDeleteProfile.style.display = this.activeProfileId === 'default' ? 'none' : 'inline-block';
    }
  }

  openSaveProfileModal() {
    if (!this.modalSaveProfile) return;
    const corner = this.getCurrentCornerData();
    const presetName = this.activePreset.replace('_', ' ');
    if (this.inputProfileName) {
      this.inputProfileName.value = `T${corner.cornerNumber || 1} - ${presetName.toUpperCase()}`;
    }
    if (this.inputProfileNotes) {
      this.inputProfileNotes.value = '';
    }
    this.modalSaveProfile.style.display = 'flex';
  }

  closeSaveProfileModal() {
    if (this.modalSaveProfile) {
      this.modalSaveProfile.style.display = 'none';
    }
  }

  handleSaveProfileConfirm() {
    if (!this.currentTrack) return;
    const name = (this.inputProfileName?.value || '').trim() || 'Custom Strategy';
    const notes = (this.inputProfileNotes?.value || '').trim();
    const trackId = this.currentTrack.trackId;
    const profileId = `strat_${Date.now()}`;

    const newProfile = {
      id: profileId,
      name,
      notes,
      trackId,
      cornerIndex: this.currentCornerIndex,
      archetype: this.adjustments.archetype,
      adjustments: { ...this.adjustments },
      timestamp: Date.now()
    };

    const allProfiles = this.getStoredProfiles();
    if (!allProfiles[trackId]) allProfiles[trackId] = [];
    allProfiles[trackId].push(newProfile);
    this.saveStoredProfiles(allProfiles);

    this.activeProfileId = profileId;
    this.closeSaveProfileModal();
    this.populateProfileDropdown();

    if (window.PitToast) {
      window.PitToast.success(`Strategy "${name}" saved for ${this.currentTrack.trackName}`, 'CIRCUIT STRATEGIST');
    }
  }

  loadProfile(profileId) {
    this.activeProfileId = profileId;
    if (profileId === 'default') {
      this.resetAdjustments();
      return;
    }

    if (!this.currentTrack) return;
    const trackId = this.currentTrack.trackId;
    const allProfiles = this.getStoredProfiles();
    const trackProfiles = allProfiles[trackId] || [];
    const prof = trackProfiles.find(p => p.id === profileId);

    if (prof) {
      this.adjustments = { ...prof.adjustments };
      this.activePreset = prof.archetype || LINE_ARCHETYPE.LATE_APEX;
      this.syncSlidersFromAdjustments();
      
      if (this.presetChips) {
        this.presetChips.forEach(c => {
          if (c.dataset.archetype === this.activePreset) c.classList.add('active');
          else c.classList.remove('active');
        });
      }

      if (this.btnDeleteProfile) {
        this.btnDeleteProfile.style.display = 'inline-block';
      }

      this.render();
      if (window.PitToast) {
        window.PitToast.info(`Loaded strategy: "${prof.name}"`, 'CIRCUIT STRATEGIST');
      }
    }
  }

  deleteActiveProfile() {
    if (this.activeProfileId === 'default' || !this.currentTrack) return;
    const trackId = this.currentTrack.trackId;
    const allProfiles = this.getStoredProfiles();
    if (allProfiles[trackId]) {
      allProfiles[trackId] = allProfiles[trackId].filter(p => p.id !== this.activeProfileId);
      this.saveStoredProfiles(allProfiles);
    }
    this.activeProfileId = 'default';
    this.resetAdjustments();
    this.populateProfileDropdown();
    if (window.PitToast) {
      window.PitToast.info('Strategy profile deleted', 'CIRCUIT STRATEGIST');
    }
  }

  initTrackData() {
    const tracks = trackLibraryStore.getAllTracks();
    if (this.trackSelect) {
      this.trackSelect.innerHTML = '';
      tracks.forEach(track => {
        const opt = document.createElement('option');
        opt.value = track.trackId;
        opt.textContent = `${track.trackName} - ${track.layoutName || 'Full'}`;
        this.trackSelect.appendChild(opt);
      });
    }

    if (tracks.length > 0) {
      this.selectTrack(tracks[0].trackId);
    }
  }

  selectTrack(trackId) {
    this.currentTrack = trackLibraryStore.getTrackById(trackId) || trackLibraryStore.getAllTracks()[0];
    if (this.trackSelect) this.trackSelect.value = this.currentTrack.trackId;

    // Populate Corner Dropdown
    if (this.cornerSelect && this.currentTrack.corners) {
      this.cornerSelect.innerHTML = '';
      this.currentTrack.corners.forEach((corner, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `T${corner.cornerNumber || idx + 1} - ${corner.name || 'Corner'} (${Math.round((corner.apexSpeedMps || 25) * 3.6)} km/h)`;
        this.cornerSelect.appendChild(opt);
      });
    }

    this.activeProfileId = 'default';
    this.populateProfileDropdown();
    this.selectCorner(0);
  }

  selectCorner(index) {
    if (!this.currentTrack || !this.currentTrack.corners || this.currentTrack.corners.length === 0) return;
    const maxIdx = this.currentTrack.corners.length - 1;
    this.currentCornerIndex = Math.max(0, Math.min(maxIdx, index));
    
    if (this.cornerSelect) this.cornerSelect.value = this.currentCornerIndex;
    if (this.btnPrevCorner) this.btnPrevCorner.disabled = this.currentCornerIndex <= 0;
    if (this.btnNextCorner) this.btnNextCorner.disabled = this.currentCornerIndex >= maxIdx;

    this.resetAdjustments();
    this.resetCanvasView();
    this.render();
  }

  /**
   * Deep-linking handler for cross-launching from Pit-Wall widgets
   * @param {string} [trackIdOrName] 
   * @param {number} [cornerIndex=0] 
   */
  loadCornerFromPitWall(trackIdOrName, cornerIndex = 0) {
    if (trackIdOrName) {
      const allTracks = trackLibraryStore.getAllTracks();
      const target = allTracks.find(t => 
        t.trackId === trackIdOrName || 
        t.trackName.toLowerCase().includes(String(trackIdOrName).toLowerCase())
      );
      if (target) {
        this.selectTrack(target.trackId);
      }
    }
    this.selectCorner(cornerIndex);
    this.render();
  }

  applyPreset(archetype) {
    this.activePreset = archetype;
    this.adjustments.archetype = archetype;

    if (this.presetChips) {
      this.presetChips.forEach(c => {
        if (c.dataset.archetype === archetype) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
    }

    if (archetype === LINE_ARCHETYPE.LATE_APEX) {
      this.adjustments.deltaBrakeMeters = 0;
      this.adjustments.deltaTurnInMeters = -4;
      this.adjustments.apexDepthPercent = 0.68;
      this.adjustments.deltaTapMeters = -8;
      this.adjustments.deltaTrackOutMeters = 0;
    } else if (archetype === LINE_ARCHETYPE.GEOMETRIC) {
      this.adjustments.deltaBrakeMeters = 0;
      this.adjustments.deltaTurnInMeters = 0;
      this.adjustments.apexDepthPercent = 0.50;
      this.adjustments.deltaTapMeters = 0;
      this.adjustments.deltaTrackOutMeters = 0;
    } else if (archetype === LINE_ARCHETYPE.DEEP_BRAKE) {
      this.adjustments.deltaBrakeMeters = 12;
      this.adjustments.deltaTurnInMeters = 5;
      this.adjustments.apexDepthPercent = 0.58;
      this.adjustments.deltaTapMeters = 6;
      this.adjustments.deltaTrackOutMeters = 0;
    } else if (archetype === LINE_ARCHETYPE.COMPROMISE_S) {
      this.adjustments.deltaBrakeMeters = -6;
      this.adjustments.deltaTurnInMeters = -8;
      this.adjustments.apexDepthPercent = 0.74;
      this.adjustments.deltaTapMeters = -12;
      this.adjustments.deltaTrackOutMeters = -6;
    } else if (archetype === LINE_ARCHETYPE.RAIN_LINE) {
      this.adjustments.deltaBrakeMeters = -14;
      this.adjustments.deltaTurnInMeters = -10;
      this.adjustments.apexDepthPercent = 0.54;
      this.adjustments.deltaTapMeters = 0;
      this.adjustments.deltaTrackOutMeters = 8;
    }

    this.syncSlidersFromAdjustments();
    this.render();
  }

  syncSlidersFromAdjustments() {
    if (this.sliderBrake) this.sliderBrake.value = this.adjustments.deltaBrakeMeters;
    if (this.valBrake) this.valBrake.textContent = `${this.adjustments.deltaBrakeMeters > 0 ? '+' : ''}${this.adjustments.deltaBrakeMeters}m`;

    if (this.sliderTurnIn) this.sliderTurnIn.value = this.adjustments.deltaTurnInMeters;
    if (this.valTurnIn) this.valTurnIn.textContent = `${this.adjustments.deltaTurnInMeters > 0 ? '+' : ''}${this.adjustments.deltaTurnInMeters}m`;

    if (this.sliderApexDepth) this.sliderApexDepth.value = Math.round(this.adjustments.apexDepthPercent * 100);
    if (this.valApexDepth) this.valApexDepth.textContent = `${Math.round(this.adjustments.apexDepthPercent * 100)}%`;

    if (this.sliderTap) this.sliderTap.value = this.adjustments.deltaTapMeters;
    if (this.valTap) this.valTap.textContent = `${this.adjustments.deltaTapMeters > 0 ? '+' : ''}${this.adjustments.deltaTapMeters}m`;

    if (this.sliderTrackOut) this.sliderTrackOut.value = this.adjustments.deltaTrackOutMeters;
    if (this.valTrackOut) this.valTrackOut.textContent = `${this.adjustments.deltaTrackOutMeters > 0 ? '+' : ''}${this.adjustments.deltaTrackOutMeters}m`;
  }

  resetAdjustments() {
    this.activeProfileId = 'default';
    if (this.profileSelect) this.profileSelect.value = 'default';
    if (this.btnDeleteProfile) this.btnDeleteProfile.style.display = 'none';

    this.adjustments = {
      deltaBrakeMeters: 0,
      deltaTurnInMeters: -4,
      apexDepthPercent: 0.68,
      deltaTapMeters: -8,
      deltaTrackOutMeters: 0,
      apexLateralOffset: 0.05,
      archetype: LINE_ARCHETYPE.LATE_APEX
    };
    this.applyPreset(LINE_ARCHETYPE.LATE_APEX);
  }

  resetCanvasView() {
    this.transform = { zoom: 1.0, panX: 0, panY: 0 };
    this.render();
  }

  resizeCanvases() {
    [this.trackCanvas, this.telemetryCanvas, this.frictionCanvas, this.elevationCanvas].forEach(canvas => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(10, Math.floor(rect.width * dpr));
      canvas.height = Math.max(10, Math.floor(rect.height * dpr));
    });
  }

  getCurrentCornerData() {
    if (!this.currentTrack || !this.currentTrack.corners || this.currentTrack.corners.length === 0) {
      return {
        cornerNumber: 1,
        name: 'Turn 1',
        entrySpeedMps: 45,
        apexSpeedMps: 28,
        exitSpeedMps: 38,
        brakePointDist: 80,
        followingStraightMeters: 350,
        precedingStraightMeters: 200,
        elevationChangeMeters: -2.5,
        topographyRisk: TOPOGRAPHY_RISK.MODERATE_UNWEIGHTING
      };
    }
    return this.currentTrack.corners[this.currentCornerIndex];
  }

  generateSyntheticCornerSamples(corner) {
    const samples = [];
    const numSamples = 60;
    const lengthMeters = corner.lengthMeters || 180;

    const isRightHander = corner.turnDirection === 'R' || (corner.cornerNumber % 2 !== 0);

    for (let i = 0; i < numSamples; i++) {
      const progress = i / (numSamples - 1);
      const dist = progress * lengthMeters;
      
      const sweepAngle = (Math.PI * 0.55) * (isRightHander ? 1 : -1);
      const angle = progress * sweepAngle;
      
      const r = 60;
      const x = r * Math.sin(angle);
      const y = -r * (1 - Math.cos(angle)) + (progress * 40);

      let speedMps = corner.entrySpeedMps || 42;
      if (progress < 0.45) {
        const t = progress / 0.45;
        speedMps = (corner.entrySpeedMps || 42) + ((corner.apexSpeedMps || 26) - (corner.entrySpeedMps || 42)) * Math.sin(t * Math.PI * 0.5);
      } else {
        const t = (progress - 0.45) / 0.55;
        speedMps = (corner.apexSpeedMps || 26) + ((corner.exitSpeedMps || 36) - (corner.apexSpeedMps || 26)) * (t * t);
      }

      const elevChange = corner.elevationChangeMeters || -1.5;
      const elevation = Math.sin(progress * Math.PI) * elevChange;
      const gradePercent = -Math.cos(progress * Math.PI) * (elevChange / 100);

      samples.push({
        dist,
        x,
        y,
        elevation,
        gradePercent,
        speedMps,
        accelZ: gradePercent < -2 ? 0.88 : 1.0,
        throttle: progress > 0.5 ? Math.min(1.0, (progress - 0.5) * 2.2) : 0,
        brake: progress < 0.4 ? Math.max(0, 1.0 - (progress / 0.4)) : 0,
        lateralG: Math.sin(progress * Math.PI) * 1.15 * (isRightHander ? 1 : -1)
      });
    }

    return samples;
  }

  // --- Main Simulation & Render Pipeline ---
  render() {
    if (!this.viewContainer || this.viewContainer.style.display === 'none') return;

    this.resizeCanvases();
    const corner = this.getCurrentCornerData();
    const samples = this.generateSyntheticCornerSamples(corner);

    // Run Simulation
    const result = this.engine.simulateCorner(
      corner,
      this.adjustments,
      samples,
      {
        followingStraightMeters: corner.followingStraightMeters || 320,
        precedingStraightMeters: corner.precedingStraightMeters || 180,
        isLinked: corner.isLinked || false
      }
    );

    this.updateDashboardTickers(result, corner);
    this.renderTrackRibbonCanvas(samples, result, corner);
    this.renderTelemetryStrip(samples, result);
    this.renderFrictionCircle(samples, result);
    this.renderElevationProfile(samples, result);
  }

  updateDashboardTickers(result, corner) {
    if (!result) return;

    // Corner Type Badge
    if (this.tickerCornerType) {
      if (result.cornerType === CORNER_STRATEGY_TYPE.TYPE_1_EXIT_PRIORITY) {
        this.tickerCornerType.className = 'corner-type-badge type-1';
        this.tickerCornerType.textContent = 'TYPE 1 // EXIT PRIORITY';
      } else if (result.cornerType === CORNER_STRATEGY_TYPE.TYPE_2_ENTRY_PRIORITY) {
        this.tickerCornerType.className = 'corner-type-badge type-2';
        this.tickerCornerType.textContent = 'TYPE 2 // ENTRY PRIORITY';
      } else {
        this.tickerCornerType.className = 'corner-type-badge type-3';
        this.tickerCornerType.textContent = 'TYPE 3 // COMPROMISE';
      }
    }

    // Lap Delta Ticker
    if (this.tickerLapDelta) {
      const deltaSec = result.deltas.totalLapDeltaSec;
      const isFaster = deltaSec <= 0;
      this.tickerLapDelta.textContent = `${isFaster ? '-' : '+'}${Math.abs(deltaSec).toFixed(3)}s`;
      this.tickerLapDelta.className = `ticker-value ${isFaster ? 'gain-positive' : 'gain-negative'}`;
    }

    // Exit Speed & Exit Delta
    if (this.tickerExitSpeed) {
      this.tickerExitSpeed.textContent = `${result.simulated.exitSpeedKmh} km/h`;
    }
    if (this.tickerExitDelta) {
      const delta = result.deltas.exitSpeedKmh;
      this.tickerExitDelta.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} km/h`;
      this.tickerExitDelta.className = delta >= 0 ? 'gain-positive' : 'gain-negative';
    }

    // Corner Radius
    if (this.tickerRadius) {
      this.tickerRadius.textContent = `${result.simulatedRadius}m`;
    }

    // Effective G
    if (this.tickerEffectiveG) {
      this.tickerEffectiveG.textContent = `${result.effectiveG.toFixed(2)}G`;
    }

    // Topography Risk Banner
    if (this.topographyBanner && this.topographyText) {
      const risk = result.topography?.riskLevel;
      if (risk === TOPOGRAPHY_RISK.CRITICAL_CREST) {
        this.topographyBanner.className = 'topography-risk-banner risk-critical';
        this.topographyText.textContent = 'CRITICAL CREST: Normal force drops over apex. Trailing brake risks spin.';
      } else if (risk === TOPOGRAPHY_RISK.MODERATE_UNWEIGHTING) {
        this.topographyBanner.className = 'topography-risk-banner risk-warning';
        this.topographyText.textContent = 'MODERATE UNWEIGHTING: Sustainable lateral G reduced by 8-12%.';
      } else if (risk === TOPOGRAPHY_RISK.COMPRESSION_GRIP_BONUS) {
        this.topographyBanner.className = 'topography-risk-banner risk-safe';
        this.topographyText.textContent = 'DIP COMPRESSION: Downward G bonus provides +10% extra lateral grip.';
      } else {
        this.topographyBanner.className = 'topography-risk-banner risk-safe';
        this.topographyText.textContent = 'NEUTRAL TOPOGRAPHY: Flat track gradient across corner zone.';
      }
    }

    // Coaching Card Text
    if (this.coachingTitle && this.coachingBody && result.advisory) {
      this.coachingTitle.textContent = result.advisory.title || 'Skip Barber Racecraft Guidance';
      this.coachingBody.textContent = result.advisory.recommendations?.join(' ') || 'Prioritize late apex for maximum straightaway exit momentum.';
    }
  }

  // --- Canvas 1: Interactive Track Ribbon & Landmark Spline ---
  renderTrackRibbonCanvas(samples, result, corner) {
    if (!this.trackCtx || !this.trackCanvas) return;
    const ctx = this.trackCtx;
    const w = this.trackCanvas.width;
    const h = this.trackCanvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const cx = (w / 2) + (this.transform.panX * dpr);
    const cy = (h / 2) + (this.transform.panY * dpr);
    const scale = 2.4 * this.transform.zoom * dpr;

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const trackWidth = 12;
    const halfW = trackWidth / 2;

    // Track Ribbon
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      const dx = next.x - s.x;
      const dy = next.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const px = s.x + nx * halfW;
      const py = s.y + ny * halfW;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = samples.length - 1; i >= 0; i--) {
      const s = samples[i];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      const dx = next.x - s.x;
      const dy = next.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const px = s.x - nx * halfW;
      const py = s.y - ny * halfW;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#0F1318';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Curbs
    this.drawCurbs(ctx, samples, halfW);

    // Center Dashed Line
    ctx.beginPath();
    samples.forEach((s, idx) => {
      if (idx === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.setLineDash([]);

    // Baseline Line (Neon Cyan Glow)
    ctx.beginPath();
    samples.forEach((s, idx) => {
      if (idx === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.0;
    ctx.shadowColor = 'rgba(0, 229, 255, 0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Simulated Optimal Driving Line Spline (Gold)
    const optLine = result.optimalLine || [];
    if (optLine.length > 0) {
      ctx.beginPath();
      optLine.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = 'rgba(255, 184, 0, 0.8)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Control Pins [B], [I], [A], [T], [O]
    this.computeAndDrawPins(ctx, samples, result, cx, cy, scale, dpr);

    ctx.restore();
  }

  drawCurbs(ctx, samples, halfW) {
    const curbW = 1.4;
    const midIdx = Math.floor(samples.length * 0.5);
    const startIdx = Math.max(0, midIdx - 10);
    const endIdx = Math.min(samples.length - 1, midIdx + 10);

    for (let i = startIdx; i < endIdx; i++) {
      const s = samples[i];
      const next = samples[i + 1];
      if (!next) continue;
      const dx = next.x - s.x;
      const dy = next.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      ctx.fillStyle = (i % 2 === 0) ? '#E10600' : '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(s.x - nx * halfW, s.y - ny * halfW);
      ctx.lineTo(next.x - nx * halfW, next.y - ny * halfW);
      ctx.lineTo(next.x - nx * (halfW + curbW), next.y - ny * (halfW + curbW));
      ctx.lineTo(s.x - nx * (halfW + curbW), s.y - ny * (halfW + curbW));
      ctx.closePath();
      ctx.fill();
    }
  }

  computeAndDrawPins(ctx, samples, result, cx, cy, scale, dpr) {
    const brakeIdx = Math.max(0, Math.min(samples.length - 1, Math.floor(samples.length * 0.12) + Math.round(this.adjustments.deltaBrakeMeters / 4)));
    const turnInIdx = Math.max(0, Math.min(samples.length - 1, Math.floor(samples.length * 0.28) + Math.round(this.adjustments.deltaTurnInMeters / 4)));
    const apexIdx = Math.max(0, Math.min(samples.length - 1, Math.floor(samples.length * this.adjustments.apexDepthPercent)));
    const tapIdx = Math.max(0, Math.min(samples.length - 1, Math.floor(samples.length * 0.58) + Math.round(this.adjustments.deltaTapMeters / 4)));
    const trackOutIdx = Math.max(0, Math.min(samples.length - 1, Math.floor(samples.length * 0.88) + Math.round(this.adjustments.deltaTrackOutMeters / 4)));

    const pinDefs = [
      { id: 'B', sample: samples[brakeIdx], label: 'BRAKE', color: '#FF3B30' },
      { id: 'I', sample: samples[turnInIdx], label: 'TURN-IN', color: '#00E5FF' },
      { id: 'A', sample: samples[apexIdx], label: 'APEX', color: '#FFB800' },
      { id: 'T', sample: samples[tapIdx], label: 'TAP', color: '#00E676' },
      { id: 'O', sample: samples[trackOutIdx], label: 'TRACK-OUT', color: '#D946EF' }
    ];

    pinDefs.forEach(pin => {
      const s = pin.sample;
      if (!s) return;

      const screenX = (cx + s.x * scale) / dpr;
      const screenY = (cy + s.y * scale) / dpr;
      this.pinScreenCoords[pin.id] = {
        x: screenX,
        y: screenY,
        id: pin.id,
        label: pin.label,
        color: pin.color
      };

      const isHovered = this.hoveredPin === pin.id;
      const isDragging = this.draggingPin === pin.id;

      ctx.beginPath();
      ctx.arc(s.x, s.y, (isHovered || isDragging) ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = pin.color;
      ctx.shadowColor = pin.color;
      ctx.shadowBlur = (isHovered || isDragging) ? 14 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(s.x, s.y, (isHovered || isDragging) ? 6.5 : 5.0, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.font = 'bold 3.5px Chakra Petch, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pin.id, s.x, s.y - 8);
    });
  }

  // --- Canvas 2: Synchronized Multi-Channel Telemetry Strip ---
  renderTelemetryStrip(samples, result) {
    if (!this.telemetryCtx || !this.telemetryCanvas) return;
    const ctx = this.telemetryCtx;
    const w = this.telemetryCanvas.width;
    const h = this.telemetryCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (!samples || samples.length === 0) return;

    const maxSpeed = Math.max(60, (result.simulated.entrySpeedKmh || 120) / 3.6);
    const minSpeed = Math.min(15, (result.baseline.apexSpeedKmh || 40) / 3.6);

    // Throttle & Brake Traces
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / (samples.length - 1)) * w;
      const y = h - (s.throttle * (h * 0.45));
      if (idx === 0) ctx.moveTo(x, h);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 230, 118, 0.12)';
    ctx.fill();

    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / (samples.length - 1)) * w;
      const y = h - (s.brake * (h * 0.45));
      if (idx === 0) ctx.moveTo(x, h);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 59, 48, 0.15)';
    ctx.fill();

    // Baseline Speed Curve (Cyan)
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / (samples.length - 1)) * w;
      const norm = (s.speedMps - minSpeed) / (maxSpeed - minSpeed);
      const y = h - 20 - norm * (h - 40);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Simulated Speed Curve (Gold)
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / (samples.length - 1)) * w;
      let simSpeed = s.speedMps;
      const progress = idx / (samples.length - 1);
      if (progress < 0.4) {
        simSpeed = (result.simulated.entrySpeedKmh / 3.6) - (progress / 0.4) * ((result.simulated.entrySpeedKmh - result.simulated.apexSpeedKmh) / 3.6);
      } else {
        const t = (progress - 0.4) / 0.6;
        simSpeed = (result.simulated.apexSpeedKmh / 3.6) + t * ((result.simulated.exitSpeedKmh - result.simulated.apexSpeedKmh) / 3.6);
      }
      const norm = (simSpeed - minSpeed) / (maxSpeed - minSpeed);
      const y = h - 20 - norm * (h - 40);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Labels
    ctx.font = '10px Fira Code, monospace';
    ctx.fillStyle = '#00E5FF';
    ctx.fillText(`Base: ${result.baseline.exitSpeedKmh} km/h`, 8, 16);
    ctx.fillStyle = '#FFB800';
    ctx.fillText(`Sim: ${result.simulated.exitSpeedKmh} km/h`, 130, 16);
  }

  // --- Canvas 3: G-G Friction Circle ---
  renderFrictionCircle(samples, result) {
    if (!this.frictionCtx || !this.frictionCanvas) return;
    const ctx = this.frictionCtx;
    const w = this.frictionCanvas.width;
    const h = this.frictionCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = (w / 2) - 8;

    ctx.clearRect(0, 0, w, h);

    // 1.0G & 1.2G Envelope Rings
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.83, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Axes
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, h - 4);
    ctx.moveTo(4, cy);
    ctx.lineTo(w - 4, cy);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // Baseline sample cloud
    samples.forEach(s => {
      const gx = cx + (s.lateralG / 1.3) * r;
      const gy = cy - ((s.brake - s.throttle * 0.7) / 1.3) * r;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.fillRect(gx - 1, gy - 1, 2, 2);
    });

    // Simulated Max Cornering Vector (Gold Indicator)
    const effectiveG = result.effectiveG || 1.15;
    const peakX = cx + (effectiveG / 1.3) * r * 0.95;
    const peakY = cy - 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(peakX, peakY);
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(peakX, peakY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFB800';
    ctx.fill();

    // Label
    ctx.font = '9px Fira Code, monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText(`${effectiveG.toFixed(2)}G`, cx, h - 4);
  }

  // --- Canvas 4: 3D Topography Elevation Strip ---
  renderElevationProfile(samples, result) {
    if (!this.elevationCtx || !this.elevationCanvas) return;
    const ctx = this.elevationCtx;
    const w = this.elevationCanvas.width;
    const h = this.elevationCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!samples || samples.length === 0) return;

    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / (samples.length - 1)) * w;
      const y = (h / 2) - (s.elevation * 8);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 184, 0, 0.12)';
    ctx.fill();

    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / (samples.length - 1)) * w;
      const y = (h / 2) - (s.elevation * 8);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- Mouse & Touch Event Handlers ---
  getCanvasCoords(e) {
    const rect = this.trackCanvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  onCanvasMouseDown(e) {
    const pos = this.getCanvasCoords(e);
    this.lastMousePos = pos;

    let clickedPin = null;
    for (const key of Object.keys(this.pinScreenCoords)) {
      const pin = this.pinScreenCoords[key];
      const dist = Math.hypot(pos.x - pin.x, pos.y - pin.y);
      if (dist <= 18) {
        clickedPin = key;
        break;
      }
    }

    if (clickedPin) {
      this.draggingPin = clickedPin;
    } else {
      this.isPanning = true;
    }
  }

  onCanvasMouseMove(e) {
    const pos = this.getCanvasCoords(e);

    if (this.draggingPin) {
      const dx = pos.x - this.lastMousePos.x;
      
      if (this.draggingPin === 'B') {
        this.adjustments.deltaBrakeMeters = Math.max(-30, Math.min(30, this.adjustments.deltaBrakeMeters + Math.round(dx * 0.4)));
      } else if (this.draggingPin === 'I') {
        this.adjustments.deltaTurnInMeters = Math.max(-30, Math.min(30, this.adjustments.deltaTurnInMeters + Math.round(dx * 0.4)));
      } else if (this.draggingPin === 'A') {
        this.adjustments.apexDepthPercent = Math.max(0.3, Math.min(0.85, this.adjustments.apexDepthPercent + (dx * 0.003)));
      } else if (this.draggingPin === 'T') {
        this.adjustments.deltaTapMeters = Math.max(-30, Math.min(30, this.adjustments.deltaTapMeters + Math.round(dx * 0.4)));
      } else if (this.draggingPin === 'O') {
        this.adjustments.deltaTrackOutMeters = Math.max(-30, Math.min(30, this.adjustments.deltaTrackOutMeters + Math.round(dx * 0.4)));
      }

      this.syncSlidersFromAdjustments();
      this.lastMousePos = pos;
      this.render();
      return;
    }

    if (this.isPanning) {
      const dx = pos.x - this.lastMousePos.x;
      const dy = pos.y - this.lastMousePos.y;
      this.transform.panX += dx;
      this.transform.panY += dy;
      this.lastMousePos = pos;
      this.render();
      return;
    }

    let hovered = null;
    for (const key of Object.keys(this.pinScreenCoords)) {
      const pin = this.pinScreenCoords[key];
      const dist = Math.hypot(pos.x - pin.x, pos.y - pin.y);
      if (dist <= 18) {
        hovered = key;
        break;
      }
    }
    if (this.hoveredPin !== hovered) {
      this.hoveredPin = hovered;
      if (this.trackCanvas) {
        this.trackCanvas.style.cursor = hovered ? 'pointer' : 'crosshair';
      }
      this.render();
    }
  }

  onCanvasMouseUp() {
    this.draggingPin = null;
    this.isPanning = false;
  }

  onCanvasWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.transform.zoom = Math.max(0.4, Math.min(3.5, this.transform.zoom * zoomFactor));
    this.render();
  }

  onTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      this.onCanvasMouseDown(e);
    }
  }

  onTouchMove(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      this.onCanvasMouseMove(e);
    }
  }

  async exportStrategyPdf() {
    if (!this.currentTrack) return;
    const corner = this.getCurrentCornerData();
    const samples = this.generateSyntheticCornerSamples(corner);
    const simulationResult = this.engine.simulateCorner(
      corner,
      this.adjustments,
      samples,
      {
        followingStraightMeters: corner.followingStraightMeters || 320,
        precedingStraightMeters: corner.precedingStraightMeters || 180,
        isLinked: corner.isLinked || false
      }
    );
    const activeProfileName = this.activeProfileId === 'default'
      ? 'Default Baseline Strategy'
      : (this.getStoredProfiles()[this.currentTrack.trackId]?.find(p => p.id === this.activeProfileId)?.name || 'Custom Strategy');
    const activeNotes = this.activeProfileId === 'default'
      ? ''
      : (this.getStoredProfiles()[this.currentTrack.trackId]?.find(p => p.id === this.activeProfileId)?.notes || '');

    if (window.PitToast) window.PitToast.info('Compiling 2-Page Strategy Dossier PDF...', 'PDF EXPORTER');
    try {
      await StrategyPdfExporter.exportStrategyDossier({
        track: this.currentTrack,
        selectedCornerIndex: this.currentCornerIndex,
        profileName: activeProfileName,
        profileNotes: activeNotes,
        archetype: this.adjustments.archetype,
        adjustments: this.adjustments,
        simulationResult,
        driverProfile: window.apexApp?.driverStore?.getActiveProfile() || null
      }, true);
      if (window.PitToast) window.PitToast.success('Strategy Dossier PDF downloaded!', 'PDF EXPORTER');
    } catch (err) {
      console.error('[CIRCUIT STRATEGIST] PDF export error:', err);
      if (window.PitToast) window.PitToast.error('Failed to export Strategy PDF', 'PDF EXPORTER');
    }
  }
}

