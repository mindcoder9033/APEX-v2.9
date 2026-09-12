/**
 * APEX Circuit Lab Studio View
 * Master Unified Hub for Track Study, Track Editor, and Track Dossier.
 * Provides unified circuit catalog selection, dynamic sub-view switching,
 * live telemetry synchronization, and real-time weather & track surface condition intelligence.
 */

import { trackStudyLibrary } from './analysis/track-study-library.js';
import { trackLibraryStore } from './track-library-store.js';

export class CircuitLabView {
  constructor() {
    this.container = null;
    this.currentTrackId = 'sebring-international-raceway--full-circuit';
    this.currentSubView = 'study'; // 'study' | 'editor' | 'dossier'
    this.currentSidebarFilter = 'all';
    this.currentSidebarSearch = '';
    this._initialized = false;
  }

  /**
   * Initializes DOM elements, master sidebar, sub-navigation tabs, and sub-view delegates
   */
  init() {
    this.container = document.getElementById('view-circuit-lab');
    if (!this.container) return;

    if (!this._initialized) {
      this._initialized = true;
      this._bindEvents();
    }

    this._populateMasterSidebar();
    this.selectTrack(this.currentTrackId, false);
    this.switchSubView(this.currentSubView);
  }

  /**
   * Populates the 260px master left sidebar with all 71+ FM23 circuits and baseline status dots
   */
  _populateMasterSidebar(filterType = this.currentSidebarFilter, searchQuery = this.currentSidebarSearch) {
    const listEl = this.container?.querySelector('#circuit-lab-track-list');
    if (!listEl) return;

    this.currentSidebarFilter = filterType;
    this.currentSidebarSearch = searchQuery;

    const allTracks = trackStudyLibrary.getAllCatalogTracks();
    const query = String(searchQuery || '').trim().toLowerCase();

    const filtered = allTracks.filter(t => {
      // Category filter
      if (filterType === 'Real' && t.type !== 'Real') return false;
      if (filterType === 'Fantasy' && t.type === 'Real') return false;

      // Search query filter
      if (query.length > 0) {
        const nameMatch = (t.trackName || '').toLowerCase().includes(query);
        const layoutMatch = (t.layoutName || '').toLowerCase().includes(query);
        const displayMatch = (t.displayName || '').toLowerCase().includes(query);
        return nameMatch || layoutMatch || displayMatch;
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="circuit-lab-track-empty-msg font-mono">No matching circuits found.</div>`;
      return;
    }

    let html = '';
    filtered.forEach(t => {
      const state = trackStudyLibrary.getTrackStudyState(t.trackId);
      const laps = state?.lapsCompleted || 0;
      const isCertified = state?.certified || laps >= 5;

      let statusClass = 'awaiting';
      let statusTitle = '0 Laps (Awaiting Baseline)';
      if (isCertified) {
        statusClass = 'certified';
        statusTitle = `${laps} Laps (Certified Baseline ✓)`;
      } else if (laps > 0) {
        statusClass = 'progress';
        statusTitle = `${laps}/5 Laps In Progress`;
      }

      const isActive = t.trackId === this.currentTrackId;
      const lengthKm = t.officialLength ? t.officialLength.split('/')[1]?.trim() || t.officialLength : `${(t.lengthMeters / 1000).toFixed(2)} km`;

      html += `
        <div class="circuit-lab-track-item chamfer-all-corners ${isActive ? 'active' : ''}" 
             data-track-id="${t.trackId}" 
             role="option" 
             aria-selected="${isActive ? 'true' : 'false'}"
             title="${t.displayName} (${statusTitle})">
          <div class="track-item-main">
            <div class="track-item-name-row">
              <span class="track-item-name">${t.trackName}</span>
              <span class="track-item-status-dot ${statusClass}" title="${statusTitle}"></span>
            </div>
            <div class="track-item-sub-row">
              <span class="track-item-layout">${t.layoutName}</span>
              <span class="track-item-length font-mono">${lengthKm}</span>
            </div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
    this._updateSidebarActiveState();
  }

  _updateSidebarActiveState() {
    if (!this.container) return;
    const items = this.container.querySelectorAll('.circuit-lab-track-item');
    items.forEach(item => {
      const isActive = item.dataset.trackId === this.currentTrackId;
      if (isActive) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  /**
   * Switches the active circuit across all 3 sub-views simultaneously
   * @param {string} trackId 
   * @param {boolean} notify 
   */
  selectTrack(trackId, notify = false) {
    if (!trackId) return;
    this.currentTrackId = trackId;

    const profile = trackStudyLibrary.getTrackStudyProfile(trackId);
    if (!profile) return;

    // 1. Update Master Left Sidebar
    this._updateSidebarActiveState();

    // 2. Update Circuit Lab Header Dossier & Badges
    this._updateHeaderDossier(profile);

    // 3. Delegate to Track Study Sub-View
    if (window.apexApp?.trackStudy) {
      window.apexApp.trackStudy.switchTrack(trackId, false);
    }

    // 4. Delegate to Track Editor Sub-View
    if (window.apexApp?.trackEditor) {
      window.apexApp.trackEditor.loadTrack(trackId);
    }

    // 5. Delegate to Track Dossier Sub-View
    if (window.apexApp?.trackLibrary) {
      window.apexApp.trackLibrary.selectedTrackId = trackId;
      window.apexApp.trackLibrary.renderTrackDetails(trackId);
    }

    // 6. Update Subnav Badge Metrics
    this._updateSubnavBadges();
  }

  _updateHeaderDossier(profile) {
    if (!this.container || !profile) return;

    const titleEl = this.container.querySelector('#circuit-lab-title');
    const subEl = this.container.querySelector('#circuit-lab-subtitle');
    const typeBadge = this.container.querySelector('#circuit-lab-type-badge');
    const countryBadge = this.container.querySelector('#circuit-lab-country-badge');

    const turnsCount = profile.turnsCount || (Array.isArray(profile.corners) ? profile.corners.length : 0);
    const lengthKm = profile.lengthMeters ? (profile.lengthMeters / 1000).toFixed(2) : '4.00';
    const direction = profile.direction || 'Clockwise';

    if (titleEl) titleEl.textContent = (profile.trackName || profile.name || 'Circuit').toUpperCase();
    if (subEl) subEl.textContent = `${profile.layoutName || 'Full Course'} · ${lengthKm} km · ${turnsCount} Turns · ${direction}`;

    if (typeBadge) {
      const isReal = profile.type === 'Real';
      typeBadge.textContent = isReal ? 'REAL WORLD' : 'FANTASY CIRCUIT';
      typeBadge.className = isReal ? 'badge-circuit-type' : 'badge-circuit-type fantasy';
    }

    if (countryBadge) {
      countryBadge.textContent = (profile.country || (profile.type === 'Real' ? 'INTERNATIONAL' : 'FM23 ARENA')).toUpperCase();
    }
  }

  _updateSubnavBadges() {
    if (!this.container) return;

    const studyState = trackStudyLibrary.getTrackStudyState(this.currentTrackId);
    const laps = studyState?.lapsCompleted || 0;
    const waypoints = trackStudyLibrary.getWaypoints(this.currentTrackId) || [];
    const profile = trackStudyLibrary.getTrackStudyProfile(this.currentTrackId);
    const turnsCount = profile?.turnsCount || profile?.corners?.length || 0;

    const studyPill = this.container.querySelector('#circuit-study-readiness-pill');
    if (studyPill) {
      studyPill.textContent = laps >= 5 ? '5/5 ✓' : `${laps}/5`;
      studyPill.className = `subnav-badge font-mono ${laps >= 5 ? 'certified' : ''}`;
    }

    const editorPill = this.container.querySelector('#circuit-editor-waypoints-pill');
    if (editorPill) {
      editorPill.textContent = `${waypoints.length} WP`;
    }

    const dossierPill = this.container.querySelector('#circuit-dossier-turns-pill');
    if (dossierPill) {
      dossierPill.textContent = `${turnsCount} T`;
    }
  }

  /**
   * Switches the active sub-view inside Circuit Lab
   * @param {'study' | 'editor' | 'dossier'} subViewName 
   */
  switchSubView(subViewName) {
    this.currentSubView = subViewName;

    // Update subnav buttons
    const subnavBtns = this.container?.querySelectorAll('.subnav-pill-btn');
    subnavBtns?.forEach(btn => {
      const isMatch = btn.dataset.subview === subViewName;
      btn.classList.toggle('active', isMatch);
    });

    // Update sub-view stages
    const studyStage = this.container?.querySelector('#circuit-subview-study');
    const editorStage = this.container?.querySelector('#circuit-subview-editor');
    const dossierStage = this.container?.querySelector('#circuit-subview-dossier');

    if (studyStage) studyStage.style.display = subViewName === 'study' ? 'block' : 'none';
    if (editorStage) editorStage.style.display = subViewName === 'editor' ? 'block' : 'none';
    if (dossierStage) dossierStage.style.display = subViewName === 'dossier' ? 'block' : 'none';

    // Refresh active sub-view
    if (subViewName === 'study' && window.apexApp?.trackStudy) {
      window.apexApp.trackStudy.render();
    } else if (subViewName === 'editor' && window.apexApp?.trackEditor) {
      window.apexApp.trackEditor.resizeCanvases();
      window.apexApp.trackEditor.render();
      window.apexApp.trackEditor.renderSidebar();
    } else if (subViewName === 'dossier' && window.apexApp?.trackLibrary) {
      window.apexApp.trackLibrary.renderTrackDetails(this.currentTrackId);
    }
  }

  /**
   * Ingests live telemetry packet and updates weather & surface conditions in real time
   * @param {Object} sample 
   */
  onTelemetrySample(sample) {
    if (!sample) return;

    // Update live weather strip
    const wetnessEl = this.container?.querySelector('#circuit-lab-wetness-val');
    const trackTempEl = this.container?.querySelector('#circuit-lab-track-temp-val');
    const airTempEl = this.container?.querySelector('#circuit-lab-air-temp-val');
    const gripEl = this.container?.querySelector('#circuit-lab-grip-val');

    const wetness = sample.weather?.trackWetness ?? sample.trackWetness ?? 0;
    const trackTemp = sample.weather?.trackTemp ?? sample.trackTemp ?? 28;
    const airTemp = sample.weather?.airTemp ?? sample.airTemp ?? 22;
    const grip = sample.weather?.surfaceGrip ?? sample.surfaceGrip ?? 1.0;

    if (wetnessEl) {
      const wetPct = Math.round(wetness <= 1 ? wetness * 100 : wetness);
      wetnessEl.textContent = wetPct > 0 ? `${wetPct}% (DAMP)` : '0% (DRY)';
      wetnessEl.style.color = wetPct > 30 ? '#00e5ff' : '#ffffff';
    }
    if (trackTempEl) {
      trackTempEl.textContent = `${Math.round(trackTemp)}°C`;
    }
    if (airTempEl) {
      airTempEl.textContent = `${Math.round(airTemp)}°C`;
    }
    if (gripEl) {
      const gripPct = Math.round(grip <= 1 ? grip * 100 : grip);
      gripEl.textContent = `${gripPct}%`;
    }

    // Forward to active sub-view delegates
    if (window.apexApp?.trackStudy) {
      window.apexApp.trackStudy.onTelemetrySample(sample);
    }
    if (window.apexApp?.trackEditor) {
      window.apexApp.trackEditor.onTelemetrySample(sample);
    }
  }

  _bindEvents() {
    // Master Sidebar Search Input
    const searchInput = this.container?.querySelector('#circuit-lab-search');
    const clearBtn = this.container?.querySelector('#btn-circuit-lab-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentSidebarSearch = e.target.value;
        if (clearBtn) clearBtn.style.display = this.currentSidebarSearch.length > 0 ? 'block' : 'none';
        this._populateMasterSidebar(this.currentSidebarFilter, this.currentSidebarSearch);
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.currentSidebarSearch = '';
        clearBtn.style.display = 'none';
        this._populateMasterSidebar(this.currentSidebarFilter, '');
        searchInput.focus();
      });
    }

    // Category Filter Tabs (ALL / REAL / FANTASY)
    const filterTabs = this.container?.querySelectorAll('.sidebar-filter-tab');
    if (filterTabs) {
      filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          filterTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.currentSidebarFilter = tab.dataset.filter || 'all';
          this._populateMasterSidebar(this.currentSidebarFilter, this.currentSidebarSearch);
        });
      });
    }

    // Master Sidebar Track Selection via Event Delegation
    const trackList = this.container?.querySelector('#circuit-lab-track-list');
    if (trackList) {
      trackList.addEventListener('click', (e) => {
        const item = e.target.closest('.circuit-lab-track-item');
        if (item && item.dataset.trackId) {
          this.selectTrack(item.dataset.trackId, true);
        }
      });
    }

    // Sub-Nav Pill Buttons Switcher
    const subnavBtns = this.container?.querySelectorAll('.subnav-pill-btn');
    if (subnavBtns) {
      subnavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const subview = btn.dataset.subview;
          if (subview) {
            this.switchSubView(subview);
          }
        });
      });
    }
  }
}

export const circuitLabView = new CircuitLabView();
