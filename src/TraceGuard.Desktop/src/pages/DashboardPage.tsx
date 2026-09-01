import { ActivityChart, EventFeed, InstallerPanel, MetricCard, ResourcePanel } from '@/components/DashboardWidgets';
import { secondaryText, text } from '@/i18n';
import type { AppSettings, Overview, TraceEvent } from '@/types';

const bytesRate = (value = 0) => {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB/s`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB/s`;
  return `${value} B/s`;
};

export function DashboardPage({ overview, events, settings, onViewReports }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings; onViewReports: () => void }) {
  const isZh = settings.locale === 'zh-CN' || (settings.locale === 'auto' && navigator.language.toLowerCase().startsWith('zh'));
  const monitoringLabel = overview?.monitoringMode === 'paused'
    ? (isZh ? '已暂停' : 'Paused')
    : overview?.monitoringMode === 'reduced'
      ? (isZh ? '低功耗采集' : 'Reduced collection')
      : (isZh ? '实时采集中' : 'Live collection');
  return (
    <div className="dashboard-page">
      <section className="overview-section">
        <header className="section-label"><div><h2>{text('systemOverview', settings.locale)}</h2><span>{secondaryText('systemOverview', settings.locale)}</span></div><span className={`monitoring-state state-${overview?.monitoringMode ?? 'paused'}`}>● {monitoringLabel}</span></header>
        <div className="metric-grid">
          <MetricCard labelKey="fileChanges" value={(overview?.fileChanges ?? 0).toLocaleString()} detail={`+${overview?.fileChangesPerMinute ?? 0} /min`} tone="blue" settings={settings} />
          <MetricCard labelKey="registryChanges" value={(overview?.registryChanges ?? 0).toLocaleString()} detail={`+${overview?.registryChangesPerMinute ?? 0} /min`} tone="purple" settings={settings} />
          <MetricCard labelKey="processes" value={String(overview?.processCount ?? 0)} detail={text('running', settings.locale)} tone="cyan" settings={settings} />
          <MetricCard labelKey="services" value={String(overview?.serviceCount ?? 0)} detail={isZh ? '可见服务总数' : 'Total visible services'} tone="green" settings={settings} />
          <MetricCard labelKey="diskRead" value={bytesRate(overview?.diskBytesPerSecond)} detail={isZh ? '可读进程实时值' : 'Readable processes · live'} tone="blue" settings={settings} />
          <MetricCard labelKey="networkSend" value={bytesRate(overview?.networkBytesPerSecond)} detail={isZh ? '网卡实时总量' : 'Interfaces · live'} tone="purple" settings={settings} />
        </div>
      </section>
      <div className="dashboard-row dashboard-row--wide"><ActivityChart events={events} settings={settings} /><InstallerPanel overview={overview} settings={settings} onViewReports={onViewReports} /></div>
      <div className="dashboard-row"><EventFeed events={events} settings={settings} /><ResourcePanel overview={overview} settings={settings} /></div>
    </div>
  );
}
