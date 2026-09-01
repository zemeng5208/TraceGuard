import { ActivityChart, EventFeed, InstallerPanel, MetricCard, ResourcePanel } from '@/components/DashboardWidgets';
import { secondaryText, text } from '@/i18n';
import type { AppSettings, Overview, TraceEvent } from '@/types';

const bytesRate = (value = 0) => {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB/s`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB/s`;
  return `${value} B/s`;
};

export function DashboardPage({ overview, events, settings }: { overview: Overview | null; events: TraceEvent[]; settings: AppSettings }) {
  return (
    <div className="dashboard-page">
      <section className="overview-section">
        <header className="section-label"><h2>{text('systemOverview', settings.locale)}</h2><span>{secondaryText('systemOverview', settings.locale)}</span></header>
        <div className="metric-grid">
          <MetricCard labelKey="fileChanges" value={(overview?.fileChanges ?? 0).toLocaleString()} detail="+38 /min" tone="blue" settings={settings} />
          <MetricCard labelKey="registryChanges" value={(overview?.registryChanges ?? 0).toLocaleString()} detail="+7 /min" tone="purple" settings={settings} />
          <MetricCard labelKey="processes" value={String(overview?.processCount ?? 0)} detail={text('running', settings.locale)} tone="cyan" settings={settings} />
          <MetricCard labelKey="services" value={String(overview?.serviceCount ?? 0)} detail={text('running', settings.locale)} tone="green" settings={settings} />
          <MetricCard labelKey="diskRead" value={bytesRate(overview?.diskBytesPerSecond)} detail="Live" tone="blue" sparkline={[7, 8, 13, 10, 9, 16, 8, 14]} settings={settings} />
          <MetricCard labelKey="networkSend" value={bytesRate(overview?.networkBytesPerSecond)} detail="Live" tone="purple" sparkline={[4, 9, 6, 13, 8, 12, 6, 10]} settings={settings} />
        </div>
      </section>
      <div className="dashboard-row dashboard-row--wide"><ActivityChart settings={settings} /><InstallerPanel overview={overview} settings={settings} /></div>
      <div className="dashboard-row"><EventFeed events={events} settings={settings} /><ResourcePanel overview={overview} settings={settings} /></div>
    </div>
  );
}

