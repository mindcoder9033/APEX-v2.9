/**
 * APEX WebSocket Client
 * Connects to the local APEX UDP-to-WebSocket bridge (ws://127.0.0.1:8080).
 * Handles auto-reconnect, packet rate monitoring, and stores samples in CircularBuffer.
 */

import { CircularBuffer } from '../shared/circular-buffer.js';

export class ApexWsClient {
  /**
   * @param {Object} options 
   * @param {string} [options.url='ws://127.0.0.1:8080'] WebSocket server URL
   * @param {number} [options.bufferCapacity=100000] Circular buffer capacity
   * @param {boolean} [options.autoReconnect=true] Whether to auto-reconnect on disconnect
   */
  constructor(options = {}) {
    this.url = options.url || 'ws://127.0.0.1:8080';
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectIntervalMs = 2000;
    this.maxReconnectIntervalMs = 10000;
    this.currentReconnectDelay = this.reconnectIntervalMs;

    this.socket = null;
    this.buffer = new CircularBuffer(options.bufferCapacity || 100000);
    this.isConnected = false;
    this.isRecording = false;

    this.stats = {
      packetsReceived: 0,
      packetsPerSecond: 0,
      lastPacketTimestamp: 0
    };

    this._listeners = new Map();
    this._reconnectTimer = null;
    this._rateInterval = null;
    this._recentPackets = 0;
  }

  /**
   * Register event listener ('telemetry', 'status', 'connected', 'disconnected', 'error')
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to registered listeners
   * @param {string} event 
   * @param {*} data 
   */
  emit(event, data) {
    if (this._listeners.has(event)) {
      for (const cb of this._listeners.get(event)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[ApexWsClient] Error in listener for "${event}":`, err);
        }
      }
    }
  }

  /**
   * Open WebSocket connection
   */
  connect() {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return;
    }

    try {
      // Support browser and Node environments
      const WebSocketClass = typeof window !== 'undefined' && window.WebSocket ? window.WebSocket : globalThis.WebSocket;
      if (!WebSocketClass) {
        throw new Error('WebSocket is not supported in this environment');
      }

      this.socket = new WebSocketClass(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.currentReconnectDelay = this.reconnectIntervalMs;
        this.startRateTracker();
        this.emit('connected', { url: this.url });
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onclose = (event) => {
        this.isConnected = false;
        this.stopRateTracker();
        this.emit('disconnected', { code: event.code, reason: event.reason });

        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        this.emit('error', err);
      };
    } catch (err) {
      this.emit('error', err);
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param {string|ArrayBuffer} raw 
   */
  handleMessage(raw) {
    try {
      const payload = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(new TextDecoder().decode(raw));
      
      if (payload.type === 'telemetry') {
        const sample = payload.data;
        this.stats.packetsReceived++;
        this.stats.lastPacketTimestamp = Date.now();
        this._recentPackets++;

        this.buffer.push(sample);
        this.emit('telemetry', sample);
      } else if (payload.type === 'status') {
        this.emit('status', payload.data);
      }
    } catch (err) {
      console.warn('[ApexWsClient] Failed to parse message:', err);
    }
  }

  /**
   * Disconnect client and prevent auto-reconnect
   */
  disconnect() {
    this.autoReconnect = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.stopRateTracker();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Internal reconnection scheduler
   */
  scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.currentReconnectDelay = Math.min(this.currentReconnectDelay * 1.5, this.maxReconnectIntervalMs);
      this.connect();
    }, this.currentReconnectDelay);
  }

  startRateTracker() {
    if (this._rateInterval) return;
    this._rateInterval = setInterval(() => {
      this.stats.packetsPerSecond = this._recentPackets;
      this._recentPackets = 0;
    }, 1000);
  }

  stopRateTracker() {
    if (this._rateInterval) {
      clearInterval(this._rateInterval);
      this._rateInterval = null;
    }
    this.stats.packetsPerSecond = 0;
    this._recentPackets = 0;
  }
}
