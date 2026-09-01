import {
  defaultSettings,
  previewEvents,
  previewOverview,
  previewProcesses,
  previewServices,
  previewStartup,
  previewSessions,
  previewRules,
  previewRestoreItems,
  previewBrowserItems,
  previewNetworkItems,
  previewUpdateItems,
  previewAssociationItems,
} from '@/data/preview';
import type { AppSettings, TraceEvent, TraceGuardApi, TraceRule } from '@/types';

const STORAGE_KEY = 'traceguard-preview-settings-v1';
let previewRuleState: TraceRule[] = previewRules.map((rule) => ({ ...rule }));
let previewRestoreState = previewRestoreItems.map((item) => ({ ...item }));

const readPreviewSettings = (): AppSettings => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? { ...defaultSettings, ...JSON.parse(value) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

const previewApi: TraceGuardApi = {
  isPreview: true,
  getOverview: async () => previewOverview,
  getEvents: async (limit = 100) => previewEvents.slice(0, limit),
  getProcesses: async () => previewProcesses,
  getServices: async () => previewServices,
  getStartupItems: async () => previewStartup,
  getRestoreItems: async () => previewRestoreState,
  getBrowserItems: async () => previewBrowserItems,
  getNetworkItems: async () => previewNetworkItems,
  getWindowsUpdateItems: async () => previewUpdateItems,
  getFileAssociationItems: async () => previewAssociationItems,
  getSessions: async (limit = 100) => previewSessions.slice(0, limit),
  getStorageInfo: async () => ({ databasePath: '%LOCALAPPDATA%\\TraceGuard\\traceguard.db', databaseBytes: 1_835_008, eventCount: previewEvents.length, reportCount: previewSessions.length, ruleCount: previewRuleState.length }),
  getRules: async () => previewRuleState,
  saveRule: async (rule) => {
    const saved = { ...rule, id: rule.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
    previewRuleState = [...previewRuleState.filter((item) => item.processPattern.toLowerCase() !== saved.processPattern.toLowerCase()), saved];
    return saved;
  },
  deleteRule: async (id) => { previewRuleState = previewRuleState.filter((rule) => rule.id !== id); return { success: true }; },
  disableStartup: async () => ({ success: false, message: 'Preview mode', messageZh: '预览模式不可修改启动项' }),
  restoreStartup: async (id) => { previewRestoreState = previewRestoreState.filter((item) => item.id !== id); return { success: true, message: 'Startup item restored.', messageZh: '用户级启动项已恢复。' }; },
  getSettings: async () => readPreviewSettings(),
  updateSettings: async (settings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return settings;
  },
  pauseMonitoring: async () => ({ success: true }),
  resumeMonitoring: async () => ({ success: true }),
  clearEvents: async () => ({ success: true }),
  clearReports: async () => ({ success: true }),
  resetDatabase: async () => ({ success: true }),
  getSystemAccent: async () => '#4c97ff',
  exportSettings: async () => ({ success: true, message: 'Settings exported.', messageZh: '设置已导出。' }),
  importSettings: async () => ({ success: false, message: 'Available in the desktop app.', messageZh: '请在桌面应用中使用。' }),
  stopProcess: async () => ({ success: false, message: 'Preview mode', messageZh: '预览模式不可执行系统操作' }),
  stopService: async () => ({ success: false, message: 'Preview mode', messageZh: '预览模式不可执行系统操作' }),
  showSurface: async (surface) => {
    const url = new URL(window.location.href);
    url.searchParams.set('surface', surface);
    window.open(url.toString(), surface, 'width=520,height=720');
  },
  hideSurface: async () => window.close(),
  windowAction: async (action) => {
    if (action === 'close') window.close();
  },
  onNavigate: () => () => undefined,
  onTraceEvent: () => () => undefined,
};

export const traceGuardApi = (): TraceGuardApi => window.traceGuard ?? previewApi;

export const mergeEvent = (events: TraceEvent[], event: TraceEvent, limit: number): TraceEvent[] =>
  [event, ...events.filter((item) => item.id !== event.id)].slice(0, limit);
