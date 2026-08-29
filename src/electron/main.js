/**
 * APEX Telemetry Command Center - Electron Main Process
 * Manages desktop window lifecycle, embedded UDP/WebSocket servers,
 * frameless F1 titlebar IPC, native file archiving, and UWP loopback helpers.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UdpProxyServer } from '../server/udp-proxy.js';
import { CONFIG } from '../server/config.js';
import { getLanIpv4Addresses, checkLoopbackStatus, enableLoopbackExemption } from './loopback-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let proxyServer = null;

async function startEmbeddedBackend() {
  try {
    // In desktop mode, we run UDP receiver and WebSocket broadcaster internally
    proxyServer = new UdpProxyServer({
      httpPort: null, // Frontend is loaded via file://
      udpPort: CONFIG.udp.port,
      wsPort: CONFIG.ws.port
    });

    // Start UDP socket and WebSocket hub
    await proxyServer.startWebSocketServer();
    await proxyServer.startUdpSocket();
    proxyServer.startMetricsTracker();

    console.log(`[ELECTRON] Embedded UDP Ingestion & WebSocket Hub active on ports ${CONFIG.udp.port} / ${CONFIG.ws.port}`);
  } catch (err) {
    console.error(`[ELECTRON ERROR] Failed to start embedded backend:`, err.message);
  }
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '../../public/favicon.ico');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0a0a0c',
    frame: false,
    titleBarStyle: 'hidden',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false // Allows loading local fonts and scripts via file://
    }
  });

  // Load the Pit-Wall UI directly from local filesystem
  const indexPath = path.join(__dirname, '../../public/index.html');
  mainWindow.loadFile(indexPath);

  // Broadcast window maximize state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external URLs in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// Register IPC Handlers
function registerIpcHandlers() {
  // Window Control Handlers
  ipcMain.handle('window:minimize', () => {
    if (mainWindow?.isMinimizable()) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximizable()) mainWindow.maximize();
  });

  ipcMain.handle('window:unmaximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() || false;
  });

  // Native Save File Dialog
  ipcMain.handle('dialog:save-file', async (_event, options = {}) => {
    if (!mainWindow) return { success: false, error: 'No active window' };

    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: options.title || 'Save APEX Export',
        defaultPath: options.defaultPath || options.suggestedName || 'APEX_Export',
        filters: options.filters || [
          { name: 'All Supported', extensions: ['pdf', 'csv', 'json'] },
          { name: 'PDF Reports (*.pdf)', extensions: ['pdf'] },
          { name: 'CSV Telemetry (*.csv)', extensions: ['csv'] },
          { name: 'JSON Dossier (*.json)', extensions: ['json'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // If data is supplied as base64 or utf8, write directly to disk
      if (options.data) {
        const encoding = options.encoding || 'base64';
        const buffer = Buffer.from(options.data, encoding);
        await fs.promises.writeFile(result.filePath, buffer);
      }

      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Auto-Archive Stint Reports to Documents/APEX Telemetry/Reports/
  ipcMain.handle('file:auto-archive', async (_event, fileData = {}) => {
    try {
      const docsDir = app.getPath('documents');
      const archiveDir = path.join(docsDir, 'APEX Telemetry', 'Reports');
      await fs.promises.mkdir(archiveDir, { recursive: true });

      const fileName = fileData.fileName || `APEX_Stint_${Date.now()}.${fileData.extension || 'pdf'}`;
      const filePath = path.join(archiveDir, fileName);

      if (fileData.data) {
        const encoding = fileData.encoding || 'base64';
        const buffer = Buffer.from(fileData.data, encoding);
        await fs.promises.writeFile(filePath, buffer);
      }

      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Open Reports Archive Folder in File Explorer
  ipcMain.handle('system:open-reports-folder', async () => {
    try {
      const docsDir = app.getPath('documents');
      const archiveDir = path.join(docsDir, 'APEX Telemetry', 'Reports');
      await fs.promises.mkdir(archiveDir, { recursive: true });
      await shell.openPath(archiveDir);
      return { success: true, path: archiveDir };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // System & Network Diagnostics
  ipcMain.handle('system:get-lan-ip', () => {
    return getLanIpv4Addresses();
  });

  ipcMain.handle('system:check-loopback', async () => {
    return await checkLoopbackStatus();
  });

  ipcMain.handle('system:enable-loopback', async (_event, packageIds) => {
    return await enableLoopbackExemption(packageIds);
  });
}

// Application Lifecycle
app.whenReady().then(async () => {
  registerIpcHandlers();
  await startEmbeddedBackend();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (proxyServer) {
    await proxyServer.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
