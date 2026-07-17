import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

import { NewCaptureDialog } from '../NewCaptureDialog';

function makeFile(name: string, content: string, opts?: { relativePath?: string }): File {
  const file = new File([content], name, { type: 'text/plain' });
  if (opts?.relativePath) {
    Object.defineProperty(file, 'webkitRelativePath', { value: opts.relativePath, configurable: true });
  }
  return file;
}

function pickFiles(input: HTMLElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

describe('NewCaptureDialog', () => {
  beforeEach(() => {
    callMcp.mockReset();
    callMcp.mockImplementation((name: string) => {
      if (name === 'put_page') return Promise.resolve({ slug: 'inbox/2026-07-13-abc123', status: 'created' });
      if (name === 'trigger_inbox_enrichment') {
        return Promise.resolve({ accepted: [], skipped: [] });
      }
      return Promise.resolve({});
    });
  });

  it('open=false 时不渲染', () => {
    render(<NewCaptureDialog open={false} onClose={vi.fn()} onCaptured={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('open=true 时渲染标题与两个可用 tab', () => {
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('新建采集')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '文本/Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '结构化条目' })).toBeInTheDocument();
  });

  it('URL / 文件 tab 被禁用', () => {
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'URL' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '文件' })).toBeDisabled();
  });

  it('正文为空时提交按钮 disabled', () => {
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
    expect(screen.getByRole('button', { name: '采集' })).toBeDisabled();
  });

  it('文本/Markdown tab：填写正文后提交，调用 put_page 且默认触发 enrichment', async () => {
    const onCaptured = vi.fn();
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={onCaptured} />);

    fireEvent.change(screen.getByLabelText('正文 *'), { target: { value: 'hello world' } });
    const submitBtn = screen.getByRole('button', { name: '采集' });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith(
        'put_page',
        expect.objectContaining({
          slug: expect.stringMatching(/^inbox\/\d{4}-\d{2}-\d{2}-[0-9a-f]{6}$/),
          content: expect.stringContaining('inbox_status: pending_frontmatter'),
        }),
      );
    });
    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('trigger_inbox_enrichment', {
        slugs: [expect.stringMatching(/^inbox\//)],
      });
    });
    await waitFor(() => {
      expect(onCaptured).toHaveBeenCalledWith({
        slugs: [expect.stringMatching(/^inbox\/\d{4}-\d{2}-\d{2}-[0-9a-f]{6}$/)],
        failed: [],
      });
    });
  });

  it('取消勾选「立即触发 enrichment」后提交，不调用 trigger_inbox_enrichment', async () => {
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('正文 *'), { target: { value: 'hello world' } });
    fireEvent.click(screen.getByLabelText('采集后立即触发 enrichment'));
    fireEvent.click(screen.getByRole('button', { name: '采集' }));

    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith('put_page', expect.anything());
    });
    expect(callMcp).not.toHaveBeenCalledWith('trigger_inbox_enrichment', expect.anything());
  });

  it('结构化条目 tab：标题必填，未填时提交按钮 disabled', () => {
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '结构化条目' }));
    fireEvent.change(screen.getByLabelText('正文 *'), { target: { value: 'body text' } });
    expect(screen.getByRole('button', { name: '采集' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('标题 *'), { target: { value: 'My Title' } });
    expect(screen.getByRole('button', { name: '采集' })).not.toBeDisabled();
  });

  it('结构化条目 tab：提交时 tags 按逗号切分并写入 content', async () => {
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '结构化条目' }));
    fireEvent.change(screen.getByLabelText('标题 *'), { target: { value: 'My Title' } });
    fireEvent.change(screen.getByLabelText('标签（逗号分隔，可选）'), { target: { value: 'a, b' } });
    fireEvent.change(screen.getByLabelText('正文 *'), { target: { value: 'structured body' } });
    fireEvent.click(screen.getByRole('button', { name: '采集' }));

    await waitFor(() => {
      expect(callMcp).toHaveBeenCalledWith(
        'put_page',
        expect.objectContaining({
          content: expect.stringContaining('tags: ["a", "b"]'),
        }),
      );
    });
  });

  it('put_page 失败时展示错误且不关闭', async () => {
    callMcp.mockImplementation((name: string) => {
      if (name === 'put_page') return Promise.reject(new Error('write failed'));
      return Promise.resolve({});
    });
    const onCaptured = vi.fn();
    render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={onCaptured} />);
    fireEvent.change(screen.getByLabelText('正文 *'), { target: { value: 'hello world' } });
    fireEvent.click(screen.getByRole('button', { name: '采集' }));

    await waitFor(() => {
      expect(screen.getByText('write failed')).toBeInTheDocument();
    });
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it('Esc 关闭弹窗', () => {
    const onClose = vi.fn();
    render(<NewCaptureDialog open onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('点击取消按钮关闭弹窗', () => {
    const onClose = vi.fn();
    render(<NewCaptureDialog open onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalled();
  });

  describe('选择文件 / 文件夹', () => {
    it('单文件选择：一行列表，提交后 onCaptured 收到一个 slug', async () => {
      const onCaptured = vi.fn();
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={onCaptured} />);

      pickFiles(screen.getByLabelText('选择文件'), [makeFile('a.md', '# Hello A')]);
      await waitFor(() => {
        expect(screen.getByText('a.md')).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole('button', { name: '采集 1 个文件' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(callMcp).toHaveBeenCalledWith(
          'put_page',
          expect.objectContaining({ content: expect.stringContaining('title: "a"') }),
        );
      });
      await waitFor(() => {
        expect(onCaptured).toHaveBeenCalledWith({
          slugs: [expect.stringMatching(/^inbox\//)],
          failed: [],
        });
      });
    });

    it('多文件选择：依次调用 put_page N 次', async () => {
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);

      pickFiles(screen.getByLabelText('选择文件'), [
        makeFile('a.md', 'content A'),
        makeFile('b.md', 'content B'),
      ]);
      await waitFor(() => {
        expect(screen.getByText('a.md')).toBeInTheDocument();
        expect(screen.getByText('b.md')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '采集 2 个文件' }));

      await waitFor(() => {
        expect(callMcp.mock.calls.filter((c) => c[0] === 'put_page')).toHaveLength(2);
      });
    });

    it('文件夹选择：非文本文件被过滤，忽略计数可见', async () => {
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);

      pickFiles(screen.getByLabelText('选择文件夹'), [
        makeFile('a.md', 'text content', { relativePath: 'notes/a.md' }),
        makeFile('photo.png', 'binary-ish', { relativePath: 'notes/photo.png' }),
      ]);

      await waitFor(() => {
        expect(screen.getByText('notes/a.md')).toBeInTheDocument();
      });
      expect(screen.queryByText('notes/photo.png')).not.toBeInTheDocument();
      expect(screen.getByText('已忽略 1 个非文本文件')).toBeInTheDocument();
    });

    it('一条失败不影响其余：失败行展示错误，onCaptured 仍带成功 slug + failed', async () => {
      callMcp.mockImplementation((name: string, args: Record<string, unknown>) => {
        if (name === 'put_page') {
          if ((args.content as string).includes('BOOM')) return Promise.reject(new Error('write failed'));
          return Promise.resolve({ slug: args.slug, status: 'created' });
        }
        return Promise.resolve({});
      });
      const onCaptured = vi.fn();
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={onCaptured} />);

      pickFiles(screen.getByLabelText('选择文件'), [
        makeFile('good.md', 'good content'),
        makeFile('bad.md', 'BOOM content'),
      ]);
      await waitFor(() => {
        expect(screen.getByText('good.md')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '采集 2 个文件' }));

      await waitFor(() => {
        expect(screen.getByText('write failed')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(onCaptured).toHaveBeenCalledWith({
          slugs: [expect.stringMatching(/^inbox\//)],
          failed: [{ name: 'bad.md', error: 'write failed' }],
        });
      });
    });

    it('全部失败：不调用 onCaptured，弹窗保持打开', async () => {
      callMcp.mockImplementation((name: string) => {
        if (name === 'put_page') return Promise.reject(new Error('always fails'));
        return Promise.resolve({});
      });
      const onCaptured = vi.fn();
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={onCaptured} />);

      pickFiles(screen.getByLabelText('选择文件'), [makeFile('a.md', 'content A')]);
      await waitFor(() => {
        expect(screen.getByText('a.md')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: '采集 1 个文件' }));

      await waitFor(() => {
        expect(screen.getByText('always fails')).toBeInTheDocument();
      });
      expect(onCaptured).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('超过 200 个文件：截断提示可见，只发生 200 次 put_page 调用', async () => {
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);

      const manyFiles = Array.from({ length: 210 }, (_, i) => makeFile(`f${i}.md`, `content ${i}`));
      pickFiles(screen.getByLabelText('选择文件'), manyFiles);

      await waitFor(() => {
        expect(screen.getByText('仅处理前 200 个文件（另有 10 个未处理，可分批选择）')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '采集 200 个文件' }));

      await waitFor(() => {
        expect(callMcp.mock.calls.filter((c) => c[0] === 'put_page')).toHaveLength(200);
      });
    });

    it('清除选择后改回手动粘贴模式', async () => {
      render(<NewCaptureDialog open onClose={vi.fn()} onCaptured={vi.fn()} />);
      pickFiles(screen.getByLabelText('选择文件'), [makeFile('a.md', 'content A')]);
      await waitFor(() => {
        expect(screen.getByText('a.md')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '清除选择，改回手动粘贴' }));
      expect(screen.queryByText('a.md')).not.toBeInTheDocument();
      expect(screen.getByLabelText('正文 *')).toBeInTheDocument();
    });
  });
});
