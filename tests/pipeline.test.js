import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { WebSocket } from 'ws';
import { UdpProxyServer } from '../src/server/udp-proxy.js';
import { ApexWsClient } from '../src/client/ws-client.js';
import { MockTelemetryGenerator } from '../src/server/mock-telemetry-feed.js';

// Polyfill global WebSocket for ApexWsClient in Node test environment
globalThis.WebSocket = WebSocket;

test('Pipeline Integration: End-to-end UDP -> Proxy -> WebSocket -> WS Client', async () => {
  const testUdpPort = 9988;
  const testWsPort = 8088;

  const server = new UdpProxyServer({
    udpPort: testUdpPort,
    wsPort: testWsPort
  });

  await server.start();

  const client = new ApexWsClient({
    url: `ws://127.0.0.1:${testWsPort}`,
    autoReconnect: false
  });

  const receivedSamples = [];

  const clientConnectedPromise = new Promise((resolve) => {
    client.on('connected', resolve);
  });

  client.on('telemetry', (sample) => {
    receivedSamples.push(sample);
  });

  client.connect();
  await clientConnectedPromise;

  // Send synthetic UDP packets
  const udpClient = dgram.createSocket('udp4');
  const packet = MockTelemetryGenerator.buildPacket({
    timestampMs: 555555,
    speedMps: 50.0,
    accelByte: 255,
    brakeByte: 0,
    gear: 5,
    lapNumber: 3
  });

  await new Promise((resolve, reject) => {
    udpClient.send(packet, testUdpPort, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Wait briefly for WS dispatch
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(receivedSamples.length, 1);
  const sample = receivedSamples[0];

  assert.equal(sample.timestampMs, 555555);
  assert.equal(sample.timing.lapNumber, 3);
  assert.equal(sample.inputs.gear, 5);
  assert.ok(Math.abs(sample.motion.speedMph - 111.85) < 0.1);

  // Check client's circular buffer
  assert.equal(client.buffer.size, 1);
  assert.equal(client.buffer.latest().timestampMs, 555555);

  // Cleanup
  udpClient.close();
  client.disconnect();
  await server.stop();
});
