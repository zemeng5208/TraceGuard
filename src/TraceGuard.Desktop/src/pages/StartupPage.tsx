import { FolderClock, KeyRound, PowerOff, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyTable, PermissionBadge } from '@/components/DataTable';
import { traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, StartupRow } from '@/types';

const api = traceGuardApi();

export function StartupPage({ rows, settings, onChanged }: { rows: StartupRow[]; settings: AppSettings; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.command} ${row.source}`.toLowerCase().includes(deferredQuery)), [deferredQuery, rows]);
  return (
    <section className="data-page panel">
      <div className="data-page-header"><div><h2>{text('startup', settings.locale)}</h2><span>{secondaryText('startup', settings.locale)} · {rows.length}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label></div>
      {message ? <p className="inline-status">{message}</p> : null}
      <div className="table-wrap"><table><thead><tr><th>{isChinese(settings.locale) ? '启动项' : 'Startup item'}</th><th>{isChinese(settings.locale) ? '来源' : 'Source'}</th><th>{isChinese(settings.locale) ? '命令' : 'Command'}</th><th>{isChinese(settings.locale) ? '状态' : 'Status'}</th><th>{isChinese(settings.locale) ? '权限' : 'Permission'}</th><th /></tr></thead>
        <tbody>{filtered.map((row) => <tr key={`${row.source}-${row.name}`}><td><strong className="startup-name">{row.source === 'startup-folder' ? <FolderClock size={15} /> : <KeyRound size={15} />}{row.name}</strong></td><td>{row.source}</td><td className="path-cell">{row.command}</td><td>{row.enabled ? (isChinese(settings.locale) ? '已启用' : 'Enabled') : (isChinese(settings.locale) ? '已禁用' : 'Disabled')}</td><td><PermissionBadge permission={row.permission} settings={settings} /></td><td><button className="icon-action" type="button" disabled={!row.enabled || row.permission !== 'controllable' || row.source === 'scheduled-task'} title={row.permission !== 'controllable' ? text(row.permission === 'protected' ? 'protectedCore' : 'requiresElevation', settings.locale) : (isChinese(settings.locale) ? '禁用用户级启动项' : 'Disable user startup')} onClick={() => void (async () => { if (settings.warnBeforeDisablingStartup && !window.confirm(isChinese(settings.locale) ? `禁用启动项 ${row.name}？` : `Disable startup item ${row.name}?`)) return; const result = await api.disableStartup(row.name, row.source); setMessage(isChinese(settings.locale) ? (result.messageZh ?? '') : (result.message ?? '')); if (result.success) await onChanged(); })()}><PowerOff size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 ? <EmptyTable settings={settings} /> : null}</div>
    </section>
  );
}
