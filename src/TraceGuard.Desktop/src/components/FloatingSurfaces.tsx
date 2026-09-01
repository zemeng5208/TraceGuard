import { Activity, CircleGauge, FileClock, HardDrive, Network, X } from 'lucide-react';
import { EventTerminal } from '@/components/EventTerminal';
import { traceGuardApi } from '@/bridge';
import { isChinese } from '@/i18n';
import type { AppSettings, Overview, TraceEvent } from '@/types';

const api = traceGuardApi();
const bytes = (value = 0) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB/s` : `${Math.round(value / 1024)} KB/s`;

export function WidgetSurface({ overview, settings }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings }) {
  const isZh = isChinese(settings.locale);
  const rows = [
    [FileClock, isZh ? '文件变化' : 'Files', '+38 /min', 'blue'],
    [Activity, isZh ? '注册表变化' : 'Registry', '+7 /min', 'purple'],
    [CircleGauge, isZh ? '进程' : 'Processes', String(overview?.processCount ?? 0), 'cyan'],
    [CircleGauge, isZh ? '服务' : 'Services', String(overview?.serviceCount ?? 0), 'green'],
    [HardDrive, isZh ? '磁盘' : 'Disk', bytes(overview?.diskBytesPerSecond), 'blue'],
    [Network, isZh ? '网络' : 'Network', bytes(overview?.networkBytesPerSecond), 'purple'],
  ] as const;
  return <main className="floating-canvas"><section className="widget-surface glass-window" style={{ opacity: settings.widgetOpacity / 100 }}>
    <header><span className="mini-logo">TG</span><strong>TraceGuard</strong><i /> <em>LIVE</em><button type="button" onClick={() => void api.hideSurface('widget')}><X size={14} /></button></header>
    <div className="widget-metrics">{rows.map(([Icon, label, value, tone]) => <div key={label} className={`tone-${tone}`}><Icon size={14} /><span>{label}</span><strong>{value}</strong></div>)}</div>
    {overview?.activeInstaller ? <div className="widget-installer"><small>{isZh ? '正在监控' : 'Active Installer'}</small><div><strong>{overview.activeInstaller.name}</strong><em>● REC</em></div><p><span>{isZh ? '运行时间' : 'Monitoring Time'}</span><b>00:03:24</b></p></div> : null}
  </section></main>;
}

export function BubbleSurface({ overview, events, settings }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings }) {
  const count = events.filter((event) => event.severity === 'critical' || event.severity === 'important').length;
  return <main className="bubble-canvas" onDoubleClick={() => void api.showSurface('main')}>
    <button type="button" className={`trace-orb orb-${settings.bubbleSize}`} aria-label="Open TraceGuard" onClick={() => void api.showSurface('widget')}><span> TG </span>{overview?.monitoring ? <i /> : null}{settings.showBadgeCount && count ? <b>⚠ {count}</b> : null}</button>
  </main>;
}

export function TerminalSurface({ events, settings }: { events: TraceEvent[]; settings: AppSettings }) {
  return <main className="floating-canvas terminal-canvas"><EventTerminal events={events} settings={settings} standalone /></main>;
}
