import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { callMcp } = vi.hoisted(() => ({
  callMcp: vi.fn(),
}));

vi.mock('../../../lib/mcp-client', () => ({
  callMcp,
  buildMcpRequest: vi.fn(),
  parseMcpPayload: vi.fn(),
  setMcpToken: vi.fn(),
  hasMcpToken: vi.fn(() => false),
}));

vi.mock('../../../api', () => ({
  api: {
    stats: vi.fn(),
    health: vi.fn(),
    agents: vi.fn(),
    requests: vi.fn(),
    apiKeys: vi.fn(),
    login: vi.fn(),
    signOutEverywhere: vi.fn(),
    revokeApiKey: vi.fn(),
    updateClientTtl: vi.fn(),
    revokeClient: vi.fn(),
  },
}));

import { Inbox } from '../Inbox';
import { WhyProvider } from '../../../components/brain/WhyProvider';

function renderInbox() {
  return render(
    <WhyProvider>
      <Inbox />
    </WhyProvider>,
  );
}

const item = {
  slug: 'inbox/2026-01-01-a',
  source_id: 'default',
  type: 'note',
  title: 'Inbox A',
  updated_at: '2026-01-01T10:00:00Z',
  source_kind: 'mail',
  source_uri: null,
  ingested_at: '2026-01-01T10:00:00Z',
  status: 'pending_frontmatter',
  tier: 'T2',
  job_id: null,
  error: null,
  preview: 'Hello body',
};

const listResult = {
  items: [item],
  stats: { total: 1, pending_enrich: 1, merging: 0, merged: 0 },
};

describe('Inbox 页面', () => {
  beforeEach(() => {
    callMcp.mockReset();
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_inbox') return Promise.resolve(listResult);
      return Promise.resolve({});
    });
  });

  it('渲染 PageHeader 标题"条待处理"', async () => {
    renderInbox();
    expect(screen.getByText('// 收件箱 · INBOX')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('1 条待处理')).toBeInTheDocument();
    });
  });

  it('PageHeader 下渲染 DeterministicExplainer 教育卡', async () => {
    renderInbox();
    expect(screen.getByText('示意基准（非实时触发）· 数字对应 Why? 面板同一组结论')).toBeInTheDocument();
  });

  it('通过专用 list_inbox 展示真实状态', async () => {
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    expect(screen.getAllByText('待 frontmatter').length).toBeGreaterThan(0);
    expect(callMcp).toHaveBeenCalledWith('list_inbox', { limit: 100 });
  });

  it('无 inbox 页时显示专用空态', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_inbox') {
        return Promise.resolve({
          items: [],
          stats: { total: 0, pending_enrich: 0, merging: 0, merged: 0 },
        });
      }
      return Promise.resolve({});
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('暂无 inbox/ 页面。')).toBeInTheDocument();
    });
  });

  it('全选待 enrich 复选框可再次点击取消全选', async () => {
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    const selectAll = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    const itemCheckbox = screen.getAllByRole('checkbox')[1] as HTMLInputElement;
    expect(selectAll.checked).toBe(false);
    fireEvent.click(selectAll);
    expect(itemCheckbox.checked).toBe(true);
    expect(selectAll.checked).toBe(true);
    fireEvent.click(selectAll);
    expect(itemCheckbox.checked).toBe(false);
    expect(selectAll.checked).toBe(false);
  });

  it('勾选后调用 trigger_inbox_enrichment', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_inbox') return Promise.resolve(listResult);
      if (name === 'trigger_inbox_enrichment') {
        return Promise.resolve({
          accepted: [{ slug: item.slug, job_id: 1, status: 'waiting' }],
          skipped: [],
        });
      }
      return Promise.resolve({});
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    const btn = screen.getByRole('button', { name: /触发 enrichment/ });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('trigger_inbox_enrichment', { slugs: [item.slug] });
    });
  });

  it('勾选后打开丢弃对话框并软删除', async () => {
    callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'list_inbox') return Promise.resolve(listResult);
      if (name === 'discard_inbox_items') {
        return Promise.resolve({ mode: 'soft', discarded: [item.slug], failed: [] });
      }
      return Promise.resolve({});
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /丢弃/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '软删除' }));
    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('discard_inbox_items', {
        slugs: [item.slug],
        mode: 'soft',
      });
    });
  });

  it('永久删除失败时弹窗内展示错误且保持打开', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_inbox') return Promise.resolve(listResult);
      if (name === 'discard_inbox_items') {
        return Promise.resolve({
          mode: 'hard',
          discarded: [],
          failed: [{ slug: item.slug, reason: 'hard_delete_failed' }],
        });
      }
      return Promise.resolve({});
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /丢弃/ }));
    fireEvent.click(screen.getByLabelText(/永久删除/));
    fireEvent.click(screen.getByLabelText(/我理解永久删除不可恢复/));
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }));

    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('discard_inbox_items', {
        slugs: [item.slug],
        mode: 'hard',
        confirm_destructive: true,
      });
    });

    // 失败原因必须在弹窗仍打开时可见——弹窗覆盖整个视口，页面工具栏里的
    // actionError 在弹窗打开时对用户不可见，等价于「没起效」。
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByText(/失败/)).toBeInTheDocument();
    });
    expect(within(dialog).getByText(/hard_delete_failed/)).toBeInTheDocument();
  });

  it('永久删除需勾选确认', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_inbox') return Promise.resolve(listResult);
      if (name === 'discard_inbox_items') {
        return Promise.resolve({ mode: 'hard', discarded: [item.slug], failed: [] });
      }
      return Promise.resolve({});
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /丢弃/ }));
    fireEvent.click(screen.getByLabelText(/永久删除/));
    const hardBtn = screen.getByRole('button', { name: '永久删除' });
    expect(hardBtn).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/我理解永久删除不可恢复/));
    fireEvent.click(hardBtn);
    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('discard_inbox_items', {
        slugs: [item.slug],
        mode: 'hard',
        confirm_destructive: true,
      });
    });
  });

  it('Why 按钮打开 enrichment 原理面板', async () => {
    renderInbox();
    fireEvent.click(screen.getByTestId('why-enrichment-pipeline'));
    expect(screen.getByText('src/core/inbox.ts')).toBeInTheDocument();
  });

  it('点击「新建采集」打开弹窗，提交后调用 put_page 并刷新列表', async () => {
    let listCallCount = 0;
    callMcp.mockImplementation((name: string) => {
      if (name === 'list_inbox') {
        listCallCount += 1;
        return Promise.resolve(listResult);
      }
      if (name === 'put_page') {
        return Promise.resolve({ slug: 'inbox/2026-07-13-abc123', status: 'created' });
      }
      if (name === 'trigger_inbox_enrichment') {
        return Promise.resolve({ accepted: [{ slug: 'inbox/2026-07-13-abc123', job_id: 2, status: 'waiting' }], skipped: [] });
      }
      return Promise.resolve({});
    });

    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    const initialListCalls = listCallCount;

    fireEvent.click(screen.getByRole('button', { name: /新建采集/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('正文 *'), { target: { value: 'captured from admin' } });
    fireEvent.click(screen.getByRole('button', { name: '采集' }));

    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith(
        'put_page',
        expect.objectContaining({
          slug: expect.stringMatching(/^inbox\//),
          content: expect.stringContaining('captured from admin'),
        }),
      );
    });
    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('trigger_inbox_enrichment', { slugs: [expect.stringMatching(/^inbox\//)] });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/已采集 inbox\//)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(listCallCount).toBeGreaterThan(initialListCalls);
    });
  });

  it('选中后懒加载 get_inbox_item', async () => {
    callMcp.mockImplementation((name: string, args?: Record<string, unknown>) => {
      if (name === 'list_inbox') return Promise.resolve(listResult);
      if (name === 'get_inbox_item' && args?.slug === item.slug) {
        return Promise.resolve({
          ...item,
          raw_content: 'Hello raw',
          enriched_content: '---\ntype: note\n---\nHello body',
          frontmatter: { inbox_status: 'pending_frontmatter' },
          typed_links: [],
        });
      }
      return Promise.resolve({});
    });

    renderInbox();
    await waitFor(() => {
      expect(screen.getByText('Inbox A')).toBeInTheDocument();
    });
    screen.getByText('Inbox A').click();

    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('get_inbox_item', { slug: item.slug });
    });
    await waitFor(() => {
      expect(screen.getByText('RAW')).toBeInTheDocument();
    });
  });
});
