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

// canvas 在 jsdom 不可用：把 react-force-graph-2d 换成占位组件。
vi.mock('react-force-graph-2d', () => ({
  default: () => <div data-testid="force-graph" />,
}));

import { Graph } from '../Graph';
import { WhyProvider } from '../../../components/brain/WhyProvider';

function renderGraph() {
  return render(
    <WhyProvider>
      <Graph />
    </WhyProvider>,
  );
}

const STATS = { page_count: 123, link_count: 456, pages_by_type: { concept: 10, person: 5 } };

beforeEach(() => {
  callMcp.mockReset();
  callMcp.mockImplementation((name: string) => {
    if (name === 'get_stats') return Promise.resolve(STATS);
    if (name === 'traverse_graph')
      return Promise.resolve([
        { slug: 'root', title: 'Root', type: 'concept', depth: 0, links: [{ to_slug: 'b', link_type: 'refs' }] },
      ]);
    return Promise.resolve([]);
  });
  window.location.hash = '';
});

describe('Graph 页面基础渲染', () => {
  it('渲染 PageHeader 标题（节点/typed-link 真实统计）', async () => {
    renderGraph();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('123 节点 · 456 typed-link'));
  });

  it('渲染类型图例', async () => {
    renderGraph();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('123 节点 · 456 typed-link'));
    expect(screen.getByText(/concept/)).toBeInTheDocument();
    expect(screen.getByText(/person/)).toBeInTheDocument();
  });

  it('get_stats 失败时降级 schema_stats（仅节点数，无边数）', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'get_stats') return Promise.reject(new Error('forbidden'));
      if (name === 'schema_stats')
        return Promise.resolve({ aggregate: { total_pages: 77, by_type: [{ type: 'concept', count: 7 }] } });
      return Promise.resolve([]);
    });
    renderGraph();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('77 节点'));
  });
});

describe('Live 抽边演示', () => {
  it('点击 Extract 从默认文案抽出 4 条 typed-link', () => {
    renderGraph();
    fireEvent.click(screen.getByTestId('extract-button'));
    const out = screen.getByTestId('typed-link-output');
    expect(out).toHaveTextContent('抽出 4 条');
    expect(out).toHaveTextContent('invested_in');
    expect(out).toHaveTextContent('works_at');
  });
});

describe('探索器', () => {
  it('输入根 slug 展开会调用 traverse_graph 并渲染图', async () => {
    renderGraph();
    const input = screen.getByPlaceholderText('根页面 slug，例如 concepts/gbrain');
    fireEvent.change(input, { target: { value: 'root' } });
    fireEvent.click(screen.getByText('展开'));
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('traverse_graph', { slug: 'root', depth: 2 }),
    );
    await waitFor(() => expect(screen.getByText(/个节点 · 根/)).toBeInTheDocument());
  });

  it('#/graph?q=<slug> 深链进页自动展开', async () => {
    window.location.hash = '#/graph?q=deep';
    renderGraph();
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('traverse_graph', { slug: 'deep', depth: 2 }),
    );
  });
});

describe('link_type / direction 过滤', () => {
  it('未设置过滤时请求参数不带 link_type/direction（保持旧行为）', async () => {
    renderGraph();
    const input = screen.getByPlaceholderText('根页面 slug，例如 concepts/gbrain');
    fireEvent.change(input, { target: { value: 'root' } });
    fireEvent.click(screen.getByText('展开'));
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('traverse_graph', { slug: 'root', depth: 2 }),
    );
  });

  it('设置边类型过滤后请求带 link_type，且按 GraphPath[] 转换渲染', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'get_stats') return Promise.resolve(STATS);
      if (name === 'traverse_graph')
        return Promise.resolve([
          { from_slug: 'root', to_slug: 'b', link_type: 'invested_in', context: '', depth: 1 },
        ]);
      return Promise.resolve([]);
    });
    renderGraph();
    fireEvent.change(screen.getByPlaceholderText('根页面 slug，例如 concepts/gbrain'), {
      target: { value: 'root' },
    });
    fireEvent.change(screen.getByPlaceholderText('边类型过滤，如 invested_in（留空 = 不过滤）'), {
      target: { value: 'invested_in' },
    });
    fireEvent.click(screen.getByText('展开'));
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('traverse_graph', {
        slug: 'root',
        depth: 2,
        link_type: 'invested_in',
      }),
    );
    await waitFor(() => expect(screen.getByText(/个节点 · 根/)).toBeInTheDocument());
    expect(screen.getByText('按边过滤中 · 类型着色不可用')).toBeInTheDocument();
  });

  it('方向选择 in 时请求带 direction', async () => {
    renderGraph();
    fireEvent.change(screen.getByPlaceholderText('根页面 slug，例如 concepts/gbrain'), {
      target: { value: 'root' },
    });
    fireEvent.change(screen.getByDisplayValue('方向：出边'), { target: { value: 'in' } });
    fireEvent.click(screen.getByText('展开'));
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('traverse_graph', { slug: 'root', depth: 2, direction: 'in' }),
    );
  });
});

describe('冷启动空态引导', () => {
  it('list_pages 返回候选页时渲染示例 chip，点击触发展开', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'get_stats') return Promise.resolve(STATS);
      if (name === 'list_pages') return Promise.resolve([{ slug: 'concepts/gbrain', title: 'GBrain' }]);
      if (name === 'traverse_graph')
        return Promise.resolve([
          { slug: 'root', title: 'Root', type: 'concept', depth: 0, links: [{ to_slug: 'b', link_type: 'refs' }] },
        ]);
      return Promise.resolve([]);
    });
    renderGraph();
    const chip = await screen.findByTestId('graph-example-chip');
    expect(chip).toHaveTextContent('GBrain');
    fireEvent.click(chip);
    await waitFor(() =>
      expect(callMcp).toHaveBeenCalledWith('traverse_graph', { slug: 'concepts/gbrain', depth: 2 }),
    );
  });

  it('list_pages 无候选页时不渲染 chip', () => {
    renderGraph();
    expect(screen.queryByTestId('graph-example-chip')).not.toBeInTheDocument();
  });
});
