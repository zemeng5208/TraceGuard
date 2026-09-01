const { contextBridge, ipcRenderer } = require('electron');

const request = (method, params) => ipcRenderer.invoke('core:request', method, params);

contextBridge.exposeInMainWorld('traceGuard', {
  isPreview: false,
  getOverview: () => request('getOverview'),
  getEvents: (limit = 100) => request('getEvents', { limit }),
  getProcesses: () => request('getProcesses'),
  getServices: () => request('getServices'),
  getStartupItems: () => request('getStartupItems'),
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
  onTraceEvent: (callback) => {
    const listener = (_event, traceEvent) => callback(traceEvent);
    ipcRenderer.on('trace:event', listener);
    return () => ipcRenderer.removeListener('trace:event', listener);
  },
});
