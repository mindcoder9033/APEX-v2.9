/**
 * StintMetadataModal Component
 * Prompts the driver for mandatory session metadata (Session Name, Track, Layout, Car)
 * upon ending a stint recording.
 */

import { FM23_TRACKS } from '../data/fm23-tracks.js';
import { FM23_CARS } from '../data/fm23-cars.js';
import { SearchableSelect } from './searchable-select.js';

export class StintMetadataModal {
  constructor() {
    this.modalEl = document.getElementById('stint-metadata-modal');
    this.inputSessionName = document.getElementById('stint-input-session-name');
    this.errorSessionName = document.getElementById('stint-error-session-name');
    this.containerTrack = document.getElementById('stint-select-track-container');
    this.containerLayout = document.getElementById('stint-select-layout-container');
    this.containerCar = document.getElementById('stint-select-car-container');
    this.driverInheritedVal = document.getElementById('stint-inherited-driver-name');
    this.btnConfirm = document.getElementById('btn-confirm-stint-metadata');

    this.resolvePromise = null;
    this.selectedTrackData = null;

    this.initSelects();
    this.bindEvents();
  }

  initSelects() {
    // 1. Track Options
    const trackOptions = FM23_TRACKS.map(t => ({
      value: t.name,
      label: t.name,
      group: `${t.type} Circuits`,
      sublabel: `${t.layouts.length} layout${t.layouts.length > 1 ? 's' : ''}`
    }));

    this.trackSelect = new SearchableSelect({
      container: this.containerTrack,
      id: 'stint-track',
      placeholder: 'Select Circuit...',
      options: trackOptions,
      onSelect: (item) => this.onTrackSelected(item.value)
    });

    // 2. Layout Options (Initially empty until track selected)
    this.layoutSelect = new SearchableSelect({
      container: this.containerLayout,
      id: 'stint-layout',
      placeholder: 'Select Layout...',
      options: [],
      onSelect: () => this.clearErrors()
    });

    // 3. Car Options
    const carOptions = FM23_CARS.map(c => ({
      value: c.name,
      label: c.name,
      group: c.manufacturer
    }));

    this.carSelect = new SearchableSelect({
      container: this.containerCar,
      id: 'stint-car',
      placeholder: 'Search Car by make, model, or class...',
      options: carOptions,
      onSelect: () => this.clearErrors()
    });
  }

  bindEvents() {
    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => {
        this.submitForm();
      });
    }

    if (this.inputSessionName) {
      this.inputSessionName.addEventListener('input', () => {
        this.clearErrors();
      });
      this.inputSessionName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitForm();
        }
      });
    }
  }

  onTrackSelected(trackName) {
    this.clearErrors();
    const trackObj = FM23_TRACKS.find(t => t.name === trackName);
    this.selectedTrackData = trackObj;

    if (trackObj && trackObj.layouts && trackObj.layouts.length > 0) {
      const layoutOptions = trackObj.layouts.map(l => ({
        value: l.name,
        label: l.name,
        sublabel: l.length
      }));

      // Automatically preselect the primary / first layout
      this.layoutSelect.setOptions(layoutOptions, layoutOptions[0].value);
    } else {
      this.layoutSelect.setOptions([]);
    }
  }

  /**
   * Prompts the user with the modal and returns a promise resolving to metadata
   * @param {Object} [context]
   * @param {string} [context.driverName] - Driver name from settings
   * @param {string} [context.sessionName] - Optional session name prefill
   * @param {string} [context.defaultCar] - Optional default car
   * @param {number} [context.totalLaps] - Total laps completed
   * @param {number} [context.totalSamples] - Total samples recorded
   * @returns {Promise<Object>}
   */
  prompt(context = {}) {
    return this.open(context);
  }

  /**
   * Opens the modal and returns a promise resolving to metadata
   * @param {Object} [context]
   * @param {string} [context.driverName] - Driver name from settings
   * @param {string} [context.sessionName] - Optional session name prefill
   * @param {string} [context.defaultCar] - Optional default car
   * @returns {Promise<Object>}
   */
  open({ driverName = 'APEX Driver', sessionName = '', defaultCar = null } = {}) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      if (this.driverInheritedVal) {
        this.driverInheritedVal.textContent = driverName;
      }

      // Pre-fill or reset inputs
      if (this.inputSessionName) {
        this.inputSessionName.value = sessionName || '';
        this.inputSessionName.classList.remove('input-error');
      }
      this.clearErrors();

      // Default selections if not already set
      if (!this.trackSelect.getValue()) {
        const defaultTrack = FM23_TRACKS[0]; // Brands Hatch
        this.trackSelect.setValue(defaultTrack.name, true);
      }

      if (defaultCar) {
        this.carSelect.setValue(defaultCar, false);
      } else if (!this.carSelect.getValue()) {
        const defaultCarItem = FM23_CARS.find(c => c.name.includes('GT3')) || FM23_CARS[0];
        this.carSelect.setValue(defaultCarItem.name, false);
      }

      if (this.modalEl) {
        this.modalEl.classList.add('active');
        setTimeout(() => {
          if (this.inputSessionName) {
            this.inputSessionName.focus();
            if (this.inputSessionName.value) {
              this.inputSessionName.select();
            }
          }
        }, 100);
      }
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
  }

  clearErrors() {
    if (this.errorSessionName) {
      this.errorSessionName.textContent = '';
      this.errorSessionName.style.display = 'none';
    }
    if (this.inputSessionName) {
      this.inputSessionName.classList.remove('input-error');
    }
  }

  showError(msg) {
    if (this.errorSessionName) {
      this.errorSessionName.textContent = msg;
      this.errorSessionName.style.display = 'block';
    }
    if (this.inputSessionName) {
      this.inputSessionName.classList.add('input-error');
      this.inputSessionName.focus();
    }
  }

  submitForm() {
    const sessionName = (this.inputSessionName?.value || '').trim();
    const track = this.trackSelect.getValue();
    const layout = this.layoutSelect.getValue();
    const car = this.carSelect.getValue();

    if (!sessionName) {
      this.showError('Session name is required to log and export this stint.');
      return;
    }

    if (!track) {
      this.showError('Please select a track circuit.');
      return;
    }

    if (!layout) {
      this.showError('Please select a track layout.');
      return;
    }

    if (!car) {
      this.showError('Please select a car from the vehicle roster.');
      return;
    }

    const metadata = {
      sessionName,
      trackName: `${track} — ${layout}`,
      circuit: track,
      layout,
      carName: car
    };

    this.close();

    if (typeof this.resolvePromise === 'function') {
      this.resolvePromise(metadata);
      this.resolvePromise = null;
    }
  }
}
