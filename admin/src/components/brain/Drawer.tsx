import React, { useEffect } from 'react';

/** 右侧滑出抽屉（浅色）。用于图谱节点详情等。 */
export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // ESC 关闭：所有消费者共用同一份监听，而不是各自 useEffect 手写一份。
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full flex-col border-l border-hairline bg-surface shadow-xl"
        style={{ width: 'var(--width-brain-drawer)' }}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div className="type-serif text-brain-xl font-semibold text-ink">{title}</div>
          <button onClick={onClose} className="cursor-pointer border-0 bg-transparent text-lg text-muted hover:text-ink">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </>
  );
}
