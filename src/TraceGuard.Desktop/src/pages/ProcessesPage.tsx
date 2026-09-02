import { Search, StopCircle } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PermissionBadge, EmptyTable } from '@/components/DataTable';
import { actionResultMessage, traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { ActionResult, AppSettings, ProcessRow } from '@/types';

const api = traceGuardApi();

export function ProcessesPage({ rows, settings, onChanged }: { rows: ProcessRow[]; settings: AppSettings; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);
  const deferredQuery = useDeferredValue(query.toLowerCase());
  const filtered = useMemo(() => rows.filter((row) => `${row.name} ${row.pid} ${row.executable ?? ''}`.toLowerCase().includes(deferredQuery)), [deferredQuery, rows]);
  const isZh = isChinese(settings.locale);

  const showResult = (result: ActionResult) => {
    const elevated = result.requiresElevation;
    setFeedback({
      success: result.success,
      message: actionResultMessage(result, settings.locale, {
        success: 'Process stopped and the list was refreshed.',
        successZh: '进程已停止，列表已刷新。',
        failure: elevated ? 'Requires elevated permission. TraceGuard never requests administrator permission in Zero-Privilege Mode.' : 'The process could not be stopped with the current user permission.',
        failureZh: elevated ? '需要更高权限，TraceGuard 零提权模式不会请求管理员权限。' : '当前用户权限无法停止该进程。',
      }),
    });
  };

  const stop = async (row: ProcessRow) => {
    if (row.permission !== 'controllable') {
      showResult(row.permission === 'protected'
        ? { success: false, message: 'Protected Windows Core Component.', messageZh: 'Windows 核心受保护组件。' }
        : { success: false, requiresElevation: true });
      return;
    }
    if (settings.warnBeforeStopping && !window.confirm(isZh ? `停止 ${row.name}？` : `Stop ${row.name}?`)) return;
    try {
      const result = await api.stopProcess(row.pid);
      showResult(result);
      if (result.success) await onChanged();
    } catch (error) {
      showResult({ success: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <section className="data-page panel">
      <div className="data-page-header"><div><h2>{text('processes', settings.locale)}</h2><span>{secondaryText('processes', settings.locale)} · {rows.length}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${text('search', settings.locale)}…`} /></label></div>
      {feedback ? <p className={`inline-status ${feedback.success ? 'is-success' : 'is-error'}`} role="status">{feedback.message}</p> : null}
      <div className="table-wrap">
        <table><thead><tr><th>{isZh ? '进程' : 'Process'}</th><th>PID</th><th>CPU</th><th>RAM</th><th>I/O</th><th>{isZh ? '路径' : 'Path'}</th><th>{isZh ? '权限' : 'Permission'}</th><th /></tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.pid}><td><strong>{row.name}</strong><small>{row.publisher ?? (isZh ? '未知发布者' : 'Unknown publisher')}</small></td><td>{row.pid}<small>{row.parentPid ? `Parent ${row.parentPid}` : ''}</small></td><td>{row.cpuPercent.toFixed(1)}%</td><td>{Math.round(row.memoryBytes / 1024 / 1024)} MB</td><td>{formatRate(row.ioBytesPerSecond)}</td><td className="path-cell">{row.executable ?? '—'}</td><td><PermissionBadge permission={row.permission} settings={settings} /></td><td><button className={`icon-action ${row.permission !== 'controllable' ? 'is-unavailable' : ''}`} type="button" aria-disabled={row.permission !== 'controllable'} onClick={() => void stop(row)} title={row.permission === 'protected' ? text('protectedCore', settings.locale) : row.permission === 'observable' ? text('requiresElevation', settings.locale) : (isZh ? '停止一次' : 'Stop once')}><StopCircle size={16} /></button></td></tr>)}</tbody>
        </table>{filtered.length === 0 ? <EmptyTable settings={settings} /> : null}
      </div>
    </section>
  );
}

const formatRate = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB/s` : value ? `${Math.round(value / 1024)} KB/s` : '—';
