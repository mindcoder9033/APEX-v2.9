/**
 * APEX Pit-Wall Toast Notification Engine (Sonner-Inspired)
 * Encodes Emil Kowalski design engineering principles:
 * - Direct global DX (`PitToast.show()`, `PitToast.success()`, etc.)
 * - Zero layout thrashing (GPU accelerated transforms & opacity)
 * - Momentum-based swipe dismiss
 * - Auto-pause on tab/document visibility change
 */

(function () {
  'use strict';

  class PitToastManager {
    constructor() {
      this.container = null;
      this.toasts = new Map();
      this.maxToasts = 4;
      this.isTabActive = true;
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._createContainer());
      } else {
        this._createContainer();
      }

      // Handle visibility pause (Sonner Principle: Handle edge cases invisibly)
      document.addEventListener('visibilitychange', () => {
        this.isTabActive = !document.hidden;
      });
    }

    _createContainer() {
      if (document.getElementById('apex-toast-container')) {
        this.container = document.getElementById('apex-toast-container');
        return;
      }
      this.container = document.createElement('div');
      this.container.id = 'apex-toast-container';
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    }

    /**
     * Display a toast
     * @param {Object} opts
     * @param {string} opts.title - Toast title
     * @param {string} opts.message - Toast body description
     * @param {string} [opts.type='info'] - 'success' | 'warning' | 'error' | 'lap' | 'telemetry' | 'info'
     * @param {number} [opts.duration=3500] - Duration in ms
     * @param {string} [opts.icon] - Optional custom emoji / icon
     */
    show(opts = {}) {
      if (!this.container) this._createContainer();

      const {
        title = 'PIT-WALL ALERT',
        message = '',
        type = 'info',
        duration = 3500,
        icon = null
      } = opts;

      // Limit max visible toasts
      if (this.toasts.size >= this.maxToasts) {
        const oldestKey = this.toasts.keys().next().value;
        if (oldestKey) this.dismiss(oldestKey);
      }

      const id = 'toast_' + Math.random().toString(36).substr(2, 9);
      const toastEl = document.createElement('div');
      toastEl.className = `apex-toast toast-${type} toast-entering`;
      toastEl.id = id;
      toastEl.setAttribute('role', 'alert');

      // Pick default icon
      let defaultIcon = '🏁';
      if (type === 'success') defaultIcon = '✓';
      else if (type === 'warning') defaultIcon = '⚠️';
      else if (type === 'error') defaultIcon = '✕';
      else if (type === 'lap') defaultIcon = '⏱️';
      else if (type === 'telemetry') defaultIcon = '📡';

      toastEl.innerHTML = `
        <div class="toast-icon-zone">${icon || defaultIcon}</div>
        <div class="toast-body">
          <div class="toast-title">${title}</div>
          ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
        <div class="toast-progress-bar"></div>
      `;

      this.container.appendChild(toastEl);

      // Force reflow for starting-style fallback
      requestAnimationFrame(() => {
        toastEl.classList.remove('toast-entering');
      });

      // Swipe / Drag Gestures with momentum
      this._bindGestures(toastEl, id);

      // Timer & progress handling
      const progressBar = toastEl.querySelector('.toast-progress-bar');
      const startTime = performance.now();
      let elapsed = 0;
      let animFrameId = null;

      const updateProgress = (now) => {
        if (this.isTabActive) {
          elapsed += (now - lastFrameTime);
        }
        lastFrameTime = now;

        const remaining = Math.max(0, 1 - (elapsed / duration));
        if (progressBar) {
          progressBar.style.transform = `scaleX(${remaining})`;
        }

        if (elapsed >= duration) {
          this.dismiss(id);
        } else {
          animFrameId = requestAnimationFrame(updateProgress);
        }
      };

      let lastFrameTime = performance.now();
      if (duration > 0) {
        animFrameId = requestAnimationFrame(updateProgress);
      }

      // Close button
      const closeBtn = toastEl.querySelector('.toast-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dismiss(id);
        });
      }

      this.toasts.set(id, {
        element: toastEl,
        cancelTimer: () => {
          if (animFrameId) cancelAnimationFrame(animFrameId);
        }
      });

      return id;
    }

    _bindGestures(el, id) {
      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let startTime = 0;
      let isDragging = false;

      const onPointerDown = (e) => {
        if (e.target.closest('.toast-close')) return;
        startX = e.clientX;
        startY = e.clientY;
        currentX = 0;
        startTime = performance.now();
        isDragging = true;
        el.setPointerCapture(e.pointerId);
        el.style.transition = 'none';
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Mostly horizontal drag
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          currentX = Math.max(0, deltaX); // dismiss to the right
          el.style.transform = `translateX(${currentX}px)`;
          el.style.opacity = `${Math.max(0.2, 1 - (currentX / 250))}`;
        }
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}

        const duration = performance.now() - startTime;
        const velocity = currentX / (duration || 1);

        // Momentum check: if dragged > 100px or quick swipe (velocity > 0.4)
        if (currentX > 100 || velocity > 0.4) {
          el.style.transition = 'transform 180ms cubic-bezier(0.23, 1, 0.32, 1), opacity 150ms ease';
          el.style.transform = 'translateX(120%)';
          el.style.opacity = '0';
          setTimeout(() => this.dismiss(id), 180);
        } else {
          // Snap back
          el.style.transition = 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1), opacity 180ms ease';
          el.style.transform = 'translateX(0)';
          el.style.opacity = '1';
        }
      };

      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
    }

    dismiss(id) {
      const toast = this.toasts.get(id);
      if (!toast) return;

      toast.cancelTimer();
      const el = toast.element;
      el.classList.add('toast-exiting');

      setTimeout(() => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
        this.toasts.delete(id);
      }, 200);
    }

    // Convenience Shortcuts
    success(message, title = 'SUCCESS') {
      return this.show({ title, message, type: 'success' });
    }

    warning(message, title = 'WARNING') {
      return this.show({ title, message, type: 'warning' });
    }

    error(message, title = 'TELEMETRY ALERT') {
      return this.show({ title, message, type: 'error' });
    }

    info(message, title = 'INFO') {
      return this.show({ title, message, type: 'info' });
    }

    lap(message, title = 'PERSONAL BEST LAP') {
      return this.show({ title, message, type: 'lap', duration: 4500 });
    }

    telemetry(message, title = 'LIVE TELEMETRY') {
      return this.show({ title, message, type: 'telemetry' });
    }
  }

  window.PitToast = new PitToastManager();
})();
