/**
 * APEX Track Library Component Controller
 * Manages track profile selection, interactive 2D SVG map visualizer,
 * turn geometry editing, PDF briefing export, and API synchronization.
 */

import { ClientTrackBriefingPdf } from '../track-briefing-pdf.js';

export class TrackLibraryComponent {
  constructor(options = {}) {
    this.sessionManager = options.sessionManager;
    this.tracks = [];
    this.selectedTrack = null;
    this.pdfGenerator = new ClientTrackBriefingPdf();

    // DOM Elements
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
    this.btnExportPdf = document.getElementById('btn-track-export-pdf');
    this.btnDownloadJson = document.getElementById('btn-track-download-json');
    this.btnDeleteTrack = document.getElementById('btn-track-delete');

    // Turn Editor Elements
    this.turnTableBody = document.getElementById('turn-edit-table-body');
    this.driverNotesInput = document.getElementById('track-driver-notes-input');
    this.btnSaveTurnEdits = document.getElementById('btn-save-turn-edits');

    this.bindEvents();
    this.loadTracks();
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.filterTracks());
    }

    if (this.btnSetActive) {
      this.btnSetActive.addEventListener('click', () => this.setActiveTrack());
    }

    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => this.exportBriefingPdf());
    }

    if (this.btnDownloadJson) {
      this.btnDownloadJson.addEventListener('click', () => this.downloadJson());
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

    if (this.btnCreateTrack) {
      this.btnCreateTrack.addEventListener('click', () => {
        const name = prompt('Enter New Track Name:');
        if (name) {
          const layout = prompt('Enter Layout (e.g. Full Circuit):', 'Full Circuit') || 'Full Circuit';
          const lengthStr = prompt('Enter Approximate Length (meters):', '4000');
          const lengthMeters = parseInt(lengthStr, 10) || 4000;
          this.createNewTrack(name, layout, lengthMeters);
        }
      });
    }
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
        this.renderTrackCards();

        if (this.tracks.length > 0) {
          const activeId = this.sessionManager?.activeTrackProfile?.id;
          const initial = (activeId && this.tracks.find(t => t.id === activeId)) || this.tracks[0];
          this.selectTrack(initial.id);
        }
      }
    } catch (err) {
      console.warn('[TRACK LIBRARY] Failed loading tracks from API:', err);
    }
  }

  /**
   * Renders the track cards sidebar
   */
  renderTrackCards(tracksToRender = this.tracks) {
    if (!this.trackCardsList) return;
    this.trackCardsList.innerHTML = '';

    if (tracksToRender.length === 0) {
      this.trackCardsList.innerHTML = '<div style="color: var(--color-text-muted); font-size: 11px; padding: 12px;">No tracks found.</div>';
      return;
    }

    const activeTrackId = this.sessionManager?.activeTrackProfile?.id;

    tracksToRender.forEach(track => {
      const card = document.createElement('div');
      const isSelected = this.selectedTrack && this.selectedTrack.id === track.id;
      const isActive = activeTrackId === track.id;

      card.className = `track-card chamfer-all-corners ${isSelected ? 'selected' : ''}`;
      card.style.cssText = `
        background: ${isSelected ? 'rgba(225,6,0,0.12)' : 'var(--color-surface)'};
        border: 1px solid ${isSelected ? 'var(--color-f1-red)' : 'var(--color-border)'};
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-weight: 700; font-size: 12px; color: var(--color-text-primary);">${track.name}</div>
          ${isActive ? '<span style="background: var(--color-success); color: #000; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 2px;">ACTIVE</span>' : ''}
        </div>
        <div style="font-size: 11px; color: var(--color-text-secondary); margin-bottom: 6px;">${track.layout || 'Full Course'}</div>
        <div style="display: flex; gap: 8px; font-size: 10px; color: var(--color-text-muted); font-family: var(--font-mono);">
          <span>📏 ${track.lengthMeters ? track.lengthMeters.toLocaleString() + 'm' : '--'}</span>
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
    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}`);
      if (res.ok) {
        const data = await res.json();
        this.selectedTrack = data.track;
        this.renderSelectedTrack();
        this.renderTrackCards();
      }
    } catch (err) {
      console.warn('[TRACK LIBRARY] Failed fetching track details:', err);
    }
  }

  /**
   * Updates hero section and interactive visualizer with selected track data
   */
  renderSelectedTrack() {
    const track = this.selectedTrack;
    if (!track) return;

    if (this.heroName) this.heroName.textContent = track.name || 'Unknown Circuit';
    if (this.heroLayout) this.heroLayout.textContent = track.layout || 'Full Course';
    if (this.heroDirection) {
      this.heroDirection.textContent = track.direction || 'Clockwise';
      this.heroDirection.style.borderColor = track.direction === 'Counter-Clockwise' ? 'var(--color-warning)' : 'var(--color-blue, #0284C7)';
    }

    if (this.heroLength) this.heroLength.textContent = `${(track.lengthMeters || 0).toLocaleString()} m`;
    if (this.heroTurns) this.heroTurns.textContent = `${track.turns?.length || 0} Turns`;
    if (this.heroElevation) {
      const delta = track.elevation?.elevationDelta || 0;
      this.heroElevation.textContent = `+${delta} m`;
    }
    if (this.heroStraight) {
      const straight = track.characteristics?.longestStraight || Math.round((track.lengthMeters || 4000) * 0.2);
      this.heroStraight.textContent = `${straight} m`;
    }
    if (this.heroRhythm) {
      this.heroRhythm.textContent = track.characteristics?.rhythmOverview || 'High-downforce technical road course.';
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

    turns.forEach((turn, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--color-border)';

      tr.innerHTML = `
        <td style="padding: 6px 8px; font-weight: 700; color: var(--color-f1-red); font-family: var(--font-mono);">T${turn.turnNumber}</td>
        <td style="padding: 4px 6px;">
          <input type="text" class="pit-input turn-name-input" data-index="${idx}" value="${turn.name || 'Turn ' + turn.turnNumber}" style="width: 100%; font-size: 11px; padding: 2px 6px;" />
        </td>
        <td style="padding: 4px 6px;">
          <select class="pit-select turn-type-select" data-index="${idx}" style="width: 100%; font-size: 10px; padding: 2px 4px;">
            <option value="Hairpin" ${turn.type === 'Hairpin' ? 'selected' : ''}>Hairpin</option>
            <option value="90° Corner" ${turn.type === '90° Corner' ? 'selected' : ''}>90° Corner</option>
            <option value="Medium Corner" ${turn.type === 'Medium Corner' ? 'selected' : ''}>Medium</option>
            <option value="Fast Sweeper" ${turn.type === 'Fast Sweeper' ? 'selected' : ''}>Sweeper</option>
            <option value="Chicane" ${turn.type === 'Chicane' ? 'selected' : ''}>Chicane</option>
          </select>
        </td>
        <td style="padding: 6px 8px; font-family: var(--font-mono); font-weight: 700;">${turn.refSpeed || 100}</td>
        <td style="padding: 6px 8px; font-family: var(--font-mono); color: var(--color-success); font-weight: 700;">${turn.refGear || 3}</td>
      `;

      this.turnTableBody.appendChild(tr);
    });
  }

  /**
   * Renders interactive SVG map with turn badges and hover interactions
   */
  renderInteractiveMap(track) {
    if (!this.interactiveMapContainer) return;
    const path2D = track.path2D || [];

    if (path2D.length < 3) {
      this.interactiveMapContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 12px; text-align: center; padding-top: 150px;">Track vector geometry will be mapped during multi-lap calibration.</div>';
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
          <circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="10" fill="#121212" stroke="#E10600" stroke-width="1.5" />
          <text x="${pos.x.toFixed(1)}" y="${(pos.y + 3.5).toFixed(1)}" fill="#FFFFFF" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="700" text-anchor="middle">T${t.turnNumber}</text>
          <title>${t.name || 'Turn ' + t.turnNumber} (${t.type}) - Ref Speed: ${t.refSpeed} km/h, Gear: ${t.refGear}</title>
        </g>
      `;
    });

    const startPos = transform(path2D[0].x, path2D[0].z);

    this.interactiveMapContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible;">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <!-- Sector Paths -->
        <path d="${s1Path}" stroke="#E10600" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#glow)" />
        <path d="${s2Path}" stroke="#0284C7" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#glow)" />
        <path d="${s3Path}" stroke="#00CC66" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#glow)" />

        <!-- Start / Finish Line -->
        <circle cx="${startPos.x.toFixed(1)}" cy="${startPos.y.toFixed(1)}" r="6" fill="#FFFFFF" stroke="#000000" stroke-width="2" />

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
        const err = await res.json();
        alert('Failed to save changes: ' + err.error);
      }
    } catch (err) {
      alert('Error updating track: ' + err.message);
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
        const err = await res.json();
        alert('Failed to delete track: ' + err.error);
      }
    } catch (err) {
      alert('Error deleting track: ' + err.message);
    }
  }

  /**
   * Creates a new manual track profile
   */
  async createNewTrack(name, layout, lengthMeters) {
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          layout,
          lengthMeters,
          direction: 'Clockwise',
          turns: [
            { turnNumber: 1, name: 'Turn 1', type: '90° Corner', direction: 'Right', entryDist: 350, apexDist: 420, exitDist: 490, refSpeed: 110, refGear: 3, apexLatG: 1.4, brakingDist: 60 }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        await this.loadTracks();
        this.selectTrack(data.track.id);
      }
    } catch (err) {
      alert('Failed creating track: ' + err.message);
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
          const err = await res.json();
          alert('Import failed: ' + err.error);
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
}
