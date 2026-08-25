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
   * Generates default client fallback seeds if server API is warming up
   */
  getDefaultFallbackTracks() {
    const buildPath = (len, offset = 0) => {
      const pts = [];
      const count = 100;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + offset;
        const r = 320 + Math.sin(angle * 3) * 60 + Math.cos(angle * 5) * 40;
        pts.push({
          x: Math.round(500 + Math.cos(angle) * r * 1.1),
          z: Math.round(450 + Math.sin(angle) * r * 0.85),
          dist: Math.round((i / count) * len)
        });
      }
      return pts;
    };

    return [
      {
        id: 'silverstone-gp',
        name: 'Silverstone Circuit',
        layout: 'Grand Prix Circuit',
        lengthMeters: 5891,
        direction: 'Clockwise',
        sectors: { s1End: 1960, s2End: 3920, s3End: 5891 },
        elevation: { minElevation: 140, maxElevation: 153, elevationDelta: 12.6, profile: [] },
        characteristics: {
          slowCorners: 3, mediumCorners: 4, fastCorners: 8,
          longestStraight: 770,
          dangerZones: [{ turnNumber: 3, name: 'Village', reason: 'Heavy threshold braking zone' }],
          rhythmOverview: 'High-downforce flowing circuit with iconic fast complexes Copse and Maggotts-Becketts.'
        },
        turns: [
          { turnNumber: 1, name: 'Abbey', type: 'Fast Sweeper', direction: 'Right', entryDist: 340, apexDist: 420, exitDist: 490, refSpeed: 235, refGear: 6, apexLatG: 2.1, brakingDist: 20 },
          { turnNumber: 2, name: 'Farm Curve', type: 'Fast Sweeper', direction: 'Left', entryDist: 530, apexDist: 600, exitDist: 680, refSpeed: 245, refGear: 6, apexLatG: 1.8, brakingDist: 0 },
          { turnNumber: 3, name: 'Village', type: 'Hairpin', direction: 'Right', entryDist: 850, apexDist: 930, exitDist: 990, refSpeed: 82, refGear: 2, apexLatG: 1.3, brakingDist: 95 },
          { turnNumber: 4, name: 'The Loop', type: 'Hairpin', direction: 'Left', entryDist: 1040, apexDist: 1110, exitDist: 1180, refSpeed: 75, refGear: 2, apexLatG: 1.25, brakingDist: 50 },
          { turnNumber: 5, name: 'Aintree', type: 'Medium Corner', direction: 'Left', entryDist: 1220, apexDist: 1290, exitDist: 1360, refSpeed: 155, refGear: 4, apexLatG: 1.5, brakingDist: 30 },
          { turnNumber: 6, name: 'Brooklands', type: '90° Corner', direction: 'Left', entryDist: 2280, apexDist: 2360, exitDist: 2430, refSpeed: 120, refGear: 3, apexLatG: 1.6, brakingDist: 80 },
          { turnNumber: 7, name: 'Luffield', type: 'Medium Corner', direction: 'Right', entryDist: 2460, apexDist: 2560, exitDist: 2650, refSpeed: 95, refGear: 2, apexLatG: 1.45, brakingDist: 40 },
          { turnNumber: 8, name: 'Woodcote', type: 'Fast Sweeper', direction: 'Right', entryDist: 2680, apexDist: 2750, exitDist: 2830, refSpeed: 215, refGear: 5, apexLatG: 1.7, brakingDist: 0 },
          { turnNumber: 9, name: 'Copse', type: 'Fast Sweeper', direction: 'Right', entryDist: 3260, apexDist: 3340, exitDist: 3410, refSpeed: 240, refGear: 6, apexLatG: 2.2, brakingDist: 25 },
          { turnNumber: 10, name: 'Maggotts', type: 'Fast Sweeper', direction: 'Left', entryDist: 3750, apexDist: 3820, exitDist: 3880, refSpeed: 260, refGear: 7, apexLatG: 2.4, brakingDist: 0 },
          { turnNumber: 11, name: 'Becketts', type: 'Chicane', direction: 'Right', entryDist: 3910, apexDist: 3980, exitDist: 4050, refSpeed: 210, refGear: 5, apexLatG: 2.1, brakingDist: 45 },
          { turnNumber: 12, name: 'Chapel', type: 'Fast Sweeper', direction: 'Left', entryDist: 4080, apexDist: 4150, exitDist: 4220, refSpeed: 220, refGear: 6, apexLatG: 1.9, brakingDist: 0 },
          { turnNumber: 13, name: 'Stowe', type: '90° Corner', direction: 'Right', entryDist: 4980, apexDist: 5070, exitDist: 5150, refSpeed: 175, refGear: 4, apexLatG: 1.8, brakingDist: 75 },
          { turnNumber: 14, name: 'Vale', type: 'Chicane', direction: 'Left', entryDist: 5460, apexDist: 5530, exitDist: 5590, refSpeed: 90, refGear: 2, apexLatG: 1.4, brakingDist: 85 },
          { turnNumber: 15, name: 'Club', type: 'Medium Corner', direction: 'Right', entryDist: 5620, apexDist: 5710, exitDist: 5800, refSpeed: 140, refGear: 3, apexLatG: 1.6, brakingDist: 30 }
        ],
        path2D: buildPath(5891, 0),
        driverNotes: 'Commit to full throttle through Abbey & Farm Curve. Prioritize exit speed out of The Loop onto Wellington Straight.'
      },
      {
        id: 'watkins-glen-full',
        name: 'Watkins Glen International',
        layout: 'Grand Prix Course (with Boot)',
        lengthMeters: 5472,
        direction: 'Clockwise',
        sectors: { s1End: 1824, s2End: 3648, s3End: 5472 },
        elevation: { minElevation: 300, maxElevation: 334, elevationDelta: 34.0, profile: [] },
        characteristics: {
          slowCorners: 2, mediumCorners: 5, fastCorners: 4,
          longestStraight: 820,
          dangerZones: [{ turnNumber: 1, name: 'The Ninety', reason: 'Downhill braking with camber falloff' }],
          rhythmOverview: 'Fast, historic high-speed road course with the high-commitment Esses and undulating Boot section.'
        },
        turns: [
          { turnNumber: 1, name: 'The Ninety', type: '90° Corner', direction: 'Right', entryDist: 420, apexDist: 510, exitDist: 580, refSpeed: 125, refGear: 3, apexLatG: 1.6, brakingDist: 85 },
          { turnNumber: 2, name: 'Esses Turn 2', type: 'Fast Sweeper', direction: 'Right', entryDist: 920, apexDist: 1010, exitDist: 1100, refSpeed: 215, refGear: 5, apexLatG: 1.9, brakingDist: 0 },
          { turnNumber: 3, name: 'Esses Turn 3', type: 'Fast Sweeper', direction: 'Left', entryDist: 1140, apexDist: 1220, exitDist: 1300, refSpeed: 230, refGear: 6, apexLatG: 1.8, brakingDist: 0 },
          { turnNumber: 4, name: 'Esses Turn 4', type: 'Fast Sweeper', direction: 'Right', entryDist: 1340, apexDist: 1420, exitDist: 1500, refSpeed: 240, refGear: 6, apexLatG: 1.7, brakingDist: 0 },
          { turnNumber: 5, name: 'Inner Loop Bus Stop', type: 'Chicane', direction: 'Right', entryDist: 2340, apexDist: 2420, exitDist: 2500, refSpeed: 140, refGear: 3, apexLatG: 1.8, brakingDist: 95 },
          { turnNumber: 6, name: 'The Carousel', type: 'Fast Sweeper', direction: 'Right', entryDist: 2650, apexDist: 2780, exitDist: 2900, refSpeed: 165, refGear: 4, apexLatG: 1.9, brakingDist: 25 },
          { turnNumber: 7, name: 'The Chute', type: 'Medium Corner', direction: 'Left', entryDist: 3340, apexDist: 3420, exitDist: 3500, refSpeed: 135, refGear: 3, apexLatG: 1.5, brakingDist: 55 },
          { turnNumber: 8, name: 'The Boot Heel', type: 'Hairpin', direction: 'Left', entryDist: 3780, apexDist: 3870, exitDist: 3950, refSpeed: 85, refGear: 2, apexLatG: 1.35, brakingDist: 75 },
          { turnNumber: 9, name: 'The Laces', type: 'Medium Corner', direction: 'Right', entryDist: 4120, apexDist: 4200, exitDist: 4280, refSpeed: 115, refGear: 3, apexLatG: 1.45, brakingDist: 40 },
          { turnNumber: 10, name: 'The Toe', type: 'Medium Corner', direction: 'Left', entryDist: 4560, apexDist: 4640, exitDist: 4720, refSpeed: 145, refGear: 4, apexLatG: 1.6, brakingDist: 35 },
          { turnNumber: 11, name: 'Turn 11', type: '90° Corner', direction: 'Right', entryDist: 5180, apexDist: 5260, exitDist: 5340, refSpeed: 150, refGear: 4, apexLatG: 1.7, brakingDist: 60 }
        ],
        path2D: buildPath(5472, 1.2),
        driverNotes: 'Maximize entry curb usage through Bus Stop. Trail brake deep into The Heel to rotate the chassis.'
      },
      {
        id: 'maple-valley',
        name: 'Maple Valley Raceway',
        layout: 'Full Circuit',
        lengthMeters: 4810,
        direction: 'Clockwise',
        sectors: { s1End: 1600, s2End: 3200, s3End: 4810 },
        elevation: { minElevation: 220, maxElevation: 258, elevationDelta: 38.0, profile: [] },
        characteristics: {
          slowCorners: 1, mediumCorners: 4, fastCorners: 4,
          longestStraight: 680,
          dangerZones: [{ turnNumber: 3, name: 'Downhill Sweeper', reason: 'Unweighting over crest at 200+ km/h' }],
          rhythmOverview: 'Spectacular undulating circuit with drastic elevation changes and high-speed cambered sweepers.'
        },
        turns: [
          { turnNumber: 1, name: 'Turn 1', type: 'Fast Sweeper', direction: 'Left', entryDist: 380, apexDist: 460, exitDist: 540, refSpeed: 195, refGear: 5, apexLatG: 1.8, brakingDist: 30 },
          { turnNumber: 2, name: 'Hillside', type: 'Medium Corner', direction: 'Right', entryDist: 780, apexDist: 860, exitDist: 940, refSpeed: 140, refGear: 3, apexLatG: 1.5, brakingDist: 45 },
          { turnNumber: 3, name: 'Downhill Sweeper', type: 'Fast Sweeper', direction: 'Right', entryDist: 1420, apexDist: 1540, exitDist: 1650, refSpeed: 210, refGear: 5, apexLatG: 2.0, brakingDist: 15 },
          { turnNumber: 4, name: 'Crest Bend', type: 'Medium Corner', direction: 'Left', entryDist: 2180, apexDist: 2260, exitDist: 2340, refSpeed: 150, refGear: 4, apexLatG: 1.6, brakingDist: 35 },
          { turnNumber: 5, name: 'The Valley Hairpin', type: 'Hairpin', direction: 'Right', entryDist: 2780, apexDist: 2860, exitDist: 2940, refSpeed: 88, refGear: 2, apexLatG: 1.3, brakingDist: 80 },
          { turnNumber: 6, name: 'Underpass Left', type: 'Medium Corner', direction: 'Left', entryDist: 3420, apexDist: 3500, exitDist: 3580, refSpeed: 130, refGear: 3, apexLatG: 1.5, brakingDist: 40 },
          { turnNumber: 7, name: 'Overpass Right', type: 'Fast Sweeper', direction: 'Right', entryDist: 3820, apexDist: 3910, exitDist: 4000, refSpeed: 185, refGear: 5, apexLatG: 1.75, brakingDist: 20 },
          { turnNumber: 8, name: 'Final Complex', type: 'Chicane', direction: 'Left', entryDist: 4320, apexDist: 4400, exitDist: 4480, refSpeed: 120, refGear: 3, apexLatG: 1.6, brakingDist: 65 }
        ],
        path2D: buildPath(4810, 2.4),
        driverNotes: 'Smooth inputs over the crest on Turn 3. Early throttle application exiting The Valley Hairpin.'
      },
      {
        id: 'spa-francorchamps',
        name: 'Circuit de Spa-Francorchamps',
        layout: 'Grand Prix Circuit',
        lengthMeters: 7004,
        direction: 'Clockwise',
        sectors: { s1End: 2335, s2End: 4670, s3End: 7004 },
        elevation: { minElevation: 370, maxElevation: 472, elevationDelta: 102.0, profile: [] },
        characteristics: {
          slowCorners: 3, mediumCorners: 6, fastCorners: 10,
          longestStraight: 2015,
          dangerZones: [{ turnNumber: 2, name: 'Eau Rouge - Raidillon', reason: 'Blind compression at 300 km/h with 4G vertical load' }],
          rhythmOverview: 'Legendary Ardennes circuit featuring dramatic 102m elevation rise through Eau Rouge and high-speed Blanchimont.'
        },
        turns: [
          { turnNumber: 1, name: 'La Source', type: 'Hairpin', direction: 'Right', entryDist: 280, apexDist: 360, exitDist: 430, refSpeed: 70, refGear: 2, apexLatG: 1.3, brakingDist: 90 },
          { turnNumber: 2, name: 'Eau Rouge', type: 'Fast Sweeper', direction: 'Left', entryDist: 920, apexDist: 1000, exitDist: 1070, refSpeed: 290, refGear: 8, apexLatG: 2.6, brakingDist: 0 },
          { turnNumber: 3, name: 'Raidillon', type: 'Fast Sweeper', direction: 'Right', entryDist: 1100, apexDist: 1180, exitDist: 1260, refSpeed: 285, refGear: 8, apexLatG: 2.4, brakingDist: 0 },
          { turnNumber: 4, name: 'Les Combes', type: 'Chicane', direction: 'Right', entryDist: 3100, apexDist: 3180, exitDist: 3260, refSpeed: 145, refGear: 4, apexLatG: 1.7, brakingDist: 85 },
          { turnNumber: 5, name: 'Malmedy', type: 'Medium Corner', direction: 'Right', entryDist: 3340, apexDist: 3410, exitDist: 3480, refSpeed: 170, refGear: 4, apexLatG: 1.6, brakingDist: 20 },
          { turnNumber: 6, name: 'Rivage / Bruxelles', type: 'Hairpin', direction: 'Right', entryDist: 3760, apexDist: 3860, exitDist: 3950, refSpeed: 105, refGear: 3, apexLatG: 1.45, brakingDist: 60 },
          { turnNumber: 7, name: 'Speaker\'s Corner', type: 'Medium Corner', direction: 'Left', entryDist: 4120, apexDist: 4200, exitDist: 4280, refSpeed: 155, refGear: 4, apexLatG: 1.55, brakingDist: 30 },
          { turnNumber: 8, name: 'Pouhon', type: 'Fast Sweeper', direction: 'Left', entryDist: 4620, apexDist: 4720, exitDist: 4820, refSpeed: 240, refGear: 6, apexLatG: 2.5, brakingDist: 25 },
          { turnNumber: 9, name: 'Fagnes', type: 'Chicane', direction: 'Right', entryDist: 5320, apexDist: 5400, exitDist: 5480, refSpeed: 160, refGear: 4, apexLatG: 1.7, brakingDist: 50 },
          { turnNumber: 10, name: 'Campus / Stavelot', type: 'Medium Corner', direction: 'Right', entryDist: 5740, apexDist: 5820, exitDist: 5900, refSpeed: 180, refGear: 5, apexLatG: 1.65, brakingDist: 25 },
          { turnNumber: 11, name: 'Courbe Paul Frère', type: 'Fast Sweeper', direction: 'Right', entryDist: 6020, apexDist: 6100, exitDist: 6180, refSpeed: 235, refGear: 6, apexLatG: 1.9, brakingDist: 0 },
          { turnNumber: 12, name: 'Blanchimont', type: 'Fast Sweeper', direction: 'Left', entryDist: 6480, apexDist: 6580, exitDist: 6680, refSpeed: 295, refGear: 8, apexLatG: 2.2, brakingDist: 0 },
          { turnNumber: 13, name: 'Bus Stop Chicane', type: 'Chicane', direction: 'Right', entryDist: 6780, apexDist: 6860, exitDist: 6940, refSpeed: 75, refGear: 2, apexLatG: 1.35, brakingDist: 110 }
        ],
        path2D: buildPath(7004, 3.8),
        driverNotes: 'Flat out through Eau Rouge with steady steering angle. Late apex at Pouhon to carry apex momentum.'
      }
    ];
  }

  /**
   * Fetches all saved tracks from API with client fallback
   */
  async loadTracks() {
    try {
      const res = await fetch('/api/tracks');
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          this.tracks = data.tracks;
        } else {
          this.tracks = this.getDefaultFallbackTracks();
        }
      } else {
        this.tracks = this.getDefaultFallbackTracks();
      }
    } catch (err) {
      console.warn('[TRACK LIBRARY] API offline or fallback active:', err.message);
      this.tracks = this.getDefaultFallbackTracks();
    }

    this.renderTrackCards();

    if (this.tracks.length > 0) {
      const activeId = this.sessionManager?.activeTrackProfile?.id;
      const initial = (activeId && this.tracks.find(t => t.id === activeId)) || this.tracks[0];
      this.selectTrack(initial.id);
    }
  }

  /**
   * Renders the track cards sidebar
   */
  renderTrackCards(tracksToRender = this.tracks) {
    if (!this.trackCardsList) return;
    this.trackCardsList.innerHTML = '';

    if (tracksToRender.length === 0) {
      this.trackCardsList.innerHTML = '<div style="color: var(--color-text-muted); font-size: 11px; padding: 12px; font-family: var(--font-mono);">No track profiles found.</div>';
      return;
    }

    const activeTrackId = this.sessionManager?.activeTrackProfile?.id;

    tracksToRender.forEach(track => {
      const card = document.createElement('div');
      const isSelected = this.selectedTrack && this.selectedTrack.id === track.id;
      const isActive = activeTrackId === track.id;

      card.className = `track-card chamfer-all-corners ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-weight: 800; font-size: 12px; color: var(--color-text-primary); font-family: var(--font-headline); letter-spacing: 0.03em;">${track.name}</div>
          ${isActive ? '<span style="background: var(--color-success); color: #000; font-size: 8.5px; font-weight: 900; padding: 1px 5px; border-radius: 2px; font-family: var(--font-mono);">ACTIVE</span>' : ''}
        </div>
        <div style="font-size: 11px; color: var(--color-text-secondary); margin-bottom: 6px;">${track.layout || 'Full Course'}</div>
        <div style="display: flex; gap: 10px; font-size: 10px; color: var(--color-text-muted); font-family: var(--font-mono);">
          <span>📏 ${(track.lengthMeters || 0).toLocaleString()}m</span>
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
   * Updates hero section and interactive visualizer with selected track data
   */
  renderSelectedTrack() {
    const track = this.selectedTrack;
    if (!track) return;

    if (this.heroName) this.heroName.textContent = track.name || 'Unknown Circuit';
    if (this.heroLayout) this.heroLayout.textContent = track.layout || 'Full Course';
    if (this.heroDirection) {
      const dir = (track.direction || 'Clockwise').toUpperCase();
      this.heroDirection.textContent = dir;
      this.heroDirection.style.borderColor = dir.includes('COUNTER') ? 'var(--color-warning)' : 'rgba(0, 153, 255, 0.35)';
      this.heroDirection.style.color = dir.includes('COUNTER') ? 'var(--color-warning)' : '#0099FF';
    }

    if (this.heroLength) this.heroLength.textContent = `${(track.lengthMeters || 0).toLocaleString()} m`;
    if (this.heroTurns) this.heroTurns.textContent = `${track.turns?.length || 0} Turns`;
    if (this.heroElevation) {
      const delta = track.elevation?.elevationDelta || 0;
      this.heroElevation.textContent = `+${delta.toFixed(1)} m`;
    }
    if (this.heroStraight) {
      const straight = track.characteristics?.longestStraight || Math.round((track.lengthMeters || 4000) * 0.2);
      this.heroStraight.textContent = `${straight} m`;
    }
    if (this.heroRhythm) {
      this.heroRhythm.textContent = track.characteristics?.rhythmOverview || 'High-downforce technical road course with high commitment corners.';
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

    if (turns.length === 0) {
      this.turnTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 16px;">No turns mapped yet.</td></tr>`;
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
   * Renders interactive SVG map with turn badges and hover interactions
   */
  renderInteractiveMap(track) {
    if (!this.interactiveMapContainer) return;
    const path2D = track.path2D || [];

    if (path2D.length < 3) {
      this.interactiveMapContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 12px; text-align: center; padding-top: 150px; font-family: var(--font-mono);">Awaiting multi-lap calibration coordinates for vector circuit visualizer...</div>';
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
        // Local state update if server is in offline mode
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
      }
    } catch (err) {
      this.tracks = this.tracks.filter(t => t.id !== this.selectedTrack.id);
      this.renderTrackCards();
      if (this.tracks.length > 0) this.selectTrack(this.tracks[0].id);
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
