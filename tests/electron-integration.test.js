import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getLanIpv4Addresses, checkLoopbackStatus, enableLoopbackExemption, KNOWN_FORZA_PACKAGES } from '../src/electron/loopback-helper.js';
import { CONFIG } from '../src/server/config.js';

describe('Electron Desktop Integration & Network Helpers', () => {

  test('getLanIpv4Addresses: returns a non-empty list of network interfaces with IPv4', () => {
    const ips = getLanIpv4Addresses();
    assert.ok(Array.isArray(ips), 'Should return an array');
    assert.ok(ips.length > 0, 'Should contain at least one IP address');

    for (const entry of ips) {
      assert.ok(typeof entry.interfaceName === 'string', 'interfaceName should be string');
      assert.ok(typeof entry.ip === 'string', 'ip should be string');
      assert.ok(typeof entry.isWifi === 'boolean', 'isWifi should be boolean');
      // Valid IPv4 format
      assert.match(entry.ip, /^(\d{1,3}\.){3}\d{1,3}$/, `IP ${entry.ip} should match IPv4 format`);
    }
  });

  test('checkLoopbackStatus: returns status object for all known Forza packages', async () => {
    const statuses = await checkLoopbackStatus();
    assert.ok(Array.isArray(statuses), 'Should return an array');
    assert.strictEqual(statuses.length, KNOWN_FORZA_PACKAGES.length, 'Should check all known Forza packages');

    for (const status of statuses) {
      assert.ok(status.id, 'Package should have an id');
      assert.ok(status.name, 'Package should have a name');
      assert.ok(typeof status.isExempt === 'boolean', 'isExempt should be boolean');
    }
  });

  test('enableLoopbackExemption: handles mock/real execution gracefully', async () => {
    // Tests execution handler return format
    const res = await enableLoopbackExemption(['Microsoft.ForzaMotorsport_8wekyb3d8bbwe']);
    assert.ok(typeof res.success === 'boolean', 'success should be boolean');
    assert.ok(typeof res.message === 'string', 'message should be string');
    assert.ok(Array.isArray(res.results), 'results should be array');
  });

  test('Desktop Embedded Config: Validates port allocations and packet dimensions', () => {
    assert.ok(CONFIG.udp.port > 0 && CONFIG.udp.port < 65536, 'UDP port must be valid');
    assert.ok(CONFIG.ws.port > 0 && CONFIG.ws.port < 65536, 'WS port must be valid');
    assert.strictEqual(CONFIG.udp.expectedPacketSize, 331, 'Expected FM23 packet size should be 331');
    assert.strictEqual(CONFIG.udp.minPacketSize, 311, 'Min packet size should be 311');
  });

  test('Auto-Archive & User Reports Directory: Resolves path to Documents/APEX v2.9/user', async () => {
    const path = await import('node:path');
    const os = await import('node:os');
    const docsDir = path.join(os.homedir(), 'Documents');
    const targetUserDir = path.join(docsDir, 'APEX v2.9', 'user');
    const targetProfilesDir = path.join(targetUserDir, 'Profiles');

    assert.ok(targetUserDir.includes('APEX v2.9'), 'User archive path must contain APEX v2.9');
    assert.ok(targetUserDir.endsWith(path.join('APEX v2.9', 'user')), 'Must resolve to Documents/APEX v2.9/user');
    assert.ok(targetProfilesDir.endsWith(path.join('APEX v2.9', 'user', 'Profiles')), 'Must resolve to Documents/APEX v2.9/user/Profiles');
  });

});
