const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, Notification, screen, systemPreferences, Tray } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CoreClient } = require('./core-client.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const windows = new Map();
let core;
let quitting = false;
let tray;
let windowState = {};
const stateTimers = new Map();
const collapseTimers = new Map();
let runtimeSettings = { closeBehavior: 'tray', launchAtSignIn: false, startMinimized: false, startSurface: 'console', floatingWidgetEnabled: true, alwaysOnTop: true, clickThrough: false };
const severityRank = { informational: 0, normal: 1, important: 2, critical: 3 };
const notificationThreshold = { all: 0, important: 2, critical: 3, off: 99 };
const eventPages = { startup: 'startup', service: 'services', browser: 'browser', network: 'network', update: 'update', file: 'files', registry: 'registry', process: 'processes' };

function notificationEnabled(event) {
  if ((severityRank[event.severity] ?? 0) < (notificationThreshold[runtimeSettings.notificationLevel] ?? 2)) return false;
  if (event.action === 'INSTALLER_COMPLETE') return runtimeSettings.notifyInstallerComplete !== false;
  if (event.action === 'AUTO_RESTART_BLOCKED') return runtimeSettings.notifyBlockedRestart !== false;
  if (event.category === 'startup') return runtimeSettings.notifyStartup !== false;
  if (event.category === 'service') return runtimeSettings.notifyService !== false;
  if (event.category === 'browser') return runtimeSettings.notifyBrowser !== false;
  if (event.category === 'update') return runtimeSettings.notifyWindowsUpdate === true;
  if (event.category === 'file' && event.severity === 'important') return runtimeSettings.notifyUserFiles !== false;
  return runtimeSettings.notifySystemChange !== false && (event.severity === 'important' || event.severity === 'critical');
}

function statePath() { return path.join(app.getPath('userData'), 'window-state.json'); }
function loadWindowState() { try { windowState = JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { windowState = {}; } }
function saveWindowState() {
  try { const target = statePath(); const temporary = `${target}.tmp`; fs.writeFileSync(temporary, JSON.stringify(windowState)); fs.renameSync(temporary, target); } catch { }
}
function rememberedBounds(surface, fallback) {
  const saved = windowState[surface];
  const floating = surface === 'widget' || surface === 'bubble';
  if (!saved || (floating && !runtimeSettings.rememberWidgetPosition) || (!floating && !runtimeSettings.rememberWindowPosition && !runtimeSettings.rememberWindowSize)) return fallback;
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return saved.x < area.x + area.width && saved.x + saved.width > area.x && saved.y < area.y + area.height && saved.y + saved.height > area.y;
  });
  if (!visible) return fallback;
  return {
    ...fallback,
    ...(runtimeSettings.rememberWindowPosition || (floating && runtimeSettings.rememberWidgetPosition) ? { x: saved.x, y: saved.y } : {}),
    ...(runtimeSettings.rememberWindowSize && !floating ? { width: saved.width, height: saved.height } : {}),
  };
}

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
    preview: { width: 230, height: 168, backgroundColor: '#00000000', transparent: true, alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false },
  };
  const window = new BrowserWindow({ ...commonOptions, ...rememberedBounds(surface, surfaceOptions[surface]) });
  windows.set(surface, window);
  window.loadURL(rendererUrl(surface));
  if (surface === 'preview') window.setIgnoreMouseEvents(true);
  window.once('ready-to-show', () => window.show());
  const remember = () => {
    if (surface === 'preview') return;
    clearTimeout(stateTimers.get(surface));
    stateTimers.set(surface, setTimeout(() => { windowState[surface] = window.getBounds(); saveWindowState(); }, 250));
  };
  window.on('move', remember);
  window.on('resize', remember);
  if (surface === 'widget' || surface === 'bubble') {
    let snapping = false;
    window.on('moved', () => {
      if (!runtimeSettings.edgeSnap || snapping) return;
      const bounds = window.getBounds();
      const area = screen.getDisplayMatching(bounds).workArea;
      const distances = [{ x: area.x, d: Math.abs(bounds.x-area.x) }, { x: area.x+area.width-bounds.width, d: Math.abs(bounds.x-(area.x+area.width-bounds.width)) }];
      const closest = distances.sort((a,b)=>a.d-b.d)[0];
      if (closest.d <= 28) { snapping = true; window.setPosition(closest.x, Math.max(area.y, Math.min(bounds.y, area.y+area.height-bounds.height))); snapping = false; }
    });
    if (surface === 'widget') {
    const resetCollapse = () => {
      clearTimeout(collapseTimers.get(surface));
      if (runtimeSettings.autoCollapse) collapseTimers.set(surface, setTimeout(() => { window.hide(); createWindow('bubble'); }, 15_000));
    };
    window.on('focus', resetCollapse); window.on('blur', resetCollapse); window.webContents.on('before-input-event', resetCollapse); resetCollapse();
    }
  }
  if (surface === 'preview') {
    const bubble = windows.get('bubble');
    if (bubble && !bubble.isDestroyed()) { const bounds = bubble.getBounds(); window.setPosition(Math.max(0, bounds.x - 236), bounds.y - 20); }
  }
  window.on('close', (event) => {
    if (!quitting && (surface === 'main' || surface === 'terminal')) {
      event.preventDefault();
      window.hide();
      if (surface === 'main' && runtimeSettings.closeBehavior === 'bubble') createWindow('bubble');
      if (surface === 'main' && runtimeSettings.closeBehavior === 'exit') { quitting = true; app.quit(); }
      else if (surface === 'main' && !runtimeSettings.keepMonitoringOnClose) void core.request('pauseMonitoring');
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

function applyWindowSettings() {
  nativeTheme.themeSource = runtimeSettings.theme === 'light' || runtimeSettings.theme === 'dark' ? runtimeSettings.theme : 'system';
  const material = runtimeSettings.visualStyle === 'solid' ? 'none' : runtimeSettings.visualStyle === 'mica' ? 'mica' : 'acrylic';
  for (const [surface, window] of windows) {
    if (window.isDestroyed()) continue;
    if (surface !== 'bubble' && surface !== 'preview') { try { window.setBackgroundMaterial(material); } catch { } }
    if (surface === 'widget') {
      window.setAlwaysOnTop(Boolean(runtimeSettings.alwaysOnTop));
      window.setIgnoreMouseEvents(Boolean(runtimeSettings.clickThrough), { forward: true });
      const sizes = { compact: [252, 398], standard: [278, 440], large: [306, 480] };
      const [width, height] = sizes[runtimeSettings.widgetSize] ?? sizes.standard;
      window.setSize(width, height);
    }
    if (surface === 'bubble') {
      const size = { small: 92, medium: 112, large: 132 }[runtimeSettings.bubbleSize] ?? 112;
      window.setSize(size, size);
    }
  }
}

app.whenReady().then(() => {
  loadWindowState();
  nativeTheme.themeSource = 'dark';
  core = new CoreClient({ app, isDev });
  core.start();
  createTray();
  core.on('traceEvent', (event) => {
    for (const window of windows.values()) if (!window.isDestroyed()) window.webContents.send('trace:event', event);
    if (Notification.isSupported() && notificationEnabled(event)) {
      const isZh = app.getLocale().toLowerCase().startsWith('zh');
      const notification = new Notification({ title: isZh ? event.easyMessageZh : event.easyMessage, body: event.detail, silent: !runtimeSettings.notificationSound });
      notification.on('click', () => openMainPage(event.action === 'INSTALLER_COMPLETE' ? 'applications' : (eventPages[event.category] ?? 'dashboard')));
      notification.show();
    }
  });
  void core.request('getSettings').then((settings) => {
    runtimeSettings = { ...runtimeSettings, ...settings };
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtSignIn), args: settings.startMinimized ? ['--start-minimized'] : [] });
    if (!settings.startMinimized && settings.startSurface === 'console') createWindow('main');
    else if (settings.floatingWidgetEnabled && settings.startSurface === 'widget') createWindow('widget');
    else if (settings.startSurface === 'bubble') createWindow('bubble');
    applyWindowSettings();
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
    applyWindowSettings();
  }
  return result;
});
ipcMain.handle('surface:show', (_event, surface) => { createWindow(surface); });
ipcMain.handle('surface:hide', (_event, surface) => { windows.get(surface)?.hide(); });
ipcMain.handle('system:accent', () => `#${systemPreferences.getAccentColor().slice(0, 6)}`);
ipcMain.handle('settings:export', async () => {
  try {
    const settings = await core.request('getSettings');
    const result = await dialog.showSaveDialog({ title: 'Export TraceGuard Settings', defaultPath: 'TraceGuard-settings.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { success: false, message: 'Export cancelled.', messageZh: '已取消导出。' };
    fs.writeFileSync(result.filePath, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true, message: 'Settings exported.', messageZh: '设置已导出。' };
  } catch (error) { return { success: false, message: String(error), messageZh: '导出设置失败。' }; }
});
ipcMain.handle('settings:import', async () => {
  try {
    const result = await dialog.showOpenDialog({ title: 'Import TraceGuard Settings', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { success: false, message: 'Import cancelled.', messageZh: '已取消导入。' };
    const parsed = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid settings file.');
    const current = await core.request('getSettings');
    const settings = await core.request('updateSettings', { settings: { ...current, ...parsed } });
    runtimeSettings = { ...runtimeSettings, ...settings };
    return { success: true, message: 'Settings imported.', messageZh: '设置已导入。', settings };
  } catch (error) { return { success: false, message: String(error), messageZh: '导入设置失败，已保留原设置。' }; }
});
ipcMain.handle('report:export', async (_event, session) => {
  try {
    if (!session || typeof session !== 'object' || typeof session.id !== 'string' || typeof session.rootProcess !== 'string') throw new Error('Invalid report payload.');
    const safeName = session.rootProcess.replace(/[^a-z0-9._-]/gi, '_');
    const result = await dialog.showSaveDialog({ title: 'Export TraceGuard Report', defaultPath: `${safeName}-${session.id.slice(0, 8)}.traceguard.json`, filters: [{ name: 'TraceGuard Report', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { success: false, message: 'Export cancelled.', messageZh: '已取消导出。' };
    fs.writeFileSync(result.filePath, JSON.stringify({ format: 'traceguard-report', version: 1, exportedAt: new Date().toISOString(), session }, null, 2), 'utf8');
    return { success: true, message: 'Report exported.', messageZh: '报告已导出。' };
  } catch (error) { return { success: false, message: String(error), messageZh: '导出报告失败。' }; }
});
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
