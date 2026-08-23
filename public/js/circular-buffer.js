/**
 * APEX Circular Buffer (Ring Buffer) for Browser
 */
export class CircularBuffer {
  constructor(capacity = 100000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.size = 0;
    this.totalSamplesReceived = 0;
  }

  push(sample) {
    this.buffer[this.head] = sample;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
    this.totalSamplesReceived++;
  }

  get(index) {
    if (index < 0 || index >= this.size) return undefined;
    const startIdx = (this.head - this.size + this.capacity) % this.capacity;
    const actualIdx = (startIdx + index) % this.capacity;
    return this.buffer[actualIdx];
  }

  latest() {
    if (this.size === 0) return null;
    const latestIdx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIdx];
  }

  oldest() {
    if (this.size === 0) return null;
    return this.get(0);
  }

  toArray() {
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.get(i);
    }
    return result;
  }

  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
    this.totalSamplesReceived = 0;
  }
}
