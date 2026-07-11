import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSSE } from './useSSE';

/**
 * 回归测试：StatusPill 一直显示灰色「连接中」的根因——
 * 若 mount 那一刻 document.hidden 恰好读到 true（嵌入式/未聚焦面板、后台标签页
 * 从未被激活等场景），且从此再没有一次真实的 visibilitychange 事件把它翻回
 * visible，旧实现会让 open() 内部的 `document.hidden` 判断直接短路，
 * EventSource 永远不会被创建，状态永久卡在初始值 'connecting'。
 */
describe('useSSE', () => {
  let esInstances: Array<{ url: string; onopen?: () => void; onerror?: () => void }>;

  beforeEach(() => {
    esInstances = [];
    class MockEventSource {
      onopen?: () => void;
      onerror?: () => void;
      onmessage?: (e: MessageEvent) => void;
      constructor(public url: string) {
        esInstances.push(this as any);
      }
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mount 时 document.hidden=true 也要尝试建连，不能永久卡在 connecting', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    renderHook(() => useSSE('/admin/events'));

    expect(esInstances).toHaveLength(1);
    expect(esInstances[0].url).toBe('/admin/events');
  });

  it('document.hidden=false 时正常建连（既有行为不回归）', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);

    renderHook(() => useSSE('/admin/events'));

    expect(esInstances).toHaveLength(1);
  });
});
