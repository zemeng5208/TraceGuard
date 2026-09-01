import type { Locale } from '@/types';

type Copy = { en: string; zh: string };

export const copy: Record<string, Copy> = {
  dashboard: { en: 'Dashboard', zh: '仪表盘' },
  liveTerminal: { en: 'Live Terminal', zh: '实时终端' },
  applications: { en: 'Applications', zh: '应用报告' },
  processes: { en: 'Processes', zh: '进程' },
  services: { en: 'Services', zh: '服务' },
  disk: { en: 'Disk', zh: '磁盘' },
  startup: { en: 'Startup', zh: '启动项' },
  browser: { en: 'Browser', zh: '浏览器' },
  network: { en: 'Network', zh: '网络' },
  windowsUpdate: { en: 'Windows Update', zh: 'Windows 更新' },
  files: { en: 'Files', zh: '文件' },
  registry: { en: 'Registry', zh: '注册表' },
  rules: { en: 'Rules', zh: '规则中心' },
  restore: { en: 'Restore Center', zh: '恢复中心' },
  settings: { en: 'Settings', zh: '设置' },
  systemOverview: { en: 'System Overview', zh: '系统概览' },
  fileChanges: { en: 'File Changes', zh: '文件变化' },
  registryChanges: { en: 'Registry Changes', zh: '注册表变化' },
  diskRead: { en: 'Disk Activity', zh: '磁盘活动' },
  networkSend: { en: 'Network Activity', zh: '网络活动' },
  liveActivity: { en: 'Live Activity', zh: '实时活动' },
  activeInstaller: { en: 'Active Installer', zh: '正在监控安装程序' },
  importantEvents: { en: 'Important Events', zh: '重要事件' },
  systemResources: { en: 'System Resources', zh: '系统资源' },
  viewReport: { en: 'View Report', zh: '查看报告' },
  monitoring: { en: 'Monitoring', zh: '监控中' },
  running: { en: 'Running', zh: '正在运行' },
  coreGuard: { en: 'CoreGuard enabled', zh: 'CoreGuard 已启用' },
  pause: { en: 'Pause View', zh: '暂停视图' },
  resume: { en: 'Resume', zh: '继续' },
  clear: { en: 'Clear View', zh: '清空视图' },
  search: { en: 'Search', zh: '搜索' },
  easy: { en: 'Easy', zh: '简易' },
  raw: { en: 'Raw', zh: '原始' },
  appearance: { en: 'Appearance', zh: '外观' },
  general: { en: 'General', zh: '常规' },
  language: { en: 'Language', zh: '语言' },
  floatingWindow: { en: 'Floating Window', zh: '悬浮窗' },
  floatingBubble: { en: 'Floating Bubble', zh: '悬浮球' },
  notifications: { en: 'Notifications', zh: '通知' },
  startupBackground: { en: 'Startup & Background', zh: '启动与后台' },
  privacy: { en: 'Privacy', zh: '隐私' },
  storage: { en: 'Storage', zh: '存储' },
  protection: { en: 'Protection', zh: '保护' },
  advanced: { en: 'Advanced', zh: '高级' },
  about: { en: 'About', zh: '关于' },
  searchSettings: { en: 'Search settings', zh: '搜索设置' },
  theme: { en: 'Theme', zh: '主题' },
  visualStyle: { en: 'Visual Style', zh: '视觉效果' },
  accentColor: { en: 'Accent Color', zh: '强调色' },
  transparency: { en: 'Window Transparency', zh: '窗口透明度' },
  density: { en: 'Interface Density', zh: '界面密度' },
  fontSize: { en: 'Font Size', zh: '字体大小' },
  animation: { en: 'Animation', zh: '动画效果' },
  sidebarStyle: { en: 'Sidebar Style', zh: '侧边栏样式' },
  automatic: { en: 'Automatic', zh: '自动' },
  light: { en: 'Light', zh: '浅色' },
  dark: { en: 'Dark', zh: '深色' },
  system: { en: 'System', zh: '跟随系统' },
  comfortable: { en: 'Comfortable', zh: '舒适' },
  compact: { en: 'Compact', zh: '紧凑' },
  on: { en: 'On', zh: '开启' },
  off: { en: 'Off', zh: '关闭' },
  requiresElevation: { en: 'Requires elevated permission. TraceGuard will not request administrator rights.', zh: '需要更高权限，TraceGuard 零提权模式不会请求管理员权限。' },
  protectedCore: { en: 'Protected Windows Core Component', zh: 'Windows 核心受保护组件' },
};

export const resolvedLocale = (locale: Locale): 'en-US' | 'zh-CN' => {
  if (locale !== 'auto') return locale;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
};

export const isChinese = (locale: Locale): boolean => resolvedLocale(locale) === 'zh-CN';

export const text = (key: string, locale: Locale): string => {
  const item = copy[key];
  if (!item) return key;
  return resolvedLocale(locale) === 'zh-CN' ? item.zh : item.en;
};

export const secondaryText = (key: string, locale: Locale): string => {
  const item = copy[key];
  if (!item) return '';
  return resolvedLocale(locale) === 'zh-CN' ? item.en : item.zh;
};
