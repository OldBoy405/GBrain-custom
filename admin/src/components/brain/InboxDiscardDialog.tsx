import { useEffect, useState } from 'react';
import type { InboxItem } from '../../lib/op-types';

export type InboxDiscardMode = 'soft' | 'hard';

/**
 * 丢弃确认：软删除（可恢复）vs 永久删除。默认软删除，硬删除需额外勾选确认。
 */
export function InboxDiscardDialog({
  open,
  count,
  previewItems,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  previewItems: InboxItem[];
  busy?: boolean;
  /** 上次提交的失败原因。弹窗本身覆盖整个视口，失败时必须在此处可见——
   *  页面其余部分（包括 Inbox.tsx 工具栏里的 actionError）被遮罩挡住，
   *  不在此渲染会让用户误以为「点击没有反应」。 */
  error?: string | null;
  onCancel: () => void;
  onConfirm: (mode: InboxDiscardMode) => void;
}) {
  const [mode, setMode] = useState<InboxDiscardMode>('soft');
  const [hardAck, setHardAck] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('soft');
    setHardAck(false);
  }, [open]);

  if (!open) return null;

  const hardReady = mode === 'hard' && hardAck;
  const canConfirm = mode === 'soft' || hardReady;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-ink/25"
        aria-label="关闭"
        onClick={busy ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-discard-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-xl"
      >
        <h2 id="inbox-discard-title" className="type-serif text-brain-xl font-semibold text-ink">
          丢弃 {count} 条 inbox
        </h2>
        <p className="mt-2 text-brain-sm leading-relaxed text-ink-soft">
          选择删除方式。软删除会隐藏条目并在 72 小时内可通过 <span className="font-mono">restore_page</span>{' '}
          恢复；永久删除会立即清除页面及关联 chunks / 链接，不可恢复。
        </p>

        <fieldset className="mt-4 space-y-2 border-0 p-0">
          <legend className="sr-only">删除方式</legend>
          <label
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition ${
              mode === 'soft' ? 'border-accent bg-accent-soft/30' : 'border-hairline hover:border-emphasis'
            }`}
          >
            <input
              type="radio"
              name="discard-mode"
              checked={mode === 'soft'}
              onChange={() => setMode('soft')}
              className="mt-0.5"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span>
              <span className="block text-brain-base font-medium text-ink">软删除（推荐）</span>
              <span className="block text-brain-sm text-muted">72 小时内可恢复 · 图谱边保留在回收窗口内</span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition ${
              mode === 'hard' ? 'border-contra bg-contra/10' : 'border-hairline hover:border-emphasis'
            }`}
          >
            <input
              type="radio"
              name="discard-mode"
              checked={mode === 'hard'}
              onChange={() => setMode('hard')}
              className="mt-0.5"
              style={{ accentColor: 'var(--color-contra)' }}
            />
            <span>
              <span className="block text-brain-base font-medium text-ink">永久删除</span>
              <span className="block text-brain-sm text-muted">立即从大脑移除，无法撤销</span>
            </span>
          </label>
        </fieldset>

        {mode === 'hard' && (
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-brain-sm text-ink-soft">
            <input
              type="checkbox"
              checked={hardAck}
              onChange={(e) => setHardAck(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: 'var(--color-contra)' }}
            />
            我理解永久删除不可恢复，且会级联清除关联数据
          </label>
        )}

        {previewItems.length > 0 && (
          <ul className="mt-4 max-h-28 overflow-y-auto rounded-lg border border-hairline px-3 py-2 text-brain-sm text-ink-soft">
            {previewItems.map((item) => (
              <li key={item.slug} className="truncate font-mono text-brain-xs">
                {item.slug}
                {item.title ? ` · ${item.title}` : ''}
              </li>
            ))}
            {count > previewItems.length && (
              <li className="text-brain-xs text-muted">… 另有 {count - previewItems.length} 条</li>
            )}
          </ul>
        )}

        {error && (
          <p className="mt-3 text-brain-sm" style={{ color: 'var(--color-contra)' }}>
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-lg border border-hairline bg-transparent px-4 py-2 text-brain-base text-ink-soft hover:bg-hairline/40 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => canConfirm && onConfirm(mode)}
            disabled={busy || !canConfirm}
            className="cursor-pointer rounded-lg border-0 px-4 py-2 text-brain-base font-medium text-inverse disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: mode === 'hard' ? 'var(--color-contra)' : 'var(--color-accent)',
            }}
          >
            {busy ? '处理中…' : mode === 'hard' ? '永久删除' : '软删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
