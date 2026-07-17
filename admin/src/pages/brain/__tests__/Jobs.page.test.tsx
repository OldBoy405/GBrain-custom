import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const callMcp = vi.fn();
vi.mock('../../../lib/mcp-client', () => ({
  callMcp: (...args: unknown[]) => callMcp(...args),
  buildMcpRequest: vi.fn(),
  parseMcpPayload: vi.fn(),
  setMcpToken: vi.fn(),
  hasMcpToken: vi.fn(() => false),
}));

// 首次为 Tier1 REST（api.ts）建立 mock 先例，供后续含 usePolling+api 的页面测试参考。
vi.mock('../../../api', () => ({
  api: {
    jobsWatch: vi.fn(() =>
      Promise.resolve({
        ts_ms: 0,
        by_type: [],
        queue_health: { waiting: 0, active: 0, stalled: 0 },
        lease_pressure_1h: 0,
        top_errors: [],
        budget_owners: [],
      }),
    ),
  },
}));

import { Jobs } from '../Jobs';
import { WhyProvider } from '../../../components/brain/WhyProvider';
import type { MinionJobRow } from '../../../lib/op-types';

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

function renderPage() {
  return render(
    <WhyProvider>
      <Jobs />
    </WhyProvider>,
  );
}

beforeEach(() => {
  callMcp.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});

  callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
    if (name === 'list_jobs') {
      const status = args?.status;
      if (status === 'waiting') {
        return Promise.resolve([
          job({ id: 1, name: 'extract-typed-links', status: 'waiting', data: { slug: 'pages/in-013' } }),
        ]);
      }
      if (status === 'active') {
        return Promise.resolve([
          job({
            id: 2,
            name: 'synthesize-page',
            status: 'active',
            started_at: '2026-07-11T10:00:00.000Z',
            depth: 1,
          }),
        ]);
      }
      if (status === 'completed') {
        return Promise.resolve([
          job({
            id: 3,
            name: 'embed-stale-chunks',
            status: 'completed',
            started_at: '2026-07-11T10:00:00.000Z',
            finished_at: '2026-07-11T10:00:01.000Z',
          }),
        ]);
      }
      if (status === 'failed') {
        return Promise.resolve([job({ id: 4, name: 'lint', status: 'failed', error_text: 'boom' })]);
      }
      if (status === 'dead') return Promise.resolve([]);
      return Promise.resolve([]);
    }
    if (name === 'get_status_snapshot') {
      return Promise.resolve({
        cycle: {
          last_full: {
            finished_at: '2026-07-11T03:14:00.000Z',
            name: 'autopilot-cycle',
            status: 'completed',
            duration_ms: 12 * 60_000,
            totals: { pages_extracted: 47, synth_pages_written: 12, pages_synced: 5 },
            phases: [
              { phase: 'lint', status: 'ok', duration_ms: 380, summary: 'fixed 0' },
              { phase: 'extract', status: 'ok', duration_ms: 4200, summary: 'links created' },
              { phase: 'synthesize', status: 'ok', duration_ms: 380_000, summary: '12 pages' },
            ],
          },
          last_targeted: null,
        },
      });
    }
    if (name === 'submit_job') return Promise.resolve({ id: 99, name: 'autopilot-cycle', status: 'waiting' });
    if (name === 'cancel_job') return Promise.resolve({ id: 1, status: 'cancelled' });
    if (name === 'retry_job') return Promise.resolve({ id: 4, status: 'waiting' });
    return Promise.resolve({});
  });
});

describe('后台调度 · 三栏逐作业队列', () => {
  it('队列三件套（三栏 + 队列健康 + 运维摘要）同区块展示', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('jobs-queue-section')).toBeInTheDocument());
    expect(screen.getByText('队列健康')).toBeInTheDocument();
    expect(screen.getByText('运维摘要')).toBeInTheDocument();
    expect(screen.queryByText(/按类型 · 24h/)).not.toBeInTheDocument();
  });

  it('三栏标题标注最近 20 条样本上限', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('extract-typed-links')).toBeInTheDocument());
    expect(screen.getAllByText(/最近 20 条/).length).toBeGreaterThanOrEqual(3);
  });

  it('运行中栏样本数超出上限时，额外标注 queue_health.active 真实总数', async () => {
    const { api } = await import('../../../api');
    vi.mocked(api.jobsWatch).mockResolvedValue({
      ts_ms: 0,
      by_type: [],
      // 真实总数（42）远大于样本上限（20），验证栏标题不会把样本数误当总数。
      queue_health: { waiting: 0, active: 42, stalled: 0 },
      lease_pressure_1h: 0,
      top_errors: [],
      budget_owners: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/实时总数 42/)).toBeInTheDocument());
  });

  it('按真实计数渲染待处理/运行中/已完成三栏', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('extract-typed-links')).toBeInTheDocument());
    expect(screen.getByText('pages/in-013')).toBeInTheDocument();
    expect(screen.getByText('synthesize-page')).toBeInTheDocument();
    expect(screen.getByText(/depth=1 \(nested\)/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('embed-stale-chunks')).toBeInTheDocument());
  });

  it('点击待处理作业的取消按钮调用 cancel_job', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('extract-typed-links')).toBeInTheDocument());
    const cancelButtons = screen.getAllByText('取消');
    fireEvent.click(cancelButtons[0]);
    await waitFor(() => expect(callMcp).toHaveBeenCalledWith('cancel_job', { id: 1 }));
  });

  it('点击失败作业的重试按钮调用 retry_job', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('lint')).toBeInTheDocument());
    fireEvent.click(screen.getByText('重试'));
    await waitFor(() => expect(callMcp).toHaveBeenCalledWith('retry_job', { id: 4 }));
  });
});

describe('后台调度 · 真实状态机（9 种 status）与执行通道', () => {
  it('已结束栏按真实 status 打中文徽标（含死亡、已取消，非只有完成/失败）', async () => {
    callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'list_jobs') {
        const status = args?.status;
        if (status === 'failed') return Promise.resolve([job({ id: 4, name: 'lint', status: 'failed' })]);
        if (status === 'dead') return Promise.resolve([job({ id: 5, name: 'sync', status: 'dead' })]);
        if (status === 'cancelled') return Promise.resolve([job({ id: 6, name: 'embed', status: 'cancelled' })]);
        return Promise.resolve([]);
      }
      if (name === 'get_status_snapshot') return Promise.resolve({ cycle: { last_full: null, last_targeted: null } });
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('失败')).toBeInTheDocument());
    expect(screen.getByText('死亡')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });

  it('待处理栏合并 delayed/paused/waiting-children，逐卡打真实中文子状态', async () => {
    callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'list_jobs') {
        const status = args?.status;
        if (status === 'delayed') return Promise.resolve([job({ id: 7, name: 'retry-backoff', status: 'delayed' })]);
        if (status === 'paused') return Promise.resolve([job({ id: 8, name: 'nightly-sweep', status: 'paused' })]);
        if (status === 'waiting-children')
          return Promise.resolve([job({ id: 9, name: 'aggregate-results', status: 'waiting-children' })]);
        return Promise.resolve([]);
      }
      if (name === 'get_status_snapshot') return Promise.resolve({ cycle: { last_full: null, last_targeted: null } });
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('延迟')).toBeInTheDocument());
    expect(screen.getByText('已暂停')).toBeInTheDocument();
    expect(screen.getByText('等待子任务')).toBeInTheDocument();
  });

  it('运行中作业 lock_until 已过期时显示"停滞"（与 queue.ts 的定义一致）', async () => {
    callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'list_jobs') {
        const status = args?.status;
        if (status === 'active') {
          return Promise.resolve([
            job({
              id: 10,
              name: 'wedged-sync',
              status: 'active',
              started_at: '2026-07-11T09:00:00.000Z',
              lock_until: '2020-01-01T00:00:00.000Z',
            }),
          ]);
        }
        return Promise.resolve([]);
      }
      if (name === 'get_status_snapshot') return Promise.resolve({ cycle: { last_full: null, last_targeted: null } });
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('wedged-sync')).toBeInTheDocument());
    // 页面底部"队列健康"StatCard 本来就有一个固定的"停滞"label，故断言 >=2
    // （StatCard label + 本卡片的 Badge）以确认卡片确实被判定为停滞。
    expect(screen.getAllByText('停滞').length).toBeGreaterThanOrEqual(2);
  });

  it('subagent/shell 执行通道打 Badge，常规 handler 不打标', async () => {
    callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'list_jobs') {
        const status = args?.status;
        if (status === 'active') {
          return Promise.resolve([
            job({ id: 11, name: 'agent-loop-job', status: 'active', execution_lane: 'subagent' }),
            job({ id: 12, name: 'shell-cmd-job', status: 'active', execution_lane: 'shell' }),
          ]);
        }
        return Promise.resolve([]);
      }
      if (name === 'get_status_snapshot') return Promise.resolve({ cycle: { last_full: null, last_targeted: null } });
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('agent-loop-job')).toBeInTheDocument());
    expect(screen.getAllByText('subagent')).toHaveLength(1);
    expect(screen.getAllByText('shell')).toHaveLength(1);
  });

});

describe('后台调度 · 运维摘要', () => {
  it('展示错误聚类与预算账户', async () => {
    const { api } = await import('../../../api');
    vi.mocked(api.jobsWatch).mockResolvedValueOnce({
      ts_ms: 0,
      by_type: [],
      queue_health: { waiting: 0, active: 0, stalled: 0 },
      lease_pressure_1h: 0,
      top_errors: [{ cluster: 'timeout: embed', count: 3 }],
      budget_owners: [{ owner_id: 42, remaining_cents: 500, total_spent_cents: 1500 }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('timeout: embed')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
  });
});

describe('后台调度 · Dream Cycle 卡', () => {
  it('渲染语义 pipeline 组、中文产出摘要（无 9 phase / cron）', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/上次：/)).toBeInTheDocument());
    expect(screen.getByText(/文件层/)).toBeInTheDocument();
    expect(screen.getByText(/链接与结构 · wikilink\/backlink 修复/)).toBeInTheDocument();
    expect(screen.getByText(/lint → backlinks（修 markdown \/ 补链）/)).toBeInTheDocument();
    expect(screen.getByText(/内容生成\/抽取/)).toBeInTheDocument();
    expect(screen.getByTestId('dream-cycle-pipeline')).toBeInTheDocument();
    expect(screen.getByText(/typed-link \/ 链接抽取 47/)).toBeInTheDocument();
    expect(screen.getByText(/synthesize 新页写入 12/)).toBeInTheDocument();
    expect(screen.queryByText(/9 phase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 3 \* \* \*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/下次预定/)).not.toBeInTheDocument();
  });

  it('点击"立即触发"调用 submit_job 提交 autopilot-cycle', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('立即触发')).toBeInTheDocument());
    fireEvent.click(screen.getByText('立即触发'));
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('submit_job', { name: 'autopilot-cycle', data: {} }),
    );
    await waitFor(() => expect(screen.getByText(/已提交作业 #99/)).toBeInTheDocument());
  });
});
