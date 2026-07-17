import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePolling } from '../usePolling';

/**
 * reload() 语义：清掉待定的自动 tick，立即拉一次。用大 intervalMs 让自动周期
 * 不干扰，专测手动刷新即时性。
 */
describe('usePolling · reload', () => {
  it('reload() 立即再次调用 fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue('v');
    const { result } = renderHook(() =>
      usePolling(fetcher, { intervalMs: 1_000_000, initialData: '' }),
    );

    // 首次挂载 tick
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBe('v');
  });

  it('enabled=false 时 reload() 是安全 no-op', async () => {
    const fetcher = vi.fn().mockResolvedValue('v');
    const { result } = renderHook(() =>
      usePolling(fetcher, { intervalMs: 1_000_000, initialData: '', enabled: false }),
    );
    await act(async () => {
      result.current.reload();
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
