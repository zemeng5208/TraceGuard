import { Activity, AlertTriangle, Globe2, LockKeyhole, Search, ShieldCheck } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { isChinese } from '@/i18n';
import type { AppSettings, ConfigurationItem, TraceEvent } from '@/types';

interface Props {
  title: string;
  subtitle: string;
  items: ConfigurationItem[];
  events: TraceEvent[];
  emptyText: string;
}

export function ConfigurationPage({ title, subtitle, items, events, emptyText, settings }: Props & { settings: AppSettings }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.value} ${item.category} ${item.source}`.toLowerCase().includes(deferred)), [deferred, items]);
  const recent = events.slice(0, 12);
  const zh = isChinese(settings.locale);
  return (
    <section className="configuration-page">
      <header className="configuration-hero panel">
        <div className="configuration-orb"><Globe2 size={21} /></div>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? '搜索配置…' : 'Search configuration…'} /></label>
      </header>
      <div className="configuration-layout">
        <div className="configuration-list panel">
          <div className="configuration-summary"><span>{zh ? '当前可见配置' : 'Visible configuration'}</span><strong>{filtered.length}</strong><small>{zh ? '只读优先 · 本机处理' : 'Read-first · Local processing'}</small></div>
          {filtered.length ? filtered.map((item) => <article key={item.id} className={`configuration-item severity-${item.severity}`}>
            <div className="configuration-icon">{item.permission === 'protected' ? <LockKeyhole size={15} /> : item.severity === 'important' || item.severity === 'critical' ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}</div>
            <div className="configuration-copy"><span>{item.category}</span><strong>{item.name}</strong><p>{zh ? item.descriptionZh : item.description}</p><small>{item.source}</small></div>
            <div className="configuration-value"><b>{item.value}</b><em>{item.permission === 'protected' ? (zh ? '受保护' : 'Protected') : (zh ? '只读' : 'Read only')}</em></div>
          </article>) : <div className="configuration-empty"><ShieldCheck size={25} /><strong>{emptyText}</strong><span>{zh ? '没有伪造数据；仅显示当前用户实际可读取的信息。' : 'No simulated data. Only information readable by the current user is shown.'}</span></div>}
        </div>
        <aside className="configuration-events panel">
          <header><Activity size={16} /><div><strong>{zh ? '最近变化' : 'Recent changes'}</strong><span>{zh ? '实时采集事件' : 'Live collected events'}</span></div></header>
          {recent.length ? recent.map((item) => <article key={item.id}><i className={`event-dot severity-${item.severity}`} /><time>{new Date(item.timestamp).toLocaleTimeString()}</time><div><strong>{zh ? item.easyMessageZh : item.easyMessage}</strong><small>{item.detail}</small></div></article>) : <div className="configuration-empty compact"><ShieldCheck size={20} /><strong>{zh ? '尚未检测到变化' : 'No changes detected'}</strong></div>}
          <footer><LockKeyhole size={13} />{zh ? '零提权模式：系统级项目只观察，不绕过权限。' : 'Zero-Privilege Mode: system items are observed without bypassing permissions.'}</footer>
        </aside>
      </div>
    </section>
  );
}
