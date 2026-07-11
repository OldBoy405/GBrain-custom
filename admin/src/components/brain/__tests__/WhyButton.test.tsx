import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { WHY_TOPICS, type WhyTopicId } from '../../../lib/why-topics';
import { WhyButton } from '../WhyButton';
import { WhyProvider } from '../WhyProvider';

function renderWhy(topic: 'enrichment-pipeline' | 'typed-link-extraction' = 'enrichment-pipeline') {
  return render(
    <WhyProvider>
      <WhyButton topic={topic} />
    </WhyProvider>,
  );
}

describe('WhyButton', () => {
  it('点击 enrichment-pipeline 打开面板并展示标题与源码', () => {
    renderWhy('enrichment-pipeline');
    fireEvent.click(screen.getByTestId('why-enrichment-pipeline'));
    expect(screen.getByText(/为什么 enrichment 是 4 步串行/)).toBeInTheDocument();
    expect(screen.getByText('src/core/inbox.ts')).toBeInTheDocument();
    expect(screen.getByText('可审计')).toBeInTheDocument();
  });

  it('点击 typed-link-extraction 展示 link-extraction 引用', () => {
    renderWhy('typed-link-extraction');
    fireEvent.click(screen.getByTestId('why-typed-link-extraction'));
    expect(screen.getByText(/为什么 typed-link 是 4 个正则/)).toBeInTheDocument();
    expect(screen.getByText('src/core/link-extraction.ts')).toBeInTheDocument();
  });

  it('Escape 关闭面板', () => {
    renderWhy();
    fireEvent.click(screen.getByTestId('why-enrichment-pipeline'));
    expect(screen.getByText('src/core/inbox.ts')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('src/core/inbox.ts')).not.toBeInTheDocument();
  });

  it('点击遮罩关闭面板', () => {
    renderWhy();
    fireEvent.click(screen.getByTestId('why-enrichment-pipeline'));
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    expect(screen.queryByText('src/core/inbox.ts')).not.toBeInTheDocument();
  });

  it('button 带 data-why-topic 与 title tooltip', () => {
    renderWhy();
    const btn = screen.getByTestId('why-enrichment-pipeline');
    expect(btn).toHaveAttribute('data-why-topic', 'enrichment-pipeline');
    expect(btn).toHaveAttribute('title', '为什么 enrichment 是 4 步串行 · 不是一次 LLM 总结？');
  });

  it('点击 sse-activity-feed 展示 SSE 说明', () => {
    render(
      <WhyProvider>
        <WhyButton topic="sse-activity-feed" />
      </WhyProvider>,
    );
    fireEvent.click(screen.getByTestId('why-sse-activity-feed'));
    expect(screen.getByText(/为什么活动流用 SSE 推送/)).toBeInTheDocument();
    expect(screen.getByText('admin/src/lib/useSSE.ts')).toBeInTheDocument();
  });

  it('全部 12 条 topic 均有正文与源码引用', () => {
    const ids = Object.keys(WHY_TOPICS) as WhyTopicId[];
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      const t = WHY_TOPICS[id];
      expect(t.bullets.length).toBeGreaterThanOrEqual(3);
      expect(t.sources.length).toBeGreaterThanOrEqual(2);
      expect(t.summary).toBeTruthy();
      expect(t.bullets[0]).not.toMatch(/待补全/);
    }
  });
});
