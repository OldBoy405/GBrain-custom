import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SSEStatus } from '../../../lib/useSSE';

const { mockStats, mockHealth, mockAgents, mockRequests, mockApiKeys, sseState } = vi.hoisted(() => ({
  mockStats: { connected_agents: 3, active_tokens: 2, active_api_keys: 1, requests_today: 42 },
  mockHealth: { expiring_soon: 0, error_rate: '0%' },
  mockAgents: [
    { id: 'c1', name: 'agent-alpha', auth_type: 'oauth', scope: 'read write', status: 'active', last_used_at: new Date().toISOString(), total_requests: 10, requests_today: 3, token_ttl: 3600 },
    { id: 'k1', name: 'legacy-key', auth_type: 'api_key', scope: 'read write admin', status: 'active' },
  ],
  mockRequests: { rows: [{ id: 1, token_name: 'agent-alpha', agent_name: 'agent-alpha', operation: 'query', latency_ms: 12, status: 'success', created_at: new Date().toISOString() }], total: 1, page: 1, pages: 1 },
  mockApiKeys: [{ id: 'k1', name: 'legacy-key', status: 'active', created_at: new Date().toISOString(), last_used_at: null }],
  // 可变的 SSE 返回值：每条用例在 render 前改写它，模拟不同连接/数据状态。
  sseState: { status: 'disconnected' as SSEStatus, events: [] as any[], clear: vi.fn() },
}));

vi.mock('../../../api', () => ({
  api: {
    stats: vi.fn().mockResolvedValue(mockStats),
    health: vi.fn().mockResolvedValue(mockHealth),
    agents: vi.fn().mockResolvedValue(mockAgents),
    requests: vi.fn().mockResolvedValue(mockRequests),
    apiKeys: vi.fn().mockResolvedValue(mockApiKeys),
  },
}));

vi.mock('../../../lib/useSSE', () => ({
  useSSE: () => sseState,
}));

// AdvisorPanel 走 Tier3 useMcp('advisor')；不 mock 会真实发起 fetch。
const callMcp = vi.fn();
vi.mock('../../../lib/mcp-client', () => ({
  callMcp: (...args: unknown[]) => callMcp(...args),
  buildMcpRequest: vi.fn(),
  parseMcpPayload: vi.fn(),
  setMcpToken: vi.fn(),
  hasMcpToken: vi.fn(() => false),
}));

import { Today } from '../Today';
import { WhyProvider } from '../../../components/brain/WhyProvider';

const ADVISOR_REPORT = {
  version: '0.42.57.0',
  generated_at: new Date(0).toISOString(),
  findings: [
    { id: 'setup_smell', severity: 'info', title: '尚未配置备份计划', collector: 'setup', ask_user: true, fix: { command_argv: null } },
    { id: 'version_drift', severity: 'critical', title: '版本落后于最新发布', collector: 'version', ask_user: true, fix: { command_argv: ['gbrain', 'upgrade'] } },
  ],
  worst: 'critical',
};

function renderToday() {
  return render(
    <WhyProvider>
      <Today />
    </WhyProvider>,
  );
}

// jsdom 不实现 scrollIntoView / IntersectionObserver：TodayStory mount 时都会用到。
beforeEach(() => {
  sseState.status = 'disconnected';
  sseState.events = [];
  callMcp.mockReset();
  callMcp.mockResolvedValue(ADVISOR_REPORT);
  (Element.prototype as any).scrollIntoView = vi.fn();
  (globalThis as any).IntersectionObserver = class {
    constructor(_cb: unknown, _opts?: unknown) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
});

describe('Today 页面基础渲染', () => {
  it('渲染 PageHeader 标题"运营概览"', () => {
    renderToday();
    expect(screen.getByText('运营概览')).toBeInTheDocument();
  });

  it('渲染 6 个 StatCard（初始值）', () => {
    renderToday();
    expect(screen.getByText('连接的 Agent')).toBeInTheDocument();
    expect(screen.getByText('今日请求')).toBeInTheDocument();
    expect(screen.getByText('活跃令牌')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('即将过期令牌')).toBeInTheDocument();
    expect(screen.getByText('24h 错误率')).toBeInTheDocument();
  });

  it('渲染"实时活动"区域', () => {
    renderToday();
    expect(screen.getByText('实时活动')).toBeInTheDocument();
  });

  it('无事件时显示"连接中…"', () => {
    renderToday();
    expect(screen.getByText('连接中…')).toBeInTheDocument();
  });

  it('Hero 区域渲染（TodayHero）', () => {
    renderToday();
    expect(screen.getByText('GBrain 工程台')).toBeInTheDocument();
    expect(screen.getByText('都自动入库')).toBeInTheDocument();
  });

  it('TodayStory 初始不挂载', () => {
    renderToday();
    expect(screen.queryByText('// 屏 2 · 跨平台时间线 · 真实场景')).not.toBeInTheDocument();
  });
});

describe('Today 交互与数据', () => {
  it('点击"先看看它怎么工作"→ 懒挂载 TodayStory', async () => {
    renderToday();
    fireEvent.click(screen.getByText('先看看它怎么工作'));
    await waitFor(() => {
      expect(screen.getByText('// 屏 2 · 跨平台时间线 · 真实场景')).toBeInTheDocument();
    });
  });

  it('点击"连接的 Agent"卡 → 右侧抽屉展示 Agent 列表', async () => {
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: '连接的 Agent · 查看详情' }));
    await waitFor(() => {
      expect(screen.getByText('agent-alpha')).toBeInTheDocument();
    });
    // 抽屉标题与卡片 label 同名，用 getAllByText 断言至少出现两处（卡片 + 抽屉标题）。
    expect(screen.getAllByText('连接的 Agent').length).toBeGreaterThanOrEqual(2);
  });

  it('点击"活跃令牌"卡 → 抽屉展示复用说明注记', async () => {
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: '活跃令牌 · 查看详情' }));
    await waitFor(() => {
      expect(screen.getByText(/未向前端暴露单条令牌到期时间/)).toBeInTheDocument();
    });
  });

  it('抽屉打开后按 ESC 关闭', async () => {
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'API Keys · 查看详情' }));
    await waitFor(() => {
      expect(screen.getByText('legacy-key')).toBeInTheDocument();
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('legacy-key')).not.toBeInTheDocument();
    });
  });

  it('SSE 有事件时渲染活动流表格行', () => {
    sseState.status = 'connected';
    sseState.events = [
      { agent: 'agent-x', operation: 'query', scopes: 'read', latency_ms: 12, status: 'success', timestamp: new Date().toISOString() },
    ];
    renderToday();
    expect(screen.getByText('agent-x')).toBeInTheDocument();
    expect(screen.getByText('query')).toBeInTheDocument();
    // 有数据时不应再显示空态文案
    expect(screen.queryByText('连接中…')).not.toBeInTheDocument();
  });
});

describe('Today 建议行动（advisor）', () => {
  it('渲染"建议行动"区块，findings 按 severity 排序（critical 在前）', async () => {
    renderToday();
    expect(await screen.findByText('建议行动')).toBeInTheDocument();
    const titles = (await screen.findAllByText(/落后于最新发布|尚未配置备份计划/)).map((el) => el.textContent);
    expect(titles).toEqual(['版本落后于最新发布', '尚未配置备份计划']);
    expect(screen.getByText('gbrain upgrade')).toBeInTheDocument();
    expect(screen.getByText('无自动修复命令')).toBeInTheDocument();
  });

  it('findings 为空时显示"一切正常"空态', async () => {
    callMcp.mockResolvedValue({ version: '0.0.0', generated_at: new Date(0).toISOString(), findings: [], worst: null });
    renderToday();
    expect(await screen.findByText('一切正常，无待办建议。')).toBeInTheDocument();
  });

  it('未开 mcp.publish_advisor 时显示降级提示', async () => {
    callMcp.mockRejectedValue(new Error('The advisor is not published over MCP by the brain owner.'));
    renderToday();
    expect(await screen.findByText(/gbrain config set mcp.publish_advisor true/)).toBeInTheDocument();
  });
});
