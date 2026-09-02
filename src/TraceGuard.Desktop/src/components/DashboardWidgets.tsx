import { ChevronRight, Disc3, ShieldAlert } from 'lucide-react';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, Overview, TraceEvent } from '@/types';
import { traceGuardApi } from '@/bridge';

const api = traceGuardApi();

export function MetricCard({
  labelKey,
  value,
  detail,
  tone,
  sparkline,
  settings,
}: {
  labelKey: string;
  value: string;
  detail: string;
  tone: 'blue' | 'purple' | 'cyan' | 'green';
  sparkline?: number[];
  settings: AppSettings;
}) {
  const points = (sparkline ?? []).map((point, index, values) => `${(index / Math.max(1, values.length - 1)) * 100},${24 - point}`).join(' ');
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-label"><span>{text(labelKey, settings.locale)}</span><small>{secondaryText(labelKey, settings.locale)}</small></div>
      <strong>{value}</strong>
      {sparkline?.length ? (
        <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="sparkline" aria-hidden="true">
          <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : <span className="metric-detail">{detail}</span>}
      {sparkline?.length ? <span className="metric-detail">{detail}</span> : null}
    </article>
  );
}

const linePoints = (series: number[], max = 100) =>
  series.map((value, index) => `${32 + index * (520 / (series.length - 1))},${144 - (value / max) * 110}`).join(' ');

const eventSeries = (events: TraceEvent[], now = Date.now()) => {
  const buckets = { file: Array(21).fill(0) as number[], registry: Array(21).fill(0) as number[], process: Array(21).fill(0) as number[] };
  for (const event of events) {
    if (!(event.category in buckets)) continue;
    const age = now - new Date(event.timestamp).getTime();
    if (age < 0 || age > 60_000) continue;
    const index = Math.min(20, Math.floor((60_000 - age) / 3_000));
    buckets[event.category as keyof typeof buckets][index] += 1;
  }
  return buckets;
};

export function ActivityChart({ events, settings }: { events: TraceEvent[]; settings: AppSettings }) {
  const series = eventSeries(events);
  const max = Math.max(1, ...series.file, ...series.registry, ...series.process);
  const now = Date.now();
  const timeLabels = Array.from({ length: 7 }, (_, index) => new Date(now - (6 - index) * 10_000).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }));
  return (
    <section className="panel activity-panel">
      <header className="panel-title-row">
        <div><h2>{text('liveActivity', settings.locale)}</h2><span>{secondaryText('liveActivity', settings.locale)}</span></div>
        <div className="chart-legend"><span className="file">● {text('files', settings.locale)}</span><span className="registry">● {text('registry', settings.locale)}</span><span className="process">● {text('processes', settings.locale)}</span></div>
      </header>
      <svg viewBox="0 0 590 170" className="activity-chart" role="img" aria-label="Live event volume">
        {[34, 70, 107, 144].map((y, index) => <line key={y} x1="32" y1={y} x2="560" y2={y} className="chart-grid" />)}
        {[max, Math.round(max * .67), Math.round(max * .33), 0].map((label, index) => <text key={`${label}-${index}`} x="5" y={39 + index * 37}>{label}</text>)}
        <polyline points={linePoints(series.file, max)} className="chart-line chart-line--file" />
        <polyline points={linePoints(series.registry, max)} className="chart-line chart-line--registry" />
        <polyline points={linePoints(series.process, max)} className="chart-line chart-line--process" />
        {timeLabels.map((label, index) => (
          <text key={label} x={32 + index * 87} y="165" textAnchor={index === 6 ? 'end' : index === 0 ? 'start' : 'middle'}>{label}</text>
        ))}
      </svg>
    </section>
  );
}

export function InstallerPanel({ overview, settings, onViewReports }: { overview: Overview | null; settings: AppSettings; onViewReports: () => void }) {
  const installer = overview?.activeInstaller;
  const elapsed = installer ? `${String(Math.floor(installer.elapsedSeconds / 60)).padStart(2, '0')}:${String(installer.elapsedSeconds % 60).padStart(2, '0')}` : '--:--';
  return (
    <section className="panel installer-panel">
      <header className="panel-title-row"><div><h2>{text('activeInstaller', settings.locale)}</h2><span>{secondaryText('activeInstaller', settings.locale)}</span></div></header>
      {installer ? (
        <>
          <div className="installer-file"><span className="installer-icon"><Disc3 size={17} /></span><div><strong>{installer.name}</strong><small>PID: {installer.pid}</small></div><em>REC</em></div>
          <dl className="installer-stats"><div><dt>{isChinese(settings.locale) ? '监控时长' : 'Elapsed'}</dt><dd>{elapsed}</dd></div><div><dt>{isChinese(settings.locale) ? '检测到变化' : 'Changes'}</dt><dd>{installer.changeCount}</dd></div></dl>
          <button type="button" className="primary-button" onClick={onViewReports}>{text('viewReport', settings.locale)} <span>{isChinese(settings.locale) ? '应用报告' : 'Applications'}</span></button>
        </>
      ) : <div className="empty-state">{isChinese(settings.locale) ? '未检测到活动安装程序' : 'No active installer detected'}</div>}
    </section>
  );
}

export function EventFeed({ events, settings, limit = 5 }: { events: TraceEvent[]; settings: AppSettings; limit?: number }) {
  const importantEvents = events.filter((event) => event.severity === 'important' || event.severity === 'critical').slice(0, limit);
  return (
    <section className="panel event-feed">
      <header className="panel-title-row"><div><h2>{text('importantEvents', settings.locale)}</h2><span>{secondaryText('importantEvents', settings.locale)}</span></div></header>
      <div className="event-list">
        {importantEvents.map((event) => (
          <div className="event-row" key={event.id}>
            <span className={`event-dot severity-${event.severity}`} />
            <time>{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}</time>
            <div><strong>{isChinese(settings.locale) ? event.easyMessageZh : event.easyMessage}</strong><small>{isChinese(settings.locale) ? event.easyMessage : event.easyMessageZh}</small></div>
            <span className="event-process">{event.processName ?? 'Windows'}</span>
            <ChevronRight size={15} />
          </div>
        ))}
        {importantEvents.length === 0 ? <div className="event-list-empty">{isChinese(settings.locale) ? '暂无重要或严重事件' : 'No important or critical events'}</div> : null}
      </div>
      <button className="text-button" type="button" onClick={() => void api.showSurface('terminal')}>{isChinese(settings.locale) ? '查看更多' : 'View all'} <span>{isChinese(settings.locale) ? 'View All' : '查看更多'}</span></button>
    </section>
  );
}

export function ResourceGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const angle = Math.max(0, Math.min(100, value)) * 3.6;
  return (
    <div className="resource-gauge" style={{ '--gauge-angle': `${angle}deg`, '--gauge-color': color } as React.CSSProperties}>
      <div className="gauge-ring"><div><small>{label}</small><strong>{Math.round(value)}%</strong></div></div>
    </div>
  );
}

export function ResourcePanel({ overview, settings }: { overview: Overview | null; settings: AppSettings }) {
  const formatRate = (value = 0) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB/s` : value >= 1024 ? `${(value / 1024).toFixed(0)} KB/s` : `${value} B/s`;
  return (
    <section className="panel resource-panel">
      <header className="panel-title-row"><div><h2>{text('systemResources', settings.locale)}</h2><span>{secondaryText('systemResources', settings.locale)}</span></div></header>
      <div className="gauge-grid gauge-grid--truthful">
        <ResourceGauge value={overview?.cpuPercent ?? 0} label="CPU" color="#4f9cff" />
        <ResourceGauge value={overview?.memoryPercent ?? 0} label={isChinese(settings.locale) ? '内存' : 'RAM'} color="#62d797" />
        <div className="resource-rate"><small>{isChinese(settings.locale) ? '磁盘 I/O' : 'Disk I/O'}</small><strong>{formatRate(overview?.diskBytesPerSecond)}</strong><span>{isChinese(settings.locale) ? '可读进程' : 'Readable processes'}</span></div>
        <div className="resource-rate"><small>{isChinese(settings.locale) ? '网络' : 'Network'}</small><strong>{formatRate(overview?.networkBytesPerSecond)}</strong><span>{isChinese(settings.locale) ? '网卡总量' : 'Interface total'}</span></div>
      </div>
      <div className="resource-note"><ShieldAlert size={15} /><span>{isChinese(settings.locale) ? '仅显示当前用户可观察的数据' : 'Shows data observable by the current user only'}</span></div>
    </section>
  );
}
