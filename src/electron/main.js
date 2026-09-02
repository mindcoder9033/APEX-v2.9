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
import { registerUpdaterIpc, scheduleStartupUpdateCheck } from './updater/index.js';

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
    console.warn(`[ELECTRON] Embedded backend not started (${err.message}). Connecting to existing telemetry proxy on port ${CONFIG.ws.port}.`);
    if (proxyServer) {
      try { await proxyServer.stop(); } catch {}
      proxyServer = null;
    }
  }
}

function createMainWindow() {
  const customIconPath = path.join(__dirname, '../../public/apex icon.ico');
  const fallbackIconPath = path.join(__dirname, '../../public/favicon.ico');
  const iconPath = fs.existsSync(customIconPath) ? customIconPath : (fs.existsSync(fallbackIconPath) ? fallbackIconPath : undefined);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0a0a0c',
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, 'preload.cjs'))
        ? path.join(__dirname, 'preload.cjs')
        : path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false // Allows loading local fonts and scripts via file://
    }
  });

  // Forward renderer console errors to terminal for effortless debugging
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[RENDERER CONSOLE ${level === 3 ? 'ERROR' : 'WARN'}] ${message} (${sourceId ? path.basename(sourceId) : 'unknown'}:${line})`);
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
      const docsDir = app.getPath('documents');
      const defaultUserDir = path.join(docsDir, 'APEX v2.9', 'user');
      await fs.promises.mkdir(defaultUserDir, { recursive: true });

      const defaultSavePath = options.defaultPath || (options.suggestedName ? path.join(defaultUserDir, options.suggestedName) : defaultUserDir);

      const result = await dialog.showSaveDialog(mainWindow, {
        title: options.title || 'Save APEX Export',
        defaultPath: defaultSavePath,
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

  // Auto-Archive Stint Reports to Documents/APEX v2.9/user/
  ipcMain.handle('file:auto-archive', async (_event, fileData = {}) => {
    try {
      const docsDir = app.getPath('documents');
      const archiveDir = path.join(docsDir, 'APEX v2.9', 'user');
      await fs.promises.mkdir(archiveDir, { recursive: true });

      const fileName = fileData.fileName || `APEX_Report_${Date.now()}.${fileData.extension || 'pdf'}`;
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
      const archiveDir = path.join(docsDir, 'APEX v2.9', 'user');
      await fs.promises.mkdir(archiveDir, { recursive: true });
      await shell.openPath(archiveDir);
      return { success: true, path: archiveDir };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ==========================================
  // DRIVER PROFILES IPC HANDLERS
  // ==========================================
  const getProfilesDir = async () => {
    const docsDir = app.getPath('documents');
    const profilesDir = path.join(docsDir, 'APEX v2.9', 'user', 'Profiles');
    await fs.promises.mkdir(profilesDir, { recursive: true });
    return profilesDir;
  };

  // Get list of all driver profiles (summary registry)
  ipcMain.handle('profile:get-all', async () => {
    try {
      const profilesDir = await getProfilesDir();
      const registryPath = path.join(profilesDir, 'profiles.json');
      if (fs.existsSync(registryPath)) {
        const raw = await fs.promises.readFile(registryPath, 'utf8');
        return { success: true, profiles: JSON.parse(raw) };
      }
      return { success: true, profiles: [] };
    } catch (err) {
      return { success: false, error: err.message, profiles: [] };
    }
  });

  // Get active profile ID
  ipcMain.handle('profile:get-active-id', async () => {
    try {
      const profilesDir = await getProfilesDir();
      const activePath = path.join(profilesDir, 'active_profile.json');
      if (fs.existsSync(activePath)) {
        const raw = await fs.promises.readFile(activePath, 'utf8');
        const data = JSON.parse(raw);
        return { success: true, activeId: data.activeId || null };
      }
      return { success: true, activeId: null };
    } catch (err) {
      return { success: false, error: err.message, activeId: null };
    }
  });

  // Get detailed profile file
  ipcMain.handle('profile:get-detail', async (_event, profileId) => {
    try {
      if (!profileId) return { success: false, error: 'Profile ID required' };
      const profilesDir = await getProfilesDir();
      const sanitizedId = String(profileId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const profilePath = path.join(profilesDir, `profile_${sanitizedId}.json`);
      if (fs.existsSync(profilePath)) {
        const raw = await fs.promises.readFile(profilePath, 'utf8');
        return { success: true, profile: JSON.parse(raw) };
      }
      return { success: false, error: 'Profile not found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Save / Update profile and update registry
  ipcMain.handle('profile:save', async (_event, profile) => {
    try {
      if (!profile || !profile.id) return { success: false, error: 'Invalid profile payload' };
      const profilesDir = await getProfilesDir();
      const sanitizedId = String(profile.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const profilePath = path.join(profilesDir, `profile_${sanitizedId}.json`);

      // Write full profile file
      await fs.promises.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');

      // Update registry index
      const registryPath = path.join(profilesDir, 'profiles.json');
      let registry = [];
      if (fs.existsSync(registryPath)) {
        try {
          const raw = await fs.promises.readFile(registryPath, 'utf8');
          registry = JSON.parse(raw);
        } catch {
          registry = [];
        }
      }

      const summary = {
        id: profile.id,
        name: profile.name || 'APEX Driver',
        number: profile.number || '01',
        team: profile.team || 'Privateer',
        tier: profile.tier || 'Club',
        color: profile.color || '#e10600',
        avatar: profile.avatar || 'helmet',
        updatedAt: new Date().toISOString()
      };

      const existingIndex = registry.findIndex(p => p.id === profile.id);
      if (existingIndex >= 0) {
        registry[existingIndex] = { ...registry[existingIndex], ...summary };
      } else {
        registry.push(summary);
      }

      await fs.promises.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');
      return { success: true, profile };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Set active driver profile
  ipcMain.handle('profile:set-active', async (_event, profileId) => {
    try {
      const profilesDir = await getProfilesDir();
      const activePath = path.join(profilesDir, 'active_profile.json');
      await fs.promises.writeFile(activePath, JSON.stringify({ activeId: profileId, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
      return { success: true, activeId: profileId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Delete profile
  ipcMain.handle('profile:delete', async (_event, profileId) => {
    try {
      if (!profileId) return { success: false, error: 'Profile ID required' };
      const profilesDir = await getProfilesDir();
      const sanitizedId = String(profileId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const profilePath = path.join(profilesDir, `profile_${sanitizedId}.json`);

      if (fs.existsSync(profilePath)) {
        await fs.promises.unlink(profilePath);
      }

      // Update registry
      const registryPath = path.join(profilesDir, 'profiles.json');
      if (fs.existsSync(registryPath)) {
        try {
          const raw = await fs.promises.readFile(registryPath, 'utf8');
          let registry = JSON.parse(raw);
          registry = registry.filter(p => p.id !== profileId);
          await fs.promises.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');
        } catch {}
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Export profile to external .apexprofile JSON file
  ipcMain.handle('profile:export', async (_event, profile) => {
    if (!mainWindow) return { success: false, error: 'No active window' };
    try {
      const defaultName = `APEX_Driver_${(profile.name || 'Driver').replace(/[^a-zA-Z0-9_-]/g, '_')}_#${profile.number || '01'}.apexprofile`;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export APEX Driver Dossier',
        defaultPath: defaultName,
        filters: [
          { name: 'APEX Driver Profile (*.apexprofile)', extensions: ['apexprofile'] },
          { name: 'JSON Document (*.json)', extensions: ['json'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      await fs.promises.writeFile(result.filePath, JSON.stringify(profile, null, 2), 'utf8');
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Import profile from external file
  ipcMain.handle('profile:import', async () => {
    if (!mainWindow) return { success: false, error: 'No active window' };
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import APEX Driver Dossier',
        filters: [
          { name: 'APEX Driver Profile (*.apexprofile, *.json)', extensions: ['apexprofile', 'json'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (!parsed || !parsed.name) {
        return { success: false, error: 'Invalid driver profile structure' };
      }

      return { success: true, profile: parsed, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Open Profiles folder in Explorer
  ipcMain.handle('profile:open-folder', async () => {
    try {
      const profilesDir = await getProfilesDir();
      await shell.openPath(profilesDir);
      return { success: true, path: profilesDir };
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
  registerUpdaterIpc({ get mainWindow() { return mainWindow; } });
  await startEmbeddedBackend();
  createMainWindow();
  scheduleStartupUpdateCheck(mainWindow, 3500);

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
