/**
 * APEX Grid Layout Manager
 * Custom vanilla JS 12-column dynamic layout engine with drag-and-drop,
 * interactive resizing, widget drawer catalog, presets, and LocalStorage persistence.
 */

export class GridLayoutManager {
  constructor(options = {}) {
    this.container = options.container || document.querySelector('.pit-dashboard-grid');
    this.storageKey = 'apex_dashboard_layout_v2';
    this.isEditMode = false;
    this.activeWidgets = [];
    this.draggedWidget = null;
    this.placeholder = null;

    // Registry of all available widgets with metadata & default templates
    this.widgetRegistry = {
      'widget-session': {
        id: 'widget-session',
        title: 'Session Control & Stints',
        category: 'Session',
        description: 'Recording trigger, stint duration clock, and lap statistics counters.',
        defaultColSpan: 3,
        minColSpan: 3,
        maxColSpan: 12,
        defaultOrder: 1,
        renderTemplate: () => this.getSessionWidgetTemplate()
      },
      'widget-rpm': {
        id: 'widget-rpm',
        title: 'Engine RPM & Shift Lights',
        category: 'Cockpit HUD',
        description: 'F1 16-LED tachometer light strip and digital engine RPM gauge.',
        defaultColSpan: 6,
        minColSpan: 4,
        maxColSpan: 12,
        defaultOrder: 2,
        renderTemplate: () => this.getRpmWidgetTemplate()
      },
      'widget-speed': {
        id: 'widget-speed',
        title: 'Speedometer & Gear Display',
        category: 'Cockpit HUD',
        description: 'Speed gauge with metric/imperial toggle, gear box, and powerband class.',
        defaultColSpan: 6,
        minColSpan: 4,
        maxColSpan: 12,
        defaultOrder: 3,
        renderTemplate: () => this.getSpeedWidgetTemplate()
      },
      'widget-inputs': {
        id: 'widget-inputs',
        title: 'Driver Pedals & Steering',
        category: 'Telemetry',
        description: 'Live throttle, brake, clutch vertical meters and steering lock bar.',
        defaultColSpan: 6,
        minColSpan: 4,
        maxColSpan: 12,
        defaultOrder: 4,
        renderTemplate: () => this.getInputsWidgetTemplate()
      },
      'widget-gg': {
        id: 'widget-gg',
        title: 'G-G Friction Target',
        category: 'Dynamics',
        description: 'G-Force friction circle diagram with real-time lateral & longitudinal readouts.',
        defaultColSpan: 3,
        minColSpan: 3,
        maxColSpan: 12,
        defaultOrder: 5,
        renderTemplate: () => this.getGgWidgetTemplate()
      },
      'widget-tires': {
        id: 'widget-tires',
        title: 'Tire Temperatures Matrix',
        category: 'Tires',
        description: '4-corner live tire thermal heatmap readouts (FL, FR, RL, RR).',
        defaultColSpan: 3,
        minColSpan: 3,
        maxColSpan: 12,
        defaultOrder: 6,
        renderTemplate: () => this.getTiresWidgetTemplate()
      },
      'widget-slip': {
        id: 'widget-slip',
        title: 'Wheel Slip & Traction Target',
        category: 'Dynamics',
        description: 'Real-time 4-wheel slip ratio and traction loss warning matrix.',
        defaultColSpan: 3,
        minColSpan: 3,
        maxColSpan: 12,
        defaultOrder: 7,
        renderTemplate: () => this.getWheelSlipWidgetTemplate()
      }
    };

    // Built-in presets
    this.presets = {
      default: {
        name: 'Default Pit-Wall',
        description: 'Balanced 3-column F1 pit-wall setup with centered cockpit HUD',
        layout: [
          { id: 'widget-session', colSpan: 3, order: 1 },
          { id: 'widget-rpm', colSpan: 6, order: 2 },
          { id: 'widget-gg', colSpan: 3, order: 3 },
          { id: 'widget-speed', colSpan: 6, order: 4 },
          { id: 'widget-tires', colSpan: 3, order: 5 },
          { id: 'widget-inputs', colSpan: 6, order: 6 }
        ]
      },
      driver: {
        name: 'Driver Cockpit Focus',
        description: 'Wide cockpit HUD, large shift lights, and prominent pedal inputs',
        layout: [
          { id: 'widget-rpm', colSpan: 12, order: 1 },
          { id: 'widget-speed', colSpan: 6, order: 2 },
          { id: 'widget-inputs', colSpan: 6, order: 3 },
          { id: 'widget-session', colSpan: 4, order: 4 },
          { id: 'widget-gg', colSpan: 4, order: 5 },
          { id: 'widget-tires', colSpan: 4, order: 6 }
        ]
      },
      engineer: {
        name: 'Telemetry Engineer',
        description: 'Emphasis on tire dynamics, friction circle, and wheel slip metrics',
        layout: [
          { id: 'widget-gg', colSpan: 4, order: 1 },
          { id: 'widget-tires', colSpan: 4, order: 2 },
          { id: 'widget-slip', colSpan: 4, order: 3 },
          { id: 'widget-session', colSpan: 3, order: 4 },
          { id: 'widget-rpm', colSpan: 6, order: 5 },
          { id: 'widget-inputs', colSpan: 3, order: 6 }
        ]
      }
    };

    this.init();
  }

  init() {
    this.createEditToolbar();
    this.createWidgetDrawer();
    this.createToastContainer();
    this.loadLayout();
    this.bindGlobalEvents();
  }

  /* --- Template Definitions for Modular Widgets --- */

  getSessionWidgetTemplate() {
    return `
      <div class="pit-card-header">
        <h2 class="pit-card-title">Session Control</h2>
        <span id="display-session-name" style="font-family: var(--font-mono); font-size: 10px; color: var(--color-text-secondary);">Track Day</span>
      </div>

      <button id="btn-record" class="btn btn-primary chamfer-br" style="height: 52px; font-size: 14px; width: 100%;">
        <span>⏺</span> START RECORDING
      </button>

      <div class="timer-hero-display chamfer-all-corners">
        <span class="timer-hero-label">Stint Duration</span>
        <span id="stint-timer-val" class="timer-hero-value">00:00.0</span>
      </div>

      <div class="separator-glow"></div>

      <div class="lap-stats-grid">
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Current Lap</span>
          <span id="lap-counter-val" class="stat-cell-value accent">L00</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Best Lap</span>
          <span id="best-lap-val" class="stat-cell-value">--:--.---</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Last Lap</span>
          <span id="last-lap-val" class="stat-cell-value">--:--.---</span>
        </div>
        <div class="stat-cell chamfer-all-corners">
          <span class="stat-cell-label">Samples Logged</span>
          <span id="samples-count-val" class="stat-cell-value">0</span>
        </div>
      </div>
    `;
  }

  getRpmWidgetTemplate() {
    return `
      <div class="shift-lights-container chamfer-all-corners" style="height: 100%;">
        <div class="shift-lights-header">
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--color-text-secondary);">ENGINE RPM</span>
          <span style="font-family: var(--font-mono); font-size: 11px;"><span id="rpm-val" style="color: #fff; font-weight: 700;">0</span> <span id="rpm-max" style="color: #666;">/ 8,000</span></span>
        </div>
        <div id="shift-lights-bar" class="shift-lights-bar">
          <!-- Dynamically populated 16 LEDs -->
        </div>
      </div>
    `;
  }

  getSpeedWidgetTemplate() {
    return `
      <div class="hud-telemetry-display chamfer-tl-br" style="height: 100%;">
        <div class="speed-metric">
          <div id="speed-val" class="speed-value">0</div>
          <div id="speed-unit" class="speed-unit">KM/H</div>
          <div class="speed-unit-badge chamfer-all-corners" style="padding: 2px 8px; font-size: 9px; margin-top: 6px; color: var(--color-text-secondary); background: rgba(255,255,255,0.05); font-family: var(--font-mono); text-align: center;">METRIC</div>
        </div>

        <div class="gear-display chamfer-all-corners">
          <span class="gear-label">GEAR</span>
          <span id="gear-val" class="gear-value">N</span>
        </div>

        <div class="rpm-metric">
          <span class="rpm-label">POWERBAND</span>
          <span id="car-class-badge" class="stat-cell-value accent" style="font-size: 28px; margin-top: 4px;">S</span>
          <span id="car-pi-val" style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-secondary);">PI 798</span>
        </div>
      </div>
    `;
  }

  getInputsWidgetTemplate() {
    return `
      <div class="pit-card-header">
        <h3 class="pit-card-title">Driver Inputs</h3>
      </div>

      <div class="pedals-grid">
        <div class="pedal-column">
          <span class="pedal-label">Throttle</span>
          <div class="pedal-meter-bg chamfer-all-corners">
            <div id="throttle-fill" class="pedal-meter-fill throttle"></div>
          </div>
          <span id="throttle-text" class="pedal-percent" style="color: var(--color-success);">0%</span>
        </div>

        <div class="pedal-column">
          <span class="pedal-label">Brake</span>
          <div class="pedal-meter-bg chamfer-all-corners">
            <div id="brake-fill" class="pedal-meter-fill brake"></div>
          </div>
          <span id="brake-text" class="pedal-percent" style="color: var(--color-error);">0%</span>
        </div>

        <div class="pedal-column">
          <span class="pedal-label">Clutch</span>
          <div class="pedal-meter-bg chamfer-all-corners">
            <div id="clutch-fill" class="pedal-meter-fill clutch"></div>
          </div>
          <span id="clutch-text" class="pedal-percent" style="color: #0099FF;">0%</span>
        </div>
      </div>

      <div class="steering-container">
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: var(--color-text-secondary);">
          <span>STEERING LOCK</span>
          <span id="steering-text">0%</span>
        </div>
        <div class="steering-track chamfer-all-corners">
          <div class="steering-center-mark"></div>
          <div id="steering-indicator" class="steering-indicator chamfer-all-corners"></div>
        </div>
      </div>
    `;
  }

  getGgWidgetTemplate() {
    return `
      <div class="pit-card-header">
        <h2 class="pit-card-title">G-G Friction Target</h2>
      </div>

      <div class="g-target-container">
        <canvas id="gg-canvas" width="220" height="220" class="chamfer-all-corners"></canvas>
        <div class="g-readout-row">
          <span>LAT: <strong id="g-lat-val" style="color: var(--color-f1-red);">0.00G</strong></span>
          <span>LONG: <strong id="g-long-val" style="color: var(--color-text-primary);">0.00G</strong></span>
        </div>
      </div>
    `;
  }

  getTiresWidgetTemplate() {
    return `
      <div class="pit-card-header">
        <h3 class="pit-card-title">Tire Temperatures</h3>
      </div>

      <div class="tires-matrix-grid">
        <div class="tire-card chamfer-all-corners">
          <div class="tire-header"><span>FRONT LEFT</span><span>FL</span></div>
          <div id="tire-temp-fl" class="tire-temp">--°C</div>
        </div>
        <div class="tire-card chamfer-all-corners">
          <div class="tire-header"><span>FRONT RIGHT</span><span>FR</span></div>
          <div id="tire-temp-fr" class="tire-temp">--°C</div>
        </div>
        <div class="tire-card chamfer-all-corners">
          <div class="tire-header"><span>REAR LEFT</span><span>RL</span></div>
          <div id="tire-temp-rl" class="tire-temp">--°C</div>
        </div>
        <div class="tire-card chamfer-all-corners">
          <div class="tire-header"><span>REAR RIGHT</span><span>RR</span></div>
          <div id="tire-temp-rr" class="tire-temp">--°C</div>
        </div>
      </div>
    `;
  }

  getWheelSlipWidgetTemplate() {
    return `
      <div class="pit-card-header">
        <h3 class="pit-card-title">Wheel Slip & Grip</h3>
      </div>

      <div class="tires-matrix-grid">
        <div class="tire-card chamfer-all-corners" style="border-left: 2px solid var(--color-success);">
          <div class="tire-header"><span>FRONT LEFT</span><span>FL</span></div>
          <div id="wheel-slip-fl" class="tire-temp" style="font-size: 16px; color: var(--color-success);">0.0%</div>
        </div>
        <div class="tire-card chamfer-all-corners" style="border-left: 2px solid var(--color-success);">
          <div class="tire-header"><span>FRONT RIGHT</span><span>FR</span></div>
          <div id="wheel-slip-fr" class="tire-temp" style="font-size: 16px; color: var(--color-success);">0.0%</div>
        </div>
        <div class="tire-card chamfer-all-corners" style="border-left: 2px solid var(--color-success);">
          <div class="tire-header"><span>REAR LEFT</span><span>RL</span></div>
          <div id="wheel-slip-rl" class="tire-temp" style="font-size: 16px; color: var(--color-success);">0.0%</div>
        </div>
        <div class="tire-card chamfer-all-corners" style="border-left: 2px solid var(--color-success);">
          <div class="tire-header"><span>REAR RIGHT</span><span>RR</span></div>
          <div id="wheel-slip-rr" class="tire-temp" style="font-size: 16px; color: var(--color-success);">0.0%</div>
        </div>
      </div>
    `;
  }

  /* --- UI Creation: Toolbar, Drawer, Toasts --- */

  createEditToolbar() {
    if (document.getElementById('layout-edit-toolbar')) return;

    const toolbar = document.createElement('section');
    toolbar.id = 'layout-edit-toolbar';
    toolbar.className = 'layout-edit-toolbar chamfer-br';
    toolbar.style.display = 'none';

    toolbar.innerHTML = `
      <div class="toolbar-left">
        <div class="toolbar-badge chamfer-all-corners">
          <span class="live-edit-pulse"></span>
          <span>LAYOUT CUSTOMIZER</span>
        </div>
        <span class="toolbar-hint">Drag handles to rearrange • Drag corner to resize (3-12 cols)</span>
      </div>

      <div class="toolbar-actions">
        <button id="btn-toggle-widget-drawer" class="btn btn-secondary chamfer-all-corners" title="Add or restore telemetry widgets">
          <span>➕</span> ADD WIDGET
        </button>

        <div class="preset-dropdown-wrapper">
          <select id="select-layout-preset" class="form-select chamfer-all-corners">
            <option value="" disabled selected>⚡ PRESETS</option>
            <option value="default">Default Pit-Wall</option>
            <option value="driver">Driver Cockpit Focus</option>
            <option value="engineer">Telemetry Engineer</option>
          </select>
        </div>

        <button id="btn-export-layout" class="btn btn-secondary chamfer-all-corners" title="Export layout as JSON">
          <span>💾</span> EXPORT
        </button>

        <button id="btn-import-layout" class="btn btn-secondary chamfer-all-corners" title="Import layout JSON file">
          <span>📂</span> IMPORT
        </button>
        <input type="file" id="input-import-layout-file" accept=".json" style="display: none;">

        <button id="btn-reset-layout" class="btn btn-secondary chamfer-all-corners" title="Reset to standard F1 Pit-Wall layout">
          <span>↺</span> RESET
        </button>

        <button id="btn-done-edit-layout" class="btn btn-primary chamfer-br" title="Save changes and exit edit mode (E)">
          <span>✓</span> DONE EDITING
        </button>
      </div>
    `;

    // Insert toolbar right above dashboard grid
    if (this.container && this.container.parentNode) {
      this.container.parentNode.insertBefore(toolbar, this.container);
    }
  }

  createWidgetDrawer() {
    if (document.getElementById('widget-catalog-drawer')) return;

    const drawer = document.createElement('aside');
    drawer.id = 'widget-catalog-drawer';
    drawer.className = 'widget-catalog-drawer';
    drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-group">
          <h2 class="drawer-title">TELEMETRY WIDGET CATALOG</h2>
          <span class="drawer-subtitle">Add or restore widgets to your pit-wall dashboard</span>
        </div>
        <button id="btn-close-widget-drawer" class="btn-icon-close" title="Close Drawer (Esc)">✕</button>
      </div>
      <div id="widget-catalog-list" class="widget-catalog-list">
        <!-- Dynamically populated widget items -->
      </div>
    `;

    document.body.appendChild(drawer);

    // Backdrop for drawer
    const backdrop = document.createElement('div');
    backdrop.id = 'widget-drawer-backdrop';
    backdrop.className = 'modal-backdrop widget-backdrop';
    document.body.appendChild(backdrop);
  }

  createToastContainer() {
    if (document.getElementById('apex-toast-container')) return;
    const toastBox = document.createElement('div');
    toastBox.id = 'apex-toast-container';
    toastBox.className = 'apex-toast-container';
    document.body.appendChild(toastBox);
  }

  showToast(message, type = 'info') {
    const box = document.getElementById('apex-toast-container');
    if (!box) return;

    const toast = document.createElement('div');
    toast.className = `apex-toast apex-toast-${type} chamfer-all-corners`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ'}</span>
      <span class="toast-message">${message}</span>
    `;

    box.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  /* --- Layout Loading, Saving & Rendering --- */

  loadLayout() {
    let layout = null;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        layout = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[LayoutManager] Failed to read saved layout from localStorage', e);
    }

    if (!Array.isArray(layout) || layout.length === 0) {
      layout = JSON.parse(JSON.stringify(this.presets.default.layout));
    }

    this.applyLayout(layout, false);
  }

  saveLayout() {
    const currentLayout = this.getCurrentLayoutState();
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(currentLayout));
    } catch (e) {
      console.warn('[LayoutManager] Failed to persist layout to localStorage', e);
    }
  }

  getCurrentLayoutState() {
    const widgetEls = Array.from(this.container.querySelectorAll('.pit-widget'));
    return widgetEls.map((el, idx) => {
      const id = el.dataset.widgetId;
      const colSpan = parseInt(el.dataset.colSpan, 10) || 6;
      return {
        id,
        colSpan,
        order: idx + 1
      };
    });
  }

  applyLayout(layoutList, showFeedback = true) {
    if (!this.container) return;

    // Filter valid widget IDs from registry
    const validWidgets = layoutList.filter(item => this.widgetRegistry[item.id]);

    this.container.innerHTML = '';
    validWidgets.forEach(item => {
      const reg = this.widgetRegistry[item.id];
      const colSpan = item.colSpan || reg.defaultColSpan;

      const widgetEl = document.createElement('div');
      widgetEl.className = 'pit-widget pit-card chamfer-tl-br';
      widgetEl.dataset.widgetId = item.id;
      widgetEl.dataset.colSpan = colSpan;
      widgetEl.style.setProperty('--col-span', colSpan);
      widgetEl.setAttribute('aria-label', reg.title);

      // Wrapper Header with Edit Controls
      widgetEl.innerHTML = `
        <div class="widget-edit-controls">
          <div class="widget-drag-handle" title="Drag to rearrange">
            <span class="drag-grip-icon">⋮⋮</span>
            <span class="widget-name-tag">${reg.title}</span>
          </div>
          <div class="widget-span-badge" title="Current Column Span">${colSpan}/12 COLS</div>
          <button class="btn-widget-remove" title="Remove widget from dashboard">✕</button>
        </div>
        <div class="widget-body">
          ${reg.renderTemplate()}
        </div>
        <div class="widget-resize-handle" title="Drag to resize width">⤡</div>
      `;

      this.attachWidgetEventListeners(widgetEl);
      this.container.appendChild(widgetEl);
    });

    this.activeWidgets = validWidgets.map(w => w.id);
    this.saveLayout();
    this.rebindTelemetryElements();
    this.updateDrawerCatalog();

    if (showFeedback) {
      this.showToast('Dashboard layout updated successfully', 'success');
    }
  }

  /* --- Rebind Telemetry DOM Elements --- */

  rebindTelemetryElements() {
    // Notify HUD renderer and Session Manager to refresh DOM cache
    if (window.apexApp && window.apexApp.hud) {
      const hud = window.apexApp.hud;
      hud.speedVal = document.getElementById('speed-val');
      hud.speedUnit = document.getElementById('speed-unit');
      hud.gearVal = document.getElementById('gear-val');
      hud.rpmVal = document.getElementById('rpm-val');
      hud.rpmMax = document.getElementById('rpm-max');
      hud.shiftLightsBar = document.getElementById('shift-lights-bar');

      hud.throttleFill = document.getElementById('throttle-fill');
      hud.throttleText = document.getElementById('throttle-text');
      hud.brakeFill = document.getElementById('brake-fill');
      hud.brakeText = document.getElementById('brake-text');
      hud.clutchFill = document.getElementById('clutch-fill');
      hud.clutchText = document.getElementById('clutch-text');
      hud.steeringIndicator = document.getElementById('steering-indicator');
      hud.steeringText = document.getElementById('steering-text');

      hud.gLatVal = document.getElementById('g-lat-val');
      hud.gLongVal = document.getElementById('g-long-val');
      hud.ggCanvas = document.getElementById('gg-canvas');
      hud.ggCtx = hud.ggCanvas ? hud.ggCanvas.getContext('2d') : null;

      hud.tireFL = document.getElementById('tire-temp-fl');
      hud.tireFR = document.getElementById('tire-temp-fr');
      hud.tireRL = document.getElementById('tire-temp-rl');
      hud.tireRR = document.getElementById('tire-temp-rr');

      hud.carClassBadge = document.getElementById('car-class-badge');
      hud.carPiVal = document.getElementById('car-pi-val');

      hud.initShiftLights();
      hud.initGgCanvas();
    }

    // Rebind session manager buttons and timers
    if (window.apexApp && window.apexApp.session) {
      const session = window.apexApp.session;
      if (typeof session.refreshDomElements === 'function') {
        session.refreshDomElements();
      } else {
        session.btnRecord = document.getElementById('btn-record');
        session.timerVal = document.getElementById('stint-timer-val');
        session.lapCounterVal = document.getElementById('lap-counter-val');
        session.bestLapVal = document.getElementById('best-lap-val');
        session.lastLapVal = document.getElementById('last-lap-val');
        session.samplesCountVal = document.getElementById('samples-count-val');
      }
    }
  }

  /* --- Edit Mode Toggle & Controls --- */

  toggleEditMode(forceState) {
    this.isEditMode = forceState !== undefined ? forceState : !this.isEditMode;
    const toolbar = document.getElementById('layout-edit-toolbar');
    const headerBtn = document.getElementById('btn-toggle-edit-layout');

    if (this.isEditMode) {
      document.body.classList.add('layout-edit-active');
      if (toolbar) toolbar.style.display = 'flex';
      if (headerBtn) {
        headerBtn.classList.add('btn-active');
        headerBtn.innerHTML = `<span>✓</span> DONE EDITING`;
      }
      this.showToast('Edit Mode Active: Drag or resize widgets', 'info');
    } else {
      document.body.classList.remove('layout-edit-active');
      if (toolbar) toolbar.style.display = 'none';
      if (headerBtn) {
        headerBtn.classList.remove('btn-active');
        headerBtn.innerHTML = `<span>📐</span> CUSTOMIZE`;
      }
      this.closeWidgetDrawer();
      this.saveLayout();
      this.showToast('Layout changes saved', 'success');
    }
  }

  /* --- Drag and Drop & Resizing Event Handlers --- */

  attachWidgetEventListeners(widgetEl) {
    const dragHandle = widgetEl.querySelector('.widget-drag-handle');
    const removeBtn = widgetEl.querySelector('.btn-widget-remove');
    const resizeHandle = widgetEl.querySelector('.widget-resize-handle');

    // Remove widget handler
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const widgetId = widgetEl.dataset.widgetId;
        this.removeWidget(widgetId);
      });
    }

    // Drag-and-drop via pointer events
    if (dragHandle) {
      dragHandle.addEventListener('pointerdown', (e) => {
        if (!this.isEditMode) return;
        this.startDragging(widgetEl, e);
      });
    }

    // Interactive resizing via corner handle
    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', (e) => {
        if (!this.isEditMode) return;
        this.startResizing(widgetEl, e);
      });
    }
  }

  startDragging(widgetEl, e) {
    e.preventDefault();
    this.draggedWidget = widgetEl;
    widgetEl.classList.add('is-dragging');

    // Create ghost placeholder
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'widget-placeholder chamfer-all-corners';
    this.placeholder.style.setProperty('--col-span', widgetEl.dataset.colSpan);
    this.container.insertBefore(this.placeholder, widgetEl);

    const onPointerMove = (moveEv) => {
      const target = this.getClosestWidgetUnderPointer(moveEv.clientX, moveEv.clientY);
      if (target && target !== widgetEl && target !== this.placeholder) {
        const rect = target.getBoundingClientRect();
        const isAfter = moveEv.clientY > rect.top + rect.height / 2 || moveEv.clientX > rect.left + rect.width / 2;
        if (isAfter) {
          this.container.insertBefore(this.placeholder, target.nextSibling);
        } else {
          this.container.insertBefore(this.placeholder, target);
        }
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (this.placeholder && this.placeholder.parentNode) {
        this.container.insertBefore(widgetEl, this.placeholder);
        this.placeholder.remove();
        this.placeholder = null;
      }

      widgetEl.classList.remove('is-dragging');
      this.draggedWidget = null;
      this.saveLayout();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  getClosestWidgetUnderPointer(x, y) {
    const widgets = Array.from(this.container.querySelectorAll('.pit-widget:not(.is-dragging)'));
    let closest = null;
    let minDistance = Infinity;

    for (const w of widgets) {
      const r = w.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return w;
      }
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < minDistance) {
        minDistance = dist;
        closest = w;
      }
    }
    return closest;
  }

  startResizing(widgetEl, e) {
    e.preventDefault();
    e.stopPropagation();

    const widgetId = widgetEl.dataset.widgetId;
    const reg = this.widgetRegistry[widgetId] || { minColSpan: 3, maxColSpan: 12 };
    const gridWidth = this.container.getBoundingClientRect().width;
    const colWidth = gridWidth / 12;

    widgetEl.classList.add('is-resizing');
    const startX = e.clientX;
    const initialSpan = parseInt(widgetEl.dataset.colSpan, 10) || 6;

    const onPointerMove = (moveEv) => {
      const deltaX = moveEv.clientX - startX;
      const spanChange = Math.round(deltaX / colWidth);
      let newSpan = Math.max(reg.minColSpan, Math.min(reg.maxColSpan, initialSpan + spanChange));

      widgetEl.dataset.colSpan = newSpan;
      widgetEl.style.setProperty('--col-span', newSpan);

      const spanBadge = widgetEl.querySelector('.widget-span-badge');
      if (spanBadge) {
        spanBadge.textContent = `${newSpan}/12 COLS`;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      widgetEl.classList.remove('is-resizing');
      this.saveLayout();
      this.rebindTelemetryElements();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  /* --- Add / Remove Widget Management --- */

  removeWidget(widgetId) {
    const widgetEl = this.container.querySelector(`.pit-widget[data-widget-id="${widgetId}"]`);
    if (!widgetEl) return;

    widgetEl.style.transform = 'scale(0.85)';
    widgetEl.style.opacity = '0';
    widgetEl.style.transition = 'all 0.2s ease-out';

    setTimeout(() => {
      widgetEl.remove();
      this.activeWidgets = this.activeWidgets.filter(id => id !== widgetId);
      this.saveLayout();
      this.updateDrawerCatalog();
      const reg = this.widgetRegistry[widgetId];
      this.showToast(`Removed "${reg ? reg.title : widgetId}" (Can restore in + Add Widget)`, 'info');
    }, 200);
  }

  addWidget(widgetId) {
    const reg = this.widgetRegistry[widgetId];
    if (!reg) return;

    const currentLayout = this.getCurrentLayoutState();
    if (currentLayout.some(w => w.id === widgetId)) {
      this.showToast(`"${reg.title}" is already on dashboard`, 'warning');
      return;
    }

    currentLayout.push({
      id: widgetId,
      colSpan: reg.defaultColSpan,
      order: currentLayout.length + 1
    });

    this.applyLayout(currentLayout, true);
    this.closeWidgetDrawer();
  }

  /* --- Widget Catalog Drawer & Presets --- */

  openWidgetDrawer() {
    this.updateDrawerCatalog();
    const drawer = document.getElementById('widget-catalog-drawer');
    const backdrop = document.getElementById('widget-drawer-backdrop');
    if (drawer) drawer.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
  }

  closeWidgetDrawer() {
    const drawer = document.getElementById('widget-catalog-drawer');
    const backdrop = document.getElementById('widget-drawer-backdrop');
    if (drawer) drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
  }

  updateDrawerCatalog() {
    const listEl = document.getElementById('widget-catalog-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const activeSet = new Set(this.activeWidgets);

    Object.values(this.widgetRegistry).forEach(reg => {
      const isActive = activeSet.has(reg.id);
      const card = document.createElement('div');
      card.className = `catalog-item chamfer-all-corners ${isActive ? 'item-active' : ''}`;

      card.innerHTML = `
        <div class="catalog-item-info">
          <div class="catalog-item-header">
            <span class="catalog-badge">${reg.category}</span>
            <span class="catalog-status ${isActive ? 'status-on' : 'status-off'}">
              ${isActive ? '● ON DASHBOARD' : '○ INACTIVE'}
            </span>
          </div>
          <h4 class="catalog-item-title">${reg.title}</h4>
          <p class="catalog-item-desc">${reg.description}</p>
          <div class="catalog-item-meta">Default Width: ${reg.defaultColSpan}/12 Columns (Min: ${reg.minColSpan}, Max: ${reg.maxColSpan})</div>
        </div>
        <div class="catalog-item-action">
          ${isActive
            ? `<button class="btn btn-secondary chamfer-all-corners btn-remove-from-catalog" data-id="${reg.id}" style="font-size: 11px; padding: 6px 14px;">REMOVE</button>`
            : `<button class="btn btn-primary chamfer-all-corners btn-add-from-catalog" data-id="${reg.id}" style="font-size: 11px; padding: 6px 14px;">➕ ADD</button>`
          }
        </div>
      `;

      listEl.appendChild(card);
    });

    // Attach click events
    listEl.querySelectorAll('.btn-add-from-catalog').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addWidget(btn.dataset.id);
      });
    });

    listEl.querySelectorAll('.btn-remove-from-catalog').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeWidget(btn.dataset.id);
      });
    });
  }

  /* --- Export / Import JSON & Reset --- */

  exportLayoutJson() {
    const layout = this.getCurrentLayoutState();
    const data = {
      app: 'APEX Motorsport Telemetry',
      version: '2.9',
      exportedAt: new Date().toISOString(),
      layout
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-pitwall-layout-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Layout JSON exported successfully', 'success');
  }

  importLayoutJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const layout = parsed.layout || parsed;
        if (Array.isArray(layout)) {
          this.applyLayout(layout, true);
          this.showToast('Layout imported and applied', 'success');
        } else {
          throw new Error('Invalid JSON format: missing layout array');
        }
      } catch (err) {
        console.error('[LayoutManager] Import error:', err);
        this.showToast('Failed to import layout JSON: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  }

  resetToDefault() {
    if (confirm('Reset dashboard layout to default F1 Pit-Wall configuration?')) {
      const defaultLayout = JSON.parse(JSON.stringify(this.presets.default.layout));
      this.applyLayout(defaultLayout, true);
    }
  }

  /* --- Global Event Binding --- */

  bindGlobalEvents() {
    // Header Customize button
    const headerBtn = document.getElementById('btn-toggle-edit-layout');
    if (headerBtn) {
      headerBtn.addEventListener('click', () => this.toggleEditMode());
    }

    // Done button on edit toolbar
    const doneBtn = document.getElementById('btn-done-edit-layout');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => this.toggleEditMode(false));
    }

    // Add widget button
    const addBtn = document.getElementById('btn-toggle-widget-drawer');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openWidgetDrawer());
    }

    // Close drawer button & backdrop
    const closeDrawerBtn = document.getElementById('btn-close-widget-drawer');
    const drawerBackdrop = document.getElementById('widget-drawer-backdrop');
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => this.closeWidgetDrawer());
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', () => this.closeWidgetDrawer());

    // Preset selector
    const presetSelect = document.getElementById('select-layout-preset');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const presetKey = e.target.value;
        if (this.presets[presetKey]) {
          this.applyLayout(JSON.parse(JSON.stringify(this.presets[presetKey].layout)), true);
        }
        e.target.value = '';
      });
    }

    // Reset button
    const resetBtn = document.getElementById('btn-reset-layout');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetToDefault());
    }

    // Export button
    const exportBtn = document.getElementById('btn-export-layout');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLayoutJson());
    }

    // Import button & file input
    const importBtn = document.getElementById('btn-import-layout');
    const importInput = document.getElementById('input-import-layout-file');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.importLayoutJson(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Keyboard shortcut (E to toggle edit mode, Esc to exit or close drawer)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        this.toggleEditMode();
      } else if (e.key === 'Escape') {
        const drawer = document.getElementById('widget-catalog-drawer');
        if (drawer && drawer.classList.contains('active')) {
          this.closeWidgetDrawer();
        } else if (this.isEditMode) {
          this.toggleEditMode(false);
        }
      }
    });
  }
}
