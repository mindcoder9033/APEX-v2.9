/**
 * APEX Circular Buffer (Ring Buffer)
 * High-performance, fixed-capacity ring buffer for real-time telemetry streaming.
 * Prevents memory leaks by maintaining a fixed upper bound of samples.
 */

export class CircularBuffer {
  /**
   * @param {number} capacity Maximum number of samples to store (default: 100,000)
   */
  constructor(capacity = 100000) {
    if (capacity <= 0) {
      throw new Error('CircularBuffer capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.size = 0;
    this.totalSamplesReceived = 0;
  }

  /**
   * Pushes a new sample into the circular buffer.
   * O(1) time complexity.
   * @param {Object} sample 
   */
  push(sample) {
    this.buffer[this.head] = sample;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
    this.totalSamplesReceived++;
  }

  /**
   * Retrieves item at logical index `i`, where 0 is the oldest item currently in buffer
   * and `size - 1` is the newest item.
   * @param {number} index 
   * @returns {Object|undefined}
   */
  get(index) {
    if (index < 0 || index >= this.size) {
      return undefined;
    }
    const startIdx = (this.head - this.size + this.capacity) % this.capacity;
    const actualIdx = (startIdx + index) % this.capacity;
    return this.buffer[actualIdx];
  }

  /**
   * Returns the most recently pushed sample
   * @returns {Object|null}
   */
  latest() {
    if (this.size === 0) return null;
    const latestIdx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIdx];
  }

  /**
   * Returns the oldest sample in the buffer
   * @returns {Object|null}
   */
  oldest() {
    if (this.size === 0) return null;
    return this.get(0);
  }

  /**
   * Returns an array of the latest N samples
   * @param {number} count 
   * @returns {Array<Object>}
   */
  getRecent(count) {
    const n = Math.min(count, this.size);
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
      result[i] = this.get(this.size - n + i);
    }
    return result;
  }

  /**
   * Returns all stored samples in chronological order as a standard array
   * @returns {Array<Object>}
   */
  toArray() {
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.get(i);
    }
    return result;
  }

  /**
   * Filters stored samples by a specific lap number
   * @param {number} lapNumber 
   * @returns {Array<Object>}
   */
  getByLap(lapNumber) {
    const samples = [];
    for (let i = 0; i < this.size; i++) {
      const sample = this.get(i);
      if (sample && sample.timing && sample.timing.lapNumber === lapNumber) {
        samples.push(sample);
      }
    }
    return samples;
  }

  /**
   * Returns unique lap numbers present in the buffer
   * @returns {number[]}
   */
  getLapNumbers() {
    const laps = new Set();
    for (let i = 0; i < this.size; i++) {
      const sample = this.get(i);
      if (sample && sample.timing && sample.timing.lapNumber !== undefined) {
        laps.add(sample.timing.lapNumber);
      }
    }
    return Array.from(laps).sort((a, b) => a - b);
  }

  /**
   * Clears the buffer
   */
  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
    this.totalSamplesReceived = 0;
  }

  /**
   * Returns buffer diagnostics
   */
  getStats() {
    return {
      size: this.size,
      capacity: this.capacity,
      utilizationPercent: ((this.size / this.capacity) * 100).toFixed(2),
      totalSamplesReceived: this.totalSamplesReceived
    };
  }
}
