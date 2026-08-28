import { LiveHudRenderer } from './hud.js';

const STINTS_DATA = [
  { id: '1-1', tier: 1, tierName: 'Tier 1: Fundamentals', name: 'The Pathfinder', focus: 'Finding the Line', guide: 'Learn the fastest path. Drive at a moderate speed. Match the ideal line on the track map exactly.', car: '2019 Aston Martin Vantage', track: 'Sebring' },
  { id: '1-2', tier: 1, tierName: 'Tier 1: Fundamentals', name: 'Exit Speed Expert', focus: 'Corner Exit & Acceleration', guide: 'Maximize speed on the straight. Focus on throttle application point.', car: '2019 Aston Martin Vantage', track: 'Sebring' },
  { id: '1-3', tier: 1, tierName: 'Tier 1: Fundamentals', name: 'The Brake & Turn Maestro', focus: 'Braking & Corner Entry', guide: 'Perfect transition from braking to turning.', car: '2019 Aston Martin Vantage', track: 'Sebring' },
  
  { id: '2-1', tier: 2, tierName: 'Tier 2: Physics', name: 'The Line Hunter', focus: 'Line Finding (Late Apex)', guide: 'Intentionally turn in later than you think, then gradually move earlier.', car: '2020 Corvette Stingray', track: 'Sebring' },
  { id: '2-2', tier: 2, tierName: 'Tier 2: Physics', name: 'The Throttle Squeeze', focus: 'Corner Exit Balance', guide: 'Experiment with throttle application at the corner exit.', car: '2020 Corvette Stingray', track: 'Sebring' },
  { id: '2-3', tier: 2, tierName: 'Tier 2: Physics', name: 'The Brake Maestro', focus: 'Threshold & Trail Braking', guide: 'Learn the feel of threshold braking.', car: '2020 Corvette Stingray', track: 'Sebring' },

  { id: '3-1', tier: 3, tierName: 'Tier 3: Real-World', name: 'The Speed of Recognition', focus: 'Curing Early Apexes', guide: 'Trigger an early apex intentionally, but catch it 90 feet early.', car: '2015 Corvette Z06', track: 'Lime Rock Park' },
  { id: '3-2', tier: 3, tierName: 'Tier 3: Real-World', name: 'The Camber Hunter', focus: 'Reading Banking & Off-Camber', guide: 'Experiment with early vs. late apexes to find grip.', car: '2015 Corvette Z06', track: 'Lime Rock Park' },
  { id: '3-3', tier: 3, tierName: 'Tier 3: Real-World', name: 'The Compromise Architect', focus: 'Sacrificing for the Straight', guide: 'Consciously sacrifice entry speed to get a massive exit.', car: '2015 Corvette Z06', track: 'Lime Rock Park' }
];

export class StintsManager {
  constructor() {
    this.listContainer = document.getElementById('stints-tiers-list');
    this.hudContainer = document.getElementById('stints-hud-view');
    this.mainContainer = document.getElementById('stints-container');
    this.btnStopStint = document.getElementById('btn-stop-stint');
    
    this.hud = new LiveHudRenderer('live-hud-widgets-container');
    
    this.init();
  }

  init() {
    this.renderList();
    this.bindEvents();
    
    window.addEventListener('apex-stints-opened', () => {
      // Refresh if needed
    });
  }

  bindEvents() {
    if (this.btnStopStint) {
      this.btnStopStint.addEventListener('click', () => {
        this.stopStint();
      });
    }
  }

  renderList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    const tiers = [1, 2, 3];
    tiers.forEach(tierNum => {
      const tierStints = STINTS_DATA.filter(s => s.tier === tierNum);
      if (tierStints.length === 0) return;

      const tierHeader = document.createElement('h3');
      tierHeader.className = 'pit-card-title';
      tierHeader.style.marginTop = '20px';
      tierHeader.style.marginBottom = '10px';
      tierHeader.textContent = tierStints[0].tierName;
      this.listContainer.appendChild(tierHeader);

      tierStints.forEach(stint => {
        const card = document.createElement('div');
        card.className = 'pit-card chamfer-all-corners';
        card.style.marginBottom = '10px';
        card.style.padding = '15px';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';

        const info = document.createElement('div');
        info.innerHTML = `
          <h4 style="color: var(--color-gold); margin: 0 0 5px 0;">${stint.name}</h4>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 5px;"><strong>Focus:</strong> ${stint.focus}</div>
          <div style="font-size: 11px; color: var(--color-text-muted);">${stint.guide}</div>
          <div style="font-size: 10px; margin-top: 8px; color: var(--color-f1-red);">Suggested: ${stint.car} @ ${stint.track}</div>
        `;
        card.appendChild(info);

        const btnStart = document.createElement('button');
        btnStart.className = 'btn btn-secondary chamfer-br';
        btnStart.textContent = 'START STINT';
        btnStart.addEventListener('click', () => this.startStint(stint));
        
        card.appendChild(btnStart);
        this.listContainer.appendChild(card);
      });
    });
  }

  startStint(stint) {
    this.mainContainer.style.display = 'none';
    this.hudContainer.style.display = 'block';
    
    document.getElementById('live-hud-title').textContent = \`Live HUD - \${stint.name}\`;
    
    this.hud.startStint(stint);
  }

  stopStint() {
    this.hud.stopStint();
    
    this.hudContainer.style.display = 'none';
    this.mainContainer.style.display = 'block';
  }
}
