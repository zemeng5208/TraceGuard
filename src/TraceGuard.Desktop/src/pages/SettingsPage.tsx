import {
  Bell, Bot, CircleHelp, Database, Eye, Languages,
  MonitorCog, Palette, Power, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, TerminalSquare, PanelsTopLeft,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings, StorageInfo } from '@/types';
import { defaultSettings } from '@/data/preview';
import { traceGuardApi } from '@/bridge';

type SectionId = 'general' | 'appearance' | 'language' | 'monitoring' | 'floatingWindow' | 'floatingBubble' | 'liveTerminal' | 'notifications' | 'startupBackground' | 'privacy' | 'storage' | 'protection' | 'advanced' | 'about';

const sections: Array<{ id: SectionId; key: string; icon: typeof Settings2; search: string }> = [
  { id: 'general', key: 'general', icon: Settings2, search: 'launch minimized position size close startup 常规 启动 窗口' },
  { id: 'appearance', key: 'appearance', icon: Palette, search: 'theme mica acrylic color transparency radius density font animation sidebar 外观 主题 颜色 透明度' },
  { id: 'language', key: 'language', icon: Languages, search: 'language english chinese automatic 语言 中文 英文' },
  { id: 'monitoring', key: 'monitoring', icon: MonitorCog, search: 'file registry process service browser disk network update monitor 监控 文件 注册表 进程 服务 磁盘' },
  { id: 'floatingWindow', key: 'floatingWindow', icon: PanelsTopLeft, search: 'widget opacity always top size refresh edge window 悬浮窗 透明度 置顶' },
  { id: 'floatingBubble', key: 'floatingBubble', icon: Sparkles, search: 'bubble orb badge hover tg 悬浮球 徽章' },
  { id: 'liveTerminal', key: 'liveTerminal', icon: TerminalSquare, search: 'terminal raw easy rows timestamp scroll 实时终端 原始' },
  { id: 'notifications', key: 'notifications', icon: Bell, search: 'notification sound critical important 通知 声音' },
  { id: 'startupBackground', key: 'startupBackground', icon: Power, search: 'login background close battery power 登录 后台 电池' },
  { id: 'privacy', key: 'privacy', icon: Eye, search: 'privacy local file paths telemetry browser passwords cookies 隐私 本地 路径 遥测' },
  { id: 'storage', key: 'storage', icon: Database, search: 'storage retention database clear export import 存储 保留 数据库' },
  { id: 'protection', key: 'protection', icon: ShieldCheck, search: 'coreguard warning restore rule protected 保护 核心 确认' },
  { id: 'advanced', key: 'advanced', icon: SlidersHorizontal, search: 'advanced buffer polling debug developer 高级 调试' },
  { id: 'about', key: 'about', icon: CircleHelp, search: 'about version license privacy 关于 版本' },
];

const zh = (settings: AppSettings) => isChinese(settings.locale);
const api = traceGuardApi();
const sectionDefaults: Record<SectionId, Array<keyof AppSettings>> = {
  general: ['launchAtSignIn', 'startMinimized', 'startSurface', 'closeBehavior', 'rememberWindowPosition', 'rememberWindowSize', 'restoreLastPage'],
  appearance: ['theme', 'visualStyle', 'accentColor', 'useSystemAccent', 'transparency', 'density', 'fontSize', 'animation', 'sidebar', 'cornerRadius'],
  language: ['locale'],
  monitoring: ['fileMonitoring', 'processMonitoring', 'serviceMonitoring', 'startupMonitoring', 'registryMonitoring', 'browserMonitoring', 'updateMonitoring', 'networkMonitoring', 'fullDiskMonitoring'],
  floatingWindow: ['floatingWidgetEnabled', 'alwaysOnTop', 'clickThrough', 'widgetOpacity', 'widgetSize', 'widgetRefreshMs', 'autoCollapse', 'edgeSnap', 'rememberWidgetPosition'],
  floatingBubble: ['bubbleSize', 'bubbleLabel', 'showBadgeCount', 'showUpdateStatus', 'showRecordingStatus', 'hoverPreview', 'hoverDelayMs', 'bubbleSingleClickAction', 'bubbleDoubleClickAction'],
  liveTerminal: ['terminalMode', 'terminalAutoScroll', 'terminalTimestampMilliseconds', 'terminalMaxRows'],
  notifications: ['notificationLevel', 'notificationSound', 'notifySystemChange', 'notifyStartup', 'notifyService', 'notifyBrowser', 'notifyBlockedRestart', 'notifyInstallerComplete', 'notifyWindowsUpdate', 'notifyUserFiles'],
  startupBackground: ['keepMonitoringOnClose', 'lowPowerMode', 'pauseOnBattery'],
  privacy: ['storeFilePaths'], storage: ['retentionDays'],
  protection: ['warnBeforeStopping', 'warnBeforeDisablingStartup', 'confirmRestore', 'confirmRuleCreation'],
  advanced: [], about: [],
};

function SettingCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <section className={`setting-card ${className}`}><header><div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div></header>{children}</section>;
}

function SettingRow({ title, description, children, locked = false }: { title: string; description: string; children: ReactNode; locked?: boolean }) {
  return <div className={`setting-row ${locked ? 'is-locked' : ''}`}><div><strong>{title}</strong><span>{description}</span></div><div className="setting-control">{children}</div></div>;
}

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" className={`toggle ${checked ? 'is-on' : ''}`} disabled={disabled} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span /></button>;
}

function Choices<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div className="selection-control">{options.map((option) => <button type="button" key={option.value} className={option.value === value ? 'is-selected' : ''} onClick={() => onChange(option.value)}><i />{option.label}</button>)}</div>;
}

function Appearance({ settings, onChange }: SettingsContentProps) {
  const colors = ['#9d7cfb', '#6576ee', '#58a5ff', '#f3a35d', '#f06d71', '#d95bae', '#3a8ce7', '#56d397', '#3cc5d4'];
  return <>
    <div className="settings-heading"><span className="heading-orb"><Palette size={19} /></span><div><h2>{text('appearance', settings.locale)}</h2><small>{secondaryText('appearance', settings.locale)}</small></div></div>
    <div className="settings-grid settings-grid--appearance">
      <SettingCard title={text('theme', settings.locale)} subtitle={zh(settings) ? '选择应用明暗模式' : 'Choose the application color mode'}>
        <Choices value={settings.theme} options={[{ value: 'system', label: text('system', settings.locale) }, { value: 'light', label: text('light', settings.locale) }, { value: 'dark', label: text('dark', settings.locale) }]} onChange={(theme) => onChange({ theme })} />
      </SettingCard>
      <SettingCard title={zh(settings) ? '圆角' : 'Corner Radius'} subtitle={zh(settings) ? '调整玻璃面板的轮廓' : 'Adjust glass surface geometry'}>
        <Choices value={settings.cornerRadius} options={[{ value: 'standard', label: zh(settings) ? '标准' : 'Standard' }, { value: 'rounded', label: zh(settings) ? '圆润' : 'Rounded' }, { value: 'more-rounded', label: zh(settings) ? '更圆润' : 'More rounded' }]} onChange={(cornerRadius) => onChange({ cornerRadius })} />
      </SettingCard>
      <SettingCard title={text('visualStyle', settings.locale)} subtitle={zh(settings) ? '不支持时将自动降级' : 'Falls back safely when unavailable'}>
        <Choices value={settings.visualStyle} options={[{ value: 'mica', label: 'Mica' }, { value: 'acrylic', label: 'Acrylic' }, { value: 'solid', label: 'Solid' }]} onChange={(visualStyle) => onChange({ visualStyle })} />
      </SettingCard>
      <SettingCard title={text('fontSize', settings.locale)} subtitle={zh(settings) ? '保持系统字体清晰可读' : 'Keeps system typography legible'}>
        <Choices value={settings.fontSize} options={[{ value: 'small', label: zh(settings) ? '小号' : 'Small' }, { value: 'default', label: zh(settings) ? '默认' : 'Default' }, { value: 'large', label: zh(settings) ? '大号' : 'Large' }]} onChange={(fontSize) => onChange({ fontSize })} />
      </SettingCard>
      <SettingCard title={text('accentColor', settings.locale)} subtitle={zh(settings) ? '用于焦点与实时状态' : 'Used for focus and live status'} className="setting-card--wide">
        <div className="accent-row">{colors.map((color) => <button type="button" key={color} className={settings.accentColor === color ? 'is-selected' : ''} style={{ '--swatch': color } as CSSProperties} onClick={() => onChange({ accentColor: color, useSystemAccent: false })} />)}<label><span>{zh(settings) ? '使用系统强调色' : 'Use system accent color'}</span><Toggle checked={settings.useSystemAccent} onChange={(useSystemAccent) => onChange({ useSystemAccent })} /></label></div>
      </SettingCard>
      <SettingCard title={text('animation', settings.locale)} subtitle={zh(settings) ? '遵循 Windows 减少动态效果设置' : 'Respects Windows Reduce Motion'}>
        <Choices value={settings.animation} options={[{ value: 'full', label: zh(settings) ? '完整' : 'Full' }, { value: 'reduced', label: zh(settings) ? '减少' : 'Reduced' }, { value: 'off', label: zh(settings) ? '关闭' : 'Off' }]} onChange={(animation) => onChange({ animation })} />
      </SettingCard>
      <SettingCard title={text('transparency', settings.locale)} subtitle={zh(settings) ? '自动保证文字对比度' : 'Text contrast is preserved'}>
        <div className="slider-row"><input type="range" min="0" max="30" value={settings.transparency} onChange={(event) => onChange({ transparency: Number(event.target.value) })} /><output>{settings.transparency}%</output></div>
      </SettingCard>
      <SettingCard title={text('density', settings.locale)}>
        <Choices value={settings.density} options={[{ value: 'comfortable', label: text('comfortable', settings.locale) }, { value: 'compact', label: text('compact', settings.locale) }]} onChange={(density) => onChange({ density })} />
      </SettingCard>
      <SettingCard title={text('sidebarStyle', settings.locale)}>
        <Choices value={settings.sidebar} options={[{ value: 'expanded', label: zh(settings) ? '展开' : 'Expanded' }, { value: 'compact', label: text('compact', settings.locale) }, { value: 'auto', label: zh(settings) ? '自动' : 'Auto' }]} onChange={(sidebar) => onChange({ sidebar })} />
      </SettingCard>
    </div>
  </>;
}

interface SettingsContentProps { settings: AppSettings; onChange: (patch: Partial<AppSettings>) => void }

function StorageContent({ settings, onChange }: SettingsContentProps) {
  const isZh = zh(settings);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [status, setStatus] = useState('');
  const refresh = () => void api.getStorageInfo().then(setInfo).catch(() => setInfo(null));
  useEffect(refresh, []);
  const run = async (action: () => Promise<{success:boolean;message?:string;messageZh?:string}>) => { const result = await action(); setStatus(isZh ? result.messageZh ?? '' : result.message ?? ''); refresh(); };
  return <SettingCard title={isZh ? '事件与本地数据库' : 'Events & local database'}>
    <SettingRow title={isZh ? '数据保留' : 'Retention'} description={isZh ? '过期事件在后台安全清理。' : 'Expired events are removed safely in the background.'}><Choices value={settings.retentionDays} options={[{ value: 1, label: '1D' }, { value: 7, label: '7D' }, { value: 30, label: '30D' }, { value: 90, label: '90D' }, { value: 0, label: '∞' }]} onChange={(retentionDays) => onChange({ retentionDays })} /></SettingRow>
    <SettingRow title={isZh ? '数据库位置' : 'Database Location'} description={info?.databasePath ?? '%LOCALAPPDATA%\\TraceGuard\\traceguard.db'}><span className="local-pill">{formatBytes(info?.databaseBytes ?? 0)} · {isZh ? '仅本机' : 'Local only'}</span></SettingRow>
    <SettingRow title={isZh ? '数据摘要' : 'Stored data'} description={`${info?.eventCount ?? 0} ${isZh?'个事件':'events'} · ${info?.reportCount ?? 0} ${isZh?'份报告':'reports'} · ${info?.ruleCount ?? 0} ${isZh?'条规则':'rules'}`}><span className="local-pill">SQLite</span></SettingRow>
    <SettingRow title={isZh ? '导出 / 导入设置' : 'Export / Import Settings'} description={isZh ? 'JSON 只包含设置，不包含事件、规则或报告。' : 'JSON contains settings only—never events, rules, or reports.'}><div className="storage-actions"><button className="glass-button" type="button" onClick={()=>void run(()=>api.exportSettings())}>{isZh?'导出':'Export'}</button><button className="glass-button" type="button" onClick={()=>void (async()=>{const result=await api.importSettings(); setStatus(isZh?result.messageZh??'':result.message??''); if(result.success&&result.settings) onChange(result.settings); refresh();})()}>{isZh?'导入':'Import'}</button></div></SettingRow>
    <SettingRow title={isZh ? '清除事件历史' : 'Clear Event History'} description={isZh ? '不影响设置、规则和安装报告。' : 'Does not change settings, rules, or installation reports.'}><button className="danger-button" type="button" onClick={() => { if (window.confirm(isZh ? '确定清除全部事件历史？此操作无法撤销。' : 'Clear all event history? This cannot be undone.')) void run(()=>api.clearEvents()); }}>{isZh ? '清除历史' : 'Clear history'}</button></SettingRow>
    <SettingRow title={isZh ? '清除安装报告' : 'Clear Reports'} description={isZh ? '删除安装会话报告，不影响事件和规则。' : 'Deletes installation session reports without changing events or rules.'}><button className="danger-button" type="button" onClick={()=>{if(window.confirm(isZh?'确定清除全部安装报告？':'Clear all installation reports?')) void run(()=>api.clearReports());}}>{isZh?'清除报告':'Clear reports'}</button></SettingRow>
    <SettingRow title={isZh ? '重置数据库' : 'Reset Database'} description={isZh ? '删除事件、报告和规则；不会重置设置。' : 'Deletes events, reports, and rules; settings remain unchanged.'}><button className="danger-button" type="button" onClick={()=>{if(window.confirm(isZh?'重置本地数据库？事件、报告和规则将永久删除。':'Reset the local database? Events, reports, and rules will be permanently deleted.')) void run(()=>api.resetDatabase());}}>{isZh?'重置数据库':'Reset database'}</button></SettingRow>
    {status ? <p className="inline-status">{status}</p> : null}
  </SettingCard>;
}

const formatBytes = (value: number) => value >= 1024*1024 ? `${(value/1024/1024).toFixed(1)} MB` : `${Math.round(value/1024)} KB`;

function StandardContent({ section, settings, onChange }: SettingsContentProps & { section: SectionId }) {
  const isZh = zh(settings);
  const title = text(sections.find((item) => item.id === section)?.key ?? section, settings.locale);
  const Icon = sections.find((item) => item.id === section)?.icon ?? Settings2;
  const monitorRows: Array<[string, string, keyof AppSettings]> = [
    [isZh ? '文件系统监控' : 'File Monitoring', isZh ? '记录可访问路径的文件元数据变化，不读取文件正文。' : 'Records metadata changes in accessible paths without reading file contents.', 'fileMonitoring'],
    [isZh ? '进程监控' : 'Process Monitoring', isZh ? '观察当前用户可见的进程启动与退出。' : 'Observes process starts and exits visible to the current user.', 'processMonitoring'],
    [isZh ? '服务监控' : 'Service Monitoring', isZh ? '只读观察 Windows 服务状态和权限。' : 'Read-only observation of Windows services and permissions.', 'serviceMonitoring'],
    [isZh ? '自启动监控' : 'Startup Monitoring', isZh ? '检测当前用户启动项的新增与变化。' : 'Detects additions and changes to user startup entries.', 'startupMonitoring'],
    [isZh ? '注册表监控' : 'Registry Monitoring', isZh ? '实时比较当前用户可读取的关键配置区域。' : 'Continuously compares important readable current-user configuration.', 'registryMonitoring'],
    [isZh ? '浏览器监控' : 'Browser Monitoring', isZh ? '仅观察配置变化，不读取密码、Cookie 或历史正文。' : 'Configuration changes only; never passwords, cookies, or history content.', 'browserMonitoring'],
    [isZh ? 'Windows Update 活动' : 'Windows Update Activity', isZh ? '观察可读取的更新活动，不强制停止系统组件。' : 'Observes readable update activity and never force-stops system components.', 'updateMonitoring'],
    [isZh ? '网络设置变化' : 'Network Change Monitoring', isZh ? '观察代理、DNS 与 Hosts 元数据等可读取配置。' : 'Observes readable proxy, DNS, and Hosts metadata.', 'networkMonitoring'],
  ];
  let body: ReactNode;
  if (section === 'general') body = <SettingCard title={isZh ? '应用行为' : 'Application behavior'}>
    <SettingRow title={isZh ? '登录 Windows 后启动 TraceGuard' : 'Launch at Windows Sign-in'} description={isZh ? '仅使用当前用户登录启动，不请求管理员权限。' : 'Uses current-user sign-in launch only; no elevation.'}><Toggle checked={settings.launchAtSignIn} onChange={(launchAtSignIn) => onChange({ launchAtSignIn })} /></SettingRow>
    <SettingRow title={isZh ? '启动后最小化' : 'Start Minimized'} description={isZh ? '启动时不打开完整控制台。' : 'Do not open the full console at launch.'}><Toggle checked={settings.startMinimized} onChange={(startMinimized) => onChange({ startMinimized })} /></SettingRow>
    <SettingRow title={isZh ? '启动模式' : 'Start in'} description={isZh ? '选择应用启动后首先显示的界面。' : 'Choose the first surface shown at launch.'}><Choices value={settings.startSurface} options={[{value:'console',label:isZh?'主窗口':'Console'},{value:'widget',label:isZh?'悬浮窗':'Widget'},{value:'bubble',label:isZh?'悬浮球':'Bubble'},{value:'tray',label:isZh?'托盘':'Tray'}]} onChange={(startSurface)=>onChange({startSurface})}/></SettingRow>
    <SettingRow title={isZh ? '关闭按钮行为' : 'Close Button Behavior'} description={isZh ? '关闭主窗口时保留后台监控或退出。' : 'Keep monitoring in the background or exit.'}><Choices value={settings.closeBehavior} options={[{value:'tray',label:isZh?'最小化到托盘':'To tray'},{value:'bubble',label:isZh?'最小化到悬浮球':'To bubble'},{value:'exit',label:isZh?'退出应用':'Exit'}]} onChange={(closeBehavior)=>onChange({closeBehavior})}/></SettingRow>
    <SettingRow title={isZh ? '记住窗口位置' : 'Remember Window Position'} description={isZh ? '在多显示器布局中恢复最近位置。' : 'Restores the last position across monitor layouts.'}><Toggle checked={settings.rememberWindowPosition} onChange={(rememberWindowPosition)=>onChange({rememberWindowPosition})}/></SettingRow>
    <SettingRow title={isZh ? '记住窗口大小' : 'Remember Window Size'} description={isZh ? '恢复主窗口和独立终端大小。' : 'Restores main and terminal window sizes.'}><Toggle checked={settings.rememberWindowSize} onChange={(rememberWindowSize)=>onChange({rememberWindowSize})}/></SettingRow>
    <SettingRow title={isZh ? '恢复上次页面' : 'Restore Last Page'} description={isZh ? '重新打开时回到最近使用的一级页面。' : 'Return to the most recently used primary page.'}><Toggle checked={settings.restoreLastPage} onChange={(restoreLastPage) => onChange({ restoreLastPage })} /></SettingRow>
  </SettingCard>;
  else if (section === 'language') body = <SettingCard title={isZh ? '界面语言' : 'Interface language'} subtitle={isZh ? '切换后立即应用，原始 Windows 字段保持不翻译。' : 'Applies immediately; raw Windows fields remain unchanged.'}><Choices value={settings.locale} options={[{ value: 'auto', label: text('automatic', settings.locale) }, { value: 'en-US', label: 'English' }, { value: 'zh-CN', label: '简体中文' }]} onChange={(locale) => onChange({ locale })} /></SettingCard>;
  else if (section === 'monitoring') body = <><SettingCard title={isZh ? '监控模块' : 'Monitoring modules'}>{monitorRows.map(([label, description, key]) => <SettingRow key={key} title={label} description={description}><Toggle checked={Boolean(settings[key])} onChange={(value) => onChange({ [key]: value })} /></SettingRow>)}</SettingCard><SettingCard title={isZh ? '监控范围' : 'Monitoring scope'}><SettingRow title={isZh ? '完整磁盘监控' : 'Full Disk Monitoring'} description={isZh ? '监控所有可访问本地磁盘，可能增加少量 CPU 与磁盘使用。' : 'Monitors accessible local drives and may slightly increase CPU and disk use.'}><Toggle checked={settings.fullDiskMonitoring} onChange={(fullDiskMonitoring) => onChange({ fullDiskMonitoring })} /></SettingRow></SettingCard></>;
  else if (section === 'floatingWindow') body = <SettingCard title={isZh ? '悬浮信息面板' : 'Floating widget'}>
    <SettingRow title={isZh ? '启用悬浮窗' : 'Floating Widget Enabled'} description={isZh ? '显示实时活动摘要。' : 'Shows a compact live activity summary.'}><Toggle checked={settings.floatingWidgetEnabled} onChange={(floatingWidgetEnabled) => onChange({ floatingWidgetEnabled })} /></SettingRow>
    <SettingRow title={isZh ? '始终置顶' : 'Always on Top'} description={isZh ? '让悬浮窗保持在其它窗口上方。' : 'Keeps the widget above other windows.'}><Toggle checked={settings.alwaysOnTop} onChange={(alwaysOnTop) => onChange({ alwaysOnTop })} /></SettingRow>
    <SettingRow title={isZh ? '鼠标穿透' : 'Click Through'} description={isZh ? '高级功能；按 Ctrl+Shift+T 可恢复交互。' : 'Advanced; Ctrl+Shift+T restores interaction.'}><Toggle checked={settings.clickThrough} onChange={(clickThrough) => onChange({ clickThrough })} /></SettingRow>
    <SettingRow title={isZh ? '不透明度' : 'Opacity'} description={isZh ? '保持桌面内容可见。' : 'Keeps desktop content visible.'}><div className="slider-row compact"><input type="range" min="55" max="100" value={settings.widgetOpacity} onChange={(event) => onChange({ widgetOpacity: Number(event.target.value) })} /><output>{settings.widgetOpacity}%</output></div></SettingRow>
    <SettingRow title={isZh ? '悬浮窗尺寸' : 'Widget Size'} description={isZh ? '控制信息密度和窗口尺寸。' : 'Controls information density and window size.'}><Choices value={settings.widgetSize} options={[{value:'compact',label:isZh?'紧凑':'Compact'},{value:'standard',label:isZh?'标准':'Standard'},{value:'large',label:isZh?'大':'Large'}]} onChange={(widgetSize)=>onChange({widgetSize})}/></SettingRow>
    <SettingRow title={isZh ? '刷新频率' : 'Refresh Rate'} description={isZh ? '默认 1 秒，低功耗模式会自动降低。' : 'Defaults to 1 second and slows in Low Power Mode.'}><Choices value={settings.widgetRefreshMs} options={[{value:500,label:'500ms'},{value:1000,label:'1s'},{value:2000,label:'2s'}]} onChange={(widgetRefreshMs)=>onChange({widgetRefreshMs})}/></SettingRow>
    <SettingRow title={isZh ? '自动收缩' : 'Auto Collapse'} description={isZh ? '悬浮窗长时间未交互时缩成悬浮球。' : 'Collapses the idle widget into the status orb.'}><Toggle checked={settings.autoCollapse} onChange={(autoCollapse)=>onChange({autoCollapse})}/></SettingRow>
    <SettingRow title={isZh ? '吸附屏幕边缘' : 'Edge Snap'} description={isZh ? '拖动结束后吸附最近屏幕边缘。' : 'Snaps to the nearest display edge after dragging.'}><Toggle checked={settings.edgeSnap} onChange={(edgeSnap)=>onChange({edgeSnap})}/></SettingRow>
    <SettingRow title={isZh ? '记住位置' : 'Remember Position'} description={isZh ? '按显示器分别恢复悬浮窗位置。' : 'Restores the widget position on the active display.'}><Toggle checked={settings.rememberWidgetPosition} onChange={(rememberWidgetPosition)=>onChange({rememberWidgetPosition})}/></SettingRow>
  </SettingCard>;
  else if (section === 'floatingBubble') body = <SettingCard title={isZh ? 'TG 悬浮球' : 'TG status orb'}>
    <SettingRow title={isZh ? '尺寸' : 'Bubble Size'} description={isZh ? '调整状态球的桌面占用。' : 'Adjusts the orb footprint.'}><Choices value={settings.bubbleSize} options={[{ value: 'small', label: isZh ? '小' : 'Small' }, { value: 'medium', label: isZh ? '中' : 'Medium' }, { value: 'large', label: isZh ? '大' : 'Large' }]} onChange={(bubbleSize) => onChange({ bubbleSize })} /></SettingRow>
    <SettingRow title={isZh ? '球体标签' : 'Bubble Label'} description={isZh ? '显示 TG 字样或仅显示状态图标。' : 'Shows TG lettering or the status icon only.'}><Choices value={settings.bubbleLabel} options={[{value:'tg',label:'TG'},{value:'icon',label:isZh?'仅图标':'Icon only'}]} onChange={(bubbleLabel)=>onChange({bubbleLabel})}/></SettingRow>
    <SettingRow title={isZh ? '显示警告数量' : 'Show Badge Count'} description={isZh ? '重要变化时显示克制的小型徽章。' : 'Shows a restrained badge for important changes.'}><Toggle checked={settings.showBadgeCount} onChange={(showBadgeCount) => onChange({ showBadgeCount })} /></SettingRow>
    <SettingRow title={isZh ? '显示更新状态' : 'Show Update Status'} description={isZh ? 'Windows Update 活跃时显示旋转状态。' : 'Shows update activity on the orb.'}><Toggle checked={settings.showUpdateStatus} onChange={(showUpdateStatus)=>onChange({showUpdateStatus})}/></SettingRow>
    <SettingRow title={isZh ? '显示安装监控状态' : 'Show Recording Status'} description={isZh ? '监控安装程序时显示 REC。' : 'Shows REC while an installer is monitored.'}><Toggle checked={settings.showRecordingStatus} onChange={(showRecordingStatus)=>onChange({showRecordingStatus})}/></SettingRow>
    <SettingRow title={isZh ? '悬停预览' : 'Hover Preview'} description={isZh ? '悬停后显示监控摘要。' : 'Shows a monitoring summary after hovering.'}><Toggle checked={settings.hoverPreview} onChange={(hoverPreview) => onChange({ hoverPreview })} /></SettingRow>
    <SettingRow title={isZh ? '悬停延迟' : 'Hover Delay'} description={isZh ? '控制预览面板出现速度。' : 'Controls how quickly the preview appears.'}><Choices value={settings.hoverDelayMs} options={[{value:0,label:isZh?'立即':'Instant'},{value:300,label:'300ms'},{value:500,label:'500ms'},{value:800,label:'800ms'}]} onChange={(hoverDelayMs)=>onChange({hoverDelayMs})}/></SettingRow>
    <SettingRow title={isZh ? '单击操作' : 'Single Click Action'} description={isZh ? '选择单击悬浮球打开的界面。' : 'Choose the surface opened by one click.'}><Choices value={settings.bubbleSingleClickAction} options={[{value:'panel',label:isZh?'快捷面板':'Quick panel'},{value:'terminal',label:isZh?'终端':'Terminal'},{value:'console',label:isZh?'主窗口':'Console'}]} onChange={(bubbleSingleClickAction)=>onChange({bubbleSingleClickAction})}/></SettingRow>
    <SettingRow title={isZh ? '双击操作' : 'Double Click Action'} description={isZh ? '双击默认打开完整主窗口。' : 'Double-click opens the selected full surface.'}><Choices value={settings.bubbleDoubleClickAction} options={[{value:'console',label:isZh?'主窗口':'Console'},{value:'terminal',label:isZh?'终端':'Terminal'}]} onChange={(bubbleDoubleClickAction)=>onChange({bubbleDoubleClickAction})}/></SettingRow>
  </SettingCard>;
  else if (section === 'liveTerminal') body = <SettingCard title={isZh ? '终端显示' : 'Terminal display'}>
    <SettingRow title={isZh ? '默认模式' : 'Default Mode'} description={isZh ? '简易模式解释行为，原始模式保留技术字段。' : 'Easy explains activity; Raw preserves technical fields.'}><Choices value={settings.terminalMode} options={[{ value: 'easy', label: text('easy', settings.locale) }, { value: 'raw', label: text('raw', settings.locale) }]} onChange={(terminalMode) => onChange({ terminalMode })} /></SettingRow>
    <SettingRow title={isZh ? '自动滚动' : 'Auto Scroll'} description={isZh ? '新事件到达时跟随最新内容。' : 'Follows the newest event as it arrives.'}><Toggle checked={settings.terminalAutoScroll} onChange={(terminalAutoScroll) => onChange({ terminalAutoScroll })} /></SettingRow>
    <SettingRow title={isZh ? '毫秒时间戳' : 'Millisecond timestamps'} description="HH:mm:ss.fff"><Toggle checked={settings.terminalTimestampMilliseconds} onChange={(terminalTimestampMilliseconds) => onChange({ terminalTimestampMilliseconds })} /></SettingRow>
    <SettingRow title={isZh ? '最大可见行数' : 'Maximum Visible Rows'} description={isZh ? '限制界面内存，不影响 SQLite 事件历史。' : 'Limits UI memory without changing SQLite history.'}><Choices value={settings.terminalMaxRows} options={[{value:250,label:'250'},{value:500,label:'500'},{value:1000,label:'1,000'},{value:2000,label:'2,000'}]} onChange={(terminalMaxRows)=>onChange({terminalMaxRows})}/></SettingRow>
  </SettingCard>;
  else if (section === 'notifications') {
    const notificationRows: Array<[string,string,keyof AppSettings]> = [
      [isZh?'重要系统变化':'Important System Change',isZh?'重要或严重级别的系统配置变化。':'Important or critical system configuration changes.','notifySystemChange'],
      [isZh?'新启动项':'New Startup Item',isZh?'检测到登录启动入口新增。':'A new sign-in startup entry is detected.','notifyStartup'],
      [isZh?'新服务':'New Service Detected',isZh?'检测到新的 Windows 服务。':'A new Windows service becomes visible.','notifyService'],
      [isZh?'浏览器设置变化':'Browser Setting Changed',isZh?'主页、搜索、策略或扩展变化。':'Homepage, search, policy, or extension changes.','notifyBrowser'],
      [isZh?'阻止自动重启':'Blocked Auto-Restart',isZh?'用户规则成功停止自动启动进程。':'A user rule stops an automatically started process.','notifyBlockedRestart'],
      [isZh?'安装监控完成':'Installer Monitoring Completed',isZh?'安装行为报告准备完成。':'The installation behavior report is ready.','notifyInstallerComplete'],
      ['Windows Update',isZh?'更新活动状态发生变化。':'Update activity state changes.','notifyWindowsUpdate'],
      [isZh?'用户文件被修改':'User Files Modified',isZh?'桌面、文档或图片目录发生变化。':'Desktop, Documents, or Pictures changed.','notifyUserFiles'],
    ];
    body = <SettingCard title={isZh ? '通知级别' : 'Notification level'}><Choices value={settings.notificationLevel} options={[{ value: 'all', label: isZh ? '全部' : 'All' }, { value: 'important', label: isZh ? '仅重要' : 'Important' }, { value: 'critical', label: isZh ? '仅严重' : 'Critical' }, { value: 'off', label: text('off', settings.locale) }]} onChange={(notificationLevel) => onChange({ notificationLevel })} />{notificationRows.map(([title,description,key])=><SettingRow key={key} title={title} description={description}><Toggle checked={Boolean(settings[key])} onChange={(value)=>onChange({[key]:value})}/></SettingRow>)}<SettingRow title={isZh ? '系统通知声音' : 'System notification sound'} description={isZh ? '使用 Windows 默认声音，不附带自定义音效。' : 'Uses the Windows default sound; no bundled audio.'}><Toggle checked={settings.notificationSound} onChange={(notificationSound) => onChange({ notificationSound })} /></SettingRow></SettingCard>;
  }
  else if (section === 'startupBackground') body = <SettingCard title={isZh ? '后台行为' : 'Background behavior'}><SettingRow title={isZh ? '关闭主窗口后继续监控' : 'Keep Monitoring When Closed'} description={isZh ? '默认开启；关闭窗口不停止核心事件采集。' : 'Enabled by default; closing the window does not stop core collection.'}><Toggle checked={settings.keepMonitoringOnClose} onChange={(keepMonitoringOnClose) => onChange({ keepMonitoringOnClose })} /></SettingRow><SettingRow title={isZh ? '低功耗模式' : 'Low Power Mode'} description={isZh ? '降低刷新率，保持核心采集。' : 'Reduces UI refresh rate while preserving core collection.'}><Toggle checked={settings.lowPowerMode} onChange={(lowPowerMode) => onChange({ lowPowerMode })} /></SettingRow><SettingRow title={isZh ? '电池供电时暂停非核心监控' : 'Pause Non-core Monitoring on Battery'} description={isZh ? '保留进程与关键变化采集，并降低高开销观察频率。' : 'Preserves core events while reducing expensive observations.'}><Toggle checked={settings.pauseOnBattery} onChange={(pauseOnBattery)=>onChange({pauseOnBattery})}/></SettingRow></SettingCard>;
  else if (section === 'privacy') body = <><div className="privacy-banner"><ShieldCheck size={22} /><div><strong>{isZh ? '本机处理 · 无遥测' : 'Local processing · No telemetry'}</strong><span>{isZh ? 'TraceGuard 不会发送遥测，也不会读取文件正文、密码、Cookie 或浏览历史正文。' : 'TraceGuard sends no telemetry and never reads file contents, passwords, cookies, or browsing-history content.'}</span></div></div><SettingCard title={isZh ? '数据最小化' : 'Data minimization'}><SettingRow title={isZh ? '保存文件路径' : 'Store File Paths'} description={isZh ? '关闭后仅保存匿名摘要；事件解释会减少。' : 'When off, stores anonymized summaries and reduces event detail.'}><Toggle checked={settings.storeFilePaths} onChange={(storeFilePaths) => onChange({ storeFilePaths })} /></SettingRow></SettingCard></>;
  else if (section === 'storage') body = <StorageContent settings={settings} onChange={onChange}/>;
  else if (section === 'protection') body = <><div className="coreguard-banner"><ShieldCheck size={25} /><div><strong>CoreGuard</strong><span>{isZh ? '防止 TraceGuard 对关键 Windows 核心组件执行危险操作。此保护不可关闭。' : 'Protects critical Windows components from destructive TraceGuard actions. It cannot be disabled.'}</span></div><span className="locked-pill">{isZh ? '始终开启' : 'Always on'}</span></div><SettingCard title={isZh ? '操作确认' : 'Action confirmations'}><SettingRow title={isZh ? '停止进程前警告' : 'Warn Before Stopping Process'} description={isZh ? '对允许控制的普通进程显示确认。' : 'Confirms actions on controllable standard processes.'}><Toggle checked={settings.warnBeforeStopping} onChange={(warnBeforeStopping) => onChange({ warnBeforeStopping })} /></SettingRow><SettingRow title={isZh?'禁用启动项前警告':'Warn Before Disabling Startup'} description={isZh?'修改当前用户启动入口前确认。':'Confirms before changing a current-user startup entry.'}><Toggle checked={settings.warnBeforeDisablingStartup} onChange={(warnBeforeDisablingStartup)=>onChange({warnBeforeDisablingStartup})}/></SettingRow><SettingRow title={isZh ? '恢复操作确认' : 'Confirm Restore Operations'} description={isZh ? '在修改用户级配置前请求确认。' : 'Confirms before changing user-level configuration.'}><Toggle checked={settings.confirmRestore} onChange={(confirmRestore) => onChange({ confirmRestore })} /></SettingRow><SettingRow title={isZh?'创建规则前确认':'Confirm Rule Creation'} description={isZh?'创建自动阻止规则前显示确认。':'Confirms before creating an automatic blocking rule.'}><Toggle checked={settings.confirmRuleCreation} onChange={(confirmRuleCreation)=>onChange({confirmRuleCreation})}/></SettingRow></SettingCard></>;
  else if (section === 'advanced') body = <><div className="advanced-warning"><Bot size={21} /><span>{isZh ? '高级设置可能影响 TraceGuard 的行为，建议普通用户保持默认值。' : 'Advanced settings can change TraceGuard behavior. Default values are recommended.'}</span></div><SettingCard title={isZh ? '采集能力状态' : 'Collection capability status'}><SettingRow title="FileSystemWatcher" description={isZh?'已启用元数据变化监控；不读取文件正文。':'Active metadata change monitoring; file contents are never read.'}><span className="local-pill">{isZh?'已启用':'Active'}</span></SettingRow><SettingRow title="USN Journal / ETW" description={isZh?'零提权模式会在权限不足时安全降级，不提供虚假开关。':'Zero-Privilege Mode degrades safely when access is unavailable; no fake control is exposed.'}><span className="locked-pill">{isZh?'安全降级':'Safe fallback'}</span></SettingRow></SettingCard></>;
  else body = <SettingCard title="TraceGuard 1.0.0"><div className="about-mark"><span className="brand-shield">TG</span><div><strong>See what changed.</strong><span>Understand why. Control what you own.</span><small>Windows 10 / 11 · Zero-Privilege · Local First</small></div></div></SettingCard>;
  return <><div className="settings-heading"><span className="heading-orb"><Icon size={19} /></span><div><h2>{title}</h2><small>{secondaryText(sections.find((item) => item.id === section)?.key ?? section, settings.locale)}</small></div></div><div className="settings-stack">{body}</div></>;
}

export function SettingsPage({ settings, onChange }: SettingsContentProps) {
  const [section, setSection] = useState<SectionId>('appearance');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const visibleSections = useMemo(() => sections.filter((item) => !deferred || `${item.search} ${text(item.key, settings.locale)} ${secondaryText(item.key, settings.locale)}`.toLowerCase().includes(deferred)), [deferred, settings.locale]);
  const restoreSection = () => {
    const patch: Partial<AppSettings> = {};
    for (const key of sectionDefaults[section]) (patch as Record<string, unknown>)[key] = defaultSettings[key];
    onChange(patch);
  };
  return <div className="settings-page">
    <aside className="settings-sidebar panel">
      <label className="settings-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('searchSettings', settings.locale)} /></label>
      <nav>{visibleSections.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => setSection(item.id)}><Icon size={16} /><span><strong>{text(item.key, settings.locale)}</strong><small>{secondaryText(item.key, settings.locale)}</small></span></button>; })}</nav>
      <div className="settings-safe"><ShieldCheck size={16} /><span><strong>Zero-Privilege</strong><small>{zh(settings) ? '所有设置均不请求提权' : 'Settings never request elevation'}</small></span></div>
    </aside>
    <div className="settings-content">
      {section === 'appearance' ? <Appearance settings={settings} onChange={onChange} /> : <StandardContent section={section} settings={settings} onChange={onChange} />}
      <footer className="settings-reset">
        <button type="button" disabled={sectionDefaults[section].length === 0} onClick={restoreSection}>{isChinese(settings.locale) ? '恢复此分类默认值' : 'Restore category defaults'}</button>
        <button type="button" onClick={() => { if (window.confirm(isChinese(settings.locale) ? '重置全部设置？事件历史、规则和报告不会被删除。' : 'Reset all settings? Event history, rules, and reports will not be deleted.')) onChange(defaultSettings); }}>{isChinese(settings.locale) ? '重置全部设置' : 'Reset all settings'}</button>
      </footer>
    </div>
  </div>;
}
