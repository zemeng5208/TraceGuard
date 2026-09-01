import { LockKeyhole, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { AppSettings } from '@/types';

export function PermissionBadge({ permission, settings }: { permission: 'controllable' | 'observable' | 'protected'; settings: AppSettings }) {
  const Icon = permission === 'controllable' ? ShieldCheck : permission === 'protected' ? LockKeyhole : ShieldQuestion;
  const labels = {
    controllable: settings.locale === 'zh-CN' ? '可控制' : 'Controllable',
    observable: settings.locale === 'zh-CN' ? '仅观察' : 'Observable',
    protected: settings.locale === 'zh-CN' ? '核心保护' : 'Protected',
  };
  return <span className={`permission permission-${permission}`}><Icon size={13} />{labels[permission]}</span>;
}

export function EmptyTable({ settings }: { settings: AppSettings }) {
  return <div className="empty-table">{settings.locale === 'zh-CN' ? '当前没有可显示的数据' : 'No data is currently available'}</div>;
}

