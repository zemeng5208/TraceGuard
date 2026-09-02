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
import type { ActionResult, AppSettings, Locale, TraceEvent, TraceGuardApi, TraceRule } from '@/types';

const STORAGE_KEY = 'traceguard-preview-settings-v1';
let previewRuleState: TraceRule[] = previewRules.map((rule) => ({ ...rule }));

const previewOnlyResult = (operation: string, operationZh: string): ActionResult => ({
  success: false,
  message: `${operation} is unavailable because TraceGuard is showing preview data without the desktop Core.`,
  messageZh: `TraceGuard 当前仅显示演示数据，未连接桌面 Core，无法${operationZh}。`,
});

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
  getRestoreItems: async () => previewRestoreItems,
  getBrowserItems: async () => previewBrowserItems,
  getNetworkItems: async () => previewNetworkItems,
  getWindowsUpdateItems: async () => previewUpdateItems,
  getFileAssociationItems: async () => previewAssociationItems,
  getSessions: async (limit = 100) => previewSessions.slice(0, limit),
  getStorageInfo: async () => ({ databasePath: '%LOCALAPPDATA%\\TraceGuard\\traceguard.db', databaseBytes: 1_835_008, eventCount: previewEvents.length, reportCount: previewSessions.length, ruleCount: previewRuleState.length }),
  getRules: async () => previewRuleState,
  saveRule: async () => { throw new Error('Preview only / 仅演示数据：未连接桌面 Core，规则未保存。'); },
  deleteRule: async () => previewOnlyResult('Deleting rules', '删除规则'),
  disableStartup: async () => previewOnlyResult('Disabling startup entries', '禁用启动项'),
  restoreStartup: async () => previewOnlyResult('Restoring startup entries', '恢复启动项'),
  getSettings: async () => readPreviewSettings(),
  updateSettings: async (settings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return settings;
  },
  pauseMonitoring: async () => previewOnlyResult('Pausing monitoring', '暂停监控'),
  resumeMonitoring: async () => previewOnlyResult('Resuming monitoring', '恢复监控'),
  clearEvents: async () => previewOnlyResult('Clearing event history', '清除事件历史'),
  clearReports: async () => previewOnlyResult('Clearing reports', '清除报告'),
  resetDatabase: async () => previewOnlyResult('Resetting the database', '重置数据库'),
  getSystemAccent: async () => '#4c97ff',
  exportSettings: async () => previewOnlyResult('Exporting settings', '导出设置'),
  importSettings: async () => previewOnlyResult('Importing settings', '导入设置'),
  exportReport: async () => previewOnlyResult('Exporting reports', '导出报告'),
  stopProcess: async () => previewOnlyResult('Stopping processes', '停止进程'),
  stopService: async () => previewOnlyResult('Stopping services', '停止服务'),
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

export const actionResultMessage = (
  result: ActionResult,
  locale: Locale,
  fallback: { success: string; successZh: string; failure: string; failureZh: string },
): string => {
  const isZh = locale === 'zh-CN' || (locale === 'auto' && navigator.language.toLowerCase().startsWith('zh'));
  if (isZh) return result.messageZh || (result.success ? fallback.successZh : fallback.failureZh);
  return result.message || (result.success ? fallback.success : fallback.failure);
};

export const mergeEvent = (events: TraceEvent[], event: TraceEvent, limit: number): TraceEvent[] =>
  [event, ...events.filter((item) => item.id !== event.id)].slice(0, limit);
