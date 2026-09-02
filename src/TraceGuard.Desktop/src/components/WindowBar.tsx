import { Maximize2, Minus, Settings2, X } from 'lucide-react';
import { traceGuardApi } from '@/bridge';
import { secondaryText, text } from '@/i18n';
import type { AppSettings } from '@/types';
import type { PageId } from '@/components/Sidebar';

const pageKeys: Record<PageId, string> = {
  dashboard: 'dashboard', terminal: 'liveTerminal', applications: 'applications', processes: 'processes', services: 'services', startup: 'startup',
  disk: 'disk', browser: 'browser', network: 'network', update: 'windowsUpdate', files: 'files', registry: 'registry', rules: 'rules',
  restore: 'restore', settings: 'settings',
};

interface WindowBarProps {
  page: PageId;
  settings: AppSettings;
  onOpenSettings: () => void;
}

export function WindowBar({ page, settings, onOpenSettings }: WindowBarProps) {
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
          onClick={onOpenSettings}
        >
          <Settings2 size={14} />
          {text('settings', settings.locale)}
        </button>
        <span className="window-control-separator" />
        <button className="window-control" type="button" aria-label="Minimize" onClick={() => void api.windowAction('minimize')}><Minus size={14} /></button>
        <button className="window-control" type="button" aria-label="Maximize" onClick={() => void api.windowAction('maximize')}><Maximize2 size={12} /></button>
        <button className="window-control window-control--close" type="button" aria-label="Close" onClick={() => void api.windowAction('close')}><X size={14} /></button>
      </div>
    </header>
  );
}
