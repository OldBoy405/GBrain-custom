import React from 'react';

export type BadgeTone = 'accent' | 'amber' | 'coral' | 'ok' | 'contra' | 'muted' | 'synthesis';

const TONE_VAR: Record<BadgeTone, string> = {
  accent: '--color-accent',
  amber: '--color-amber',
  coral: '--color-coral',
  ok: '--color-ok',
  contra: '--color-contra',
  muted: '--color-muted',
  synthesis: '--color-node-synthesis',
};

export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  const color = `var(${TONE_VAR[tone]})`;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-brain-sm font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {children}
    </span>
  );
}
