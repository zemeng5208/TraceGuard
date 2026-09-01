export type Locale = 'auto' | 'en-US' | 'zh-CN';
export type ThemeMode = 'system' | 'light' | 'dark';
export type EventCategory =
  | 'file'
  | 'registry'
  | 'process'
  | 'service'
  | 'startup'
  | 'browser'
  | 'network'
  | 'windows'
  | 'update';

export interface TraceEvent {
  id: number;
  timestamp: string;
  category: EventCategory;
  action: string;
  easyMessage: string;
  easyMessageZh: string;
  detail: string;
  processName?: string;
  pid?: number;
  severity: 'informational' | 'normal' | 'important' | 'critical';
}

export interface Overview {
  fileChanges: number;
  registryChanges: number;
  fileChangesPerMinute: number;
  registryChangesPerMinute: number;
  processCount: number;
  serviceCount: number;
  diskBytesPerSecond: number;
  networkBytesPerSecond: number;
  cpuPercent: number;
  memoryPercent: number;
  monitoring: boolean;
  monitoringMode: 'active' | 'reduced' | 'paused';
  onBattery: boolean;
  monitorModules: MonitorModuleStatus[];
  activeInstaller?: {
    name: string;
    pid: number;
    elapsedSeconds: number;
    changeCount: number;
  };
}

export interface MonitorModuleStatus {
  id: 'file' | 'process' | 'registry' | 'service' | 'startup' | 'browser' | 'network' | 'update' | 'usn';
  state: 'active' | 'available' | 'reduced' | 'paused' | 'disabled' | 'unavailable';
  message: string;
  messageZh: string;
}

export interface ProcessRow {
  pid: number;
  parentPid?: number;
  name: string;
  executable?: string;
  cpuPercent: number;
  memoryBytes: number;
  ioBytesPerSecond: number;
  publisher?: string;
  permission: 'controllable' | 'observable' | 'protected';
}

export interface ServiceRow {
  name: string;
  displayName: string;
  status: string;
  startType: string;
  executable?: string;
  publisher?: string;
  category: 'windows-core' | 'windows-optional' | 'driver' | 'third-party' | 'unknown';
  permission: 'controllable' | 'observable' | 'protected';
}

export interface StartupRow {
  name: string;
  command: string;
  source: 'run' | 'run-once' | 'startup-folder' | 'scheduled-task';
  enabled: boolean;
  permission: 'controllable' | 'observable' | 'protected';
}
export interface RestoreItem {
  id: string; name: string; source: StartupRow['source']; originalCommand: string; disabledAt: string; permission: 'controllable' | 'observable' | 'protected';
}
export interface ConfigurationItem {
  id: string; category: string; name: string; value: string; source: string;
  permission: 'controllable' | 'observable' | 'protected'; description: string; descriptionZh: string;
  severity: 'informational' | 'normal' | 'important' | 'critical';
}
export interface StorageInfo { databasePath: string; databaseBytes: number; eventCount: number; reportCount: number; ruleCount: number; }

export interface RegistryChange {
  hive: string; path: string; valueName: string; changeType: 'created' | 'modified' | 'deleted'; oldValue?: string; newValue?: string; severity: 'normal' | 'important';
}
export interface SessionProcess {
  pid: number; parentPid?: number; name: string; executable?: string; startedAt: string; endedAt?: string; launchSource: 'user' | 'parent-process' | 'startup' | 'scheduled-task' | 'service' | 'updater' | 'launcher' | 'browser' | 'unknown';
}
export interface ChangeSummary {
  filesCreated: number; filesModified: number; filesDeleted: number; registryCreated: number; registryModified: number; registryDeleted: number; startupChanges: number; browserChanges: number; networkChanges: number; userFilesModified: number;
}
export interface InstallationSession {
  id: string; rootProcess: string; rootPid: number; startedAt: string; endedAt?: string; status: 'recording' | 'completed'; changeCount: number; importantCount: number; summary: ChangeSummary; registryChanges: RegistryChange[]; processes?: SessionProcess[];
}
export interface TraceRule {
  id: string; processPattern: string; autoStartAction: 'allow' | 'block' | 'ask'; manualStartAction: 'allow' | 'block' | 'ask'; notify: boolean; blockAutoRestart: boolean; updatedAt: string;
}

export interface AppSettings {
  schemaVersion: number;
  locale: Locale;
  theme: ThemeMode;
  visualStyle: 'mica' | 'acrylic' | 'solid';
  accentColor: string;
  useSystemAccent: boolean;
  transparency: number;
  density: 'comfortable' | 'compact';
  fontSize: 'small' | 'default' | 'large';
  animation: 'full' | 'reduced' | 'off';
  sidebar: 'expanded' | 'compact' | 'auto';
  startMinimized: boolean;
  startSurface: 'console' | 'widget' | 'bubble' | 'tray';
  closeBehavior: 'tray' | 'bubble' | 'exit';
  rememberWindowPosition: boolean;
  rememberWindowSize: boolean;
  restoreLastPage: boolean;
  fileMonitoring: boolean;
  processMonitoring: boolean;
  serviceMonitoring: boolean;
  startupMonitoring: boolean;
  registryMonitoring: boolean;
  browserMonitoring: boolean;
  updateMonitoring: boolean;
  networkMonitoring: boolean;
  fullDiskMonitoring: boolean;
  floatingWidgetEnabled: boolean;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  widgetOpacity: number;
  widgetSize: 'compact' | 'standard' | 'large';
  widgetRefreshMs: 500 | 1000 | 2000;
  autoCollapse: boolean;
  edgeSnap: boolean;
  rememberWidgetPosition: boolean;
  bubbleSize: 'small' | 'medium' | 'large';
  bubbleLabel: 'tg' | 'icon';
  showBadgeCount: boolean;
  showUpdateStatus: boolean;
  showRecordingStatus: boolean;
  hoverPreview: boolean;
  hoverDelayMs: 0 | 300 | 500 | 800;
  bubbleSingleClickAction: 'panel' | 'terminal' | 'console';
  bubbleDoubleClickAction: 'console' | 'terminal';
  terminalMode: 'easy' | 'raw';
  terminalAutoScroll: boolean;
  terminalPauseOnHover: boolean;
  terminalTimestampMilliseconds: boolean;
  terminalMaxRows: number;
  terminalFontSize: 'small' | 'default' | 'large';
  terminalShowCategory: boolean;
  terminalShowProcess: boolean;
  terminalShowPid: boolean;
  terminalShowFullPath: boolean;
  terminalHiddenCategories: EventCategory[];
  notificationLevel: 'all' | 'important' | 'critical' | 'off';
  notificationSound: boolean;
  notifySystemChange: boolean;
  notifyStartup: boolean;
  notifyService: boolean;
  notifyBrowser: boolean;
  notifyBlockedRestart: boolean;
  notifyInstallerComplete: boolean;
  notifyWindowsUpdate: boolean;
  notifyUserFiles: boolean;
  launchAtSignIn: boolean;
  keepMonitoringOnClose: boolean;
  lowPowerMode: boolean;
  storeFilePaths: boolean;
  retentionDays: number;
  warnBeforeStopping: boolean;
  warnBeforeDisablingStartup: boolean;
  confirmRestore: boolean;
  confirmRuleCreation: boolean;
  cornerRadius: 'standard' | 'rounded' | 'more-rounded';
  pauseOnBattery: boolean;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  messageZh?: string;
  requiresElevation?: boolean;
}

export interface TraceGuardApi {
  readonly isPreview: boolean;
  getOverview(): Promise<Overview>;
  getEvents(limit?: number): Promise<TraceEvent[]>;
  getProcesses(): Promise<ProcessRow[]>;
  getServices(): Promise<ServiceRow[]>;
  getStartupItems(): Promise<StartupRow[]>;
  getRestoreItems(): Promise<RestoreItem[]>;
  getBrowserItems(): Promise<ConfigurationItem[]>;
  getNetworkItems(): Promise<ConfigurationItem[]>;
  getWindowsUpdateItems(): Promise<ConfigurationItem[]>;
  getFileAssociationItems(): Promise<ConfigurationItem[]>;
  getSessions(limit?: number): Promise<InstallationSession[]>;
  getStorageInfo(): Promise<StorageInfo>;
  getRules(): Promise<TraceRule[]>;
  saveRule(rule: TraceRule): Promise<TraceRule>;
  deleteRule(id: string): Promise<ActionResult>;
  disableStartup(name: string, source: StartupRow['source']): Promise<ActionResult>;
  restoreStartup(id: string): Promise<ActionResult>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<AppSettings>;
  pauseMonitoring(): Promise<ActionResult>;
  resumeMonitoring(): Promise<ActionResult>;
  clearEvents(): Promise<ActionResult>;
  clearReports(): Promise<ActionResult>;
  resetDatabase(): Promise<ActionResult>;
  getSystemAccent(): Promise<string>;
  exportSettings(): Promise<ActionResult>;
  importSettings(): Promise<ActionResult & { settings?: AppSettings }>;
  exportReport(session: InstallationSession): Promise<ActionResult>;
  stopProcess(pid: number): Promise<ActionResult>;
  stopService(name: string): Promise<ActionResult>;
  showSurface(surface: 'main' | 'terminal' | 'widget' | 'bubble' | 'preview'): Promise<void>;
  hideSurface(surface: 'terminal' | 'widget' | 'bubble' | 'preview'): Promise<void>;
  windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
  onNavigate(callback: (page: string) => void): () => void;
  onTraceEvent(callback: (event: TraceEvent) => void): () => void;
}

declare global {
  interface Window {
    traceGuard?: TraceGuardApi;
  }
}
