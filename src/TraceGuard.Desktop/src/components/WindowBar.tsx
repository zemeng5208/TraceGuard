import { ChevronDown, Maximize2, Minus, Moon, PanelTop, Sun, X } from 'lucide-react';
import { traceGuardApi } from '@/bridge';
import { isChinese, secondaryText, text } from '@/i18n';
import type { AppSettings } from '@/types';
import type { PageId } from '@/components/Sidebar';

const pageKeys: Record<PageId, string> = {
  dashboard: 'dashboard', terminal: 'liveTerminal', processes: 'processes', services: 'services', startup: 'startup',
  disk: 'disk', browser: 'browser', network: 'network', update: 'windowsUpdate', files: 'files', registry: 'registry', rules: 'rules',
  restore: 'restore', settings: 'settings',
};

interface WindowBarProps {
  page: PageId;
  settings: AppSettings;
  onSettings: (patch: Partial<AppSettings>) => void;
}

export function WindowBar({ page, settings, onSettings }: WindowBarProps) {
  const api = traceGuardApi();
  const key = pageKeys[page];
  return (
    <header className="window-bar">
      <div className="page-title">
        <h1>{text(key, settings.locale)}</h1>
        <span>{secondaryText(key, settings.locale)}</span>
      </div>
      <div className="window-actions">
        <button
          className="select-like"
          type="button"
          onClick={() => onSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        >
          {settings.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
          {text(settings.theme === 'dark' ? 'dark' : 'light', settings.locale)}
          <ChevronDown size={13} />
        </button>
        <button
          className="select-like"
          type="button"
          onClick={() => onSettings({ locale: isChinese(settings.locale) ? 'en-US' : 'zh-CN' })}
        >
          <PanelTop size={14} />
          {isChinese(settings.locale) ? '简体中文' : 'English'}
          <ChevronDown size={13} />
        </button>
        <span className="window-control-separator" />
        <button className="window-control" type="button" aria-label="Minimize" onClick={() => void api.windowAction('minimize')}><Minus size={14} /></button>
        <button className="window-control" type="button" aria-label="Maximize" onClick={() => void api.windowAction('maximize')}><Maximize2 size={12} /></button>
        <button className="window-control window-control--close" type="button" aria-label="Close" onClick={() => void api.windowAction('close')}><X size={14} /></button>
      </div>
    </header>
  );
}
