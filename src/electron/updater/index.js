/**
 * APEX Telemetry Command Center - Updater IPC Bridge & Lifecycle Orchestrator
 * Coordinates update polling, streaming progress, staging verification,
 * and seamless background or on-demand update lifecycle events.
 */

import path from 'node:path';
import fs from 'node:fs';
import electronPkg from 'electron';
const electron = (typeof electronPkg === 'object' && electronPkg !== null) ? electronPkg : {};
const { app, BrowserWindow, ipcMain, shell } = electron;

import { checkForUpdates } from './update-checker.js';
import {
  downloadFile,
  getStagingDirectory,
  STAGE_FILENAME,
  executeInPlaceSwap,
  getTargetExecutablePath,
  isPortableEnvironment
} from './binary-swapper.js';

let activeDownloadController = null;
let currentUpdateInfo = null;
let currentStagedFile = null;
let currentStatus = {
  state: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'installing' | 'error'
  currentVersion: app?.getVersion() || '1.0.0',
  latestVersion: null,
  updateInfo: null,
  error: null,
  progress: null
};

/**
 * Dynamically resolves the main window instance.
 * @param {BrowserWindow|function|null} [windowRef]
 * @returns {BrowserWindow|null}
 */
function getActiveWindow(windowRef) {
  if (typeof windowRef === 'function') return windowRef();
  if (windowRef && typeof windowRef === 'object' && 'mainWindow' in windowRef) {
    return windowRef.mainWindow;
  }
  if (windowRef && !windowRef.isDestroyed?.()) return windowRef;
  if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    return BrowserWindow.getAllWindows()[0] || null;
  }
  return null;
}

/**
 * Updates internal status and broadcasts to renderer window if available.
 * @param {BrowserWindow|function|object|null} windowRef
 * @param {object} partialStatus
 */
function setStatus(windowRef, partialStatus) {
  currentStatus = { ...currentStatus, ...partialStatus };
  const win = getActiveWindow(windowRef);
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:status-change', currentStatus);
  }
}

/**
 * Registers all Electron IPC handlers for the APEX updater.
 * @param {object} params
 * @param {BrowserWindow} [params.mainWindow]
 * @param {object} [params.ipc] - Custom or mock IPC router (defaults to Electron ipcMain)
 * @param {object} [params.options]
 */
export function registerUpdaterIpc({ mainWindow, ipc = ipcMain, options = {} } = {}) {
  if (!ipc || typeof ipc.handle !== 'function') return;
  const currentVersion = options.currentVersion || (app ? app.getVersion() : '1.0.0');

  // Check for updates
  ipc.handle('updater:check', async (_event, checkOptions = {}) => {
    try {
      setStatus(mainWindow, { state: 'checking', error: null });

      const result = await checkForUpdates({
        currentVersion,
        force: Boolean(checkOptions.force)
      });

      if (!result.success) {
        setStatus(mainWindow, { state: 'error', error: result.error });
        return result;
      }

      currentUpdateInfo = result;

      if (result.updateAvailable) {
        setStatus(mainWindow, {
          state: 'available',
          latestVersion: result.latestVersion,
          updateInfo: result
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:available', result);
        }
      } else {
        setStatus(mainWindow, {
          state: 'not-available',
          latestVersion: result.latestVersion,
          updateInfo: result
        });
      }

      return result;
    } catch (err) {
      const errorMsg = err.message || 'Unknown update check error';
      setStatus(mainWindow, { state: 'error', error: errorMsg });
      return { success: false, updateAvailable: false, error: errorMsg };
    }
  });

  // Start downloading the update binary
  ipc.handle('updater:download', async (_event, downloadParams = {}) => {
    const downloadUrl = downloadParams.downloadUrl || currentUpdateInfo?.downloadUrl;
    if (!downloadUrl) {
      return { success: false, error: 'No download URL provided or available in release metadata' };
    }

    try {
      if (activeDownloadController) {
        activeDownloadController.abort();
      }
      activeDownloadController = new AbortController();

      const stageDir = getStagingDirectory();
      const stagedFilePath = path.join(stageDir, STAGE_FILENAME);

      setStatus(mainWindow, {
        state: 'downloading',
        error: null,
        progress: { bytesDownloaded: 0, totalBytes: currentUpdateInfo?.assetSize || 0, percent: 0 }
      });

      const downloadResult = await downloadFile(downloadUrl, stagedFilePath, {
        signal: activeDownloadController.signal,
        onProgress: (progress) => {
          setStatus(mainWindow, { progress });
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:download-progress', progress);
          }
        }
      });

      activeDownloadController = null;
      currentStagedFile = downloadResult.filePath;

      setStatus(mainWindow, {
        state: 'downloaded',
        error: null,
        stagedPath: downloadResult.filePath,
        sha256: downloadResult.sha256
      });

      return {
        success: true,
        stagedPath: downloadResult.filePath,
        sha256: downloadResult.sha256
      };
    } catch (err) {
      activeDownloadController = null;
      const isAbort = err.message.includes('aborted');
      const newState = isAbort ? 'available' : 'error';
      setStatus(mainWindow, { state: newState, error: isAbort ? null : err.message });
      return { success: false, error: err.message, aborted: isAbort };
    }
  });

  // Cancel in-progress download
  ipc.handle('updater:cancel', async () => {
    if (activeDownloadController) {
      activeDownloadController.abort();
      activeDownloadController = null;
    }
    setStatus(mainWindow, { state: 'idle', error: null, progress: null });
    return { success: true };
  });

  // Install downloaded update and restart
  ipc.handle('updater:install-restart', async () => {
    const stageDir = getStagingDirectory();
    const stagedFilePath = currentStagedFile || path.join(stageDir, STAGE_FILENAME);

    if (!fs.existsSync(stagedFilePath)) {
      return { success: false, error: 'Staged update binary not found. Please download again.' };
    }

    try {
      setStatus(mainWindow, { state: 'installing' });

      const swapResult = await executeInPlaceSwap({
        stagedExePath: stagedFilePath,
        targetExePath: getTargetExecutablePath(),
        targetPid: process.pid,
        quitFn: () => {
          if (app) app.quit();
        }
      });

      return { success: true, swapScriptPath: swapResult.swapScriptPath };
    } catch (err) {
      setStatus(mainWindow, { state: 'error', error: err.message });
      return { success: false, error: err.message };
    }
  });

  // Open staging directory or manual download fallback in File Explorer
  ipc.handle('updater:open-download-folder', async () => {
    try {
      const stageDir = getStagingDirectory();
      if (shell && typeof shell.openPath === 'function') {
        await shell.openPath(stageDir);
      }
      return { success: true, path: stageDir };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Get current updater status
  ipc.handle('updater:get-status', () => {
    return {
      ...currentStatus,
      isPortable: isPortableEnvironment(),
      targetPath: getTargetExecutablePath()
    };
  });
}

/**
 * Triggers a non-blocking background check for updates on startup.
 * @param {BrowserWindow} mainWindow
 * @param {number} [delayMs=3500]
 */
export function scheduleStartupUpdateCheck(mainWindow, delayMs = 3500) {
  setTimeout(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
      const currentVersion = app ? app.getVersion() : '1.0.0';
      const result = await checkForUpdates({ currentVersion, force: false });

      if (result.success && result.updateAvailable) {
        currentUpdateInfo = result;
        setStatus(mainWindow, {
          state: 'available',
          latestVersion: result.latestVersion,
          updateInfo: result
        });
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('updater:available', result);
        }
      }
    } catch (err) {
      // Background check fails silently to never disturb driver startup
      console.warn('[UPDATER] Background check failed silently:', err.message);
    }
  }, delayMs);
}
