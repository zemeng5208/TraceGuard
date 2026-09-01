import {
  Activity,
  AppWindow,
  BellRing,
  Blocks,
  FileClock,
  Gauge,
  Globe2,
  HardDrive,
  Network,
  PackageOpen,
  PackageSearch,
  Cpu,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import { secondaryText, text } from '@/i18n';
import type { AppSettings } from '@/types';

export type PageId =
  | 'dashboard'
  | 'terminal'
  | 'applications'
  | 'processes'
  | 'services'
  | 'disk'
  | 'startup'
  | 'browser'
  | 'network'
  | 'update'
  | 'files'
  | 'registry'
  | 'rules'
  | 'restore'
  | 'settings';

const items: Array<{ id: PageId; key: string; icon: typeof Gauge }> = [
  { id: 'dashboard', key: 'dashboard', icon: Gauge },
  { id: 'terminal', key: 'liveTerminal', icon: ScrollText },
  { id: 'applications', key: 'applications', icon: PackageSearch },
  { id: 'processes', key: 'processes', icon: Cpu },
  { id: 'services', key: 'services', icon: Blocks },
  { id: 'disk', key: 'disk', icon: HardDrive },
  { id: 'network', key: 'network', icon: Network },
  { id: 'update', key: 'windowsUpdate', icon: RotateCcw },
  { id: 'files', key: 'files', icon: AppWindow },
  { id: 'registry', key: 'registry', icon: FileClock },
  { id: 'startup', key: 'startup', icon: BellRing },
  { id: 'browser', key: 'browser', icon: Globe2 },
  { id: 'rules', key: 'rules', icon: ShieldCheck },
  { id: 'restore', key: 'restore', icon: PackageOpen },
  { id: 'settings', key: 'settings', icon: Settings },
];

interface SidebarProps {
  active: PageId;
  onSelect: (page: PageId) => void;
  settings: AppSettings;
}

export function Sidebar({ active, onSelect, settings }: SidebarProps) {
  const compact = settings.sidebar === 'compact';
  return (
    <aside className={`sidebar ${compact ? 'sidebar--compact' : ''}`}>
      <Brand compact={compact} />
      <nav className="nav-list" aria-label="Primary navigation">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${active === item.id ? 'is-active' : ''}`}
              onClick={() => onSelect(item.id)}
              title={compact ? text(item.key, settings.locale) : undefined}
            >
              <Icon size={17} strokeWidth={1.8} />
              {compact ? null : (
                <span>
                  <b>{text(item.key, settings.locale)}</b>
                  <small>{secondaryText(item.key, settings.locale)}</small>
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="coreguard-status">
          <ShieldCheck size={16} />
          {compact ? null : <span><b>CoreGuard</b><small>● {text('on', settings.locale)}</small></span>}
        </div>
        {compact ? null : <div className="version-row"><span>v0.2.0</span><span>Phase 2</span></div>}
      </div>
    </aside>
  );
}
