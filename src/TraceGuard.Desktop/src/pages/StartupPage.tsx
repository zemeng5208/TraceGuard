import { FolderClock, KeyRound, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyTable, PermissionBadge } from '@/components/DataTable';
import { secondaryText, text } from '@/i18n';
import type { AppSettings, StartupRow } from '@/types';

export function StartupPage({ rows, settings }: { rows: StartupRow[]; settings: AppSettings }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.command} ${row.source}`.toLowerCase().includes(deferredQuery)), [deferredQuery, rows]);
  return (
    <section className="data-page panel">
      <div className="data-page-header"><div><h2>{text('startup', settings.locale)}</h2><span>{secondaryText('startup', settings.locale)} · {rows.length}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label></div>
      <div className="table-wrap"><table><thead><tr><th>{settings.locale === 'zh-CN' ? '启动项' : 'Startup item'}</th><th>{settings.locale === 'zh-CN' ? '来源' : 'Source'}</th><th>{settings.locale === 'zh-CN' ? '命令' : 'Command'}</th><th>{settings.locale === 'zh-CN' ? '状态' : 'Status'}</th><th>{settings.locale === 'zh-CN' ? '权限' : 'Permission'}</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={`${row.source}-${row.name}`}><td><strong className="startup-name">{row.source === 'startup-folder' ? <FolderClock size={15} /> : <KeyRound size={15} />}{row.name}</strong></td><td>{row.source}</td><td className="path-cell">{row.command}</td><td>{row.enabled ? (settings.locale === 'zh-CN' ? '已启用' : 'Enabled') : (settings.locale === 'zh-CN' ? '已禁用' : 'Disabled')}</td><td><PermissionBadge permission={row.permission} settings={settings} /></td></tr>)}</tbody></table>{filtered.length === 0 ? <EmptyTable settings={settings} /> : null}</div>
    </section>
  );
}

