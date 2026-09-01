const { contextBridge, ipcRenderer } = require('electron');

const request = (method, params) => ipcRenderer.invoke('core:request', method, params);

contextBridge.exposeInMainWorld('traceGuard', {
  isPreview: false,
  getOverview: () => request('getOverview'),
  getEvents: (limit = 100) => request('getEvents', { limit }),
  getProcesses: () => request('getProcesses'),
  getServices: () => request('getServices'),
  getStartupItems: () => request('getStartupItems'),
  getSessions: (limit = 100) => request('getSessions', { limit }),
  getRules: () => request('getRules'),
  saveRule: (rule) => request('saveRule', { rule }),
  deleteRule: (id) => request('deleteRule', { id }),
  disableStartup: (name, source) => request('disableStartup', { name, source }),
  getSettings: () => request('getSettings'),
  updateSettings: (settings) => request('updateSettings', { settings }),
  pauseMonitoring: () => request('pauseMonitoring'),
  resumeMonitoring: () => request('resumeMonitoring'),
  clearEvents: () => request('clearEvents'),
  stopProcess: (pid) => request('stopProcess', { pid }),
  stopService: (name) => request('stopService', { name }),
  showSurface: (surface) => ipcRenderer.invoke('surface:show', surface),
  hideSurface: (surface) => ipcRenderer.invoke('surface:hide', surface),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  onNavigate: (callback) => {
    const listener = (_event, page) => callback(page);
    ipcRenderer.on('navigate', listener);
    return () => ipcRenderer.removeListener('navigate', listener);
  },
  onTraceEvent: (callback) => {
    const listener = (_event, traceEvent) => callback(traceEvent);
    ipcRenderer.on('trace:event', listener);
    return () => ipcRenderer.removeListener('trace:event', listener);
  },
});
