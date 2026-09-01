import { Pause, Play, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { isChinese, text } from '@/i18n';
import type { AppSettings, EventCategory, TraceEvent } from '@/types';

const categories: Array<{ value: 'all' | EventCategory; short: string }> = [
  { value: 'all', short: 'ALL' }, { value: 'file', short: 'FILE' }, { value: 'registry', short: 'REG' },
  { value: 'process', short: 'PROC' }, { value: 'service', short: 'SVC' }, { value: 'startup', short: 'START' },
  { value: 'browser', short: 'BROWSER' }, { value: 'network', short: 'NET' }, { value: 'windows', short: 'WIN' },
  { value: 'update', short: 'UPDATE' },
];
const categoryKeys: Record<EventCategory, string> = { file: 'files', registry: 'registry', process: 'processes', service: 'services', startup: 'startup', browser: 'browser', network: 'network', windows: 'windowsUpdate', update: 'windowsUpdate' };

export function EventTerminal({ events, settings, standalone = false }: { events: TraceEvent[]; settings: AppSettings; standalone?: boolean }) {
  const [category, setCategory] = useState<'all' | EventCategory>('all');
  const [paused, setPaused] = useState(false);
  const [pauseSnapshot, setPauseSnapshot] = useState<TraceEvent[] | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const hoverPaused = useRef(false);
  const pauseView = () => { setPauseSnapshot(events); setPaused(true); };
  const resumeView = () => { setPauseSnapshot(null); setPaused(false); };

  const visible = useMemo(() => {
    const source = paused && pauseSnapshot ? pauseSnapshot : events;
    return source.filter((event) => {
      if (clearedAt && new Date(event.timestamp).getTime() <= clearedAt) return false;
      if (category !== 'all' && event.category !== category) return false;
      if (settings.terminalHiddenCategories.includes(event.category)) return false;
      if (!deferredQuery) return true;
      return `${event.action} ${event.detail} ${event.processName ?? ''} ${event.easyMessage} ${event.easyMessageZh}`.toLowerCase().includes(deferredQuery);
    }).slice(0, settings.terminalMaxRows);
  }, [category, clearedAt, deferredQuery, events, pauseSnapshot, paused, settings.terminalHiddenCategories, settings.terminalMaxRows]);

  useEffect(() => { if (settings.terminalAutoScroll && !paused && outputRef.current) outputRef.current.scrollTop = 0; }, [events, paused, settings.terminalAutoScroll]);

  return (
    <section className={`terminal-panel ${standalone ? 'terminal-panel--standalone' : ''}`}>
      <header className="terminal-toolbar">
        <div className="terminal-brand"><span className="mini-logo">TG</span><strong>{text('liveTerminal', settings.locale)}</strong><small>{isChinese(settings.locale) ? 'Live Terminal' : '实时终端'}</small></div>
        <div className="terminal-actions">
          <button type="button" onClick={() => paused ? resumeView() : pauseView()}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? text('resume', settings.locale) : text('pause', settings.locale)}</button>
          <button type="button" onClick={() => setClearedAt(Date.now())}><Trash2 size={14} />{text('clear', settings.locale)}</button>
        </div>
      </header>
      <div className="terminal-filterbar">
        {categories.map((item) => (
          <button key={item.value} type="button" className={category === item.value ? 'is-active' : ''} onClick={() => setCategory(item.value)}>
            <b>{item.value === 'all' ? (isChinese(settings.locale) ? '全部' : 'All') : text(categoryKeys[item.value], settings.locale)}</b>
            <small>{item.short}</small>
          </button>
        ))}
      </div>
      <div ref={outputRef} className={`terminal-output terminal-font-${settings.terminalFontSize}`} role="log" aria-live="polite" onMouseEnter={()=>{if(settings.terminalPauseOnHover&&!paused){hoverPaused.current=true;pauseView();}}} onMouseLeave={()=>{if(hoverPaused.current){hoverPaused.current=false;resumeView();}}}>
        {visible.map((event) => (
          <div className="terminal-line" key={event.id}>
            <time>{new Date(event.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: settings.terminalTimestampMilliseconds ? 3 : undefined })}</time>
            {settings.terminalShowCategory ? <strong className={`terminal-category category-${event.category}`}>[{event.category.toUpperCase()} {event.action}]</strong> : <strong />}
            {settings.terminalMode === 'raw' ? (
              <span>{event.detail}{settings.terminalShowProcess && event.processName ? ` (${event.processName}${settings.terminalShowPid && event.pid ? ` PID:${event.pid}` : ''})` : ''}</span>
            ) : (
              <span>{isChinese(settings.locale) ? event.easyMessageZh : event.easyMessage}{settings.terminalShowFullPath ? <small>{event.detail}</small> : null}<em>{settings.terminalShowProcess && event.processName ? ` · ${event.processName}${settings.terminalShowPid && event.pid ? ` PID:${event.pid}` : ''}` : ''}</em></span>
            )}
          </div>
        ))}
        {visible.length === 0 ? <div className="terminal-empty">{isChinese(settings.locale) ? '等待符合过滤条件的新事件…' : 'Waiting for matching events…'}</div> : null}
      </div>
      <footer className="terminal-footer">
        <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label>
        <span>{visible.length} / {events.length}</span>
      </footer>
    </section>
  );
}
