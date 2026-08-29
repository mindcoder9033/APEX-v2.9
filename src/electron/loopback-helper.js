import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const KNOWN_FORZA_PACKAGES = [
  { id: 'Microsoft.ForzaMotorsport_8wekyb3d8bbwe', name: 'Forza Motorsport (2023)' },
  { id: 'Microsoft.SunriseBaseGame_8wekyb3d8bbwe', name: 'Forza Horizon 4' },
  { id: 'Microsoft.624F8B84B80_8wekyb3d8bbwe', name: 'Forza Horizon 5' }
];

/**
 * Returns all active, non-internal LAN IPv4 addresses
 * @returns {Array<{interfaceName: string, ip: string, isWifi: boolean}>}
 */
export function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && addr.address !== '127.0.0.1') {
        const isWifi = /wi-?fi|wlan|wireless/i.test(name);
        results.push({
          interfaceName: name,
          ip: addr.address,
          isWifi
        });
      }
    }
  }

  // If no external IP found, fallback to localhost
  if (results.length === 0) {
    results.push({ interfaceName: 'Loopback', ip: '127.0.0.1', isWifi: false });
  }

  return results;
}

/**
 * Parses CheckNetIsolation status to see which Forza packages are currently exempt
 * @returns {Promise<Array<{id: string, name: string, isExempt: boolean}>>}
 */
export async function checkLoopbackStatus() {
  if (process.platform !== 'win32') {
    return KNOWN_FORZA_PACKAGES.map(pkg => ({ ...pkg, isExempt: true }));
  }

  try {
    const { stdout } = await execAsync('CheckNetIsolation.exe LoopbackExempt -s');
    const lowerOutput = stdout.toLowerCase();

    return KNOWN_FORZA_PACKAGES.map(pkg => ({
      ...pkg,
      isExempt: lowerOutput.includes(pkg.id.toLowerCase())
    }));
  } catch (err) {
    // If CheckNetIsolation fails or is not accessible, return current known packages as unknown/false
    return KNOWN_FORZA_PACKAGES.map(pkg => ({
      ...pkg,
      isExempt: false,
      error: err.message
    }));
  }
}

/**
 * Enables UWP loopback exemption for specified packages using CheckNetIsolation.exe
 * @param {Array<string>} [packageIds]
 * @returns {Promise<{success: boolean, message: string, results: Array<Object>}>}
 */
export async function enableLoopbackExemption(packageIds = null) {
  if (process.platform !== 'win32') {
    return { success: true, message: 'Loopback exemption is not required on non-Windows platforms.', results: [] };
  }

  const targets = packageIds || KNOWN_FORZA_PACKAGES.map(p => p.id);
  const commandPromises = targets.map(async (pkgId) => {
    try {
      const { stdout } = await execAsync(`CheckNetIsolation.exe LoopbackExempt -a -n="${pkgId}"`);
      return { pkgId, success: stdout.toLowerCase().includes('ok') || stdout.length === 0, output: stdout.trim() };
    } catch (err) {
      return { pkgId, success: false, error: err.message };
    }
  });

  const results = await Promise.all(commandPromises);
  const allSuccessful = results.every(r => r.success);

  return {
    success: allSuccessful,
    message: allSuccessful
      ? 'Successfully applied UWP loopback exemptions for Forza titles.'
      : 'Some exemptions could not be applied. Administrator privileges may be required.',
    results
  };
}
