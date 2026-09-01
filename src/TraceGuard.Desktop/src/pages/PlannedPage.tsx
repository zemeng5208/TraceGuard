import { Construction, Settings2 } from 'lucide-react';
import { isChinese, secondaryText, text } from '@/i18n';
import type { PageId } from '@/components/Sidebar';
import type { AppSettings } from '@/types';

const keyMap: Record<Exclude<PageId, 'dashboard' | 'terminal' | 'processes' | 'services' | 'startup' | 'settings'>, string> = {
  disk: 'disk', browser: 'browser', network: 'network', update: 'windowsUpdate', files: 'files', registry: 'registry', rules: 'rules', restore: 'restore',
};

export function PlannedPage({ page, settings }: { page: Exclude<PageId, 'dashboard' | 'terminal' | 'processes' | 'services' | 'startup' | 'settings'>; settings: AppSettings }) {
  const key = keyMap[page];
  return <section className="planned-page panel"><span className="planned-icon"><Construction size={34} /></span><h2>{text(key, settings.locale)}</h2><p>{text('phasePlanned', settings.locale)}</p><small>{secondaryText(key, settings.locale)}</small><button type="button" disabled><Settings2 size={16} />{isChinese(settings.locale) ? '此页面不会显示虚假控制项' : 'No placeholder controls are exposed'}</button></section>;
}
