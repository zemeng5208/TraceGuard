import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { traceGuardApi } from '@/bridge';
import { defaultSettings } from '@/data/preview';
import { Sidebar, type PageId } from '@/components/Sidebar';
import { WindowBar } from '@/components/WindowBar';
import { DashboardPage } from '@/pages/DashboardPage';
import { TerminalPage } from '@/pages/TerminalPage';
import { ProcessesPage } from '@/pages/ProcessesPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { StartupPage } from '@/pages/StartupPage';
import { ApplicationsPage } from '@/pages/ApplicationsPage';
import { RulesPage } from '@/pages/RulesPage';
import { RestorePage } from '@/pages/RestorePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ConfigurationPage } from '@/pages/ConfigurationPage';
import { EventExplorerPage } from '@/pages/EventExplorerPage';
import { BubbleSurface, PreviewSurface, TerminalSurface, WidgetSurface } from '@/components/FloatingSurfaces';
import type { AppSettings, ConfigurationItem, InstallationSession, Overview, ProcessRow, RestoreItem, ServiceRow, StartupRow, TraceEvent, TraceRule } from '@/types';

const api = traceGuardApi();

export function App() {
  const surface = new URLSearchParams(window.location.search).get('surface');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [startup, setStartup] = useState<StartupRow[]>([]);
  const [sessions, setSessions] = useState<InstallationSession[]>([]);
  const [rules, setRules] = useState<TraceRule[]>([]);
  const [restoreItems, setRestoreItems] = useState<RestoreItem[]>([]);
  const [browserItems, setBrowserItems] = useState<ConfigurationItem[]>([]);
  const [networkItems, setNetworkItems] = useState<ConfigurationItem[]>([]);
  const [updateItems, setUpdateItems] = useState<ConfigurationItem[]>([]);
  const [associationItems, setAssociationItems] = useState<ConfigurationItem[]>([]);
  const [page, setPage] = useState<PageId>('dashboard');
  const [coreError, setCoreError] = useState<string | null>(null);
  const refreshPromise = useRef<Promise<void> | null>(null);
  const settingsSaveTimer = useRef<number | null>(null);
  const settingsSaveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const refresh = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    const run = (async () => {
      try {
        const [nextOverview, nextEvents, nextProcesses, nextServices, nextStartup, nextSessions, nextRules, nextRestoreItems, nextBrowserItems, nextNetworkItems, nextUpdateItems, nextAssociationItems] = await Promise.all([
          api.getOverview(), api.getEvents(250), api.getProcesses(), api.getServices(), api.getStartupItems(), api.getSessions(100), api.getRules(), api.getRestoreItems(), api.getBrowserItems(), api.getNetworkItems(), api.getWindowsUpdateItems(), api.getFileAssociationItems(),
        ]);
        startTransition(() => {
          setOverview(nextOverview);
          setEvents(nextEvents);
          setProcesses(nextProcesses);
          setServices(nextServices);
          setStartup(nextStartup);
          setSessions(nextSessions);
          setRules(nextRules);
          setRestoreItems(nextRestoreItems);
          setBrowserItems(nextBrowserItems);
          setNetworkItems(nextNetworkItems);
          setUpdateItems(nextUpdateItems);
          setAssociationItems(nextAssociationItems);
          setCoreError(null);
        });
      } catch (error) {
        setCoreError(error instanceof Error ? error.message : String(error));
      } finally { refreshPromise.current = null; }
    })();
    refreshPromise.current = run;
    return run;
  }, []);

  useEffect(() => {
    void api.getSettings().then(setSettings).catch(() => setSettings(defaultSettings));
    void refresh();
    const refreshMs = settings.lowPowerMode ? 5000 : surface === 'widget' ? settings.widgetRefreshMs : 2000;
    const interval = window.setInterval(refresh, refreshMs);
    const unsubscribe = api.onTraceEvent((event) => {
      setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, settings.terminalMaxRows));
    });
    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refresh, settings.lowPowerMode, settings.terminalMaxRows, settings.widgetRefreshMs, surface]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (settingsSaveTimer.current) window.clearTimeout(settingsSaveTimer.current);
      settingsSaveTimer.current = window.setTimeout(() => {
        settingsSaveQueue.current = settingsSaveQueue.current.catch(() => undefined).then(() => api.updateSettings(next)).catch((error) => setCoreError(error instanceof Error ? error.message : String(error)));
      }, 160);
      return next;
    });
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.dataset.theme = settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : settings.theme;
    };
    applyTheme();
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.animation = settings.animation;
    document.documentElement.dataset.fontSize = settings.fontSize;
    document.documentElement.dataset.cornerRadius = settings.cornerRadius;
    const applyAccent = (color: string) => {
      const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : settings.accentColor;
      document.documentElement.style.setProperty('--accent', normalized);
      const channels = normalized.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16));
      if (channels?.length === 3) document.documentElement.style.setProperty('--accent-rgb', channels.join(','));
    };
    applyAccent(settings.accentColor);
    if (settings.useSystemAccent) void api.getSystemAccent().then(applyAccent).catch(() => undefined);
    document.documentElement.style.setProperty('--window-opacity', String(Math.max(0.7, 1 - settings.transparency / 100)));
    const media = window.matchMedia('(prefers-color-scheme: light)');
    if (settings.theme === 'system') media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings]);

  useEffect(() => api.onNavigate((nextPage) => {
    if (['dashboard', 'terminal', 'applications', 'processes', 'services', 'disk', 'network', 'update', 'files', 'registry', 'startup', 'browser', 'rules', 'restore', 'settings'].includes(nextPage)) {
      setPage(nextPage as PageId);
    }
  }), []);

  useEffect(() => {
    if (settings.restoreLastPage) {
      const saved = localStorage.getItem('traceguard:last-page');
      if (saved && ['dashboard', 'terminal', 'applications', 'processes', 'services', 'disk', 'network', 'update', 'files', 'registry', 'startup', 'browser', 'rules', 'restore', 'settings'].includes(saved)) setPage(saved as PageId);
    }
  }, [settings.restoreLastPage]);

  useEffect(() => { localStorage.setItem('traceguard:last-page', page); }, [page]);

  if (surface === 'widget') return <WidgetSurface overview={overview} events={events} settings={settings} />;
  if (surface === 'bubble') return <BubbleSurface overview={overview} events={events} settings={settings} />;
  if (surface === 'preview') return <PreviewSurface overview={overview} events={events} settings={settings} />;
  if (surface === 'terminal') return <TerminalSurface events={events} settings={settings} />;

  const pageNode = useMemo(() => {
    switch (page) {
      case 'dashboard': return <DashboardPage overview={overview} events={events} settings={settings} onViewReports={() => setPage('applications')} />;
      case 'terminal': return <TerminalPage events={events} settings={settings} />;
      case 'applications': return <ApplicationsPage sessions={sessions} settings={settings} />;
      case 'processes': return <ProcessesPage rows={processes} settings={settings} />;
      case 'services': return <ServicesPage rows={services} settings={settings} />;
      case 'startup': return <StartupPage rows={startup} settings={settings} onChanged={refresh} />;
      case 'rules': return <RulesPage rules={rules} settings={settings} onChanged={refresh} />;
      case 'restore': return <RestorePage items={restoreItems} settings={settings} onChanged={refresh} />;
      case 'files': return <EventExplorerPage title={isZh(settings) ? '文件变化' : 'File Changes'} subtitle={isZh(settings) ? '仅记录元数据，不读取文件正文' : 'Metadata only — file contents are never read'} events={events.filter(item => item.category === 'file')} settings={settings} />;
      case 'registry': return <EventExplorerPage title={isZh(settings) ? '注册表变化' : 'Registry Changes'} subtitle={isZh(settings) ? '当前用户可读区域的实时差分' : 'Live differences in areas readable by the current user'} events={events.filter(item => item.category === 'registry')} settings={settings} />;
      case 'disk': return <EventExplorerPage title={isZh(settings) ? '磁盘活动' : 'Disk Activity'} subtitle={isZh(settings) ? '当前用户可读取的进程 I/O 与文件变化' : 'Readable per-process I/O and file changes'} events={events.filter(item => item.category === 'file')} processes={processes} settings={settings} diskMode />;
      case 'browser': return <ConfigurationPage title={isZh(settings) ? '浏览器与默认应用' : 'Browser & Default Apps'} subtitle={isZh(settings) ? 'Chrome、Edge、Firefox 与当前用户文件关联' : 'Chrome, Edge, Firefox, and current-user file associations'} items={[...browserItems, ...associationItems.filter(item => !browserItems.some(browser => browser.id === item.id))]} events={events.filter(item => item.category === 'browser')} emptyText={isZh(settings) ? '未发现可读取的浏览器配置' : 'No readable browser configuration found'} settings={settings} />;
      case 'network': return <ConfigurationPage title={isZh(settings) ? '网络设置' : 'Network Settings'} subtitle={isZh(settings) ? '代理、DNS 与 Hosts 元数据' : 'Proxy, DNS, and Hosts metadata'} items={networkItems} events={events.filter(item => item.category === 'network')} emptyText={isZh(settings) ? '未发现可读取的网络设置' : 'No readable network settings found'} settings={settings} />;
      case 'update': return <ConfigurationPage title={isZh(settings) ? 'Windows 更新活动' : 'Windows Update Activity'} subtitle={isZh(settings) ? '观察更新服务、工作进程和最近活动' : 'Observe update services, worker processes, and recent activity'} items={updateItems} events={events.filter(item => item.category === 'update')} emptyText={isZh(settings) ? '当前没有可见的更新活动' : 'No update activity is currently visible'} settings={settings} />;
      case 'settings': return <SettingsPage settings={settings} overview={overview} onChange={updateSettings} />;
      default: return <DashboardPage overview={overview} events={events} settings={settings} onViewReports={() => setPage('applications')} />;
    }
  }, [associationItems, browserItems, events, networkItems, overview, page, processes, refresh, restoreItems, rules, services, sessions, settings, startup, updateItems, updateSettings]);

  return (
    <div className={`app-shell visual-${settings.visualStyle}`}>
      <Sidebar active={page} onSelect={setPage} settings={settings} />
      <main className="main-stage">
        <WindowBar page={page} settings={settings} onSettings={updateSettings} />
        {coreError ? <div className="core-error"><strong>TraceGuard Core unavailable</strong><span>{coreError}</span></div> : null}
        <div className="page-scroll">{pageNode}</div>
      </main>
    </div>
  );
}

const isZh = (settings: AppSettings) => settings.locale === 'zh-CN' || (settings.locale === 'auto' && navigator.language.toLowerCase().startsWith('zh'));
