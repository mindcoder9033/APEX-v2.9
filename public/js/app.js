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
import { driverProfileStore } from './driver-profile-store.js';
import { DriverDossierModal } from './components/driver-dossier-modal.js';
import { DriverWizardModal } from './components/driver-wizard-modal.js';
import { UiUpdater } from './components/ui-updater.js';
import { LapAnalyzerView } from './components/lap-analyzer-view.js';

class ApexApp {
  constructor() {
    window.apexApp = this;

    this.hud = new HudRenderer();
    this.session = new SessionManager();
    this.layoutManager = new GridLayoutManager();
    this.trackLibrary = new TrackLibraryView();
    this.stintsManager = new StintsManager();
    this.loopbackModal = new LoopbackModal();
    this.driverDossierModal = new DriverDossierModal();
    this.driverWizardModal = new DriverWizardModal();
    this.uiUpdater = new UiUpdater();
    this.lapAnalyzerView = new LapAnalyzerView();
    this.driverStore = driverProfileStore;
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
    this.btnNavLapAnalyzer = document.getElementById('btn-nav-lap-analyzer');

    // Primary View Containers
    this.viewPitwall = document.getElementById('view-pitwall');
    this.viewTrackLibrary = document.getElementById('view-track-library');
    this.viewStints = document.getElementById('view-stints');
    this.viewLapAnalyzer = document.getElementById('view-lap-analyzer');
    
    this.wsClient = new ApexWsClient({
      url: this.session.settings.wsUrl,
      autoReconnect: true
    });

    this.init();
  }

  async init() {
    this.populateSettingsForm();
    this.bindEvents();
    this.initDesktopWindowControls();
    this.connectBridge();
    this._migrateWeatherProfiles();
    await this.initDriverProfiles();
  }

  /**
   * Initializes driver profile store, header quick-switcher, and first-launch wizard
   */
  async initDriverProfiles() {
    try {
      const { hasProfiles, activeProfile } = await driverProfileStore.init();

      if (!hasProfiles) {
        // First-launch setup wizard
        this.driverWizardModal.open();
      } else if (activeProfile) {
        this.updateHeaderDriver(activeProfile);
      }

      // Listen for profile changes across app
      driverProfileStore.subscribe((event, profile) => {
        if (profile) {
          this.updateHeaderDriver(profile);
        }
      });

      // Bind header driver pill to directly open Driver Dossier Modal
      const btnPill = document.getElementById('btn-driver-pill');
      if (btnPill) {
        btnPill.addEventListener('click', (e) => {
          e.preventDefault();
          this.driverDossierModal.open();
        });
      }
    } catch (err) {
      console.warn('[DriverProfile] Init warning:', err);
    }
  }

  /**
   * Updates top header driver badge, name, tier, and session settings
   */
  updateHeaderDriver(profile) {
    if (!profile) return;

    const badgeEl = document.getElementById('header-driver-badge');
    const numEl = document.getElementById('header-driver-number');
    const nameEl = document.getElementById('header-driver-name');
    const tierEl = document.getElementById('header-driver-tier');

    const color = profile.color || '#e10600';
    if (badgeEl) {
      badgeEl.style.borderColor = color;
      badgeEl.style.color = color;
    }
    if (numEl) {
      numEl.textContent = `#${profile.number || '01'}`;
      numEl.style.color = color;
    }
    if (nameEl) nameEl.textContent = profile.name || 'APEX Driver';
    if (tierEl) {
      tierEl.textContent = (profile.tier || 'CLUB').toUpperCase();
    }

    // Sync active driver name with session manager and settings
    if (this.session && this.session.settings) {
      this.session.settings.driverName = profile.name;
    }
    if (this.inputDriverName) {
      this.inputDriverName.value = profile.name;
    }

    // If speed unit preference is configured on profile, sync it
    if (profile.preferences?.speedUnit && this.session) {
      this.session.settings.speedUnit = profile.preferences.speedUnit;
    }
  }

  /**
   * Renders the fast-switch driver items inside the header dropdown
   */
  renderHeaderDropdownList() {
    const listEl = document.getElementById('driver-dropdown-list');
    if (!listEl) return;

    const profiles = driverProfileStore.getAllProfiles();
    const active = driverProfileStore.getActiveProfile();

    if (profiles.length === 0) {
      listEl.innerHTML = `<div style="padding: 10px; color: #888; font-size: 10px; text-align: center;">No driver profiles</div>`;
      return;
    }

    listEl.innerHTML = profiles.map(p => {
      const isActive = active && active.id === p.id;
      return `
        <button type="button" class="dropdown-driver-item ${isActive ? 'active' : ''}" data-id="${p.id}">
          <div class="dropdown-driver-badge" style="border-color: ${p.color || '#e10600'}; color: ${p.color || '#e10600'};">
            #${p.number || '01'}
          </div>
          <span class="dropdown-driver-name">${p.name || 'Driver'}</span>
          <span class="dropdown-driver-tier tier-${(p.tier || 'club').toLowerCase()}">${(p.tier || 'CLUB').toUpperCase()}</span>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('.dropdown-driver-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await driverProfileStore.setActiveProfile(id);
        const dropdown = document.getElementById('driver-dropdown-menu');
        dropdown?.classList.add('hidden');
      });
    });
  }

  /**
   * Initializes APEX Motorsport custom titlebar and window controls (Desktop & Web)
   */
  initDesktopWindowControls() {
    const btnMin = document.getElementById('btn-titlebar-min');
    const btnMax = document.getElementById('btn-titlebar-max');
    const btnClose = document.getElementById('btn-titlebar-close');
    const maxIcon = document.getElementById('titlebar-max-icon');
    const restoreIcon = document.getElementById('titlebar-restore-icon');
    const titlebarDrag = document.getElementById('apex-titlebar');

    const isDesktop = !!(window.apexDesktop && window.apexDesktop.isDesktop);

    // Minimize Handler
    if (btnMin) {
      btnMin.addEventListener('click', () => {
        if (isDesktop) {
          window.apexDesktop.minimize();
        } else {
          // Browser fallback: notify user
          if (this.hud?.showToast) {
            this.hud.showToast('Minimize is native to the APEX Desktop App', 'info');
          }
        }
      });
    }

    // Maximize / Restore Handler
    if (btnMax) {
      btnMax.addEventListener('click', async () => {
        if (isDesktop) {
          const isMax = await window.apexDesktop.isMaximized();
          if (isMax) {
            window.apexDesktop.unmaximize();
          } else {
            window.apexDesktop.maximize();
          }
        } else {
          // Browser fallback: toggle HTML5 fullscreen
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      });
    }

    // Close Handler
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (isDesktop) {
          window.apexDesktop.close();
        } else {
          // Browser fallback: confirmation dialog
          if (confirm('Close APEX Pit-Wall Telemetry session?')) {
            window.close();
          }
        }
      });
    }

    // Desktop-specific double click titlebar to maximize & state sync
    if (isDesktop) {
      if (titlebarDrag) {
        titlebarDrag.addEventListener('dblclick', async (e) => {
          // Ignore double clicks on interactive buttons
          if (e.target.closest('.no-drag')) return;
          const isMax = await window.apexDesktop.isMaximized();
          if (isMax) {
            window.apexDesktop.unmaximize();
          } else {
            window.apexDesktop.maximize();
          }
        });
      }

      if (window.apexDesktop.onMaximizeChange) {
        window.apexDesktop.onMaximizeChange((isMax) => {
          if (maxIcon) maxIcon.style.display = isMax ? 'none' : 'block';
          if (restoreIcon) restoreIcon.style.display = isMax ? 'block' : 'none';
          if (btnMax) btnMax.title = isMax ? 'Restore Down' : 'Maximize';
        });
      }
    } else {
      // In browser mode, listen to fullscreenchange to sync maximize / restore icon
      document.addEventListener('fullscreenchange', () => {
        const isFull = !!document.fullscreenElement;
        if (maxIcon) maxIcon.style.display = isFull ? 'none' : 'block';
        if (restoreIcon) restoreIcon.style.display = isFull ? 'block' : 'none';
        if (btnMax) btnMax.title = isFull ? 'Exit Fullscreen' : 'Fullscreen / Maximize';
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

    if (this.btnNavLapAnalyzer) {
      this.btnNavLapAnalyzer.addEventListener('click', () => {
        this.switchView('lap-analyzer');
      });
    }

    const btnAnalyzerGoPitwall = document.getElementById('btn-analyzer-go-pitwall');
    if (btnAnalyzerGoPitwall) {
      btnAnalyzerGoPitwall.addEventListener('click', () => {
        this.switchView('pitwall');
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
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.switchView('lap-analyzer');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.openSettings();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this.openUdpGuide();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.driverDossierModal.open();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 'Escape') {
        this.closeSettings();
        this.closeUdpGuide();
        this.driverDossierModal.close();
        this.driverWizardModal.close();
        const dropdown = document.getElementById('driver-dropdown-menu');
        dropdown?.classList.add('hidden');
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
    if (this.statusPill) {
      this.statusPill.className = `status-pill ${state} chamfer-all-corners`;
    }
    if (this.statusText) this.statusText.textContent = label;

    // Sync Titlebar Live Session Breadcrumb
    const titleDot = document.getElementById('titlebar-session-dot');
    const titleText = document.getElementById('titlebar-session-text');
    if (titleDot && titleText) {
      titleDot.className = 'titlebar-dot';
      if (state === 'connected') {
        titleDot.classList.add('active');
        const sessionName = this.session?.sessionName || 'PIT-WALL TELEMETRY';
        titleText.textContent = `LIVE // ${sessionName.toUpperCase()}`;
      } else if (state === 'connecting') {
        titleText.textContent = 'CONNECTING // AWAITING UDP TELEMETRY';
      } else {
        titleText.textContent = 'STANDBY // NO ACTIVE TELEMETRY';
      }
    }
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
    if (this.viewLapAnalyzer) this.viewLapAnalyzer.style.display = 'none';

    // 2. Deactivate all top navigation tab buttons
    if (this.btnNavPitwall) this.btnNavPitwall.classList.remove('active');
    if (this.btnNavTrackLibrary) this.btnNavTrackLibrary.classList.remove('active');
    if (this.btnNavStints) this.btnNavStints.classList.remove('active');
    if (this.btnNavLapAnalyzer) this.btnNavLapAnalyzer.classList.remove('active');

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
    } else if (viewName === 'lap-analyzer') {
      if (this.viewLapAnalyzer) this.viewLapAnalyzer.style.display = 'block';
      if (this.btnNavLapAnalyzer) this.btnNavLapAnalyzer.classList.add('active');
      if (this.lapAnalyzerView) this.lapAnalyzerView.onViewActivated(this.session);
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
