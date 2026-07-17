import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { callMcp } = vi.hoisted(() => ({
  callMcp: vi.fn(),
}));

vi.mock('../mcp-client', () => ({
  callMcp,
  buildMcpRequest: vi.fn(),
  parseMcpPayload: vi.fn(),
  setMcpToken: vi.fn(),
  hasMcpToken: vi.fn(() => false),
}));

import {
  useCapture,
  type CaptureBatchItem,
  type CaptureBatchItemOutcome,
  type CaptureBatchResult,
} from '../useCapture';

function item(key: string, body: string): CaptureBatchItem {
  return { key, name: key, body };
}

describe('useCapture · submitBatch', () => {
  beforeEach(() => {
    callMcp.mockReset();
  });

  it('顺序逐条调用 put_page（非并发）', async () => {
    const calls: string[] = [];
    callMcp.mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === 'put_page') {
        calls.push(args.slug as string);
        return Promise.resolve({ slug: args.slug, status: 'created' });
      }
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useCapture());
    let batchResult: CaptureBatchResult | undefined;
    await act(async () => {
      batchResult = await result.current.submitBatch([item('a', 'content A'), item('b', 'content B')]);
    });

    expect(calls).toHaveLength(2);
    expect(batchResult).toEqual({
      succeeded: [
        { key: 'a', name: 'a', slug: expect.stringMatching(/^inbox\//) },
        { key: 'b', name: 'b', slug: expect.stringMatching(/^inbox\//) },
      ],
      failed: [],
    });
  });

  it('单条失败不影响其余条目继续提交', async () => {
    callMcp.mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === 'put_page') {
        if ((args.content as string).includes('FAIL')) {
          return Promise.reject(new Error('write failed'));
        }
        return Promise.resolve({ slug: args.slug, status: 'created' });
      }
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useCapture());
    let batchResult: CaptureBatchResult | undefined;
    await act(async () => {
      batchResult = await result.current.submitBatch([
        item('ok1', 'good content 1'),
        item('bad', 'FAIL this one'),
        item('ok2', 'good content 2'),
      ]);
    });

    expect(batchResult!.succeeded.map((s) => s.key)).toEqual(['ok1', 'ok2']);
    expect(batchResult!.failed).toEqual([{ key: 'bad', name: 'bad', error: 'write failed' }]);
  });

  it('onItemSettled 按提交顺序依次触发，携带正确的 status', async () => {
    callMcp.mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === 'put_page') {
        if ((args.content as string).includes('FAIL')) return Promise.reject(new Error('boom'));
        return Promise.resolve({ slug: args.slug, status: 'created' });
      }
      return Promise.resolve({});
    });

    const settled: CaptureBatchItemOutcome[] = [];
    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.submitBatch([item('a', 'good'), item('b', 'FAIL')], {
        onItemSettled: (outcome) => settled.push(outcome),
      });
    });

    expect(settled).toHaveLength(2);
    expect(settled[0]).toMatchObject({ key: 'a', status: 'success' });
    expect(settled[1]).toMatchObject({ key: 'b', status: 'error', error: 'boom' });
  });

  it('triggerEnrichment 为 true 时每条成功后都调用 trigger_inbox_enrichment', async () => {
    const triggered: unknown[] = [];
    callMcp.mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === 'put_page') return Promise.resolve({ slug: args.slug, status: 'created' });
      if (name === 'trigger_inbox_enrichment') {
        triggered.push(args.slugs);
        return Promise.resolve({ accepted: [], skipped: [] });
      }
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useCapture());
    await act(async () => {
      await result.current.submitBatch([item('a', 'content A'), item('b', 'content B')], {
        triggerEnrichment: true,
      });
    });

    expect(triggered).toHaveLength(2);
  });

  it('批量返回结果不 throw（即便全部失败）', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'put_page') return Promise.reject(new Error('always fails'));
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useCapture());
    let batchResult: CaptureBatchResult | undefined;
    await act(async () => {
      batchResult = await result.current.submitBatch([item('a', 'x'), item('b', 'y')]);
    });

    expect(batchResult!.succeeded).toEqual([]);
    expect(batchResult!.failed).toHaveLength(2);
  });
});
