/**
 * APEX First-Launch Driver Setup Wizard Modal
 * Greets new drivers on their first session and configures their primary profile.
 */

import { driverProfileStore } from '../driver-profile-store.js';

export class DriverWizardModal {
  constructor(containerId = 'modal-driver-wizard-container') {
    this.container = document.getElementById(containerId);
    this.initWizardHtml();
    this.bindEvents();
  }

  initWizardHtml() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'modal-driver-wizard-container';
      document.body.appendChild(this.container);
    }

    this.container.innerHTML = `
      <div id="modal-driver-wizard" class="apex-modal-backdrop hidden">
        <div class="apex-modal-card wizard-modal-card">
          <!-- Header Graphic -->
          <div class="wizard-header">
            <div class="wizard-logo-tag">APEX TELEMETRY COMMAND CENTER</div>
            <h2 class="wizard-title">WELCOME TO THE PIT-WALL</h2>
            <p class="wizard-subtitle">Configure your telemetry driver dossier to begin tracking stints, telemetry telemetry, and circuit personal bests.</p>
          </div>

          <!-- Wizard Setup Form -->
          <form id="wizard-form" class="wizard-form">
            <div class="wizard-grid">
              <div class="dossier-form-group">
                <label for="wizard-input-name">Driver Name</label>
                <input type="text" id="wizard-input-name" class="dossier-input" maxlength="32" placeholder="e.g. Max Verstappen" value="APEX Driver" required />
              </div>

              <div class="dossier-form-group">
                <label for="wizard-input-number">Racing Number (#)</label>
                <input type="text" id="wizard-input-number" class="dossier-input" maxlength="4" placeholder="01" value="01" required />
              </div>

              <div class="dossier-form-group">
                <label for="wizard-input-team">Racing Team / Constructor</label>
                <input type="text" id="wizard-input-team" class="dossier-input" maxlength="40" placeholder="e.g. Red Bull Racing" value="Privateer Motorsport" />
              </div>

              <div class="dossier-form-group">
                <label for="wizard-select-tier">Experience Tier</label>
                <select id="wizard-select-tier" class="dossier-select">
                  <option value="Rookie">Rookie (Track Day Novice)</option>
                  <option value="Club" selected>Club (Clubman / HPDE)</option>
                  <option value="Pro">Pro (National / GT3)</option>
                  <option value="Elite">Elite (Pinnacle / F1)</option>
                </select>
              </div>

              <div class="dossier-form-group">
                <label for="wizard-select-units">Speed Units</label>
                <select id="wizard-select-units" class="dossier-select">
                  <option value="kmh" selected>Kilometers per Hour (km/h)</option>
                  <option value="mph">Miles per Hour (mph)</option>
                </select>
              </div>

              <div class="dossier-form-group">
                <label for="wizard-select-layout">Preferred Cockpit Layout</label>
                <select id="wizard-select-layout" class="dossier-select">
                  <option value="default" selected>Default Pit-Wall Master</option>
                  <option value="driver">Driver Cockpit Focus</option>
                  <option value="coach">Skip Barber Coaching</option>
                  <option value="engineer">Vehicle Dynamics Engineer</option>
                </select>
              </div>

              <div class="dossier-form-group full-width">
                <label>Livery & Telemetry Accent Color</label>
                <div class="dossier-color-picker" id="wizard-color-picker">
                  <button type="button" class="color-chip active" data-color="#e10600" style="background:#e10600;" title="APEX Red"></button>
                  <button type="button" class="color-chip" data-color="#ff8700" style="background:#ff8700;" title="McLaren Papaya"></button>
                  <button type="button" class="color-chip" data-color="#00d2be" style="background:#00d2be;" title="Mercedes Teal"></button>
                  <button type="button" class="color-chip" data-color="#00a0de" style="background:#00a0de;" title="Williams Cyan"></button>
                  <button type="button" class="color-chip" data-color="#00a389" style="background:#00a389;" title="Aston Emerald"></button>
                  <button type="button" class="color-chip" data-color="#9b51e0" style="background:#9b51e0;" title="Racing Violet"></button>
                </div>
              </div>
            </div>

            <div class="wizard-actions">
              <button type="button" class="apex-btn btn-secondary" id="wizard-btn-import">📂 Import Existing .apexprofile</button>
              <button type="submit" class="apex-btn btn-primary" id="wizard-btn-start">Initialize Driver Dossier & Enter APEX 🏁</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const form = document.getElementById('wizard-form');
    const colorPicker = document.getElementById('wizard-color-picker');
    let selectedColor = '#e10600';

    if (colorPicker) {
      const chips = colorPicker.querySelectorAll('.color-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          selectedColor = chip.dataset.color;
        });
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('wizard-input-name');
        const numInput = document.getElementById('wizard-input-number');
        const teamInput = document.getElementById('wizard-input-team');
        const tierSelect = document.getElementById('wizard-select-tier');
        const unitSelect = document.getElementById('wizard-select-units');
        const layoutSelect = document.getElementById('wizard-select-layout');

        const profile = driverProfileStore.createDefaultProfile(
          nameInput.value,
          numInput.value,
          teamInput.value,
          tierSelect.value
        );
        profile.color = selectedColor;
        profile.preferences.speedUnit = unitSelect.value;
        profile.preferences.layoutPreset = layoutSelect.value;

        try {
          await driverProfileStore.saveProfile(profile);
          await driverProfileStore.setActiveProfile(profile.id);
          this.close();
        } catch (err) {
          alert(`Failed to save driver profile: ${err.message}`);
        }
      });
    }

    const importBtn = document.getElementById('wizard-btn-import');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        try {
          const res = await driverProfileStore.importProfile();
          if (res && res.success) {
            this.close();
          }
        } catch (err) {
          alert(`Import failed: ${err.message}`);
        }
      });
    }
  }

  open() {
    const backdrop = document.getElementById('modal-driver-wizard');
    if (backdrop) backdrop.classList.remove('hidden');
  }

  close() {
    const backdrop = document.getElementById('modal-driver-wizard');
    if (backdrop) backdrop.classList.add('hidden');
  }
}
