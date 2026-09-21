/**
 * APEX Skills Hub View Controller
 * Interactive Going Faster Coaching Academy, Collapsible Sidebar & Stint Evolution Matrix
 * Supports Chapter 1 (A Plan of Attack) and Chapter 2 (The Three Basics: Line, Exit Speed, Braking)
 */

import { GOING_FASTER_CHAPTERS, getChapter, getSkill } from './skills-curriculum.js';
import { skillsStore } from './skills-store.js';
import { SkillsEvaluator } from './analysis/going-faster/skills-evaluator.js';
import { getIcon } from './icons.js';

export class SkillsView {
  constructor(containerId = 'view-skills') {
    this.container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
    this.activeSubtab = 'clinic'; // 'clinic' | 'history'
    this.selectedChapterNumber = 1;
    this.selectedSkillId = 'ch1-exit-speed';
    this.selectedStintId = 'ALL';
    this.filterCorner = 'ALL';
    this.filterSkill = 'ALL';
    this.filterGrade = 'ALL';
    this.latestAttempt = null;
    this.selectedAttemptForInspect = null;
    this.compareMode = false;
    this.selectedCompareIds = new Set();

    // Collapsible Sidebar state (persisted in localStorage)
    let savedSidebar = null;
    if (typeof localStorage !== 'undefined') {
      savedSidebar = localStorage.getItem('apex_skills_sidebar_collapsed');
    }
    this.sidebarCollapsed = savedSidebar !== null
      ? savedSidebar === 'true'
      : (typeof window !== 'undefined' ? window.innerWidth < 1200 : false);

    // Live Telemetry & Recording State
    this.isRecording = false;
    this.liveSample = null;
    this.liveStintInfo = {
      sampleCount: 0,
      currentLap: 1,
      durationMs: 0,
      bestLapTime: null,
      sessionName: '',
      driverName: ''
    };
    this.liveCornerBuffer = [];
    this.isCornering = false;
    this.liveCornerCount = 0;
    this.cornerEvaluationToast = null;
    this.liveFpsTracker = { count: 0, lastTime: Date.now(), rate: 60 };
    this._liveUpdateRequested = false;

    // Subscribe to store updates
    skillsStore.subscribe(() => {
      if (this.isVisible()) {
        this.render();
      }
    });

    this.bindGlobalShortcuts();
  }

  init() {
    if (!this.container) return;
    this.render();
  }

  isVisible() {
    return this.container && this.container.style.display !== 'none';
  }

  /**
   * Called when recording starts, stops, or resets
   * @param {boolean} isRecording 
   */
  onRecordingStateChange(isRecording) {
    const prev = this.isRecording;
    this.isRecording = Boolean(isRecording);
    if (!this.isRecording) {
      this.liveCornerBuffer = [];
      this.isCornering = false;
    }
    if (this.isVisible()) {
      if (prev !== this.isRecording) {
        this.render();
      } else {
        this._updateLiveDOM(this.liveSample || {});
      }
    }
  }

  /**
   * Continuous 60Hz live telemetry ingestion from wsClient / SessionManager
   * @param {Object} sample Telemetry frame
   * @param {boolean} isRecording Whether active stint recording is in progress
   * @param {Object} stintInfo Current stint counters
   */
  onLiveTelemetry(sample, isRecording, stintInfo = {}) {
    if (!sample) return;
    this.liveSample = sample;
    this.isRecording = Boolean(isRecording);
    this.liveStintInfo = { ...this.liveStintInfo, ...stintInfo };

    // Rate tracker
    this.liveFpsTracker.count++;
    const now = Date.now();
    if (now - this.liveFpsTracker.lastTime >= 1000) {
      this.liveFpsTracker.rate = this.liveFpsTracker.count;
      this.liveFpsTracker.count = 0;
      this.liveFpsTracker.lastTime = now;
    }

    // Process real-time corner physics & detection
    this._processLiveCornerDetection(sample, isRecording, stintInfo);

    // High-performance direct DOM updates when visible
    if (this.isVisible() && !this._liveUpdateRequested) {
      this._liveUpdateRequested = true;
      const raf = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
        ? window.requestAnimationFrame
        : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => cb());
      raf(() => {
        this._liveUpdateRequested = false;
        this._updateLiveDOM(sample);
      });
    }
  }

  /**
   * Real-time kinematic corner detector & live physics scoring
   */
  _processLiveCornerDetection(sample, isRecording, stintInfo) {
    const latG = Math.abs(sample.motion?.acceleration?.lateralG ?? sample.physics?.lateralG ?? 0);
    const steer = Math.abs(sample.inputs?.steering ?? sample.steer ?? sample.steering ?? 0);
    const brake = sample.inputs?.brake ?? sample.brake ?? 0;
    const yawRate = Math.abs(sample.motion?.angularVelocity?.yaw ?? 0);

    const inCorner = (latG > 0.40 || steer > 0.08 || (brake > 0.25 && (yawRate > 0.12 || latG > 0.25)));

    if (inCorner) {
      if (!this.isCornering) {
        this.isCornering = true;
      }
      this.liveCornerBuffer.push(sample);
      if (this.liveCornerBuffer.length > 600) {
        this.liveCornerBuffer.shift();
      }
    } else {
      if (this.isCornering) {
        this.isCornering = false;
        if (this.liveCornerBuffer.length >= 18) {
          this.liveCornerCount++;
          const turnNum = ((this.liveCornerCount - 1) % 16) + 1;
          const cornerId = `T${turnNum}`;
          const evalResult = SkillsEvaluator.evaluateCorner(this.liveCornerBuffer, {
            chapterNumber: this.selectedChapterNumber,
            cornerId: cornerId,
            cornerName: `Turn ${turnNum}`,
            trackName: stintInfo?.sessionName || 'Live Stint Circuit',
            carName: 'Active Vehicle',
            lapNumber: stintInfo?.currentLap || 1
          });

          if (isRecording) {
            const recorded = skillsStore.recordAttempt(evalResult, {
              stintId: stintInfo?.stintId || `live_stint_${stintInfo?.sessionName || 'session'}_${stintInfo?.driverName || 'driver'}`,
              sessionName: stintInfo?.sessionName || 'Live Stint Recording',
              trackName: stintInfo?.sessionName || stintInfo?.trackName || 'Live Stint Circuit',
              carName: stintInfo?.carName || 'Active Vehicle',
              lapNumber: stintInfo?.currentLap || 1
            });
            this.latestAttempt = recorded;
          } else {
            this.latestAttempt = {
              ...evalResult,
              trackName: stintInfo?.sessionName || 'Live Telemetry',
              lapNumber: stintInfo?.currentLap || 1,
              cornerName: `Turn ${turnNum}`
            };
          }

          // Trigger live evaluation toast notification
          this.cornerEvaluationToast = {
            title: `Turn ${turnNum} Evaluated Live`,
            grade: evalResult.grade || 'B',
            score: evalResult.overallScore || 75,
            message: evalResult.summary || 'Live kinematic corner slice processed.',
            timestamp: Date.now()
          };

          // Auto-dismiss toast after 6 seconds
          setTimeout(() => {
            if (this.cornerEvaluationToast && Date.now() - this.cornerEvaluationToast.timestamp >= 5500) {
              this.cornerEvaluationToast = null;
              if (this.isVisible()) this.render();
            }
          }, 6000);

          if (this.isVisible()) {
            this.render();
          }
        }
        this.liveCornerBuffer = [];
      }
    }
  }

  /**
   * Direct high-speed DOM updates for real-time telemetry gauges and status capsules
   */
  _updateLiveDOM(sample) {
    if (!this.container) return;

    // 1. Top Subtabs Capsule elements
    const recBadge = document.getElementById('skills-live-rec-badge');
    const lapEl = document.getElementById('skills-live-lap-counter');
    const timerEl = document.getElementById('skills-live-timer-val');
    const samplesEl = document.getElementById('skills-live-samples-count');
    const rateEl = document.getElementById('skills-live-rate-badge');
    const capsuleEl = document.getElementById('skills-live-capsule');

    if (capsuleEl) {
      capsuleEl.className = `skills-live-recording-capsule ${this.isRecording ? 'recording' : (this.liveSample ? 'live' : 'standby')}`;
    }
    if (recBadge) {
      recBadge.textContent = this.isRecording ? 'REC // STINT IN PROGRESS' : (this.liveSample ? 'LIVE TELEMETRY' : 'STANDBY');
    }
    if (lapEl) {
      lapEl.textContent = `LAP ${String(this.liveStintInfo?.currentLap || 1).padStart(2, '0')}`;
    }
    if (timerEl) {
      timerEl.textContent = this.formatDuration(this.liveStintInfo?.durationMs || 0);
    }
    if (samplesEl) {
      samplesEl.textContent = `${(this.liveStintInfo?.sampleCount || 0).toLocaleString()} PKTS`;
    }
    if (rateEl) {
      rateEl.textContent = `${this.liveFpsTracker.rate || 60}Hz`;
    }

    // 2. Sidebar Live Stint element
    const sidebarLiveSamples = document.getElementById('skills-sidebar-live-samples');
    if (sidebarLiveSamples) {
      sidebarLiveSamples.textContent = `${(this.liveStintInfo?.sampleCount || 0).toLocaleString()} samples streaming`;
    }

    // 3. Live Clinic Telemetry HUD elements
    const hudBuf = document.getElementById('skills-live-hud-buf');
    const hudRate = document.getElementById('skills-live-hud-rate');
    const speedVal = document.getElementById('skills-live-speed-val');
    const gearBadge = document.getElementById('skills-live-gear-badge');
    const thrVal = document.getElementById('skills-live-thr-val');
    const brkVal = document.getElementById('skills-live-brk-val');
    const thrBar = document.getElementById('skills-live-thr-bar');
    const brkBar = document.getElementById('skills-live-brk-bar');
    const steerVal = document.getElementById('skills-live-steer-val');
    const steerIndicator = document.getElementById('skills-live-steer-indicator');
    const phasePill = document.getElementById('skills-live-phase-pill');
    const cornerBufState = document.getElementById('skills-live-corner-buf-state');

    const thrPct = Math.round((sample.inputs?.throttle ?? sample.throttle ?? 0) * 100);
    const brkPct = Math.round((sample.inputs?.brake ?? sample.brake ?? 0) * 100);
    const steerRaw = (sample.inputs?.steering ?? sample.steer ?? sample.steering ?? 0);
    const steerDeg = (steerRaw * 45).toFixed(1);
    const latG = (sample.motion?.acceleration?.lateralG ?? sample.physics?.lateralG ?? 0);
    const spdKmh = Math.round(sample.speedKmh ?? (sample.motion?.speedMs ? sample.motion.speedMs * 3.6 : (sample.speedMph ? sample.speedMph * 1.60934 : 0)));
    const gear = sample.inputs?.gear ?? sample.gear ?? 0;

    if (hudBuf) hudBuf.textContent = String(this.liveCornerBuffer.length);
    if (hudRate) hudRate.textContent = String(this.liveFpsTracker.rate || 60);
    if (speedVal) speedVal.textContent = String(spdKmh);
    if (gearBadge) gearBadge.textContent = gear === 0 ? 'R' : (gear === -1 ? 'N' : `G${gear}`);
    if (thrVal) thrVal.textContent = `THR ${thrPct}%`;
    if (brkVal) brkVal.textContent = `BRK ${brkPct}%`;
    if (thrBar) thrBar.style.width = `${thrPct}%`;
    if (brkBar) brkBar.style.width = `${brkPct}%`;
    if (steerVal) steerVal.textContent = `${steerDeg}° · ${latG.toFixed(2)}G`;
    if (steerIndicator) steerIndicator.style.transform = `translateX(${Math.max(-48, Math.min(48, steerRaw * 48))}px)`;

    if (cornerBufState) {
      cornerBufState.textContent = this.isCornering ? `CORNER DETECTED (${this.liveCornerBuffer.length}f)` : 'TRACK STRAIGHT';
      cornerBufState.style.color = this.isCornering ? '#00FF88' : '#8899A6';
    }

    if (phasePill) {
      const phaseInfo = this._getLiveCornerPhase(sample);
      phasePill.textContent = phaseInfo.name;
      phasePill.className = `live-phase-pill ${phaseInfo.className}`;
      phasePill.style.borderColor = phaseInfo.color;
      phasePill.style.color = phaseInfo.color;
    }
  }

  formatDuration(ms) {
    if (!ms || ms <= 0) return '00:00.0';
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`;
  }

  _getLiveCornerPhase(sample) {
    const latG = Math.abs(sample.motion?.acceleration?.lateralG ?? sample.physics?.lateralG ?? 0);
    const brake = sample.inputs?.brake ?? sample.brake ?? 0;
    const throttle = sample.inputs?.throttle ?? sample.throttle ?? 0;

    if (brake > 0.4 && latG < 0.35) {
      return { name: 'ZONE 1: THRESHOLD BRAKING', className: 'braking', color: '#FF3366' };
    }
    if (brake > 0.1 && latG >= 0.3) {
      return { name: 'ZONE 2: TRAIL-BRAKING / APEX', className: 'trail', color: '#FFB800' };
    }
    if (latG >= 0.4 && brake <= 0.1 && throttle < 0.5) {
      return { name: 'ZONE 2: PURE LATERAL APEX', className: 'apex', color: '#00E5FF' };
    }
    if (latG >= 0.25 && throttle >= 0.5) {
      return { name: 'ZONE 3: THROTTLE UNWIND / EXIT', className: 'exit', color: '#00FF88' };
    }
    if (throttle >= 0.75 && latG < 0.25) {
      return { name: 'STRAIGHTAWAY (FULL THROTTLE)', className: 'straight', color: '#00FF88' };
    }
    return { name: 'TRANSITION / COASTING', className: 'coasting', color: '#8899A6' };
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('apex_skills_sidebar_collapsed', String(this.sidebarCollapsed));
    }
    const sidebarEl = this.container?.querySelector('.skills-sidebar');
    if (sidebarEl) {
      if (this.sidebarCollapsed) sidebarEl.classList.add('collapsed');
      else sidebarEl.classList.remove('collapsed');
    }
  }

  setSubtab(tabName) {
    this.activeSubtab = tabName;
    this.render();
  }

  bindGlobalShortcuts() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (!this.isVisible()) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        this.toggleSidebar();
      }
    });
  }

  /**
   * Process a corner slice from active telemetry or session manager
   */
  processCornerSlice(cornerSamples, metadata = {}) {
    const evaluation = SkillsEvaluator.evaluateCorner(cornerSamples, {
      ...metadata,
      chapterNumber: this.selectedChapterNumber
    });
    const recorded = skillsStore.recordAttempt(evaluation, metadata);
    this.latestAttempt = recorded;

    if (this.isVisible()) {
      this.render();
    }
  }

  render() {
    if (!this.container) return;

    // Save scroll positions before DOM update
    const prevViewport = this.container.querySelector('.skills-subtab-viewport');
    const viewportScrollTop = prevViewport ? prevViewport.scrollTop : 0;
    const prevSidebar = this.container.querySelector('.skills-sidebar-body');
    const sidebarScrollTop = prevSidebar ? prevSidebar.scrollTop : 0;

    const chapter = getChapter(this.selectedChapterNumber);
    const masteryStats = skillsStore.getMasteryStats(this.selectedChapterNumber, { stintId: this.selectedStintId });
    const stintsList = skillsStore.getStintsList();
    const habitInsights = skillsStore.getHabitDiagnostics(this.selectedChapterNumber, { stintId: this.selectedStintId });

    const attempts = skillsStore.getAttempts({
      stintId: this.selectedStintId,
      cornerId: this.filterCorner,
      skillId: this.filterSkill,
      grade: this.filterGrade,
      limit: 50
    });

    const activeAttempt = this.latestAttempt || attempts[0] || null;
    const inspectedAttempt = this.selectedAttemptForInspect || activeAttempt;

    this.container.innerHTML = `
      <div class="skills-layout-wrapper">
        
        <!-- LEFT COLLAPSIBLE SIDEBAR -->
        <aside class="skills-sidebar ${this.sidebarCollapsed ? 'collapsed' : ''}">
          <div class="skills-sidebar-header">
            <div class="skills-sidebar-title-group">
              <span style="color: #00ff88; font-size: 14px;">${getIcon('zap', { size: 14, color: '#00ff88' })}</span>
              <span class="skills-sidebar-title">SKILLS ACADEMY</span>
            </div>
            <button id="btn-toggle-skills-sidebar" class="btn-sidebar-toggle" title="Toggle Sidebar (B)">
              <span>${this.sidebarCollapsed ? '▶' : '◀'}</span>
            </button>
          </div>

          <div class="skills-sidebar-body">
            <!-- Section 1: Going Faster Chapters -->
            <div class="skills-sidebar-section-title">Curriculum Chapters</div>
            <div class="skills-chapter-list">
              ${GOING_FASTER_CHAPTERS.map(ch => {
                const isSelected = this.selectedChapterNumber === ch.chapterNumber;
                return `
                  <button class="skills-chapter-btn ${isSelected ? 'active' : ''}" data-chapter="${ch.chapterNumber}" title="${ch.title}">
                    <span class="skills-sidebar-icon">${getIcon(ch.icon, { size: 14 })}</span>
                    <div class="skills-sidebar-item-info">
                      <span class="skills-sidebar-item-name">${ch.shortTitle}</span>
                      <span class="skills-sidebar-item-sub">${ch.status === 'active' ? `ACTIVE // ${ch.skills.length} SKILLS` : 'COMING SOON'}</span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Section 2: Recorded Stints / Sessions -->
            <div class="skills-sidebar-section-title" style="margin-top: 10px;">Recorded Stints</div>
            <div class="skills-stint-list">
              ${this.isRecording ? `
                <div id="skills-sidebar-live-stint-pill" class="skills-sidebar-live-stint active" title="Active Stint Recording">
                  <span class="live-rec-dot"></span>
                  <div class="skills-sidebar-item-info">
                    <span class="skills-sidebar-item-name" style="color: #FF1744;">RECORDING STINT</span>
                    <span class="skills-sidebar-item-sub" id="skills-sidebar-live-samples">${(this.liveStintInfo?.sampleCount || 0).toLocaleString()} samples streaming</span>
                  </div>
                </div>
              ` : ''}
              <button class="skills-stint-btn ${this.selectedStintId === 'ALL' ? 'active' : ''}" data-stint="ALL">
                <span class="skills-sidebar-icon">${getIcon('flag', { size: 14 })}</span>
                <div class="skills-sidebar-item-info">
                  <span class="skills-sidebar-item-name">All Stints & Laps</span>
                  <span class="skills-sidebar-item-sub">${masteryStats.totalAttempts} total attempts</span>
                </div>
              </button>
              ${stintsList.map(st => {
                const isSelected = this.selectedStintId === st.stintId;
                return `
                  <button class="skills-stint-btn ${isSelected ? 'active' : ''}" data-stint="${st.stintId}" title="${st.sessionName || st.trackName}">
                    <span class="skills-sidebar-icon">${getIcon('gauge', { size: 14 })}</span>
                    <div class="skills-sidebar-item-info">
                      <span class="skills-sidebar-item-name">${st.sessionName || st.trackName}</span>
                      <span class="skills-sidebar-item-sub">${st.attemptsCount} attempts · Avg ${st.avgScore}%</span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </aside>

        <!-- MAIN CONTENT AREA -->
        <main class="skills-main-area">
          
          <!-- TOP SUBTABS BAR -->
          <nav class="skills-subtabs-bar">
            <div class="skills-subtabs-group">
              <button class="skills-subtab-btn ${this.activeSubtab === 'clinic' ? 'active' : ''}" data-subtab="clinic">
                <span>${getIcon('target', { size: 14 })}</span>
                <span>Coaching & Playbook</span>
              </button>
              <button class="skills-subtab-btn ${this.activeSubtab === 'history' ? 'active' : ''}" data-subtab="history">
                <span>${getIcon('trend-up', { size: 14 })}</span>
                <span>Attempt History & Matrix</span>
                <span class="skills-subtab-badge">${attempts.length}</span>
              </button>
            </div>

            <!-- LIVE RECORDING & TELEMETRY CAPSULE -->
            ${this._renderLiveStatusCapsule()}

            <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; font-family: var(--font-mono);">
              <span style="color: #64748B;">CURRICULUM:</span>
              <strong style="color: #00e5ff;">Chapter ${chapter.chapterNumber}</strong>
              <span style="color: #64748B; margin-left: 8px;">DRIVER:</span>
              <strong style="color: #00ff88;">#01 APEX Driver</strong>
            </div>
          </nav>

          <!-- SUBTAB 1: COACHING & PLAYBOOK -->
          ${this.activeSubtab === 'clinic' ? this._renderClinicSubtab(chapter, masteryStats, habitInsights, activeAttempt) : ''}

          <!-- SUBTAB 2: ATTEMPT HISTORY & MATRIX -->
          ${this.activeSubtab === 'history' ? this._renderHistorySubtab(attempts, inspectedAttempt, masteryStats) : ''}

        </main>
      </div>
    `;

    // Restore scroll positions immediately after DOM replacement
    const newViewport = this.container.querySelector('.skills-subtab-viewport');
    if (newViewport && viewportScrollTop > 0) {
      newViewport.scrollTop = viewportScrollTop;
    }
    const newSidebar = this.container.querySelector('.skills-sidebar-body');
    if (newSidebar && sidebarScrollTop > 0) {
      newSidebar.scrollTop = sidebarScrollTop;
    }

    this.bindDOMEvents();
    if (this.activeSubtab === 'history') {
      this._renderProgressionCanvas(attempts);
    }
  }

  _renderClinicSubtab(chapter, masteryStats, habitInsights, activeAttempt) {
    return `
      <div class="skills-subtab-viewport">
        <!-- TOP HERO & CHAPTER HEADER -->
        <section class="skills-hero-card">
          <div class="skills-hero-top">
            <div class="skills-hero-titles">
              <div class="skills-hero-badge">
                <span>${getIcon('zap', { size: 12, color: '#00ff88' })}</span> GOING FASTER! COACHING HUB // ${chapter.title.toUpperCase()}
              </div>
              <h1 class="skills-hero-title">${chapter.subtitle}</h1>
              <p class="skills-hero-subtitle">${chapter.description}</p>
            </div>

            <div class="skills-hero-stats-panel">
              <div class="skills-stat-box">
                <span class="skills-stat-val ${this._getGradeClass(masteryStats.grade)}">${masteryStats.overallMasteryScore}%</span>
                <span class="skills-stat-lbl">Mastery Index (Ch ${chapter.chapterNumber})</span>
              </div>
              <div class="skills-stat-box">
                <span class="skills-stat-val ${this._getGradeClass(masteryStats.grade)}">${masteryStats.grade}</span>
                <span class="skills-stat-lbl">Driver Grade</span>
              </div>
              <div class="skills-stat-box">
                <span class="skills-stat-val" style="color: #00e5ff;">${masteryStats.totalAttempts}</span>
                <span class="skills-stat-lbl">Attempts Logged</span>
              </div>
            </div>
          </div>

          <div class="skills-hero-quote">
            ${chapter.quote}
          </div>
        </section>

        <!-- MAIN 2-COLUMN GRID: PLAYBOOK & LIVE CLINIC -->
        <div class="skills-grid-layout">
          
          <!-- LEFT: CHAPTER SKILLS PLAYBOOK -->
          <section class="skills-card">
            <div class="skills-card-header">
              <h2 class="skills-card-title">
                <span>${getIcon('book', { size: 14 })}</span> Chapter ${chapter.chapterNumber} Skills Playbook
              </h2>
              <span style="font-family: var(--font-mono); font-size: 11px; color: #8899A6;">${chapter.skills.length} Core Telemetry Pillars</span>
            </div>

            <div class="skills-playbook-list">
              ${chapter.skills.map(sk => {
                const stat = masteryStats.skills[sk.id] || { currentScore: 0, bestScore: 0, trend: 'neutral' };
                const isActive = this.selectedSkillId === sk.id;
                const trendIcon = stat.trend === 'improving' ? '▲' : (stat.trend === 'declining' ? '▼' : '▬');
                const trendColor = stat.trend === 'improving' ? '#00ff88' : (stat.trend === 'declining' ? '#ff3366' : '#8899A6');

                return `
                  <div class="skill-playbook-item ${isActive ? 'active' : ''}" data-skill-id="${sk.id}" style="border-left-color: ${sk.color};">
                    <div class="skill-item-header">
                      <div class="skill-item-name">
                        <span>${getIcon(sk.icon, { size: 14, color: sk.color })}</span>
                        <span>${sk.name}</span>
                      </div>
                      <span class="skill-priority-tag" style="background: ${sk.color}22; color: ${sk.color}; border: 1px solid ${sk.color}44;">
                        ${sk.priority}
                      </span>
                    </div>

                    <p class="skill-concept-desc">${sk.concept}</p>

                    <div class="skill-metrics-row">
                      <span style="color: #64748B;">Target: <strong style="color: #CBD5E1;">${sk.targetThreshold}</strong></span>
                      <span>
                        Score: <strong style="color: ${sk.color}; font-size: 14px;">${stat.currentScore}%</strong>
                        <span style="color: ${trendColor}; margin-left: 4px;" title="Trend">${trendIcon}</span>
                      </span>
                    </div>

                    <div class="skill-score-bar-bg">
                      <div class="skill-score-bar-fill" style="width: ${stat.currentScore}%; background: ${sk.color}; box-shadow: 0 0 8px ${sk.color}88;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <!-- RIGHT: LIVE CORNER CLINIC & HABIT DIAGNOSTICS -->
          <section class="skills-card">
            <div class="skills-card-header">
              <h2 class="skills-card-title">
                <span>${getIcon('target', { size: 14 })}</span> Live Corner Clinic & Diagnostics
              </h2>
              <span style="font-family: var(--font-mono); font-size: 11px; color: ${this.isRecording ? '#FF1744' : '#00ff88'};">
                ${this.isRecording ? 'LIVE STINT RECORDING' : 'REAL-TIME PHYSICS SCORING'}
              </span>
            </div>

            <div class="live-clinic-box">
              <!-- LIVE TELEMETRY & PHYSICS STREAM HUD -->
              ${this._renderLiveHudCard()}

              ${activeAttempt ? `
                <div class="clinic-corner-hero">
                  <div class="clinic-corner-info">
                    <span style="font-size: 10px; font-family: var(--font-mono); color: #8899A6; text-transform: uppercase;">
                      ${activeAttempt.trackName} · Lap ${activeAttempt.lapNumber}
                    </span>
                    <div class="clinic-corner-name">${activeAttempt.cornerName}</div>
                    <div class="clinic-corner-type">${activeAttempt.cornerType}</div>
                  </div>

                  <div class="grade-badge-lg ${this._getGradeClass(activeAttempt.grade)}">
                    ${activeAttempt.grade}
                  </div>
                </div>

                <!-- Subskill breakdown for active chapter -->
                <div class="clinic-skill-breakdown">
                  ${chapter.skills.map(skDef => {
                    const skData = activeAttempt.skills?.[skDef.id];
                    if (!skData) return '';

                    return `
                      <div class="clinic-subskill-item">
                        <div class="clinic-subskill-top">
                          <span>${skDef.name}</span>
                          <span class="score-chip ${this._getGradeClass(skData.grade)}">${skData.score} (${skData.grade})</span>
                        </div>
                        <div class="clinic-subskill-feedback">${skData.feedback}</div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Chapter 2 Specialized Visualizers -->
                ${chapter.chapterNumber === 2 ? this._renderChapter2Diagnostics(activeAttempt) : ''}

              ` : `
                <div style="padding: 30px; text-align: center; color: #64748B; font-size: 13px;">
                  No telemetry corner attempt recorded yet. Run laps in Live Telemetry or load a session to evaluate.
                </div>
              `}

              <!-- Habit Evolution & Diagnostics Box -->
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                <span style="font-size: 11px; font-family: var(--font-mono); color: #8899A6; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
                  ${getIcon('target', { size: 12, color: '#8899A6' })} Habit Evolution & Adaptive Coach Insights
                </span>
                ${habitInsights.map(h => {
                  const iconName = h.type === 'danger' ? 'alert' : (h.type === 'warning' ? 'zap' : 'check-circle');
                  const iconColor = h.type === 'danger' ? '#ff3366' : (h.type === 'warning' ? '#ffb800' : '#00ff88');
                  return `
                    <div class="habit-alert-card ${h.type || 'positive'}">
                      <span style="display: flex; align-items: center;">${getIcon(iconName, { size: 14, color: iconColor })}</span>
                      <div>
                        ${h.title ? `<strong>${h.title}: </strong>` : ''}
                        ${h.message}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </section>

        </div>
      </div>
    `;
  }

  _renderLiveStatusCapsule() {
    const isRec = this.isRecording;
    const isLive = Boolean(this.liveSample);
    const capsuleClass = isRec ? 'recording' : (isLive ? 'live' : 'standby');
    const label = isRec ? 'REC // STINT IN PROGRESS' : (isLive ? 'LIVE TELEMETRY' : 'STANDBY');
    const lapStr = `LAP ${String(this.liveStintInfo?.currentLap || 1).padStart(2, '0')}`;
    const timerStr = this.formatDuration(this.liveStintInfo?.durationMs || 0);
    const pktsStr = `${(this.liveStintInfo?.sampleCount || 0).toLocaleString()} PKTS`;
    const rateStr = `${this.liveFpsTracker.rate || 60}Hz`;

    return `
      <div id="skills-live-capsule" class="skills-live-recording-capsule ${capsuleClass}">
        <span class="capsule-pulse-dot"></span>
        <span id="skills-live-rec-badge" class="capsule-rec-label">${label}</span>
        <span class="capsule-divider">|</span>
        <span class="capsule-stint-stats">
          <span id="skills-live-lap-counter">${lapStr}</span> · 
          <span id="skills-live-timer-val">${timerStr}</span> · 
          <span id="skills-live-samples-count">${pktsStr}</span> · 
          <span id="skills-live-rate-badge">${rateStr}</span>
        </span>
      </div>
    `;
  }

  _renderLiveHudCard() {
    const sample = this.liveSample || {};
    const thrPct = Math.round((sample.inputs?.throttle ?? sample.throttle ?? 0) * 100);
    const brkPct = Math.round((sample.inputs?.brake ?? sample.brake ?? 0) * 100);
    const steerRaw = (sample.inputs?.steering ?? sample.steer ?? sample.steering ?? 0);
    const steerDeg = (steerRaw * 45).toFixed(1);
    const latG = (sample.motion?.acceleration?.lateralG ?? sample.physics?.lateralG ?? 0);
    const spdKmh = Math.round(sample.speedKmh ?? (sample.motion?.speedMs ? sample.motion.speedMs * 3.6 : (sample.speedMph ? sample.speedMph * 1.60934 : 0)));
    const gear = sample.inputs?.gear ?? sample.gear ?? 0;
    const gearStr = gear === 0 ? 'R' : (gear === -1 ? 'N' : `G${gear}`);
    const phaseInfo = this._getLiveCornerPhase(sample);

    const modeClass = this.isRecording ? 'recording-mode' : (this.liveSample ? 'live-mode' : 'standby-mode');

    return `
      <div class="skills-live-hud-card ${modeClass}">
        <div class="skills-live-hud-header">
          <div class="skills-live-hud-badge-group">
            <span class="live-status-dot ${this.isRecording ? 'pulse-red' : (this.liveSample ? 'pulse-green' : 'dim-white')}"></span>
            <span class="skills-live-hud-title">
              ${this.isRecording ? 'LIVE STINT IN PROGRESS // 60HZ TELEMETRY INGESTION' : (this.liveSample ? 'LIVE TELEMETRY STREAM ACTIVE // READY TO RECORD' : 'TELEMETRY STANDBY // AWAITING FORZA LINK')}
            </span>
          </div>
          <div class="skills-live-hud-meta">
            <span class="skills-live-hud-stat">BUFFER: <strong id="skills-live-hud-buf">${this.liveCornerBuffer.length}</strong> FRAMES</span>
            <span class="skills-live-hud-stat">STREAM: <strong id="skills-live-hud-rate">${this.liveFpsTracker.rate || 60}</strong> HZ</span>
          </div>
        </div>

        <!-- Real-Time Metrics & Physics Gauges Grid -->
        <div class="skills-live-gauges-grid">
          <!-- 1. Velocity & Gear -->
          <div class="skills-live-gauge-box">
            <div class="live-gauge-header">
              <span class="live-gauge-label">SPEED & GEAR</span>
              <span class="live-gear-badge" id="skills-live-gear-badge">${gearStr}</span>
            </div>
            <div class="live-speed-val-group">
              <span class="live-speed-number" id="skills-live-speed-val">${spdKmh}</span>
              <span class="live-speed-unit">KM/H</span>
            </div>
          </div>

          <!-- 2. Dual Pedal Telemetry (Throttle & Brake) -->
          <div class="skills-live-gauge-box pedal-box">
            <div class="live-gauge-header">
              <span class="live-gauge-label">PEDAL MODULATION</span>
              <span class="live-pedal-numeric">
                <span style="color: #00FF88;" id="skills-live-thr-val">THR ${thrPct}%</span> · 
                <span style="color: #FF3366;" id="skills-live-brk-val">BRK ${brkPct}%</span>
              </span>
            </div>
            <div class="live-pedal-bars-wrapper">
              <div class="live-pedal-bar-row">
                <span class="live-bar-icon" style="color: #00FF88;">T</span>
                <div class="live-bar-track">
                  <div id="skills-live-thr-bar" class="live-bar-fill throttle" style="width: ${thrPct}%;"></div>
                </div>
              </div>
              <div class="live-pedal-bar-row">
                <span class="live-bar-icon" style="color: #FF3366;">B</span>
                <div class="live-bar-track">
                  <div id="skills-live-brk-bar" class="live-bar-fill brake" style="width: ${brkPct}%;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Steering & Lateral Dynamics -->
          <div class="skills-live-gauge-box steer-box">
            <div class="live-gauge-header">
              <span class="live-gauge-label">STEER & LATERAL G</span>
              <span class="live-steer-numeric" id="skills-live-steer-val">${steerDeg}° · ${latG.toFixed(2)}G</span>
            </div>
            <div class="live-steer-track-wrapper">
              <div class="live-steer-center-mark"></div>
              <div id="skills-live-steer-indicator" class="live-steer-indicator" style="transform: translateX(${Math.max(-48, Math.min(48, steerRaw * 48))}px);"></div>
            </div>
          </div>

          <!-- 4. Corner Kinematic Phase Radar -->
          <div class="skills-live-gauge-box phase-box">
            <div class="live-gauge-header">
              <span class="live-gauge-label">CORNER PHASE</span>
              <span class="live-corner-buf-indicator" id="skills-live-corner-buf-state" style="color: ${this.isCornering ? '#00FF88' : '#8899A6'};">
                ${this.isCornering ? `CORNER DETECTED (${this.liveCornerBuffer.length}f)` : 'TRACK STRAIGHT'}
              </span>
            </div>
            <div class="live-phase-display" id="skills-live-phase-display">
              <span class="live-phase-pill ${phaseInfo.className}" id="skills-live-phase-pill" style="border-color: ${phaseInfo.color}; color: ${phaseInfo.color};">
                ${phaseInfo.name}
              </span>
            </div>
          </div>
        </div>

        ${this.cornerEvaluationToast ? `
          <div class="skills-live-corner-toast chamfer-all-corners">
            <span class="toast-icon">✨</span>
            <div class="toast-content">
              <span class="toast-title">${this.cornerEvaluationToast.title}</span>
              <span class="toast-desc">${this.cornerEvaluationToast.message}</span>
            </div>
            <span class="score-chip ${this._getGradeClass(this.cornerEvaluationToast.grade)}">${this.cornerEvaluationToast.grade} (${this.cornerEvaluationToast.score}%)</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render Chapter 2 Specialized Interactive Diagnostic Visualizers
   */
  _renderChapter2Diagnostics(activeAttempt) {
    const lineSkill = activeAttempt.skills?.['ch2-line-geometry-15gr'] || {};
    const balanceSkill = activeAttempt.skills?.['ch2-balance-slide-control'] || {};
    const fourBlockSkill = activeAttempt.skills?.['ch2-four-block-entry'] || {};

    const lineMetrics = lineSkill.metrics || {};
    const balanceMetrics = balanceSkill.metrics || {};
    const fourBlockMetrics = fourBlockSkill.metrics || {};

    const apexType = lineMetrics.apexType || 'Geometric Optimal';
    const isEarlyApex = apexType.includes('Early');
    const isLateApex = apexType.includes('Late');

    const correctionMs = balanceMetrics.correctionLatencyMs || 110;
    const pauseMs = balanceMetrics.pauseDurationMs || 160;
    const recoveryMs = 120;
    const totalCpr = correctionMs + pauseMs + recoveryMs;

    const corrPct = Math.round((correctionMs / totalCpr) * 100);
    const pausePct = Math.round((pauseMs / totalCpr) * 100);
    const recPct = 100 - corrPct - pausePct;

    const blockScores = fourBlockMetrics.blockScores || { b1: 90, b2: 85, b3: 88, b4: 92 };

    return `
      <div class="ch2-diagnostics-container">
        
        <!-- WIDGET 1: 15GR RADIUS & SPEED GAUGE -->
        <div class="ch2-widget-card gauge-15gr">
          <div class="ch2-widget-header">
            <div class="ch2-widget-title" style="display: flex; align-items: center; gap: 6px;">
              ${getIcon('arc', { size: 14 })} 15GR Radius & Kinematic Arc Gauge
            </div>
            <span class="ch2-badge ${isEarlyApex ? 'danger' : (isLateApex ? 'warning' : 'optimal')}">
              ${apexType}
            </span>
          </div>

          <div class="ch2-15gr-grid">
            <div class="ch2-metric-stat-box">
              <span class="ch2-metric-stat-lbl">Achieved Radius R</span>
              <span class="ch2-metric-stat-val">${lineMetrics.achievedRadiusMeters ?? 48}m (${lineMetrics.achievedRadiusFeet ?? 158}ft)</span>
            </div>
            <div class="ch2-metric-stat-box">
              <span class="ch2-metric-stat-lbl">Actual vs 15GR Vmax</span>
              <span class="ch2-metric-stat-val">${lineMetrics.actualApexSpeedKmh ?? 72} / ${lineMetrics.theoreticalVmaxKmh ?? 78} <span style="font-size: 10px; color:#8899A6;">km/h</span></span>
            </div>
            <div class="ch2-metric-stat-box">
              <span class="ch2-metric-stat-lbl">Arc Radius Efficiency</span>
              <span class="ch2-metric-stat-val" style="color: ${(lineMetrics.radiusEfficiencyPct || 90) >= 90 ? '#00ff88' : '#ffb800'};">
                ${lineMetrics.radiusEfficiencyPct ?? 92}%
              </span>
            </div>
          </div>
        </div>

        <!-- WIDGET 2: CORRECTION, PAUSE, RECOVERY (CPR) TIMELINE -->
        <div class="ch2-widget-card timeline-cpr">
          <div class="ch2-widget-header">
            <div class="ch2-widget-title" style="display: flex; align-items: center; gap: 6px;">
              ${getIcon('refresh', { size: 14 })} Slide Control: Correction, Pause, Recovery (CPR)
            </div>
            <span class="ch2-badge ${balanceMetrics.snapbackDetected ? 'danger' : (balanceMetrics.trailingThrottleLift ? 'warning' : 'optimal')}">
              ${balanceMetrics.balanceState || 'Neutral / High Grip'}
            </span>
          </div>

          <div class="cpr-timeline-track">
            <div class="cpr-phase-seg phase-correction" style="width: ${corrPct}%;" title="Phase 1: Countersteer Correction (${correctionMs}ms)">
              CORRECTION (${correctionMs}ms)
            </div>
            <div class="cpr-phase-seg phase-pause" style="width: ${pausePct}%;" title="Phase 2: Pause at Peak Yaw (${pauseMs}ms)">
              PAUSE (${pauseMs}ms)
            </div>
            <div class="cpr-phase-seg phase-recovery" style="width: ${recPct}%;" title="Phase 3: Recovery Unwind">
              RECOVERY
            </div>
          </div>

          <div class="cpr-legend-row">
            <span style="display: inline-flex; align-items: center; gap: 4px;">${getIcon('zap', { size: 12, color: '#00e5ff' })} Latency: <strong>${correctionMs}ms</strong> ${correctionMs <= 150 ? `<span style="color: #00ff88;">[PASS]</span>` : `<span style="color: #ffb800;">[WARN]</span>`}</span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">${getIcon('gauge', { size: 12 })} Slide Pause: <strong>${pauseMs}ms</strong></span>
            <span style="display: inline-flex; align-items: center; gap: 4px;">${getIcon('refresh', { size: 12 })} Snapback Risk: <strong>${balanceMetrics.snapbackDetected ? `<span style="color: #ff3366;">HIGH</span>` : `<span style="color: #00ff88;">LOW</span>`}</strong></span>
          </div>
        </div>

        <!-- WIDGET 3: 4-BLOCK CORNER ENTRY STAGES -->
        <div class="ch2-widget-card four-block">
          <div class="ch2-widget-header">
            <div class="ch2-widget-title" style="display: flex; align-items: center; gap: 6px;">
              ${getIcon('brake', { size: 14 })} 4-Block Corner Entry & Dynamic Weight Transfer
            </div>
            <span class="ch2-badge ${fourBlockMetrics.b2LockupDetected ? 'danger' : 'optimal'}">
              ${fourBlockMetrics.b2LockupDetected ? 'LOCKUP DETECTED' : '65% FRONT LOAD TRANSFER'}
            </span>
          </div>

          <div class="four-block-grid">
            <div class="four-block-col">
              <span class="four-block-num">BLOCK 1</span>
              <span class="four-block-name">Throttle-Brake</span>
              <span class="four-block-val">${fourBlockMetrics.b1TransitionTimeMs ?? 140}ms</span>
              <span style="font-size: 10px; font-family: var(--font-mono); color: #8899A6;">Score: ${blockScores.b1}%</span>
            </div>

            <div class="four-block-col ${fourBlockMetrics.b2LockupDetected ? 'has-lockup' : ''}">
              <span class="four-block-num">BLOCK 2</span>
              <span class="four-block-name">Straight Decel</span>
              <span class="four-block-val" style="color: ${fourBlockMetrics.b2LockupDetected ? '#ff3366' : '#00ff88'};">
                -${fourBlockMetrics.b2PeakDecelG ?? 1.35}G
              </span>
              <span style="font-size: 10px; font-family: var(--font-mono); color: #8899A6;">Score: ${blockScores.b2}%</span>
            </div>

            <div class="four-block-col">
              <span class="four-block-num">BLOCK 3</span>
              <span class="four-block-name">Brake-Turn</span>
              <span class="four-block-val">${fourBlockMetrics.b3TrailOverlapPct ?? 38}% trail</span>
              <span style="font-size: 10px; font-family: var(--font-mono); color: #8899A6;">Score: ${blockScores.b3}%</span>
            </div>

            <div class="four-block-col">
              <span class="four-block-num">BLOCK 4</span>
              <span class="four-block-name">Throttle Handoff</span>
              <span class="four-block-val">${fourBlockMetrics.b4HandoffGapMs ?? 70}ms gap</span>
              <span style="font-size: 10px; font-family: var(--font-mono); color: #8899A6;">Score: ${blockScores.b4}%</span>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  _renderHistorySubtab(attempts, inspectedAttempt, masteryStats) {
    const compareList = Array.from(this.selectedCompareIds).map(id => skillsStore.attempts.find(a => a.id === id)).filter(Boolean);
    const chapter = getChapter(this.selectedChapterNumber);

    return `
      <div class="skills-subtab-viewport">
        
        <!-- FILTER & ACTION BAR -->
        <div class="history-controls-card">
          <div class="history-filter-group">
            <span style="font-size: 11px; font-family: var(--font-mono); color: #8899A6;">FILTERS:</span>
            
            <select id="skills-filter-corner" class="skills-select">
              <option value="ALL" ${this.filterCorner === 'ALL' ? 'selected' : ''}>All Corners</option>
              <option value="T1" ${this.filterCorner === 'T1' ? 'selected' : ''}>Turn 1</option>
              <option value="T5" ${this.filterCorner === 'T5' ? 'selected' : ''}>Turn 5</option>
              <option value="T9" ${this.filterCorner === 'T9' ? 'selected' : ''}>Turn 9</option>
              <option value="T10" ${this.filterCorner === 'T10' ? 'selected' : ''}>Turn 10 (Hairpin)</option>
            </select>

            <select id="skills-filter-skill" class="skills-select">
              <option value="ALL" ${this.filterSkill === 'ALL' ? 'selected' : ''}>All Skills (Ch ${chapter.chapterNumber})</option>
              ${chapter.skills.map(sk => `
                <option value="${sk.id}" ${this.filterSkill === sk.id ? 'selected' : ''}>${sk.name}</option>
              `).join('')}
            </select>

            <select id="skills-filter-grade" class="skills-select">
              <option value="ALL" ${this.filterGrade === 'ALL' ? 'selected' : ''}>All Grades</option>
              <option value="S" ${this.filterGrade === 'S' ? 'selected' : ''}>Grade S (Pro)</option>
              <option value="A" ${this.filterGrade === 'A' ? 'selected' : ''}>Grade A</option>
              <option value="B" ${this.filterGrade === 'B' ? 'selected' : ''}>Grade B</option>
              <option value="C" ${this.filterGrade === 'C' ? 'selected' : ''}>Grade C</option>
              <option value="D" ${this.filterGrade === 'D' ? 'selected' : ''}>Grade D</option>
            </select>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="btn-skills-export-csv" class="btn btn-secondary btn-xs chamfer-br" style="display: inline-flex; align-items: center; gap: 5px;">
              ${getIcon('download', { size: 12 })} EXPORT CSV
            </button>
            <button id="btn-skills-reset-history" class="btn btn-secondary btn-xs chamfer-br" title="Clear attempt history" style="display: inline-flex; align-items: center; gap: 4px;">
              ${getIcon('refresh', { size: 12 })} RESET
            </button>
          </div>
        </div>

        <!-- SPLIT ATTEMPT COMPARATOR (IF 2 ATTEMPTS SELECTED) -->
        ${compareList.length === 2 ? this._renderSplitComparator(compareList[0], compareList[1]) : ''}

        <!-- DEEP ATTEMPT INSPECTOR -->
        ${inspectedAttempt ? `
          <div class="attempt-inspector-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
              <div>
                <span style="font-size: 10px; font-family: var(--font-mono); color: #00ff88; text-transform: uppercase;">INSPECTING ATTEMPT:</span>
                <strong style="color: #FFF; font-size: 15px; margin-left: 6px;">${inspectedAttempt.cornerName}</strong>
                <span style="color: #8899A6; font-size: 11px;">(${inspectedAttempt.trackName} · Lap ${inspectedAttempt.lapNumber})</span>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span class="score-chip ${this._getGradeClass(inspectedAttempt.grade)}" style="font-size: 13px;">GRADE ${inspectedAttempt.grade} (${inspectedAttempt.overallScore}/100)</span>
              </div>
            </div>

            <!-- Telemetry Metrics Grid (Chapter Responsive) -->
            <div class="telemetry-metrics-grid">
              ${chapter.chapterNumber === 2 ? `
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">15GR Achieved Radius</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-line-geometry-15gr']?.metrics?.achievedRadiusMeters ?? 48} m</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Theoretical Vmax</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-line-geometry-15gr']?.metrics?.theoreticalVmaxKmh ?? 78} km/h</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Radius Efficiency</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-line-geometry-15gr']?.metrics?.radiusEfficiencyPct ?? 92}%</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Apex Classification</span>
                  <span class="telemetry-metric-value" style="font-size: 12px; color: #00e5ff;">
                    ${inspectedAttempt.skills?.['ch2-line-geometry-15gr']?.metrics?.apexType ?? 'Optimal'}
                  </span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">CPR Correction Latency</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-balance-slide-control']?.metrics?.correctionLatencyMs ?? 110} ms</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">CPR Slide Pause</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-balance-slide-control']?.metrics?.pauseDurationMs ?? 160} ms</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">B1 Throttle-Brake Time</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-four-block-entry']?.metrics?.b1TransitionTimeMs ?? 140} ms</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">B2 Peak Decel G</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch2-four-block-entry']?.metrics?.b2PeakDecelG ?? 1.35} G</span>
                </div>
              ` : `
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Exit Speed Gain</span>
                  <span class="telemetry-metric-value">+${inspectedAttempt.skills?.['ch1-exit-speed']?.metrics?.speedGainKmh ?? 0} km/h</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Min Apex Speed</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch1-the-line']?.metrics?.minApexSpeedKmh ?? 0} km/h</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Braking Distance</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch1-threshold-braking']?.metrics?.brakeDistanceMeters ?? 45.2} m</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Brake Rise Time</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch1-threshold-braking']?.metrics?.rampTimeSec ?? 0.22}s</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Peak Decel G</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch1-threshold-braking']?.metrics?.peakDecelG ?? 1.3}G</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Peak Combined G</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch1-combined-entry']?.metrics?.peakCombinedG ?? 1.4}G</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Steering Fluctuation</span>
                  <span class="telemetry-metric-value">${inspectedAttempt.skills?.['ch1-the-line']?.metrics?.steeringFluctuation ?? 0.04} rad</span>
                </div>
                <div class="telemetry-metric-cell">
                  <span class="telemetry-metric-label">Mid-Corner Lifts</span>
                  <span class="telemetry-metric-value" style="color: ${(inspectedAttempt.skills?.['ch1-platform-stability']?.metrics?.throttleLifts || 0) > 0 ? '#ff3366' : '#00ff88'};">
                    ${inspectedAttempt.skills?.['ch1-platform-stability']?.metrics?.throttleLifts ?? 0}
                  </span>
                </div>
              `}
            </div>

            <p style="margin: 0; font-size: 12px; color: #CBD5E1; font-style: italic; background: rgba(0,0,0,0.3); padding: 8px 12px; border-left: 2px solid #00ff88; border-radius: 2px; display: flex; align-items: center; gap: 6px;">
              ${getIcon('lightbulb', { size: 14, color: '#00ff88' })} <strong>Coach Note:</strong> ${inspectedAttempt.summary}
            </p>
          </div>
        ` : ''}

        <!-- PROGRESSION TRENDLINE & ATTEMPTS TABLE -->
        <div class="skills-card">
          <div class="skills-card-header">
            <h2 class="skills-card-title">
              <span>${getIcon('clipboard', { size: 14 })}</span> Driver Learning Progression & Attempt History
            </h2>
            <span style="font-family: var(--font-mono); font-size: 11px; color: #64748B;">
              Click row to inspect · Select checkboxes to compare 2 attempts
            </span>
          </div>

          <!-- Progression Line Chart -->
          <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 12px;">
            <canvas id="skills-progression-canvas" style="width: 100%; height: 110px; display: block;"></canvas>
          </div>

          <!-- Historical Table -->
          <div class="skills-table-container">
            <table class="skills-attempts-table">
              <thead>
                <tr>
                  <th style="width: 30px;">CMP</th>
                  <th>TIME</th>
                  <th>TRACK / CAR</th>
                  <th>LAP</th>
                  <th>CORNER</th>
                  <th>TYPE</th>
                  <th>GRADE</th>
                  <th>SCORE</th>
                  <th>COACHING SUMMARY</th>
                </tr>
              </thead>
              <tbody>
                ${attempts.length > 0 ? attempts.map(att => {
                  const timeStr = new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isChecked = this.selectedCompareIds.has(att.id);
                  const isInspected = inspectedAttempt?.id === att.id;

                  return `
                    <tr class="skills-attempt-row ${isInspected ? 'inspected-row' : ''}" data-attempt-id="${att.id}" style="cursor: pointer; ${isInspected ? 'background: rgba(0, 255, 136, 0.08);' : ''}">
                      <td onclick="event.stopPropagation();">
                        <input type="checkbox" class="attempt-compare-checkbox" data-attempt-id="${att.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
                      </td>
                      <td style="color: #64748B;">${timeStr}</td>
                      <td><strong style="color: #FFF;">${att.trackName}</strong> <span style="color: #8899A6; font-size: 10px;">(${att.carName})</span></td>
                      <td style="color: #00e5ff;">L${att.lapNumber}</td>
                      <td><strong style="color: #FFF;">${att.cornerName}</strong></td>
                      <td style="color: #8899A6; font-size: 11px;">${att.cornerType}</td>
                      <td>
                        <span class="score-chip ${this._getGradeClass(att.grade)}">${att.grade}</span>
                      </td>
                      <td>
                        <strong style="color: #FFF; font-size: 13px;">${att.overallScore}</strong><span style="color: #64748B; font-size: 10px;">/100</span>
                      </td>
                      <td style="color: #CBD5E1; font-family: var(--font-sans); font-size: 11px;">
                        ${att.summary}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 24px; color: #64748B;">
                      No attempt records matching current filter.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  _renderSplitComparator(attA, attB) {
    const deltaScore = attA.overallScore - attB.overallScore;

    return `
      <div class="attempt-comparator-box">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,229,255,0.2); padding-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #00e5ff; font-size: 16px;">${getIcon('balance', { size: 16, color: '#00e5ff' })}</span>
            <strong style="color: #FFF; font-size: 14px; text-transform: uppercase;">Side-by-Side Attempt Comparator</strong>
          </div>
          <span style="font-family: var(--font-mono); font-size: 12px; color: ${deltaScore >= 0 ? '#00ff88' : '#ff3366'};">
            Score Delta: ${deltaScore > 0 ? '+' : ''}${deltaScore} pts
          </span>
        </div>

        <div class="comparator-grid">
          <!-- Column A -->
          <div class="comparator-column">
            <div style="display: flex; justify-content: space-between;">
              <strong style="color: #00ff88;">Attempt A: ${attA.cornerName} (Lap ${attA.lapNumber})</strong>
              <span class="score-chip ${this._getGradeClass(attA.grade)}">${attA.overallScore} (${attA.grade})</span>
            </div>
            <div style="font-size: 11px; color: #8899A6;">
              ${this.selectedChapterNumber === 2 ? `
                15GR Arc: <strong>${attA.skills?.['ch2-line-geometry-15gr']?.score ?? 0}</strong> · 
                CPR Balance: <strong>${attA.skills?.['ch2-balance-slide-control']?.score ?? 0}</strong> · 
                4-Block Entry: <strong>${attA.skills?.['ch2-four-block-entry']?.score ?? 0}</strong>
              ` : `
                Exit Speed: <strong>${attA.skills?.['ch1-exit-speed']?.score ?? 0}</strong> · 
                Braking: <strong>${attA.skills?.['ch1-threshold-braking']?.score ?? 0}</strong> · 
                Trail: <strong>${attA.skills?.['ch1-combined-entry']?.score ?? 0}</strong>
              `}
            </div>
            <div style="font-size: 11px; color: #CBD5E1;">${attA.summary}</div>
          </div>

          <!-- Column B -->
          <div class="comparator-column">
            <div style="display: flex; justify-content: space-between;">
              <strong style="color: #00e5ff;">Attempt B: ${attB.cornerName} (Lap ${attB.lapNumber})</strong>
              <span class="score-chip ${this._getGradeClass(attB.grade)}">${attB.overallScore} (${attB.grade})</span>
            </div>
            <div style="font-size: 11px; color: #8899A6;">
              ${this.selectedChapterNumber === 2 ? `
                15GR Arc: <strong>${attB.skills?.['ch2-line-geometry-15gr']?.score ?? 0}</strong> · 
                CPR Balance: <strong>${attB.skills?.['ch2-balance-slide-control']?.score ?? 0}</strong> · 
                4-Block Entry: <strong>${attB.skills?.['ch2-four-block-entry']?.score ?? 0}</strong>
              ` : `
                Exit Speed: <strong>${attB.skills?.['ch1-exit-speed']?.score ?? 0}</strong> · 
                Braking: <strong>${attB.skills?.['ch1-threshold-braking']?.score ?? 0}</strong> · 
                Trail: <strong>${attB.skills?.['ch1-combined-entry']?.score ?? 0}</strong>
              `}
            </div>
            <div style="font-size: 11px; color: #CBD5E1;">${attB.summary}</div>
          </div>
        </div>
      </div>
    `;
  }

  _renderProgressionCanvas(attempts) {
    const canvas = document.getElementById('skills-progression-canvas');
    if (!canvas || attempts.length < 2) return;

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = 110);

    ctx.clearRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Progression curve (chronological: oldest to newest)
    const chrono = [...attempts].reverse();
    const stepX = (width - 40) / Math.max(1, chrono.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.5;

    chrono.forEach((att, idx) => {
      const x = 20 + idx * stepX;
      const y = height - 15 - ((att.overallScore / 100) * (height - 30));
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Score Dots
    chrono.forEach((att, idx) => {
      const x = 20 + idx * stepX;
      const y = height - 15 - ((att.overallScore / 100) * (height - 30));
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = att.overallScore >= 85 ? '#00ff88' : '#00e5ff';
      ctx.fill();
    });
  }

  bindDOMEvents() {
    // Sidebar toggle
    const btnToggle = document.getElementById('btn-toggle-skills-sidebar');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // Subtab switching
    this.container.querySelectorAll('.skills-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-subtab');
        this.setSubtab(target);
      });
    });

    // Chapter buttons
    this.container.querySelectorAll('.skills-chapter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = parseInt(btn.getAttribute('data-chapter'), 10);
        if (ch === 1 || ch === 2) {
          this.selectedChapterNumber = ch;
          const chapterObj = getChapter(ch);
          if (chapterObj && chapterObj.skills.length > 0) {
            this.selectedSkillId = chapterObj.skills[0].id;
          }
          this.filterSkill = 'ALL';
          this.render();
        }
      });
    });

    // Stint buttons
    this.container.querySelectorAll('.skills-stint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedStintId = btn.getAttribute('data-stint');
        this.render();
      });
    });

    // Skill card / pillar selection (toggles active state in place without resetting scroll)
    this.container.querySelectorAll('.skill-playbook-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectedSkillId = el.getAttribute('data-skill-id');
        this.container.querySelectorAll('.skill-playbook-item').forEach(item => {
          if (item.getAttribute('data-skill-id') === this.selectedSkillId) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      });
    });

    // Row selection for deep inspection
    this.container.querySelectorAll('.skills-attempt-row').forEach(row => {
      row.addEventListener('click', () => {
        const attId = row.getAttribute('data-attempt-id');
        const found = skillsStore.attempts.find(a => a.id === attId);
        if (found) {
          this.selectedAttemptForInspect = found;
          this.render();
        }
      });
    });

    // Compare checkboxes
    this.container.querySelectorAll('.attempt-compare-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const attId = cb.getAttribute('data-attempt-id');
        if (cb.checked) {
          if (this.selectedCompareIds.size >= 2) {
            this.selectedCompareIds.clear();
          }
          this.selectedCompareIds.add(attId);
        } else {
          this.selectedCompareIds.delete(attId);
        }
        this.render();
      });
    });

    // Filter Corner
    const filterCorner = document.getElementById('skills-filter-corner');
    if (filterCorner) {
      filterCorner.addEventListener('change', (e) => {
        this.filterCorner = e.target.value;
        this.render();
      });
    }

    // Filter Skill
    const filterSkill = document.getElementById('skills-filter-skill');
    if (filterSkill) {
      filterSkill.addEventListener('change', (e) => {
        this.filterSkill = e.target.value;
        this.render();
      });
    }

    // Filter Grade
    const filterGrade = document.getElementById('skills-filter-grade');
    if (filterGrade) {
      filterGrade.addEventListener('change', (e) => {
        this.filterGrade = e.target.value;
        this.render();
      });
    }

    // CSV Export
    const btnCsv = document.getElementById('btn-skills-export-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
        const csv = skillsStore.exportCsv({
          stintId: this.selectedStintId,
          cornerId: this.filterCorner,
          skillId: this.filterSkill,
          grade: this.filterGrade
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `APEX_Skills_Attempts_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Reset History
    const btnReset = document.getElementById('btn-skills-reset-history');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all saved corner attempts for this driver?')) {
          skillsStore.clearAttempts();
          this.latestAttempt = null;
          this.selectedAttemptForInspect = null;
          this.selectedCompareIds.clear();
          this.render();
        }
      });
    }
  }

  _getGradeClass(grade) {
    switch (grade) {
      case 'S': return 'grade-s';
      case 'A': return 'grade-a';
      case 'B': return 'grade-b';
      case 'C': return 'grade-c';
      case 'D': return 'grade-d';
      default: return 'grade-c';
    }
  }
}

export const globalSkillsView = new SkillsView();
