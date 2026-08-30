/**
 * APEX Telemetry Command Center - Binary Swapper & Download Engine
 * Handles streamed downloading, on-the-fly SHA256 verification,
 * and detached PowerShell-based in-place executable replacement for portable Windows builds.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { spawn } from 'node:child_process';

export const STAGE_FILENAME = 'apex-update-stage.exe';
export const SWAP_SCRIPT_FILENAME = 'apex-update-swap.ps1';

/**
 * Returns the path to the current executable that should be replaced upon updating.
 * Prioritizes process.env.PORTABLE_EXECUTABLE_FILE set by electron-builder.
 * @returns {string}
 */
export function getTargetExecutablePath() {
  if (process.env.PORTABLE_EXECUTABLE_FILE && typeof process.env.PORTABLE_EXECUTABLE_FILE === 'string') {
    return path.resolve(process.env.PORTABLE_EXECUTABLE_FILE);
  }
  return path.resolve(process.execPath);
}

/**
 * Checks if the application is running as a packaged portable binary.
 * @returns {boolean}
 */
export function isPortableEnvironment() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR);
}

/**
 * Generates the temporary directory used for staging updates.
 * @returns {string}
 */
export function getStagingDirectory() {
  const stageDir = path.join(os.tmpdir(), 'apex-telemetry-update');
  if (!fs.existsSync(stageDir)) {
    fs.mkdirSync(stageDir, { recursive: true });
  }
  return stageDir;
}

/**
 * Computes SHA256 hash of a local file.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Streams a remote file to a destination path, reporting progress and calculating hash.
 * @param {string} url
 * @param {string} destinationPath
 * @param {object} [options]
 * @param {function} [options.onProgress] - Called with { bytesDownloaded, totalBytes, percent }
 * @param {AbortSignal} [options.signal] - For cancellation
 * @returns {Promise<{ filePath: string, bytesDownloaded: number, sha256: string }>}
 */
export function downloadFile(url, destinationPath, options = {}) {
  return new Promise((resolve, reject) => {
    const { onProgress, signal } = options;

    if (signal?.aborted) {
      return reject(new Error('Download aborted by user'));
    }

    const urlObj = new URL(url);
    const client = urlObj.protocol === 'http:' ? http : https;

    const reqOptions = {
      headers: {
        'User-Agent': 'APEX-Telemetry-Desktop-Updater'
      }
    };

    const req = client.get(url, reqOptions, (res) => {
      // Follow HTTP redirects (301, 302, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return downloadFile(redirectUrl, destinationPath, options)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with HTTP status ${res.statusCode}: ${res.statusMessage}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let bytesDownloaded = 0;
      const hash = crypto.createHash('sha256');
      const fileStream = fs.createWriteStream(destinationPath);

      if (signal) {
        signal.addEventListener('abort', () => {
          req.destroy();
          fileStream.destroy();
          try {
            if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
          } catch (_) {}
          reject(new Error('Download aborted by user'));
        });
      }

      res.on('data', (chunk) => {
        bytesDownloaded += chunk.length;
        hash.update(chunk);
        fileStream.write(chunk);

        if (typeof onProgress === 'function') {
          const percent = totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : null;
          onProgress({ bytesDownloaded, totalBytes, percent });
        }
      });

      res.on('end', () => {
        fileStream.end(() => {
          const digest = hash.digest('hex').toLowerCase();
          resolve({
            filePath: destinationPath,
            bytesDownloaded,
            sha256: digest
          });
        });
      });

      res.on('error', (err) => {
        fileStream.destroy();
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generates the PowerShell script content used for detached in-place executable replacement.
 * Follows PowerShell Windows rules: ASCII only, parentheses around cmdlets, retry loop.
 * @param {object} params
 * @param {number} params.targetPid
 * @param {string} params.targetExePath
 * @param {string} params.stagedExePath
 * @param {string} [params.scriptLogPath]
 * @returns {string}
 */
export function buildSwapPowerShellScript({ targetPid, targetExePath, stagedExePath, scriptLogPath }) {
  const escapedTarget = targetExePath.replace(/'/g, "''");
  const escapedStaged = stagedExePath.replace(/'/g, "''");
  const logLine = scriptLogPath
    ? `Add-Content -Path '${scriptLogPath.replace(/'/g, "''")}' -Value`
    : 'Write-Host';

  return `# APEX Telemetry In-Place Swapper Script
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$targetPid = ${targetPid}
$targetExe = '${escapedTarget}'
$stagedExe = '${escapedStaged}'

${logLine} "[i] Starting APEX in-place update for PID $targetPid..."

# 1. Wait for APEX process to exit
$maxWaitSeconds = 25
$waited = 0
while ($waited -lt $maxWaitSeconds) {
    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if (-not $proc) {
        break
    }
    Start-Sleep -Milliseconds 500
    $waited += 1
}

# 2. In-place binary replacement with retry loop
$replaced = $false
$attempts = 0
while ((-not $replaced) -and ($attempts -lt 10)) {
    try {
        if ((Test-Path -Path $stagedExe)) {
            Copy-Item -Path $stagedExe -Destination $targetExe -Force -ErrorAction Stop
            $replaced = $true
            ${logLine} "[OK] Successfully replaced $targetExe"
        } else {
            ${logLine} "[!] Staged executable not found: $stagedExe"
            break
        }
    } catch {
        $attempts += 1
        Start-Sleep -Milliseconds 600
    }
}

# 3. Clean up staged file
if ((Test-Path -Path $stagedExe)) {
    Remove-Item -Path $stagedExe -Force -ErrorAction SilentlyContinue
}

# 4. Relaunch the updated executable
if ($replaced -and (Test-Path -Path $targetExe)) {
    ${logLine} "[+] Relaunching updated APEX Telemetry..."
    Start-Process -FilePath $targetExe
    exit 0
} else {
    ${logLine} "[X] Failed to replace executable after $attempts attempts."
    exit 1
}
`;
}

/**
 * Spawns the detached PowerShell swap process and prepares the host app to exit.
 * @param {object} params
 * @param {string} params.stagedExePath - Path to verified new binary
 * @param {string} [params.targetExePath] - Path to overwrite (defaults to getTargetExecutablePath())
 * @param {number} [params.targetPid] - Process PID (defaults to process.pid)
 * @param {function} [params.quitFn] - Callback to terminate current Electron app
 * @returns {Promise<{ success: boolean, swapScriptPath: string }>}
 */
export async function executeInPlaceSwap({
  stagedExePath,
  targetExePath = getTargetExecutablePath(),
  targetPid = process.pid,
  quitFn = null
} = {}) {
  if (!fs.existsSync(stagedExePath)) {
    throw new Error(`Staged executable does not exist at: ${stagedExePath}`);
  }

  const stagingDir = path.dirname(stagedExePath);
  const swapScriptPath = path.join(stagingDir, SWAP_SCRIPT_FILENAME);
  const logPath = path.join(stagingDir, 'apex-swap.log');

  const scriptContent = buildSwapPowerShellScript({
    targetPid,
    targetExePath,
    stagedExePath,
    scriptLogPath: logPath
  });

  fs.writeFileSync(swapScriptPath, scriptContent, { encoding: 'utf8' });

  // Launch PowerShell detached so it lives independently of the current Node/Electron process
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', swapScriptPath],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }
  );

  child.unref();

  // If a termination callback was provided (e.g. app.quit()), invoke it
  if (typeof quitFn === 'function') {
    setTimeout(() => {
      quitFn();
    }, 250);
  }

  return {
    success: true,
    swapScriptPath
  };
}
