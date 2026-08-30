import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVersion,
  parseSemVer,
  compareVersions,
  isNewerVersion,
  extractReleaseAssets,
  checkForUpdates,
  clearUpdateCache
} from '../src/electron/updater/update-checker.js';

describe('Electron Updater: Update Checker & SemVer Engine', () => {

  beforeEach(() => {
    clearUpdateCache();
  });

  test('normalizeVersion: strips leading v and trims whitespace', () => {
    assert.strictEqual(normalizeVersion('v2.9.1'), '2.9.1');
    assert.strictEqual(normalizeVersion('V1.0.0'), '1.0.0');
    assert.strictEqual(normalizeVersion('  v3.4.5  '), '3.4.5');
    assert.strictEqual(normalizeVersion('2.0.0'), '2.0.0');
    assert.strictEqual(normalizeVersion(null), '0.0.0');
    assert.strictEqual(normalizeVersion(''), '0.0.0');
  });

  test('parseSemVer: decomposes version into components', () => {
    assert.deepStrictEqual(parseSemVer('v2.9.1'), {
      major: 2,
      minor: 9,
      patch: 1,
      prerelease: null
    });

    assert.deepStrictEqual(parseSemVer('1.0.0-rc.1'), {
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: 'rc.1'
    });
  });

  test('compareVersions: accurately ranks version pairs', () => {
    // Major difference
    assert.strictEqual(compareVersions('2.0.0', '1.9.9'), 1);
    assert.strictEqual(compareVersions('1.0.0', '2.0.0'), -1);

    // Minor difference
    assert.strictEqual(compareVersions('2.9.0', '2.8.9'), 1);
    assert.strictEqual(compareVersions('2.8.0', '2.9.0'), -1);

    // Patch difference
    assert.strictEqual(compareVersions('1.0.1', '1.0.0'), 1);
    assert.strictEqual(compareVersions('1.0.0', '1.0.1'), -1);

    // Equal versions
    assert.strictEqual(compareVersions('v2.9.0', '2.9.0'), 0);

    // Prerelease vs Release
    assert.strictEqual(compareVersions('1.0.0', '1.0.0-beta'), 1);
    assert.strictEqual(compareVersions('1.0.0-beta', '1.0.0'), -1);
  });

  test('isNewerVersion: evaluates if target is strictly newer', () => {
    assert.strictEqual(isNewerVersion('2.9.1', '2.9.0'), true);
    assert.strictEqual(isNewerVersion('v2.9.1', 'v1.0.0'), true);
    assert.strictEqual(isNewerVersion('1.0.0', '1.0.0'), false);
    assert.strictEqual(isNewerVersion('1.0.0', '2.0.0'), false);
  });

  test('extractReleaseAssets: discovers portable exe, fallback exe, and sha256 checksum', () => {
    const mockAssets = [
      {
        name: 'Source-code.zip',
        browser_download_url: 'https://github.com/test/source.zip',
        size: 102400
      },
      {
        name: 'APEX-Telemetry-Portable-2.9.1.exe',
        browser_download_url: 'https://github.com/test/APEX-Telemetry-Portable-2.9.1.exe',
        size: 98765432
      },
      {
        name: 'APEX-Telemetry-Portable-2.9.1.exe.sha256',
        browser_download_url: 'https://github.com/test/APEX-Telemetry-Portable-2.9.1.exe.sha256',
        size: 96
      }
    ];

    const extracted = extractReleaseAssets(mockAssets);
    assert.strictEqual(extracted.assetName, 'APEX-Telemetry-Portable-2.9.1.exe');
    assert.strictEqual(extracted.downloadUrl, 'https://github.com/test/APEX-Telemetry-Portable-2.9.1.exe');
    assert.strictEqual(extracted.assetSize, 98765432);
    assert.strictEqual(extracted.checksumUrl, 'https://github.com/test/APEX-Telemetry-Portable-2.9.1.exe.sha256');
  });

  test('checkForUpdates: detects available newer version with mock GitHub API payload', async () => {
    const mockPayload = {
      tag_name: 'v2.9.1',
      name: 'APEX v2.9.1 - Precision Telemetry Update',
      body: '## Changes\n- Improved friction circle graphing\n- In-place portable auto-update',
      published_at: '2026-08-30T12:00:00Z',
      html_url: 'https://github.com/mindcoder9033/APEX-v2.9/releases/tag/v2.9.1',
      assets: [
        {
          name: 'APEX-Telemetry-Portable-2.9.1.exe',
          browser_download_url: 'https://github.com/mindcoder9033/APEX-v2.9/releases/download/v2.9.1/APEX-Telemetry-Portable-2.9.1.exe',
          size: 95000000
        },
        {
          name: 'APEX-Telemetry-Portable-2.9.1.exe.sha256',
          browser_download_url: 'https://github.com/mindcoder9033/APEX-v2.9/releases/download/v2.9.1/APEX-Telemetry-Portable-2.9.1.exe.sha256',
          size: 110
        }
      ]
    };

    const mockFetch = async () => mockPayload;

    const res = await checkForUpdates({
      currentVersion: '1.0.0',
      fetchFn: mockFetch
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.updateAvailable, true);
    assert.strictEqual(res.currentVersion, '1.0.0');
    assert.strictEqual(res.latestVersion, '2.9.1');
    assert.strictEqual(res.tagName, 'v2.9.1');
    assert.strictEqual(res.releaseName, 'APEX v2.9.1 - Precision Telemetry Update');
    assert.ok(res.releaseNotes.includes('In-place portable auto-update'));
    assert.strictEqual(res.downloadUrl, 'https://github.com/mindcoder9033/APEX-v2.9/releases/download/v2.9.1/APEX-Telemetry-Portable-2.9.1.exe');
    assert.strictEqual(res.checksumUrl, 'https://github.com/mindcoder9033/APEX-v2.9/releases/download/v2.9.1/APEX-Telemetry-Portable-2.9.1.exe.sha256');
    assert.strictEqual(res.cached, false);
  });

  test('checkForUpdates: recognizes when app is already up to date or ahead', async () => {
    const mockPayload = {
      tag_name: 'v1.0.0',
      name: 'APEX v1.0.0 Initial Release',
      body: 'Initial release',
      assets: []
    };

    const mockFetch = async () => mockPayload;

    const res = await checkForUpdates({
      currentVersion: '1.0.0',
      fetchFn: mockFetch
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.updateAvailable, false);
    assert.strictEqual(res.currentVersion, '1.0.0');
    assert.strictEqual(res.latestVersion, '1.0.0');
  });

  test('checkForUpdates: caches responses and respects force flag', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { tag_name: 'v2.0.0', name: 'v2.0.0', assets: [] };
    };

    // First call fetches from API
    const res1 = await checkForUpdates({ currentVersion: '1.0.0', fetchFn: mockFetch });
    assert.strictEqual(res1.cached, false);
    assert.strictEqual(callCount, 1);

    // Second call serves from cache
    const res2 = await checkForUpdates({ currentVersion: '1.0.0', fetchFn: mockFetch });
    assert.strictEqual(res2.cached, true);
    assert.strictEqual(callCount, 1);

    // Force flag bypasses cache
    const res3 = await checkForUpdates({ currentVersion: '1.0.0', force: true, fetchFn: mockFetch });
    assert.strictEqual(res3.cached, false);
    assert.strictEqual(callCount, 2);
  });

  test('checkForUpdates: handles network and API errors gracefully without throwing', async () => {
    const mockFetchError = async () => {
      throw new Error('GitHub API rate limit exceeded or access forbidden (403)');
    };

    const res = await checkForUpdates({
      currentVersion: '1.0.0',
      fetchFn: mockFetchError
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.updateAvailable, false);
    assert.ok(res.error.includes('rate limit exceeded'));
  });

});
