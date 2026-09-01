import { Search, Square } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PermissionBadge, EmptyTable } from '@/components/DataTable';
import { traceGuardApi } from '@/bridge';
import { secondaryText, text } from '@/i18n';
import type { AppSettings, ServiceRow } from '@/types';

const api = traceGuardApi();

export function ServicesPage({ rows, settings }: { rows: ServiceRow[]; settings: AppSettings }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.displayName} ${row.publisher ?? ''}`.toLowerCase().includes(deferredQuery)), [deferredQuery, rows]);
  return (
    <section className="data-page panel">
      <div className="data-page-header"><div><h2>{text('services', settings.locale)}</h2><span>{secondaryText('services', settings.locale)} · {rows.length}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label></div>
      <div className="table-wrap"><table><thead><tr><th>{settings.locale === 'zh-CN' ? '服务' : 'Service'}</th><th>{settings.locale === 'zh-CN' ? '状态' : 'Status'}</th><th>{settings.locale === 'zh-CN' ? '启动类型' : 'Startup type'}</th><th>{settings.locale === 'zh-CN' ? '分类' : 'Category'}</th><th>{settings.locale === 'zh-CN' ? '权限' : 'Permission'}</th><th /></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.name}><td><strong>{row.displayName}</strong><small>{row.name}</small></td><td><span className={`status-dot status-${row.status.toLowerCase()}`}>● {row.status}</span></td><td>{row.startType}</td><td>{row.category}</td><td><PermissionBadge permission={row.permission} settings={settings} /></td><td><button className="icon-action" type="button" disabled={row.permission !== 'controllable'} onClick={() => void api.stopService(row.name)}><Square size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 ? <EmptyTable settings={settings} /> : null}</div>
    </section>
  );
}

