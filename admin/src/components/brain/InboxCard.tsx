import { FileText } from 'lucide-react';
import type { InboxItem, SourceType } from '../../lib/op-types';
import { Badge } from './Badge';
import { SOURCE_ICON, sourceLabel, statusMeta } from './inbox-labels';

function timeStr(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 根据选中+勾选状态决定边框和背景样式。 */
function cardBorder(selected: boolean, checked: boolean): string {
  if (selected) return 'border-accent bg-accent-soft/40';
  if (checked) return 'border-amber bg-amber/15';
  return 'border-hairline bg-elevated hover:border-emphasis hover:bg-subtle';
}

export function InboxCard({
  item,
  selected,
  checked,
  onSelect,
  onCheck,
}: {
  item: InboxItem;
  selected: boolean;
  checked: boolean;
  onSelect: (slug: string) => void;
  onCheck: (slug: string, v: boolean) => void;
}) {
  const source = (item.source_kind ?? 'unknown') as SourceType;
  const Icon = SOURCE_ICON[source] ?? FileText;
  const label = sourceLabel(source);
  const meta = statusMeta(item.status);
  const t = timeStr(item.updated_at);
  const merging = item.status === 'merging';

  return (
    <button
      type="button"
      onClick={() => onSelect(item.slug)}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition ${cardBorder(selected, checked)}`}
    >
      {/* 勾选框：阻止冒泡，避免触发卡片选中 */}
      <label
        className="shrink-0 pt-0.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
        title={merging ? '合并中的条目暂不可勾选' : undefined}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={merging}
          onChange={(e) => onCheck(item.slug, e.target.checked)}
          className="cursor-pointer disabled:cursor-not-allowed"
          style={{ accentColor: 'var(--color-accent)' }}
        />
      </label>

      {/* 来源图标 */}
      <span className="shrink-0 rounded p-1 border border-hairline" style={{ background: 'var(--color-canvas)' }}>
        <Icon size={12} style={{ color: 'var(--color-ink-soft)' }} aria-label={label} />
      </span>

      {/* 正文 */}
      <div className="min-w-0 flex-1">
        {/* 顶行：来源标签 + 时间 */}
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="font-mono text-brain-2xs uppercase tracking-wider text-muted">{label}</span>
          {t && <span className="shrink-0 font-mono text-brain-2xs text-muted">{t}</span>}
        </div>

        {/* 标题（两行截断） */}
        <div className="text-brain-base leading-snug text-ink line-clamp-2">
          {item.title || item.preview || <span className="text-muted">（无标题）</span>}
        </div>

        {/* 底行：状态 + Tier */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {item.tier && (
            <span className="shrink-0 font-mono text-brain-2xs text-muted">tier {item.tier}</span>
          )}
        </div>
      </div>
    </button>
  );
}
