import {
  defaultSettings,
  previewEvents,
  previewOverview,
  previewProcesses,
  previewServices,
  previewStartup,
} from '@/data/preview';
import type { AppSettings, TraceEvent, TraceGuardApi } from '@/types';

const STORAGE_KEY = 'traceguard-preview-settings-v1';

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
  getSettings: async () => readPreviewSettings(),
  updateSettings: async (settings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return settings;
  },
  pauseMonitoring: async () => ({ success: true }),
  resumeMonitoring: async () => ({ success: true }),
  clearEvents: async () => ({ success: true }),
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
