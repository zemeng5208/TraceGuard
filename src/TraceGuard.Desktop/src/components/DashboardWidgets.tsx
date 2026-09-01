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

const chartSeries = {
  file: [45, 58, 53, 62, 55, 48, 68, 61, 52, 76, 50, 61, 54, 90, 65, 71, 43, 63, 54, 81, 60],
  registry: [26, 38, 32, 44, 29, 35, 41, 25, 31, 47, 28, 34, 27, 52, 33, 39, 24, 36, 30, 43, 29],
  process: [11, 18, 14, 22, 13, 17, 26, 12, 19, 28, 13, 18, 15, 39, 19, 24, 12, 21, 16, 25, 14],
};

const linePoints = (series: number[], max = 100) =>
  series.map((value, index) => `${32 + index * (520 / (series.length - 1))},${144 - (value / max) * 110}`).join(' ');

export function ActivityChart({ settings }: { settings: AppSettings }) {
  return (
    <section className="panel activity-panel">
      <header className="panel-title-row">
        <div><h2>{text('liveActivity', settings.locale)}</h2><span>{secondaryText('liveActivity', settings.locale)}</span></div>
        <div className="chart-legend"><span className="file">● {text('files', settings.locale)}</span><span className="registry">● {text('registry', settings.locale)}</span><span className="process">● {text('processes', settings.locale)}</span></div>
      </header>
      <svg viewBox="0 0 590 170" className="activity-chart" role="img" aria-label="Live event volume">
        {[34, 70, 107, 144].map((y, index) => <line key={y} x1="32" y1={y} x2="560" y2={y} className="chart-grid" />)}
        {[120, 90, 60, 30].map((label, index) => <text key={label} x="5" y={39 + index * 37}>{label}</text>)}
        <polyline points={linePoints(chartSeries.file)} className="chart-line chart-line--file" />
        <polyline points={linePoints(chartSeries.registry)} className="chart-line chart-line--registry" />
        <polyline points={linePoints(chartSeries.process)} className="chart-line chart-line--process" />
        {['10:32:00', '10:32:10', '10:32:20', '10:32:30', '10:32:40', '10:32:50', '10:33:00'].map((label, index) => (
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
  return (
    <section className="panel event-feed">
      <header className="panel-title-row"><div><h2>{text('importantEvents', settings.locale)}</h2><span>{secondaryText('importantEvents', settings.locale)}</span></div></header>
      <div className="event-list">
        {events.slice(0, limit).map((event) => (
          <div className="event-row" key={event.id}>
            <span className={`event-dot severity-${event.severity}`} />
            <time>{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}</time>
            <div><strong>{isChinese(settings.locale) ? event.easyMessageZh : event.easyMessage}</strong><small>{isChinese(settings.locale) ? event.easyMessage : event.easyMessageZh}</small></div>
            <span className="event-process">{event.processName ?? 'Windows'}</span>
            <ChevronRight size={15} />
          </div>
        ))}
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
  return (
    <section className="panel resource-panel">
      <header className="panel-title-row"><div><h2>{text('systemResources', settings.locale)}</h2><span>{secondaryText('systemResources', settings.locale)}</span></div></header>
      <div className="gauge-grid">
        <ResourceGauge value={overview?.cpuPercent ?? 0} label="CPU" color="#4f9cff" />
        <ResourceGauge value={overview?.memoryPercent ?? 0} label={isChinese(settings.locale) ? '内存' : 'RAM'} color="#62d797" />
        <ResourceGauge value={32} label={isChinese(settings.locale) ? '磁盘' : 'Disk'} color="#4f9cff" />
        <ResourceGauge value={18} label={isChinese(settings.locale) ? '网络' : 'Network'} color="#62d797" />
      </div>
      <div className="resource-note"><ShieldAlert size={15} /><span>{isChinese(settings.locale) ? '仅显示当前用户可观察的数据' : 'Shows data observable by the current user only'}</span></div>
    </section>
  );
}
