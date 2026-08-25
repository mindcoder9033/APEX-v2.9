/**
 * APEX Track Library Component Controller
 * Manages track profile selection, interactive 2D SVG map visualizer,
 * turn geometry editing, PDF briefing export, and API synchronization.
 */

import { ClientTrackBriefingPdf } from '../track-briefing-pdf.js';
import { FM23_TRACKS } from '../data/fm23-tracks-data.js';

export class TrackLibraryComponent {
  constructor(options = {}) {
    this.sessionManager = options.sessionManager;
    this.tracks = [];
    this.selectedTrack = null;
    this.pdfGenerator = new ClientTrackBriefingPdf();

    // DOM Elements Cache
    this.viewContainer = document.getElementById('view-track-library');
    this.trackCardsList = document.getElementById('track-cards-list');
    this.searchInput = document.getElementById('track-search-input');
    this.btnCreateTrack = document.getElementById('btn-create-track-profile');
    this.inputImportJson = document.getElementById('input-import-track-json');

    // Hero Elements
    this.heroName = document.getElementById('track-hero-name');
    this.heroLayout = document.getElementById('track-hero-layout');
    this.heroDirection = document.getElementById('track-hero-direction');
    this.heroLength = document.getElementById('hero-stat-length');
    this.heroTurns = document.getElementById('hero-stat-turns');
    this.heroElevation = document.getElementById('hero-stat-elevation');
    this.heroStraight = document.getElementById('hero-stat-straight');
    this.heroRhythm = document.getElementById('hero-stat-rhythm');
    this.interactiveMapContainer = document.getElementById('track-interactive-map');

    // Hero Action Buttons
    this.btnSetActive = document.getElementById('btn-track-set-active');
    this.btnCalibrateLatest = document.getElementById('btn-track-calibrate-latest');
    this.btnExportPdf = document.getElementById('btn-track-export-pdf');
    this.btnDownloadJson = document.getElementById('btn-track-download-json');
    this.btnExportCsv = document.getElementById('btn-track-export-csv');
    this.btnDeleteTrack = document.getElementById('btn-track-delete');

    // Turn Editor Elements
    this.turnTableBody = document.getElementById('turn-edit-table-body');
    this.driverNotesInput = document.getElementById('track-driver-notes-input');
    this.btnSaveTurnEdits = document.getElementById('btn-save-turn-edits');

    // Create Track Modal Elements
    this.modalCreateTrack = document.getElementById('create-track-modal');
    this.selectLocation = document.getElementById('new-track-location-select');
    this.customNameContainer = document.getElementById('new-track-custom-name-container');
    this.inputCustomName = document.getElementById('new-track-custom-name-input');
    this.selectLayout = document.getElementById('new-track-layout-select');
    this.customLayoutContainer = document.getElementById('new-track-custom-layout-container');
    this.inputCustomLayout = document.getElementById('new-track-custom-layout-input');
    this.selectDirection = document.getElementById('new-track-direction-select');
    this.btnCloseCreateModal = document.getElementById('btn-close-create-track-modal');
    this.btnCancelCreate = document.getElementById('btn-cancel-create-track');
    this.btnSubmitCreate = document.getElementById('btn-submit-create-track');

    this.bindEvents();
    this.populateLocationDropdown();
    this.loadTracks();
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.filterTracks());
    }

    if (this.btnSetActive) {
      this.btnSetActive.addEventListener('click', () => this.setActiveTrack());
    }

    if (this.btnCalibrateLatest) {
      this.btnCalibrateLatest.addEventListener('click', () => this.calibrateSelectedTrackFromTelemetry());
    }

    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => this.exportBriefingPdf());
    }

    if (this.btnDownloadJson) {
      this.btnDownloadJson.addEventListener('click', () => this.downloadJson());
    }

    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => this.exportTrackCsv());
    }

    if (this.btnDeleteTrack) {
      this.btnDeleteTrack.addEventListener('click', () => this.deleteCurrentTrack());
    }

    if (this.btnSaveTurnEdits) {
      this.btnSaveTurnEdits.addEventListener('click', () => this.saveTurnEdits());
    }

    if (this.inputImportJson) {
      this.inputImportJson.addEventListener('change', (e) => this.handleImportJson(e));
    }

    // Modal Triggers
    if (this.btnCreateTrack) {
      this.btnCreateTrack.addEventListener('click', () => this.openCreateTrackModal());
    }

    if (this.btnCloseCreateModal) {
      this.btnCloseCreateModal.addEventListener('click', () => this.closeCreateTrackModal());
    }

    if (this.btnCancelCreate) {
      this.btnCancelCreate.addEventListener('click', () => this.closeCreateTrackModal());
    }

    if (this.modalCreateTrack) {
      this.modalCreateTrack.addEventListener('click', (e) => {
        if (e.target === this.modalCreateTrack) this.closeCreateTrackModal();
      });
    }

    if (this.selectLocation) {
      this.selectLocation.addEventListener('change', () => this.handleLocationChange());
    }

    if (this.selectLayout) {
      this.selectLayout.addEventListener('change', () => this.handleLayoutChange());
    }

    if (this.btnSubmitCreate) {
      this.btnSubmitCreate.addEventListener('click', () => this.handleCreateTrackSubmit());
    }
  }

  /**
   * Populates the 29 FM23 locations in the New Track modal
   */
  populateLocationDropdown() {
    if (!this.selectLocation) return;
    this.selectLocation.innerHTML = '';

    const realGroup = document.createElement('optgroup');
    realGroup.label = 'Real-World Circuits';

    const fictionalGroup = document.createElement('optgroup');
    fictionalGroup.label = 'Fictional Circuits';

    FM23_TRACKS.forEach(track => {
      const opt = document.createElement('option');
      opt.value = track.name;
      opt.textContent = track.name;
      if (track.category === 'Real Tracks') {
        realGroup.appendChild(opt);
      } else {
        fictionalGroup.appendChild(opt);
      }
    });

    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '➕ Custom Track...';

    this.selectLocation.appendChild(realGroup);
    this.selectLocation.appendChild(fictionalGroup);
    this.selectLocation.appendChild(customOpt);

    this.handleLocationChange();
  }

  /**
   * Updates Layout dropdown dynamically based on selected Location
   */
  handleLocationChange() {
    const selected = this.selectLocation?.value;
    if (!this.selectLayout) return;

    if (selected === '__custom__') {
      if (this.customNameContainer) this.customNameContainer.style.display = 'block';
      this.selectLayout.innerHTML = '<option value="__custom__">➕ Custom Layout...</option>';
      this.handleLayoutChange();
      return;
    }

    if (this.customNameContainer) this.customNameContainer.style.display = 'none';

    const trackObj = FM23_TRACKS.find(t => t.name === selected);
    this.selectLayout.innerHTML = '';

    if (trackObj && trackObj.layouts) {
      trackObj.layouts.forEach(layout => {
        const opt = document.createElement('option');
        opt.value = layout;
        opt.textContent = layout;
        this.selectLayout.appendChild(opt);
      });
    }

    const customLayoutOpt = document.createElement('option');
    customLayoutOpt.value = '__custom__';
    customLayoutOpt.textContent = '➕ Custom Layout...';
    this.selectLayout.appendChild(customLayoutOpt);

    this.handleLayoutChange();
  }

  /**
   * Handles toggling custom layout text input
   */
  handleLayoutChange() {
    const selected = this.selectLayout?.value;
    if (this.customLayoutContainer) {
      this.customLayoutContainer.style.display = selected === '__custom__' ? 'block' : 'none';
    }
  }

  openCreateTrackModal() {
    if (this.modalCreateTrack) {
      this.modalCreateTrack.classList.add('active');
      this.modalCreateTrack.style.display = 'flex';
      this.modalCreateTrack.style.opacity = '1';
      this.modalCreateTrack.style.pointerEvents = 'auto';
      if (this.selectLocation && this.selectLocation.options.length > 0) {
        this.selectLocation.selectedIndex = 0;
        this.handleLocationChange();
      }
    }
  }

  closeCreateTrackModal() {
    if (this.modalCreateTrack) {
      this.modalCreateTrack.classList.remove('active');
      this.modalCreateTrack.style.display = 'none';
      this.modalCreateTrack.style.opacity = '';
      this.modalCreateTrack.style.pointerEvents = '';
    }
  }

  /**
   * Handles submitting new track from FM23 modal
   */
  async handleCreateTrackSubmit() {
    let trackName = this.selectLocation?.value || 'New Circuit';
    if (trackName === '__custom__') {
      trackName = this.inputCustomName?.value.trim() || 'Custom Circuit';
    }

    let layout = this.selectLayout?.value || 'Full Course';
    if (layout === '__custom__') {
      layout = this.inputCustomLayout?.value.trim() || 'Full Course';
    }

    const direction = this.selectDirection?.value || 'Clockwise';

    // Length is 0 - calculated dynamically from telemetry data / calibration
    await this.createNewTrack(trackName, layout, 0, direction);
    this.closeCreateTrackModal();
  }

  /**
   * Fetches all saved tracks from API
   */
  async loadTracks() {
    try {
      const res = await fetch('/api/tracks');
      if (res.ok) {
        const data = await res.json();
        this.tracks = data.tracks || [];
      } else {
        this.tracks = [];
      }
    } catch (err) {
      console.warn('[TRACK LIBRARY] API offline or empty:', err.message);
      this.tracks = [];
    }

    this.renderTrackCards();

    if (this.tracks.length > 0) {
      const activeId = this.sessionManager?.activeTrackProfile?.id;
      const initial = (activeId && this.tracks.find(t => t.id === activeId)) || this.tracks[0];
      this.selectTrack(initial.id);
    } else {
      this.selectedTrack = null;
      this.renderEmptyState();
    }
  }

  /**
   * Renders the track cards sidebar
   */
  renderTrackCards(tracksToRender = this.tracks) {
    if (!this.trackCardsList) return;
    this.trackCardsList.innerHTML = '';

    if (tracksToRender.length === 0) {
      this.trackCardsList.innerHTML = `
        <div style="color: var(--color-text-muted); font-size: 11px; padding: 18px 12px; text-align: center; line-height: 1.5; font-family: var(--font-headline);">
          No track profiles yet.<br>
          <span style="color: var(--color-f1-red); font-weight: 700; cursor: pointer;" onclick="document.getElementById('btn-create-track-profile').click();">+ ADD A TRACK</span> or run a Calibration Stint.
        </div>
      `;
      return;
    }

    const activeTrackId = this.sessionManager?.activeTrackProfile?.id;

    tracksToRender.forEach(track => {
      const card = document.createElement('div');
      const isSelected = this.selectedTrack && this.selectedTrack.id === track.id;
      const isActive = activeTrackId === track.id;
      const lengthLabel = track.lengthMeters > 0 ? `${track.lengthMeters.toLocaleString()}m` : 'Uncalibrated';

      card.className = `track-card chamfer-all-corners ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-weight: 800; font-size: 12px; color: var(--color-text-primary); font-family: var(--font-headline); letter-spacing: 0.03em;">${track.name}</div>
          ${isActive ? '<span style="background: var(--color-success); color: #000; font-size: 8.5px; font-weight: 900; padding: 1px 5px; border-radius: 2px; font-family: var(--font-mono);">ACTIVE</span>' : ''}
        </div>
        <div style="font-size: 11px; color: var(--color-text-secondary); margin-bottom: 6px;">${track.layout || 'Full Course'}</div>
        <div style="display: flex; gap: 10px; font-size: 10px; color: var(--color-text-muted); font-family: var(--font-mono);">
          <span>📏 ${lengthLabel}</span>
          <span>🔄 ${track.turnCount || (track.turns?.length || 0)} Turns</span>
        </div>
      `;

      card.addEventListener('click', () => this.selectTrack(track.id));
      this.trackCardsList.appendChild(card);
    });
  }

  /**
   * Filters tracks list by search term
   */
  filterTracks() {
    const query = (this.searchInput?.value || '').toLowerCase().trim();
    if (!query) {
      this.renderTrackCards(this.tracks);
      return;
    }
    const filtered = this.tracks.filter(t => 
      (t.name || '').toLowerCase().includes(query) ||
      (t.layout || '').toLowerCase().includes(query)
    );
    this.renderTrackCards(filtered);
  }

  /**
   * Selects a track profile and loads full details
   */
  async selectTrack(trackId) {
    let track = this.tracks.find(t => t.id === trackId);

    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.track) {
          track = data.track;
        }
      }
    } catch (err) {
      console.warn('[TRACK LIBRARY] Fetch track detail fallback:', err);
    }

    if (track) {
      this.selectedTrack = track;
      this.renderSelectedTrack();
      this.renderTrackCards();
    }
  }

  /**
   * Renders empty state when no tracks exist
   */
  renderEmptyState() {
    if (this.heroName) this.heroName.textContent = 'NO ACTIVE CIRCUIT';
    if (this.heroLayout) this.heroLayout.textContent = 'Select or create a track to begin';
    if (this.heroDirection) this.heroDirection.textContent = '--';
    if (this.heroLength) this.heroLength.textContent = '-- m';
    if (this.heroTurns) this.heroTurns.textContent = '-- Turns';
    if (this.heroElevation) this.heroElevation.textContent = '-- m';
    if (this.heroStraight) this.heroStraight.textContent = '-- m';
    if (this.heroRhythm) this.heroRhythm.textContent = 'Create a track profile from the official Forza Motorsport catalog or execute a 3-lap calibration stint to synthesize geometric telemetry.';

    if (this.interactiveMapContainer) {
      this.interactiveMapContainer.innerHTML = `
        <div style="color: var(--color-text-muted); font-size: 12px; text-align: center; padding: 40px 20px; font-family: var(--font-headline); display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <span style="font-size: 28px;">🗺️</span>
          <span>No circuit profile selected.</span>
          <button class="btn btn-primary btn-sm chamfer-br" onclick="document.getElementById('btn-create-track-profile').click();">
            + CREATE NEW TRACK
          </button>
        </div>
      `;
    }

    if (this.turnTableBody) {
      this.turnTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 18px;">No turns mapped yet.</td></tr>`;
    }
    if (this.driverNotesInput) {
      this.driverNotesInput.value = '';
    }
  }

  /**
   * Updates hero section and interactive visualizer with selected track data
   */
  renderSelectedTrack() {
    const track = this.selectedTrack;
    if (!track) {
      this.renderEmptyState();
      return;
    }

    if (this.heroName) this.heroName.textContent = track.name || 'Unknown Circuit';
    if (this.heroLayout) this.heroLayout.textContent = track.layout || 'Full Course';
    if (this.heroDirection) {
      const dir = (track.direction || 'Clockwise').toUpperCase();
      this.heroDirection.textContent = dir;
      this.heroDirection.style.borderColor = dir.includes('COUNTER') ? 'var(--color-warning)' : 'rgba(0, 153, 255, 0.35)';
      this.heroDirection.style.color = dir.includes('COUNTER') ? 'var(--color-warning)' : '#0099FF';
    }

    if (this.heroLength) {
      this.heroLength.textContent = track.lengthMeters > 0 ? `${track.lengthMeters.toLocaleString()} m` : 'Awaiting Telemetry';
    }
    if (this.heroTurns) this.heroTurns.textContent = `${track.turns?.length || 0} Turns`;
    if (this.heroElevation) {
      const delta = track.elevation?.elevationDelta || 0;
      this.heroElevation.textContent = delta > 0 ? `+${delta.toFixed(1)} m` : '-- m';
    }
    if (this.heroStraight) {
      const straight = track.characteristics?.longestStraight || (track.lengthMeters > 0 ? Math.round(track.lengthMeters * 0.2) : 0);
      this.heroStraight.textContent = straight > 0 ? `${straight} m` : '-- m';
    }
    if (this.heroRhythm) {
      this.heroRhythm.textContent = track.characteristics?.rhythmOverview || (track.lengthMeters > 0 ? 'High-downforce road course.' : 'Track length, timing sectors, and turn apexes will be calculated automatically from live telemetry or a 3-lap calibration stint.');
    }

    // Render Turn Table Rows
    this.renderTurnTable(track.turns || []);

    // Driver Notes
    if (this.driverNotesInput) {
      this.driverNotesInput.value = track.driverNotes || '';
    }

    // Draw Interactive 2D Vector Map
    this.renderInteractiveMap(track);
  }

  /**
   * Renders the turn editor table rows
   */
  renderTurnTable(turns) {
    if (!this.turnTableBody) return;
    this.turnTableBody.innerHTML = '';

    if (!turns || turns.length === 0) {
      this.turnTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 18px; font-family: var(--font-mono); font-size: 11px;">Awaiting telemetry to detect and map corner apexes.</td></tr>`;
      return;
    }

    turns.forEach((turn, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--color-border)';

      tr.innerHTML = `
        <td style="padding: 6px 8px; font-weight: 800; color: var(--color-f1-red); font-family: var(--font-mono);">T${turn.turnNumber}</td>
        <td style="padding: 4px 6px;">
          <input type="text" class="pit-input turn-name-input" data-index="${idx}" value="${turn.name || 'Turn ' + turn.turnNumber}" style="width: 100%; font-size: 11px; padding: 4px 6px;" />
        </td>
        <td style="padding: 4px 6px;">
          <select class="pit-select turn-type-select" data-index="${idx}" style="width: 100%; font-size: 10px; padding: 4px 2px;">
            <option value="Hairpin" ${turn.type === 'Hairpin' ? 'selected' : ''}>Hairpin</option>
            <option value="90° Corner" ${turn.type === '90° Corner' ? 'selected' : ''}>90° Corner</option>
            <option value="Medium Corner" ${turn.type === 'Medium Corner' ? 'selected' : ''}>Medium</option>
            <option value="Fast Sweeper" ${turn.type === 'Fast Sweeper' ? 'selected' : ''}>Sweeper</option>
            <option value="Chicane" ${turn.type === 'Chicane' ? 'selected' : ''}>Chicane</option>
          </select>
        </td>
        <td style="padding: 6px 8px; font-family: var(--font-mono); font-weight: 700; text-align: right;">${turn.refSpeed || 100}</td>
        <td style="padding: 6px 8px; font-family: var(--font-mono); color: var(--color-success); font-weight: 800; text-align: center;">${turn.refGear || 3}</td>
      `;

      this.turnTableBody.appendChild(tr);
    });
  }

  /**
   * Renders interactive SVG map with turn badges or uncalibrated banner
   */
  renderInteractiveMap(track) {
    if (!this.interactiveMapContainer) return;
    const path2D = track.path2D || [];

    if (path2D.length < 3) {
      this.interactiveMapContainer.innerHTML = `
        <div style="color: var(--color-text-muted); font-size: 12px; text-align: center; padding: 40px 20px; font-family: var(--font-headline); display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">📡</span>
          <span>Awaiting Telemetry to Map Vector Circuit Geometry</span>
          <span style="font-size: 11px; color: var(--color-text-secondary); max-width: 420px; line-height: 1.4;">
            Run a 3-lap steady-speed Calibration Stint on Pit Wall to synthesize the official apex markers, timing sectors, and elevation profile.
          </span>
          <button class="btn btn-primary btn-sm chamfer-br" style="margin-top: 6px;" onclick="window.apexApp?.switchView('pitwall'); window.apexApp?.session?.startCalibrationStint(window.apexApp?.trackLibrary?.selectedTrack);">
            🎯 START CALIBRATION STINT
          </button>
        </div>
      `;
      return;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    path2D.forEach(pt => {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minZ = Math.min(minZ, pt.z);
      maxZ = Math.max(maxZ, pt.z);
    });

    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const width = 600;
    const height = 360;
    const padding = 35;

    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanZ);
    const offsetX = padding + (width - padding * 2 - spanX * scale) / 2;
    const offsetY = padding + (height - padding * 2 - spanZ * scale) / 2;

    const transform = (x, z) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (z - minZ) * scale
    });

    const sectors = track.sectors || { s1End: track.lengthMeters / 3, s2End: (track.lengthMeters / 3) * 2 };

    // Build SVG path segments by sector
    let s1Path = '', s2Path = '', s3Path = '';

    for (let i = 0; i < path2D.length; i++) {
      const p1 = path2D[i];
      const p2 = path2D[(i + 1) % path2D.length];
      const t1 = transform(p1.x, p1.z);
      const t2 = transform(p2.x, p2.z);
      const segStr = `M ${t1.x.toFixed(1)} ${t1.y.toFixed(1)} L ${t2.x.toFixed(1)} ${t2.y.toFixed(1)} `;

      const d = p1.dist || 0;
      if (d <= sectors.s1End) {
        s1Path += segStr;
      } else if (d <= sectors.s2End) {
        s2Path += segStr;
      } else {
        s3Path += segStr;
      }
    }

    // Build Turn Markers
    const turns = track.turns || [];
    let turnBadgesHtml = '';

    turns.forEach((t, idx) => {
      let closest = path2D[0];
      let minDelta = Infinity;
      path2D.forEach(pt => {
        const delta = Math.abs((pt.dist || 0) - (t.apexDist || 0));
        if (delta < minDelta) {
          minDelta = delta;
          closest = pt;
        }
      });

      const pos = transform(closest.x, closest.z);
      turnBadgesHtml += `
        <g class="svg-turn-marker" style="cursor: pointer;" data-turn-idx="${idx}">
          <circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="10" fill="#121212" stroke="#E10600" stroke-width="1.8" />
          <text x="${pos.x.toFixed(1)}" y="${(pos.y + 3.5).toFixed(1)}" fill="#FFFFFF" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="800" text-anchor="middle">T${t.turnNumber}</text>
          <title>${t.name || 'Turn ' + t.turnNumber} (${t.type}) - Ref Speed: ${t.refSpeed} km/h, Gear: ${t.refGear}</title>
        </g>
      `;
    });

    const startPos = transform(path2D[0].x, path2D[0].z);

    this.interactiveMapContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible;">
        <defs>
          <filter id="circuit-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <!-- Sector Paths with Glow -->
        <path d="${s1Path}" stroke="#E10600" stroke-width="4.5" fill="none" stroke-linecap="round" filter="url(#circuit-glow)" />
        <path d="${s2Path}" stroke="#0099FF" stroke-width="4.5" fill="none" stroke-linecap="round" filter="url(#circuit-glow)" />
        <path d="${s3Path}" stroke="#00CC66" stroke-width="4.5" fill="none" stroke-linecap="round" filter="url(#circuit-glow)" />

        <!-- Start / Finish Line -->
        <circle cx="${startPos.x.toFixed(1)}" cy="${startPos.y.toFixed(1)}" r="7" fill="#FFFFFF" stroke="#000000" stroke-width="2" />

        <!-- Turn Badges -->
        ${turnBadgesHtml}
      </svg>
    `;
  }

  /**
   * Sets current track as active in SessionManager
   */
  setActiveTrack() {
    if (!this.selectedTrack) return;
    if (this.sessionManager) {
      this.sessionManager.setActiveTrackProfile(this.selectedTrack);
    }
    this.renderTrackCards();
    alert(`🎯 "${this.selectedTrack.name}" set as active circuit profile for live session telemetry & canonical snapping.`);
  }

  /**
   * Synthesizes circuit geometry, turns, and elevation from latest recorded stint telemetry
   */
  async calibrateSelectedTrackFromTelemetry() {
    if (!this.selectedTrack) {
      alert('Please select a track profile first.');
      return;
    }

    const recordedSamples = this.sessionManager?.recordedSamples || [];
    if (recordedSamples.length < 20) {
      alert(`⚠️ No recorded session telemetry available in current session.\n\nPlease record a stint on the Pit Wall or start a Track Learning Stint to calibrate "${this.selectedTrack.name}".`);
      return;
    }

    const latestSample = recordedSamples[recordedSamples.length - 1];
    const carModel = latestSample?.vehicle?.carName || latestSample?.vehicle?.carClass || 'APEX Vehicle';

    const calibrator = this.sessionManager?.trackCalibrator;
    if (!calibrator) {
      alert('Calibration engine unavailable.');
      return;
    }

    const result = calibrator.calibrateFromStint(recordedSamples, {
      id: this.selectedTrack.id,
      name: this.selectedTrack.name,
      layout: this.selectedTrack.layout,
      trackOrdinal: this.selectedTrack.trackOrdinal,
      carModel,
      driverNotes: this.selectedTrack.driverNotes || ''
    });

    if (!result.success || !result.trackProfile) {
      alert(`⚠️ Calibration error: ${result.error || 'Failed to synthesize telemetry'}`);
      return;
    }

    const updated = result.trackProfile;
    updated.status = 'Calibrated';
    updated.updatedDate = new Date().toISOString();

    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        const data = await res.json();
        this.selectedTrack = data.track || updated;
      } else {
        this.selectedTrack = updated;
      }
    } catch (err) {
      this.selectedTrack = updated;
    }

    const idx = this.tracks.findIndex(t => t.id === this.selectedTrack.id);
    if (idx >= 0) {
      this.tracks[idx] = this.selectedTrack;
    } else {
      this.tracks.push(this.selectedTrack);
    }

    this.renderTrackCards();
    this.renderSelectedTrack();
    if (this.sessionManager) {
      this.sessionManager.setActiveTrackProfile(this.selectedTrack);
    }
    alert(`⚡ "${this.selectedTrack.name}" calibrated from latest telemetry!\n• ${this.selectedTrack.turns.length} Turns mapped\n• ${this.selectedTrack.lengthMeters.toLocaleString()}m Circuit length`);
  }

  /**
   * Exports raw telemetry or geometric turn CSV for the selected track
   */
  exportTrackCsv() {
    if (!this.selectedTrack) return;

    // 1. If recorded samples exist for this track stint, export full telemetry CSV
    if (this.sessionManager?.recordedSamples?.length > 0) {
      const safeName = (this.selectedTrack.name || 'track').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `APEX_Track_${safeName}_Telemetry_${dateStr}.csv`;
      
      const rows = [
        ['TimestampMs', 'LapDistanceM', 'SpeedKmh', 'LateralG', 'LongitudinalG', 'ThrottlePct', 'BrakePct', 'Gear', 'PosX', 'PosY', 'PosZ'].join(',')
      ];

      this.sessionManager.recordedSamples.forEach(s => {
        const spd = s.motion?.speedMps ? s.motion.speedMps * 3.6 : (s.speedKmh || (s.speedMps || 0) * 3.6);
        const latG = s.motion?.acceleration?.lateralG ?? s.accelY ?? s.lateralG ?? 0;
        const longG = s.motion?.acceleration?.longitudinalG ?? s.accelX ?? s.longitudinalG ?? 0;
        const throttle = (s.inputs?.throttle ?? s.throttle ?? 0) * 100;
        const brake = (s.inputs?.brake ?? s.brake ?? 0) * 100;
        const gear = s.engine?.gear ?? s.gear ?? 0;
        const x = s.motion?.position?.x ?? s.positionX ?? 0;
        const y = s.motion?.position?.y ?? s.positionY ?? 0;
        const z = s.motion?.position?.z ?? s.positionZ ?? 0;
        const dist = s.lapDistance ?? s.distance ?? 0;

        rows.push([
          s.timestamp || 0,
          dist.toFixed(1),
          spd.toFixed(1),
          latG.toFixed(2),
          longG.toFixed(2),
          throttle.toFixed(0),
          brake.toFixed(0),
          gear,
          x.toFixed(1),
          y.toFixed(1),
          z.toFixed(1)
        ].join(','));
      });

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }

    // 2. Otherwise export canonical turn-by-turn geometry table CSV
    const turns = this.selectedTrack.turns || [];
    const header = 'TurnNumber,TurnName,Type,Direction,ApexDistM,EntryDistM,ExitDistM,RefSpeedKmh,RefGear,ApexLatG,BrakingDistM\n';
    const csvRows = turns.map(t => [
      t.turnNumber,
      `"${t.name || 'Turn ' + t.turnNumber}"`,
      t.type || 'Corner',
      t.direction || 'Right',
      t.apexDist || 0,
      t.entryDist || 0,
      t.exitDist || 0,
      t.refSpeed || 100,
      t.refGear || 3,
      t.apexLatG || 1.2,
      t.brakingDist || 50
    ].join(',')).join('\n');

    const blob = new Blob([header + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedTrack.id}_Turns.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Generates and downloads the 2-page Pre-Stint Track Briefing PDF
   */
  async exportBriefingPdf() {
    if (!this.selectedTrack) return;
    try {
      await this.pdfGenerator.generate(this.selectedTrack, true);
    } catch (err) {
      console.warn('[PDF EXPORT] Client-side generator fallback to server API:', err);
      window.open(`/api/tracks/${encodeURIComponent(this.selectedTrack.id)}/pdf`, '_blank');
    }
  }

  /**
   * Downloads track profile as JSON
   */
  downloadJson() {
    if (!this.selectedTrack) return;
    const blob = new Blob([JSON.stringify(this.selectedTrack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedTrack.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Saves updated turn names, types, and driver notes
   */
  async saveTurnEdits() {
    if (!this.selectedTrack) return;

    const nameInputs = this.turnTableBody?.querySelectorAll('.turn-name-input') || [];
    const typeSelects = this.turnTableBody?.querySelectorAll('.turn-type-select') || [];

    const updatedTurns = (this.selectedTrack.turns || []).map((turn, idx) => ({
      ...turn,
      name: nameInputs[idx]?.value || turn.name,
      type: typeSelects[idx]?.value || turn.type
    }));

    const driverNotes = this.driverNotesInput?.value || '';

    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(this.selectedTrack.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turns: updatedTurns,
          driverNotes
        })
      });

      if (res.ok) {
        const data = await res.json();
        this.selectedTrack = data.track;
        this.renderSelectedTrack();
        alert('💾 Track geometry and strategy notes updated successfully!');
      } else {
        this.selectedTrack.turns = updatedTurns;
        this.selectedTrack.driverNotes = driverNotes;
        this.renderSelectedTrack();
        alert('💾 Track geometry and strategy notes updated locally!');
      }
    } catch (err) {
      this.selectedTrack.turns = updatedTurns;
      this.selectedTrack.driverNotes = driverNotes;
      this.renderSelectedTrack();
      alert('💾 Track geometry updated locally!');
    }
  }

  /**
   * Deletes the currently selected track profile
   */
  async deleteCurrentTrack() {
    if (!this.selectedTrack) return;
    if (!confirm(`Are you sure you want to delete "${this.selectedTrack.name}"?`)) return;

    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(this.selectedTrack.id)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await this.loadTracks();
      } else {
        this.tracks = this.tracks.filter(t => t.id !== this.selectedTrack.id);
        this.renderTrackCards();
        if (this.tracks.length > 0) this.selectTrack(this.tracks[0].id);
        else this.renderEmptyState();
      }
    } catch (err) {
      this.tracks = this.tracks.filter(t => t.id !== this.selectedTrack.id);
      this.renderTrackCards();
      if (this.tracks.length > 0) this.selectTrack(this.tracks[0].id);
      else this.renderEmptyState();
    }
  }

  /**
   * Creates a new track profile with 0m initial length (computed via telemetry)
   */
  async createNewTrack(name, layout, lengthMeters = 0, direction = 'Clockwise') {
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          layout,
          lengthMeters,
          direction,
          status: 'Uncalibrated',
          turns: [],
          path2D: []
        })
      });

      if (res.ok) {
        const data = await res.json();
        await this.loadTracks();
        this.selectTrack(data.track.id);
        this.setActiveTrack();
      } else {
        // Local fallback
        const id = `${name} ${layout}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const newTrack = {
          id,
          name,
          layout,
          lengthMeters,
          direction,
          status: 'Uncalibrated',
          turns: [],
          path2D: []
        };
        this.tracks.push(newTrack);
        this.renderTrackCards();
        this.selectTrack(newTrack.id);
        this.setActiveTrack();
      }
    } catch (err) {
      console.warn('Track creation fallback:', err);
    }
  }

  /**
   * Handles importing track JSON file
   */
  handleImportJson(e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        const res = await fetch('/api/tracks/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });

        if (res.ok) {
          const data = await res.json();
          await this.loadTracks();
          this.selectTrack(data.track.id);
          alert(`📥 Successfully imported "${data.track.name}"!`);
        } else {
          this.tracks.push(json);
          this.renderTrackCards();
          this.selectTrack(json.id);
          alert(`📥 Imported "${json.name}" into local session!`);
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
}
