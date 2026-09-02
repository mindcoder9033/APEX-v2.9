/**
 * APEX Lap Analyzer View Controller
 * Integrates 2D Track Map, Speed Profile Graph, Corner Data Panel,
 * and Session Summary Metrics into an interactive self-discovery telemetry review suite.
 */

import { LapAnalyzerMetrics } from '../analysis/lap-analyzer-metrics.js';
import { LapAnalyzerMap } from './lap-analyzer-map.js';
import { SpeedProfileGraph } from './speed-profile-graph.js';
import { LapAnalyzerPdfGenerator } from './lap-analyzer-pdf.js';

export class LapAnalyzerView {
  constructor() {
    this.sessionManager = null;
    this.processedLaps = [];
    this.primaryLap = null;
    this.ghostLap = null;
    this.summaryMetrics = null;
    this.activeCorner = null;

    // DOM Elements
    this.container = document.getElementById('view-lap-analyzer');
    this.standbyView = document.getElementById('lap-analyzer-standby');
    this.contentView = document.getElementById('lap-analyzer-content');

    // Header Controls
    this.displayTrackName = document.getElementById('analyzer-track-name');
    this.displayCarName = document.getElementById('analyzer-car-name');
    this.selectPrimaryLap = document.getElementById('select-analyzer-primary-lap');
    this.selectGhostLap = document.getElementById('select-analyzer-ghost-lap');
    this.btnExportPng = document.getElementById('btn-analyzer-export-png');
    this.btnDownloadPdf = document.getElementById('btn-analyzer-download-pdf');

    // Map Controls
    this.mapCanvas = document.getElementById('lap-analyzer-map-canvas');
    this.btnZoomIn = document.getElementById('btn-map-zoom-in');
    this.btnZoomOut = document.getElementById('btn-map-zoom-out');
    this.btnResetView = document.getElementById('btn-map-reset-view');
    this.btnToggleBrakes = document.getElementById('btn-map-toggle-brakes');
    this.btnToggleExits = document.getElementById('btn-map-toggle-exits');
    this.btnToggleHeatmap = document.getElementById('btn-map-toggle-heatmap');

    // Graph & Table
    this.graphCanvas = document.getElementById('speed-profile-canvas');
    this.cornerTableBody = document.getElementById('corner-table-body');

    // Summary KPIs
    this.kpiBestLap = document.getElementById('analyzer-kpi-best-lap');
    this.kpiBestLapSub = document.getElementById('analyzer-kpi-best-lap-sub');
    this.kpiProgression = document.getElementById('analyzer-kpi-progression');
    this.kpiProgressionSub = document.getElementById('analyzer-kpi-progression-sub');
    this.kpiInconsistentCorner = document.getElementById('analyzer-kpi-inconsistent');
    this.kpiInconsistentSub = document.getElementById('analyzer-kpi-inconsistent-sub');
    this.kpiBrakingConsistency = document.getElementById('analyzer-kpi-braking-score');

    this.initEngines();
    this.bindEvents();
  }

  initEngines() {
    if (this.mapCanvas) {
      this.mapEngine = new LapAnalyzerMap(this.mapCanvas, {
        onCornerSelect: (corner) => this.selectCorner(corner),
        onHoverPoint: (point) => {
          if (this.graphEngine && point) {
            this.graphEngine.setScrubDistance(point.distanceM, false);
          }
        }
      });
    }

    if (this.graphCanvas) {
      this.graphEngine = new SpeedProfileGraph(this.graphCanvas, {
        onScrub: (sample) => {
          if (this.mapEngine && sample) {
            this.mapEngine.setScrubPoint(sample);
          }
        },
        onCornerSelect: (corner) => this.selectCorner(corner)
      });
    }
  }

  bindEvents() {
    // Primary Lap Selector
    if (this.selectPrimaryLap) {
      this.selectPrimaryLap.addEventListener('change', (e) => {
        const lapNum = parseInt(e.target.value, 10);
        this.setPrimaryLap(lapNum);
      });
    }

    // Ghost Lap Selector
    if (this.selectGhostLap) {
      this.selectGhostLap.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'none') {
          this.setGhostLap(null);
        } else {
          const lapNum = parseInt(val, 10);
          this.setGhostLap(lapNum);
        }
      });
    }

    // Map Zoom / Pan Buttons
    if (this.btnZoomIn) this.btnZoomIn.addEventListener('click', () => this.mapEngine?.zoomIn());
    if (this.btnZoomOut) this.btnZoomOut.addEventListener('click', () => this.mapEngine?.zoomOut());
    if (this.btnResetView) this.btnResetView.addEventListener('click', () => this.mapEngine?.resetView());

    // Map Toggles
    if (this.btnToggleBrakes) {
      this.btnToggleBrakes.addEventListener('click', () => {
        const active = this.btnToggleBrakes.classList.toggle('active');
        this.mapEngine?.setBrakeMarkersVisible(active);
      });
    }

    if (this.btnToggleExits) {
      this.btnToggleExits.addEventListener('click', () => {
        const active = this.btnToggleExits.classList.toggle('active');
        this.mapEngine?.setExitSpeedLabelsVisible(active);
      });
    }

    if (this.btnToggleHeatmap) {
      this.btnToggleHeatmap.addEventListener('click', () => {
        const active = this.btnToggleHeatmap.classList.toggle('active');
        this.mapEngine?.setSpeedHeatmapVisible(active);
      });
    }

    // Export Buttons
    if (this.btnExportPng) {
      this.btnExportPng.addEventListener('click', () => {
        const track = (this.sessionManager?.currentStintMetadata?.trackName || 'Session').replace(/[^a-zA-Z0-9_-]/g, '_');
        const lap = this.primaryLap ? `Lap_${this.primaryLap.lapNumber}` : 'TrackMap';
        this.mapEngine?.exportToPng(`APEX_${track}_${lap}_Map.png`);
      });
    }

    if (this.btnDownloadPdf) {
      this.btnDownloadPdf.addEventListener('click', async () => {
        if (!this.primaryLap) return;
        const meta = {
          trackName: this.sessionManager?.currentStintMetadata?.trackName || 'Circuit Session',
          driverName: this.sessionManager?.currentStintMetadata?.driverName || this.sessionManager?.settings?.driverName || 'APEX Driver',
          carName: this.sessionManager?.currentStintMetadata?.carName || 'Track Vehicle'
        };

        const mapImage = this.mapEngine?.getImageDataUrl();
        await LapAnalyzerPdfGenerator.generateReport({
          sessionMetadata: meta,
          summary: this.summaryMetrics,
          primaryLap: this.primaryLap,
          mapImageDataUrl: mapImage
        });
      });
    }
  }

  /**
   * Called when switching to the Lap Analyzer tab
   */
  onViewActivated(sessionManager) {
    this.sessionManager = sessionManager;
    this.loadFromSessionManager();
    setTimeout(() => {
      this.mapEngine?.resize();
      this.graphEngine?.resize();
    }, 50);
  }

  loadFromSessionManager() {
    const sm = this.sessionManager;
    const hasSamples = sm && sm.recordedSamples && sm.recordedSamples.length > 50;

    if (!hasSamples) {
      this.showStandby();
      return;
    }

    // Ensure analysis report exists
    let report = sm.latestAnalysisReport;
    if (!report || !report.laps || report.laps.length === 0) {
      try {
        report = sm.analysisEngine.analyzeStint(sm.recordedSamples);
        sm.latestAnalysisReport = report;
      } catch (err) {
        console.warn('[ANALYZER] Error analyzing stint samples:', err);
      }
    }

    if (!report || !report.laps || report.laps.length === 0) {
      this.showStandby();
      return;
    }

    // Process all valid laps using LapAnalyzerMetrics
    this.processedLaps = report.laps
      .filter(l => l.isValid && l.samples && l.samples.length > 20)
      .map(l => LapAnalyzerMetrics.processLap(l))
      .filter(Boolean);

    if (this.processedLaps.length === 0) {
      // Fallback: process entire stint as single lap
      const syntheticLap = {
        lapNumber: 1,
        lapTime: sm.recordedSamples.length / 60.0,
        isValid: true,
        samples: sm.recordedSamples,
        corners: report.findings ? [] : []
      };
      const processed = LapAnalyzerMetrics.processLap(syntheticLap);
      if (processed) this.processedLaps = [processed];
    }

    if (this.processedLaps.length === 0) {
      this.showStandby();
      return;
    }

    // Compute session summary
    this.summaryMetrics = LapAnalyzerMetrics.computeSessionSummary(this.processedLaps);

    this.showContent();
    this.populateSelectors();

    // Default primary lap to Best Lap
    let bestLap = this.processedLaps[0];
    for (const l of this.processedLaps) {
      if (l.lapTime < bestLap.lapTime) {
        bestLap = l;
      }
    }

    this.primaryLap = bestLap;
    this.ghostLap = null;
    this.activeCorner = null;

    if (this.selectPrimaryLap) {
      this.selectPrimaryLap.value = String(bestLap.lapNumber);
    }
    if (this.selectGhostLap) {
      this.selectGhostLap.value = 'none';
    }

    this.updateView();
  }

  showStandby() {
    if (this.standbyView) this.standbyView.style.display = 'flex';
    if (this.contentView) this.contentView.style.display = 'none';
  }

  showContent() {
    if (this.standbyView) this.standbyView.style.display = 'none';
    if (this.contentView) this.contentView.style.display = 'flex';
  }

  populateSelectors() {
    if (!this.selectPrimaryLap || !this.selectGhostLap) return;

    this.selectPrimaryLap.innerHTML = '';
    this.selectGhostLap.innerHTML = '<option value="none">None (Single Lap)</option>';

    for (const lap of this.processedLaps) {
      const timeStr = this.formatTime(lap.lapTime);
      const isBest = this.summaryMetrics && lap.lapTime === this.summaryMetrics.bestLapTime;
      const label = `Lap ${lap.lapNumber} (${timeStr})${isBest ? ' ★ BEST' : ''}`;

      const optPrimary = document.createElement('option');
      optPrimary.value = String(lap.lapNumber);
      optPrimary.textContent = label;
      this.selectPrimaryLap.appendChild(optPrimary);

      const optGhost = document.createElement('option');
      optGhost.value = String(lap.lapNumber);
      optGhost.textContent = `Lap ${lap.lapNumber} (${timeStr})`;
      this.selectGhostLap.appendChild(optGhost);
    }
  }

  setPrimaryLap(lapNumber) {
    const target = this.processedLaps.find(l => l.lapNumber === lapNumber);
    if (target) {
      this.primaryLap = target;
      this.activeCorner = null;
      this.updateView();
    }
  }

  setGhostLap(lapNumber) {
    if (lapNumber === null) {
      this.ghostLap = null;
    } else {
      this.ghostLap = this.processedLaps.find(l => l.lapNumber === lapNumber) || null;
    }
    this.mapEngine?.setData(this.primaryLap, this.ghostLap);
    this.graphEngine?.setData(this.primaryLap, this.ghostLap);
  }

  selectCorner(corner) {
    this.activeCorner = corner;
    this.mapEngine?.setActiveCorner(corner);
    this.graphEngine?.setActiveCorner(corner);

    // Highlight row in table
    const rows = this.cornerTableBody?.querySelectorAll('.corner-row');
    if (rows) {
      rows.forEach(r => {
        const turn = parseInt(r.getAttribute('data-turn'), 10);
        if (corner && turn === corner.turnNumber) {
          r.classList.add('active');
          r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          r.classList.remove('active');
        }
      });
    }
  }

  updateView() {
    if (!this.primaryLap) return;

    // Header metadata
    const meta = this.sessionManager?.currentStintMetadata || {};
    if (this.displayTrackName) {
      this.displayTrackName.textContent = (meta.trackName || 'CIRCUIT SESSION').toUpperCase();
    }
    if (this.displayCarName) {
      this.displayCarName.textContent = meta.carName ? `CAR: ${meta.carName}` : 'TELEMETRY REVIEW';
    }

    // Send data to Canvas engines
    this.mapEngine?.setData(this.primaryLap, this.ghostLap);
    this.graphEngine?.setData(this.primaryLap, this.ghostLap);

    // Populate Corner Data Table
    this.renderCornerTable();

    // Populate Summary KPI Cards
    this.renderSummaryKPIs();
  }

  renderCornerTable() {
    if (!this.cornerTableBody) return;
    this.cornerTableBody.innerHTML = '';

    const corners = this.primaryLap?.corners || [];
    if (corners.length === 0) {
      this.cornerTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 18px;">No corner apexes detected for this lap</td></tr>`;
      return;
    }

    corners.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = 'corner-row';
      tr.setAttribute('data-turn', String(c.turnNumber));

      tr.innerHTML = `
        <td><span class="corner-name-badge">Turn ${c.turnNumber}</span></td>
        <td>${Math.round(c.entrySpeedKmh)} km/h</td>
        <td>${Math.round(c.apexSpeedKmh)} km/h</td>
        <td class="exit-speed-cell">${Math.round(c.exitSpeedKmh)} km/h <span class="exit-gear-tag">${c.exitGear}</span></td>
        <td>${Math.round(c.brakingDistanceM)}m</td>
        <td>${c.durationSec.toFixed(2)}s</td>
      `;

      tr.addEventListener('click', () => this.selectCorner(c));
      tr.addEventListener('mouseenter', () => {
        this.mapEngine?.setActiveCorner(c);
        this.graphEngine?.setActiveCorner(c);
      });
      tr.addEventListener('mouseleave', () => {
        this.mapEngine?.setActiveCorner(this.activeCorner);
        this.graphEngine?.setActiveCorner(this.activeCorner);
      });

      this.cornerTableBody.appendChild(tr);
    });
  }

  renderSummaryKPIs() {
    const s = this.summaryMetrics || {};

    if (this.kpiBestLap) {
      this.kpiBestLap.textContent = this.formatTime(s.bestLapTime || this.primaryLap.lapTime);
    }
    if (this.kpiBestLapSub) {
      this.kpiBestLapSub.textContent = `Lap ${this.primaryLap.lapNumber} of ${this.processedLaps.length}`;
    }

    if (this.kpiProgression) {
      this.kpiProgression.textContent = s.improvementSec > 0 ? `-${s.improvementSec}s` : '±0.00s';
    }
    if (this.kpiProgressionSub) {
      this.kpiProgressionSub.textContent = s.firstLapTime ? `${this.formatTime(s.firstLapTime)} → Best` : 'Single Lap';
    }

    if (this.kpiInconsistentCorner) {
      this.kpiInconsistentCorner.textContent = s.mostInconsistentCorner ? s.mostInconsistentCorner.label : 'None';
    }
    if (this.kpiInconsistentSub) {
      this.kpiInconsistentSub.textContent = s.mostInconsistentCorner ? `±${s.mostInconsistentCorner.timeVariationSec}s delta` : 'Consistent';
    }

    if (this.kpiBrakingConsistency) {
      this.kpiBrakingConsistency.textContent = `${s.brakingConsistencyScore || 85}%`;
    }
  }

  formatTime(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}
