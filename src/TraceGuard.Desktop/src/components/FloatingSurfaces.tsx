import { Activity, CircleGauge, FileClock, HardDrive, Network, X } from 'lucide-react';
import { useRef } from 'react';
import { EventTerminal } from '@/components/EventTerminal';
import { traceGuardApi } from '@/bridge';
import { isChinese } from '@/i18n';
import type { AppSettings, Overview, TraceEvent } from '@/types';

const api = traceGuardApi();
const bytes = (value = 0) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB/s` : `${Math.round(value / 1024)} KB/s`;

export function WidgetSurface({ overview, events, settings }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings }) {
  const isZh = isChinese(settings.locale);
  const recent = events.filter((event) => Date.now() - new Date(event.timestamp).getTime() < 60_000);
  const rows = [
    [FileClock, isZh ? '文件变化' : 'Files', `+${recent.filter(event => event.category === 'file').length} /min`, 'blue'],
    [Activity, isZh ? '注册表变化' : 'Registry', `+${recent.filter(event => event.category === 'registry').length} /min`, 'purple'],
    [CircleGauge, isZh ? '进程' : 'Processes', String(overview?.processCount ?? 0), 'cyan'],
    [CircleGauge, isZh ? '服务' : 'Services', String(overview?.serviceCount ?? 0), 'green'],
    [HardDrive, isZh ? '磁盘' : 'Disk', bytes(overview?.diskBytesPerSecond), 'blue'],
    [Network, isZh ? '网络' : 'Network', bytes(overview?.networkBytesPerSecond), 'purple'],
  ] as const;
  return <main className="floating-canvas"><section className={`widget-surface widget-${settings.widgetSize} glass-window`} style={{ opacity: settings.widgetOpacity / 100 }}>
    <header><span className="mini-logo">TG</span><strong>TraceGuard</strong><i /> <em>LIVE</em><button type="button" onClick={() => void api.hideSurface('widget')}><X size={14} /></button></header>
    <div className="widget-metrics">{rows.map(([Icon, label, value, tone]) => <div key={label} className={`tone-${tone}`}><Icon size={14} /><span>{label}</span><strong>{value}</strong></div>)}</div>
    {overview?.activeInstaller ? <div className="widget-installer"><small>{isZh ? '正在监控' : 'Active Installer'}</small><div><strong>{overview.activeInstaller.name}</strong><em>● REC</em></div><p><span>{isZh ? '运行时间' : 'Monitoring Time'}</span><b>{formatElapsed(overview.activeInstaller.elapsedSeconds)}</b></p></div> : null}
  </section></main>;
}

export function BubbleSurface({ overview, events, settings }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings }) {
  const count = events.filter((event) => event.severity === 'critical' || event.severity === 'important').length;
  const clickTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const updateActive = settings.showUpdateStatus && events.some((event) => event.category === 'update' && Date.now() - new Date(event.timestamp).getTime() < 300_000);
  const openAction = (action: 'panel' | 'terminal' | 'console') => void api.showSurface(action === 'panel' ? 'widget' : action === 'console' ? 'main' : 'terminal');
  return <main className="bubble-canvas">
    <button type="button" className={`trace-orb orb-${settings.bubbleSize} ${updateActive ? 'is-updating' : ''}`} aria-label="Open TraceGuard"
      onMouseEnter={() => { if (settings.hoverPreview) hoverTimer.current = window.setTimeout(() => void api.showSurface('preview'), settings.hoverDelayMs); }}
      onMouseLeave={() => { if (hoverTimer.current) window.clearTimeout(hoverTimer.current); void api.hideSurface('preview'); }}
      onClick={() => { clickTimer.current = window.setTimeout(() => openAction(settings.bubbleSingleClickAction), 240); }}
      onDoubleClick={() => { if (clickTimer.current) window.clearTimeout(clickTimer.current); openAction(settings.bubbleDoubleClickAction); }}>
      <span>{settings.bubbleLabel === 'tg' ? 'TG' : updateActive ? '↻' : '●'}</span>{overview?.monitoring ? <i /> : null}
      {settings.showRecordingStatus && overview?.activeInstaller ? <em>REC</em> : settings.showBadgeCount && count ? <b>⚠ {count}</b> : null}
    </button>
  </main>;
}

export function PreviewSurface({ overview, events, settings }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings }) {
  const zh = isChinese(settings.locale);
  const recent = events.filter((event) => Date.now() - new Date(event.timestamp).getTime() < 60_000);
  return <main className="floating-canvas"><aside className="bubble-preview glass-window"><strong>{zh ? '监控中' : 'Monitoring'}</strong><span>{zh ? '文件变化' : 'Files'} <b>+{recent.filter(event=>event.category==='file').length}</b></span><span>{zh ? '注册表' : 'Registry'} <b>+{recent.filter(event=>event.category==='registry').length}</b></span><span>{zh ? '服务' : 'Services'} <b>{overview?.serviceCount ?? 0}</b></span>{overview?.activeInstaller ? <small>{overview.activeInstaller.name} · REC</small> : null}</aside></main>;
}

export function TerminalSurface({ events, settings }: { events: TraceEvent[]; settings: AppSettings }) {
  return <main className="floating-canvas terminal-canvas"><EventTerminal events={events} settings={settings} standalone /></main>;
}

const formatElapsed = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2,'0')}:${String(Math.floor(seconds / 60) % 60).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
