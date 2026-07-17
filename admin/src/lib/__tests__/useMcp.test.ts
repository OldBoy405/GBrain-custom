import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { callMcp } = vi.hoisted(() => ({
  callMcp: vi.fn(),
}));

vi.mock('../mcp-client', () => ({
  callMcp,
}));

import { useMcp } from '../useMcp';

describe('useMcp 后台刷新不闪烁', () => {
  beforeEach(() => {
    callMcp.mockReset();
  });

  it('首次加载展示 loading；拿到数据后再 reload()，请求挂起期间 loading 保持 false（旧数据继续展示，不整段消失）', async () => {
    let resolveSecond: (v: { n: number }) => void = () => {};
    callMcp
      .mockResolvedValueOnce({ n: 1 })
      .mockImplementationOnce(() => new Promise<{ n: number }>((resolve) => { resolveSecond = resolve; }));

    const { result } = renderHook(() => useMcp<{ n: number }>('op', {}));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(result.current.loading).toBe(false);

    act(() => {
      void result.current.reload();
    });
    // 第二次请求正在挂起（尚未 resolve）—— 若回归到旧 bug，这里 loading 会是 true。
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ n: 1 });

    act(() => {
      resolveSecond({ n: 2 });
    });
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(result.current.loading).toBe(false);
  });
});
