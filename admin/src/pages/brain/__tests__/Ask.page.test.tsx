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

import { Ask } from '../Ask';
import { WhyProvider } from '../../../components/brain/WhyProvider';
import { LastQueryProvider, useLastQuery } from '../../../lib/LastQueryContext';

/** query op（trace:true）响应形状；测试里的 trace 字段值不影响断言，给最小占位。 */
function mockQueryResponse(results: unknown[]) {
  return {
    results,
    trace: {
      total_ms: 1,
      cache_status: 'disabled' as const,
      cache_hit: false,
      vector_enabled: true,
      expansion_applied: false,
      intent: null,
      detail_resolved: null,
      autocut: null,
      adaptive_return: null,
      token_budget: null,
    },
  };
}

function renderAsk() {
  return render(
    <WhyProvider>
      <Ask />
    </WhyProvider>,
  );
}

/** 探针：把 LastQueryContext 的当前值渲染到 DOM，供测试断言跨页共享状态。 */
function LastQueryProbe() {
  const { lastQuery } = useLastQuery();
  return (
    <div data-testid="last-query-probe">
      {lastQuery ? `${lastQuery.query}|${lastQuery.resultCount}|${typeof lastQuery.totalMs}` : 'none'}
    </div>
  );
}

function renderAskWithLastQueryProbe() {
  return render(
    <WhyProvider>
      <LastQueryProvider>
        <Ask />
        <LastQueryProbe />
      </LastQueryProvider>
    </WhyProvider>,
  );
}

beforeEach(() => {
  callMcp.mockReset();
  callMcp.mockResolvedValue([]);
  window.location.hash = '';
});

describe('Ask 页面基础渲染', () => {
  it('渲染 PageHeader 标题"问 GBrain 任何关于自己 brain 的问题"', () => {
    renderAsk();
    expect(screen.getByText('问 GBrain 任何关于自己 brain 的问题')).toBeInTheDocument();
    expect(screen.getByText('// 提问 · ASK')).toBeInTheDocument();
  });

  it('渲染搜索 textarea 与检索按钮', () => {
    renderAsk();
    const field = screen.getByPlaceholderText('向大脑提问…');
    expect(field.tagName).toBe('TEXTAREA');
    expect(screen.getByText('检索')).toBeInTheDocument();
  });

  it('输入为空时检索按钮禁用', () => {
    renderAsk();
    const btn = screen.getByText('检索');
    expect(btn).toBeDisabled();
  });

  it('渲染 PipelineSteps 管道示意组件（初始不显示）', () => {
    renderAsk();
    // PipelineSteps 仅在 loading || results 时显示
    expect(screen.queryByText('意图识别')).not.toBeInTheDocument();
  });
});

describe('Ask 预设问题', () => {
  it('渲染预设问题 chips', () => {
    renderAsk();
    expect(screen.getByText('我对 typed-link 这个想法的演变路径是什么？')).toBeInTheDocument();
  });

  it('点击预设 chip 写入 ?q= 到 hash', () => {
    renderAsk();
    const chip = screen.getByText('我关于 RRF K=60 的依据笔记在哪里？');
    fireEvent.click(chip);
    expect(decodeURIComponent(window.location.hash)).toContain('/ask?q=我关于 RRF K=60 的依据笔记在哪里？');
  });

  it('点击预设 chip 后该项高亮为 accent', () => {
    renderAsk();
    const chip = screen.getByText('我关于 RRF K=60 的依据笔记在哪里？');
    fireEvent.click(chip);
    expect(chip.className).toContain('text-accent');
  });
});

describe('Ask 检索结果与来源卡', () => {
  it('检索后渲染来源卡（标题 / 类型 / 分数）', async () => {
    callMcp.mockResolvedValueOnce(mockQueryResponse([
      { slug: 'reading/typed-link.md', title: '长期记忆系统设计', type: 'reading', score: 0.941, snippet: '§4.2 typed-link' },
    ]));
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));

    await waitFor(() => expect(screen.getByText('长期记忆系统设计')).toBeInTheDocument());
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText(/来自步骤: 向量召回/)).toBeInTheDocument();
    // 检索完成后管道栈出现
    expect(screen.getByText('意图识别')).toBeInTheDocument();
  });

  it('无结果时显示空态', async () => {
    callMcp.mockResolvedValueOnce(mockQueryResponse([]));
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'nothing' } });
    fireEvent.click(screen.getByText('检索'));
    await waitFor(() => expect(screen.getByText('无匹配结果。')).toBeInTheDocument());
  });

  it('query 抛错时显示错误态', async () => {
    callMcp.mockRejectedValueOnce(new Error('boom'));
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('检索'));
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});

describe('Ask 按需合成答案（think）', () => {
  it('点击"综合作答"调 think 并渲染答案', async () => {
    callMcp
      .mockResolvedValueOnce(mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }])) // query
      .mockResolvedValueOnce({ answer: '这是合成的叙事答案。', citations: [{ slug: 'a.md' }], modelUsed: 'haiku' }); // think
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));

    await waitFor(() => expect(screen.getByText('让 GBrain 综合作答')).toBeInTheDocument());
    fireEvent.click(screen.getByText('让 GBrain 综合作答'));

    await waitFor(() => expect(screen.getByText('这是合成的叙事答案。')).toBeInTheDocument());
    expect(callMcp).toHaveBeenCalledWith('think', { question: 'typed-link' });
  });
});

describe('Ask 写入跨页共享的最近一次查询状态（LastQueryContext）', () => {
  it('检索成功后 Jobs 页 TraceWaterfall 可读到的 lastQuery 被写入 query/resultCount/totalMs', async () => {
    callMcp.mockResolvedValueOnce(mockQueryResponse([
      { slug: 'a.md', title: 'A', type: 'reading', score: 0.9 },
      { slug: 'b.md', title: 'B', type: 'reading', score: 0.8 },
    ]));
    renderAskWithLastQueryProbe();
    expect(screen.getByTestId('last-query-probe').textContent).toBe('none');

    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));

    await waitFor(() =>
      expect(screen.getByTestId('last-query-probe').textContent).toBe('typed-link|2|number'),
    );
  });
});
