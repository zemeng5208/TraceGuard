import { LockKeyhole, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { AppSettings } from '@/types';
import { isChinese } from '@/i18n';

export function PermissionBadge({ permission, settings }: { permission: 'controllable' | 'observable' | 'protected'; settings: AppSettings }) {
  const Icon = permission === 'controllable' ? ShieldCheck : permission === 'protected' ? LockKeyhole : ShieldQuestion;
  const labels = {
    controllable: isChinese(settings.locale) ? '可控制' : 'Controllable',
    observable: isChinese(settings.locale) ? '仅观察' : 'Observable',
    protected: isChinese(settings.locale) ? '核心保护' : 'Protected',
  };
  return <span className={`permission permission-${permission}`}><Icon size={13} />{labels[permission]}</span>;
}

export function EmptyTable({ settings }: { settings: AppSettings }) {
  return <div className="empty-table">{isChinese(settings.locale) ? '当前没有可显示的数据' : 'No data is currently available'}</div>;
}
