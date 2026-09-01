import { Pause, Play, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { text } from '@/i18n';
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
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [clearedAt, setClearedAt] = useState<number | null>(null);

  const visible = useMemo(() => {
    if (paused) return events.slice(0, 80);
    return events.filter((event) => {
      if (clearedAt && new Date(event.timestamp).getTime() <= clearedAt) return false;
      if (category !== 'all' && event.category !== category) return false;
      if (!deferredQuery) return true;
      return `${event.action} ${event.detail} ${event.processName ?? ''} ${event.easyMessage} ${event.easyMessageZh}`.toLowerCase().includes(deferredQuery);
    }).slice(0, settings.terminalMaxRows);
  }, [category, clearedAt, deferredQuery, events, paused, settings.terminalMaxRows]);

  return (
    <section className={`terminal-panel ${standalone ? 'terminal-panel--standalone' : ''}`}>
      <header className="terminal-toolbar">
        <div className="terminal-brand"><span className="mini-logo">TG</span><strong>{text('liveTerminal', settings.locale)}</strong><small>{settings.locale === 'zh-CN' ? 'Live Terminal' : '实时终端'}</small></div>
        <div className="terminal-actions">
          <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? text('resume', settings.locale) : text('pause', settings.locale)}</button>
          <button type="button" onClick={() => setClearedAt(Date.now())}><Trash2 size={14} />{text('clear', settings.locale)}</button>
        </div>
      </header>
      <div className="terminal-filterbar">
        {categories.map((item) => (
          <button key={item.value} type="button" className={category === item.value ? 'is-active' : ''} onClick={() => setCategory(item.value)}>
            <b>{item.value === 'all' ? (settings.locale === 'zh-CN' ? '全部' : 'All') : text(categoryKeys[item.value], settings.locale)}</b>
            <small>{item.short}</small>
          </button>
        ))}
      </div>
      <div className="terminal-output" role="log" aria-live="polite">
        {visible.map((event) => (
          <div className="terminal-line" key={event.id}>
            <time>{new Date(event.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: settings.terminalTimestampMilliseconds ? 3 : undefined })}</time>
            <strong className={`terminal-category category-${event.category}`}>[{event.category.toUpperCase()} {event.action}]</strong>
            {settings.terminalMode === 'raw' ? (
              <span>{event.detail}{event.processName ? ` (${event.processName}${event.pid ? ` PID:${event.pid}` : ''})` : ''}</span>
            ) : (
              <span>{settings.locale === 'zh-CN' ? event.easyMessageZh : event.easyMessage}<em>{event.processName ? ` · ${event.processName}` : ''}</em></span>
            )}
          </div>
        ))}
        {visible.length === 0 ? <div className="terminal-empty">{settings.locale === 'zh-CN' ? '等待符合过滤条件的新事件…' : 'Waiting for matching events…'}</div> : null}
      </div>
      <footer className="terminal-footer">
        <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label>
        <span>{visible.length} / {events.length}</span>
      </footer>
    </section>
  );
}
