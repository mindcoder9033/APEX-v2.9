/**
 * APEX Weather Intelligence View
 * Renders the 18-condition weather simulation section within the Track Library detail panel.
 * Features: 4-column condition card grid, inline expansion with per-corner weather table,
 * confidence badges, hydroplaning risk highlighting, and active condition state.
 */

import { weatherProfileStore } from './weather-profile-store.js';
import { WEATHER_CONDITIONS, WEATHER_CATEGORIES, WeatherSimulator } from './analysis/weather-simulator.js';

// Category accent colors
const CATEGORY_COLORS = {
  Dry:          { border: '#E5A910', text: '#E5A910', bg: 'rgba(229,169,16,0.08)' },
  Transitional: { border: '#0099FF', text: '#0099FF', bg: 'rgba(0,153,255,0.08)' },
  Wet:          { border: '#00D8F4', text: '#00D8F4', bg: 'rgba(0,216,244,0.08)' },
  Dynamic:      { border: '#CC44FF', text: '#CC44FF', bg: 'rgba(204,68,255,0.08)' },
};

// Confidence badge tier styling
const CONFIDENCE_STYLES = {
  initial:   { color: '#E5A910', label: 'SIMULATED' },
  improving: { color: '#00AAFF', label: 'IMPROVING' },
  high:      { color: '#00CC66', label: 'HIGH CONF.' },
  validated: { color: '#00FF99', label: 'VALIDATED' },
};

export class WeatherIntelView {
  constructor() {
    this.activeConditionSlug = null;
    this.currentTrackId = null;
    this.currentStintsCount = 1;

    this.gridContainer = document.getElementById('weather-conditions-grid');
    this.detailPanel = document.getElementById('weather-condition-detail-panel');
  }

  /**
   * Loads and renders the weather intelligence section for a given track.
   * @param {string} trackId
   * @param {number} stintsCount Number of recorded stints for this track (for confidence)
   */
  render(trackId, stintsCount = 1) {
    this.currentTrackId = trackId;
    this.currentStintsCount = stintsCount;
    this.activeConditionSlug = null;

    if (this.detailPanel) this.detailPanel.style.display = 'none';
    this._renderGrid();
  }

  /**
   * Returns the currently active condition slug (null = dry/no selection).
   * Used by TrackLibraryView to pass into PDF export.
   * @returns {string|null}
   */
  getActiveConditionSlug() {
    return this.activeConditionSlug;
  }

  /**
   * Returns the active WeatherProfile object, or null.
   * @returns {Object|null}
   */
  getActiveProfile() {
    if (!this.activeConditionSlug || !this.currentTrackId) return null;
    return weatherProfileStore.getProfile(this.currentTrackId, this.activeConditionSlug);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  _renderGrid() {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = '';

    const profiles = this.currentTrackId
      ? weatherProfileStore.getProfiles(this.currentTrackId)
      : null;

    const confidence = WeatherSimulator.getConfidence(this.currentStintsCount);

    for (const category of WEATHER_CATEGORIES) {
      const conditions = WEATHER_CONDITIONS.filter(c => c.category === category);
      const catColors = CATEGORY_COLORS[category];

      // Category header row
      const header = document.createElement('div');
      header.className = 'weather-category-header';
      header.style.cssText = `
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0 4px;
        border-bottom: 1px solid ${catColors.border}33;
        margin-bottom: 2px;
      `;
      header.innerHTML = `
        <span style="font-family: var(--font-display); font-size: 10px; font-weight: 700;
          color: ${catColors.text}; letter-spacing: 1.5px; text-transform: uppercase;">${category}</span>
        <span style="font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);">
          ${conditions.length} CONDITIONS
        </span>
      `;
      this.gridContainer.appendChild(header);

      // Condition cards
      for (const cond of conditions) {
        const profile = profiles ? profiles[cond.slug] : null;
        const isActive = this.activeConditionSlug === cond.slug;
        const card = this._buildConditionCard(cond, profile, isActive, confidence, catColors);
        this.gridContainer.appendChild(card);
      }
    }
  }

  _buildConditionCard(condition, profile, isActive, confidence, catColors) {
    const card = document.createElement('div');
    card.className = `weather-condition-card chamfer-all-corners${isActive ? ' active' : ''}`;
    card.dataset.slug = condition.slug;
    card.style.cssText = `
      background: ${isActive ? catColors.bg : 'rgba(23,26,31,0.8)'};
      border: 1px solid ${isActive ? catColors.border : 'var(--color-border)'};
      border-radius: 4px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
      position: relative;
      overflow: hidden;
      ${isActive ? `box-shadow: 0 0 12px ${catColors.border}44;` : ''}
    `;

    const gripLossPct = profile ? profile.gripLossPct : Math.round(condition.gripLoss * 100);
    const brakePct = profile ? profile.brakingIncreasePct : Math.round(condition.brakingIncrease * 100);
    const confStyle = CONFIDENCE_STYLES[confidence.confidenceTier];

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 7px;">
        <span style="font-family: var(--font-display); font-size: 11px; font-weight: 700;
          color: ${isActive ? catColors.text : 'var(--color-text-primary)'}; letter-spacing: 0.5px;">
          ${condition.name}
        </span>
        <span class="weather-confidence-badge" title="Simulation confidence improves as you record more wet sessions for this track"
          style="font-size: 8px; font-family: var(--font-mono); font-weight: 700;
          color: ${confStyle.color}; background: ${confStyle.color}18;
          border: 1px solid ${confStyle.color}55; padding: 1px 5px; border-radius: 2px;">
          ${confidence.confidencePct}% ${confStyle.label}
        </span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <div>
          <div style="font-size: 8px; font-family: var(--font-mono); color: var(--color-text-muted); text-transform: uppercase;">GRIP LOSS</div>
          <div style="font-size: 13px; font-weight: 700; font-family: var(--font-mono);
            color: ${gripLossPct > 50 ? 'var(--color-f1-red)' : gripLossPct > 20 ? 'var(--color-warning)' : 'var(--color-success)'};">
            -${gripLossPct}%
          </div>
        </div>
        <div>
          <div style="font-size: 8px; font-family: var(--font-mono); color: var(--color-text-muted); text-transform: uppercase;">BRAKE EARLIER</div>
          <div style="font-size: 13px; font-weight: 700; font-family: var(--font-mono);
            color: ${brakePct > 40 ? 'var(--color-f1-red)' : brakePct > 15 ? 'var(--color-warning)' : 'var(--color-text-primary)'};">
            +${brakePct}%
          </div>
        </div>
      </div>
      ${condition.hydroRisk ? `
        <div style="margin-top: 6px;">
          <span style="font-size: 8px; font-family: var(--font-mono); font-weight: 700;
            color: #00D8F4; background: rgba(0,216,244,0.1); border: 1px solid rgba(0,216,244,0.3);
            padding: 1px 5px; border-radius: 2px;">💧 HYDRO RISK</span>
        </div>
      ` : ''}
    `;

    card.addEventListener('mouseenter', () => {
      if (!isActive) {
        card.style.borderColor = catColors.border;
        card.style.background = catColors.bg;
      }
    });
    card.addEventListener('mouseleave', () => {
      if (!isActive) {
        card.style.borderColor = 'var(--color-border)';
        card.style.background = 'rgba(23,26,31,0.8)';
      }
    });

    card.addEventListener('click', () => {
      if (this.activeConditionSlug === condition.slug) {
        // Toggle off — collapse
        this.activeConditionSlug = null;
        this._renderGrid();
        if (this.detailPanel) this.detailPanel.style.display = 'none';
      } else {
        this.activeConditionSlug = condition.slug;
        this._renderGrid();
        this._renderDetailPanel(condition, profile, catColors);
      }
    });

    return card;
  }

  _renderDetailPanel(condition, profile, catColors) {
    if (!this.detailPanel) return;

    if (!profile) {
      this.detailPanel.style.display = 'block';
      this.detailPanel.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--color-text-muted);
          font-family: var(--font-mono); font-size: 11px;">
          ⚠️ Weather simulation data not yet generated for this track.
          Record a new stint to unlock Weather Intelligence.
        </div>
      `;
      return;
    }

    const confidence = WeatherSimulator.getConfidence(this.currentStintsCount);
    const confStyle = CONFIDENCE_STYLES[confidence.confidenceTier];

    this.detailPanel.style.display = 'block';
    this.detailPanel.innerHTML = `
      <!-- Panel Header -->
      <div class="weather-detail-header" style="display: flex; justify-content: space-between;
        align-items: center; padding: 14px 16px; border-bottom: 1px solid ${catColors.border}44;
        background: ${catColors.bg};">
        <div>
          <div style="font-family: var(--font-display); font-size: 14px; font-weight: 700;
            color: ${catColors.text}; letter-spacing: 0.8px;">${profile.conditionName.toUpperCase()}</div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-muted);
            margin-top: 2px;">${profile.category} Condition — Weather-Adjusted Corner Briefing</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: var(--font-mono); font-size: 9px; font-weight: 700;
            color: ${confStyle.color}; background: ${confStyle.color}18;
            border: 1px solid ${confStyle.color}55; padding: 3px 8px; border-radius: 3px;">
            ${confidence.confidencePct}% CONFIDENCE — ${confStyle.label}
          </span>
          <span title="Confidence improves as you record more sessions in wet conditions" style="cursor: help;
            font-size: 11px; color: var(--color-text-muted);">ℹ️</span>
        </div>
      </div>

      <!-- Global Stats Row -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
        background: var(--color-border); border-bottom: 1px solid var(--color-border);">
        ${this._statCell('GRIP LEVEL', `${profile.gripFactor * 100 | 0}% of dry`, profile.gripLossPct > 50 ? 'var(--color-f1-red)' : profile.gripLossPct > 20 ? 'var(--color-warning)' : 'var(--color-success)')}
        ${this._statCell('BRAKE EARLIER', `+${profile.brakingIncreasePct}%`, 'var(--color-f1-red)')}
        ${this._statCell('SPEED REDUCTION', `-${profile.speedReductionPct}%`, 'var(--color-warning)')}
        ${this._statCell('VISIBILITY', `${profile.visibilityPct}%`, profile.visibilityPct < 40 ? 'var(--color-f1-red)' : 'var(--color-text-primary)')}
        ${this._statCell('AQUAPLANING', profile.hydroplaningCorners.length > 0 ? `T${profile.hydroplaningCorners.join(', T')}` : 'None Detected', profile.hydroplaningCorners.length > 0 ? '#00D8F4' : 'var(--color-success)')}
      </div>

      <!-- Per-Corner Weather Table -->
      <div style="overflow-x: auto; max-height: 320px; overflow-y: auto;">
        <table class="corner-table" style="font-size: 11px;">
          <thead>
            <tr>
              <th>TURN</th>
              <th>DRY BRAKE</th>
              <th style="color: ${catColors.text};">WET BRAKE</th>
              <th>DRY APEX</th>
              <th style="color: ${catColors.text};">WET APEX</th>
              <th>DRY GEAR</th>
              <th style="color: ${catColors.text};">WET GEAR</th>
              ${profile.hydroRisk ? `<th style="color: #00D8F4;">AQUAPLANE</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${profile.corners.map(c => this._cornerRow(c, profile.hydroRisk, catColors)).join('')}
          </tbody>
        </table>
      </div>

      <!-- Strategy & Checklist -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 14px 16px;
        border-top: 1px solid var(--color-border);">
        <div>
          <div style="font-family: var(--font-display); font-size: 10px; font-weight: 700;
            color: ${catColors.text}; letter-spacing: 1px; margin-bottom: 8px;">🎯 STRATEGY</div>
          ${this._strategyLine('Line', profile.strategy.line)}
          ${this._strategyLine('Tires', profile.strategy.tires)}
          ${this._strategyLine('Throttle', profile.strategy.throttle)}
          ${this._strategyLine('Braking', profile.strategy.braking)}
          ${profile.strategy.hydroNote ? this._strategyLine('⚠️ Aquaplane', profile.strategy.hydroNote, '#00D8F4') : ''}
        </div>
        <div>
          <div style="font-family: var(--font-display); font-size: 10px; font-weight: 700;
            color: ${catColors.text}; letter-spacing: 1px; margin-bottom: 8px;">✅ PRE-STINT CHECKLIST</div>
          ${profile.checklist.map(item => `
            <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 5px;">
              <span style="color: var(--color-text-muted); margin-top: 1px; flex-shrink: 0;">□</span>
              <span style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.4;">${item}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _statCell(label, value, color) {
    return `
      <div style="background: var(--color-surface, #0D0D0F); padding: 10px 12px; text-align: center;">
        <div style="font-size: 8px; font-family: var(--font-mono); color: var(--color-text-muted);
          text-transform: uppercase; margin-bottom: 4px;">${label}</div>
        <div style="font-size: 13px; font-weight: 700; font-family: var(--font-mono);
          color: ${color};">${value}</div>
      </div>
    `;
  }

  _cornerRow(c, showHydro, catColors) {
    const hydroFlag = c.hydroplaningFlag;
    const rowBg = hydroFlag ? 'background: rgba(0,216,244,0.04);' : '';
    const brakeChange = c.wetBrakingMarkerMeters - c.dryBrakingMarkerMeters;
    const speedChange = c.wetApexSpeedKmh - c.dryApexSpeedKmh;

    return `
      <tr style="${rowBg}">
        <td><strong style="color: var(--color-cyan);">T${c.turnNumber}</strong></td>
        <td style="color: var(--color-text-muted);">${c.dryBrakingMarkerMeters}m</td>
        <td style="color: ${catColors.text}; font-weight: 700;">
          ${c.wetBrakingMarkerMeters}m
          <span style="font-size: 9px; color: var(--color-f1-red);">(+${brakeChange}m)</span>
        </td>
        <td style="color: var(--color-text-muted);">${c.dryApexSpeedKmh} km/h</td>
        <td style="color: ${catColors.text}; font-weight: 700;">
          ${c.wetApexSpeedKmh} km/h
          <span style="font-size: 9px; color: var(--color-f1-red);">(${speedChange})</span>
        </td>
        <td style="color: var(--color-text-muted);">G${c.dryTargetGear}</td>
        <td style="color: ${c.wetTargetGear < c.dryTargetGear ? catColors.text : 'var(--color-text-muted)'}; font-weight: ${c.wetTargetGear < c.dryTargetGear ? '700' : 'normal'};">
          G${c.wetTargetGear}${c.wetTargetGear < c.dryTargetGear ? ' ↓' : ''}
        </td>
        ${showHydro ? `
          <td>
            ${hydroFlag
              ? `<span class="aquaplaning-risk-badge">⚠️ HIGH RISK</span>`
              : `<span style="font-size: 9px; color: var(--color-text-muted); font-family: var(--font-mono);">LOW</span>`
            }
          </td>
        ` : ''}
      </tr>
    `;
  }

  _strategyLine(label, value, color = 'var(--color-text-secondary)') {
    return `
      <div style="margin-bottom: 5px;">
        <span style="font-size: 9px; font-family: var(--font-mono); color: var(--color-text-muted);
          text-transform: uppercase; margin-right: 6px;">${label}:</span>
        <span style="font-size: 11px; color: ${color}; line-height: 1.4;">${value}</span>
      </div>
    `;
  }
}
