import { ShieldCheck } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="TraceGuard">
      <span className="brand-mark"><ShieldCheck size={15} strokeWidth={2.2} /></span>
      {compact ? null : <strong>TraceGuard</strong>}
    </div>
  );
}

