/**
 * APEX Session Manager
 * Controls recording lifecycle, stint stopwatch timing, lap stats, settings persistence,
 * and executes client-side racecraft analysis when recording completes.
 */

import { AnalysisEngine } from './analysis/index.js';
import { ClientPdfGenerator } from './pdf-generator.js';
import { TelemetryCsvExporter } from './csv-exporter.js';
import { StintMetadataModal } from './components/stint-modal.js';

export class SessionManager {
  constructor() {
    this.isRecording = false;
    this.stintStartTime = 0;
    this.stintDurationMs = 0;
    this.timerInterval = null;

    this.currentLap = 1;
    this.bestLapTime = null;
    this.lastLapTime = null;
    this.recordedSamples = [];

    this.analysisEngine = new AnalysisEngine();
    this.pdfGenerator = new ClientPdfGenerator();
    this.stintModal = new StintMetadataModal();
    this.currentStintMetadata = null;
    this.latestAnalysisReport = null;

    // DOM Elements Cache
    this.btnRecord = document.getElementById('btn-record');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnDownloadPdf = document.getElementById('btn-download-pdf');
    this.timerVal = document.getElementById('stint-timer-val');
    this.lapCounterVal = document.getElementById('lap-counter-val');
    this.bestLapVal = document.getElementById('best-lap-val');
    this.lastLapVal = document.getElementById('last-lap-val');
    this.samplesCountVal = document.getElementById('samples-count-val');

    this.analysisSection = document.getElementById('analysis-report-section');
    this.analysisSummaryText = document.getElementById('analysis-laps-summary');
    this.trackMapContainer = document.getElementById('track-map-container');
    this.trackMapIssuesTags = document.getElementById('track-map-issues-tags');
    this.coachingFeed = document.getElementById('coaching-feed');
    this.cornerTableBody = document.getElementById('corner-table-body');
    this.deltaTableBody = document.getElementById('delta-table-body');
    this.deltaPrioritiesFeed = document.getElementById('delta-priorities-feed');
    this.deltaTotalGainBadge = document.getElementById('delta-total-gain-badge');
    this.deltaBaselineLaps = document.getElementById('delta-baseline-laps');
    this.deltaStintTime = document.getElementById('delta-stint-time');
    this.deltaCornerStraightSplit = document.getElementById('delta-corner-straight-split');
    this.deltaCornerTypesCount = document.getElementById('delta-corner-types-count');

    // Braking Elements Cache
    this.brakingEfficiencyBadge = document.getElementById('braking-efficiency-badge');
    this.brakingPeakDecelVal = document.getElementById('braking-peak-decel-val');
    this.brakingAvgEfficiencyVal = document.getElementById('braking-avg-efficiency-val');
    this.brakingProcedureScoreVal = document.getElementById('braking-procedure-score-val');
    this.brakingTotalDistanceVal = document.getElementById('braking-total-distance-val');
    this.brakingTableBody = document.getElementById('braking-table-body');

    // Shifting & Powerband Elements Cache (Sprint 10)
    this.shiftingGradeBadge = document.getElementById('shifting-grade-badge');
    this.shiftingPowerbandEffVal = document.getElementById('shifting-powerband-eff-val');
    this.shiftingBlipCompVal = document.getElementById('shifting-blip-comp-val');
    this.shiftingBrakeStabVal = document.getElementById('shifting-brake-stab-val');
    this.shiftingTotalDownshiftsVal = document.getElementById('shifting-total-downshifts-val');
    this.powerbandRangeText = document.getElementById('powerband-range-text');
    this.powerbandFaultsText = document.getElementById('powerband-faults-text');
    this.shiftingTableBody = document.getElementById('shifting-table-body');
    this.downshiftSummaryText = document.getElementById('downshift-summary-text');

    // Load saved settings
    this.settings = this.loadSettings();

    this.bindEvents();
  }

  loadSettings() {
    let defaultWsUrl = 'ws://127.0.0.1:3000';
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      defaultWsUrl = `${protocol}//${window.location.host || '127.0.0.1:3000'}`;
    }

    const defaults = {
      udpPort: 9999,
      wsUrl: defaultWsUrl,
      driverName: 'APEX Driver',
      sessionName: 'Track Day Session',
      speedUnit: 'kmh'
    };

    try {
      const saved = localStorage.getItem('apex_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.wsUrl && parsed.wsUrl.includes(':8080') && typeof window !== 'undefined' && window.location.port !== '8080') {
          parsed.wsUrl = defaultWsUrl;
        }
        return { ...defaults, ...parsed };
      }
      return defaults;
    } catch {
      return defaults;
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('apex_settings', JSON.stringify(this.settings));
    } catch (err) {
      console.warn('Failed to save settings to localStorage:', err);
    }
  }

  bindEvents() {
    if (this.btnRecord) {
      this.btnRecord.addEventListener('click', () => {
        this.toggleRecording();
      });
    }

    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        this.exportRawCsv();
      });
    }

    if (this.btnDownloadPdf) {
      this.btnDownloadPdf.addEventListener('click', async () => {
        await this.downloadPdfReport();
      });
    }
  }

  exportRawCsv() {
    if (!this.recordedSamples || this.recordedSamples.length === 0) {
      alert('Please complete a recording stint first to export raw telemetry data.');
      return;
    }

    try {
      const safeName = (this.settings.sessionName || 'APEX_Stint').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `APEX_Telemetry_${safeName}_${dateStr}.csv`;
      TelemetryCsvExporter.downloadCsv(this.recordedSamples, filename);
    } catch (err) {
      console.error('[CSV] Error exporting telemetry CSV:', err);
      alert('Failed to export CSV: ' + err.message);
    }
  }

  async downloadPdfReport() {
    if (!this.latestAnalysisReport) {
      alert('Please complete a recording stint first to generate a telemetry report.');
      return;
    }

    try {
      if (this.btnDownloadPdf) {
        this.btnDownloadPdf.textContent = '⏳ GENERATING PDF...';
        this.btnDownloadPdf.disabled = true;
      }

      const latestSample = this.recordedSamples?.[this.recordedSamples.length - 1];
      const carClass = latestSample?.vehicle?.carClass || 'S Class';
      const carPi = latestSample?.vehicle?.carPerformanceIndex ? `PI ${latestSample.vehicle.carPerformanceIndex}` : '';

      const sessionTitle = this.currentStintMetadata?.sessionName || this.settings.sessionName || 'Track Day Stint';
      const trackTitle = this.currentStintMetadata?.trackName || 'Grand Prix Circuit';
      const carTitle = this.currentStintMetadata?.carName || 'Custom Vehicle';

      const metadata = {
        sessionName: sessionTitle,
        driverName: this.settings.driverName || 'APEX Driver',
        trackName: trackTitle,
        circuit: this.currentStintMetadata?.circuit || 'Circuit',
        layout: this.currentStintMetadata?.layout || 'Full Circuit',
        carName: carTitle,
        carClass: carClass,
        carPi: carPi,
        totalLaps: this.latestAnalysisReport.validLapsCount || 1,
        bestLapTimeStr: this.bestLapVal ? this.bestLapVal.textContent : '--:--.---',
        date: new Date().toISOString().split('T')[0]
      };

      const pdfBytes = await this.pdfGenerator.generate(this.latestAnalysisReport, metadata);
      const safeName = sessionTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      this.pdfGenerator.download(pdfBytes, `${safeName}_Report.pdf`);
    } catch (err) {
      console.error('[PDF] Error generating PDF report:', err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      if (this.btnDownloadPdf) {
        this.btnDownloadPdf.innerHTML = '<span>📄</span> DOWNLOAD PDF REPORT';
        this.btnDownloadPdf.disabled = false;
      }
    }
  }
        if (!this.latestAnalysisReport) {
          alert('No stint analysis report available. Record a session first!');
          return;
        }

        try {
          this.btnDownloadPdf.disabled = true;
          this.btnDownloadPdf.textContent = 'GENERATING PDF...';

          const metadata = {
            driverName: this.currentStintMetadata?.driverName || this.settings.driverName || 'APEX Driver',
            trackName: this.currentStintMetadata?.trackName || 'Grand Prix Circuit',
            sessionName: this.currentStintMetadata?.sessionName || this.settings.sessionName || 'Track Day Session',
            carName: this.currentStintMetadata?.carName || 'Race Spec Vehicle',
            carClass: this.currentStintMetadata?.carClass || 'S Class',
            carPi: this.currentStintMetadata?.carPi || '800',
            date: this.currentStintMetadata?.date || new Date().toISOString().split('T')[0],
            totalLaps: this.latestAnalysisReport.validLapsCount || 1,
            bestLapTimeStr: this.formatLapTime(this.latestAnalysisReport.bestLap?.lapTime)
          };

          const pdfBytes = await this.pdfGenerator.generatePdf(this.latestAnalysisReport, metadata);
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `APEX_Report_${metadata.trackName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('[PDF] Export error:', err);
          alert(`PDF Generation failed: ${err.message}`);
        } finally {
          this.btnDownloadPdf.disabled = false;
          this.btnDownloadPdf.innerHTML = '<span>📄</span> DOWNLOAD PDF REPORT';
        }
      });
    }
  }

  startRecording() {
    this.isRecording = true;
    this.recordedSamples = [];
    this.stintStartTime = Date.now();
    this.stintDurationMs = 0;
    this.bestLapTime = null;
    this.lastLapTime = null;
    this.currentLap = 1;

    if (this.btnRecord) {
      this.btnRecord.classList.remove('btn-primary');
      this.btnRecord.classList.add('btn-danger', 'recording-pulse');
      this.btnRecord.innerHTML = '<span class="status-indicator live"></span> STOP RECORDING';
    }

    if (this.analysisSection) {
      this.analysisSection.style.display = 'none';
    }

    this.timerInterval = setInterval(() => {
      this.stintDurationMs = Date.now() - this.stintStartTime;
      this.updateTimerDisplay();
    }, 100);
  }

  async stopRecording() {
    this.isRecording = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.btnRecord) {
      this.btnRecord.classList.remove('btn-danger', 'recording-pulse');
      this.btnRecord.classList.add('btn-primary');
      this.btnRecord.innerHTML = '<span>⏺</span> START STINT RECORDING';
    }

    if (this.recordedSamples.length > 0) {
      try {
        const metadata = await this.stintModal.prompt({
          driverName: this.settings.driverName,
          sessionName: this.settings.sessionName,
          totalLaps: this.currentLap,
          totalSamples: this.recordedSamples.length
        });
        this.currentStintMetadata = metadata;

        const displaySessionName = document.getElementById('display-session-name');
        if (displaySessionName) {
          displaySessionName.textContent = metadata.sessionName;
        }
      } catch (err) {
        console.warn('[SESSION] Stint metadata prompt error or dismissed:', err);
      }

      this.runAnalysisReport();
    }

    return this.recordedSamples;
  }

  runAnalysisReport() {
    try {
      const report = this.analysisEngine.analyzeStint(this.recordedSamples);
      this.latestAnalysisReport = report;
      this.renderAnalysisReport(report);
    } catch (err) {
      console.error('[SESSION] Analysis execution error:', err);
    }
  }

  renderAnalysisReport(report) {
    if (!this.analysisSection) return;
    this.analysisSection.style.display = 'flex';

    if (this.analysisSummaryText) {
      this.analysisSummaryText.textContent = `${report.validLapsCount} Valid Laps Analyzed / ${report.findings.length} Coaching Alerts`;
    }

    // Render Performance Score Card (Sprint 10.5)
    this.renderPerformanceSummary(report.performanceSummary);

    // Render Priority Recommendations (Sprint 10.5)
    this.renderPriorityRecommendations(report.recommendations);

    // Render 2D Vector Track Map
    if (this.trackMapContainer && report.trackMap && report.trackMap.svg) {
      this.trackMapContainer.innerHTML = report.trackMap.svg;
    } else if (this.trackMapContainer) {
      this.trackMapContainer.innerHTML = `
        <div style="color: #666; font-family: var(--font-mono); font-size: 11px; padding: 24px; text-align: center;">
          Awaiting GPS / Position telemetry coordinates for vector track mapping...
        </div>
      `;
    }

    // Render Line Diagnostics Tags
    if (this.trackMapIssuesTags) {
      this.trackMapIssuesTags.innerHTML = '';
      const lineFindings = (report.findings || []).filter(f => ['R-001', 'R-002', 'R-003', 'R-004'].includes(f.ruleId));

      if (lineFindings.length === 0) {
        this.trackMapIssuesTags.innerHTML = `
          <span class="issue-tag-pill" style="color: var(--color-success); border-color: rgba(0, 204, 102, 0.4); background: rgba(0, 204, 102, 0.08);">
            ✓ Optimal Geometry & Driving Line Maintained
          </span>
        `;
      } else {
        lineFindings.forEach(f => {
          const pill = document.createElement('span');
          pill.className = `issue-tag-pill ${f.severity === 'High' ? 'severity-high' : 'severity-medium'}`;
          pill.innerHTML = `⚠️ <strong>T${f.cornerNumber}</strong>: ${f.name}`;
          this.trackMapIssuesTags.appendChild(pill);
        });
      }
    }

    // Render Coaching Feed
    if (this.coachingFeed) {
      this.coachingFeed.innerHTML = '';

      if (report.findings.length === 0) {
        this.coachingFeed.innerHTML = `
          <div class="coaching-card chamfer-all-corners">
            <div class="coaching-header">
              <span class="coaching-rule-title" style="color: var(--color-success);">Clean Driving Session</span>
            </div>
            <p class="coaching-action">No major racecraft rule violations detected. Consistent cornering, smooth trail-braking, and disciplined throttle application.</p>
          </div>
        `;
      } else {
        report.findings.slice(0, 6).forEach((f) => {
          const card = document.createElement('div');
          card.className = `coaching-card chamfer-all-corners ${f.severity === 'High' ? 'severity-high' : 'severity-medium'}`;
          card.innerHTML = `
            <div class="coaching-header">
              <span class="coaching-rule-title">${f.name}</span>
              <span class="coaching-corner-badge">TURN ${f.cornerNumber}</span>
            </div>
            <div class="coaching-quote">"${f.quote}"</div>
            <div class="coaching-action">${f.actionPlan}</div>
            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-secondary); margin-top: 4px;">
              ${f.metric || ''}
            </div>
          `;
          this.coachingFeed.appendChild(card);
        });
      }
    }

    // Render Corner Telemetry Table
    if (this.cornerTableBody) {
      this.cornerTableBody.innerHTML = '';
      const allCorners = [];
      for (const lap of report.laps) {
        if (lap.corners) allCorners.push(...lap.corners);
      }

      if (allCorners.length === 0) {
        this.cornerTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #666;">No corners identified in this stint</td></tr>`;
      } else {
        allCorners.slice(0, 10).forEach((c) => {
          const tr = document.createElement('tr');
          const isMetric = this.settings.speedUnit === 'kmh';
          const tapDist = isMetric ? (c.dynamics?.tapDeltaMeters ?? (c.dynamics?.tapDeltaFeet ? c.dynamics.tapDeltaFeet * 0.3048 : 0)) : (c.dynamics?.tapDeltaFeet ?? 0);
          const tapUnit = isMetric ? 'm' : 'ft';
          const tapSign = tapDist > 0 ? `+${tapDist.toFixed(1)}${tapUnit}` : `${tapDist.toFixed(1)}${tapUnit}`;
          const trailPct = c.dynamics?.trailBrakingOverlapPercent ?? 0;
          const trailColor = trailPct < 20 ? 'var(--color-warning)' : (trailPct >= 40 ? 'var(--color-success)' : 'var(--color-text-primary)');
          
          let apexBadge = '';
          if (c.dynamics?.isEarlyApex) {
            apexBadge = `<span style="font-size: 8px; background: rgba(225, 6, 0, 0.2); color: var(--color-f1-red); padding: 1px 4px; border-radius: 2px; margin-left: 4px;">EARLY</span>`;
          } else if (c.dynamics?.isLateApex) {
            apexBadge = `<span style="font-size: 8px; background: rgba(229, 169, 16, 0.2); color: var(--color-warning); padding: 1px 4px; border-radius: 2px; margin-left: 4px;">LATE</span>`;
          }

          const entrySpd = isMetric ? (c.speed?.entryKmh ?? (c.speed?.entryMph ? c.speed.entryMph * 1.60934 : 0)) : (c.speed?.entryMph ?? 0);
          const apexSpd = isMetric ? (c.speed?.apexKmh ?? (c.speed?.apexMph ? c.speed.apexMph * 1.60934 : 0)) : (c.speed?.apexMph ?? 0);
          const exitSpd = isMetric ? (c.speed?.exitKmh ?? (c.speed?.exitMph ? c.speed.exitMph * 1.60934 : 0)) : (c.speed?.exitMph ?? 0);
          const spdUnit = isMetric ? 'km/h' : 'mph';

          tr.innerHTML = `
            <td><strong>T${c.cornerNumber}</strong> ${apexBadge}</td>
            <td>${c.type}</td>
            <td>${entrySpd.toFixed(1)} ${spdUnit}</td>
            <td><strong>${apexSpd.toFixed(1)} ${spdUnit}</strong></td>
            <td>${exitSpd.toFixed(1)} ${spdUnit}</td>
            <td style="color: ${Math.abs(tapDist) > (isMetric ? 4.5 : 15) ? 'var(--color-f1-red)' : 'var(--color-text-primary)'}">${tapSign}</td>
            <td style="color: ${trailColor}; font-weight: ${trailPct < 20 || trailPct >= 40 ? 'bold' : 'normal'}">${trailPct}%</td>
            <td>${c.inputs?.gear || '—'}</td>
          `;
          this.cornerTableBody.appendChild(tr);
        });
      }
    }

    // Render Delta Lap Comparison Matrix & Skip Barber Priority Ranking
    this.renderDeltaComparison(report.deltaComparison);

    // Render Braking Zone G-Force & Threshold Analysis
    this.renderBrakingAnalysis(report.brakingAnalysis);

    // Render Shifting, Powerband & Downshift Quality (Sprint 10)
    this.renderShiftingAnalysis(report.shiftingAnalysis);

    // Render 4-Corner Tire Dynamics & Thermal Matrix
    this.renderTireDynamics(report.tireDynamics);

    // Render G-G Friction Circle & Limit Utilization (Sprint 10.5)
    this.renderFrictionCircle(report.frictionCircle);
  }

  renderDeltaComparison(delta) {
    if (!delta) return;

    const summary = delta.summary || {};
    const cornerLosses = delta.cornerLosses || [];
    const ranked = delta.rankedOpportunities || [];

    // 1. KPI Badges & Values
    if (this.deltaTotalGainBadge) {
      this.deltaTotalGainBadge.textContent = `+${(summary.totalPotentialGainSec || 0).toFixed(3)}s POTENTIAL GAIN`;
    }
    if (this.deltaBaselineLaps) {
      this.deltaBaselineLaps.textContent = `Best: L${summary.baselineLapNumber || 1} (${(summary.baselineLapTime || 0).toFixed(2)}s) vs Ref: L${summary.targetLapNumber || 2} (${(summary.targetLapTime || 0).toFixed(2)}s)`;
    }
    if (this.deltaStintTime) {
      const dTime = summary.totalDeltaTimeSec || 0;
      const sign = dTime >= 0 ? '+' : '';
      this.deltaStintTime.textContent = `${sign}${dTime.toFixed(3)}s`;
      this.deltaStintTime.style.color = dTime > 0.05 ? 'var(--color-f1-red)' : 'var(--color-success)';
    }
    if (this.deltaCornerStraightSplit) {
      this.deltaCornerStraightSplit.textContent = `Corners: +${(summary.totalCornerLossSec || 0).toFixed(2)}s | Straights: +${(summary.totalStraightLossSec || 0).toFixed(2)}s`;
    }
    if (this.deltaCornerTypesCount) {
      this.deltaCornerTypesCount.textContent = `${summary.type1CornerCount || 0} Type I  /  ${summary.type2CornerCount || 0} Type II  /  ${summary.type3CornerCount || 0} Type III`;
    }

    // 2. Table Rows
    if (this.deltaTableBody) {
      this.deltaTableBody.innerHTML = '';
      if (cornerLosses.length === 0) {
        this.deltaTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #666;">No delta corner loss data available</td></tr>`;
      } else {
        const isMetric = this.settings.speedUnit === 'kmh';
        const spdUnit = isMetric ? 'km/h' : 'mph';

        cornerLosses.forEach((c) => {
          const tr = document.createElement('tr');
          const typeClass = c.cornerType === 'Type I' ? 'badge-type1' : (c.cornerType === 'Type II' ? 'badge-type2' : 'badge-type3');
          const brakeDelta = c.phases?.braking?.deltaSec ?? 0;
          const midDelta = c.phases?.midCorner?.deltaSec ?? 0;
          const exitDelta = c.phases?.exit?.deltaSec ?? 0;
          const totalDelta = c.totalDeltaSec ?? (brakeDelta + midDelta + exitDelta);
          const exitSpdDelta = isMetric ? (c.phases?.exit?.exitSpeedDeltaKmh ?? (c.phases?.exit?.exitSpeedDeltaMph ? c.phases.exit.exitSpeedDeltaMph * 1.60934 : 0)) : (c.phases?.exit?.exitSpeedDeltaMph ?? 0);

          const rankItem = ranked.find(r => r.cornerNumber === c.cornerNumber);
          const potGain = rankItem?.projectedGainSec ?? Math.max(0, totalDelta);
          const rankNum = rankItem ? `#${rankItem.rank}` : '—';

          const formatDelta = (val) => (val > 0 ? `+${val.toFixed(2)}s` : `${val.toFixed(2)}s`);
          const formatSpeed = (val) => (val > 0 ? `+${val.toFixed(1)} ${spdUnit}` : `${val.toFixed(1)} ${spdUnit}`);

          tr.innerHTML = `
            <td><strong>T${c.cornerNumber}</strong></td>
            <td><span class="${typeClass}">${c.cornerType}</span></td>
            <td style="color: ${brakeDelta > 0.05 ? 'var(--color-f1-red)' : 'inherit'}">${formatDelta(brakeDelta)}</td>
            <td style="color: ${midDelta > 0.05 ? 'var(--color-f1-red)' : 'inherit'}">${formatDelta(midDelta)}</td>
            <td style="color: ${exitDelta > 0.05 ? 'var(--color-f1-red)' : 'inherit'}">${formatDelta(exitDelta)}</td>
            <td><strong>${formatDelta(totalDelta)}</strong></td>
            <td style="color: ${exitSpdDelta < -1.0 ? 'var(--color-f1-red)' : 'inherit'}">${formatSpeed(exitSpdDelta)}</td>
            <td style="color: #FFD700; font-weight: bold;">+${potGain.toFixed(2)}s</td>
            <td><strong>${rankNum}</strong></td>
          `;
          this.deltaTableBody.appendChild(tr);
        });
      }
    }

    // 3. Top Ranked Coaching Priorities Cards
    if (this.deltaPrioritiesFeed) {
      this.deltaPrioritiesFeed.innerHTML = '';
      if (ranked.length === 0) {
        this.deltaPrioritiesFeed.innerHTML = `<div style="color: #666; font-size: 11px;">No corner opportunities ranked.</div>`;
      } else {
        ranked.slice(0, 3).forEach((item) => {
          const card = document.createElement('div');
          const cardClass = item.cornerType === 'Type I' ? 'type1' : (item.cornerType === 'Type II' ? 'type2' : 'type3');
          const typeBadgeClass = item.cornerType === 'Type I' ? 'badge-type1' : (item.cornerType === 'Type II' ? 'badge-type2' : 'badge-type3');

          card.className = `delta-priority-card chamfer-all-corners ${cardClass}`;
          card.innerHTML = `
            <div class="coaching-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="${typeBadgeClass}">PRIORITY #${item.rank}</span>
                <span class="coaching-rule-title" style="color: var(--color-text-primary);">TURN ${item.cornerNumber} (${item.cornerType})</span>
              </div>
              <span style="font-family: var(--font-mono); font-size: 11px; font-weight: bold; color: #FFD700;">+${item.projectedGainSec.toFixed(3)}s POTENTIAL</span>
            </div>
            <div style="font-size: 11px; font-weight: 600; color: #FFA500;">
              Primary Focus: ${item.primaryFaultZone} (Direct Loss: +${item.directTimeLossSec.toFixed(2)}s, Downstream Compound: +${item.downstreamGainSec.toFixed(2)}s)
            </div>
            <div class="coaching-action" style="margin-top: 2px;">
              ${item.tacticalAdvice}
            </div>
          `;
          this.deltaPrioritiesFeed.appendChild(card);
        });
      }
    }
  }

  renderTireDynamics(tireDynamics) {
    if (!tireDynamics) return;

    const tires = tireDynamics.tires || {};
    const balance = tireDynamics.balance || {};
    const isMetric = this.settings.speedUnit === 'kmh';

    const corners = [
      { id: 'fl', data: tires.frontLeft },
      { id: 'fr', data: tires.frontRight },
      { id: 'rl', data: tires.rearLeft },
      { id: 'rr', data: tires.rearRight }
    ];

    corners.forEach((c) => {
      const tempEl = document.getElementById(`tire-temp-${c.id}`);
      const slipEl = document.getElementById(`tire-slip-${c.id}`);
      const badgeEl = document.getElementById(`tire-status-${c.id}`);

      if (tempEl && c.data) {
        if (isMetric) {
          const avgC = c.data.avgTempC != null ? c.data.avgTempC : Math.round(((c.data.avgTempF || 32) - 32) * (5 / 9));
          const peakC = c.data.peakTempC != null ? c.data.peakTempC : Math.round(((c.data.peakTempF || 32) - 32) * (5 / 9));
          tempEl.textContent = `${avgC} / ${peakC} °C`;
        } else {
          tempEl.textContent = `${c.data.avgTempF || 0} / ${c.data.peakTempF || 0} °F`;
        }
      }
      if (slipEl && c.data) {
        slipEl.textContent = (c.data.peakSlipRatio != null ? c.data.peakSlipRatio.toFixed(2) : '--');
        slipEl.style.color = (c.data.peakSlipRatio > 1.0) ? 'var(--color-f1-red)' : 'var(--color-text-primary)';
      }
      if (badgeEl && c.data) {
        const st = c.data.status || 'OPTIMAL';
        badgeEl.textContent = st;
        badgeEl.className = `tire-status-badge status-${st.toLowerCase()}`;
      }
    });

    const balanceBadge = document.getElementById('tire-balance-badge');
    if (balanceBadge) {
      balanceBadge.textContent = balance.thermalBias || 'BALANCED';
      balanceBadge.className = balance.thermalBias === 'BALANCED' ? 'badge badge-accent' : 'badge badge-accent' ;
      balanceBadge.style.color = balance.thermalBias === 'BALANCED' ? 'var(--color-success)' : 'var(--color-warning)';
    }

    const diagBar = document.getElementById('tire-diagnostics-text');
    if (diagBar) {
      if (isMetric) {
        const deltaC = balance.tempDeltaFrontVsRearC != null ? balance.tempDeltaFrontVsRearC : Math.round((balance.tempDeltaFrontVsRearF || 0) * (5 / 9));
        const frontC = balance.frontAvgTempC != null ? balance.frontAvgTempC : Math.round(((balance.frontAvgTempF || 32) - 32) * (5 / 9));
        const rearC = balance.rearAvgTempC != null ? balance.rearAvgTempC : Math.round(((balance.rearAvgTempF || 32) - 32) * (5 / 9));
        const deltaSign = deltaC > 0 ? '+' : '';
        diagBar.innerHTML = `
          <div><strong>Axle Thermal Delta:</strong> ${deltaSign}${deltaC}°C (Front: ${frontC}°C, Rear: ${rearC}°C)</div>
          <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">
            ${balance.thermalBias === 'FRONT_LIMITED' 
              ? 'Front axle running significantly hotter than rear — indicates chronic corner entry understeer / excessive steering lock.' 
              : (balance.thermalBias === 'REAR_LIMITED' 
                ? 'Rear axle running significantly hotter than rear — indicates aggressive power oversteer or wheelspin on exit.' 
                : 'Thermal balance across axles is optimal. Traction circle utilization is evenly distributed.')}
          </div>
        `;
      } else {
        const deltaSign = balance.tempDeltaFrontVsRearF > 0 ? '+' : '';
        diagBar.innerHTML = `
          <div><strong>Axle Thermal Delta:</strong> ${deltaSign}${balance.tempDeltaFrontVsRearF || 0}°F (Front: ${balance.frontAvgTempF || 0}°F, Rear: ${balance.rearAvgTempF || 0}°F)</div>
          <div style="font-size: 10px; color: var(--color-text-secondary); margin-top: 2px;">
            ${balance.thermalBias === 'FRONT_LIMITED' 
              ? 'Front axle running significantly hotter than rear — indicates chronic corner entry understeer / excessive steering lock.' 
              : (balance.thermalBias === 'REAR_LIMITED' 
                ? 'Rear axle running significantly hotter than rear — indicates aggressive power oversteer or wheelspin on exit.' 
                : 'Thermal balance across axles is optimal. Traction circle utilization is evenly distributed.')}
          </div>
        `;
      }
    }
  }

  renderBrakingAnalysis(braking) {
    if (!braking) return;

    const isMetric = this.settings.speedUnit === 'kmh';

    if (this.brakingEfficiencyBadge) {
      this.brakingEfficiencyBadge.textContent = `THRESHOLD: ${braking.avgEfficiencyPercent || 0}%`;
      const effColor = (braking.avgEfficiencyPercent || 0) >= 85 ? 'var(--color-success)' : ((braking.avgEfficiencyPercent || 0) >= 70 ? 'var(--color-warning)' : 'var(--color-f1-red)');
      this.brakingEfficiencyBadge.style.color = effColor;
      this.brakingEfficiencyBadge.style.borderColor = effColor;
    }

    if (this.brakingPeakDecelVal) {
      this.brakingPeakDecelVal.textContent = `${(braking.stintMaxDecelG || 0).toFixed(2)} G`;
    }

    if (this.brakingAvgEfficiencyVal) {
      this.brakingAvgEfficiencyVal.textContent = `${braking.avgEfficiencyPercent || 0}%`;
    }

    if (this.brakingProcedureScoreVal) {
      const procScore = braking.theProcedure?.overallConsistencyScore ?? 0;
      this.brakingProcedureScoreVal.textContent = `${procScore}% (${braking.theProcedure?.rating || 'Consistent'})`;
    }

    if (this.brakingTotalDistanceVal) {
      if (isMetric) {
        const distM = braking.totalBrakingDistanceMeters ?? Math.round((braking.totalBrakingDistanceFeet || 0) * 0.3048);
        this.brakingTotalDistanceVal.textContent = `${distM.toLocaleString()} m`;
      } else {
        this.brakingTotalDistanceVal.textContent = `${(braking.totalBrakingDistanceFeet || 0).toLocaleString()} ft`;
      }
    }

    if (this.brakingTableBody) {
      this.brakingTableBody.innerHTML = '';
      const bzList = braking.brakingZones || [];
      if (bzList.length === 0) {
        this.brakingTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #666;">No braking zone data available</td></tr>`;
      } else {
        bzList.slice(0, 10).forEach(bz => {
          const tr = document.createElement('tr');
          const typeColor = bz.cornerType === 'Type I' ? 'color: var(--color-warning);' : (bz.cornerType === 'Type II' ? 'color: var(--color-f1-red);' : 'color: #0099FF;');
          const effColor = bz.efficiency?.grade === 'A+' || bz.efficiency?.grade === 'A' ? 'var(--color-success)' : (bz.efficiency?.grade === 'B' ? 'var(--color-warning)' : 'var(--color-f1-red)');
          
          const stepMetric = braking.theProcedure?.cornerSteppingMetrics?.find(m => m.cornerNumber === bz.cornerNumber);
          let stepStr = 'Baseline Tracked';
          if (stepMetric) {
            if (isMetric) {
              const devM = stepMetric.stdDevMeters ?? Number((stepMetric.stdDevFeet * 0.3048).toFixed(1));
              stepStr = `±${devM}m (${stepMetric.status})`;
            } else {
              stepStr = `±${stepMetric.stdDevFeet}ft (${stepMetric.status})`;
            }
          }

          const entrySpd = isMetric ? (bz.speed?.entrySpeedKmh ?? (bz.speed?.entrySpeedMph ? bz.speed.entrySpeedMph * 1.60934 : 0)) : (bz.speed?.entrySpeedMph || 0);
          const turnInSpd = isMetric ? (bz.speed?.turnInSpeedKmh ?? (bz.speed?.turnInSpeedMph ? bz.speed.turnInSpeedMph * 1.60934 : 0)) : (bz.speed?.turnInSpeedMph || 0);
          const spdUnit = isMetric ? 'km/h' : 'mph';
          const brakeDist = isMetric ? (bz.distance?.straightLineBrakeMeters ?? (bz.distance?.straightLineBrakeFeet ? bz.distance.straightLineBrakeFeet * 0.3048 : 0)) : (bz.distance?.straightLineBrakeFeet || 0);
          const distUnit = isMetric ? 'm' : 'ft';

          tr.innerHTML = `
            <td><strong>T${bz.cornerNumber}</strong></td>
            <td style="${typeColor} font-weight: bold;">${bz.cornerType}</td>
            <td>${entrySpd.toFixed(1)} ${spdUnit}</td>
            <td>${turnInSpd.toFixed(1)} ${spdUnit}</td>
            <td>${brakeDist.toFixed(1)} ${distUnit}</td>
            <td style="color: #00CCFF; font-family: var(--font-mono); font-weight: bold;">${(bz.gForces?.peakDecelG || 0).toFixed(2)} G</td>
            <td style="color: ${effColor}; font-weight: bold;">${bz.efficiency?.percent || 0}% [${bz.efficiency?.grade || '—'}]</td>
            <td style="font-size: 11px; color: var(--color-text-secondary);">${stepStr}</td>
          `;
          this.brakingTableBody.appendChild(tr);
        });
      }
    }
  }

  renderShiftingAnalysis(shifting) {
    if (!shifting) return;

    const s = shifting.summary || {};
    const p = shifting.usablePowerband || {};

    if (this.shiftingGradeBadge) {
      this.shiftingGradeBadge.textContent = `GRADE ${s.grade || 'A'}: ${s.gradeLabel || 'OPTIMAL POWERTRAIN'}`;
      this.shiftingGradeBadge.style.color = s.gradeColor || 'var(--color-success)';
      this.shiftingGradeBadge.style.borderColor = s.gradeColor || 'var(--color-success)';
    }

    if (this.shiftingPowerbandEffVal) {
      this.shiftingPowerbandEffVal.textContent = `${s.powerbandEfficiency ?? 100}%`;
    }

    if (this.shiftingBlipCompVal) {
      this.shiftingBlipCompVal.textContent = `${s.blipComplianceRate ?? 100}%`;
      this.shiftingBlipCompVal.style.color = (s.blipComplianceRate >= 80) ? 'var(--color-success)' : 'var(--color-warning)';
    }

    if (this.shiftingBrakeStabVal) {
      this.shiftingBrakeStabVal.textContent = `${s.avgBrakeStabilityScore ?? 100}%`;
      this.shiftingBrakeStabVal.style.color = (s.avgBrakeStabilityScore >= 80) ? 'var(--color-success)' : 'var(--color-warning)';
    }

    if (this.shiftingTotalDownshiftsVal) {
      this.shiftingTotalDownshiftsVal.textContent = `${s.totalDownshifts || 0} shifts (${s.blippedDownshiftsCount || 0} blips)`;
    }

    if (this.powerbandRangeText) {
      this.powerbandRangeText.textContent = `Engine Range: ${(p.idleRpm || 1000).toLocaleString()} RPM (Idle) - ${(p.maxRpm || 8000).toLocaleString()} RPM (Redline) | Target Exit Powerband: ${(p.optimalPowerbandMin || 5550).toLocaleString()} - ${(p.optimalPowerbandMax || 7440).toLocaleString()} RPM (65% - 92%)`;
    }

    if (this.powerbandFaultsText) {
      const boggingCount = s.boggingCornersCount || 0;
      const overrevCount = s.overrevCornersCount || 0;
      this.powerbandFaultsText.textContent = `Status: ${boggingCount} Bogging Corner(s) (R-007) | ${overrevCount} Over-Rev Risk Corner(s) (R-008)`;
      this.powerbandFaultsText.style.color = (boggingCount > 0 || overrevCount > 0) ? 'var(--color-f1-red)' : 'var(--color-success)';
    }

    if (this.shiftingTableBody) {
      this.shiftingTableBody.innerHTML = '';
      const cList = shifting.cornerShifting || [];

      if (cList.length === 0) {
        this.shiftingTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #666;">No corner shifting data available</td></tr>`;
      } else {
        cList.slice(0, 10).forEach(cs => {
          const tr = document.createElement('tr');
          const statusColor = cs.isBogging ? 'var(--color-f1-red)' : (cs.isOverrev ? 'var(--color-warning)' : 'var(--color-success)');
          const suggestedDiff = cs.suggestedGear !== cs.gear;

          tr.innerHTML = `
            <td><strong>T${cs.cornerNumber}</strong></td>
            <td>${cs.cornerType}</td>
            <td><strong style="color: var(--color-text-primary);">Gear ${cs.gear}</strong></td>
            <td>${(cs.minRpm || 0).toLocaleString()} RPM</td>
            <td style="color: #00CCFF; font-family: var(--font-mono); font-weight: bold;">${(cs.exitRpm || 0).toLocaleString()} RPM</td>
            <td style="color: ${statusColor}; font-weight: bold;">${cs.exitPowerbandPercent}%</td>
            <td style="${suggestedDiff ? 'color: var(--color-warning); font-weight: bold;' : 'color: var(--color-text-secondary);'}">
              ${suggestedDiff ? `Gear ${cs.suggestedGear} ⚠️` : `Gear ${cs.gear}`}
            </td>
            <td style="color: ${statusColor}; font-weight: bold; font-size: 11px;">${cs.status}</td>
          `;
          this.shiftingTableBody.appendChild(tr);
        });
      }
    }

    if (this.downshiftSummaryText) {
      const dEvents = shifting.downshiftEvents || [];
      if (dEvents.length === 0) {
        this.downshiftSummaryText.innerHTML = `Telemetry recorded smooth continuous gear selection with zero abrupt downshift transitions.`;
      } else {
        const sample = dEvents[0];
        this.downshiftSummaryText.innerHTML = `
          <strong>Logged ${s.totalDownshifts} Downshifts:</strong> Throttle Rev-Match Accuracy: <strong style="color: var(--color-success);">${s.blipComplianceRate}%</strong> | Brake Pedal Stability: <strong style="color: var(--color-primary);">${s.avgBrakeStabilityScore}%</strong>.<br>
          <span style="font-size: 10px; color: var(--color-text-secondary);">Sample Transition (G${sample.fromGear} ➔ G${sample.toGear}): Blip Amplitude ${sample.peakBlipThrottlePercent}%, Pedal Stability: ${sample.brakeStabilityScore}%.</span>
        `;
      }
    }
  }

  processSample(sample) {
    if (!sample) return;

    if (this.isRecording) {
      this.recordedSamples.push(sample);
      if (this.samplesCountVal) {
        this.samplesCountVal.textContent = this.recordedSamples.length.toLocaleString();
      }
    }

    if (sample.timing) {
      let lap = sample.timing.lapNumber !== undefined ? sample.timing.lapNumber : 1;
      if (lap === 0) lap = 1;
      if (lap !== this.currentLap) {
        this.currentLap = lap;
        if (this.lapCounterVal) {
          this.lapCounterVal.textContent = `L${String(lap).padStart(2, '0')}`;
        }
      }

      if (sample.timing.bestLapTime > 0 && sample.timing.bestLapTime !== this.bestLapTime) {
        this.bestLapTime = sample.timing.bestLapTime;
        if (this.bestLapVal) {
          this.bestLapVal.textContent = this.formatLapTime(this.bestLapTime);
        }
      }

      if (sample.timing.lastLapTime > 0 && sample.timing.lastLapTime !== this.lastLapTime) {
        this.lastLapTime = sample.timing.lastLapTime;
        if (this.lastLapVal) {
          this.lastLapVal.textContent = this.formatLapTime(this.lastLapTime);
        }
      }
    }
  }

  formatLapTime(sec) {
    if (!sec || sec <= 0) return '--:--.---';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(3);
    return `${m}:${s.padStart(6, '0')}`;
  }

  updateTimerDisplay() {
    if (!this.timerVal) return;
    const totalMs = this.stintDurationMs;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const tenths = Math.floor((totalMs % 1000) / 100);

    this.timerVal.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  renderPerformanceSummary(summary) {
    if (!summary) return;

    const gradeObj = summary.grade || { grade: 'B+', label: 'Competent — Clear Areas to Improve' };
    const score = summary.overallScore || 78;

    if (this.scoreGradeBadge) {
      this.scoreGradeBadge.textContent = gradeObj.grade;
      let gradeClass = 'grade-b';
      if (gradeObj.grade.startsWith('A')) gradeClass = 'grade-a';
      else if (gradeObj.grade.startsWith('C')) gradeClass = 'grade-c';
      else if (gradeObj.grade.startsWith('D') || gradeObj.grade === 'F') gradeClass = 'grade-d';
      this.scoreGradeBadge.className = `score-grade-badge ${gradeClass}`;
    }

    if (this.scoreHeroLabel) {
      this.scoreHeroLabel.textContent = gradeObj.label;
    }

    if (this.scoreOverallVal) {
      this.scoreOverallVal.textContent = score;
    }

    const comps = summary.components || { consistency: 75, lineQuality: 80, brakingScore: 78, exitSpeedScore: 76 };

    if (this.compConsistencyVal) this.compConsistencyVal.textContent = `${comps.consistency}%`;
    if (this.compConsistencyBar) this.compConsistencyBar.style.width = `${comps.consistency}%`;

    if (this.compLineVal) this.compLineVal.textContent = `${comps.lineQuality}%`;
    if (this.compLineBar) this.compLineBar.style.width = `${comps.lineQuality}%`;

    if (this.compBrakingVal) this.compBrakingVal.textContent = `${comps.brakingScore}%`;
    if (this.compBrakingBar) this.compBrakingBar.style.width = `${comps.brakingScore}%`;

    if (this.compExitVal) this.compExitVal.textContent = `${comps.exitSpeedScore}%`;
    if (this.compExitBar) this.compExitBar.style.width = `${comps.exitSpeedScore}%`;
  }

  renderPriorityRecommendations(recommendations) {
    if (!this.priorityRecsList) return;
    this.priorityRecsList.innerHTML = '';

    const recs = (recommendations || []).slice(0, 3);
    if (recs.length === 0) {
      this.priorityRecsList.innerHTML = `
        <div class="priority-rec-card rank-1">
          <div class="priority-rec-header">
            <div class="priority-rec-title-group">
              <span class="priority-rank-badge priority-rank-1">RANK #1</span>
              <span class="priority-rec-title">Optimal Pace & Consistency Maintained</span>
            </div>
            <span class="priority-gain-badge">+0.00s DELTA</span>
          </div>
          <p class="priority-rec-action">Driving line, throttle modulation, and braking technique are operating at maximum proficiency for current stint conditions.</p>
        </div>
      `;
      return;
    }

    recs.forEach((rec, idx) => {
      const card = document.createElement('div');
      const rankNum = idx + 1;
      card.className = `priority-rec-card rank-${rankNum}`;

      const cornerStr = rec.corner !== undefined && rec.corner !== 'All' ? `Turn ${rec.corner}` : 'General';
      const gainVal = rec.impact != null ? `+${Number(rec.impact).toFixed(2)}s POTENTIAL` : '+0.25s POTENTIAL';

      card.innerHTML = `
        <div class="priority-rec-header">
          <div class="priority-rec-title-group">
            <span class="priority-rank-badge priority-rank-${rankNum}">RANK #${rankNum}</span>
            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-secondary); background: #181818; padding: 2px 6px; border-radius: 2px;">[${rec.category.toUpperCase()}] ${cornerStr}</span>
            <span class="priority-rec-title">${rec.title}</span>
          </div>
          <span class="priority-gain-badge">${gainVal}</span>
        </div>
        ${rec.quote ? `<div class="priority-rec-quote">${rec.quote}</div>` : ''}
        <div class="priority-rec-action"><strong>Coaching Action:</strong> ${rec.action || rec.description}</div>
      `;

      this.priorityRecsList.appendChild(card);
    });
  }

  renderFrictionCircle(frictionCircle) {
    if (!frictionCircle) return;

    // 1. KPI Badges & Metrics
    const util = frictionCircle.utilization?.highUtilization ?? 0;
    if (this.frictionUtilBadge) {
      this.frictionUtilBadge.textContent = `LIMIT UTILIZATION: ${util}%`;
      this.frictionUtilBadge.style.color = util >= 70 ? 'var(--color-success)' : (util >= 50 ? 'var(--color-warning)' : 'var(--color-f1-red)');
    }
    if (this.frictionUtilVal) {
      this.frictionUtilVal.textContent = `${util}%`;
    }
    if (this.frictionPeakGVal) {
      this.frictionPeakGVal.textContent = `${(frictionCircle.maxG || 1.4).toFixed(2)} G`;
    }

    const points = frictionCircle.points || [];
    let maxLat = 0;
    let maxLong = 0;
    points.forEach(p => {
      if (Math.abs(p.latG) > maxLat) maxLat = Math.abs(p.latG);
      if (Math.abs(p.longG) > maxLong) maxLong = Math.abs(p.longG);
    });

    if (this.frictionPeakLatVal) {
      this.frictionPeakLatVal.textContent = `${maxLat.toFixed(2)} G`;
    }
    if (this.frictionPeakLongVal) {
      this.frictionPeakLongVal.textContent = `${maxLong.toFixed(2)} G`;
    }

    // 2. Phase Breakdown List
    if (this.frictionPhaseList && frictionCircle.phaseBreakdown) {
      this.frictionPhaseList.innerHTML = '';
      const phases = [
        { key: 'brake-turn', name: 'Brake-Turn (Trail-Braking)', color: '#E5A910' },
        { key: 'braking', name: 'Straightline Braking', color: '#E10600' },
        { key: 'accelerate-turn', name: 'Accelerate-Turn (Unwinding)', color: '#0099FF' },
        { key: 'accelerating', name: 'Straightline Acceleration', color: '#00CC66' },
        { key: 'cornering', name: 'Pure Lateral Cornering', color: '#9966FF' },
        { key: 'straight', name: 'Straight / Coasting', color: '#555555' }
      ];

      phases.forEach(ph => {
        const pct = frictionCircle.phaseBreakdown[ph.key] ?? 0;
        const div = document.createElement('div');
        div.className = 'friction-phase-item';
        div.innerHTML = `
          <div class="friction-phase-left">
            <span class="friction-phase-dot" style="background: ${ph.color}; box-shadow: 0 0 6px ${ph.color};"></span>
            <span class="friction-phase-name">${ph.name}</span>
          </div>
          <span class="friction-phase-metrics">${pct}%</span>
        `;
        this.frictionPhaseList.appendChild(div);
      });
    }

    // 3. Canvas 2D Scatter Plot Rendering
    if (!this.frictionCanvas) return;
    const ctx = this.frictionCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.frictionCanvas.width;
    const h = this.frictionCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 24;
    const maxG = frictionCircle.maxG || 1.4;

    ctx.clearRect(0, 0, w, h);

    // Background fill
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, w, h);

    // Concentric Reference G-Rings
    const ringSteps = [0.5, 1.0];
    ringSteps.forEach(gVal => {
      if (gVal < maxG) {
        const r = (gVal / maxG) * radius;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#666666';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${gVal.toFixed(1)}G`, cx + 4, cy - r + 11);
      }
    });

    // Outer Boundary Circle at Max G Limit
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(225, 6, 0, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - radius - 6, cy);
    ctx.lineTo(cx + radius + 6, cy);
    ctx.moveTo(cx, cy - radius - 6);
    ctx.lineTo(cx, cy + radius + 6);
    ctx.strokeStyle = '#2A2A2A';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cardinal Labels
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 9px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+ACC', cx, cy - radius - 10);
    ctx.fillText('-BRK', cx, cy + radius + 18);
    ctx.fillText('L', cx - radius - 12, cy + 3);
    ctx.fillText('R', cx + radius + 12, cy + 3);

    // Draw Scatter Points
    const phaseColors = {
      'brake-turn': '#E5A910',
      'braking': '#E10600',
      'accelerate-turn': '#0099FF',
      'accelerating': '#00CC66',
      'cornering': '#9966FF',
      'straight': '#444444'
    };

    const sampledPoints = [];
    const step = Math.max(1, Math.floor(points.length / 500));
    for (let i = 0; i < points.length; i += step) {
      const pt = points[i];
      const px = cx + (pt.latG / maxG) * radius;
      const py = cy - (pt.longG / maxG) * radius; // Invert Long G (+ is up / forward accel)

      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = phaseColors[pt.phase] || '#888888';
      ctx.fill();

      sampledPoints.push({ px, py, ...pt });
    }

    // Attach Interactive Tooltip Hover Handler
    if (!this._frictionListenerAttached && this.frictionTooltip) {
      this._frictionListenerAttached = true;
      this.frictionCanvas.addEventListener('mousemove', (e) => {
        const rect = this.frictionCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (w / rect.width);
        const mouseY = (e.clientY - rect.top) * (h / rect.height);

        let closest = null;
        let minDist = 16;
        for (const pt of sampledPoints) {
          const dist = Math.hypot(pt.px - mouseX, pt.py - mouseY);
          if (dist < minDist) {
            minDist = dist;
            closest = pt;
          }
        }

        if (closest) {
          this.frictionTooltip.style.display = 'block';
          this.frictionTooltip.style.left = `${(closest.px / w) * 100}%`;
          this.frictionTooltip.style.top = `${(closest.py / h) * 100}%`;
          const spd = this.settings.speedUnit === 'kmh'
            ? `${Math.round(closest.speedMph * 1.60934)} km/h`
            : `${Math.round(closest.speedMph)} mph`;
          this.frictionTooltip.innerHTML = `
            <div style="color: ${phaseColors[closest.phase] || '#FFF'}; font-weight: bold; text-transform: uppercase;">${closest.phase}</div>
            <div>Lat: <strong>${closest.latG.toFixed(2)} G</strong> | Long: <strong>${closest.longG.toFixed(2)} G</strong></div>
            <div style="color: #888;">Speed: ${spd}</div>
          `;
        } else {
          this.frictionTooltip.style.display = 'none';
        }
      });

      this.frictionCanvas.addEventListener('mouseleave', () => {
        this.frictionTooltip.style.display = 'none';
      });
    }
  }
}
