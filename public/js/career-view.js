/**
 * APEX Career Mode View Controller
 * Implements Feature 5 of APEX v3.0:
 * Interactive Going Faster Driver Progression Hub with Skill Radar,
 * License Cards, and Telemetry Milestones.
 */

import { globalCareerStore } from './career-store.js';
import { CAREER_TIERS } from './career-curriculum.js';

export class CareerView {
  constructor(containerId = 'view-career') {
    this.container = document.getElementById(containerId);
    this.radarCanvas = null;
  }

  init() {
    if (!this.container) return;
    this.render();
  }

  render() {
    if (!this.container) return;
    const state = globalCareerStore.getState();
    const currentTierObj = CAREER_TIERS.find(t => t.tier === state.unlockedTier) || CAREER_TIERS[0];

    this.container.innerHTML = `
      <div class="career-hub-container" style="padding: 24px; max-width: 1400px; margin: 0 auto; color: var(--color-text, #fff); font-family: var(--font-sans, 'Inter', sans-serif);">
        
        <!-- TOP HEADER: DRIVER LICENSE BANNER -->
        <div class="career-license-banner chamfer-tl-br" style="background: linear-gradient(135deg, rgba(20,24,33,0.95), rgba(12,15,20,0.98)); border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; gap: 20px;">
            <div class="license-badge chamfer-all-corners" style="width: 68px; height: 68px; border: 2px solid ${currentTierObj.color}; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.5);">
              <span style="font-family: var(--font-mono, monospace); font-size: 11px; color: #888;">TIER</span>
              <span style="font-size: 26px; font-weight: 900; color: ${currentTierObj.color};">T${currentTierObj.tier}</span>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <h1 style="font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0;">${currentTierObj.license}</h1>
                <span class="badge chamfer-all-corners" style="background: ${currentTierObj.color}22; color: ${currentTierObj.color}; border: 1px solid ${currentTierObj.color}44; padding: 2px 10px; font-size: 11px; font-weight: 700; border-radius: 4px;">ACTIVE</span>
              </div>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #8a99ad;">${currentTierObj.description}</p>
            </div>
          </div>

          <!-- Quick Stats Pills -->
          <div style="display: flex; gap: 16px;">
            <div class="stat-pill chamfer-all-corners" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 10px 18px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #718096; font-family: var(--font-mono, monospace);">RECORDED STINTS</div>
              <div style="font-size: 18px; font-weight: 800; color: #fff;">${state.stats.totalStints || 0}</div>
            </div>
            <div class="stat-pill chamfer-all-corners" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 10px 18px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #718096; font-family: var(--font-mono, monospace);">TOTAL LAPS</div>
              <div style="font-size: 18px; font-weight: 800; color: #fff;">${state.stats.totalLaps || 0}</div>
            </div>
            <div class="stat-pill chamfer-all-corners" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 10px 18px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; color: #718096; font-family: var(--font-mono, monospace);">MASTERY INDEX</div>
              <div style="font-size: 18px; font-weight: 800; color: #00CC66;">${state.stats.highestMastery ?? 0}%</div>
            </div>
          </div>
        </div>

        <!-- MAIN TWO-COLUMN GRID: RADAR + TIERS -->
        <div style="display: grid; grid-template-columns: 380px 1fr; gap: 24px;">
          
          <!-- LEFT: DRIVER SKILL RADAR -->
          <div class="pit-card chamfer-tl-br" style="background: rgba(18,22,30,0.9); border: 1px solid rgba(255,255,255,0.08); padding: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h2 style="font-size: 14px; font-weight: 700; margin: 0; color: #cbd5e0; letter-spacing: 0.5px;">DRIVER SKILL RADAR</h2>
              <span style="font-family: var(--font-mono, monospace); font-size: 10px; color: #718096;">GOING FASTER KPI</span>
            </div>

            <div style="display: flex; justify-content: center; align-items: center; height: 280px;">
              <canvas id="career-radar-canvas" width="300" height="280"></canvas>
            </div>

            <!-- Skill Metrics List -->
            <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between;"><span style="color: #8a99ad;">Line & Arc Radius</span><span style="font-weight: 700; color: #00CC66;">${state.stats.radar?.line ?? 0}%</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #8a99ad;">Type I Exit Launch</span><span style="font-weight: 700; color: #0099FF;">${state.stats.radar?.exitSpeed ?? 0}%</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #8a99ad;">Trail-Braking Transition</span><span style="font-weight: 700; color: #E5A910;">${state.stats.radar?.trailBraking ?? 0}%</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #8a99ad;">Chassis Neutrality</span><span style="font-weight: 700; color: #9966FF;">${state.stats.radar?.balance ?? 0}%</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #8a99ad;">Wet Weather Adaptation</span><span style="font-weight: 700; color: #00CC66;">${state.stats.radar?.wetControl ?? 0}%</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #8a99ad;">Lap Consistency</span><span style="font-weight: 700; color: #E10600;">${state.stats.radar?.consistency ?? 0}%</span></div>
            </div>
          </div>

          <!-- RIGHT: 5-TIER CURRICULUM ACCORDION -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${CAREER_TIERS.map(tier => {
              const isUnlocked = tier.tier <= state.unlockedTier;
              const isCurrent = tier.tier === state.unlockedTier;
              const completedCount = tier.milestones.filter(m => state.completedMilestones.includes(m.id)).length;
              const isFinished = completedCount === tier.milestones.length;

              return `
                <div class="career-tier-card chamfer-tl-br" style="background: ${isUnlocked ? 'rgba(18,22,30,0.9)' : 'rgba(14,16,22,0.5)'}; border: 1px solid ${isCurrent ? tier.color + '88' : 'rgba(255,255,255,0.06)'}; border-radius: 8px; padding: 20px; opacity: ${isUnlocked ? '1' : '0.6'};">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 16px; font-weight: 800; color: ${isUnlocked ? tier.color : '#666'};">${tier.name}</span>
                        <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono, monospace); font-weight: 700; background: ${isFinished ? '#00CC6622' : (isUnlocked ? '#0099FF22' : '#33333322')}; color: ${isFinished ? '#00CC66' : (isUnlocked ? '#0099FF' : '#777')};">
                          ${isFinished ? 'COMPLETED' : (isUnlocked ? `${completedCount}/${tier.milestones.length} MILESTONES` : 'LOCKED')}
                        </span>
                      </div>
                      <p style="margin: 4px 0 0 0; font-size: 12px; color: #8a99ad;">${tier.description}</p>
                    </div>
                    <span style="font-size: 11px; color: ${tier.color}; font-family: var(--font-mono, monospace); font-weight: 700;">${tier.license}</span>
                  </div>

                  <!-- Skip Barber Quote -->
                  <div style="background: rgba(0,0,0,0.25); border-left: 3px solid ${tier.color}; padding: 8px 12px; font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 14px; border-radius: 0 4px 4px 0;">
                    ${tier.quote}
                  </div>

                  <!-- Milestones List -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
                    ${tier.milestones.map(m => {
                      const isDone = state.completedMilestones.includes(m.id);
                      return `
                        <div class="milestone-box chamfer-all-corners" style="background: ${isDone ? 'rgba(0,204,102,0.06)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isDone ? '#00CC6644' : 'rgba(255,255,255,0.05)'}; padding: 10px 14px; border-radius: 6px;">
                          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 12px; font-weight: 700; color: ${isDone ? '#00CC66' : '#e2e8f0'};">${m.title}</span>
                            <span style="font-size: 12px;">${isDone ? '✅' : '⏳'}</span>
                          </div>
                          <p style="margin: 0; font-size: 11px; color: #718096; line-height: 1.4;">${m.requirement}</p>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

        </div>
      </div>
    `;

    this._drawSkillRadar(state.stats?.radar || {});
  }

  _drawSkillRadar(radarData) {
    const canvas = document.getElementById('career-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = 95;

    ctx.clearRect(0, 0, W, H);

    const axes = [
      { name: 'Line', val: radarData.line ?? 0 },
      { name: 'Exit Speed', val: radarData.exitSpeed ?? 0 },
      { name: 'Trail Brake', val: radarData.trailBraking ?? 0 },
      { name: 'Balance', val: radarData.balance ?? 0 },
      { name: 'Wet Grip', val: radarData.wetControl ?? 0 },
      { name: 'Consistency', val: radarData.consistency ?? 0 }
    ];

    const numAxes = axes.length;
    const angleStep = (Math.PI * 2) / numAxes;

    // Draw concentric polygon rings (25%, 50%, 75%, 100%)
    for (let r = 1; r <= 4; r++) {
      const curR = (radius / 4) * r;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + Math.cos(angle) * curR;
        const y = cy + Math.sin(angle) * curR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw Axis lines & Labels
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#8a99ad';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      const labelX = cx + Math.cos(angle) * (radius + 20);
      const labelY = cy + Math.sin(angle) * (radius + 15);
      ctx.fillText(axes[i].name, labelX, labelY);
    }

    // Draw Radar polygon if data has been recorded
    const hasData = axes.some(a => (a.val || 0) > 0);
    if (hasData) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 204, 102, 0.25)';
      ctx.strokeStyle = '#00CC66';
      ctx.lineWidth = 2;

      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const normalizedVal = Math.max(0.05, Math.min(1.0, (axes[i].val || 0) / 100));
        const curR = radius * normalizedVal;
        const x = cx + Math.cos(angle) * curR;
        const y = cy + Math.sin(angle) * curR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw vertex points
      ctx.fillStyle = '#fff';
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const normalizedVal = Math.max(0.05, Math.min(1.0, (axes[i].val || 0) / 100));
        const curR = radius * normalizedVal;
        const x = cx + Math.cos(angle) * curR;
        const y = cy + Math.sin(angle) * curR;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Draw subtle empty state label
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO TELEMETRY LOGGED', cx, cy);
    }
  }
}

export const globalCareerView = new CareerView();
