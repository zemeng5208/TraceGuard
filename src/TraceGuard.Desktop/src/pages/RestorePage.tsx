import { Clock3, RotateCcw, ShieldCheck, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { actionResultMessage, traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, RestoreItem } from '@/types';

const api = traceGuardApi();

export function RestorePage({ items, settings, onChanged }: { items: RestoreItem[]; settings: AppSettings; onChanged: () => Promise<void> }) {
  const isZh = isChinese(settings.locale);
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);

  const restore = async (item: RestoreItem) => {
    if (settings.confirmRestore && !window.confirm(isZh ? `恢复启动项 ${item.name}？` : `Restore startup item ${item.name}?`)) return;
    try {
      const result = await api.restoreStartup(item.id);
      setFeedback({ success: result.success, message: actionResultMessage(result, settings.locale, {
        success: 'User-level startup item restored.', successZh: '用户级启动项已恢复。',
        failure: 'The startup item was not restored.', failureZh: '启动项未恢复。',
      }) });
      if (result.success) await onChanged();
    } catch (error) {
      setFeedback({ success: false, message: error instanceof Error ? error.message : String(error) });
    }
  };

  return <section className="restore-page panel">
    <div className="data-page-header"><div><h2>{text('restore', settings.locale)}</h2><span>{secondaryText('restore', settings.locale)} · {items.length}</span></div><span className="local-pill"><ShieldCheck size={13} />{isZh ? '仅恢复用户级配置' : 'User-level restore only'}</span></div>
    <div className="restore-banner"><Undo2 size={23} /><div><strong>{isZh ? '安全恢复中心' : 'Safe Restore Center'}</strong><span>{isZh ? 'TraceGuard 只恢复由自身禁用并已备份的用户级启动项；不会修改系统服务或绕过权限。' : 'TraceGuard restores only user-level startup entries it disabled and backed up. It never changes system services or bypasses permission.'}</span></div></div>
    {feedback ? <p className={`inline-status ${feedback.success ? 'is-success' : 'is-error'}`} role="status">{feedback.message}</p> : null}
    <div className="restore-list">
      {items.map((item) => <article key={item.id}>
        <span className="restore-icon"><RotateCcw size={17} /></span>
        <div><strong>{item.name}</strong><small>{item.source} · {item.originalCommand}</small></div>
        <time><Clock3 size={12} />{new Date(item.disabledAt).getFullYear() > 2000 ? new Date(item.disabledAt).toLocaleString() : (isZh ? '旧版备份' : 'Legacy backup')}</time>
        <button className="glass-button" type="button" onClick={() => void restore(item)}>{isZh ? '恢复' : 'Restore'}</button>
      </article>)}
      {items.length === 0 ? <div className="report-empty"><ShieldCheck size={30} /><strong>{isZh ? '没有待恢复项目' : 'Nothing to restore'}</strong><span>{isZh ? '禁用用户级启动项后，安全备份会显示在这里。' : 'Safe backups appear here after you disable a user-level startup item.'}</span></div> : null}
    </div>
  </section>;
}
