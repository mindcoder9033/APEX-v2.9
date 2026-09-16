/**
 * APEX Pit Wall Stint Dispatcher
 * Event bus connecting Pit Wall stint events to all APEX subsystems:
 * - Feature 1: Stint Review (5-Page PDF Auto-Export)
 * - Feature 2: Track Dossier (18-Weather Matrix PDF Auto-Export)
 * - Feature 5: Career Mode (Going Faster milestone evaluation)
 */

export class StintDispatcher {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to stint lifecycle events
   * @param {string} event - 'stint:saved' | 'stint:updated' | 'stint:analyzed'
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Dispatches event to all subscribers asynchronously
   * @param {string} event
   * @param {Object} data
   */
  async emit(event, data) {
    if (!this.listeners.has(event)) return;
    const callbacks = Array.from(this.listeners.get(event));
    for (const cb of callbacks) {
      try {
        await cb(data);
      } catch (err) {
        console.error(`[StintDispatcher] Error in listener for ${event}:`, err);
      }
    }
  }
}

export const globalStintDispatcher = new StintDispatcher();
