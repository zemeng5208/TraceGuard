import { Search, StopCircle } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PermissionBadge, EmptyTable } from '@/components/DataTable';
import { traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, ProcessRow } from '@/types';

const api = traceGuardApi();

export function ProcessesPage({ rows, settings }: { rows: ProcessRow[]; settings: AppSettings }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.pid} ${row.executable ?? ''}`.toLowerCase().includes(deferredQuery)), [deferredQuery, rows]);
  return (
    <section className="data-page panel">
      <div className="data-page-header"><div><h2>{text('processes', settings.locale)}</h2><span>{secondaryText('processes', settings.locale)} · {rows.length}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label></div>
      <div className="table-wrap">
        <table><thead><tr><th>{isChinese(settings.locale) ? '进程' : 'Process'}</th><th>PID</th><th>CPU</th><th>RAM</th><th>I/O</th><th>{isChinese(settings.locale) ? '路径' : 'Path'}</th><th>{isChinese(settings.locale) ? '权限' : 'Permission'}</th><th /></tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.pid}><td><strong>{row.name}</strong><small>{row.publisher ?? 'Unknown publisher'}</small></td><td>{row.pid}<small>{row.parentPid ? `Parent ${row.parentPid}` : ''}</small></td><td>{row.cpuPercent.toFixed(1)}%</td><td>{Math.round(row.memoryBytes / 1024 / 1024)} MB</td><td>{formatRate(row.ioBytesPerSecond)}</td><td className="path-cell">{row.executable ?? '—'}</td><td><PermissionBadge permission={row.permission} settings={settings} /></td><td><button className="icon-action" type="button" disabled={row.permission !== 'controllable'} onClick={() => { if (!settings.warnBeforeStopping || window.confirm(isChinese(settings.locale) ? `停止 ${row.name}？` : `Stop ${row.name}?`)) void api.stopProcess(row.pid); }} title={row.permission === 'protected' ? text('protectedCore', settings.locale) : row.permission === 'observable' ? text('requiresElevation', settings.locale) : (isChinese(settings.locale) ? '停止一次' : 'Stop once')}><StopCircle size={16} /></button></td></tr>)}</tbody>
        </table>{filtered.length === 0 ? <EmptyTable settings={settings} /> : null}
      </div>
    </section>
  );
}

const formatRate = (value: number) => value >= 1024*1024 ? `${(value/1024/1024).toFixed(1)} MB/s` : value ? `${Math.round(value/1024)} KB/s` : '—';
