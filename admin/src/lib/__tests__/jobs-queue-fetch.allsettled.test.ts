import { describe, it, expect, vi, beforeEach } from 'vitest';

const jobsWatch = vi.fn();
const callMcp = vi.fn();

vi.mock('../../api', () => ({ api: { jobsWatch: (...a: unknown[]) => jobsWatch(...a) } }));
vi.mock('../mcp-client', () => ({ callMcp: (...a: unknown[]) => callMcp(...a) }));

import { fetchJobsQueuePanel } from '../jobs-queue-fetch';
import type { MinionJobRow } from '../op-types';

function job(overrides: Partial<MinionJobRow>): MinionJobRow {
  return {
    id: 1,
    name: 'sync',
    queue: 'default',
    status: 'waiting',
    data: {},
    attempts_made: 0,
    max_attempts: 3,
    parent_job_id: null,
    depth: 0,
    error_text: null,
    result: null,
    created_at: '2026-07-11T10:00:00.000Z',
    started_at: null,
    finished_at: null,
    execution_lane: 'handler',
    lock_until: null,
    stalled_counter: 0,
    ...overrides,
  };
}

const WATCH = {
  ts_ms: 0,
  by_type: [],
  queue_health: { waiting: 1, active: 0, stalled: 0 },
  lease_pressure_1h: 0,
  top_errors: [],
  budget_owners: [],
};

beforeEach(() => {
  jobsWatch.mockReset();
  callMcp.mockReset();
});

describe('fetchJobsQueuePanel · allSettled 降级', () => {
  it('全部成功时无错误、数据齐全', async () => {
    jobsWatch.mockResolvedValue(WATCH);
    callMcp.mockImplementation((_name: string, args?: Record<string, unknown>) => {
      if (args?.status === 'waiting') return Promise.resolve([job({ id: 1, status: 'waiting' })]);
      if (args?.status === 'active') return Promise.resolve([job({ id: 2, status: 'active' })]);
      if (args?.status === 'completed') return Promise.resolve([job({ id: 3, status: 'completed' })]);
      return Promise.resolve([]);
    });
    const r = await fetchJobsQueuePanel();
    expect(r.watch).toEqual(WATCH);
    expect(r.pending.map((j) => j.id)).toEqual([1]);
    expect(r.active.map((j) => j.id)).toEqual([2]);
    expect(r.done.map((j) => j.id)).toEqual([3]);
    expect(r.errors).toEqual({ watch: null, pending: null, active: null, done: null });
  });

  it('单个冷门桶失败只标记对应栏，其余栏照常返回', async () => {
    jobsWatch.mockResolvedValue(WATCH);
    callMcp.mockImplementation((_name: string, args?: Record<string, unknown>) => {
      if (args?.status === 'delayed') return Promise.reject(new Error('delayed 500'));
      if (args?.status === 'waiting') return Promise.resolve([job({ id: 1, status: 'waiting' })]);
      if (args?.status === 'active') return Promise.resolve([job({ id: 2, status: 'active' })]);
      return Promise.resolve([]);
    });
    const r = await fetchJobsQueuePanel();
    // waiting 桶成功，pending 栏仍然有数据
    expect(r.pending.map((j) => j.id)).toEqual([1]);
    expect(r.active.map((j) => j.id)).toEqual([2]);
    // 只有 pending 栏（含 delayed 子桶）被标错
    expect(r.errors.pending).toBe('delayed 500');
    expect(r.errors.active).toBeNull();
    expect(r.errors.done).toBeNull();
    expect(r.errors.watch).toBeNull();
  });

  it('watch 失败时 watch=null 且只标 errors.watch，队列样本不受影响', async () => {
    jobsWatch.mockRejectedValue(new Error('watch boom'));
    callMcp.mockResolvedValue([]);
    const r = await fetchJobsQueuePanel();
    expect(r.watch).toBeNull();
    expect(r.errors.watch).toBe('watch boom');
    expect(r.errors.pending).toBeNull();
  });

  it('全部失败时抛出（供 usePolling 进入错误态 + 退避）', async () => {
    jobsWatch.mockRejectedValue(new Error('down'));
    callMcp.mockRejectedValue(new Error('down'));
    await expect(fetchJobsQueuePanel()).rejects.toThrow();
  });
});
