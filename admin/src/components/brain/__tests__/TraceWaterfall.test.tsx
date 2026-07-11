import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { WhyProvider } from '../WhyProvider';
import { TraceWaterfall } from '../TraceWaterfall';
import { LastQueryProvider, useLastQuery } from '../../../lib/LastQueryContext';

/** 挂载即写入一条 lastQuery，绕开真实 Ask 页流程直接驱动 TraceWaterfall 的非空态。 */
function Seed({ query }: { query: string }) {
  const { setLastQuery } = useLastQuery();
  useEffect(() => {
    setLastQuery({ query, totalMs: 48, resultCount: 0, ts: 1 });
  }, [query, setLastQuery]);
  return null;
}

function renderWaterfall() {
  return render(
    <WhyProvider>
      <LastQueryProvider>
        <Seed query="我什么时候开始关注 typed-link 这个想法的？" />
        <TraceWaterfall />
      </LastQueryProvider>
    </WhyProvider>,
  );
}

describe('TraceWaterfall · SPAN DETAIL', () => {
  it('llm 步骤（精排）展示 kind=llm 且烧 token', () => {
    renderWaterfall();
    fireEvent.click(screen.getByText('精排'));
    expect(screen.getByText('llm')).toBeInTheDocument();
    expect(screen.getByText('烧 · 调用模型')).toBeInTheDocument();
  });

  it('db 步骤（向量召回）展示 kind=db 且不烧 token', () => {
    renderWaterfall();
    fireEvent.click(screen.getByText('向量召回'));
    expect(screen.getByText('db')).toBeInTheDocument();
    expect(screen.getByText('不烧 · 纯 DB/CPU')).toBeInTheDocument();
  });

  it('cpu 步骤（RRF 融合）展示 kind=cpu 且不烧 token', () => {
    renderWaterfall();
    fireEvent.click(screen.getByText('RRF 融合'));
    expect(screen.getByText('cpu')).toBeInTheDocument();
    expect(screen.getByText('不烧 · 纯 DB/CPU')).toBeInTheDocument();
  });

  it('说明该分类为结构性，非本次查询实测计费', () => {
    renderWaterfall();
    fireEvent.click(screen.getByText('精排'));
    expect(screen.getByText(/非本次查询的实测计费/)).toBeInTheDocument();
  });
});
