/**
 * APEX Tactile Controls & Interaction Engine
 * Implements Emil Kowalski Design Engineering Patterns:
 * 1. Hold-to-Confirm for Critical/Destructive Pit Actions (Session Reset, Stint Wipe)
 * 2. Origin-Aware Tooltips & Grouped Instant Hovers (Skip delay on subsequent elements)
 * 3. Haptic UI Feedback and Scale Damping
 */

(function () {
  'use strict';

  class TactileControlsEngine {
    constructor() {
      this.isInitialized = false;
      this.activeTooltipTrigger = null;
      this.tooltipTimer = null;
      this.lastTooltipTime = 0;
    }

    init() {
      if (this.isInitialized) return;
      this.isInitialized = true;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._bindAll());
      } else {
        this._bindAll();
      }
    }

    _bindAll() {
      this._setupHoldToConfirm();
      this._setupOriginAwareTooltips();
    }

    /**
     * Set up Hold-to-Confirm on reset buttons
     */
    _setupHoldToConfirm() {
      const holdButtons = document.querySelectorAll('[data-hold-confirm], #btn-reset-session, #btn-clear-stints');

      holdButtons.forEach((btn) => {
        // Prevent duplicate setup
        if (btn._tactileBound) return;
        btn._tactileBound = true;

        const originalText = btn.innerHTML;
        const holdDuration = parseInt(btn.getAttribute('data-hold-duration'), 10) || 1600;

        // Wrap or ensure overlay element exists
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';

        let overlay = btn.querySelector('.hold-progress-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'hold-progress-overlay';
          overlay.style.position = 'absolute';
          overlay.style.inset = '0';
          overlay.style.background = 'rgba(225, 6, 0, 0.35)';
          overlay.style.clipPath = 'inset(0 100% 0 0)';
          overlay.style.pointerEvents = 'none';
          overlay.style.transition = 'clip-path 160ms cubic-bezier(0.23, 1, 0.32, 1)';
          btn.appendChild(overlay);
        }

        let holdTimer = null;
        let isHolding = false;
        let startTime = 0;

        const startHold = (e) => {
          if (e.button && e.button !== 0) return; // only left click
          isHolding = true;
          startTime = performance.now();

          // Deliberate slow press transition
          overlay.style.transition = `clip-path ${holdDuration}ms linear`;
          overlay.style.clipPath = 'inset(0 0 0 0)';

          holdTimer = setTimeout(() => {
            if (isHolding) {
              isHolding = false;
              // Trigger success action
              overlay.style.background = 'rgba(0, 204, 102, 0.5)';
              overlay.style.clipPath = 'inset(0 0 0 0)';
              btn.dispatchEvent(new CustomEvent('hold-confirmed', { bubbles: true }));

              if (window.PitToast) {
                window.PitToast.success('Action Confirmed', 'SAFETY LOCK RELEASED');
              }

              setTimeout(() => {
                overlay.style.transition = 'clip-path 160ms cubic-bezier(0.23, 1, 0.32, 1)';
                overlay.style.clipPath = 'inset(0 100% 0 0)';
                overlay.style.background = 'rgba(225, 6, 0, 0.35)';
              }, 300);
            }
          }, holdDuration);
        };

        const cancelHold = () => {
          if (!isHolding) return;
          isHolding = false;
          if (holdTimer) clearTimeout(holdTimer);

          // Fast snap-back on release (Asymmetric enter/exit)
          overlay.style.transition = 'clip-path 160ms cubic-bezier(0.23, 1, 0.32, 1)';
          overlay.style.clipPath = 'inset(0 100% 0 0)';
        };

        btn.addEventListener('pointerdown', startHold);
        btn.addEventListener('pointerup', cancelHold);
        btn.addEventListener('pointerleave', cancelHold);
        btn.addEventListener('pointercancel', cancelHold);
      });
    }

    /**
     * Origin-aware dynamic tooltips with grouped fast hovers
     */
    _setupOriginAwareTooltips() {
      // Find all elements with title or data-tooltip
      const elements = document.querySelectorAll('[data-tooltip]');

      elements.forEach((el) => {
        el.addEventListener('pointerenter', (e) => {
          const now = performance.now();
          const timeSinceLast = now - this.lastTooltipTime;
          // If another tooltip was open within 400ms, skip delay (instant feel)
          const delay = timeSinceLast < 400 ? 0 : 250;

          clearTimeout(this.tooltipTimer);
          this.tooltipTimer = setTimeout(() => {
            this._showTooltip(el);
            this.lastTooltipTime = performance.now();
          }, delay);
        });

        el.addEventListener('pointerleave', () => {
          clearTimeout(this.tooltipTimer);
          this._hideTooltip();
          this.lastTooltipTime = performance.now();
        });
      });
    }

    _showTooltip(target) {
      const text = target.getAttribute('data-tooltip');
      if (!text) return;

      let tooltip = document.getElementById('apex-global-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'apex-global-tooltip';
        tooltip.className = 'apex-tactile-tooltip';
        document.body.appendChild(tooltip);
      }

      tooltip.textContent = text;

      // Position relative to target
      const rect = target.getBoundingClientRect();
      const top = rect.top - 32;
      const left = rect.left + (rect.width / 2);

      tooltip.style.top = `${Math.max(8, top)}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.transform = 'translate(-50%, 0) scale(1)';
      tooltip.style.opacity = '1';
    }

    _hideTooltip() {
      const tooltip = document.getElementById('apex-global-tooltip');
      if (tooltip) {
        tooltip.style.transform = 'translate(-50%, 4px) scale(0.96)';
        tooltip.style.opacity = '0';
      }
    }
  }

  window.TactileControls = new TactileControlsEngine();
  window.TactileControls.init();
})();
