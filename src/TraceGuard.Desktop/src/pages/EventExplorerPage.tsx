import { FileClock, Gauge, Search, ShieldCheck } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { isChinese } from '@/i18n';
import type { AppSettings, ProcessRow, TraceEvent } from '@/types';

export function EventExplorerPage({ title, subtitle, events, processes = [], settings, diskMode = false }: { title: string; subtitle: string; events: TraceEvent[]; processes?: ProcessRow[]; settings: AppSettings; diskMode?: boolean }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => events.filter((item) => `${item.action} ${item.detail} ${item.processName ?? ''}`.toLowerCase().includes(deferred)), [deferred, events]);
  const byProcess = useMemo(() => processes.filter(item=>item.ioBytesPerSecond>0).sort((a,b)=>b.ioBytesPerSecond-a.ioBytesPerSecond).slice(0,8).map(item=>[item.name,item.ioBytesPerSecond] as const), [processes]);
  const zh = isChinese(settings.locale);
  return <section className="event-explorer">
    <header className="configuration-hero panel"><div className="configuration-orb">{diskMode ? <Gauge size={21} /> : <FileClock size={21} />}</div><div><h2>{title}</h2><p>{subtitle}</p></div><label className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={zh ? '搜索事件…' : 'Search events…'} /></label></header>
    {diskMode ? <div className="disk-attribution panel"><div><strong>{zh ? '谁正在使用磁盘？' : 'Who is using the disk?'}</strong><span>{zh ? '显示当前用户令牌能够查询的进程 I/O 速率；高权限进程不可读时保持未知。' : 'Shows process I/O rates readable by the current-user token; elevated processes remain unknown when inaccessible.'}</span></div><div className="process-bars">{byProcess.map(([name,rate]) => <article key={name}><span>{name}</span><i><b style={{width:`${Math.max(8, rate / Math.max(1, byProcess[0]?.[1] ?? 1) * 100)}%`}} /></i><strong>{formatRate(rate)}</strong></article>)}</div></div> : null}
    <div className="event-table panel"><table><thead><tr><th>{zh ? '时间' : 'Time'}</th><th>{zh ? '操作' : 'Action'}</th><th>{zh ? '说明' : 'Explanation'}</th><th>{zh ? '来源进程' : 'Source process'}</th><th>{zh ? '技术详情' : 'Technical detail'}</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleTimeString()}</td><td><span className={`event-type event-${item.category}`}>{item.action}</span></td><td>{zh ? item.easyMessageZh : item.easyMessage}</td><td>{item.processName ?? (zh ? '未知' : 'Unknown')}</td><td className="path-cell">{item.detail}</td></tr>)}</tbody></table>{!filtered.length ? <div className="configuration-empty"><ShieldCheck size={24}/><strong>{zh ? '尚未记录事件' : 'No events recorded yet'}</strong><span>{zh ? '监控保持运行；新事件会自动出现在这里。' : 'Monitoring remains active; new events appear here automatically.'}</span></div> : null}</div>
  </section>;
}

const formatRate = (value:number) => value >= 1024*1024 ? `${(value/1024/1024).toFixed(1)}M/s` : `${Math.round(value/1024)}K/s`;
