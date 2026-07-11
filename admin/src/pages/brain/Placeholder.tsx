import { Construction } from 'lucide-react';

/**
 * Brain 表层未实现页的统一占位。骨架阶段(P1)用于验证布局/路由/主题；
 * 各页真实内容在 P2–P4 分批落地（见 admin/docs/FRONTEND_PLAN.zh.md §3.2 优先级）。
 */
export function BrainPlaceholder({ title, phase, note }: { title: string; phase: string; note: string }) {
  return (
    <div className="brain-page-placeholder">
      <h1 className="type-serif text-brain-3xl font-semibold text-ink">{title}</h1>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-hairline bg-surface px-5 py-4">
        <Construction size={18} className="text-amber" aria-hidden />
        <div>
          <div className="text-brain-md text-ink">该页面骨架就绪，数据接入排期 {phase}</div>
          <div className="mt-0.5 text-brain-base text-muted">{note}</div>
        </div>
      </div>
    </div>
  );
}
