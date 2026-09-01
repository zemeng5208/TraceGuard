import { EventTerminal } from '@/components/EventTerminal';
import type { AppSettings, TraceEvent } from '@/types';

export function TerminalPage({ events, settings }: { events: TraceEvent[]; settings: AppSettings }) {
  return <div className="terminal-page"><EventTerminal events={events} settings={settings} standalone /></div>;
}

