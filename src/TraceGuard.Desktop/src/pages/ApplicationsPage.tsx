import { AlertTriangle, AppWindow, ChevronRight, Clock3, Download, FilePlus2, FolderSync, GitBranch, RadioTower, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, ChangeSummary, InstallationSession } from '@/types';

const summaryItems: Array<{ key: keyof ChangeSummary; en: string; zh: string }> = [
  { key: 'filesCreated', en: 'Files created', zh: '创建文件' },
  { key: 'filesModified', en: 'Files modified', zh: '修改文件' },
  { key: 'filesDeleted', en: 'Files deleted', zh: '删除文件' },
  { key: 'registryCreated', en: 'Registry created', zh: '新增注册表' },
  { key: 'registryModified', en: 'Registry modified', zh: '修改注册表' },
  { key: 'startupChanges', en: 'Startup changes', zh: '启动项变化' },
  { key: 'browserChanges', en: 'Browser changes', zh: '浏览器变化' },
  { key: 'userFilesModified', en: 'User files', zh: '用户文件变化' },
];
const api = traceGuardApi();

const formatDuration = (session: InstallationSession) => {
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(session.startedAt).getTime()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export function ApplicationsPage({ sessions, settings }: { sessions: InstallationSession[]; settings: AppSettings }) {
  const isZh = isChinese(settings.locale);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState('');
  const selected = useMemo(() => sessions.find((session) => session.id === selectedId) ?? sessions[0], [selectedId, sessions]);
  const reasons = useMemo(() => selected ? riskReasons(selected, isZh) : [], [isZh, selected]);

  return (
    <div className="reports-page">
      <section className="panel report-list-panel">
        <div className="data-page-header">
          <div><h2>{text('applications', settings.locale)}</h2><span>{secondaryText('applications', settings.locale)} · {sessions.length}</span></div>
          <span className="local-pill"><ShieldCheck size={13} />{isZh ? '仅存储在本机' : 'Stored locally'}</span>
        </div>
        <div className="session-list">
          {sessions.map((session) => (
            <button key={session.id} type="button" className={`session-item ${selected?.id === session.id ? 'is-active' : ''}`} onClick={() => setSelectedId(session.id)}>
              <span className="session-icon"><AppWindow size={17} /></span>
              <span><strong>{session.rootProcess}</strong><small>{new Date(session.startedAt).toLocaleString()} · PID {session.rootPid}</small></span>
              <em className={session.status === 'recording' ? 'is-recording' : ''}>{session.status === 'recording' ? '● REC' : (isZh ? '已完成' : 'Completed')}</em>
              <ChevronRight size={15} />
            </button>
          ))}
          {sessions.length === 0 ? <div className="report-empty"><RadioTower size={28} /><strong>{isZh ? '尚无应用行为报告' : 'No application reports yet'}</strong><span>{isZh ? '运行安装程序后，TraceGuard 会在零提权模式下生成本地报告。' : 'Run an installer and TraceGuard will create a local report in Zero-Privilege Mode.'}</span></div> : null}
        </div>
      </section>

      <section className="panel report-detail-panel">
        {selected ? (
          <>
            <header className="report-hero">
              <div className="report-orb"><FolderSync size={22} /></div>
              <div><span>{isZh ? '应用行为会话' : 'Application behavior session'}</span><h2>{selected.rootProcess}</h2><small><Clock3 size={12} /> {formatDuration(selected)} · {selected.changeCount.toLocaleString()} {isZh ? '项变化' : 'changes'}</small></div>
              <div className="report-actions"><button className="glass-button" type="button" onClick={()=>void api.exportReport(selected).then(result=>setStatus(isZh?result.messageZh??'':result.message??''))}><Download size={13}/>{isZh?'导出':'Export'}</button><span className={`risk-pill ${selected.importantCount > 0 ? 'risk-important' : 'risk-normal'}`}>
                {selected.importantCount > 0 ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
                {selected.importantCount} {isZh ? '项重要变化' : 'important'}
              </span></div>
            </header>
            {status ? <p className="inline-status">{status}</p> : null}
            <div className={`risk-explanation ${reasons.length ? 'has-risk' : ''}`}><ShieldCheck size={17}/><div><strong>{reasons.length ? (isZh?'为什么需要注意':'Why this needs attention') : (isZh?'未发现高优先级行为':'No high-priority behavior detected')}</strong><span>{reasons.length ? reasons.join(' · ') : (isZh?'大量普通程序文件本身不会提高风险等级。':'Large numbers of ordinary program files do not raise risk by themselves.')}</span></div></div>
            <div className="change-summary-grid">
              {summaryItems.map((item) => <article key={item.key}><span>{isZh ? item.zh : item.en}</span><strong>{selected.summary[item.key]}</strong></article>)}
            </div>
            <div className="report-section-title"><div><h3>{isZh ? '启动链' : 'Launch chain'}</h3><span>{isZh ? '父进程 → 子进程及推测启动来源' : 'Parent → child processes with inferred launch source'}</span></div><GitBranch size={17} /></div>
            <div className="process-chain">
              {(selected.processes ?? []).map((process) => <article key={process.pid} style={{ '--chain-depth': String(process.parentPid === selected.rootPid ? 1 : process.pid === selected.rootPid ? 0 : 2) } as React.CSSProperties}><i /><div><strong>{process.name}</strong><small>PID {process.pid}{process.parentPid ? ` · Parent ${process.parentPid}` : ''}</small></div><span>{process.launchSource}</span></article>)}
              {(selected.processes ?? []).length === 0 ? <div className="report-empty compact"><span>{isZh ? '旧报告没有进程链数据。' : 'This older report has no process-chain data.'}</span></div> : null}
            </div>
            <div className="report-section-title"><div><h3>{isZh ? '注册表差分' : 'Registry diff'}</h3><span>{isZh ? '仅显示元数据和配置变化，不读取用户内容' : 'Metadata and configuration changes only; user content is not read'}</span></div><FilePlus2 size={17} /></div>
            <div className="registry-diff-list">
              {selected.registryChanges.map((change, index) => (
                <article key={`${change.path}-${change.valueName}-${index}`} className={change.severity === 'important' ? 'is-important' : ''}>
                  <span className="change-type">{change.changeType.toUpperCase()}</span>
                  <div><strong>{change.hive}\{change.path}</strong><small>{change.valueName || '(Default)'}</small></div>
                  <div className="change-values"><span>{change.oldValue ?? '—'}</span><ChevronRight size={13} /><b>{change.newValue ?? '—'}</b></div>
                </article>
              ))}
              {selected.registryChanges.length === 0 ? <div className="report-empty compact"><span>{isZh ? '此会话未检测到所监控范围内的注册表变化。' : 'No registry changes were detected in the monitored scope.'}</span></div> : null}
            </div>
            <p className="attribution-note"><AlertTriangle size={14} />{isZh ? '文件变化按安装会话时间窗口进行最佳努力关联；无法由当前用户可靠读取的进程级来源会明确保持未知。' : 'File changes use best-effort installation time-window attribution; process-level sources that cannot be read reliably remain explicitly unknown.'}</p>
          </>
        ) : <div className="report-empty"><AppWindow size={28} /><strong>{isZh ? '选择一个应用报告' : 'Select an application report'}</strong></div>}
      </section>
    </div>
  );
}

function riskReasons(session: InstallationSession, zh: boolean): string[] {
  const reasons: string[] = [];
  if (session.summary.userFilesModified) reasons.push(zh ? `修改了 ${session.summary.userFilesModified} 个用户文件` : `${session.summary.userFilesModified} user-file changes`);
  if (session.summary.startupChanges) reasons.push(zh ? '修改了登录自启动配置' : 'Changed sign-in startup configuration');
  if (session.summary.browserChanges) reasons.push(zh ? '修改了浏览器配置或策略' : 'Changed browser configuration or policy');
  if (session.summary.networkChanges) reasons.push(zh ? '修改了网络设置' : 'Changed network settings');
  if (session.registryChanges.some(change => change.path.includes('Policies'))) reasons.push(zh ? '写入了策略区域' : 'Wrote to a policy area');
  return reasons;
}
