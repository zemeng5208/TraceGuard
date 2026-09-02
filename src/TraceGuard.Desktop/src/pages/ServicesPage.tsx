import { Search, Square } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PermissionBadge, EmptyTable } from '@/components/DataTable';
import { actionResultMessage, traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { ActionResult, AppSettings, ServiceRow } from '@/types';

const api = traceGuardApi();

export function ServicesPage({ rows, settings, onChanged }: { rows: ServiceRow[]; settings: AppSettings; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.displayName} ${row.publisher ?? ''}`.toLowerCase().includes(deferredQuery)), [deferredQuery, rows]);
  const isZh = isChinese(settings.locale);

  const showResult = (result: ActionResult) => {
    const elevated = result.requiresElevation;
    setFeedback({
      success: result.success,
      message: actionResultMessage(result, settings.locale, {
        success: 'Service stopped and the list was refreshed.',
        successZh: '服务已停止，列表已刷新。',
        failure: elevated ? 'Requires elevated permission. TraceGuard never requests administrator permission in Zero-Privilege Mode.' : 'The service could not be stopped with the current user permission.',
        failureZh: elevated ? '需要更高权限，TraceGuard 零提权模式不会请求管理员权限。' : '当前用户权限无法停止该服务。',
      }),
    });
  };

  const stop = async (row: ServiceRow) => {
    if (row.permission !== 'controllable') {
      showResult(row.permission === 'protected'
        ? { success: false, message: 'Protected Windows Core Component.', messageZh: 'Windows 核心受保护组件。' }
        : { success: false, requiresElevation: true });
      return;
    }
    if (settings.warnBeforeStopping && !window.confirm(isZh ? `停止服务 ${row.displayName}？` : `Stop service ${row.displayName}?`)) return;
    try {
      const result = await api.stopService(row.name);
      showResult(result);
      if (result.success) await onChanged();
    } catch (error) {
      showResult({ success: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <section className="data-page panel">
      <div className="data-page-header"><div><h2>{text('services', settings.locale)}</h2><span>{secondaryText('services', settings.locale)} · {rows.length}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label></div>
      {feedback ? <p className={`inline-status ${feedback.success ? 'is-success' : 'is-error'}`} role="status">{feedback.message}</p> : null}
      <div className="table-wrap"><table><thead><tr><th>{isZh ? '服务' : 'Service'}</th><th>{isZh ? '状态' : 'Status'}</th><th>{isZh ? '启动类型' : 'Startup type'}</th><th>{isZh ? '分类' : 'Category'}</th><th>{isZh ? '权限' : 'Permission'}</th><th /></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.name}><td><strong>{row.displayName}</strong><small>{row.name}</small></td><td><span className={`status-dot status-${row.status.toLowerCase()}`}>● {row.status}</span></td><td>{row.startType}</td><td>{row.category}</td><td><PermissionBadge permission={row.permission} settings={settings} /></td><td><button className={`icon-action ${row.permission !== 'controllable' ? 'is-unavailable' : ''}`} type="button" aria-disabled={row.permission !== 'controllable'} onClick={() => void stop(row)} title={row.permission === 'protected' ? text('protectedCore', settings.locale) : row.permission === 'observable' ? text('requiresElevation', settings.locale) : (isZh ? '停止服务' : 'Stop service')}><Square size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 ? <EmptyTable settings={settings} /> : null}</div>
    </section>
  );
}
