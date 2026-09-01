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
  processCount: number;
  serviceCount: number;
  diskBytesPerSecond: number;
  networkBytesPerSecond: number;
  cpuPercent: number;
  memoryPercent: number;
  monitoring: boolean;
  activeInstaller?: {
    name: string;
    pid: number;
    elapsedSeconds: number;
    changeCount: number;
  };
}

export interface ProcessRow {
  pid: number;
  parentPid?: number;
  name: string;
  executable?: string;
  cpuPercent: number;
  memoryBytes: number;
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
  hoverPreview: boolean;
  hoverDelayMs: 0 | 300 | 500 | 800;
  terminalMode: 'easy' | 'raw';
  terminalAutoScroll: boolean;
  terminalTimestampMilliseconds: boolean;
  terminalMaxRows: number;
  notificationLevel: 'all' | 'important' | 'critical' | 'off';
  notificationSound: boolean;
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
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<AppSettings>;
  pauseMonitoring(): Promise<ActionResult>;
  resumeMonitoring(): Promise<ActionResult>;
  clearEvents(): Promise<ActionResult>;
  stopProcess(pid: number): Promise<ActionResult>;
  stopService(name: string): Promise<ActionResult>;
  showSurface(surface: 'main' | 'terminal' | 'widget' | 'bubble'): Promise<void>;
  hideSurface(surface: 'terminal' | 'widget' | 'bubble'): Promise<void>;
  windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
  onNavigate(callback: (page: string) => void): () => void;
  onTraceEvent(callback: (event: TraceEvent) => void): () => void;
}

declare global {
  interface Window {
    traceGuard?: TraceGuardApi;
  }
}
