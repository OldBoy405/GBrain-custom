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
            totals: { extract: 47, synthesize: 12 },
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

describe('后台调度 · Dream Cycle 卡', () => {
  it('渲染上次运行摘要与真实 totals（不断言固定 phase 数）', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/上次：/)).toBeInTheDocument());
    expect(screen.getByText('extract')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
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

describe('后台调度 · 静态诚实基准卡', () => {
  it('渲染 minions-queue why-topic 的对比文案与免责声明', () => {
    renderPage();
    expect(screen.getByText('示意基准（非实时触发）· 数字对应 Why? 面板同一组结论')).toBeInTheDocument();
  });
});

describe('后台调度 · Trace Waterfall', () => {
  it('无最近查询（未包 LastQueryProvider）时显示空态引导', () => {
    renderPage();
    expect(screen.getByText(/暂无最近查询/)).toBeInTheDocument();
  });
});
