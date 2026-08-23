import test from 'node:test';
import assert from 'node:assert/strict';
import { CircularBuffer } from '../src/shared/circular-buffer.js';

test('CircularBuffer: Basic push, get, and latest retrieval', () => {
  const buf = new CircularBuffer(5);
  assert.equal(buf.size, 0);
  assert.equal(buf.latest(), null);

  buf.push({ id: 1 });
  buf.push({ id: 2 });
  buf.push({ id: 3 });

  assert.equal(buf.size, 3);
  assert.equal(buf.get(0).id, 1);
  assert.equal(buf.get(1).id, 2);
  assert.equal(buf.get(2).id, 3);
  assert.equal(buf.latest().id, 3);
  assert.equal(buf.oldest().id, 1);
});

test('CircularBuffer: Capacity wrap-around and overwrite oldest', () => {
  const buf = new CircularBuffer(3);

  buf.push({ id: 1 });
  buf.push({ id: 2 });
  buf.push({ id: 3 });
  buf.push({ id: 4 }); // Overwrites 1

  assert.equal(buf.size, 3);
  assert.equal(buf.get(0).id, 2);
  assert.equal(buf.get(1).id, 3);
  assert.equal(buf.get(2).id, 4);
  assert.equal(buf.oldest().id, 2);
  assert.equal(buf.latest().id, 4);

  buf.push({ id: 5 }); // Overwrites 2
  assert.equal(buf.get(0).id, 3);
  assert.equal(buf.get(1).id, 4);
  assert.equal(buf.get(2).id, 5);
});

test('CircularBuffer: Lap filtering and queries', () => {
  const buf = new CircularBuffer(10);
  buf.push({ id: 1, timing: { lapNumber: 1 } });
  buf.push({ id: 2, timing: { lapNumber: 1 } });
  buf.push({ id: 3, timing: { lapNumber: 2 } });
  buf.push({ id: 4, timing: { lapNumber: 2 } });
  buf.push({ id: 5, timing: { lapNumber: 3 } });

  const lap1 = buf.getByLap(1);
  assert.equal(lap1.length, 2);
  assert.equal(lap1[0].id, 1);

  const lap2 = buf.getByLap(2);
  assert.equal(lap2.length, 2);

  const lapNumbers = buf.getLapNumbers();
  assert.deepEqual(lapNumbers, [1, 2, 3]);
});

test('CircularBuffer: Clear and stats', () => {
  const buf = new CircularBuffer(100);
  for (let i = 0; i < 25; i++) {
    buf.push({ i });
  }

  const stats = buf.getStats();
  assert.equal(stats.size, 25);
  assert.equal(stats.capacity, 100);
  assert.equal(stats.utilizationPercent, '25.00');

  buf.clear();
  assert.equal(buf.size, 0);
  assert.equal(buf.latest(), null);
});
