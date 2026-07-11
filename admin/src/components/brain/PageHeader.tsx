import React from 'react';

export function PageHeader({
  kicker,
  kickerMono,
  icon,
  title,
  subtitle,
  right,
}: {
  kicker?: string;
  /** Use `type-mono-tiny` kicker (e.g. `// 收件箱 · INBOX`) instead of section label. */
  kickerMono?: boolean;
  /** Optional icon rendered inline before the title (e.g. the page's nav icon). */
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        {kicker && (
          <div className={kickerMono ? 'type-mono-tiny mb-1' : 'type-section-label mb-1 tracking-widest'}>
            {kicker}
          </div>
        )}
        <h1 className="flex items-center gap-2 type-serif text-brain-4xl font-semibold leading-tight text-ink">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-brain-md text-ink-soft">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 pt-1">{right}</div>}
    </div>
  );
}
