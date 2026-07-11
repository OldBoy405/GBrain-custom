import React from 'react';
import { ChevronRight } from 'lucide-react';

export function StatCard({
  value,
  label,
  accent,
  onClick,
}: {
  value: React.ReactNode;
  label: string;
  accent?: string;
  /** 提供后卡片变为可点击按钮，右上角出现 chevron 暗示，点击打开详情抽屉。 */
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="font-mono text-brain-stat font-medium leading-none text-ink" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-2 text-brain-sm text-muted">{label}</div>
    </>
  );

  if (!onClick) {
    return <div className="rounded-xl border border-hairline bg-surface px-5 py-4">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} · 查看详情`}
      className="group relative w-full cursor-pointer rounded-xl border border-hairline bg-surface px-5 py-4 text-left transition hover:border-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent/40"
    >
      <ChevronRight
        size={14}
        aria-hidden
        className="absolute right-3 top-3 text-muted transition group-hover:text-accent"
      />
      {body}
    </button>
  );
}
