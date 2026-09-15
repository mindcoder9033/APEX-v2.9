/**
 * APEX Track Editor View Controller
 * Option B: Synchronized Dual-Pane 2D Map & Telemetry Strip Editor
 * 
 * Implements the circuit modeling & telemetry decomposition methodology from:
 * "Going Faster! Mastering the Art of Race Driving" by Carl Lopez & Skip Barber Racing School.
 * 
 * Features:
 * - Interactive 2D Vector Track Map with draggable Turn-In, Apex, Track-Out, and Braking anchors.
 * - Synchronized Multi-Channel Telemetry Strip (Speed, Throttle, Brake, Steering, LatG).
 * - Real-time Skip Barber 4-Block Entry/Exit Bracket Decomposition.
 * - Dynamic Physics Limit Speed recalculation (15*G*R = V^2 with camber & surface grip modifiers).
 * - Rain line overlay ("Rim-Shot" vs "Square-Off" vs Dry Line).
 * - Full persistence via TrackStudyStore.
 */

import { trackStudyAnalyzer } from './analysis/track-study-analyzer.js';
import { trackStudyStore } from './track-study-store.js';

export class TrackEditorView {
  constructor() {
    this.activeTrack = null;
    this.studyData = null;
    this.turns = [];
    this.selectedTurnIndex = 0;
    this.telemetryPoints = [];
    this.totalDistanceM = 4000;
    this.activeScrubDistanceM = 0;
    this.activeRainMode = 'dry'; // 'dry' | 'rim-shot' | 'square-off'
    this.draggedMarker = null;

    // DOM Elements
    this.modalOverlay = document.getElementById('track-editor-modal');
    this.btnClose = document.getElementById('btn-close-track-editor');
    this.btnSave = document.getElementById('btn-save-track-editor');
    this.btnReset = document.getElementById('btn-reset-track-editor');
    this.btnAutoDetect = document.getElementById('btn-autodetect-corners');
    this.btnToggleRain = document.getElementById('btn-toggle-rain-line');
    this.btnAddTurn = document.getElementById('btn-add-turn');
    this.btnDeleteTurn = document.getElementById('btn-delete-turn');

    this.editorTrackTitle = document.getElementById('editor-track-title');
    this.editorTrackSubtitle = document.getElementById('editor-track-subtitle');
    this.svgMapContainer = document.getElementById('editor-map-canvas-container');
    this.telemetryCanvas = document.getElementById('editor-telemetry-canvas');
    this.turnListContainer = document.getElementById('editor-turn-pill-list');

    // Inspector Inputs
    this.inputTurnName = document.getElementById('edit-turn-name');
    this.selectTurnType = document.getElementById('edit-turn-type');
    this.inputTurnRadius = document.getElementById('edit-turn-radius');
    this.valTheoreticalSpeed = document.getElementById('val-theoretical-speed');
    this.sliderCamber = document.getElementById('edit-turn-camber');
    this.valCamberDeg = document.getElementById('val-camber-deg');
    this.selectSurface = document.getElementById('edit-turn-surface');
    this.selectElevation = document.getElementById('edit-turn-elevation');
    this.selectCurb = document.getElementById('edit-turn-curb');
    
    // 4-Block Controls
    this.sliderBrakeDist = document.getElementById('edit-block2-dist');
    this.valBrakeDist = document.getElementById('val-block2-dist');
    this.sliderTrailDepth = document.getElementById('edit-block3-trail');
    this.valTrailDepth = document.getElementById('val-block3-trail');
    this.sliderPauseMs = document.getElementById('edit-block4-pause');
    this.valPauseMs = document.getElementById('val-block4-pause');

    // Reference Notes
    this.inputRefBrake = document.getElementById('edit-ref-brake');
    this.inputRefTurnIn = document.getElementById('edit-ref-turnin');
    this.inputRefApex = document.getElementById('edit-ref-apex');
    this.inputRefTrackOut = document.getElementById('edit-ref-trackout');
    this.inputDriverNotes = document.getElementById('edit-driver-notes');

    this.onSaveCallback = null;
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

    if (this.btnSave) {
      this.btnSave.addEventListener('click', () => this.saveChanges());
    }

    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.resetToDefaults());
    }

    if (this.btnAutoDetect) {
      this.btnAutoDetect.addEventListener('click', () => this.autoDetectCorners());
    }

    if (this.btnToggleRain) {
      this.btnToggleRain.addEventListener('click', () => this.cycleRainMode());
    }

    if (this.btnAddTurn) {
      this.btnAddTurn.addEventListener('click', () => this.addNewCorner());
    }

    if (this.btnDeleteTurn) {
      this.btnDeleteTurn.addEventListener('click', () => this.deleteCurrentCorner());
    }

    // Inspector Live Updates
    if (this.inputTurnName) {
      this.inputTurnName.addEventListener('input', (e) => {
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.name = e.target.value;
          this.renderTurnPills();
        }
      });
    }

    if (this.selectTurnType) {
      this.selectTurnType.addEventListener('change', (e) => {
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.cornerType = e.target.value;
          cur.cornerTypeOverride = e.target.value;
          this.recalcCurrentTurnPhysics();
          this.renderMap();
          this.renderTelemetryStrip();
          this.renderTurnPills();
        }
      });
    }

    if (this.inputTurnRadius) {
      this.inputTurnRadius.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 60;
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.radiusMetersOverride = val;
          if (cur.geometry) cur.geometry.radiusMeters = val;
          this.recalcCurrentTurnPhysics();
          this.renderMap();
          this.renderTelemetryStrip();
        }
      });
    }

    if (this.sliderCamber) {
      this.sliderCamber.addEventListener('input', (e) => {
        const deg = parseInt(e.target.value, 10) || 0;
        if (this.valCamberDeg) {
          this.valCamberDeg.textContent = deg > 0 ? `+${deg}° (Banked)` : (deg < 0 ? `${deg}° (Off-Camber)` : `0° (Flat)`);
          this.valCamberDeg.style.color = deg > 0 ? '#00ff66' : (deg < 0 ? '#ff3b30' : '#8b9bb4');
        }
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.camberDeg = deg;
          cur.camber = deg > 0 ? `Positive (+${deg}°)` : (deg < 0 ? `Negative (${deg}°)` : 'Neutral / Flat');
          this.recalcCurrentTurnPhysics();
        }
      });
    }

    if (this.selectSurface) {
      this.selectSurface.addEventListener('change', (e) => {
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.surfaceType = e.target.value;
          if (cur.microFeatures) cur.microFeatures.surfaceType = e.target.value;
        }
      });
    }

    if (this.selectElevation) {
      this.selectElevation.addEventListener('change', (e) => {
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.elevationProfile = e.target.value;
          if (cur.microFeatures) cur.microFeatures.elevationProfile = e.target.value;
        }
      });
    }

    if (this.selectCurb) {
      this.selectCurb.addEventListener('change', (e) => {
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.curbSeverity = e.target.value;
          if (cur.microFeatures) cur.microFeatures.curbSeverity = e.target.value;
        }
      });
    }

    // 4-Block Sliders
    if (this.sliderBrakeDist) {
      this.sliderBrakeDist.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.valBrakeDist) this.valBrakeDist.textContent = `${val} m`;
        const cur = this.getCurrentTurn();
        if (cur && cur.fourBlocks?.block2) {
          cur.fourBlocks.block2.distanceMeters = val;
          this.renderTelemetryStrip();
        }
      });
    }

    if (this.sliderTrailDepth) {
      this.sliderTrailDepth.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.valTrailDepth) this.valTrailDepth.textContent = `${val} %`;
        const cur = this.getCurrentTurn();
        if (cur && cur.fourBlocks?.block3) {
          cur.fourBlocks.block3.trailDepthPct = val;
          if (cur.targets) cur.targets.trailBrakeDepthPct = val;
          this.renderTelemetryStrip();
        }
      });
    }

    if (this.sliderPauseMs) {
      this.sliderPauseMs.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (this.valPauseMs) this.valPauseMs.textContent = `${val} ms`;
        const cur = this.getCurrentTurn();
        if (cur && cur.fourBlocks?.block4) {
          cur.fourBlocks.block4.pauseMs = val;
          this.renderTelemetryStrip();
        }
      });
    }

    // Reference inputs
    const refInputs = [
      { id: 'edit-ref-brake', key: 'braking' },
      { id: 'edit-ref-turnin', key: 'turnIn' },
      { id: 'edit-ref-apex', key: 'apex' },
      { id: 'edit-ref-trackout', key: 'trackOut' }
    ];
    refInputs.forEach(({ id, key }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const cur = this.getCurrentTurn();
          if (cur) {
            if (!cur.referenceMarkers) cur.referenceMarkers = {};
            cur.referenceMarkers[key] = e.target.value;
          }
        });
      }
    });

    if (this.inputDriverNotes) {
      this.inputDriverNotes.addEventListener('input', (e) => {
        const cur = this.getCurrentTurn();
        if (cur) {
          cur.driverNotes = e.target.value;
        }
      });
    }
  }

  /**
   * Opens the Track Editor for a given circuit profile
   * @param {Object} trackProfile 
   * @param {Function} [onSave] 
   */
  open(trackProfile, onSave = null) {
    if (!trackProfile) return;
    this.activeTrack = trackProfile;
    this.onSaveCallback = onSave;

    // Load full study model with analyzer
    this.studyData = trackStudyAnalyzer.analyzeTrackStudy(trackProfile);
    
    // Check if there are saved editor overrides
    const savedEditor = trackStudyStore.getEditorModel(trackProfile.trackId);
    if (savedEditor && Array.isArray(savedEditor.turns) && savedEditor.turns.length > 0) {
      this.turns = JSON.parse(JSON.stringify(savedEditor.turns));
      this.activeRainMode = savedEditor.rainMode || 'dry';
    } else {
      this.turns = JSON.parse(JSON.stringify(this.studyData.turns || []));
      this.activeRainMode = 'dry';
    }

    // Prepare synthesized or recorded vector points
    this.generateTelemetryStream();

    this.selectedTurnIndex = 0;
    this.activeScrubDistanceM = 0;

    // Update Header
    if (this.editorTrackTitle) {
      this.editorTrackTitle.textContent = `${trackProfile.trackName || 'Circuit'} // Dual-Pane Track Editor`;
    }
    if (this.editorTrackSubtitle) {
      this.editorTrackSubtitle.textContent = `Layout: ${trackProfile.layoutName || 'GP'} | Length: ${(this.totalTrackLengthMeters).toLocaleString()}m | Mode: ${this.activeRainMode.toUpperCase()}`;
    }

    this.renderTurnPills();
    this.populateInspector();
    this.renderMap();
    this.renderTelemetryStrip();

    if (this.modalOverlay) {
      this.modalOverlay.classList.add('active');
    }
  }

  hide() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
  }

  get totalTrackLengthMeters() {
    return this.activeTrack?.trackLengthMeters || 
      (this.activeTrack?.trackLengthKm ? Math.round(this.activeTrack.trackLengthKm * 1000) : 4000);
  }

  getCurrentTurn() {
    return this.turns[this.selectedTurnIndex] || this.turns[0] || null;
  }

  /**
   * Synthesizes continuous vector & telemetry channels for synchronized dual-pane display
   */
  generateTelemetryStream() {
    const rawPoints = this.activeTrack?.vectorMap?.points || [];
    this.totalDistanceM = this.totalTrackLengthMeters;

    if (rawPoints.length >= 10) {
      this.telemetryPoints = rawPoints.map((p, idx) => {
        const dist = (idx / rawPoints.length) * this.totalDistanceM;
        return {
          x: p.x,
          z: p.z,
          distanceM: dist,
          speedKmh: p.speedKmh || (p.state === 'BRAKING' ? 95 : (p.state === 'COASTING' ? 140 : 210)),
          throttlePct: p.state === 'FULL_THROTTLE' ? 100 : (p.state === 'PARTIAL_THROTTLE' ? 60 : 0),
          brakeForcePct: p.state === 'BRAKING' ? 85 : 0,
          steeringDeg: p.state === 'BRAKING' || p.state === 'PARTIAL_THROTTLE' ? 18 : 2,
          latG: p.state === 'BRAKING' ? 1.1 : (p.state === 'PARTIAL_THROTTLE' ? 1.4 : 0.2)
        };
      });
    } else {
      // Synthesize high-fidelity 2D circuit loop
      const sampleCount = 200;
      this.telemetryPoints = [];
      const turnCount = Math.max(4, this.turns.length);

      for (let i = 0; i < sampleCount; i++) {
        const frac = i / sampleCount;
        const angle = frac * Math.PI * 2;
        const dist = frac * this.totalDistanceM;

        // Parametric race track shape with realistic sweeping lobes
        const r = 320 + 90 * Math.sin(angle * 2) + 40 * Math.cos(angle * 3);
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);

        // Telemetry channels
        const turnZone = Math.sin(angle * turnCount);
        const isBraking = turnZone < -0.3;
        const isTurning = Math.abs(turnZone) > 0.4;
        const speedKmh = isBraking ? 80 + Math.round(30 * (1 + turnZone)) : 190 + Math.round(50 * Math.cos(angle * 2));
        const throttlePct = isBraking ? 0 : (isTurning ? 55 : 100);
        const brakeForcePct = isBraking ? 90 : 0;
        const steeringDeg = isTurning ? (turnZone > 0 ? 22 : -22) : 0;
        const latG = isTurning ? 1.35 : 0.15;

        this.telemetryPoints.push({
          x,
          z,
          distanceM: dist,
          speedKmh,
          throttlePct,
          brakeForcePct,
          steeringDeg,
          latG
        });
      }
    }

    // Attach fractional distance anchors to turns if missing
    this.turns.forEach((turn, idx) => {
      const fracCenter = (idx + 0.5) / this.turns.length;
      if (!turn.distanceOffsetM) {
        turn.distanceOffsetM = Math.round(fracCenter * this.totalDistanceM);
      }
      if (!turn.turnInDistanceM) {
        turn.turnInDistanceM = Math.max(0, turn.distanceOffsetM - 60);
      }
      if (!turn.apexDistanceM) {
        turn.apexDistanceM = turn.distanceOffsetM;
      }
      if (!turn.trackOutDistanceM) {
        turn.trackOutDistanceM = Math.min(this.totalDistanceM, turn.distanceOffsetM + 70);
      }
    });
  }

  /**
   * Renders the interactive Turn Navigation Pills
   */
  renderTurnPills() {
    if (!this.turnListContainer) return;
    this.turnListContainer.innerHTML = '';

    this.turns.forEach((turn, idx) => {
      const btn = document.createElement('button');
      const typeClass = turn.cornerType === 'Type I' ? 'type-i-pill' : 
        (turn.cornerType === 'Type II' ? 'type-ii-pill' : 'type-iii-pill');

      btn.className = `study-turn-pill ${typeClass} ${idx === this.selectedTurnIndex ? 'active' : ''}`;
      btn.innerHTML = `<span>T${turn.turnNumber}</span>`;
      btn.title = `${turn.name} — ${turn.cornerType}`;
      
      btn.addEventListener('click', () => {
        this.selectedTurnIndex = idx;
        const targetDist = turn.turnInDistanceM || turn.distanceOffsetM || 0;
        this.activeScrubDistanceM = targetDist;
        this.renderTurnPills();
        this.populateInspector();
        this.renderMap();
        this.renderTelemetryStrip();
      });

      this.turnListContainer.appendChild(btn);
    });
  }

  /**
   * Populates the right-side inspector with current turn parameters
   */
  populateInspector() {
    const turn = this.getCurrentTurn();
    if (!turn) return;

    if (this.inputTurnName) this.inputTurnName.value = turn.name || `Turn ${turn.turnNumber}`;
    if (this.selectTurnType) this.selectTurnType.value = turn.cornerType || 'Type I';
    if (this.inputTurnRadius) this.inputTurnRadius.value = turn.geometry?.radiusMeters || turn.radiusMetersOverride || 65;

    const camberDeg = turn.camberDeg !== undefined ? turn.camberDeg : 0;
    if (this.sliderCamber) this.sliderCamber.value = camberDeg;
    if (this.valCamberDeg) {
      this.valCamberDeg.textContent = camberDeg > 0 ? `+${camberDeg}° (Banked)` : (camberDeg < 0 ? `${camberDeg}° (Off-Camber)` : `0° (Flat)`);
      this.valCamberDeg.style.color = camberDeg > 0 ? '#00ff66' : (camberDeg < 0 ? '#ff3b30' : '#8b9bb4');
    }

    if (this.selectSurface) this.selectSurface.value = turn.microFeatures?.surfaceType || turn.surfaceType || 'Standard Asphalt';
    if (this.selectElevation) this.selectElevation.value = turn.microFeatures?.elevationProfile || turn.elevationProfile || 'Level';
    if (this.selectCurb) this.selectCurb.value = turn.microFeatures?.curbSeverity || turn.curbSeverity || 'Flat Paint / Low Usable';

    // 4-Block parameters
    const fb = turn.fourBlocks || {};
    const b2Dist = fb.block2?.distanceMeters || 65;
    const b3Trail = fb.block3?.trailDepthPct || 35;
    const b4Pause = fb.block4?.pauseMs || 0;

    if (this.sliderBrakeDist) this.sliderBrakeDist.value = b2Dist;
    if (this.valBrakeDist) this.valBrakeDist.textContent = `${b2Dist} m`;

    if (this.sliderTrailDepth) this.sliderTrailDepth.value = b3Trail;
    if (this.valTrailDepth) this.valTrailDepth.textContent = `${b3Trail} %`;

    if (this.sliderPauseMs) this.sliderPauseMs.value = b4Pause;
    if (this.valPauseMs) this.valPauseMs.textContent = `${b4Pause} ms`;

    // Reference Markers
    const refs = turn.referenceMarkers || {};
    if (this.inputRefBrake) this.inputRefBrake.value = refs.braking || '';
    if (this.inputRefTurnIn) this.inputRefTurnIn.value = refs.turnIn || '';
    if (this.inputRefApex) this.inputRefApex.value = refs.apex || '';
    if (this.inputRefTrackOut) this.inputRefTrackOut.value = refs.trackOut || '';
    if (this.inputDriverNotes) this.inputDriverNotes.value = turn.driverNotes || '';

    this.recalcCurrentTurnPhysics();
  }

  /**
   * Recalculates theoretical limit speed and 4-block values using Going Faster formulas
   */
  recalcCurrentTurnPhysics() {
    const turn = this.getCurrentTurn();
    if (!turn) return;

    const radiusMeters = parseFloat(this.inputTurnRadius?.value) || turn.geometry?.radiusMeters || 65;
    const camberDeg = parseInt(this.sliderCamber?.value, 10) || turn.camberDeg || 0;
    
    // Calculate limit speed V = sqrt(127.14 * G_eff * R)
    const baseG = 1.30;
    const limitSpeedKmh = trackStudyAnalyzer.calculateLimitSpeedKmh(radiusMeters, baseG, camberDeg);
    const approachSpeedKmh = Math.round(limitSpeedKmh * (turn.precedingStraightMeters > 250 ? 1.65 : 1.35));

    if (this.valTheoreticalSpeed) {
      this.valTheoreticalSpeed.textContent = `${limitSpeedKmh} km/h (${Math.round(limitSpeedKmh / 1.60934)} mph)`;
    }

    turn.geometry = {
      radiusMeters: Math.round(radiusMeters),
      radiusFeet: Math.round(radiusMeters * 3.28084),
      theoreticalMaxSpeedKmh: limitSpeedKmh,
      arcLengthMeters: Math.round(radiusMeters * 1.5)
    };

    turn.targets = {
      approachSpeedKmh,
      minApexSpeedKmh: limitSpeedKmh,
      targetGear: limitSpeedKmh < 80 ? 2 : (limitSpeedKmh < 130 ? 3 : 4),
      suggestedBrakePressurePct: turn.cornerType === 'Type II' ? 95 : 70,
      trailBrakeDepthPct: parseInt(this.sliderTrailDepth?.value, 10) || 35,
      throttlePickUpPoint: turn.cornerType === 'Type I' ? 'At or 5m Before Apex' : 'Past Apex on Unwind'
    };

    turn.fourBlocks = trackStudyAnalyzer.decomposeFourBlocks(turn, approachSpeedKmh, limitSpeedKmh);
  }

  /**
   * Renders the Top Pane 2D Interactive Track Map (SVG)
   */
  renderMap() {
    if (!this.svgMapContainer || this.telemetryPoints.length < 3) return;

    const pts = this.telemetryPoints;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const rangeX = (maxX - minX) || 1;
    const rangeZ = (maxZ - minZ) || 1;
    const width = this.svgMapContainer.clientWidth || 700;
    const height = this.svgMapContainer.clientHeight || 340;
    const padding = 45;

    const usableW = width - (padding * 2);
    const usableH = height - (padding * 2);
    const scale = Math.min(usableW / rangeX, usableH / rangeZ);

    const offsetX = padding + (usableW - (rangeX * scale)) / 2;
    const offsetY = padding + (usableH - (rangeZ * scale)) / 2;

    const mapCoord = (x, z) => ({
      svgX: (offsetX + (x - minX) * scale),
      svgY: (height - (offsetY + (z - minZ) * scale))
    });

    // 1. Build Base Track Path
    let trackLinesSvg = '';
    for (let i = 1; i < pts.length; i++) {
      const c1 = mapCoord(pts[i - 1].x, pts[i - 1].z);
      const c2 = mapCoord(pts[i].x, pts[i].z);

      let stroke = '#00CC66';
      if (pts[i].brakeForcePct > 20) stroke = '#E10600';
      else if (pts[i].throttlePct < 40) stroke = '#0099FF';

      trackLinesSvg += `<line x1="${c1.svgX.toFixed(1)}" y1="${c1.svgY.toFixed(1)}" x2="${c2.svgX.toFixed(1)}" y2="${c2.svgY.toFixed(1)}" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" />`;
    }

    // 2. Build Rain Line Overlay if active
    let rainLineSvg = '';
    if (this.activeRainMode === 'rim-shot') {
      // Rim-shot: wider line on outside edge (Ch 12, p 185)
      let rainD = '';
      for (let i = 0; i < pts.length; i++) {
        const c = mapCoord(pts[i].x * 1.05, pts[i].z * 1.05);
        rainD += (i === 0 ? `M ${c.svgX.toFixed(1)} ${c.svgY.toFixed(1)}` : ` L ${c.svgX.toFixed(1)} ${c.svgY.toFixed(1)}`);
      }
      rainLineSvg = `<path d="${rainD} Z" fill="none" stroke="#00e5ff" stroke-width="2.5" stroke-dasharray="6,4" opacity="0.85" />
                     <text x="60" y="30" fill="#00e5ff" font-size="11" font-weight="700" font-family="monospace">🌧️ RAIN LINE ACTIVE: 'RIM-SHOT' (OUTSIDE GRIP ARC)</text>`;
    } else if (this.activeRainMode === 'square-off') {
      let rainD = '';
      for (let i = 0; i < pts.length; i++) {
        const factor = (i % 20 < 10) ? 1.03 : 0.97;
        const c = mapCoord(pts[i].x * factor, pts[i].z * factor);
        rainD += (i === 0 ? `M ${c.svgX.toFixed(1)} ${c.svgY.toFixed(1)}` : ` L ${c.svgX.toFixed(1)} ${c.svgY.toFixed(1)}`);
      }
      rainLineSvg = `<path d="${rainD} Z" fill="none" stroke="#ffb800" stroke-width="2.5" stroke-dasharray="4,4" opacity="0.85" />
                     <text x="60" y="30" fill="#ffb800" font-size="11" font-weight="700" font-family="monospace">🌧️ RAIN LINE ACTIVE: 'SQUARE-OFF' (PIVOT & SQUIRT)</text>`;
    }

    // 3. Render Turn Anchors (Turn-In, Apex, Track-Out) & Markers
    let markersSvg = '';
    this.turns.forEach((turn, idx) => {
      const isSelected = idx === this.selectedTurnIndex;
      const frac = (turn.apexDistanceM || turn.distanceOffsetM || (idx + 0.5) / this.turns.length * this.totalDistanceM) / this.totalDistanceM;
      const ptIdx = Math.min(pts.length - 1, Math.max(0, Math.floor(frac * pts.length)));
      const pt = pts[ptIdx] || pts[0];
      const apexC = mapCoord(pt.x, pt.z);

      const typeColor = turn.cornerType === 'Type I' ? '#00ff66' : (turn.cornerType === 'Type II' ? '#ff3b30' : '#ffb800');

      // Apex Anchor Pill
      markersSvg += `
        <g class="map-turn-anchor ${isSelected ? 'selected' : ''}" data-turn-index="${idx}" style="cursor: pointer;">
          <circle cx="${apexC.svgX}" cy="${apexC.svgY}" r="${isSelected ? 16 : 12}" fill="${typeColor}" fill-opacity="${isSelected ? 0.35 : 0.2}" stroke="${typeColor}" stroke-width="${isSelected ? 3 : 1.5}" />
          <text x="${apexC.svgX}" y="${apexC.svgY + 4}" text-anchor="middle" fill="#ffffff" font-size="${isSelected ? 11 : 9}" font-weight="800" font-family="monospace">T${turn.turnNumber}</text>
        </g>
      `;

      if (isSelected) {
        // Draw Turn-In and Track-Out sub-pins
        const tiFrac = Math.max(0, (turn.turnInDistanceM || (turn.apexDistanceM - 60)) / this.totalDistanceM);
        const toFrac = Math.min(1, (turn.trackOutDistanceM || (turn.apexDistanceM + 70)) / this.totalDistanceM);
        
        const tiPt = pts[Math.floor(tiFrac * (pts.length - 1))] || pt;
        const toPt = pts[Math.floor(toFrac * (pts.length - 1))] || pt;
        const tiC = mapCoord(tiPt.x, tiPt.z);
        const toC = mapCoord(toPt.x, toPt.z);

        markersSvg += `
          <!-- Turn-In Pin -->
          <g class="draggable-sub-pin" data-pin="turnIn" style="cursor: move;">
            <line x1="${apexC.svgX}" y1="${apexC.svgY}" x2="${tiC.svgX}" y2="${tiC.svgY}" stroke="#00e5ff" stroke-width="1.5" stroke-dasharray="3,3" />
            <circle cx="${tiC.svgX}" cy="${tiC.svgY}" r="7" fill="#00e5ff" stroke="#ffffff" stroke-width="1.5" />
            <text x="${tiC.svgX}" y="${tiC.svgY - 10}" text-anchor="middle" fill="#00e5ff" font-size="9" font-weight="700" font-family="monospace">TI</text>
          </g>

          <!-- Track-Out Pin -->
          <g class="draggable-sub-pin" data-pin="trackOut" style="cursor: move;">
            <line x1="${apexC.svgX}" y1="${apexC.svgY}" x2="${toC.svgX}" y2="${toC.svgY}" stroke="#ffb800" stroke-width="1.5" stroke-dasharray="3,3" />
            <circle cx="${toC.svgX}" cy="${toC.svgY}" r="7" fill="#ffb800" stroke="#ffffff" stroke-width="1.5" />
            <text x="${toC.svgX}" y="${toC.svgY - 10}" text-anchor="middle" fill="#ffb800" font-size="9" font-weight="700" font-family="monospace">TO</text>
          </g>
        `;
      }
    });

    // 4. Synchronized Car Cursor Dot
    const scrubFrac = Math.min(1, Math.max(0, this.activeScrubDistanceM / this.totalDistanceM));
    const scrubPtIdx = Math.min(pts.length - 1, Math.floor(scrubFrac * pts.length));
    const carPt = pts[scrubPtIdx] || pts[0];
    const carC = mapCoord(carPt.x, carPt.z);

    const carDotSvg = `
      <g id="map-car-cursor">
        <circle cx="${carC.svgX}" cy="${carC.svgY}" r="9" fill="#ff3b30" stroke="#ffffff" stroke-width="2.5" />
        <circle cx="${carC.svgX}" cy="${carC.svgY}" r="18" fill="none" stroke="#ff3b30" stroke-width="1" stroke-dasharray="2,2" opacity="0.7">
          <animate attributeName="r" values="9;22;9" dur="1.8s" repeatCount="indefinite" />
        </circle>
      </g>
    `;

    this.svgMapContainer.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="background: #0d1117; border-radius: 6px;">
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#0d1117" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#mapGlow)" />
        ${trackLinesSvg}
        ${rainLineSvg}
        ${markersSvg}
        ${carDotSvg}
      </svg>
    `;

    // Bind map anchor click events
    const anchors = this.svgMapContainer.querySelectorAll('.map-turn-anchor');
    anchors.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const turnIdx = parseInt(el.dataset.turnIndex, 10);
        if (!isNaN(turnIdx)) {
          this.selectedTurnIndex = turnIdx;
          const turn = this.turns[turnIdx];
          this.activeScrubDistanceM = turn?.turnInDistanceM || turn?.distanceOffsetM || 0;
          this.renderTurnPills();
          this.populateInspector();
          this.renderMap();
          this.renderTelemetryStrip();
        }
      });
    });
  }

  /**
   * Renders the Bottom Pane Synchronized Multi-Channel Telemetry Strip (Speed, TPS, Brake, Steer, LatG)
   * with Skip Barber 4-Block Entry Brackets
   */
  renderTelemetryStrip() {
    if (!this.telemetryCanvas || this.telemetryPoints.length < 2) return;

    const canvas = this.telemetryCanvas;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 900;
    canvas.height = 200;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const pts = this.telemetryPoints;

    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e2638';
    ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Draw 4-Block Brackets for the selected corner
    const turn = this.getCurrentTurn();
    if (turn) {
      const tiDist = turn.turnInDistanceM || (turn.apexDistanceM - 60);
      const apDist = turn.apexDistanceM || turn.distanceOffsetM;
      const toDist = turn.trackOutDistanceM || (turn.apexDistanceM + 70);

      const toX = (d) => (d / this.totalDistanceM) * width;
      const tiX = toX(tiDist);
      const apX = toX(apDist);
      const toXCoord = toX(toDist);

      // Block 2: Threshold Braking zone (Entry before Turn-In)
      const b2Dist = turn.fourBlocks?.block2?.distanceMeters || 65;
      const b2StartX = toX(Math.max(0, tiDist - b2Dist));

      ctx.fillStyle = 'rgba(225, 6, 0, 0.15)';
      ctx.fillRect(b2StartX, 0, Math.max(10, tiX - b2StartX), height);

      // Block 3: Trail-Braking zone (Turn-In to Apex)
      ctx.fillStyle = 'rgba(229, 169, 16, 0.15)';
      ctx.fillRect(tiX, 0, Math.max(10, apX - tiX), height);

      // Exit Acceleration zone (Apex to Track-Out)
      ctx.fillStyle = 'rgba(0, 204, 102, 0.12)';
      ctx.fillRect(apX, 0, Math.max(10, toXCoord - apX), height);

      // Bracket labels
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ff3b30';
      ctx.fillText('BLOCK 2: THRESHOLD BRAKE', b2StartX + 4, 18);
      ctx.fillStyle = '#ffb800';
      ctx.fillText('BLOCK 3: TRAIL-BRAKE', tiX + 4, 18);
      ctx.fillStyle = '#00ff66';
      ctx.fillText('EXIT ACCELERATION', apX + 4, 18);
    }

    // 2. Draw Speed Trace (White / Cyan)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = (pts[i].distanceM / this.totalDistanceM) * width;
      const y = height - (pts[i].speedKmh / 260) * (height - 35) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Draw Throttle Trace (Green)
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = (pts[i].distanceM / this.totalDistanceM) * width;
      const y = height - (pts[i].throttlePct / 100) * 50 - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. Draw Brake Trace (Red)
    ctx.strokeStyle = 'rgba(255, 59, 48, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = (pts[i].distanceM / this.totalDistanceM) * width;
      const y = height - (pts[i].brakeForcePct / 100) * 50 - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 5. Active Scrub Crosshair
    const scrubX = (this.activeScrubDistanceM / this.totalDistanceM) * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(scrubX, 0);
    ctx.lineTo(scrubX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Channel Legend
    ctx.font = '10px monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('— Speed (km/h)', 10, height - 10);
    ctx.fillStyle = '#00ff66';
    ctx.fillText('— Throttle (TPS%)', 120, height - 10);
    ctx.fillStyle = '#ff3b30';
    ctx.fillText('— Brake Force (%)', 245, height - 10);
    ctx.fillStyle = '#8b9bb4';
    ctx.fillText(`Dist: ${Math.round(this.activeScrubDistanceM)}m / ${Math.round(this.totalDistanceM)}m`, width - 150, height - 10);

    // Bind scrubber click/drag on telemetry canvas
    if (!this.canvasBound) {
      const handleScrub = (e) => {
        const bounds = canvas.getBoundingClientRect();
        const clientX = e.clientX - bounds.left;
        const frac = Math.max(0, Math.min(1, clientX / bounds.width));
        this.activeScrubDistanceM = frac * this.totalDistanceM;
        this.renderTelemetryStrip();
        this.renderMap();
      };

      canvas.addEventListener('mousedown', (e) => {
        handleScrub(e);
        const onMove = (moveEvt) => handleScrub(moveEvt);
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
      this.canvasBound = true;
    }
  }

  /**
   * Automatically detects corner apexes from telemetry curvature and lateral G peaks
   */
  autoDetectCorners() {
    if (this.telemetryPoints.length < 20) return;

    const detected = [];
    const pts = this.telemetryPoints;
    let turnCount = 0;

    // Scan for local minimums of speed coupled with high lateral G or braking
    for (let i = 10; i < pts.length - 10; i += 8) {
      const p = pts[i];
      if (p.speedKmh < 140 && (p.brakeForcePct > 30 || p.latG > 0.9)) {
        // Ensure not too close to previous detected turn
        const last = detected[detected.length - 1];
        if (!last || Math.abs(p.distanceM - last.apexDistanceM) > 160) {
          turnCount++;
          const isHairpin = p.speedKmh < 75;
          const isSweeper = p.speedKmh > 120;
          const radiusM = isHairpin ? 30 : (isSweeper ? 130 : 65);

          detected.push({
            turnIndex: turnCount - 1,
            turnNumber: turnCount,
            name: isHairpin ? `Turn ${turnCount} (Hairpin)` : (isSweeper ? `Turn ${turnCount} (Sweeper)` : `Turn ${turnCount}`),
            cornerType: isHairpin ? 'Type II' : (turnCount % 2 === 0 ? 'Type I' : 'Type III'),
            radiusType: isHairpin ? 'Hairpin' : (isSweeper ? 'Sweeper' : 'Constant'),
            radiusMetersOverride: radiusM,
            camberDeg: 0,
            surfaceType: 'Standard Asphalt',
            elevationProfile: 'Level',
            curbSeverity: 'Flat Paint / Low Usable',
            distanceOffsetM: Math.round(p.distanceM),
            turnInDistanceM: Math.max(0, Math.round(p.distanceM - 60)),
            apexDistanceM: Math.round(p.distanceM),
            trackOutDistanceM: Math.min(this.totalDistanceM, Math.round(p.distanceM + 70)),
            precedingStraightMeters: isHairpin ? 350 : 150,
            followingStraightMeters: isHairpin ? 400 : 120,
            driverNotes: 'Auto-detected apex from telemetry curvature & speed minimum.'
          });
        }
      }
    }

    if (detected.length > 0) {
      this.turns = detected;
      this.selectedTurnIndex = 0;
      this.renderTurnPills();
      this.populateInspector();
      this.renderMap();
      this.renderTelemetryStrip();
      alert(`Auto-detected ${detected.length} corner apexes from telemetry trace!`);
    } else {
      alert('Could not isolate clear corner apexes from current telemetry data.');
    }
  }

  cycleRainMode() {
    if (this.activeRainMode === 'dry') this.activeRainMode = 'rim-shot';
    else if (this.activeRainMode === 'rim-shot') this.activeRainMode = 'square-off';
    else this.activeRainMode = 'dry';

    if (this.btnToggleRain) {
      this.btnToggleRain.innerHTML = `<span>🌧️</span> Rain Line: ${this.activeRainMode.toUpperCase()}`;
    }
    if (this.editorTrackSubtitle) {
      this.editorTrackSubtitle.textContent = `Layout: ${this.activeTrack?.layoutName || 'GP'} | Length: ${(this.totalTrackLengthMeters).toLocaleString()}m | Mode: ${this.activeRainMode.toUpperCase()}`;
    }

    this.renderMap();
  }

  addNewCorner() {
    const newTurnNum = this.turns.length + 1;
    const newTurn = {
      turnIndex: this.turns.length,
      turnNumber: newTurnNum,
      name: `Turn ${newTurnNum}`,
      cornerType: 'Type I',
      radiusType: 'Constant',
      radiusMetersOverride: 60,
      camberDeg: 0,
      surfaceType: 'Standard Asphalt',
      elevationProfile: 'Level',
      curbSeverity: 'Flat Paint / Low Usable',
      distanceOffsetM: Math.round(this.activeScrubDistanceM),
      turnInDistanceM: Math.max(0, Math.round(this.activeScrubDistanceM - 50)),
      apexDistanceM: Math.round(this.activeScrubDistanceM),
      trackOutDistanceM: Math.min(this.totalDistanceM, Math.round(this.activeScrubDistanceM + 60)),
      precedingStraightMeters: 150,
      followingStraightMeters: 200,
      driverNotes: ''
    };

    this.turns.push(newTurn);
    this.selectedTurnIndex = this.turns.length - 1;
    this.renderTurnPills();
    this.populateInspector();
    this.renderMap();
    this.renderTelemetryStrip();
  }

  deleteCurrentCorner() {
    if (this.turns.length <= 1) {
      alert('Track must have at least one corner defined.');
      return;
    }
    this.turns.splice(this.selectedTurnIndex, 1);
    this.selectedTurnIndex = Math.max(0, this.selectedTurnIndex - 1);
    // Renumber turns
    this.turns.forEach((t, i) => {
      t.turnIndex = i;
      t.turnNumber = i + 1;
    });
    this.renderTurnPills();
    this.populateInspector();
    this.renderMap();
    this.renderTelemetryStrip();
  }

  /**
   * Persists the edited track model to storage and triggers refresh of Track Study
   */
  saveChanges() {
    if (!this.activeTrack) return;
    this.recalcCurrentTurnPhysics();

    const editorPayload = {
      trackId: this.activeTrack.trackId,
      rainMode: this.activeRainMode,
      turns: this.turns,
      updatedAt: new Date().toISOString()
    };

    trackStudyStore.saveTrackEditorModel(this.activeTrack.trackId, editorPayload);

    // Save individual corner overrides to trackStudyStore for 4-phase synchronization
    this.turns.forEach((turn, idx) => {
      trackStudyStore.saveCornerStudy(this.activeTrack.trackId, idx, {
        cornerType: turn.cornerType,
        cornerTypeOverride: turn.cornerType,
        radiusMetersOverride: turn.geometry?.radiusMeters || turn.radiusMetersOverride,
        camberDeg: turn.camberDeg,
        camber: turn.camber,
        surfaceType: turn.surfaceType,
        elevationProfile: turn.elevationProfile,
        curbSeverity: turn.curbSeverity,
        fourBlocks: turn.fourBlocks,
        referenceMarkers: turn.referenceMarkers,
        driverNotes: turn.driverNotes
      });
    });

    if (typeof this.onSaveCallback === 'function') {
      this.onSaveCallback(this.turns);
    }

    alert('✅ Track Model & Telemetry Decomposition saved successfully!');
    this.hide();
  }

  resetToDefaults() {
    if (!confirm('Are you sure you want to revert all track edits to raw telemetry?')) return;
    if (this.activeTrack) {
      trackStudyStore.resetEditorModel(this.activeTrack.trackId);
      trackStudyStore.resetStudy(this.activeTrack.trackId);
      this.open(this.activeTrack, this.onSaveCallback);
    }
  }
}

export const trackEditorView = new TrackEditorView();
