import type { AppSettings, ConfigurationItem, InstallationSession, Overview, ProcessRow, RestoreItem, ServiceRow, StartupRow, TraceEvent, TraceRule } from '@/types';

export const defaultSettings: AppSettings = {
  schemaVersion: 1,
  locale: 'auto',
  theme: 'dark',
  visualStyle: 'acrylic',
  accentColor: '#4c97ff',
  useSystemAccent: true,
  transparency: 20,
  density: 'comfortable',
  fontSize: 'default',
  animation: 'full',
  sidebar: 'expanded',
  startMinimized: false,
  startSurface: 'console',
  closeBehavior: 'tray',
  rememberWindowPosition: true,
  rememberWindowSize: true,
  restoreLastPage: true,
  fileMonitoring: true,
  processMonitoring: true,
  serviceMonitoring: true,
  startupMonitoring: true,
  registryMonitoring: true,
  browserMonitoring: false,
  updateMonitoring: true,
  networkMonitoring: false,
  fullDiskMonitoring: false,
  floatingWidgetEnabled: true,
  alwaysOnTop: true,
  clickThrough: false,
  widgetOpacity: 92,
  widgetSize: 'standard',
  widgetRefreshMs: 1000,
  autoCollapse: false,
  edgeSnap: true,
  rememberWidgetPosition: true,
  bubbleSize: 'medium',
  bubbleLabel: 'tg',
  showBadgeCount: true,
  showUpdateStatus: true,
  showRecordingStatus: true,
  hoverPreview: true,
  hoverDelayMs: 500,
  bubbleSingleClickAction: 'panel',
  bubbleDoubleClickAction: 'console',
  terminalMode: 'easy',
  terminalAutoScroll: true,
  terminalPauseOnHover: false,
  terminalTimestampMilliseconds: false,
  terminalMaxRows: 1000,
  terminalFontSize: 'default',
  terminalShowCategory: true,
  terminalShowProcess: true,
  terminalShowPid: false,
  terminalShowFullPath: true,
  terminalHiddenCategories: [],
  notificationLevel: 'important',
  notificationSound: true,
  notifySystemChange: true,
  notifyStartup: true,
  notifyService: true,
  notifyBrowser: true,
  notifyBlockedRestart: true,
  notifyInstallerComplete: true,
  notifyWindowsUpdate: false,
  notifyUserFiles: true,
  launchAtSignIn: false,
  keepMonitoringOnClose: true,
  lowPowerMode: false,
  storeFilePaths: true,
  retentionDays: 30,
  warnBeforeStopping: true,
  warnBeforeDisablingStartup: true,
  confirmRestore: true,
  confirmRuleCreation: true,
  cornerRadius: 'rounded',
  pauseOnBattery: false,
};

export const previewOverview: Overview = {
  fileChanges: 1246,
  registryChanges: 342,
  fileChangesPerMinute: 38,
  registryChangesPerMinute: 7,
  processCount: 128,
  serviceCount: 214,
  diskBytesPerSecond: 3.2 * 1024 * 1024,
  networkBytesPerSecond: 1.8 * 1024 * 1024,
  cpuPercent: 23,
  memoryPercent: 45,
  monitoring: true,
  monitoringMode: 'active',
  onBattery: false,
  monitorModules: [
    { id: 'file', state: 'active', message: 'Watching 5 accessible locations.', messageZh: '正在监控 5 个可访问位置。' },
    { id: 'process', state: 'active', message: 'Polling process starts and exits.', messageZh: '正在观察进程启动与退出。' },
    { id: 'registry', state: 'active', message: 'Current-user configuration diff every 4s.', messageZh: '每 4 秒比较当前用户配置。' },
    { id: 'service', state: 'active', message: 'Read-only service comparison every 4s.', messageZh: '每 4 秒只读比较服务状态。' },
    { id: 'startup', state: 'active', message: 'User startup comparison every 4s.', messageZh: '每 4 秒比较用户启动项。' },
    { id: 'browser', state: 'disabled', message: 'Disabled in Settings.', messageZh: '已在设置中关闭。' },
    { id: 'network', state: 'disabled', message: 'Disabled in Settings.', messageZh: '已在设置中关闭。' },
    { id: 'update', state: 'active', message: 'Windows Update observation is active.', messageZh: 'Windows Update 活动观察正在运行。' },
    { id: 'usn', state: 'available', message: 'Readable with the current user token on C:. FileSystemWatcher remains active until journal event attribution is enabled.', messageZh: '当前用户令牌可读取 C:。在 USN 事件归属功能启用前仍继续使用 FileSystemWatcher。' },
    { id: 'etw', state: 'unavailable', message: 'The current token cannot control general ETW sessions. TraceGuard will not request elevation or change group membership.', messageZh: '当前令牌无法控制常规 ETW 会话。TraceGuard 不会请求提权或修改用户组成员身份。' },
  ],
  activeInstaller: { name: 'ABC_Setup.exe', pid: 4528, elapsedSeconds: 204, changeCount: 428 },
};

const now = Date.now();
const event = (
  id: number,
  offsetSeconds: number,
  category: TraceEvent['category'],
  action: string,
  easyMessageZh: string,
  easyMessage: string,
  detail: string,
  processName?: string,
  severity: TraceEvent['severity'] = 'normal',
): TraceEvent => ({
  id,
  timestamp: new Date(now - offsetSeconds * 1000).toISOString(),
  category,
  action,
  easyMessage,
  easyMessageZh,
  detail,
  processName,
  severity,
});

export const previewEvents: TraceEvent[] = [
  event(9, 2, 'file', 'CREATE', '创建了程序文件', 'A program file was created', 'C:\\ProgramData\\ABC\\Updater.exe', 'ABC_Setup.exe'),
  event(8, 3, 'registry', 'MODIFY', '新增登录自启动项', 'A sign-in startup item was added', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'UpdateHelper.exe', 'important'),
  event(7, 5, 'service', 'CREATED', '检测到新服务', 'A new service was detected', 'ABC Update Service', 'ABC_Setup.exe', 'important'),
  event(6, 7, 'process', 'START', '后台更新程序已启动', 'Background updater started', 'UpdateHelper.exe (PID: 4528)', 'UpdateHelper.exe'),
  event(5, 9, 'file', 'MODIFY', '修改了用户配置文件', 'A user configuration file was modified', 'C:\\Users\\John\\AppData\\Roaming\\ABC\\config.json', 'Updater.exe'),
  event(4, 11, 'browser', 'MODIFY', 'Chrome 浏览器主页发生变化', 'Chrome homepage was changed', 'Google → ABC Search', 'chrome.exe', 'critical'),
  event(3, 13, 'startup', 'ADD', '程序被添加到登录启动', 'Program was added to sign-in startup', 'UpdateHelper.exe', 'ABC_Setup.exe', 'important'),
  event(2, 15, 'network', 'CONNECT', '程序建立了网络连接', 'A program opened a network connection', 'update.abc.com:443', 'UpdateHelper.exe'),
  event(1, 17, 'file', 'CREATE', '创建了配置文件', 'A configuration file was created', 'C:\\Users\\John\\AppData\\Local\\ABC\\config.json', 'ABC_Setup.exe'),
];

export const previewProcesses: ProcessRow[] = [
  { pid: 4528, parentPid: 4100, name: 'UpdateHelper.exe', executable: 'C:\\ProgramData\\ABC\\UpdateHelper.exe', cpuPercent: 3.2, memoryBytes: 82_231_296, ioBytesPerSecond: 2_450_000, publisher: 'ABC Software', permission: 'controllable' },
  { pid: 1140, parentPid: 832, name: 'explorer.exe', executable: 'C:\\Windows\\explorer.exe', cpuPercent: 1.1, memoryBytes: 196_083_712, ioBytesPerSecond: 155_000, publisher: 'Microsoft Corporation', permission: 'controllable' },
  { pid: 744, parentPid: 632, name: 'services.exe', executable: 'C:\\Windows\\System32\\services.exe', cpuPercent: 0.2, memoryBytes: 12_582_912, ioBytesPerSecond: 0, publisher: 'Microsoft Corporation', permission: 'protected' },
  { pid: 820, parentPid: 744, name: 'svchost.exe', executable: 'C:\\Windows\\System32\\svchost.exe', cpuPercent: 0.8, memoryBytes: 38_797_312, ioBytesPerSecond: 340_000, publisher: 'Microsoft Corporation', permission: 'observable' },
];

export const previewServices: ServiceRow[] = [
  { name: 'ABCUpdate', displayName: 'ABC Update Service', status: 'Running', startType: 'Automatic', executable: 'C:\\ProgramData\\ABC\\ABCUpdate.exe', publisher: 'ABC Software', category: 'third-party', permission: 'observable' },
  { name: 'wuauserv', displayName: 'Windows Update', status: 'Running', startType: 'Manual', executable: 'C:\\Windows\\system32\\svchost.exe', publisher: 'Microsoft Corporation', category: 'windows-core', permission: 'protected' },
  { name: 'Spooler', displayName: 'Print Spooler', status: 'Running', startType: 'Automatic', executable: 'C:\\Windows\\System32\\spoolsv.exe', publisher: 'Microsoft Corporation', category: 'windows-optional', permission: 'observable' },
];

export const previewStartup: StartupRow[] = [
  { name: 'UpdateHelper', command: 'C:\\ProgramData\\ABC\\UpdateHelper.exe --background', source: 'run', enabled: true, permission: 'controllable' },
  { name: 'OneDrive', command: 'C:\\Users\\John\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe /background', source: 'run', enabled: true, permission: 'controllable' },
  { name: 'SecurityHealth', command: '%windir%\\system32\\SecurityHealthSystray.exe', source: 'run', enabled: true, permission: 'protected' },
];

export const previewRestoreItems: RestoreItem[] = [
  { id: 'restore-1', name: 'LegacyUpdater', source: 'run', originalCommand: 'C:\\Users\\John\\AppData\\Local\\Legacy\\Updater.exe', disabledAt: new Date(now - 86_400_000).toISOString(), permission: 'controllable' },
];

export const previewBrowserItems: ConfigurationItem[] = [
  { id: 'chrome.homepage', category: 'homepage', name: 'Google Chrome homepage', value: 'https://www.google.com', source: 'Chrome Preferences', permission: 'observable', description: 'Browser homepage configuration.', descriptionZh: '浏览器主页配置。', severity: 'important' },
  { id: 'chrome.extension.demo', category: 'extension', name: 'Google Docs Offline', value: '1.75.0', source: 'Chrome Extensions', permission: 'observable', description: 'Installed browser extension metadata.', descriptionZh: '已安装浏览器扩展的元数据。', severity: 'important' },
];
export const previewNetworkItems: ConfigurationItem[] = [
  { id: 'proxy.enabled', category: 'proxy', name: 'Proxy enabled', value: '0', source: 'HKCU Internet Settings', permission: 'observable', description: 'Current-user proxy state.', descriptionZh: '当前用户代理状态。', severity: 'important' },
  { id: 'dns.preview', category: 'dns', name: 'Ethernet', value: '1.1.1.1, 8.8.8.8', source: 'Ethernet', permission: 'observable', description: 'DNS servers for this adapter.', descriptionZh: '该网络适配器的 DNS 服务器。', severity: 'normal' },
  { id: 'hosts.metadata', category: 'hosts', name: 'Hosts file', value: '824 bytes · 2026-09-01T06:00:00Z', source: 'C:\\Windows\\System32\\drivers\\etc\\hosts', permission: 'observable', description: 'Metadata only; contents are never read.', descriptionZh: '仅记录元数据，不读取文件正文。', severity: 'important' },
];
export const previewUpdateItems: ConfigurationItem[] = [
  { id: 'update.service.wuauserv', category: 'service', name: 'Windows Update', value: 'Running', source: 'wuauserv', permission: 'protected', description: 'Observed but never force-stopped.', descriptionZh: '仅供观察，TraceGuard 不会强制停止。', severity: 'normal' },
  { id: 'update.process.TiWorker', category: 'process', name: 'TiWorker.exe', value: 'Running · 1', source: 'Windows Update', permission: 'protected', description: 'An update worker is active.', descriptionZh: 'Windows 更新工作进程正在运行。', severity: 'important' },
];
export const previewAssociationItems: ConfigurationItem[] = [
  { id: 'association.pdf', category: 'pdf', name: '.pdf', value: 'AcroExch.Document.DC', source: 'HKCU\\…\\UserChoice', permission: 'observable', description: 'Current-user default application association.', descriptionZh: '当前用户默认应用关联。', severity: 'important' },
  { id: 'association.https', category: 'https', name: 'HTTPS', value: 'ChromeHTML', source: 'HKCU\\…\\UserChoice', permission: 'observable', description: 'Current-user default application association.', descriptionZh: '当前用户默认应用关联。', severity: 'important' },
];

export const previewSessions: InstallationSession[] = [{
  id: 'preview-session', rootProcess: 'ABC_Setup.exe', rootPid: 4528, startedAt: new Date(now - 204_000).toISOString(), status: 'recording', changeCount: 428, importantCount: 3,
  summary: { filesCreated: 327, filesModified: 41, filesDeleted: 6, registryCreated: 52, registryModified: 14, registryDeleted: 0, startupChanges: 1, browserChanges: 2, networkChanges: 1, userFilesModified: 3 },
  registryChanges: [
    { hive: 'HKCU', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'UpdateHelper', changeType: 'created', newValue: 'C:\\ProgramData\\ABC\\UpdateHelper.exe', severity: 'important' },
    { hive: 'HKCU', path: 'Software\\Policies\\Google\\Chrome', valueName: 'HomepageLocation', changeType: 'modified', oldValue: 'https://google.com', newValue: 'https://search.abc.com', severity: 'important' },
  ],
  processes: [
    { pid: 4528, parentPid: 1140, name: 'ABC_Setup.exe', executable: 'C:\\Users\\John\\Downloads\\ABC_Setup.exe', startedAt: new Date(now - 204_000).toISOString(), launchSource: 'user' },
    { pid: 4580, parentPid: 4528, name: 'installer.exe', executable: 'C:\\Users\\John\\AppData\\Local\\Temp\\ABC\\installer.exe', startedAt: new Date(now - 198_000).toISOString(), launchSource: 'parent-process' },
    { pid: 4624, parentPid: 4580, name: 'UpdateHelper.exe', executable: 'C:\\ProgramData\\ABC\\UpdateHelper.exe', startedAt: new Date(now - 190_000).toISOString(), launchSource: 'updater' },
  ],
}];

export const previewRules: TraceRule[] = [
  { id: 'rule-1', processPattern: 'UpdateHelper.exe', autoStartAction: 'block', manualStartAction: 'allow', notify: true, blockAutoRestart: true, updatedAt: new Date(now).toISOString() },
];
