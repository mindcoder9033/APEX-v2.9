/**
 * APEX Skills Hub View Controller
 * Interactive Going Faster Coaching Academy, Collapsible Sidebar & Stint Evolution Matrix
 */

import { GOING_FASTER_CHAPTERS, getChapter, getSkill } from './skills-curriculum.js';
import { skillsStore } from './skills-store.js';
import { SkillsEvaluator } from './analysis/going-faster/skills-evaluator.js';

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
    const evaluation = SkillsEvaluator.evaluateCorner(cornerSamples, metadata);
    const recorded = skillsStore.recordAttempt(evaluation, metadata);
    this.latestAttempt = recorded;

    if (this.isVisible()) {
      this.render();
    }
  }

  render() {
    if (!this.container) return;

    const chapter = getChapter(this.selectedChapterNumber);
    const masteryStats = skillsStore.getMasteryStats();
    const stintsList = skillsStore.getStintsList();
    const habitInsights = skillsStore.getHabitDiagnostics();

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
              <span style="color: #00ff88; font-size: 14px;">⚡</span>
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
                    <span class="skills-sidebar-icon">${ch.icon}</span>
                    <div class="skills-sidebar-item-info">
                      <span class="skills-sidebar-item-name">${ch.shortTitle}</span>
                      <span class="skills-sidebar-item-sub">${ch.status === 'active' ? 'ACTIVE // 5 SKILLS' : 'COMING SOON'}</span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Section 2: Recorded Stints / Sessions -->
            <div class="skills-sidebar-section-title" style="margin-top: 10px;">Recorded Stints</div>
            <div class="skills-stint-list">
              <button class="skills-stint-btn ${this.selectedStintId === 'ALL' ? 'active' : ''}" data-stint="ALL">
                <span class="skills-sidebar-icon">🏁</span>
                <div class="skills-sidebar-item-info">
                  <span class="skills-sidebar-item-name">All Stints & Laps</span>
                  <span class="skills-sidebar-item-sub">${masteryStats.totalAttempts} total attempts</span>
                </div>
              </button>
              ${stintsList.map(st => {
                const isSelected = this.selectedStintId === st.stintId;
                const timeStr = new Date(st.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                return `
                  <button class="skills-stint-btn ${isSelected ? 'active' : ''}" data-stint="${st.stintId}" title="${st.trackName}">
                    <span class="skills-sidebar-icon">⏱️</span>
                    <div class="skills-sidebar-item-info">
                      <span class="skills-sidebar-item-name">${st.trackName}</span>
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
                <span>🎯</span>
                <span>Coaching Clinic & Playbook</span>
              </button>
              <button class="skills-subtab-btn ${this.activeSubtab === 'history' ? 'active' : ''}" data-subtab="history">
                <span>📈</span>
                <span>Attempt History & Matrix</span>
                <span class="skills-subtab-badge">${attempts.length}</span>
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; font-family: var(--font-mono);">
              <span style="color: #64748B;">DRIVER:</span>
              <strong style="color: #00e5ff;">#01 APEX Driver</strong>
            </div>
          </nav>

          <!-- SUBTAB 1: COACHING CLINIC & PLAYBOOK -->
          ${this.activeSubtab === 'clinic' ? this._renderClinicSubtab(chapter, masteryStats, habitInsights, activeAttempt) : ''}

          <!-- SUBTAB 2: ATTEMPT HISTORY & MATRIX -->
          ${this.activeSubtab === 'history' ? this._renderHistorySubtab(attempts, inspectedAttempt, masteryStats) : ''}

        </main>
      </div>
    `;

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
                <span>⚡</span> GOING FASTER! COACHING HUB // ${chapter.title.toUpperCase()}
              </div>
              <h1 class="skills-hero-title">${chapter.subtitle}</h1>
              <p class="skills-hero-subtitle">${chapter.description}</p>
            </div>

            <div class="skills-hero-stats-panel">
              <div class="skills-stat-box">
                <span class="skills-stat-val ${this._getGradeClass(masteryStats.grade)}">${masteryStats.overallMasteryScore}%</span>
                <span class="skills-stat-lbl">Mastery Index</span>
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
          
          <!-- LEFT: CHAPTER 1 SKILLS PLAYBOOK -->
          <section class="skills-card">
            <div class="skills-card-header">
              <h2 class="skills-card-title">
                <span>📚</span> Chapter 1 Skills Playbook
              </h2>
              <span style="font-family: var(--font-mono); font-size: 11px; color: #8899A6;">5 Core Telemetry Pillars</span>
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
                        <span>${sk.icon}</span>
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
                <span>🎯</span> Live Corner Clinic & Diagnostics
              </h2>
              <span style="font-family: var(--font-mono); font-size: 11px; color: #00ff88;">REAL-TIME SCORING</span>
            </div>

            <div class="live-clinic-box">
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

                <div class="clinic-skill-breakdown">
                  ${Object.keys(activeAttempt.skills).map(skId => {
                    const skData = activeAttempt.skills[skId];
                    const skDef = getSkill(skId);
                    if (!skDef) return '';

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
              ` : `
                <div style="padding: 30px; text-align: center; color: #64748B; font-size: 13px;">
                  No telemetry corner attempt recorded yet. Run laps in Live Telemetry or load a session to evaluate.
                </div>
              `}

              <!-- Habit Evolution & Diagnostics Box -->
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                <span style="font-size: 11px; font-family: var(--font-mono); color: #8899A6; text-transform: uppercase; letter-spacing: 0.05em;">
                  🧠 Habit Evolution & Adaptive Coach Insights
                </span>
                ${habitInsights.map(h => `
                  <div class="habit-alert-card ${h.type || 'positive'}">
                    <span style="font-size: 14px;">${h.type === 'danger' ? '⚠️' : (h.type === 'warning' ? '⚡' : '✅')}</span>
                    <div>
                      ${h.title ? `<strong>${h.title}: </strong>` : ''}
                      ${h.message}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>

        </div>
      </div>
    `;
  }

  _renderHistorySubtab(attempts, inspectedAttempt, masteryStats) {
    const compareList = Array.from(this.selectedCompareIds).map(id => skillsStore.attempts.find(a => a.id === id)).filter(Boolean);

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
              <option value="ALL" ${this.filterSkill === 'ALL' ? 'selected' : ''}>All Skills</option>
              <option value="ch1-exit-speed" ${this.filterSkill === 'ch1-exit-speed' ? 'selected' : ''}>Exit Speed</option>
              <option value="ch1-the-line" ${this.filterSkill === 'ch1-the-line' ? 'selected' : ''}>The Line</option>
              <option value="ch1-threshold-braking" ${this.filterSkill === 'ch1-threshold-braking' ? 'selected' : ''}>Threshold Braking</option>
              <option value="ch1-combined-entry" ${this.filterSkill === 'ch1-combined-entry' ? 'selected' : ''}>Combined Entry</option>
              <option value="ch1-platform-stability" ${this.filterSkill === 'ch1-platform-stability' ? 'selected' : ''}>Platform Stability</option>
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
            <button id="btn-skills-export-csv" class="btn btn-secondary btn-xs chamfer-br">
              <span>📥</span> EXPORT CSV
            </button>
            <button id="btn-skills-reset-history" class="btn btn-secondary btn-xs chamfer-br" title="Clear attempt history">
              <span>↺</span> RESET
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

            <!-- Telemetry Metrics Grid -->
            <div class="telemetry-metrics-grid">
              <div class="telemetry-metric-cell">
                <span class="telemetry-metric-label">Exit Speed Gain</span>
                <span class="telemetry-metric-value">+${inspectedAttempt.skills?.['ch1-exit-speed']?.metrics?.speedGainKmh ?? 0} km/h</span>
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
            </div>

            <p style="margin: 0; font-size: 12px; color: #CBD5E1; font-style: italic; background: rgba(0,0,0,0.3); padding: 8px 12px; border-left: 2px solid #00ff88; border-radius: 2px;">
              💡 <strong>Coach Note:</strong> ${inspectedAttempt.summary}
            </p>
          </div>
        ` : ''}

        <!-- PROGRESSION TRENDLINE & ATTEMPTS TABLE -->
        <div class="skills-card">
          <div class="skills-card-header">
            <h2 class="skills-card-title">
              <span>📋</span> Driver Learning Progression & Attempt History
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
            <span style="color: #00e5ff; font-size: 16px;">⚖️</span>
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
              Exit Speed: <strong>${attA.skills?.['ch1-exit-speed']?.score ?? 0}</strong> · 
              Braking: <strong>${attA.skills?.['ch1-threshold-braking']?.score ?? 0}</strong> · 
              Trail: <strong>${attA.skills?.['ch1-combined-entry']?.score ?? 0}</strong>
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
              Exit Speed: <strong>${attB.skills?.['ch1-exit-speed']?.score ?? 0}</strong> · 
              Braking: <strong>${attB.skills?.['ch1-threshold-braking']?.score ?? 0}</strong> · 
              Trail: <strong>${attB.skills?.['ch1-combined-entry']?.score ?? 0}</strong>
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
        if (ch === 1) {
          this.selectedChapterNumber = ch;
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

    // Skill card selection
    this.container.querySelectorAll('.skill-playbook-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedSkillId = el.getAttribute('data-skill-id');
        this.render();
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
