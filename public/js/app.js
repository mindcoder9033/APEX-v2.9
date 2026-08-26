/**
 * APEX Pit-Wall UI Controller & Application Bootstrap
 */

import { ApexWsClient } from './ws-client.js';
import { HudRenderer } from './hud-renderer.js';
import { SessionManager } from './session-manager.js';
import { GridLayoutManager } from './components/grid-layout-manager.js';
import { TrackLibraryView } from './track-library-view.js';

class ApexApp {
  constructor() {
    window.apexApp = this;

    this.hud = new HudRenderer();
    this.session = new SessionManager();
    this.layoutManager = new GridLayoutManager();
    this.trackLibrary = new TrackLibraryView();

    // Rebind HUD and Session now that all components exist
    this.layoutManager.rebindTelemetryElements();

    // Settings Modal elements
    this.modalBackdrop = document.getElementById('settings-modal');
    this.btnOpenSettings = document.getElementById('btn-open-settings');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnSaveSettings = document.getElementById('btn-save-settings');

    // UDP Guide Modal elements
    this.modalUdpGuide = document.getElementById('udp-guide-modal');
    this.btnOpenUdpGuide = document.getElementById('btn-open-udp-guide');
    this.btnCloseUdpGuide = document.getElementById('btn-close-udp-guide');
    this.btnUnderstoodUdp = document.getElementById('btn-understood-udp');

    this.inputUdpPort = document.getElementById('setting-udp-port');
    this.inputWsUrl = document.getElementById('setting-ws-url');
    this.inputDriverName = document.getElementById('setting-driver-name');
    this.inputSessionName = document.getElementById('setting-session-name');
    this.selectSpeedUnit = document.getElementById('setting-speed-unit');

    this.statusPill = document.getElementById('status-pill');
    this.statusText = document.getElementById('status-text');
    this.rateText = document.getElementById('rate-text');

    this.wsClient = new ApexWsClient({
      url: this.session.settings.wsUrl,
      autoReconnect: true
    });

    this.init();
  }

  init() {
    this.populateSettingsForm();
    this.bindEvents();
    this.connectBridge();
  }

  populateSettingsForm() {
    const s = this.session.settings;
    if (this.inputUdpPort) this.inputUdpPort.value = s.udpPort;
    if (this.inputWsUrl) this.inputWsUrl.value = s.wsUrl;
    if (this.inputDriverName) this.inputDriverName.value = s.driverName;
    if (this.inputSessionName) this.inputSessionName.value = s.sessionName;
    if (this.selectSpeedUnit) this.selectSpeedUnit.value = s.speedUnit;

    const displaySessionName = document.getElementById('display-session-name');
    if (displaySessionName) displaySessionName.textContent = s.sessionName;
  }

  bindEvents() {
    // Settings modal
    if (this.btnOpenSettings) {
      this.btnOpenSettings.addEventListener('click', () => {
        this.openSettings();
      });
    }

    if (this.btnCloseSettings) {
      this.btnCloseSettings.addEventListener('click', () => {
        this.closeSettings();
      });
    }

    if (this.btnSaveSettings) {
      this.btnSaveSettings.addEventListener('click', () => {
        this.saveSettings();
      });
    }

    // UDP Guide modal
    if (this.btnOpenUdpGuide) {
      this.btnOpenUdpGuide.addEventListener('click', () => {
        this.openUdpGuide();
      });
    }

    if (this.btnCloseUdpGuide) {
      this.btnCloseUdpGuide.addEventListener('click', () => {
        this.closeUdpGuide();
      });
    }

    if (this.btnUnderstoodUdp) {
      this.btnUnderstoodUdp.addEventListener('click', () => {
        this.closeUdpGuide();
      });
    }

    // Close on backdrop click
    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === this.modalBackdrop) {
          this.closeSettings();
        }
      });
    }

    if (this.modalUdpGuide) {
      this.modalUdpGuide.addEventListener('click', (e) => {
        if (e.target === this.modalUdpGuide) {
          this.closeUdpGuide();
        }
      });
    }

    // Empty state return to pitwall button
    const btnEmptyReturn = document.getElementById('btn-empty-return-pitwall');
    if (btnEmptyReturn) {
      btnEmptyReturn.addEventListener('click', () => {
        if (this.trackLibrary) this.trackLibrary.hideView();
      });
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.session.toggleRecording();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        if (this.trackLibrary) {
          const isHidden = !this.trackLibrary.viewTrackLibrary || this.trackLibrary.viewTrackLibrary.style.display === 'none';
          if (isHidden) this.trackLibrary.showView();
          else this.trackLibrary.hideView();
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.openSettings();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this.openUdpGuide();
      } else if (e.key === 'Escape') {
        this.closeSettings();
        this.closeUdpGuide();
      }
    });

    // Speed unit change button
    const btnToggleUnit = document.getElementById('btn-toggle-unit');
    if (btnToggleUnit) {
      btnToggleUnit.addEventListener('click', () => {
        const newUnit = this.session.settings.speedUnit === 'mph' ? 'kmh' : 'mph';
        this.session.saveSettings({ speedUnit: newUnit });
        if (this.selectSpeedUnit) this.selectSpeedUnit.value = newUnit;
      });
    }
  }

  connectBridge() {
    this.setStatus('connecting', 'Connecting...');

    this.wsClient.on('connected', () => {
      if (this.wsClient.stats.packetsReceived > 0) {
        this.setStatus('connected', 'Live 60Hz');
      } else {
        this.setStatus('connecting', 'Bridge Online (Awaiting UDP)');
      }
    });

    this.wsClient.on('disconnected', () => {
      this.setStatus('disconnected', 'Bridge Offline');
      if (this.rateText) {
        this.rateText.textContent = '0 pkt/s';
      }
    });

    this.wsClient.on('status', (data) => {
      if (data && data.connected && this.wsClient.stats.packetsReceived === 0) {
        this.setStatus('connecting', 'Bridge Online (Awaiting UDP)');
      }
    });

    this.wsClient.on('telemetry', (sample) => {
      this.setStatus('connected', 'Live 60Hz');
      this.hud.update(sample, this.session.settings.speedUnit);
      this.session.processSample(sample);

      if (this.rateText) {
        this.rateText.textContent = `${this.wsClient.stats.packetsPerSecond} pkt/s`;
      }
    });

    this.wsClient.connect();
  }

  setStatus(state, label) {
    if (!this.statusPill) return;
    this.statusPill.className = `status-pill ${state} chamfer-all-corners`;
    if (this.statusText) this.statusText.textContent = label;
  }

  openSettings() {
    this.populateSettingsForm();
    if (this.modalBackdrop) this.modalBackdrop.classList.add('active');
  }

  closeSettings() {
    if (this.modalBackdrop) this.modalBackdrop.classList.remove('active');
  }

  openUdpGuide() {
    if (this.modalUdpGuide) this.modalUdpGuide.classList.add('active');
  }

  closeUdpGuide() {
    if (this.modalUdpGuide) this.modalUdpGuide.classList.remove('active');
  }

  saveSettings() {
    const updated = {
      udpPort: parseInt(this.inputUdpPort.value, 10) || 9999,
      wsUrl: this.inputWsUrl.value.trim() || 'ws://127.0.0.1:8080',
      driverName: this.inputDriverName.value.trim() || 'APEX Driver',
      sessionName: this.inputSessionName.value.trim() || 'Track Day Session',
      speedUnit: 'kmh'
    };

    this.session.saveSettings(updated);
    this.populateSettingsForm();
    this.closeSettings();

    // If WebSocket URL changed, reconnect
    if (updated.wsUrl !== this.wsClient.url) {
      this.wsClient.disconnect();
      this.wsClient = new ApexWsClient({ url: updated.wsUrl, autoReconnect: true });
      this.connectBridge();
    }
  }
}

// Bootstrap safely regardless of readyState
function bootstrapApexApp() {
  if (!window.apexApp) {
    window.apexApp = new ApexApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApexApp);
} else {
  bootstrapApexApp();
}
