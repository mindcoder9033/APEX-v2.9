/**
 * APEX Track Editor View Controller
 * Dual-View Studio: 2D Interactive Track Canvas + Synchronized Telemetry Strip + Waypoint Inspector
 * Rooted in Skip Barber's "Going Faster!" racing methodology.
 */

import { trackEditorEngine, WAYPOINT_TYPES, CORNER_TYPES } from './analysis/track-editor-engine.js';
import { trackStudyLibrary } from './analysis/track-study-library.js';
import { trackLibraryStore } from './track-library-store.js';

export class TrackEditorView {
  constructor() {
    this.container = null;
    this.mapCanvas = null;
    this.mapCtx = null;
    this.telemetryCanvas = null;
    this.telemetryCtx = null;

    this.currentTrackId = 'sebring-international-raceway--full-circuit';
    this.trackProfile = null;
    this.spline = [];
    this.telemetryData = [];
    this.waypoints = [];
    this.selectedWaypointId = null;

    // Viewport transform (Pan & Zoom)
    this.viewTransform = {
      zoom: 1.0,
      offsetX: 0,
      offsetY: 0,
      isPanning: false,
      startX: 0,
      startY: 0
    };

    // Scrubber & Dragging State
    this.scrubberDistNorm = 0.0; // 0.0 to 1.0
    this.draggingWaypointId = null;
    this.hoveredWaypointId = null;
    this.activeTab = 'list'; // 'list' | 'inspector'

    // Live Telemetry Buffer & Laps State
    this.liveTelemetrySamples = [];
    this.lapsCompleted = 0;
    this.currentLiveSample = null;
    this._prevLapNumber = null;
    this._prevLastLapTime = null;
    this._prevNormPos = null;
    this._lastLiveRenderTime = 0;
    this._lastAnalysisTime = 0;

    this._initialized = false;
  }

  /**
   * Initializes DOM bindings and canvas contexts
   */
  init() {
    this.container = document.getElementById('view-track-editor');
    if (!this.container) return;

    this.mapCanvas = document.getElementById('track-editor-canvas');
    this.telemetryCanvas = document.getElementById('telemetry-graph-canvas');

    if (this.mapCanvas) this.mapCtx = this.mapCanvas.getContext('2d');
    if (this.telemetryCanvas) this.telemetryCtx = this.telemetryCanvas.getContext('2d');

    if (!this._initialized) {
      this._initialized = true;
      this._bindEvents();
      this._populateTrackSelector();
    }

    this.resizeCanvases();
    this.loadTrack(this.currentTrackId);
  }

  _populateTrackSelector() {
    const select = document.getElementById('editor-track-selector');
    if (!select) return;

    const tracks = trackStudyLibrary.getAllCatalogTracks();
    let html = '';
    tracks.forEach(t => {
      html += `<option value="${t.trackId}">${t.displayName}</option>`;
    });
    select.innerHTML = html;
    select.value = this.currentTrackId;
  }

  _bindEvents() {
    // Window Resize
    window.addEventListener('resize', () => {
      if (this.container && this.container.style.display !== 'none') {
        this.resizeCanvases();
      }
    });

    // Track Selector
    const select = document.getElementById('editor-track-selector');
    if (select) {
      select.addEventListener('change', (e) => {
        this.loadTrack(e.target.value);
      });
    }

    // Auto-Detect Button
    const btnAutoDetect = document.getElementById('btn-editor-auto-detect');
    if (btnAutoDetect) {
      btnAutoDetect.addEventListener('click', () => {
        this.autoDetectWaypoints();
      });
    }

    // Add Waypoint Button
    const btnAddPoint = document.getElementById('btn-editor-add-point');
    if (btnAddPoint) {
      btnAddPoint.addEventListener('click', () => {
        this.addNewWaypointAtScrubber();
      });
    }

    // Clear All Button
    const btnClear = document.getElementById('btn-editor-clear-all');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('Clear all custom waypoints for this track?')) {
          this.waypoints = [];
          this.selectedWaypointId = null;
          this.saveWaypointsToStore();
          this.render();
          this.renderSidebar();
        }
      });
    }

    // Reset Viewport
    const btnResetView = document.getElementById('btn-editor-reset-view');
    if (btnResetView) {
      btnResetView.addEventListener('click', () => {
        this.fitTrackToCanvas();
        this.render();
      });
    }

    // Sidebar Tabs
    const tabBtns = this.container.querySelectorAll('.sidebar-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderSidebar();
      });
    });

    // 2D Map Canvas Mouse / Drag Interactions
    if (this.mapCanvas) {
      this.mapCanvas.addEventListener('mousedown', (e) => this._onMapMouseDown(e));
      this.mapCanvas.addEventListener('mousemove', (e) => this._onMapMouseMove(e));
      this.mapCanvas.addEventListener('mouseup', () => this._onMapMouseUp());
      this.mapCanvas.addEventListener('wheel', (e) => this._onMapWheel(e));
    }

    // Telemetry Canvas Scrubbing
    if (this.telemetryCanvas) {
      this.telemetryCanvas.addEventListener('mousedown', (e) => this._onTelemetryScrub(e));
      this.telemetryCanvas.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) this._onTelemetryScrub(e);
      });
    }
  }

  /**
   * Real-time live UDP telemetry ingestion
   * @param {Object} sample 
   */
  onTelemetrySample(sample) {
    if (!sample) return;
    this.currentLiveSample = sample;

    // Buffer up to 3500 recent live samples
    if (this.liveTelemetrySamples.length >= 3500) {
      this.liveTelemetrySamples.shift();
    }
    this.liveTelemetrySamples.push(sample);

    // Track lap progress
    this._trackLapProgress(sample);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // If we have at least 25 samples and spline is empty or awaiting baseline, dynamically update spline
    if (this.liveTelemetrySamples.length >= 25 && (!this._lastAnalysisTime || (now - this._lastAnalysisTime > 1500))) {
      this._lastAnalysisTime = now;
      if (this.spline.length === 0 || this.lapsCompleted < 5) {
        this._loadFromTelemetrySamples(this.liveTelemetrySamples);
        this.fitTrackToCanvas();
      }
    }

    // Dynamic scrubber position updates from live car position
    if (this.spline.length > 0) {
      const curX = sample.motion?.position?.x ?? sample.positionX ?? sample.posX ?? sample.x;
      const curZ = sample.motion?.position?.z ?? sample.positionZ ?? sample.posZ ?? sample.z;
      if (curX !== undefined && curZ !== undefined) {
        const nearest = trackEditorEngine.projectPointToSpline(curX, curZ, this.spline);
        if (nearest && nearest.normalizedDistance !== undefined) {
          this.scrubberDistNorm = nearest.normalizedDistance;
        }
      }
    }

    // Throttle rendering if view container is visible (15Hz max)
    if (this.container && this.container.style.display !== 'none') {
      if (!this._lastLiveRenderTime || (now - this._lastLiveRenderTime > 66)) {
        this._lastLiveRenderTime = now;
        this.render();
      }
    }
  }

  _trackLapProgress(sample) {
    if (!sample) return;

    const sampleLap = sample.timing?.lapNumber !== undefined 
      ? sample.timing.lapNumber 
      : (sample.lapNumber !== undefined 
          ? sample.lapNumber 
          : (sample.timing?.rawLapNumber !== undefined ? sample.timing.rawLapNumber + 1 : null));

    const lastLapTime = sample.timing?.lastLapTime !== undefined 
      ? sample.timing.lastLapTime 
      : (sample.lastLapTime !== undefined ? sample.lastLapTime : 0);

    const trackLen = this.trackProfile?.lengthMeters || 4000;
    let normPos = sample.timing?.normalizedDrivingLine !== undefined 
      ? sample.timing.normalizedDrivingLine 
      : (sample.lapDistanceMeters !== undefined ? (sample.lapDistanceMeters % trackLen) / trackLen : null);

    let lapCompletedEvent = false;

    if (sampleLap !== null) {
      if (this._prevLapNumber !== null && sampleLap > this._prevLapNumber) {
        lapCompletedEvent = true;
      }
      this._prevLapNumber = sampleLap;
    }

    if (lastLapTime > 0) {
      if (this._prevLastLapTime !== null && this._prevLastLapTime > 0 && Math.abs(lastLapTime - this._prevLastLapTime) > 0.05) {
        lapCompletedEvent = true;
      }
      this._prevLastLapTime = lastLapTime;
    } else if (this._prevLastLapTime === null) {
      this._prevLastLapTime = 0;
    }

    const speedKmh = sample.motion?.speedKmh || (sample.motion?.speedMps ? sample.motion.speedMps * 3.6 : (sample.speedMph ? sample.speedMph * 1.60934 : 0));
    if (normPos !== null && this._prevNormPos !== null && speedKmh > 15) {
      if (this._prevNormPos > 0.85 && normPos < 0.15) {
        lapCompletedEvent = true;
      }
    }
    this._prevNormPos = normPos;

    let calculatedLaps = this.lapsCompleted;
    if (sampleLap !== null && sampleLap > 1) {
      calculatedLaps = Math.max(calculatedLaps, sampleLap - 1);
    }
    if (lapCompletedEvent) {
      calculatedLaps = Math.max(calculatedLaps, this.lapsCompleted + 1);
    }

    if (calculatedLaps > this.lapsCompleted) {
      this.lapsCompleted = calculatedLaps;
      const badge5Lap = document.getElementById('editor-5lap-badge');
      if (badge5Lap) {
        if (this.lapsCompleted >= 5) {
          badge5Lap.className = 'editor-badge-5lap';
          badge5Lap.innerHTML = `<span>✓</span> 5-Lap Baseline Active (${this.lapsCompleted} Laps)`;
        } else {
          badge5Lap.className = 'editor-badge-5lap waiting';
          badge5Lap.innerHTML = `<span>⏳</span> Baseline: ${this.lapsCompleted}/5 Laps`;
        }
      }

      // Auto-detect waypoints if 5 laps reached and none created yet
      if (this.lapsCompleted >= 5 && this.waypoints.length === 0 && this.spline.length > 0) {
        this.waypoints = trackEditorEngine.autoDetectWaypoints(this.spline);
        this.saveWaypointsToStore();
        this.renderSidebar();
      }
    }
  }

  /**
   * Loads track profile and real telemetry baseline if available.
   * Directly syncs with Track Study telemetry data, live session laps, and stored track dossiers.
   * @param {string} trackId 
   */
  loadTrack(trackId) {
    this.currentTrackId = trackId;
    this.trackProfile = trackStudyLibrary.getTrackStudyProfile(trackId);
    this.waypoints = trackStudyLibrary.getWaypoints(trackId);

    const trackStudy = window.apexApp?.trackStudy;
    const session = window.apexApp?.session;
    const sessionLaps = session?.latestAnalysisReport?.laps || session?.laps || [];
    const has5Laps = trackEditorEngine.hasValid5LapBaseline(sessionLaps);
    const studyState = trackStudyLibrary.getTrackStudyState(trackId);
    const storedTrack = trackLibraryStore.getTrackById(trackId);

    // Calculate effective completed lap count across session, track study, and stored records
    let totalLaps = sessionLaps.length;
    if (totalLaps < (this.lapsCompleted || 0)) {
      totalLaps = this.lapsCompleted;
    }
    if (totalLaps < 5 && studyState?.lapsCompleted) {
      totalLaps = studyState.lapsCompleted;
    }
    if (totalLaps < 5 && trackStudy && (trackStudy.selectedTrackId === trackId || !trackStudy.selectedTrackId) && trackStudy.lapsCompleted) {
      totalLaps = trackStudy.lapsCompleted;
    }
    this.lapsCompleted = totalLaps;

    const badge5Lap = document.getElementById('editor-5lap-badge');
    if (badge5Lap) {
      if (totalLaps >= 5 || has5Laps) {
        badge5Lap.className = 'editor-badge-5lap';
        badge5Lap.innerHTML = `<span>✓</span> 5-Lap Baseline Active (${totalLaps} Laps)`;
      } else {
        badge5Lap.className = 'editor-badge-5lap waiting';
        badge5Lap.innerHTML = `<span>⏳</span> Baseline: ${totalLaps}/5 Laps`;
      }
    }

    // 1. If 5 live session laps exist, synthesize composite
    if (has5Laps) {
      const baseline = trackEditorEngine.synthesize5LapBaseline(sessionLaps);
      this.spline = baseline.spline;
      this.telemetryData = baseline.telemetry;
    }
    // 2. Check if Track Editor's own live buffer has samples
    else if (Array.isArray(this.liveTelemetrySamples) && this.liveTelemetrySamples.length >= 20) {
      this._loadFromTelemetrySamples(this.liveTelemetrySamples);
    }
    // 3. Check if active Track Study has telemetry samples for this track
    else if (trackStudy && Array.isArray(trackStudy.telemetrySamples) && trackStudy.telemetrySamples.length >= 20) {
      this._loadFromTelemetrySamples(trackStudy.telemetrySamples);
    }
    // 4. Check if session has recorded samples
    else if (session && Array.isArray(session.recordedSamples) && session.recordedSamples.length >= 20) {
      this._loadFromTelemetrySamples(session.recordedSamples);
    }
    // 5. Check if saved Track Study state has persisted telemetry samples
    else if (studyState && Array.isArray(studyState.telemetrySamples) && studyState.telemetrySamples.length >= 20) {
      this._loadFromTelemetrySamples(studyState.telemetrySamples);
    }
    // 6. Check if Track Study has mapped corners with coordinates
    else if (studyState && Array.isArray(studyState.corners) && studyState.corners.length > 0) {
      this._loadFromStudyCorners(studyState.corners);
    }
    // 7. Check if persistent track library has recorded vectorMap points
    else if (storedTrack && storedTrack.vectorMap?.points?.length > 10) {
      this._loadFromStoredVectorMap(storedTrack);
    }
    // 8. Zero-mock fallback: empty spline
    else {
      this.spline = [];
      this.telemetryData = [];
    }

    // If no custom waypoints exist yet but we have real spline telemetry and 5 laps, auto-detect milestones
    if (this.waypoints.length === 0 && this.spline.length > 0 && totalLaps >= 5) {
      this.waypoints = trackEditorEngine.autoDetectWaypoints(this.spline);
      this.saveWaypointsToStore();
    }

    this.fitTrackToCanvas();
    this.render();
    this.renderSidebar();
  }

  _loadFromTelemetrySamples(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return;
    const spline = [];
    const telemetry = [];
    let cumDist = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const x = s.motion?.position?.x ?? s.positionX ?? s.posX ?? s.x ?? 0;
      const z = s.motion?.position?.z ?? s.positionZ ?? s.posZ ?? s.z ?? (s.motion?.position?.y !== undefined ? s.motion.position.y : (s.y ?? 0));
      const speedMph = s.motion?.speedMph ?? s.speedMph ?? (s.motion?.speedMps ? s.motion.speedMps * 2.23694 : ((s.speed || 0) * 2.23694));
      const throttle = s.inputs?.throttle !== undefined ? (s.inputs.throttle <= 1 ? s.inputs.throttle * 100 : s.inputs.throttle) : (s.throttle !== undefined ? (s.throttle <= 1 ? s.throttle * 100 : s.throttle) : 0);
      const brake = s.inputs?.brake !== undefined ? (s.inputs.brake <= 1 ? s.inputs.brake * 100 : s.inputs.brake) : (s.brake !== undefined ? (s.brake <= 1 ? s.brake * 100 : s.brake) : 0);
      const steer = s.inputs?.steering !== undefined ? s.inputs.steering : (s.steer !== undefined ? s.steer : (s.steerAngle || 0));
      const gLat = s.motion?.acceleration?.lateralG ?? s.gLat ?? s.accelLateral ?? 0;
      const gLong = s.motion?.acceleration?.longitudinalG ?? s.gLong ?? s.accelForward ?? 0;

      if (spline.length > 0) {
        const prev = spline[spline.length - 1];
        const dx = x - prev.x;
        const dz = z - prev.z;
        const distDelta = Math.sqrt(dx * dx + dz * dz);
        // Avoid duplicate stationary points if distance delta is virtually zero (< 0.05m)
        if (distDelta < 0.05 && i < samples.length - 1) {
          continue;
        }
        cumDist += distDelta;
      }

      spline.push({
        index: spline.length,
        x,
        z,
        distance: cumDist,
        speedMph,
        throttle,
        brake,
        steer,
        gLat,
        gLong
      });
    }

    if (spline.length === 0) return;

    const totalDist = cumDist > 0 ? cumDist : 1;
    spline.forEach(p => {
      p.normalizedDistance = p.distance / totalDist;
      telemetry.push({
        distance: p.distance,
        normDist: p.normalizedDistance,
        speedMph: p.speedMph,
        throttle: p.throttle,
        brake: p.brake,
        steer: p.steer,
        gLat: p.gLat
      });
    });

    this.spline = spline;
    this.telemetryData = telemetry;
  }

  _loadFromStudyCorners(corners) {
    if (!Array.isArray(corners) || corners.length === 0) return;
    const spline = [];
    const telemetry = [];
    let cumDist = 0;

    corners.forEach((c, i) => {
      const x = c.coordinates?.x !== undefined ? c.coordinates.x : (c.x || (i * 30));
      const z = c.coordinates?.y !== undefined ? c.coordinates.y : (c.coordinates?.z || (c.z || 0));
      const speedMph = c.apexSpeedMph || (c.targetSpeedMph || 60);

      if (spline.length > 0) {
        const prev = spline[spline.length - 1];
        const dx = x - prev.x;
        const dz = z - prev.z;
        cumDist += Math.sqrt(dx * dx + dz * dz);
      }

      spline.push({
        index: spline.length,
        x,
        z,
        distance: cumDist,
        speedMph,
        throttle: c.type === 'Type I' ? 100 : 50,
        brake: c.type === 'Type II' ? 80 : 20,
        steer: 15,
        gLat: 0.9
      });
    });

    if (spline.length === 0) return;

    const totalDist = cumDist > 0 ? cumDist : 1;
    spline.forEach(p => {
      p.normalizedDistance = p.distance / totalDist;
      telemetry.push({
        distance: p.distance,
        normDist: p.normalizedDistance,
        speedMph: p.speedMph,
        throttle: p.throttle,
        brake: p.brake,
        steer: p.steer,
        gLat: p.gLat
      });
    });

    this.spline = spline;
    this.telemetryData = telemetry;
  }

  _loadFromStoredVectorMap(storedTrack) {
    const rawPoints = storedTrack.vectorMap.points || [];
    const spline = [];
    const telemetry = [];
    let cumDist = 0;

    for (let i = 0; i < rawPoints.length; i++) {
      const p = rawPoints[i];
      const x = p.x || 0;
      const z = p.y !== undefined ? p.y : (p.z || 0);
      const speedMph = (p.speed || 0) * 2.23694;

      if (spline.length > 0) {
        const prev = spline[spline.length - 1];
        const dx = x - prev.x;
        const dz = z - prev.z;
        cumDist += Math.sqrt(dx * dx + dz * dz);
      }

      spline.push({
        index: spline.length,
        x,
        z,
        distance: cumDist,
        speedMph,
        throttle: p.state === 'throttle' ? 100 : 0,
        brake: p.state === 'brake' ? 80 : 0,
        steer: 0,
        gLat: 0
      });
    }

    if (spline.length === 0) return;

    const totalDist = cumDist > 0 ? cumDist : 1;
    spline.forEach(p => {
      p.normalizedDistance = p.distance / totalDist;
      telemetry.push({
        distance: p.distance,
        normDist: p.normalizedDistance,
        speedMph: p.speedMph,
        throttle: p.throttle,
        brake: p.brake,
        steer: p.steer,
        gLat: p.gLat
      });
    });

    this.spline = spline;
    this.telemetryData = telemetry;
  }

  fitTrackToCanvas() {
    if (!this.mapCanvas || this.spline.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    this.spline.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    const rangeX = maxX - minX || 100;
    const rangeZ = maxZ - minZ || 100;
    const padding = 60;
    const width = this.mapCanvas.width || 800;
    const height = this.mapCanvas.height || 600;
    const scaleX = (width - padding * 2) / rangeX;
    const scaleZ = (height - padding * 2) / rangeZ;
    const zoom = Math.min(scaleX, scaleZ);

    this.viewTransform.zoom = zoom;
    this.viewTransform.offsetX = width / 2 - ((minX + maxX) / 2) * zoom;
    this.viewTransform.offsetY = height / 2 - ((minZ + maxZ) / 2) * zoom;
  }

  resizeCanvases() {
    if (this.mapCanvas && this.mapCanvas.parentElement) {
      const rect = this.mapCanvas.parentElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.mapCanvas.width = Math.floor(rect.width);
        this.mapCanvas.height = Math.floor(rect.height);
      }
    }
    if (this.telemetryCanvas && this.telemetryCanvas.parentElement) {
      const rect = this.telemetryCanvas.parentElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.telemetryCanvas.width = Math.floor(rect.width);
        this.telemetryCanvas.height = Math.floor(rect.height);
      }
    }
    this.fitTrackToCanvas();
    this.render();
  }

  /**
   * Main Render Loop
   */
  render() {
    this.renderMap();
    this.renderTelemetry();
  }

  /**
   * 2D Track Map Renderer
   */
  renderMap() {
    if (!this.mapCtx || !this.mapCanvas) return;
    const ctx = this.mapCtx;
    const { width, height } = this.mapCanvas;

    ctx.clearRect(0, 0, width, height);

    if (this.spline.length === 0) {
      ctx.save();
      // Subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AWAITING 5-LAP STINT TELEMETRY', width / 2, height / 2 - 20);

      ctx.fillStyle = '#888888';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('Drive on track in Forza Motorsport to extract real circuit geometry.', width / 2, height / 2 + 8);

      const sessionLaps = window.apexApp?.session?.latestAnalysisReport?.laps || window.apexApp?.session?.laps || [];
      const lapsCount = Math.max(sessionLaps.length, this.lapsCompleted || 0);
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`CURRENT PROGRESS: ${lapsCount} / 5 LAPS RECORDED (${this.liveTelemetrySamples.length} PACKETS LOGGED)`, width / 2, height / 2 + 34);

      ctx.restore();
      return;
    }

    const { zoom, offsetX, offsetY } = this.viewTransform;

    // Coordinate space converter
    const toScreen = (x, z) => ({
      x: x * zoom + offsetX,
      y: z * zoom + offsetY
    });

    // 1. Draw Track Ribbon Base (Outer & Inner boundaries)
    ctx.beginPath();
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < this.spline.length; i++) {
      const pt = toScreen(this.spline[i].x, this.spline[i].z);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();

    // 2. Draw Ideal Racing Line
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00e5ff';
    for (let i = 0; i < this.spline.length; i++) {
      const pt = toScreen(this.spline[i].x, this.spline[i].z);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();

    // 3. Draw Start/Finish Line
    if (this.spline.length > 0) {
      const sf = toScreen(this.spline[0].x, this.spline[0].z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sf.x, sf.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Waypoints
    this.waypoints.forEach(wp => {
      const wpZ = wp.coordinates?.y !== undefined ? wp.coordinates.y : (wp.coordinates?.z ?? 0);
      const pos = toScreen(wp.coordinates?.x ?? 0, wpZ);
      const isSelected = wp.id === this.selectedWaypointId;
      const isHovered = wp.id === this.hoveredWaypointId;

      let color = '#ffffff';
      if (wp.type === WAYPOINT_TYPES.BRAKE_POINT) color = '#ff3d00';
      else if (wp.type === WAYPOINT_TYPES.TURN_IN) color = '#ffea00';
      else if (wp.type === WAYPOINT_TYPES.APEX_GEOMETRIC || wp.type === WAYPOINT_TYPES.APEX_LATE) color = '#00e676';
      else if (wp.type === WAYPOINT_TYPES.THROTTLE_APP) color = '#00b0ff';
      else if (wp.type === WAYPOINT_TYPES.TRACK_OUT) color = '#d500f9';

      // Pin Glow / Selection Halo
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 12 : 9, 0, Math.PI * 2);
        ctx.fillStyle = `${color}44`;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      // Pin Core
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Corner Number Label
      if (wp.cornerNumber) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`T${wp.cornerNumber}`, pos.x + 8, pos.y - 6);
      }
    });

    // 5. Draw Car Scrubber Position Dot
    if (this.spline.length > 0) {
      const scrubIdx = Math.min(this.spline.length - 1, Math.max(0, Math.floor(this.scrubberDistNorm * this.spline.length)));
      const carPt = this.spline[scrubIdx];
      if (carPt) {
        const carScreen = toScreen(carPt.x, carPt.z);
        ctx.beginPath();
        ctx.arc(carScreen.x, carScreen.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  /**
   * Synchronized Telemetry Strip Graph Renderer
   */
  renderTelemetry() {
    if (!this.telemetryCtx || !this.telemetryCanvas) return;
    const ctx = this.telemetryCtx;
    const { width, height } = this.telemetryCanvas;

    ctx.clearRect(0, 0, width, height);

    if (this.telemetryData.length === 0) {
      ctx.save();
      ctx.fillStyle = '#666666';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Telemetry timeline will populate when 5-lap baseline is recorded.', width / 2, height / 2 + 4);
      ctx.restore();
      return;
    }

    // Background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const maxSpeed = 160;
    const dataLen = this.telemetryData.length;

    const getX = (i) => (i / (dataLen - 1)) * width;

    // 1. Draw Speed Channel (Cyan)
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    for (let i = 0; i < dataLen; i++) {
      const x = getX(i);
      const y = height - (this.telemetryData[i].speedMph / maxSpeed) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Draw Throttle % (Green)
    ctx.beginPath();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < dataLen; i++) {
      const x = getX(i);
      const y = height - (this.telemetryData[i].throttle / 100) * (height * 0.4) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Draw Brake % (Red)
    ctx.beginPath();
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < dataLen; i++) {
      const x = getX(i);
      const y = height - (this.telemetryData[i].brake / 100) * (height * 0.4) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. Draw Waypoint Markers along the Timeline
    this.waypoints.forEach(wp => {
      const wpX = wp.normalizedDistance * width;
      let color = '#ffffff';
      if (wp.type === WAYPOINT_TYPES.BRAKE_POINT) color = '#ff3d00';
      else if (wp.type === WAYPOINT_TYPES.TURN_IN) color = '#ffea00';
      else if (wp.type === WAYPOINT_TYPES.APEX_GEOMETRIC || wp.type === WAYPOINT_TYPES.APEX_LATE) color = '#00e676';
      else if (wp.type === WAYPOINT_TYPES.THROTTLE_APP) color = '#00b0ff';
      else if (wp.type === WAYPOINT_TYPES.TRACK_OUT) color = '#d500f9';

      ctx.strokeStyle = color;
      ctx.lineWidth = wp.id === this.selectedWaypointId ? 2 : 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(wpX, 0);
      ctx.lineTo(wpX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 5. Draw Active Scrubber Line
    const scrubX = this.scrubberDistNorm * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scrubX, 0);
    ctx.lineTo(scrubX, height);
    ctx.stroke();
  }

  /**
   * Sidebar View Switcher & Form Builder
   */
  renderSidebar() {
    const scrollContainer = this.container?.querySelector('.sidebar-content-scroll');
    if (!scrollContainer) return;

    if (this.activeTab === 'list') {
      this._renderWaypointsListTab(scrollContainer);
    } else {
      this._renderInspectorTab(scrollContainer);
    }
  }

  _renderWaypointsListTab(container) {
    if (this.waypoints.length === 0) {
      const hasSpline = this.spline.length > 0;
      container.innerHTML = `
        <div style="text-align: center; color: #777; padding: 40px 14px; font-family: monospace; font-size: 12px; line-height: 1.5;">
          <p style="color: #aaa; margin-bottom: 6px;">No waypoints defined for this circuit.</p>
          ${hasSpline ? `
            <p style="font-size: 11px; color: #888;">Telemetry baseline is active. Click below to automatically extract Skip Barber braking, turn-in, and apex markers.</p>
            <button id="btn-empty-autodetect" class="btn btn-primary" style="margin-top: 12px; font-size: 11px; font-weight: 700;">
              ⚡ Auto-Detect from 5-Lap Baseline
            </button>
          ` : `
            <p style="font-size: 11px; color: #666;">Complete 5 laps in Forza Motorsport to enable telemetry-based milestone extraction.</p>
          `}
        </div>
      `;
      const btn = container.querySelector('#btn-empty-autodetect');
      if (btn) btn.onclick = () => this.autoDetectWaypoints();
      return;
    }

    let html = `<div class="waypoint-list-group">`;
    this.waypoints.forEach(wp => {
      const isSelected = wp.id === this.selectedWaypointId;
      let badgeBg = '#333';
      let typeLabel = wp.type.replace('_', ' ');

      if (wp.type === WAYPOINT_TYPES.BRAKE_POINT) badgeBg = 'rgba(255, 61, 0, 0.2); color: #ff3d00;';
      else if (wp.type === WAYPOINT_TYPES.TURN_IN) badgeBg = 'rgba(255, 234, 0, 0.2); color: #ffea00;';
      else if (wp.type.startsWith('APEX')) badgeBg = 'rgba(0, 230, 118, 0.2); color: #00e676;';
      else if (wp.type === WAYPOINT_TYPES.THROTTLE_APP) badgeBg = 'rgba(0, 176, 255, 0.2); color: #00b0ff;';
      else if (wp.type === WAYPOINT_TYPES.TRACK_OUT) badgeBg = 'rgba(213, 0, 249, 0.2); color: #d500f9;';

      html += `
        <div class="waypoint-card-item ${isSelected ? 'selected' : ''}" data-id="${wp.id}">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="waypoint-pill-type" style="background: ${badgeBg}">${typeLabel}</span>
              <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #fff;">
                ${wp.cornerNumber ? `Turn ${wp.cornerNumber}` : 'Waypoint'}
              </span>
            </div>
            <span style="font-family: monospace; font-size: 10px; color: #888;">
              ${wp.distanceMeters || 0}m • ${wp.targetSpeedMph || 0} mph • Gear ${wp.targetGear || 2}
            </span>
          </div>
          <button class="btn-delete-wp btn btn-secondary btn-icon" data-id="${wp.id}" style="padding: 4px; font-size: 10px;" title="Delete">✕</button>
        </div>
      `;
    });
    html += `</div>`;

    container.innerHTML = html;

    // Item Selection & Deletion Click handlers
    container.querySelectorAll('.waypoint-card-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-wp')) return;
        this.selectWaypoint(el.dataset.id);
        this.activeTab = 'inspector';
        const tabBtns = this.container.querySelectorAll('.sidebar-tab-btn');
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'inspector'));
        this.renderSidebar();
      });
    });

    container.querySelectorAll('.btn-delete-wp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteWaypoint(btn.dataset.id);
      });
    });
  }

  _renderInspectorTab(container) {
    const wp = this.waypoints.find(w => w.id === this.selectedWaypointId);
    if (!wp) {
      container.innerHTML = `
        <div style="text-align: center; color: #777; padding: 40px 10px; font-family: monospace; font-size: 12px;">
          <p>Select a waypoint on the track map or timeline to inspect and edit its Skip Barber attributes.</p>
        </div>
      `;
      return;
    }

    const radiusFeet = trackEditorEngine.calculateRadiusForSpeed(wp.targetSpeedMph || 60, 1.1);
    const theoSpeed = trackEditorEngine.calculateTheoreticalCornerSpeed(radiusFeet, 1.1);

    container.innerHTML = `
      <form id="form-waypoint-inspector" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="form-field-group">
          <label class="form-field-label">Waypoint Type</label>
          <select id="field-wp-type" class="form-field-select">
            <option value="${WAYPOINT_TYPES.BRAKE_POINT}" ${wp.type === WAYPOINT_TYPES.BRAKE_POINT ? 'selected' : ''}>🔴 Braking Point (Threshold/Trail)</option>
            <option value="${WAYPOINT_TYPES.TURN_IN}" ${wp.type === WAYPOINT_TYPES.TURN_IN ? 'selected' : ''}>🟡 Turn-In Point</option>
            <option value="${WAYPOINT_TYPES.APEX_GEOMETRIC}" ${wp.type === WAYPOINT_TYPES.APEX_GEOMETRIC ? 'selected' : ''}>🟢 Geometric Apex (Midpoint)</option>
            <option value="${WAYPOINT_TYPES.APEX_LATE}" ${wp.type === WAYPOINT_TYPES.APEX_LATE ? 'selected' : ''}>🟢 Late Apex (Type I Priority)</option>
            <option value="${WAYPOINT_TYPES.THROTTLE_APP}" ${wp.type === WAYPOINT_TYPES.THROTTLE_APP ? 'selected' : ''}>🔵 Throttle Application Point</option>
            <option value="${WAYPOINT_TYPES.TRACK_OUT}" ${wp.type === WAYPOINT_TYPES.TRACK_OUT ? 'selected' : ''}>🟣 Track-Out Point (Exit)</option>
            <option value="${WAYPOINT_TYPES.SIGHT_CUE}" ${wp.type === WAYPOINT_TYPES.SIGHT_CUE ? 'selected' : ''}>⚪ Sight Picture Reference</option>
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="form-field-group">
            <label class="form-field-label">Corner #</label>
            <input id="field-wp-corner" type="number" class="form-field-input" value="${wp.cornerNumber || 1}" min="1" max="99" />
          </div>
          <div class="form-field-group">
            <label class="form-field-label">Target Gear</label>
            <input id="field-wp-gear" type="number" class="form-field-input" value="${wp.targetGear || 2}" min="1" max="8" />
          </div>
        </div>

        <div class="form-field-group">
          <label class="form-field-label">Corner Classification (Skip Barber)</label>
          <select id="field-wp-classification" class="form-field-select">
            <option value="${CORNER_TYPES.TYPE_I}" ${wp.cornerClassification === CORNER_TYPES.TYPE_I ? 'selected' : ''}>Type I: Onto Straight (Exit Speed is King)</option>
            <option value="${CORNER_TYPES.TYPE_II}" ${wp.cornerClassification === CORNER_TYPES.TYPE_II ? 'selected' : ''}>Type II: End of Straight (Entry & Trail Focus)</option>
            <option value="${CORNER_TYPES.TYPE_III}" ${wp.cornerClassification === CORNER_TYPES.TYPE_III ? 'selected' : ''}>Type III: Compromise Esse (Sacrifice for Next)</option>
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="form-field-group">
            <label class="form-field-label">Target Speed (mph)</label>
            <input id="field-wp-speed" type="number" class="form-field-input" value="${wp.targetSpeedMph || 60}" />
          </div>
          <div class="form-field-group">
            <label class="form-field-label">Distance (m)</label>
            <input id="field-wp-dist" type="number" class="form-field-input" value="${wp.distanceMeters || 0}" />
          </div>
        </div>

        <!-- Skip Barber Corner Physics Box -->
        <div class="physics-readout-box">
          <div class="physics-row">
            <span style="color: #888;">Calculated Radius (R):</span>
            <span style="color: #00e5ff; font-weight: 700;">${Math.round(radiusFeet)} ft</span>
          </div>
          <div class="physics-row">
            <span style="color: #888;">G-Limit Speed (15*G*R):</span>
            <span style="color: #00e676; font-weight: 700;">${Math.round(theoSpeed)} mph @ 1.1G</span>
          </div>
        </div>

        <!-- Sight Picture Landmark -->
        <div class="form-field-group">
          <label class="form-field-label">Sight Picture Label (Landmark)</label>
          <input id="field-wp-label" type="text" class="form-field-input" value="${wp.sightPicture?.label || ''}" placeholder="e.g. 2nd Reflector / Painted Pylon" />
        </div>

        <div class="form-field-group">
          <label class="form-field-label">Driver Notes & Coaching Guidance</label>
          <textarea id="field-wp-notes" class="form-field-textarea" placeholder="e.g. Unwind steering progressively, positive camber at apex...">${wp.sightPicture?.notes || ''}</textarea>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="btn-save-inspector" type="button" class="btn btn-primary" style="flex: 1;">Save Changes</button>
          <button id="btn-delete-inspector" type="button" class="btn btn-secondary" style="color: #ff1744;">Delete</button>
        </div>
      </form>
    `;

    const form = container.querySelector('#form-waypoint-inspector');
    if (!form) return;

    form.querySelector('#btn-save-inspector').onclick = () => {
      wp.type = form.querySelector('#field-wp-type').value;
      wp.cornerNumber = parseInt(form.querySelector('#field-wp-corner').value, 10);
      wp.targetGear = parseInt(form.querySelector('#field-wp-gear').value, 10);
      wp.cornerClassification = form.querySelector('#field-wp-classification').value;
      wp.targetSpeedMph = parseFloat(form.querySelector('#field-wp-speed').value);
      wp.distanceMeters = parseFloat(form.querySelector('#field-wp-dist').value);
      wp.sightPicture = {
        label: form.querySelector('#field-wp-label').value,
        notes: form.querySelector('#field-wp-notes').value
      };
      wp.updatedAt = new Date().toISOString();

      this.saveWaypointsToStore();
      this.render();
      if (window.PitToast) window.PitToast.success('Waypoint Updated', `Turn ${wp.cornerNumber}`);
    };

    form.querySelector('#btn-delete-inspector').onclick = () => {
      this.deleteWaypoint(wp.id);
    };
  }

  selectWaypoint(waypointId) {
    this.selectedWaypointId = waypointId;
    const wp = this.waypoints.find(w => w.id === waypointId);
    if (wp) {
      this.scrubberDistNorm = wp.normalizedDistance || 0.0;
    }
    this.render();
    this.renderSidebar();
  }

  deleteWaypoint(waypointId) {
    this.waypoints = this.waypoints.filter(w => w.id !== waypointId);
    if (this.selectedWaypointId === waypointId) {
      this.selectedWaypointId = null;
    }
    this.saveWaypointsToStore();
    this.render();
    this.renderSidebar();
  }

  addNewWaypointAtScrubber() {
    if (this.spline.length === 0) return;
    const idx = Math.min(this.spline.length - 1, Math.max(0, Math.floor(this.scrubberDistNorm * this.spline.length)));
    const sample = this.spline[idx];

    const newWp = {
      id: `wp-${Date.now()}`,
      cornerNumber: 1,
      type: WAYPOINT_TYPES.SIGHT_CUE,
      distanceMeters: Math.round(sample.distance),
      normalizedDistance: sample.normalizedDistance,
      coordinates: { x: sample.x, y: sample.z },
      cornerClassification: CORNER_TYPES.TYPE_I,
      targetSpeedMph: Math.round(sample.speedMph),
      telemetrySpeedMph: Math.round(sample.speedMph),
      targetGear: 3,
      sightPicture: {
        label: 'Custom Reference Cue',
        notes: 'Driver waypoint visual landmark'
      },
      createdAt: new Date().toISOString()
    };

    this.waypoints.push(newWp);
    this.waypoints.sort((a, b) => a.distanceMeters - b.distanceMeters);
    this.selectedWaypointId = newWp.id;
    this.saveWaypointsToStore();
    this.activeTab = 'inspector';
    this.render();
    this.renderSidebar();
  }

  autoDetectWaypoints() {
    if (this.spline.length === 0) return;
    this.waypoints = trackEditorEngine.autoDetectWaypoints(this.spline);
    this.saveWaypointsToStore();
    this.selectedWaypointId = this.waypoints[0]?.id || null;
    this.render();
    this.renderSidebar();
    if (window.PitToast) window.PitToast.success(`Auto-Detected ${this.waypoints.length} Milestones`, 'Track Editor');
  }

  saveWaypointsToStore() {
    trackStudyLibrary.saveAllWaypoints(this.currentTrackId, this.waypoints);
  }

  /* --- MOUSE / TOUCH EVENTS --- */
  _onMapMouseDown(e) {
    const rect = this.mapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if clicked near an existing waypoint
    const clickedWp = this._findWaypointAtScreenPos(mouseX, mouseY);
    if (clickedWp) {
      this.selectWaypoint(clickedWp.id);
      this.draggingWaypointId = clickedWp.id;
      return;
    }

    // Otherwise start panning
    this.viewTransform.isPanning = true;
    this.viewTransform.startX = mouseX - this.viewTransform.offsetX;
    this.viewTransform.startY = mouseY - this.viewTransform.offsetY;
  }

  _onMapMouseMove(e) {
    const rect = this.mapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (this.draggingWaypointId) {
      // Reposition dragged waypoint by projecting to nearest spline coordinate
      const worldX = (mouseX - this.viewTransform.offsetX) / this.viewTransform.zoom;
      const worldZ = (mouseY - this.viewTransform.offsetY) / this.viewTransform.zoom;
      const proj = trackEditorEngine.projectPointToSpline(worldX, worldZ, this.spline);

      const wp = this.waypoints.find(w => w.id === this.draggingWaypointId);
      if (wp && proj) {
        wp.coordinates = { x: proj.x, y: proj.z };
        wp.distanceMeters = Math.round(proj.distance);
        wp.normalizedDistance = proj.normalizedDistance;
        wp.targetSpeedMph = Math.round(proj.speedMph || wp.targetSpeedMph);
        this.scrubberDistNorm = proj.normalizedDistance;
        this.render();
      }
      return;
    }

    if (this.viewTransform.isPanning) {
      this.viewTransform.offsetX = mouseX - this.viewTransform.startX;
      this.viewTransform.offsetY = mouseY - this.viewTransform.startY;
      this.renderMap();
      return;
    }

    // Update Hover
    const hovered = this._findWaypointAtScreenPos(mouseX, mouseY);
    if (hovered?.id !== this.hoveredWaypointId) {
      this.hoveredWaypointId = hovered?.id || null;
      this.renderMap();
    }
  }

  _onMapMouseUp() {
    if (this.draggingWaypointId) {
      this.draggingWaypointId = null;
      this.waypoints.sort((a, b) => a.distanceMeters - b.distanceMeters);
      this.saveWaypointsToStore();
      this.renderSidebar();
    }
    this.viewTransform.isPanning = false;
  }

  _onMapWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const rect = this.mapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.viewTransform.offsetX = mouseX - (mouseX - this.viewTransform.offsetX) * zoomFactor;
    this.viewTransform.offsetY = mouseY - (mouseY - this.viewTransform.offsetY) * zoomFactor;
    this.viewTransform.zoom *= zoomFactor;
    this.renderMap();
  }

  _onTelemetryScrub(e) {
    const rect = this.telemetryCanvas.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    this.scrubberDistNorm = mouseX / rect.width;
    this.render();
  }

  _findWaypointAtScreenPos(screenX, screenY) {
    const { zoom, offsetX, offsetY } = this.viewTransform;
    const hitRadiusSq = 14 * 14;

    for (const wp of this.waypoints) {
      const sx = wp.coordinates.x * zoom + offsetX;
      const sy = wp.coordinates.y * zoom + offsetY;
      const dx = sx - screenX;
      const dy = sy - screenY;
      if (dx * dx + dy * dy <= hitRadiusSq) {
        return wp;
      }
    }
    return null;
  }
}

export const trackEditorView = new TrackEditorView();
