/**
 * APEX WebSocket Client for Browser
 */
import { CircularBuffer } from './circular-buffer.js';

export class ApexWsClient {
  constructor(options = {}) {
    let locUrl = 'ws://127.0.0.1:3000';
    let locHost = '127.0.0.1';
    let locHostname = '127.0.0.1';

    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      locHost = window.location.host || '127.0.0.1:3000';
      locHostname = window.location.hostname || '127.0.0.1';
      locUrl = `${protocol}//${locHost}`;
    }

    this.primaryUrl = options.url || locUrl;
    
    // Candidates pool
    const candidates = [
      this.primaryUrl,
      `ws://${locHost}`,
      `ws://${locHostname}:3000`,
      `ws://${locHostname}:8080`,
      'ws://127.0.0.1:3000',
      'ws://localhost:3000',
      'ws://127.0.0.1:8080',
      'ws://localhost:8080'
    ];

    // Deduplicate
    this.endpoints = Array.from(new Set(candidates));
    this.currentEndpointIndex = 0;
    this.url = this.endpoints[0];

    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectIntervalMs = 1200;
    this.maxReconnectIntervalMs = 5000;
    this.currentReconnectDelay = this.reconnectIntervalMs;

    this.socket = null;
    this.buffer = new CircularBuffer(options.bufferCapacity || 100000);
    this.isConnected = false;

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

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

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

  connect() {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return;
    }

    try {
      this.socket = new WebSocket(this.url);

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

        // Cycle to next endpoint candidate on disconnect
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
        this.url = this.endpoints[this.currentEndpointIndex];

        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        this.emit('error', err);
      };
    } catch (err) {
      this.emit('error', err);
      this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
      this.url = this.endpoints[this.currentEndpointIndex];
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  handleMessage(raw) {
    try {
      const payload = JSON.parse(raw);
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
      console.warn('[ApexWsClient] Parse error:', err);
    }
  }

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
