const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, Notification, Tray } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CoreClient } = require('./core-client.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const windows = new Map();
let core;
let quitting = false;
let tray;
let runtimeSettings = { closeBehavior: 'tray', launchAtSignIn: false, startMinimized: false, startSurface: 'console', floatingWidgetEnabled: true, alwaysOnTop: true, clickThrough: false };
const severityRank = { informational: 0, normal: 1, important: 2, critical: 3 };
const notificationThreshold = { all: 0, important: 2, critical: 3, off: 99 };

const rendererUrl = (surface) => {
  const query = surface === 'main' ? '' : `?surface=${surface}`;
  return isDev
    ? `${process.env.VITE_DEV_SERVER_URL}/${query}`
    : `${pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).toString()}${query}`;
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
      if (surface === 'main' && runtimeSettings.closeBehavior === 'bubble') createWindow('bubble');
      if (surface === 'main' && runtimeSettings.closeBehavior === 'exit') { quitting = true; app.quit(); }
    }
  });
  window.on('closed', () => windows.delete(surface));
  if (surface === 'bubble') window.webContents.on('context-menu', () => showBubbleMenu(window));
  return window;
}

function openMainPage(page) {
  const main = createWindow('main');
  const send = () => main.webContents.send('navigate', page);
  if (main.webContents.isLoadingMainFrame()) main.webContents.once('did-finish-load', send);
  else send();
  return main;
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
    { label: 'Settings', click: () => openMainPage('settings') },
    { label: 'Exit', click: () => { quitting = true; app.quit(); } },
  ]).popup({ window });
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAIAAADAAbR1AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRP///////wlY99wAAAAHdElNRQfqCQEEAAYgzZq5AAADIklEQVQ4y7WUfSzUcRzH3/f73Z3KIr87QnV37W7hHJWeNkqTytIkPVj0ZKMIS4XUWpu1Vhkr68lDosRwdVFpWR6nh/VgF5NzRCKGdMcxyT3pj7rG+rXWH95/ffb9vPd5fb/fz+f7ZZibCwRubpg2EdNX+qeYf83YYD74klnuS7xrAqoObTou4Dy0FnLlky2DJ1WequySIxmNFwsbcmuDy7joQTtaJnsYf14RmcvMYzlHClICc74L5Y5VTtLOY6oRQCMeMwcM+glXgDxJ2AJzbsyMBng7qK1A287mxQrn9PIERuhNfYjWVhtFd0UWoMC971O66PH70HAvhpPUW2VbDazrns8E2K+JcmALT1gG+LcLrwE+JTwKUGdqDgPzYkRrxE0RdhdeZTmAD0dIaACSPe7Z3p4dBVBz5NJsxW2gPqU/DCiMb+4HHCM4NUDfmVE7QNquNAPuUS1pgJcrTwkoS3vvAaJm8Qxnq8WjnvY+vjSAbfGR1gm9nQa1D2D4bORPbcqiYassoC6jr9i08m2v7jyQRTZkAvrtxldAV4FaBvjLDobE5tAAqAfcEc5VzelvuXRdN/Ng7gb0ocZtgKWlmQHYlew0Fzh1yt3P5BmKGksHqHdcG04Z04UVyB6mGVOD1uhCB+joGLoFSPZxBYBGM04CRUXKEwA7mjhr8uhFhrummNXGXmk2QAMgk0khHeDZpe7TgGTcOsK09/0SiRhQKL7G/J7664TYFOsctPJx+yljmigt6KwIG06dOGd1qH/h8FL8t+YWWMgACwWjYVCe6Bj0Zf2BKScozk2TpUTyAqkAgDxKcP+nNDOfWA7wLlKxgCz7GpEURNPkhhe158t8PyYq85prxDvtRgFmPen3z9I9ZDDgVGfvAXx6+iG8tbLx+vPv5Qt+ZmleMtODFc5mRVgmVWcJRBvFl50LuxLUqcDQlbESwJBvHAfIZcQgYCmaKQL4WqoUaCMVb5oq0tYm7A/tNbjq+LrUvwJ+aQXWY7PLvtW6DU1bPcLXxb3l1Fqv4nZNtqhaB7YP3CmenfYkeez9o5dxlU1Q4A2eT/Ywpvu7/gFCrB0fgiITygAAAABJRU5ErkJggg==');
  tray = new Tray(icon);
  tray.setToolTip('TraceGuard · LIVE');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open TraceGuard', click: () => createWindow('main') },
    { label: 'Live Terminal', click: () => createWindow('terminal') },
    { label: 'Floating Window', click: () => createWindow('widget') },
    { label: 'Floating Bubble', click: () => createWindow('bubble') },
    { type: 'separator' },
    { label: 'Settings', click: () => openMainPage('settings') },
    { label: 'Exit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => createWindow('main'));
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  core = new CoreClient({ app, isDev });
  core.start();
  createTray();
  core.on('traceEvent', (event) => {
    for (const window of windows.values()) if (!window.isDestroyed()) window.webContents.send('trace:event', event);
    if (event.action === 'INSTALLER_COMPLETE' && Notification.isSupported() && (severityRank[event.severity] ?? 0) >= (notificationThreshold[runtimeSettings.notificationLevel] ?? 2)) {
      const isZh = app.getLocale().toLowerCase().startsWith('zh');
      const notification = new Notification({ title: isZh ? event.easyMessageZh : event.easyMessage, body: event.detail, silent: !runtimeSettings.notificationSound });
      notification.on('click', () => openMainPage('applications'));
      notification.show();
    }
  });
  void core.request('getSettings').then((settings) => {
    runtimeSettings = { ...runtimeSettings, ...settings };
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtSignIn), args: settings.startMinimized ? ['--start-minimized'] : [] });
    if (!settings.startMinimized && settings.startSurface === 'console') createWindow('main');
    if (settings.floatingWidgetEnabled && settings.startSurface !== 'bubble') createWindow('widget');
    if (settings.startSurface === 'bubble') createWindow('bubble');
  }).catch(() => { createWindow('main'); createWindow('widget'); });
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    const widget = windows.get('widget');
    if (widget) widget.setIgnoreMouseEvents(false);
  });
});

ipcMain.handle('core:request', async (_event, method, params) => {
  const result = await core.request(method, params);
  if (method === 'updateSettings' && params?.settings) {
    runtimeSettings = { ...runtimeSettings, ...params.settings };
    app.setLoginItemSettings({ openAtLogin: Boolean(runtimeSettings.launchAtSignIn), args: runtimeSettings.startMinimized ? ['--start-minimized'] : [] });
    const widget = windows.get('widget');
    if (runtimeSettings.floatingWidgetEnabled) {
      const activeWidget = widget && !widget.isDestroyed() ? widget : createWindow('widget');
      activeWidget.setAlwaysOnTop(Boolean(runtimeSettings.alwaysOnTop));
      activeWidget.setIgnoreMouseEvents(Boolean(runtimeSettings.clickThrough), { forward: true });
    } else widget?.hide();
  }
  return result;
});
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
