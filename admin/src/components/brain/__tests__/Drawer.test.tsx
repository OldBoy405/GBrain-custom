import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Drawer } from '../Drawer';

function renderDrawer(resizable?: boolean) {
  return render(
    <Drawer open title="测试抽屉" onClose={() => {}} resizable={resizable}>
      <div>内容</div>
    </Drawer>,
  );
}

describe('Drawer 拖拽调宽（resizable）', () => {
  it('默认不传 resizable：不渲染拖拽手柄', () => {
    const { queryByTestId } = renderDrawer();
    expect(queryByTestId('drawer-resize-handle')).not.toBeInTheDocument();
  });

  it('resizable=true：渲染可拖拽手柄', () => {
    const { getByTestId } = renderDrawer(true);
    const handle = getByTestId('drawer-resize-handle');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('role', 'separator');
  });

  it('resizable=true 时默认宽度为屏幕的一半；非 resizable 沿用 CSS 变量默认宽度', () => {
    const resizable = renderDrawer(true);
    const resizableAside = resizable.container.querySelector('aside') as HTMLElement;
    expect(resizableAside.style.width).toBe(`${window.innerWidth * 0.5}px`);

    const fixed = renderDrawer(false);
    const fixedAside = fixed.container.querySelector('aside') as HTMLElement;
    expect(fixedAside.style.width).toBe('var(--width-brain-drawer)');
  });

  it('拖拽手柄调整宽度：宽度随鼠标位置变化，并钳制在 [320px, 90vw] 之间', () => {
    const { getByTestId, container } = renderDrawer(true);
    const handle = getByTestId('drawer-resize-handle');
    const aside = container.querySelector('aside') as HTMLElement;

    // 拖拽前默认宽度为屏幕的一半
    expect(aside.style.width).toBe(`${window.innerWidth * 0.5}px`);

    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { clientX: 200 });
    expect(aside.style.width).toBe(`${window.innerWidth - 200}px`);

    // 拖到视口外极左：钳制在 90vw 上限
    fireEvent.mouseMove(document, { clientX: -10_000 });
    expect(aside.style.width).toBe(`${window.innerWidth * 0.9}px`);

    // 拖到接近右边缘：钳制在 320px 下限
    fireEvent.mouseMove(document, { clientX: window.innerWidth - 10 });
    expect(aside.style.width).toBe('320px');

    fireEvent.mouseUp(document);
  });

  it('松手后停止跟随鼠标移动', () => {
    const { getByTestId, container } = renderDrawer(true);
    const handle = getByTestId('drawer-resize-handle');
    const aside = container.querySelector('aside') as HTMLElement;

    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { clientX: 200 });
    const widthAfterDrag = aside.style.width;

    fireEvent.mouseUp(document);
    fireEvent.mouseMove(document, { clientX: 900 });
    expect(aside.style.width).toBe(widthAfterDrag);
  });
});
