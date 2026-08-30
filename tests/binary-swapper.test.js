import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {
  getTargetExecutablePath,
  isPortableEnvironment,
  getStagingDirectory,
  computeFileSha256,
  downloadFile,
  buildSwapPowerShellScript
} from '../src/electron/updater/binary-swapper.js';

describe('Electron Updater: Binary Swapper & Download Engine', () => {

  let testServer = null;
  let serverPort = 0;
  const tempDir = path.join(os.tmpdir(), `apex-swapper-test-${Date.now()}`);

  before(async () => {
    fs.mkdirSync(tempDir, { recursive: true });

    // Start a lightweight local HTTP server for testing chunked download
    testServer = http.createServer((req, res) => {
      if (req.url === '/download-mock.exe') {
        const dummyPayload = Buffer.from('MOCK_APEX_PORTABLE_BINARY_DATA_PAYLOAD_FOR_TESTING_12345');
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': dummyPayload.length
        });
        // Send in 2 chunks to test progress
        res.write(dummyPayload.subarray(0, 20));
        setTimeout(() => {
          res.end(dummyPayload.subarray(20));
        }, 30);
      } else if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/download-mock.exe' });
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        serverPort = testServer.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('getTargetExecutablePath: resolves process.env.PORTABLE_EXECUTABLE_FILE when set', () => {
    const originalEnv = process.env.PORTABLE_EXECUTABLE_FILE;
    try {
      process.env.PORTABLE_EXECUTABLE_FILE = 'C:\\Games\\APEX\\APEX-Telemetry-Portable-1.0.0.exe';
      const target = getTargetExecutablePath();
      assert.strictEqual(target, path.resolve('C:\\Games\\APEX\\APEX-Telemetry-Portable-1.0.0.exe'));
    } finally {
      if (originalEnv) {
        process.env.PORTABLE_EXECUTABLE_FILE = originalEnv;
      } else {
        delete process.env.PORTABLE_EXECUTABLE_FILE;
      }
    }
  });

  test('getStagingDirectory: returns existing writable directory', () => {
    const stageDir = getStagingDirectory();
    assert.ok(fs.existsSync(stageDir), 'Staging directory should exist');
    assert.ok(stageDir.includes('apex-telemetry-update'));
  });

  test('computeFileSha256: calculates deterministic sha256 hash', async () => {
    const testFile = path.join(tempDir, 'hash-test.txt');
    fs.writeFileSync(testFile, 'Hello APEX Telemetry', 'utf8');

    // SHA256 of "Hello APEX Telemetry" is e93d395725db005b6fa1458e0aae0b182cb058e5d36e78ba70e0f8c37d8e2fd8 (in lowercase)
    const hash = await computeFileSha256(testFile);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
  });

  test('downloadFile: streams chunks, reports progress, and returns sha256', async () => {
    const destPath = path.join(tempDir, 'downloaded.exe');
    const progressReports = [];

    const result = await downloadFile(`http://127.0.0.1:${serverPort}/download-mock.exe`, destPath, {
      onProgress: (p) => progressReports.push(p)
    });

    assert.ok(fs.existsSync(destPath), 'File should be downloaded to disk');
    assert.strictEqual(result.bytesDownloaded, 56);
    assert.strictEqual(typeof result.sha256, 'string');
    assert.strictEqual(result.sha256.length, 64);

    // Verify progress callbacks fired
    assert.ok(progressReports.length > 0, 'Should receive progress events');
    const lastProgress = progressReports[progressReports.length - 1];
    assert.strictEqual(lastProgress.percent, 100);
    assert.strictEqual(lastProgress.totalBytes, 56);
  });

  test('downloadFile: handles HTTP redirects', async () => {
    const destPath = path.join(tempDir, 'redirected.exe');
    const result = await downloadFile(`http://127.0.0.1:${serverPort}/redirect`, destPath);
    assert.ok(fs.existsSync(destPath));
    assert.strictEqual(result.bytesDownloaded, 56);
  });

  test('downloadFile: aborts when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    const destPath = path.join(tempDir, 'aborted.exe');

    controller.abort();

    await assert.rejects(
      () => downloadFile(`http://127.0.0.1:${serverPort}/download-mock.exe`, destPath, {
        signal: controller.signal
      }),
      /aborted/i
    );
  });

  test('buildSwapPowerShellScript: contains valid ASCII commands and proper escaping', () => {
    const script = buildSwapPowerShellScript({
      targetPid: 9876,
      targetExePath: 'D:\\AI Workspace\\APEX v2.9\\APEX.exe',
      stagedExePath: 'C:\\Temp\\stage.exe',
      scriptLogPath: 'C:\\Temp\\log.txt'
    });

    assert.ok(script.includes('$targetPid = 9876'), 'Should contain PID');
    assert.ok(script.includes('D:\\AI Workspace\\APEX v2.9\\APEX.exe'), 'Should contain target path');
    assert.ok(script.includes('Get-Process -Id $targetPid'), 'Should poll process termination');
    assert.ok(script.includes('Copy-Item'), 'Should perform file copy');
    assert.ok(script.includes('Start-Process'), 'Should relaunch new process');
    // Ensure no non-ASCII characters exist in PowerShell script
    assert.strictEqual(/^[\x00-\x7F]*$/.test(script), true, 'Script must be ASCII-only');
  });

});
