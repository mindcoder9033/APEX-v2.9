/**
 * APEX Telemetry Command Center - GitHub Release Update Checker
 * Queries GitHub Releases API, parses release metadata & assets,
 * and performs SemVer comparison against the running APEX application.
 */

import https from 'node:https';
import http from 'node:http';

export const DEFAULT_REPO = 'mindcoder9033/APEX-v2.9';
export const DEFAULT_TIMEOUT_MS = 8000;
export const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

let cachedReleaseInfo = null;
let lastCheckTimestamp = 0;

/**
 * Normalizes a SemVer version string (e.g., 'v2.9.1' -> '2.9.1')
 * @param {string} version
 * @returns {string}
 */
export function normalizeVersion(version) {
  if (!version || typeof version !== 'string') return '0.0.0';
  return version.trim().replace(/^v/i, '');
}

/**
 * Parses SemVer components into { major, minor, patch, prerelease }
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number, prerelease: string|null }}
 */
export function parseSemVer(version) {
  const clean = normalizeVersion(version);
  const [core, ...preParts] = clean.split('-');
  const prerelease = preParts.length > 0 ? preParts.join('-') : null;
  const segments = core.split('.').map((s) => parseInt(s, 10) || 0);

  return {
    major: segments[0] ?? 0,
    minor: segments[1] ?? 0,
    patch: segments[2] ?? 0,
    prerelease
  };
}

/**
 * Compares two SemVer strings.
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
export function compareVersions(v1, v2) {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  // If one has a prerelease and the other doesn't, non-prerelease is newer
  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && p2.prerelease) return 1;

  // Both have prereleases or neither does
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

/**
 * Checks whether remote version is strictly newer than current version.
 * @param {string} remoteVersion
 * @param {string} currentVersion
 * @returns {boolean}
 */
export function isNewerVersion(remoteVersion, currentVersion) {
  return compareVersions(remoteVersion, currentVersion) > 0;
}

/**
 * Extracts target portable executable and checksum assets from GitHub release payload.
 * @param {Array<object>} assets
 * @returns {{ downloadUrl: string|null, assetName: string|null, assetSize: number|null, checksumUrl: string|null }}
 */
export function extractReleaseAssets(assets = []) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return { downloadUrl: null, assetName: null, assetSize: null, checksumUrl: null };
  }

  // Priority 1: Specifically portable .exe
  let portableAsset = assets.find((a) => a.name && /portable.*\.exe$/i.test(a.name));
  
  // Priority 2: Any .exe file
  if (!portableAsset) {
    portableAsset = assets.find((a) => a.name && /\.exe$/i.test(a.name));
  }

  // Look for corresponding .sha256 or checksums asset
  const checksumAsset = assets.find((a) => a.name && /(\.sha256|\.sha256sum|checksums\.txt)$/i.test(a.name));

  return {
    downloadUrl: portableAsset?.browser_download_url ?? null,
    assetName: portableAsset?.name ?? null,
    assetSize: portableAsset?.size ?? null,
    checksumUrl: checksumAsset?.browser_download_url ?? null
  };
}

/**
 * Performs an HTTPS GET request returning parsed JSON.
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'http:' ? http : https;

    const reqOptions = {
      headers: {
        'User-Agent': options.userAgent || 'APEX-Telemetry-Desktop',
        Accept: 'application/vnd.github.v3+json',
        ...(options.headers || {})
      }
    };

    const req = client.get(url, reqOptions, (res) => {
      // Handle HTTP redirects (301, 302, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return fetchJson(redirectUrl, options).then(resolve).catch(reject);
      }

      let rawData = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        rawData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 404) {
          return reject(new Error('No releases found for this repository (404)'));
        }
        if (res.statusCode === 403) {
          return reject(new Error('GitHub API rate limit exceeded or access forbidden (403)'));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`GitHub API returned status ${res.statusCode}: ${res.statusMessage}`));
        }

        try {
          const parsed = JSON.parse(rawData);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse JSON from GitHub response: ${e.message}`));
        }
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Request to ${url} timed out after ${timeout}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Checks GitHub Releases for a newer version of APEX.
 * @param {object} params
 * @param {string} params.currentVersion - Current app version from package.json or app.getVersion()
 * @param {string} [params.repo] - GitHub repository ('owner/repo')
 * @param {boolean} [params.force=false] - Bypass in-memory cache
 * @param {function} [params.fetchFn] - Custom fetch function for testing
 * @returns {Promise<object>}
 */
export async function checkForUpdates({
  currentVersion,
  repo = DEFAULT_REPO,
  force = false,
  fetchFn = fetchJson
} = {}) {
  const cleanCurrent = normalizeVersion(currentVersion || '1.0.0');
  const now = Date.now();

  // Return cached result if valid and not forced
  if (!force && cachedReleaseInfo && (now - lastCheckTimestamp < CACHE_TTL_MS)) {
    return {
      ...cachedReleaseInfo,
      cached: true
    };
  }

  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

  try {
    const releaseData = await fetchFn(apiUrl, {
      userAgent: `APEX-Telemetry-Desktop/${cleanCurrent}`
    });

    const tagName = releaseData.tag_name || releaseData.name || '';
    const latestVersion = normalizeVersion(tagName);
    const updateAvailable = isNewerVersion(latestVersion, cleanCurrent);
    const assets = extractReleaseAssets(releaseData.assets || []);

    const result = {
      success: true,
      updateAvailable,
      currentVersion: cleanCurrent,
      latestVersion,
      tagName,
      releaseName: releaseData.name || `APEX Release ${tagName}`,
      releaseNotes: releaseData.body || 'No release notes provided.',
      publishedAt: releaseData.published_at || new Date().toISOString(),
      releaseUrl: releaseData.html_url || `https://github.com/${repo}/releases`,
      downloadUrl: assets.downloadUrl,
      assetName: assets.assetName,
      assetSize: assets.assetSize,
      checksumUrl: assets.checksumUrl,
      cached: false
    };

    cachedReleaseInfo = result;
    lastCheckTimestamp = now;

    return result;
  } catch (err) {
    return {
      success: false,
      updateAvailable: false,
      currentVersion: cleanCurrent,
      latestVersion: null,
      error: err.message,
      cached: false
    };
  }
}

/**
 * Clears the updater cache.
 */
export function clearUpdateCache() {
  cachedReleaseInfo = null;
  lastCheckTimestamp = 0;
}
