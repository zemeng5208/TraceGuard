const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeTheme, screen } = require('electron');
const path = require('node:path');
const { CoreClient } = require('./core-client.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const windows = new Map();
let core;
let quitting = false;

const rendererUrl = (surface) => {
  const query = surface === 'main' ? '' : `?surface=${surface}`;
  return isDev
    ? `${process.env.VITE_DEV_SERVER_URL}/${query}`
    : `file://${path.join(app.getAppPath(), 'dist', 'index.html')}${query}`;
};

const commonOptions = {
  show: false,
  frame: false,
  transparent: false,
  backgroundColor: '#07131f',
  titleBarStyle: 'hidden',
  roundedCorners: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
};

function createWindow(surface = 'main') {
  if (windows.get(surface) && !windows.get(surface).isDestroyed()) {
    windows.get(surface).show();
    windows.get(surface).focus();
    return windows.get(surface);
  }
  const surfaceOptions = {
    main: { width: 1280, height: 820, minWidth: 980, minHeight: 680, backgroundMaterial: 'mica', resizable: true },
    terminal: { width: 860, height: 540, minWidth: 680, minHeight: 420, backgroundMaterial: 'acrylic', alwaysOnTop: false, resizable: true },
    widget: { width: 278, height: 440, backgroundColor: '#00000000', transparent: true, backgroundMaterial: 'acrylic', alwaysOnTop: true, skipTaskbar: true, resizable: false },
    bubble: { width: 112, height: 112, backgroundColor: '#00000000', transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false },
  };
  const window = new BrowserWindow({ ...commonOptions, ...surfaceOptions[surface] });
  windows.set(surface, window);
  window.loadURL(rendererUrl(surface));
  window.once('ready-to-show', () => window.show());
  window.on('close', (event) => {
    if (!quitting && (surface === 'main' || surface === 'terminal')) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on('closed', () => windows.delete(surface));
  if (surface === 'bubble') window.webContents.on('context-menu', () => showBubbleMenu(window));
  return window;
}

function showBubbleMenu(window) {
  Menu.buildFromTemplate([
    { label: 'Open TraceGuard', click: () => createWindow('main') },
    { label: 'Live Terminal', click: () => createWindow('terminal') },
    { type: 'separator' },
    { label: 'Pause Monitoring', click: () => void core.request('pauseMonitoring') },
    { label: 'Floating Window', click: () => createWindow('widget') },
    { label: 'Collapse to Bubble', enabled: false },
    { label: 'Always on Top', type: 'checkbox', checked: window.isAlwaysOnTop(), click: (item) => window.setAlwaysOnTop(item.checked) },
    { type: 'separator' },
    { label: 'Settings', click: () => createWindow('main').webContents.send('navigate', 'settings') },
    { label: 'Exit', click: () => { quitting = true; app.quit(); } },
  ]).popup({ window });
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  core = new CoreClient({ app, isDev });
  core.start();
  core.on('traceEvent', (event) => {
    for (const window of windows.values()) if (!window.isDestroyed()) window.webContents.send('trace:event', event);
  });
  createWindow('main');
  createWindow('widget');
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    const widget = windows.get('widget');
    if (widget) widget.setIgnoreMouseEvents(false);
  });
});

ipcMain.handle('core:request', (_event, method, params) => core.request(method, params));
ipcMain.handle('surface:show', (_event, surface) => { createWindow(surface); });
ipcMain.handle('surface:hide', (_event, surface) => { windows.get(surface)?.hide(); });
ipcMain.handle('window:action', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (action === 'minimize') window.minimize();
  else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  else if (action === 'close') window.close();
});

app.on('activate', () => createWindow('main'));
app.on('before-quit', () => { quitting = true; core?.stop(); globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
