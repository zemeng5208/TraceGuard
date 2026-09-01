import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { traceGuardApi } from '@/bridge';
import { defaultSettings } from '@/data/preview';
import { Sidebar, type PageId } from '@/components/Sidebar';
import { WindowBar } from '@/components/WindowBar';
import { DashboardPage } from '@/pages/DashboardPage';
import { TerminalPage } from '@/pages/TerminalPage';
import { ProcessesPage } from '@/pages/ProcessesPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { StartupPage } from '@/pages/StartupPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PlannedPage } from '@/pages/PlannedPage';
import { BubbleSurface, TerminalSurface, WidgetSurface } from '@/components/FloatingSurfaces';
import type { AppSettings, Overview, ProcessRow, ServiceRow, StartupRow, TraceEvent } from '@/types';

const api = traceGuardApi();

export function App() {
  const surface = new URLSearchParams(window.location.search).get('surface');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [startup, setStartup] = useState<StartupRow[]>([]);
  const [page, setPage] = useState<PageId>('dashboard');
  const [coreError, setCoreError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextOverview, nextEvents, nextProcesses, nextServices, nextStartup] = await Promise.all([
        api.getOverview(), api.getEvents(250), api.getProcesses(), api.getServices(), api.getStartupItems(),
      ]);
      startTransition(() => {
        setOverview(nextOverview);
        setEvents(nextEvents);
        setProcesses(nextProcesses);
        setServices(nextServices);
        setStartup(nextStartup);
        setCoreError(null);
      });
    } catch (error) {
      setCoreError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void api.getSettings().then(setSettings).catch(() => setSettings(defaultSettings));
    void refresh();
    const interval = window.setInterval(refresh, settings.lowPowerMode ? 5000 : 2000);
    const unsubscribe = api.onTraceEvent((event) => {
      setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, settings.terminalMaxRows));
    });
    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refresh, settings.lowPowerMode, settings.terminalMaxRows]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void api.updateSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.animation = settings.animation;
    document.documentElement.style.setProperty('--accent', settings.accentColor);
    document.documentElement.style.setProperty('--window-opacity', String(Math.max(0.7, 1 - settings.transparency / 100)));
  }, [settings]);

  if (surface === 'widget') return <WidgetSurface overview={overview} events={events} settings={settings} />;
  if (surface === 'bubble') return <BubbleSurface overview={overview} events={events} settings={settings} />;
  if (surface === 'terminal') return <TerminalSurface events={events} settings={settings} />;

  const pageNode = useMemo(() => {
    switch (page) {
      case 'dashboard': return <DashboardPage overview={overview} events={events} settings={settings} />;
      case 'terminal': return <TerminalPage events={events} settings={settings} />;
      case 'processes': return <ProcessesPage rows={processes} settings={settings} />;
      case 'services': return <ServicesPage rows={services} settings={settings} />;
      case 'startup': return <StartupPage rows={startup} settings={settings} />;
      case 'settings': return <SettingsPage settings={settings} onChange={updateSettings} />;
      default: return <PlannedPage page={page} settings={settings} />;
    }
  }, [events, overview, page, processes, services, settings, startup, updateSettings]);

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

