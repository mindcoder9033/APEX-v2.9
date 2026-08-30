/**
 * APEX Driver Dossier Modal
 * Comprehensive UI component for inspecting and managing driver identity,
 * motorsport career statistics, track personal bests, UI preferences,
 * and profile export/import portability.
 */

import { driverProfileStore } from '../driver-profile-store.js';

export class DriverDossierModal {
  constructor(containerId = 'modal-driver-dossier-container') {
    this.container = document.getElementById(containerId);
    this.currentTab = 'identity';
    this.editingProfile = null;
    this.initModalHtml();
    this.bindEvents();
  }

  initModalHtml() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'modal-driver-dossier-container';
      document.body.appendChild(this.container);
    }

    this.container.innerHTML = `
      <div id="modal-driver-dossier" class="apex-modal-backdrop hidden">
        <div class="apex-modal-card dossier-modal-card">
          <!-- Modal Header -->
          <div class="dossier-modal-header">
            <div class="dossier-header-title-block">
              <span class="dossier-tag">APEX MOTORSPORT TELEMETRY</span>
              <h2 class="dossier-title">DRIVER DOSSIER // COMMAND CENTER</h2>
            </div>
            <div class="dossier-header-actions">
              <button type="button" class="dossier-close-btn" id="dossier-btn-close" title="Close Dossier">✕</button>
            </div>
          </div>

          <!-- Active Driver Hero Ribbon -->
          <div class="dossier-hero-ribbon" id="dossier-hero-ribbon">
            <div class="hero-driver-badge" id="dossier-hero-badge" style="border-color: #e10600;">
              <span class="hero-driver-number" id="dossier-hero-number">#01</span>
            </div>
            <div class="hero-driver-info">
              <div class="hero-driver-name-row">
                <span class="hero-driver-name" id="dossier-hero-name">APEX Driver</span>
                <span class="hero-tier-badge tier-club" id="dossier-hero-tier">CLUB</span>
              </div>
              <div class="hero-driver-team" id="dossier-hero-team">Privateer Motorsport</div>
            </div>
            <div class="hero-stats-quick">
              <div class="hero-stat-item">
                <span class="hero-stat-label">TOTAL LAPS</span>
                <span class="hero-stat-val" id="dossier-hero-laps">0</span>
              </div>
              <div class="hero-stat-item">
                <span class="hero-stat-label">TRACK TIME</span>
                <span class="hero-stat-val" id="dossier-hero-time">0h 00m</span>
              </div>
              <div class="hero-stat-item">
                <span class="hero-stat-label">DISTANCE</span>
                <span class="hero-stat-val" id="dossier-hero-dist">0.0 km</span>
              </div>
            </div>
          </div>

          <!-- Dossier Tabs -->
          <div class="dossier-tabs-nav">
            <button type="button" class="dossier-tab-btn active" data-tab="identity">Identity & Setup</button>
            <button type="button" class="dossier-tab-btn" data-tab="stats">Career Stats & PBs</button>
            <button type="button" class="dossier-tab-btn" data-tab="preferences">Preferences</button>
            <button type="button" class="dossier-tab-btn" data-tab="manage">Switch & Manage</button>
          </div>

          <!-- Tab 1: Identity & Setup -->
          <div class="dossier-tab-content active" id="dossier-tab-identity">
            <form id="dossier-form-identity" class="dossier-grid-form">
              <div class="dossier-form-group">
                <label for="dossier-input-name">Driver Name</label>
                <input type="text" id="dossier-input-name" class="dossier-input" maxlength="32" placeholder="e.g. Max Verstappen" required />
              </div>

              <div class="dossier-form-group">
                <label for="dossier-input-number">Racing Number (#)</label>
                <input type="text" id="dossier-input-number" class="dossier-input" maxlength="4" placeholder="01" required />
              </div>

              <div class="dossier-form-group">
                <label for="dossier-input-team">Racing Team / Constructor</label>
                <input type="text" id="dossier-input-team" class="dossier-input" maxlength="40" placeholder="e.g. Red Bull Racing" />
              </div>

              <div class="dossier-form-group">
                <label for="dossier-select-tier">Skill Tier</label>
                <select id="dossier-select-tier" class="dossier-select">
                  <option value="Rookie">Rookie (Track Day Novice)</option>
                  <option value="Club" selected>Club (Clubman / HPDE)</option>
                  <option value="Pro">Pro (National / GT3)</option>
                  <option value="Elite">Elite (Pinnacle / F1)</option>
                </select>
              </div>

              <div class="dossier-form-group full-width">
                <label>Livery & Telemetry Accent Color</label>
                <div class="dossier-color-picker">
                  <button type="button" class="color-chip active" data-color="#e10600" style="background:#e10600;" title="APEX Red"></button>
                  <button type="button" class="color-chip" data-color="#ff8700" style="background:#ff8700;" title="McLaren Papaya"></button>
                  <button type="button" class="color-chip" data-color="#00d2be" style="background:#00d2be;" title="Mercedes Teal"></button>
                  <button type="button" class="color-chip" data-color="#00a0de" style="background:#00a0de;" title="Williams Cyan"></button>
                  <button type="button" class="color-chip" data-color="#00594f" style="background:#00a389;" title="Aston Emerald"></button>
                  <button type="button" class="color-chip" data-color="#9b51e0" style="background:#9b51e0;" title="Racing Violet"></button>
                  <button type="button" class="color-chip" data-color="#ffffff" style="background:#ffffff;" title="Monochrome White"></button>
                </div>
              </div>
            </form>
          </div>

          <!-- Tab 2: Career Stats & PBs -->
          <div class="dossier-tab-content" id="dossier-tab-stats">
            <div class="dossier-stats-summary-grid">
              <div class="dossier-metric-card">
                <span class="metric-label">TOTAL STINTS</span>
                <span class="metric-value" id="dossier-stat-stints">0</span>
              </div>
              <div class="dossier-metric-card">
                <span class="metric-label">LAPS LOGGED</span>
                <span class="metric-value" id="dossier-stat-laps">0</span>
              </div>
              <div class="dossier-metric-card">
                <span class="metric-label">DISTANCE LOGGED</span>
                <span class="metric-value" id="dossier-stat-distance">0.0 km</span>
              </div>
              <div class="dossier-metric-card">
                <span class="metric-label">TOTAL ON-TRACK TIME</span>
                <span class="metric-value" id="dossier-stat-time">0h 00m 00s</span>
              </div>
            </div>

            <h4 class="dossier-section-subtitle">CIRCUIT PERSONAL BESTS (PB)</h4>
            <div class="dossier-pb-table-container">
              <table class="dossier-pb-table">
                <thead>
                  <tr>
                    <th>Circuit & Layout</th>
                    <th>Vehicle</th>
                    <th>Class</th>
                    <th>Personal Best Lap</th>
                    <th>Date Logged</th>
                  </tr>
                </thead>
                <tbody id="dossier-pb-tbody">
                  <tr>
                    <td colspan="5" class="dossier-empty-row">No stint laps recorded yet for this driver.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tab 3: Preferences -->
          <div class="dossier-tab-content" id="dossier-tab-preferences">
            <div class="dossier-grid-form">
              <div class="dossier-form-group">
                <label for="dossier-pref-unit">Telemetry Speed Units</label>
                <select id="dossier-pref-unit" class="dossier-select">
                  <option value="kmh" selected>Kilometers per Hour (km/h)</option>
                  <option value="mph">Miles per Hour (mph)</option>
                </select>
              </div>

              <div class="dossier-form-group">
                <label for="dossier-pref-layout">Default HUD Layout</label>
                <select id="dossier-pref-layout" class="dossier-select">
                  <option value="default">Default Pit-Wall Master</option>
                  <option value="driver">Driver Cockpit Focus</option>
                  <option value="coach">Skip Barber Coaching</option>
                  <option value="engineer">Vehicle Dynamics Engineer</option>
                </select>
              </div>

              <div class="dossier-form-group full-width">
                <label class="dossier-checkbox-label">
                  <input type="checkbox" id="dossier-pref-auto-archive" checked />
                  <span>Auto-Archive Generated PDF Stint Reports to <code>Documents/APEX v2.9/user/</code></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Tab 4: Switch & Manage -->
          <div class="dossier-tab-content" id="dossier-tab-manage">
            <div class="dossier-manage-actions-row">
              <button type="button" class="apex-btn btn-secondary" id="dossier-btn-create-new">+ Create New Driver</button>
              <button type="button" class="apex-btn btn-secondary" id="dossier-btn-import">📂 Import Profile</button>
              <button type="button" class="apex-btn btn-secondary" id="dossier-btn-export">💾 Export Dossier (.apexprofile)</button>
              <button type="button" class="apex-btn btn-secondary" id="dossier-btn-open-folder">📁 Open Profiles Folder</button>
            </div>

            <h4 class="dossier-section-subtitle">AVAILABLE DRIVER PROFILES</h4>
            <div class="dossier-profile-list" id="dossier-profile-list">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="dossier-modal-footer">
            <div class="dossier-footer-left">
              <button type="button" class="dossier-danger-btn hidden" id="dossier-btn-delete">Delete Profile</button>
            </div>
            <div class="dossier-footer-right">
              <button type="button" class="apex-btn btn-secondary" id="dossier-btn-cancel">Cancel</button>
              <button type="button" class="apex-btn btn-primary" id="dossier-btn-save">Save Profile Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Tab switching
    const tabBtns = this.container.querySelectorAll('.dossier-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Close buttons
    const closeBtn = document.getElementById('dossier-btn-close');
    const cancelBtn = document.getElementById('dossier-btn-cancel');
    const backdrop = document.getElementById('modal-driver-dossier');

    const hideModal = () => this.close();
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) hideModal();
      });
    }

    // Color chips
    const colorChips = this.container.querySelectorAll('.color-chip');
    colorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        colorChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (this.editingProfile) {
          this.editingProfile.color = chip.dataset.color;
          this.updateHeroPreview();
        }
      });
    });

    // Live preview updates on input changes
    const nameInput = document.getElementById('dossier-input-name');
    const numInput = document.getElementById('dossier-input-number');
    const teamInput = document.getElementById('dossier-input-team');
    const tierSelect = document.getElementById('dossier-select-tier');

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        if (this.editingProfile) this.editingProfile.name = nameInput.value;
        this.updateHeroPreview();
      });
    }
    if (numInput) {
      numInput.addEventListener('input', () => {
        if (this.editingProfile) this.editingProfile.number = numInput.value;
        this.updateHeroPreview();
      });
    }
    if (teamInput) {
      teamInput.addEventListener('input', () => {
        if (this.editingProfile) this.editingProfile.team = teamInput.value;
        this.updateHeroPreview();
      });
    }
    if (tierSelect) {
      tierSelect.addEventListener('change', () => {
        if (this.editingProfile) this.editingProfile.tier = tierSelect.value;
        this.updateHeroPreview();
      });
    }

    // Save profile button
    const saveBtn = document.getElementById('dossier-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }

    // Delete profile button
    const deleteBtn = document.getElementById('dossier-btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.handleDelete());
    }

    // Create new driver button
    const createBtn = document.getElementById('dossier-btn-create-new');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.handleCreateNew());
    }

    // Export button
    const exportBtn = document.getElementById('dossier-btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        if (!this.editingProfile) return;
        try {
          await driverProfileStore.exportProfile(this.editingProfile.id);
        } catch (err) {
          alert(`Failed to export profile: ${err.message}`);
        }
      });
    }

    // Import button
    const importBtn = document.getElementById('dossier-btn-import');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        try {
          const res = await driverProfileStore.importProfile();
          if (res && res.success && res.profile) {
            this.open(res.profile.id);
          }
        } catch (err) {
          alert(`Failed to import profile: ${err.message}`);
        }
      });
    }

    // Open folder button
    const folderBtn = document.getElementById('dossier-btn-open-folder');
    if (folderBtn) {
      folderBtn.addEventListener('click', async () => {
        const res = await driverProfileStore.openFolder();
        if (!res.success && res.error) {
          alert(res.error);
        }
      });
    }
  }

  switchTab(tabKey) {
    this.currentTab = tabKey;
    const tabBtns = this.container.querySelectorAll('.dossier-tab-btn');
    const contents = this.container.querySelectorAll('.dossier-tab-content');

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    contents.forEach(content => {
      content.classList.toggle('active', content.id === `dossier-tab-${tabKey}`);
    });

    if (tabKey === 'manage') {
      this.renderProfileList();
    }
  }

  async open(profileId = null) {
    let active = null;
    if (profileId) {
      active = await driverProfileStore.getProfileById(profileId);
    }
    if (!active) {
      active = driverProfileStore.getActiveProfile();
    }
    if (!active) {
      active = driverProfileStore.createDefaultProfile();
    }

    // Clone to edit safely
    this.editingProfile = JSON.parse(JSON.stringify(active));
    this.populateFields();
    this.switchTab(this.currentTab || 'identity');

    const backdrop = document.getElementById('modal-driver-dossier');
    if (backdrop) backdrop.classList.remove('hidden');
  }

  close() {
    const backdrop = document.getElementById('modal-driver-dossier');
    if (backdrop) backdrop.classList.add('hidden');
    this.editingProfile = null;
  }

  populateFields() {
    if (!this.editingProfile) return;
    const p = this.editingProfile;

    // Inputs
    const nameInput = document.getElementById('dossier-input-name');
    const numInput = document.getElementById('dossier-input-number');
    const teamInput = document.getElementById('dossier-input-team');
    const tierSelect = document.getElementById('dossier-select-tier');
    const unitSelect = document.getElementById('dossier-pref-unit');
    const layoutSelect = document.getElementById('dossier-pref-layout');
    const archiveCheckbox = document.getElementById('dossier-pref-auto-archive');

    if (nameInput) nameInput.value = p.name || '';
    if (numInput) numInput.value = p.number || '';
    if (teamInput) teamInput.value = p.team || '';
    if (tierSelect) tierSelect.value = p.tier || 'Club';
    if (unitSelect) unitSelect.value = p.preferences?.speedUnit || 'kmh';
    if (layoutSelect) layoutSelect.value = p.preferences?.layoutPreset || 'driver';
    if (archiveCheckbox) archiveCheckbox.checked = p.preferences?.autoArchiveReports !== false;

    // Color chips
    const colorChips = this.container.querySelectorAll('.color-chip');
    colorChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.color === (p.color || '#e10600'));
    });

    // Delete button visibility (hide if only 1 profile or guest)
    const deleteBtn = document.getElementById('dossier-btn-delete');
    const allProfiles = driverProfileStore.getAllProfiles();
    if (deleteBtn) {
      deleteBtn.classList.toggle('hidden', allProfiles.length <= 1);
    }

    this.updateHeroPreview();
    this.renderStatsTab();
  }

  updateHeroPreview() {
    if (!this.editingProfile) return;
    const p = this.editingProfile;

    const heroBadge = document.getElementById('dossier-hero-badge');
    const heroNum = document.getElementById('dossier-hero-number');
    const heroName = document.getElementById('dossier-hero-name');
    const heroTier = document.getElementById('dossier-hero-tier');
    const heroTeam = document.getElementById('dossier-hero-team');
    const heroLaps = document.getElementById('dossier-hero-laps');
    const heroTime = document.getElementById('dossier-hero-time');
    const heroDist = document.getElementById('dossier-hero-dist');

    const color = p.color || '#e10600';
    if (heroBadge) heroBadge.style.borderColor = color;
    if (heroNum) {
      heroNum.textContent = `#${p.number || '01'}`;
      heroNum.style.color = color;
    }
    if (heroName) heroName.textContent = p.name || 'APEX Driver';
    if (heroTeam) heroTeam.textContent = p.team || 'Privateer Motorsport';

    if (heroTier) {
      heroTier.textContent = (p.tier || 'CLUB').toUpperCase();
      heroTier.className = `hero-tier-badge tier-${(p.tier || 'club').toLowerCase()}`;
    }

    const stats = p.careerStats || { totalLaps: 0, totalDistanceKm: 0, totalTrackTimeSec: 0 };
    if (heroLaps) heroLaps.textContent = stats.totalLaps.toLocaleString();
    if (heroDist) heroDist.textContent = `${stats.totalDistanceKm.toFixed(1)} km`;

    if (heroTime) {
      const hours = Math.floor(stats.totalTrackTimeSec / 3600);
      const mins = Math.floor((stats.totalTrackTimeSec % 3600) / 60);
      heroTime.textContent = `${hours}h ${String(mins).padStart(2, '0')}m`;
    }
  }

  renderStatsTab() {
    if (!this.editingProfile) return;
    const stats = this.editingProfile.careerStats || { totalLaps: 0, totalDistanceKm: 0, totalTrackTimeSec: 0, stintsCompleted: 0, trackPersonalBests: {} };

    const statStints = document.getElementById('dossier-stat-stints');
    const statLaps = document.getElementById('dossier-stat-laps');
    const statDist = document.getElementById('dossier-stat-distance');
    const statTime = document.getElementById('dossier-stat-time');

    if (statStints) statStints.textContent = stats.stintsCompleted.toLocaleString();
    if (statLaps) statLaps.textContent = stats.totalLaps.toLocaleString();
    if (statDist) statDist.textContent = `${stats.totalDistanceKm.toFixed(1)} km`;

    if (statTime) {
      const h = Math.floor(stats.totalTrackTimeSec / 3600);
      const m = Math.floor((stats.totalTrackTimeSec % 3600) / 60);
      const s = stats.totalTrackTimeSec % 60;
      statTime.textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }

    // PBs Table
    const tbody = document.getElementById('dossier-pb-tbody');
    if (!tbody) return;

    const pbs = Object.values(stats.trackPersonalBests || {});
    if (pbs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="dossier-empty-row">No stint personal bests logged yet for this driver.</td></tr>`;
      return;
    }

    tbody.innerHTML = pbs.map(pb => {
      const mins = Math.floor(pb.lapTimeSec / 60);
      const secs = (pb.lapTimeSec % 60).toFixed(3);
      const formattedTime = `${mins}:${secs.padStart(6, '0')}`;
      const dateStr = pb.date ? new Date(pb.date).toLocaleDateString() : '—';

      return `
        <tr>
          <td><strong>${pb.trackName || 'Circuit'}</strong> <span class="dossier-layout-tag">${pb.layout || 'Standard'}</span></td>
          <td>${pb.car || 'Race Car'}</td>
          <td><span class="dossier-class-tag">${pb.carClass || 'GT'}</span></td>
          <td class="dossier-pb-time">${formattedTime}</td>
          <td>${dateStr}</td>
        </tr>
      `;
    }).join('');
  }

  renderProfileList() {
    const listContainer = document.getElementById('dossier-profile-list');
    if (!listContainer) return;

    const profiles = driverProfileStore.getAllProfiles();
    const active = driverProfileStore.getActiveProfile();

    if (profiles.length === 0) {
      listContainer.innerHTML = `<div class="dossier-empty-row">No profiles found.</div>`;
      return;
    }

    listContainer.innerHTML = profiles.map(p => {
      const isActive = active && active.id === p.id;
      const isEditing = this.editingProfile && this.editingProfile.id === p.id;

      return `
        <div class="dossier-profile-card ${isActive ? 'active-profile' : ''} ${isEditing ? 'editing-profile' : ''}">
          <div class="profile-card-badge" style="border-color: ${p.color || '#e10600'}; color: ${p.color || '#e10600'};">
            #${p.number || '01'}
          </div>
          <div class="profile-card-info">
            <div class="profile-card-name-row">
              <span class="profile-card-name">${p.name || 'Driver'}</span>
              <span class="hero-tier-badge tier-${(p.tier || 'club').toLowerCase()}">${(p.tier || 'CLUB').toUpperCase()}</span>
              ${isActive ? '<span class="active-badge">ACTIVE</span>' : ''}
            </div>
            <div class="profile-card-team">${p.team || 'Privateer'}</div>
          </div>
          <div class="profile-card-actions">
            ${!isActive ? `<button type="button" class="apex-btn btn-secondary btn-sm" data-action="switch" data-id="${p.id}">Activate</button>` : ''}
            <button type="button" class="apex-btn btn-secondary btn-sm" data-action="edit" data-id="${p.id}">Edit</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach switch and edit clicks
    listContainer.querySelectorAll('[data-action="switch"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await driverProfileStore.setActiveProfile(id);
        this.open(id);
      });
    });

    listContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.open(id);
      });
    });
  }

  async handleSave() {
    if (!this.editingProfile) return;

    const nameInput = document.getElementById('dossier-input-name');
    const numInput = document.getElementById('dossier-input-number');
    const teamInput = document.getElementById('dossier-input-team');
    const tierSelect = document.getElementById('dossier-select-tier');
    const unitSelect = document.getElementById('dossier-pref-unit');
    const layoutSelect = document.getElementById('dossier-pref-layout');
    const archiveCheckbox = document.getElementById('dossier-pref-auto-archive');

    const name = nameInput?.value.trim() || 'APEX Driver';
    const number = numInput?.value.trim() || '01';
    const team = teamInput?.value.trim() || 'Privateer Motorsport';
    const tier = tierSelect?.value || 'Club';
    const speedUnit = unitSelect?.value || 'kmh';
    const layoutPreset = layoutSelect?.value || 'driver';
    const autoArchiveReports = archiveCheckbox ? archiveCheckbox.checked : true;

    this.editingProfile.name = name;
    this.editingProfile.number = number;
    this.editingProfile.team = team;
    this.editingProfile.tier = tier;
    this.editingProfile.preferences = {
      ...this.editingProfile.preferences,
      speedUnit,
      layoutPreset,
      autoArchiveReports
    };

    try {
      await driverProfileStore.saveProfile(this.editingProfile);
      this.close();
    } catch (err) {
      alert(`Error saving driver profile: ${err.message}`);
    }
  }

  async handleDelete() {
    if (!this.editingProfile) return;
    const confirmDelete = confirm(`Are you sure you want to delete profile for "${this.editingProfile.name}" (#${this.editingProfile.number})? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await driverProfileStore.deleteProfile(this.editingProfile.id);
      const active = driverProfileStore.getActiveProfile();
      if (active) {
        this.open(active.id);
      } else {
        this.close();
      }
    } catch (err) {
      alert(`Failed to delete profile: ${err.message}`);
    }
  }

  handleCreateNew() {
    const newProfile = driverProfileStore.createDefaultProfile('New Driver', '99', 'Privateer Motorsport', 'Rookie');
    this.editingProfile = newProfile;
    this.populateFields();
    this.switchTab('identity');
  }
}
