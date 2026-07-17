import { describe, it, expect } from 'vitest';
import {
  JOB_QUEUE_SAMPLE_LIMIT,
  mergePendingJobs,
  mergeTerminalJobs,
} from '../jobs-queue-fetch';
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

describe('jobs-queue-fetch merge helpers', () => {
  it('mergePendingJobs 按 created_at 降序，较新的 delayed 排在最前', () => {
    const waiting = [
      job({ id: 1, status: 'waiting', created_at: '2026-07-11T10:00:00.000Z' }),
      job({ id: 2, status: 'waiting', created_at: '2026-07-11T11:00:00.000Z' }),
    ];
    const delayed = [job({ id: 100, status: 'delayed', created_at: '2026-07-12T10:00:00.000Z' })];
    const merged = mergePendingJobs(waiting, delayed, [], []);
    expect(merged[0].id).toBe(100);
    expect(merged.map((j) => j.id)).toEqual([100, 2, 1]);
  });

  it('mergePendingJobs 超过 JOB_QUEUE_SAMPLE_LIMIT 时截断', () => {
    const waiting = Array.from({ length: 25 }, (_, i) =>
      job({ id: i + 1, status: 'waiting', created_at: `2026-07-11T${String(i).padStart(2, '0')}:00:00.000Z` }),
    );
    const merged = mergePendingJobs(waiting, [], [], []);
    expect(merged).toHaveLength(JOB_QUEUE_SAMPLE_LIMIT);
  });

  it('mergeTerminalJobs 按 finished_at 降序，较新的 failed 排在最前', () => {
    const completed = [
      job({ id: 1, status: 'completed', finished_at: '2026-07-11T10:00:00.000Z' }),
    ];
    const failed = [
      job({ id: 99, status: 'failed', finished_at: '2026-07-12T10:00:00.000Z' }),
    ];
    const merged = mergeTerminalJobs(completed, failed, [], []);
    expect(merged[0].id).toBe(99);
  });

  it('mergeTerminalJobs 超过 JOB_QUEUE_SAMPLE_LIMIT 时截断', () => {
    const completed = Array.from({ length: 25 }, (_, i) =>
      job({
        id: i + 1,
        status: 'completed',
        finished_at: `2026-07-11T10:${String(i).padStart(2, '0')}:00.000Z`,
      }),
    );
    const merged = mergeTerminalJobs(completed, [], [], []);
    expect(merged).toHaveLength(JOB_QUEUE_SAMPLE_LIMIT);
  });

  it('mergePendingJobs 跨子桶去重：同一 id 出现在两个子桶时只保留一条', () => {
    // 状态跳变（waiting→paused）可能被两次并行查询同时抓到。
    const waiting = [job({ id: 1, status: 'waiting', created_at: '2026-07-11T10:00:00.000Z' })];
    const paused = [job({ id: 1, status: 'paused', created_at: '2026-07-11T10:00:00.000Z' })];
    const merged = mergePendingJobs(waiting, [], paused, []);
    expect(merged).toHaveLength(1);
  });

  it('mergeTerminalJobs 跨子桶去重：同一 id 出现在两个子桶时只保留一条', () => {
    const completed = [job({ id: 9, status: 'completed', finished_at: '2026-07-11T10:00:00.000Z' })];
    const failed = [job({ id: 9, status: 'failed', finished_at: '2026-07-11T10:00:00.000Z' })];
    const merged = mergeTerminalJobs(completed, failed, [], []);
    expect(merged).toHaveLength(1);
  });

  it('去重必须在 slice 之前：重复项不该顶掉一条本该展示的真实作业', () => {
    // 20 个不同 id（1..20，id 越大 created_at 越新）。id=20 被 paused 桶又抓到
    // 一次、且时间戳更新——若先 slice 再去重，这个重复会多占一个名额，把最旧
    // 的 id=1 挤出前 20；先去重再 slice 才能让 20 个真实作业都展示出来。
    const waiting = Array.from({ length: 20 }, (_, i) => {
      const id = i + 1;
      return job({ id, status: 'waiting', created_at: `2026-07-11T${String(id).padStart(2, '0')}:00:00.000Z` });
    });
    const paused = [job({ id: 20, status: 'paused', created_at: '2026-07-11T23:00:00.000Z' })];
    const merged = mergePendingJobs(waiting, [], paused, []);
    expect(merged).toHaveLength(JOB_QUEUE_SAMPLE_LIMIT);
    expect(merged.filter((j) => j.id === 20)).toHaveLength(1);
    expect(merged.some((j) => j.id === 1)).toBe(true);
  });
});
