const { contextBridge, ipcRenderer } = require('electron');

// Expose secure desktop APIs to window.apexDesktop
contextBridge.exposeInMainWorld('apexDesktop', {
  isDesktop: true,
  platform: process.platform,

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (callback) => {
    const handler = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window:maximized-change', handler);
    return () => ipcRenderer.removeListener('window:maximized-change', handler);
  },

  // Native Save File Dialog
  saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),

  // Auto-Archive to Documents/APEX Telemetry/Reports/
  autoArchive: (data) => ipcRenderer.invoke('file:auto-archive', data),
  openReportsFolder: () => ipcRenderer.invoke('system:open-reports-folder'),

  // Driver Profiles
  profiles: {
    getAll: () => ipcRenderer.invoke('profile:get-all'),
    getActiveId: () => ipcRenderer.invoke('profile:get-active-id'),
    getDetail: (id) => ipcRenderer.invoke('profile:get-detail', id),
    save: (profile) => ipcRenderer.invoke('profile:save', profile),
    setActive: (id) => ipcRenderer.invoke('profile:set-active', id),
    delete: (id) => ipcRenderer.invoke('profile:delete', id),
    export: (profile) => ipcRenderer.invoke('profile:export', profile),
    import: () => ipcRenderer.invoke('profile:import'),
    openFolder: () => ipcRenderer.invoke('profile:open-folder')
  },

  // Forza UWP Loopback & Network Info
  getLanIp: () => ipcRenderer.invoke('system:get-lan-ip'),
  checkLoopback: () => ipcRenderer.invoke('system:check-loopback'),
  enableLoopback: (packageIds) => ipcRenderer.invoke('system:enable-loopback', packageIds)
});
