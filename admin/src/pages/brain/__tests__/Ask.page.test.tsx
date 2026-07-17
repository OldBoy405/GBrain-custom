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
    expect(screen.getByText('LLM Wiki 什么时候引入？')).toBeInTheDocument();
    expect(screen.getByText('LLM Wiki 怎么引入？')).toBeInTheDocument();
    expect(screen.getByText('LLM Wiki 实现步骤')).toBeInTheDocument();
    expect(screen.getByText('AI工程团队超级个体与超级团队的打造方法')).toBeInTheDocument();
    expect(screen.getByText('为什么团队里都是用 AI 的高手，产品质量还是没有飞跃，甚至还出现下滑')).toBeInTheDocument();
    expect(screen.getByText('软件研发团队的 AI 转型如何起步？')).toBeInTheDocument();
    expect(screen.getByText('软件研发团队的 AI 转型重点是什么？')).toBeInTheDocument();
  });

  it('点击预设 chip 写入 ?q= 到 hash', () => {
    renderAsk();
    const chip = screen.getByText('LLM Wiki 怎么引入？');
    fireEvent.click(chip);
    expect(decodeURIComponent(window.location.hash)).toContain('/ask?q=LLM Wiki 怎么引入？');
  });

  it('点击预设 chip 后该项高亮为 accent', () => {
    renderAsk();
    const chip = screen.getByText('LLM Wiki 怎么引入？');
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

  it('点击来源命中卡打开右侧原文抽屉（get_page，1/3 屏可拖拽调宽）', async () => {
    callMcp
      .mockResolvedValueOnce(
        mockQueryResponse([
          { slug: 'reading/typed-link.md', title: '长期记忆系统设计', type: 'reading', score: 0.941 },
        ]),
      )
      .mockResolvedValueOnce({
        slug: 'reading/typed-link.md',
        title: '长期记忆系统设计',
        type: 'reading',
        compiled_truth: '这是原文正文，用于验证来源抽屉展开原始 markdown。',
        updated_at: '2026-07-02',
      });
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));

    await waitFor(() =>
      expect(screen.getByTestId('hit-card-reading/typed-link.md')).toBeInTheDocument(),
    );
    // 抽屉初始未开
    expect(screen.queryByTestId('drawer-resize-handle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hit-card-reading/typed-link.md'));
    expect(callMcp).toHaveBeenCalledWith('get_page', { slug: 'reading/typed-link.md', fuzzy: true });
    // 打开后抽屉出现且左边缘可拖拽调宽
    expect(screen.getByTestId('drawer-resize-handle')).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByText('这是原文正文，用于验证来源抽屉展开原始 markdown。'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('更新于 2026-07-02')).toBeInTheDocument();
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
  it('默认不勾选综合作答，检索后不调 think', async () => {
    callMcp.mockResolvedValueOnce(mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }]));
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));

    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    expect(callMcp).toHaveBeenCalledTimes(1);
    expect(callMcp).toHaveBeenCalledWith('query', expect.objectContaining({ query: 'typed-link' }));
    expect(screen.queryByText('// GBrain 答复')).not.toBeInTheDocument();
  });

  it('勾选综合作答后检索会自动调 think 并渲染答案', async () => {
    callMcp
      .mockResolvedValueOnce(mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }]))
      .mockResolvedValueOnce({ answer: '这是合成的叙事答案。', citations: [{ slug: 'a.md' }], modelUsed: 'haiku' });
    renderAsk();
    fireEvent.click(screen.getByTestId('synthesize-answer'));
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索并作答'));

    await waitFor(() => expect(screen.getByText('这是合成的叙事答案。')).toBeInTheDocument());
    expect(callMcp).toHaveBeenCalledWith('think', { question: 'typed-link' });
  });

  it('已有检索结果时勾选不自动补跑 think，需再点检索并作答', async () => {
    callMcp
      .mockResolvedValueOnce(mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }]))
      .mockResolvedValueOnce(mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }]))
      .mockResolvedValueOnce({ answer: '补跑合成答案。', citations: [{ slug: 'a.md' }] });
    renderAsk();
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    expect(callMcp).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('synthesize-answer'));
    expect(callMcp).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('检索并作答'));
    await waitFor(() => expect(screen.getByText('补跑合成答案。')).toBeInTheDocument());
    expect(callMcp).toHaveBeenLastCalledWith('think', { question: 'typed-link' });
  });

  it('点击缺口打开右侧抽屉展示具体缺失信息', async () => {
    callMcp
      .mockResolvedValueOnce(mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }]))
      .mockResolvedValueOnce({
        answer: '部分答案。',
        gaps: ['缺少 llm-wiki 首次引入日期的明确记录', '缺少相关 commit 或会议记录'],
        modelUsed: 'haiku',
      });
    renderAsk();
    fireEvent.click(screen.getByTestId('synthesize-answer'));
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'llm wiki' } });
    fireEvent.click(screen.getByText('检索并作答'));

    await waitFor(() => expect(screen.getByTestId('think-gaps-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('think-gaps-trigger'));

    expect(screen.getByText('证据缺口 · 2')).toBeInTheDocument();
    expect(screen.getByText('缺少 llm-wiki 首次引入日期的明确记录')).toBeInTheDocument();
    expect(screen.getByText('缺少相关 commit 或会议记录')).toBeInTheDocument();
    // 拖拽调宽仅开放给引用抽屉，证据缺口抽屉不受影响
    expect(screen.queryByTestId('drawer-resize-handle')).not.toBeInTheDocument();
  });

  it('引用渲染为「引用：#take行号」内联行，点击打开抽屉展示 page_slug 匹配', async () => {
    callMcp
      .mockResolvedValueOnce(
        mockQueryResponse([
          {
            slug: 'wiki/llm-wiki.md',
            title: 'LLM Wiki 设计稿',
            type: 'reading',
            score: 0.9,
            snippet: '§4.2 引入方案与实现步骤',
          },
        ]),
      )
      .mockResolvedValueOnce({
        answer: '综合答案。',
        citations: [
          { page_slug: 'wiki/llm-wiki.md', row_num: 12, citation_index: 1 },
          { page_slug: 'wiki/does-not-exist.md', row_num: 7, citation_index: 2 },
        ],
        modelUsed: 'haiku',
      });
    renderAsk();
    fireEvent.click(screen.getByTestId('synthesize-answer'));
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'llm wiki' } });
    fireEvent.click(screen.getByText('检索并作答'));

    // 内联引用行：标签「引用：」+ take 行号 chip（#1 #2）
    await waitFor(() => expect(screen.getByText('引用：')).toBeInTheDocument());
    expect(screen.getByTestId('citation-chip-0').textContent).toBe('#1');
    expect(screen.getByTestId('citation-chip-1').textContent).toBe('#2');

    // 抽屉初始未开
    expect(screen.queryByText('page_slug 匹配')).not.toBeInTheDocument();

    // 点击 #1：抽屉展示 slug + take 行号 + 标题 + 摘要（来自本次来源命中匹配）
    fireEvent.click(screen.getByTestId('citation-chip-0'));
    expect(screen.getByText('引用 #1')).toBeInTheDocument();
    expect(screen.getByText('page_slug 匹配')).toBeInTheDocument();
    // 引用抽屉可自由拖拽调宽
    expect(screen.getByTestId('drawer-resize-handle')).toBeInTheDocument();
    expect(screen.getAllByText('wiki/llm-wiki.md').length).toBeGreaterThan(0);
    expect(screen.getByText('take 行号：12')).toBeInTheDocument();
    expect(screen.getAllByText('LLM Wiki 设计稿').length).toBeGreaterThan(0);
    expect(screen.getByText('§4.2 引入方案与实现步骤')).toBeInTheDocument();
    // 匹配来源的元信息：类型徽章 + 相关度分 + recall arm 归因
    // （分数与「来自步骤」在来源命中卡与抽屉里各出现一次，故用 getAllByText）
    expect(screen.getAllByText('reading').length).toBeGreaterThan(0);
    expect(screen.getAllByText('90%').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/来自步骤: 向量召回/).length).toBeGreaterThan(0);

    // 「定位到来源卡」：点击后关闭抽屉，并高亮来源命中列表里对应的命中项
    const hitCard = screen.getByTestId('hit-card-wiki/llm-wiki.md');
    expect(hitCard.className).not.toContain('border-accent');
    fireEvent.click(screen.getByTestId('citation-locate-hit'));
    expect(screen.queryByText('page_slug 匹配')).not.toBeInTheDocument(); // 抽屉已关闭
    expect(hitCard.className).toContain('border-accent');

    // 点击 #2：page_slug 未命中来源，抽屉给出未匹配提示，且不提供「定位到来源卡」
    fireEvent.click(screen.getByTestId('citation-chip-1'));
    expect(screen.getByText('引用 #2')).toBeInTheDocument();
    expect(screen.getByText(/未在本次来源命中里找到匹配的 page_slug/)).toBeInTheDocument();
    expect(screen.queryByTestId('citation-locate-hit')).not.toBeInTheDocument();
  });

  it('引用抽屉「打开原资料」调用 get_page 展开正文；收起再打开命中本地缓存不重复请求', async () => {
    callMcp
      .mockResolvedValueOnce(
        mockQueryResponse([
          { slug: 'wiki/llm-wiki.md', title: 'LLM Wiki 设计稿', type: 'reading', score: 0.9 },
        ]),
      )
      .mockResolvedValueOnce({
        answer: '综合答案。',
        citations: [{ page_slug: 'wiki/llm-wiki.md', row_num: 12, citation_index: 1 }],
      })
      .mockResolvedValueOnce({
        slug: 'wiki/llm-wiki.md',
        title: 'LLM Wiki 设计稿',
        type: 'reading',
        compiled_truth: '完整正文内容，用于验证原资料抽屉能展开原始 markdown。',
        updated_at: '2026-07-01',
      });
    renderAsk();
    fireEvent.click(screen.getByTestId('synthesize-answer'));
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'llm wiki' } });
    fireEvent.click(screen.getByText('检索并作答'));

    await waitFor(() => expect(screen.getByTestId('citation-chip-0')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('citation-chip-0'));

    fireEvent.click(screen.getByTestId('citation-open-original'));
    expect(callMcp).toHaveBeenCalledWith('get_page', { slug: 'wiki/llm-wiki.md', fuzzy: true });
    expect(screen.getByText('加载原资料中…')).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByText('完整正文内容，用于验证原资料抽屉能展开原始 markdown。'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('更新于 2026-07-01')).toBeInTheDocument();
    expect(callMcp).toHaveBeenCalledTimes(3);

    // 收起：正文隐藏，按钮回到「打开原资料」
    fireEvent.click(screen.getByTestId('citation-open-original'));
    expect(
      screen.queryByText('完整正文内容，用于验证原资料抽屉能展开原始 markdown。'),
    ).not.toBeInTheDocument();

    // 再次打开：命中本地缓存，不重复调 get_page
    fireEvent.click(screen.getByTestId('citation-open-original'));
    expect(
      screen.getByText('完整正文内容，用于验证原资料抽屉能展开原始 markdown。'),
    ).toBeInTheDocument();
    expect(callMcp).toHaveBeenCalledTimes(3);
  });

  it('打开原资料失败时显示错误提示', async () => {
    callMcp
      .mockResolvedValueOnce(
        mockQueryResponse([{ slug: 'a.md', title: 'A', type: 'reading', score: 0.9 }]),
      )
      .mockResolvedValueOnce({ answer: '答案。', citations: [{ page_slug: 'a.md', citation_index: 1 }] })
      .mockRejectedValueOnce(new Error('page_not_found'));
    renderAsk();
    fireEvent.click(screen.getByTestId('synthesize-answer'));
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('检索并作答'));

    await waitFor(() => expect(screen.getByTestId('citation-chip-0')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('citation-chip-0'));
    fireEvent.click(screen.getByTestId('citation-open-original'));

    await waitFor(() => expect(screen.getByText('加载失败：page_not_found')).toBeInTheDocument());
  });
});

describe('Ask Trace Waterfall', () => {
  it('检索成功后 Ask 页底部渲染 TraceWaterfall', async () => {
    callMcp.mockResolvedValueOnce(mockQueryResponse([
      { slug: 'a.md', title: 'A', type: 'reading', score: 0.9 },
    ]));
    render(
      <WhyProvider>
        <LastQueryProvider>
          <Ask />
        </LastQueryProvider>
      </WhyProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText('向大脑提问…'), { target: { value: 'typed-link' } });
    fireEvent.click(screen.getByText('检索'));

    await waitFor(() => expect(screen.getByText('// TRACE WATERFALL · 最近一次 ask')).toBeInTheDocument());
    expect(screen.getByText('"typed-link"')).toBeInTheDocument();
  });
});

describe('Ask 写入跨页共享的最近一次查询状态（LastQueryContext）', () => {
  it('检索成功后 lastQuery 被写入 query/resultCount/totalMs', async () => {
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
