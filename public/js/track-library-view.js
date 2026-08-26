/**
 * APEX Pre-Stint Track Preparation Hub View
 * Interactive UI controller for browsing covertly synthesized circuit profiles,
 * inspecting turn-by-turn telemetry cheat sheets, and exporting 2-page Pre-Stint Prep PDFs.
 */

import { trackLibraryStore } from './track-library-store.js';
import { PreStintPdfBuilder } from './pre-stint-pdf-builder.js';

export class TrackLibraryView {
  constructor() {
    this.pdfBuilder = new PreStintPdfBuilder();
    this.selectedTrackId = null;
    this.activeFilter = 'all'; // 'all' | 'Real' | 'Fictional'
    this.searchQuery = '';

    // DOM Elements
    this.viewPitwall = document.getElementById('view-pitwall');
    this.viewTrackLibrary = document.getElementById('view-track-library');
    this.btnNavTrackLibrary = document.getElementById('btn-nav-track-library');
    this.btnNavPitwall = document.getElementById('btn-nav-pitwall');
    
    this.trackListContainer = document.getElementById('track-library-list');
    this.trackSearchInput = document.getElementById('track-search-input');
    this.trackDetailContainer = document.getElementById('track-detail-stage');
    this.emptyStateContainer = document.getElementById('track-library-empty-state');
    
    this.btnExportPdf = document.getElementById('btn-export-pre-stint-pdf');
    this.filterPills = document.querySelectorAll('.track-filter-pill');

    this.bindEvents();
  }

  bindEvents() {
    // Navigation Toggles
    if (this.btnNavTrackLibrary) {
      this.btnNavTrackLibrary.addEventListener('click', () => {
        this.showView();
      });
    }

    if (this.btnNavPitwall) {
      this.btnNavPitwall.addEventListener('click', () => {
        this.hideView();
      });
    }

    // Search filter
    if (this.trackSearchInput) {
      this.trackSearchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTrackList();
      });
    }

    // Category filter pills
    if (this.filterPills) {
      this.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
          this.filterPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeFilter = pill.dataset.filter || 'all';
          this.renderTrackList();
        });
      });
    }

    // PDF Export
    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => {
        this.exportPreStintPdf();
      });
    }
  }

  showView() {
    if (this.viewPitwall) this.viewPitwall.style.display = 'none';
    if (this.viewTrackLibrary) this.viewTrackLibrary.style.display = 'block';

    if (this.btnNavTrackLibrary) {
      this.btnNavTrackLibrary.classList.add('btn-primary');
      this.btnNavTrackLibrary.classList.remove('btn-secondary');
    }

    this.refresh();
  }

  hideView() {
    if (this.viewTrackLibrary) this.viewTrackLibrary.style.display = 'none';
    if (this.viewPitwall) this.viewPitwall.style.display = 'block';

    if (this.btnNavTrackLibrary) {
      this.btnNavTrackLibrary.classList.remove('btn-primary');
      this.btnNavTrackLibrary.classList.add('btn-secondary');
    }
  }

  refresh() {
    const tracks = trackLibraryStore.getAllTracks();
    if (tracks.length === 0) {
      if (this.emptyStateContainer) this.emptyStateContainer.style.display = 'flex';
      if (this.trackDetailContainer) this.trackDetailContainer.style.display = 'none';
      if (this.trackListContainer) this.trackListContainer.innerHTML = '';
      return;
    }

    if (this.emptyStateContainer) this.emptyStateContainer.style.display = 'none';
    if (this.trackDetailContainer) this.trackDetailContainer.style.display = 'block';

    if (!this.selectedTrackId || !tracks.some(t => t.trackId === this.selectedTrackId)) {
      this.selectedTrackId = tracks[0].trackId;
    }

    this.renderTrackList();
    this.renderTrackDetails(this.selectedTrackId);
  }

  renderTrackList() {
    if (!this.trackListContainer) return;

    let tracks = trackLibraryStore.getAllTracks();

    // Filter by type
    if (this.activeFilter !== 'all') {
      tracks = tracks.filter(t => (t.trackType || 'Real').toLowerCase() === this.activeFilter.toLowerCase());
    }

    // Filter by search query
    if (this.searchQuery) {
      tracks = tracks.filter(t => 
        (t.trackName || '').toLowerCase().includes(this.searchQuery) ||
        (t.layoutName || '').toLowerCase().includes(this.searchQuery)
      );
    }

    this.trackListContainer.innerHTML = '';

    if (tracks.length === 0) {
      this.trackListContainer.innerHTML = `
        <div style="padding: 24px 12px; text-align: center; color: var(--color-text-muted); font-size: 11px; font-family: var(--font-mono);">
          No matching tracks found in library.
        </div>
      `;
      return;
    }

    tracks.forEach(t => {
      const isSelected = t.trackId === this.selectedTrackId;
      const card = document.createElement('div');
      card.className = `track-library-card chamfer-all-corners ${isSelected ? 'selected' : ''}`;
      
      const formatTime = (sec) => {
        if (!sec || isNaN(sec)) return '--:--.---';
        const m = Math.floor(sec / 60);
        const s = (sec % 60).toFixed(3);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="track-card-title">${t.trackName}</div>
            <div class="track-card-layout">${t.layoutName}</div>
          </div>
          <span class="badge ${t.trackType === 'Fictional' ? 'badge-fictional' : 'badge-real'}">${t.trackType || 'Real'}</span>
        </div>
        <div class="track-card-stats-grid">
          <div>
            <span class="track-stat-lbl">BEST LAP</span>
            <span class="track-stat-val accent">${formatTime(t.bestLapTime)}</span>
          </div>
          <div>
            <span class="track-stat-lbl">TURNS</span>
            <span class="track-stat-val">${t.corners?.length || t.cornersCount || 0}</span>
          </div>
          <div>
            <span class="track-stat-lbl">LENGTH</span>
            <span class="track-stat-val">${t.officialLength || '4.5 km'}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectedTrackId = t.trackId;
        this.renderTrackList();
        this.renderTrackDetails(t.trackId);
      });

      this.trackListContainer.appendChild(card);
    });
  }

  renderTrackDetails(trackId) {
    const track = trackLibraryStore.getTrackById(trackId);
    if (!track || !this.trackDetailContainer) return;

    const formatTime = (sec) => {
      if (!sec || isNaN(sec)) return '--:--.---';
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(3);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // 1. Header Information
    const titleEl = document.getElementById('detail-track-name');
    const layoutEl = document.getElementById('detail-track-layout');
    const typeBadge = document.getElementById('detail-track-type-badge');
    const lengthEl = document.getElementById('detail-track-length');
    const bestLapEl = document.getElementById('detail-track-best-lap');
    const carEl = document.getElementById('detail-track-car');
    const stintsCountEl = document.getElementById('detail-track-stints-count');

    if (titleEl) titleEl.textContent = track.trackName;
    if (layoutEl) layoutEl.textContent = track.layoutName;
    if (typeBadge) typeBadge.textContent = `${track.trackType || 'Real'} Circuit`;
    if (lengthEl) lengthEl.textContent = track.officialLength || '4.500 km';
    if (bestLapEl) bestLapEl.textContent = formatTime(track.bestLapTime);
    if (carEl) carEl.textContent = track.carName || '2023 Porsche 911 GT3 R';
    if (stintsCountEl) stintsCountEl.textContent = `${track.stintsRecordedCount || 1} Stints (${track.totalLapsDriven || 1} Laps)`;

    // 2. Vector SVG Track Map
    const mapSvgContainer = document.getElementById('detail-track-map-svg');
    if (mapSvgContainer) {
      mapSvgContainer.innerHTML = this.buildSvgMap(track);
    }

    // 3. Turn-by-Turn Telemetry Table
    const tableBody = document.getElementById('detail-turns-table-body');
    if (tableBody) {
      tableBody.innerHTML = '';
      const corners = track.corners || [];

      if (corners.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">No corner profiles extracted yet</td></tr>`;
      } else {
        corners.forEach(c => {
          const tr = document.createElement('tr');
          const typeColor = c.cornerType === 'Type I' ? '#FFD700' : (c.cornerType === 'Type II' ? '#E10600' : '#00D8F4');

          tr.innerHTML = `
            <td><strong style="color: var(--color-cyan);">T${c.turnNumber}</strong></td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); border: 1px solid ${typeColor}; color: ${typeColor}; font-size: 10px;">${c.cornerType}</span></td>
            <td style="font-weight: 700; color: var(--color-f1-red);">${c.brakingMarkerMeters || 75}m</td>
            <td style="font-family: var(--font-mono); font-weight: bold; color: var(--color-success);">Gear ${c.targetGear || 3}</td>
            <td style="font-weight: 700; color: var(--color-text-primary);">${c.apexSpeedKmh || 100} km/h</td>
            <td style="color: var(--color-text-secondary); font-family: var(--font-mono); font-size: 11px;">${c.entrySpeedKmh || 160} km/h</td>
            <td style="font-size: 12px; color: var(--color-text-secondary); line-height: 1.3;">${c.coachingNotes || 'Maintain smooth throttle progression and verify steering unwinding.'}</td>
          `;
          tableBody.appendChild(tr);
        });
      }
    }

    // 4. Hazards & Surface Advisories
    const hazardsFeed = document.getElementById('detail-hazards-feed');
    if (hazardsFeed) {
      hazardsFeed.innerHTML = '';
      const hazards = track.hazards || [];

      if (hazards.length === 0) {
        hazardsFeed.innerHTML = `
          <div class="hazard-brief-card chamfer-all-corners">
            <div style="font-weight: 700; color: var(--color-success);">✓ No Critical Surface Hazards Detected</div>
            <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 4px;">Standard racing line with consistent grip coefficients throughout circuit.</div>
          </div>
        `;
      } else {
        hazards.forEach(h => {
          const hCard = document.createElement('div');
          hCard.className = `hazard-brief-card chamfer-all-corners ${h.severity === 'High' ? 'severity-high' : 'severity-med'}`;
          hCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 12px; color: var(--color-text-primary);">⚠️ ${h.title}</span>
              <span class="badge" style="font-size: 9px; background: rgba(225,6,0,0.15); border: 1px solid var(--color-f1-red); color: var(--color-f1-red);">${h.type}</span>
            </div>
            <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 6px; line-height: 1.4;">
              ${h.description}
            </div>
          `;
          hazardsFeed.appendChild(hCard);
        });
      }
    }

    // 5. Pre-Stint Setup Advisory Card
    const setupAdv = track.setupAdvisories || {};
    const aeroVal = document.getElementById('detail-setup-aero');
    const tireVal = document.getElementById('detail-setup-tire');
    const brakeVal = document.getElementById('detail-setup-brake');

    if (aeroVal) aeroVal.textContent = setupAdv.downforce || 'Medium Downforce';
    if (tireVal) tireVal.textContent = setupAdv.tireWearRisk || 'Front-Left lateral scrub';
    if (brakeVal) brakeVal.textContent = setupAdv.brakingBias || '54% Front / 46% Rear';
  }

  buildSvgMap(track) {
    const points = track.vectorMap?.points || [];
    if (points.length < 3) {
      return `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); font-family: var(--font-mono); font-size: 11px;">
          Vector track coordinates unavailable for this circuit profile.
        </div>
      `;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const rangeX = (maxX - minX) || 1;
    const rangeZ = (maxZ - minZ) || 1;
    const width = 640;
    const height = 360;
    const padding = 35;

    const usableW = width - (padding * 2);
    const usableH = height - (padding * 2);
    const scale = Math.min(usableW / rangeX, usableH / rangeZ);

    const offsetX = padding + (usableW - (rangeX * scale)) / 2;
    const offsetY = padding + (usableH - (rangeZ * scale)) / 2;

    let pathD = '';
    let polyLines = [];

    // Group segments by state for clean SVG paths
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const x1 = (offsetX + (p1.x - minX) * scale).toFixed(1);
      const y1 = (height - (offsetY + (p1.z - minZ) * scale)).toFixed(1);
      const x2 = (offsetX + (p2.x - minX) * scale).toFixed(1);
      const y2 = (height - (offsetY + (p2.z - minZ) * scale)).toFixed(1);

      let strokeColor = '#00CC66'; // Full throttle
      if (p2.state === 'BRAKING') strokeColor = '#E10600';
      else if (p2.state === 'COASTING') strokeColor = '#0099FF';
      else if (p2.state === 'PARTIAL_THROTTLE') strokeColor = '#E5A910';

      polyLines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="3.5" stroke-linecap="round" />`);
    }

    // Turn Callout Pins
    let turnPinsSvg = '';
    const corners = track.corners || [];
    corners.forEach(c => {
      let pinPoint = null;
      if (c.apexIndex !== undefined && points.length > 0) {
        const ratio = Math.min(1, Math.max(0, c.apexIndex / (points.length * 10)));
        const pIdx = Math.min(points.length - 1, Math.floor(ratio * points.length));
        pinPoint = points[pIdx];
      }

      if (pinPoint) {
        const px = (offsetX + (pinPoint.x - minX) * scale).toFixed(1);
        const py = (height - (offsetY + (pinPoint.z - minZ) * scale)).toFixed(1);

        turnPinsSvg += `
          <g transform="translate(${px}, ${py})">
            <circle r="9" fill="#171A1F" stroke="#00D8F4" stroke-width="1.5" />
            <text text-anchor="middle" dy="3.5" font-family="'JetBrains Mono', monospace" font-size="8.5" font-weight="700" fill="#FFFFFF">T${c.turnNumber}</text>
          </g>
        `;
      }
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; display: block;">
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(0, 216, 244, 0.05)" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#mapGlow)" />
        ${polyLines.join('\n')}
        ${turnPinsSvg}
      </svg>
    `;
  }

  async exportPreStintPdf() {
    if (!this.selectedTrackId) {
      alert('Please select a track from the library first.');
      return;
    }

    const track = trackLibraryStore.getTrackById(this.selectedTrackId);
    if (!track) {
      alert('Track data not found.');
      return;
    }

    const btn = this.btnExportPdf;
    if (btn) {
      btn.innerHTML = '<span>⏳</span> COMPILING BRIEFING...';
      btn.disabled = true;
    }

    try {
      const pdfBytes = await this.pdfBuilder.generate(track);
      const safeName = (track.trackName || 'Circuit').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeLayout = (track.layoutName || 'Layout').replace(/[^a-zA-Z0-9_-]/g, '_');
      this.pdfBuilder.download(pdfBytes, `APEX_PreStint_${safeName}_${safeLayout}.pdf`);
    } catch (err) {
      console.error('[TRACK LIBRARY] Error generating Pre-Stint PDF:', err);
      alert('Failed to generate Pre-Stint PDF: ' + err.message);
    } finally {
      if (btn) {
        btn.innerHTML = '<span>📄</span> EXPORT PRE-STINT PREP PDF';
        btn.disabled = false;
      }
    }
  }
}
