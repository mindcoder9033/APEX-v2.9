/**
 * APEX Skills Hub View Controller
 * Interactive Going Faster Chapter 1 Coaching Academy & Stint Evolution Matrix
 */

import { GOING_FASTER_CHAPTERS, getChapter, getSkill } from './skills-curriculum.js';
import { skillsStore } from './skills-store.js';
import { SkillsEvaluator } from './analysis/going-faster/skills-evaluator.js';

export class SkillsView {
  constructor(containerId = 'view-skills') {
    this.container = document.getElementById(containerId);
    this.selectedChapterNumber = 1;
    this.selectedSkillId = 'ch1-exit-speed';
    this.filterCorner = 'ALL';
    this.filterSkill = 'ALL';
    this.latestAttempt = null;

    // Subscribe to store updates
    skillsStore.subscribe(() => {
      if (this.isVisible()) {
        this.render();
      }
    });
  }

  init() {
    if (!this.container) return;
    this.render();
  }

  isVisible() {
    return this.container && this.container.style.display !== 'none';
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
    const habitInsights = skillsStore.getHabitDiagnostics();
    const attempts = skillsStore.getAttempts({
      cornerId: this.filterCorner,
      skillId: this.filterSkill,
      limit: 25
    });

    // Determine latest attempt or fallback to top attempt
    const activeAttempt = this.latestAttempt || attempts[0] || null;

    this.container.innerHTML = `
      <!-- 1. TOP HERO & CHAPTER HEADER -->
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

      <!-- 2. MAIN 2-COLUMN GRID: PLAYBOOK & LIVE CLINIC -->
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
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
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

      <!-- 3. DRIVER EVOLUTION MATRIX & HISTORICAL ATTEMPT LOG -->
      <section class="skills-card">
        <div class="skills-card-header">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <h2 class="skills-card-title">
              <span>📈</span> Stint Evolution Matrix & Attempt History
            </h2>
            <div class="skills-filter-bar">
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
            </div>
          </div>

          <button id="btn-skills-reset-history" class="btn btn-secondary btn-xs chamfer-br" title="Clear driver attempt history">
            <span>↺</span> RESET HISTORY
          </button>
        </div>

        <div class="skills-table-container">
          <table class="skills-attempts-table">
            <thead>
              <tr>
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
                return `
                  <tr class="skills-attempt-row" data-attempt-id="${att.id}" style="cursor: pointer;">
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
                  <td colspan="8" style="text-align: center; padding: 24px; color: #64748B;">
                    No attempt records matching current filter.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;

    this.bindDOMEvents();
  }

  bindDOMEvents() {
    // Skill card selection
    this.container.querySelectorAll('.skill-playbook-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedSkillId = el.getAttribute('data-skill-id');
        this.render();
      });
    });

    // Attempt table row selection
    this.container.querySelectorAll('.skills-attempt-row').forEach(row => {
      row.addEventListener('click', () => {
        const attId = row.getAttribute('data-attempt-id');
        const found = skillsStore.attempts.find(a => a.id === attId);
        if (found) {
          this.latestAttempt = found;
          this.render();
        }
      });
    });

    // Filters
    const filterCornerSelect = document.getElementById('skills-filter-corner');
    if (filterCornerSelect) {
      filterCornerSelect.addEventListener('change', (e) => {
        this.filterCorner = e.target.value;
        this.render();
      });
    }

    const filterSkillSelect = document.getElementById('skills-filter-skill');
    if (filterSkillSelect) {
      filterSkillSelect.addEventListener('change', (e) => {
        this.filterSkill = e.target.value;
        this.render();
      });
    }

    // Reset History
    const btnReset = document.getElementById('btn-skills-reset-history');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all saved corner attempts for this driver?')) {
          skillsStore.clearAttempts();
          this.latestAttempt = null;
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
