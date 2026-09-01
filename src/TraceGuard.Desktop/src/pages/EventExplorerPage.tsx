import { FileClock, Gauge, Search, ShieldCheck } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { isChinese } from '@/i18n';
import type { AppSettings, TraceEvent } from '@/types';

export function EventExplorerPage({ title, subtitle, events, settings, diskMode = false }: { title: string; subtitle: string; events: TraceEvent[]; settings: AppSettings; diskMode?: boolean }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => events.filter((item) => `${item.action} ${item.detail} ${item.processName ?? ''}`.toLowerCase().includes(deferred)), [deferred, events]);
  const byProcess = useMemo(() => Object.entries(events.reduce<Record<string, number>>((acc, item) => { const key = item.processName || (isChinese(settings.locale) ? '来源未知' : 'Unknown source'); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).slice(0,8), [events, settings.locale]);
  const zh = isChinese(settings.locale);
  return <section className="event-explorer">
    <header className="configuration-hero panel"><div className="configuration-orb">{diskMode ? <Gauge size={21} /> : <FileClock size={21} />}</div><div><h2>{title}</h2><p>{subtitle}</p></div><label className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={zh ? '搜索事件…' : 'Search events…'} /></label></header>
    {diskMode ? <div className="disk-attribution panel"><div><strong>{zh ? '谁正在产生磁盘变化？' : 'Who is creating disk changes?'}</strong><span>{zh ? '按可归属的文件事件聚合；Windows 不允许普通用户读取的 I/O 不会被猜测。' : 'Grouped from attributable file events; I/O hidden by Windows is never guessed.'}</span></div><div className="process-bars">{byProcess.map(([name,count]) => <article key={name}><span>{name}</span><i><b style={{width:`${Math.max(8, count / Math.max(1, byProcess[0]?.[1] ?? 1) * 100)}%`}} /></i><strong>{count}</strong></article>)}</div></div> : null}
    <div className="event-table panel"><table><thead><tr><th>{zh ? '时间' : 'Time'}</th><th>{zh ? '操作' : 'Action'}</th><th>{zh ? '说明' : 'Explanation'}</th><th>{zh ? '来源进程' : 'Source process'}</th><th>{zh ? '技术详情' : 'Technical detail'}</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleTimeString()}</td><td><span className={`event-type event-${item.category}`}>{item.action}</span></td><td>{zh ? item.easyMessageZh : item.easyMessage}</td><td>{item.processName ?? (zh ? '未知' : 'Unknown')}</td><td className="path-cell">{item.detail}</td></tr>)}</tbody></table>{!filtered.length ? <div className="configuration-empty"><ShieldCheck size={24}/><strong>{zh ? '尚未记录事件' : 'No events recorded yet'}</strong><span>{zh ? '监控保持运行；新事件会自动出现在这里。' : 'Monitoring remains active; new events appear here automatically.'}</span></div> : null}</div>
  </section>;
}
