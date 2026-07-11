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

import { Synthesize } from '../Synthesize';
import { WhyProvider } from '../../../components/brain/WhyProvider';
import type { FindConflictsResult, CompileTruthResult } from '../../../lib/op-types';

const GROUPS: FindConflictsResult = {
  source: 'probe',
  groups: [
    {
      id: 'g-dream',
      topic: 'Dream Cycle 9 phase 顺序',
      source: 'probe',
      severity: 'high',
      members: [
        {
          slug: 'concepts/dream-cycle',
          title: 'Dream Cycle = 9 phase',
          type: 'concept',
          updated_at: '2026-04-30T00:00:00.000Z',
          excerpt: 'lint → backlinks → sync …',
        },
        {
          slug: 'daily/2026-04-15',
          title: '理解 dream cycle 语义锁链',
          type: 'daily',
          updated_at: '2026-04-15T00:00:00.000Z',
          excerpt: '顺序被语义锁住…',
        },
      ],
    },
  ],
};

const COMPILED: CompileTruthResult = {
  compiled_markdown: '## Dream Cycle\n\n9 phases, order locked.',
  diff: [
    { op: 'keep', text: '9 phase 顺序' },
    { op: 'merge', text: '顺序被语义锁住' },
  ],
  model_used: 'opus',
  sources: ['concepts/dream-cycle', 'daily/2026-04-15'],
  warnings: [],
};

function renderPage() {
  return render(
    <WhyProvider>
      <Synthesize />
    </WhyProvider>,
  );
}

beforeEach(() => {
  callMcp.mockReset();
  window.location.hash = '';
  callMcp.mockImplementation((name: string) => {
    if (name === 'find_conflicts') return Promise.resolve(GROUPS);
    if (name === 'compile_truth') return Promise.resolve(COMPILED);
    if (name === 'adopt_compiled_truth')
      return Promise.resolve({ slug: 'compiled/dream', status: 'imported', compiled_from: COMPILED.sources });
    return Promise.resolve({});
  });
});

describe('真理沉淀 · Compiled Truth 工作台', () => {
  it('渲染标题真理沉淀与冲突组列表（无自由提问框）', async () => {
    renderPage();
    expect(screen.getByText('真理沉淀')).toBeInTheDocument();
    // 对齐案例：不应有 think 问答的提问输入框。
    expect(screen.queryByPlaceholderText('想让大脑综合思考的问题…')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Dream Cycle 9 phase 顺序')).toBeInTheDocument());
    expect(screen.getByText(/2 份冲突 markdown/)).toBeInTheDocument();
  });

  it('默认选中第一组并渲染候选卡', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Dream Cycle = 9 phase')).toBeInTheDocument());
    expect(screen.getByText('concepts/dream-cycle')).toBeInTheDocument();
    expect(screen.getByText('{type: concept}')).toBeInTheDocument();
  });

  it('点击 Compile 调 compile_truth 并渲染产出 + diff', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('compile-button')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('compile-button'));

    await waitFor(() => expect(screen.getByTestId('compile-output')).toBeInTheDocument());
    expect(callMcp).toHaveBeenCalledWith('compile_truth', {
      slugs: ['concepts/dream-cycle', 'daily/2026-04-15'],
      topic: 'Dream Cycle 9 phase 顺序',
    });
    expect(screen.getByText(/9 phases, order locked/)).toBeInTheDocument();
    expect(screen.getByText('keep')).toBeInTheDocument();
    expect(screen.getByText('merge')).toBeInTheDocument();
  });

  it('点击采纳调 adopt_compiled_truth 并显示成功提示', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('compile-button')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('compile-button'));
    await waitFor(() => expect(screen.getByTestId('adopt-button')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('adopt-button'));

    await waitFor(() => expect(screen.getByText(/已采纳/)).toBeInTheDocument());
    expect(callMcp).toHaveBeenCalledWith(
      'adopt_compiled_truth',
      expect.objectContaining({ compiled_markdown: COMPILED.compiled_markdown, sources: COMPILED.sources }),
    );
  });

  it('空冲突组时显示中文引导（覆盖后端英文 note）', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'find_conflicts')
        return Promise.resolve({
          groups: [],
          source: 'probe',
          note: 'No conflict groups. Run `gbrain eval suspected-contradictions` to populate the probe, or pass a `topic` to cluster live.',
        });
      return Promise.resolve({});
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/暂无冲突组：可运行 `gbrain eval suspected-contradictions`/)).toBeInTheDocument(),
    );
  });
});
