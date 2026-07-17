import React, { useEffect, useRef, useState } from 'react';

const MIN_RESIZABLE_WIDTH = 320;
const MAX_RESIZABLE_WIDTH_VW = 0.9; // 最宽不超过视口 90%，留出可点击的遮罩边

/** 右侧滑出抽屉（浅色）。用于图谱节点详情等。`resizable` 时左边缘可拖拽调宽（仅内存态，不持久化）。 */
export function Drawer({
  open,
  title,
  onClose,
  children,
  resizable = false,
  initialWidthRatio = 0.5,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** 允许拖拽左边缘自由调整宽度；默认关闭，不影响其余抽屉消费者。 */
  resizable?: boolean;
  /** resizable 时的初始宽度占视口比例（默认半屏 0.5；传 1/3 得 1/3 屏）。仍钳制到 MIN。 */
  initialWidthRatio?: number;
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

  // 拖拽调宽：右侧固定，宽度 = 视口宽 - 鼠标 clientX，钳制在 [MIN, 90vw] 之间。
  // resizable 时默认宽度为视口的 initialWidthRatio（同样钳制到 MIN，避免窄屏溢出）；
  // 非 resizable 时 width 恒为 null，沿用 CSS var 默认宽度。
  const [width, setWidth] = useState<number | null>(() =>
    resizable ? Math.max(MIN_RESIZABLE_WIDTH, window.innerWidth * initialWidthRatio) : null,
  );
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!resizable) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const maxWidth = window.innerWidth * MAX_RESIZABLE_WIDTH_VW;
      const next = Math.min(maxWidth, Math.max(MIN_RESIZABLE_WIDTH, window.innerWidth - e.clientX));
      setWidth(next);
    };
    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizable]);

  if (!open) return null;

  const startDrag = () => {
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full flex-col border-l border-hairline bg-surface shadow-xl"
        style={{ width: width !== null ? `${width}px` : 'var(--width-brain-drawer)' }}
      >
        {resizable && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整抽屉宽度"
            data-testid="drawer-resize-handle"
            onMouseDown={startDrag}
            className="absolute -left-1.5 top-0 z-10 h-full w-3 cursor-col-resize touch-none select-none"
          >
            <div className="mx-auto h-full w-px bg-hairline transition-colors hover:bg-accent" />
          </div>
        )}
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
