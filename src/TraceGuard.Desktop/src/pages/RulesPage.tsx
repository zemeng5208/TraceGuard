import { BellRing, Plus, RotateCcw, ShieldBan, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, TraceRule } from '@/types';

const api = traceGuardApi();

export function RulesPage({ rules, settings, onChanged }: { rules: TraceRule[]; settings: AppSettings; onChanged: () => Promise<void> }) {
  const isZh = isChinese(settings.locale);
  const [pattern, setPattern] = useState('');
  const [autoAction, setAutoAction] = useState<TraceRule['autoStartAction']>('block');
  const [manualAction, setManualAction] = useState<TraceRule['manualStartAction']>('ask');
  const [notify, setNotify] = useState(true);
  const [blockRestart, setBlockRestart] = useState(true);
  const [message, setMessage] = useState('');
  const normalizedPattern = useMemo(() => pattern.trim(), [pattern]);

  const save = async () => {
    if (!normalizedPattern) return;
    if (settings.confirmRuleCreation && !window.confirm(isZh ? `为 ${normalizedPattern} 创建控制规则？` : `Create a control rule for ${normalizedPattern}?`)) return;
    try {
      await api.saveRule({ id: '', processPattern: normalizedPattern, autoStartAction: autoAction, manualStartAction: manualAction, notify, blockAutoRestart: blockRestart, updatedAt: new Date().toISOString() });
      setPattern('');
      setMessage(isZh ? '规则已保存。' : 'Rule saved.');
      await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  const remove = async (rule: TraceRule) => {
    if (!window.confirm(isZh ? `删除 ${rule.processPattern} 的规则？` : `Delete the rule for ${rule.processPattern}?`)) return;
    const result = await api.deleteRule(rule.id);
    setMessage(isZh ? (result.messageZh ?? '规则已删除。') : (result.message ?? 'Rule deleted.'));
    await onChanged();
  };

  return (
    <div className="rules-page">
      <section className="panel rule-editor">
        <div className="data-page-header"><div><h2>{text('rules', settings.locale)}</h2><span>{secondaryText('rules', settings.locale)}</span></div><span className="local-pill"><ShieldBan size={13} />Zero-Privilege</span></div>
        <div className="rule-explanation"><ShieldBan size={20} /><div><strong>{isZh ? '只控制当前用户拥有权限的普通程序' : 'Only controls ordinary processes owned by the current user'}</strong><span>{isZh ? 'SYSTEM、高权限或 Windows 核心组件只会被观察，TraceGuard 不会提权。' : 'SYSTEM, elevated, and Windows core components are observed only. TraceGuard never elevates.'}</span></div></div>
        <label className="rule-field"><span>{isZh ? '进程名称或路径匹配' : 'Process name or path pattern'}</span><input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="UpdateHelper.exe" /></label>
        <div className="rule-control-grid">
          <RuleSelect label={isZh ? '自动启动' : 'Automatic start'} value={autoAction} onChange={setAutoAction} isZh={isZh} />
          <RuleSelect label={isZh ? '手动启动' : 'Manual start'} value={manualAction} onChange={setManualAction} isZh={isZh} />
        </div>
        <label className="check-row"><input type="checkbox" checked={blockRestart} onChange={(event) => setBlockRestart(event.target.checked)} /><RotateCcw size={15} /><span><strong>{isZh ? '阻止自动重新启动' : 'Block Auto-Restart'}</strong><small>{isZh ? '检测到规则匹配的自动启动后，使用当前用户权限立即停止。' : 'Stops a matching automatic launch using current-user permission.'}</small></span></label>
        <label className="check-row"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} /><BellRing size={15} /><span><strong>{isZh ? '发生规则操作时通知' : 'Notify when the rule acts'}</strong><small>{isZh ? '记录阻止结果或权限不足原因。' : 'Records the block result or why permission was insufficient.'}</small></span></label>
        <button className="primary-button rule-save" type="button" disabled={!normalizedPattern} onClick={() => void save()}><Plus size={15} />{isZh ? '创建规则' : 'Create Rule'}</button>
        {message ? <p className="inline-status">{message}</p> : null}
      </section>

      <section className="panel rule-list-panel">
        <header><div><h2>{isZh ? '活动规则' : 'Active rules'}</h2><span>{rules.length} {isZh ? '条规则' : 'rules'}</span></div></header>
        <div className="rule-list">
          {rules.map((rule) => (
            <article key={rule.id}>
              <span className="rule-icon"><ShieldBan size={17} /></span>
              <div><strong>{rule.processPattern}</strong><small>{isZh ? '自动启动' : 'Auto start'} → {rule.autoStartAction.toUpperCase()} · {isZh ? '手动启动' : 'Manual'} → {rule.manualStartAction.toUpperCase()}</small></div>
              <div className="rule-badges">{rule.blockAutoRestart ? <span>Auto-Restart</span> : null}{rule.notify ? <span>Notify</span> : null}</div>
              <button className="icon-action" type="button" onClick={() => void remove(rule)} title={isZh ? '删除规则' : 'Delete rule'}><Trash2 size={15} /></button>
            </article>
          ))}
          {rules.length === 0 ? <div className="report-empty"><ShieldBan size={28} /><strong>{isZh ? '尚未创建规则' : 'No rules created'}</strong><span>{isZh ? '规则不会绕过 Windows 权限。' : 'Rules never bypass Windows permissions.'}</span></div> : null}
        </div>
      </section>
    </div>
  );
}

function RuleSelect({ label, value, onChange, isZh }: { label: string; value: TraceRule['autoStartAction']; onChange: (value: TraceRule['autoStartAction']) => void; isZh: boolean }) {
  return <div className="rule-select"><span>{label}</span><div>{(['allow', 'ask', 'block'] as const).map((action) => <button key={action} className={value === action ? 'is-selected' : ''} type="button" onClick={() => onChange(action)}><i />{isZh ? ({ allow: '允许', ask: '询问', block: '阻止' }[action]) : action[0].toUpperCase() + action.slice(1)}</button>)}</div></div>;
}
