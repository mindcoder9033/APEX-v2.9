/**
 * APEX Pit-Wall UI Controller & Application Bootstrap
 */

import { ApexWsClient } from './ws-client.js';
import { HudRenderer } from './hud-renderer.js';
import { SessionManager } from './session-manager.js';
import { GridLayoutManager } from './components/grid-layout-manager.js';
import { TrackLibraryView } from './track-library-view.js';
import { trackLibraryStore } from './track-library-store.js';
import { weatherProfileStore } from './weather-profile-store.js';
import { WeatherSimulator } from './analysis/weather-simulator.js';
import { StintsManager } from './stints.js';
import { IsometricTrackMap } from './components/isometric-track-map.js';
import { LoopbackModal } from './components/loopback-modal.js';

class ApexApp {
  constructor() {
    window.apexApp = this;

    this.hud = new HudRenderer();
    this.session = new SessionManager();
    this.layoutManager = new GridLayoutManager();
    this.trackLibrary = new TrackLibraryView();
    this.stintsManager = new StintsManager();
    this.loopbackModal = new LoopbackModal();
    this.trackMap3D = null;
    this.modalTrackMap3D = null;
    this.isMapModalOpen = false;
    this.mapRenderRequested = false;

    // Rebind HUD and Session now that all components exist
    this.layoutManager.rebindTelemetryElements();
    this.initTrackMap3D();

    // Settings Modal elements
    this.modalBackdrop = document.getElementById('settings-modal');
    this.btnOpenSettings = document.getElementById('btn-open-settings');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnSaveSettings = document.getElementById('btn-save-settings');

    // Fullscreen Toggle
    this.btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');

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

    // Primary Navigation Tab Buttons
    this.btnNavPitwall = document.getElementById('btn-nav-pitwall');
    this.btnNavTrackLibrary = document.getElementById('btn-nav-track-library');
    this.btnNavStints = document.getElementById('btn-nav-stints');

    // Primary View Containers
    this.viewPitwall = document.getElementById('view-pitwall');
    this.viewTrackLibrary = document.getElementById('view-track-library');
    this.viewStints = document.getElementById('view-stints');
    
    this.wsClient = new ApexWsClient({
      url: this.session.settings.wsUrl,
      autoReconnect: true
    });

    this.init();
  }

  init() {
    this.populateSettingsForm();
    this.bindEvents();
    this.initDesktopWindowControls();
    this.connectBridge();
    this._migrateWeatherProfiles();
  }

  /**
   * Initializes Electron frameless window controls if running inside desktop app
   */
  initDesktopWindowControls() {
    if (!window.apexDesktop?.isDesktop) return;

    const controlsEl = document.getElementById('desktop-window-controls');
    const btnMin = document.getElementById('btn-win-minimize');
    const btnMax = document.getElementById('btn-win-maximize');
    const btnClose = document.getElementById('btn-win-close');
    const maxIcon = document.getElementById('btn-win-maximize-icon');

    if (controlsEl) {
      controlsEl.style.display = 'inline-flex';
    }

    if (btnMin) {
      btnMin.addEventListener('click', () => window.apexDesktop.minimize());
    }

    if (btnMax) {
      btnMax.addEventListener('click', async () => {
        const isMax = await window.apexDesktop.isMaximized();
        if (isMax) {
          window.apexDesktop.unmaximize();
        } else {
          window.apexDesktop.maximize();
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => window.apexDesktop.close());
    }

    if (window.apexDesktop.onMaximizeChange && maxIcon) {
      window.apexDesktop.onMaximizeChange((isMax) => {
        maxIcon.textContent = isMax ? '❐' : '□';
      });
    }
  }

  /**
   * One-time migration: generates weather profiles for any existing track
   * that was saved before the Weather Intelligence feature was introduced.
   * Runs silently in the background on each app start — skips tracks that
   * already have profiles stored.
   */
  _migrateWeatherProfiles() {
    try {
      const tracks = trackLibraryStore.getAllTracks();
      if (!tracks || tracks.length === 0) return;

      const simulator = new WeatherSimulator();
      let migratedCount = 0;

      for (const track of tracks) {
        if (!track.trackId) continue;
        if (weatherProfileStore.hasProfiles(track.trackId)) continue; // already done
        if (!track.corners || track.corners.length === 0) continue;   // no corner data to simulate

        try {
          const profiles = simulator.simulateAll(track);
          weatherProfileStore.saveProfiles(track.trackId, profiles);
          migratedCount++;
        } catch (err) {
          console.warn(`[WEATHER MIGRATE] Failed for ${track.trackId}:`, err.message);
        }
      }

      if (migratedCount > 0) {
        console.log(`[WEATHER INTEL] Retroactively simulated weather for ${migratedCount} existing track(s).`);
      }
    } catch (err) {
      console.warn('[WEATHER MIGRATE] Migration error:', err);
    }
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

    // Top Navigation Tabs Click Events
    if (this.btnNavPitwall) {
      this.btnNavPitwall.addEventListener('click', () => {
        this.switchView('pitwall');
      });
    }

    if (this.btnNavTrackLibrary) {
      this.btnNavTrackLibrary.addEventListener('click', () => {
        this.switchView('track-library');
      });
    }

    if (this.btnNavStints) {
      this.btnNavStints.addEventListener('click', () => {
        this.switchView('stints');
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
        this.switchView('pitwall');
      });
    }

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.session.toggleRecording();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.switchView('pitwall');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.switchView('track-library');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.switchView('stints');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.openSettings();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this.openUdpGuide();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 'Escape') {
        this.closeSettings();
        this.closeUdpGuide();
      }
    });

    // Fullscreen button click and change events
    if (this.btnToggleFullscreen) {
      this.btnToggleFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    document.addEventListener('fullscreenchange', () => {
      this.updateFullscreenButtonState();
    });
    document.addEventListener('webkitfullscreenchange', () => {
      this.updateFullscreenButtonState();
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
      if (this.stintsManager) {
        this.stintsManager.updateTelemetry(sample);
      }

      if (this.trackMap3D) {
        this.trackMap3D.updateLiveTelemetry(sample, this.session.recordedSamples);
      }
      if (this.modalTrackMap3D && this.isMapModalOpen) {
        this.modalTrackMap3D.updateLiveTelemetry(sample, this.session.recordedSamples);
      }
      this.requestTrackMapRender();

      if (this.rateText) {
        this.rateText.textContent = `${this.wsClient.stats.packetsPerSecond} pkt/s`;
      }
    });

    this.wsClient.connect();
  }

  requestTrackMapRender() {
    if (this.mapRenderRequested) return;
    this.mapRenderRequested = true;
    requestAnimationFrame(() => {
      this.mapRenderRequested = false;
      if (this.trackMap3D) this.trackMap3D.render();
      if (this.modalTrackMap3D && this.isMapModalOpen) this.modalTrackMap3D.render();
    });
  }

  initTrackMap3D() {
    const canvas = document.getElementById('track-map-3d-canvas');
    if (canvas) {
      if (!this.trackMap3D) {
        this.trackMap3D = new IsometricTrackMap(canvas);
      } else {
        this.trackMap3D.canvas = canvas;
        this.trackMap3D.ctx = canvas.getContext('2d');
        this.trackMap3D.resizeCanvas();
      }

      // Bind button controls
      const btnDim = document.getElementById('btn-toggle-map-3d-dim');
      const lblDim = document.getElementById('btn-map-dim-label');
      if (btnDim) {
        btnDim.onclick = () => {
          const is3D = this.trackMap3D.toggleViewMode();
          if (lblDim) lblDim.textContent = is3D ? '2.5D' : '2D';
        };
      }

      const btnRotateLeft = document.getElementById('btn-rotate-map-left');
      if (btnRotateLeft) {
        btnRotateLeft.onclick = () => {
          this.trackMap3D.yaw -= 0.2;
          this.trackMap3D.render();
        };
      }

      const btnRotateRight = document.getElementById('btn-rotate-map-right');
      if (btnRotateRight) {
        btnRotateRight.onclick = () => {
          this.trackMap3D.yaw += 0.2;
          this.trackMap3D.render();
        };
      }

      const btnReset = document.getElementById('btn-reset-map-view');
      if (btnReset) {
        btnReset.onclick = () => {
          this.trackMap3D.resetView();
        };
      }

      const btnExpand = document.getElementById('btn-expand-map-3d');
      if (btnExpand) {
        btnExpand.onclick = () => {
          this.openMapModal();
        };
      }
    }

    // Modal Map init
    const modalCanvas = document.getElementById('track-map-3d-modal-canvas');
    if (modalCanvas && !this.modalTrackMap3D) {
      this.modalTrackMap3D = new IsometricTrackMap(modalCanvas);

      const btnCloseModal = document.getElementById('btn-close-map-modal');
      if (btnCloseModal) {
        btnCloseModal.onclick = () => this.closeMapModal();
      }

      const modalBackdrop = document.getElementById('track-map-3d-modal');
      if (modalBackdrop) {
        modalBackdrop.onclick = (e) => {
          if (e.target === modalBackdrop) this.closeMapModal();
        };
      }

      const btnModalDim = document.getElementById('btn-modal-map-dim');
      const lblModalDim = document.getElementById('btn-modal-map-dim-label');
      if (btnModalDim) {
        btnModalDim.onclick = () => {
          const is3D = this.modalTrackMap3D.toggleViewMode();
          if (lblModalDim) lblModalDim.textContent = is3D ? '2.5D' : '2D';
        };
      }

      const btnModalReset = document.getElementById('btn-modal-map-reset');
      if (btnModalReset) {
        btnModalReset.onclick = () => this.modalTrackMap3D.resetView();
      }
    }
  }

  openMapModal() {
    const modal = document.getElementById('track-map-3d-modal');
    if (modal) {
      modal.classList.add('active');
      this.isMapModalOpen = true;
      if (this.modalTrackMap3D) {
        if (this.trackMap3D) {
          this.modalTrackMap3D.setReferenceData(this.trackMap3D.referenceLap, this.trackMap3D.corners3D);
          this.modalTrackMap3D.liveSamples = [...this.trackMap3D.liveSamples];
          this.modalTrackMap3D.currentSample = this.trackMap3D.currentSample;
        }
        this.modalTrackMap3D.resizeCanvas();
        this.modalTrackMap3D.fitToView();
        this.modalTrackMap3D.render();
      }
    }
  }

  closeMapModal() {
    const modal = document.getElementById('track-map-3d-modal');
    if (modal) {
      modal.classList.remove('active');
      this.isMapModalOpen = false;
    }
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

  switchView(viewName) {
    // 1. Hide all views
    if (this.viewPitwall) this.viewPitwall.style.display = 'none';
    if (this.viewTrackLibrary) this.viewTrackLibrary.style.display = 'none';
    if (this.viewStints) this.viewStints.style.display = 'none';

    // 2. Deactivate all top navigation tab buttons
    if (this.btnNavPitwall) this.btnNavPitwall.classList.remove('active');
    if (this.btnNavTrackLibrary) this.btnNavTrackLibrary.classList.remove('active');
    if (this.btnNavStints) this.btnNavStints.classList.remove('active');

    // 3. Activate selected view
    if (viewName === 'pitwall') {
      if (this.viewPitwall) this.viewPitwall.style.display = 'block';
      if (this.btnNavPitwall) this.btnNavPitwall.classList.add('active');
    } else if (viewName === 'track-library') {
      if (this.viewTrackLibrary) this.viewTrackLibrary.style.display = 'block';
      if (this.btnNavTrackLibrary) this.btnNavTrackLibrary.classList.add('active');
      if (this.trackLibrary) this.trackLibrary.refresh();
    } else if (viewName === 'stints') {
      if (this.viewStints) this.viewStints.style.display = 'block';
      if (this.btnNavStints) this.btnNavStints.classList.add('active');
      if (this.stintsManager) this.stintsManager.onViewOpened();
    }
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

  toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => {
          console.warn('[FULLSCREEN] Request error:', err.message);
        });
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.warn('[FULLSCREEN] Exit error:', err.message);
        });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  updateFullscreenButtonState() {
    const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (this.btnToggleFullscreen) {
      const enterIcon = this.btnToggleFullscreen.querySelector('.fullscreen-icon-enter');
      const exitIcon = this.btnToggleFullscreen.querySelector('.fullscreen-icon-exit');
      if (enterIcon) enterIcon.style.display = isFullscreen ? 'none' : 'block';
      if (exitIcon) exitIcon.style.display = isFullscreen ? 'block' : 'none';
      this.btnToggleFullscreen.setAttribute('title', isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)');
      this.btnToggleFullscreen.setAttribute('aria-label', isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen');
      if (isFullscreen) {
        this.btnToggleFullscreen.classList.add('active');
      } else {
        this.btnToggleFullscreen.classList.remove('active');
      }
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
