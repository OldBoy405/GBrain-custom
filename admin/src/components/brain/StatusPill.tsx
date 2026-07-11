import type { SSEStatus } from '../../lib/useSSE';

const STATUS: Record<SSEStatus, { label: string; color: string }> = {
  connecting: { label: '连接中', color: 'var(--color-muted)' },
  connected: { label: '已连接', color: 'var(--color-ok)' },
  disconnected: { label: '断开', color: 'var(--color-contra)' },
};

export function StatusPill({ status }: { status: SSEStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-brain-sm" style={{ color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
