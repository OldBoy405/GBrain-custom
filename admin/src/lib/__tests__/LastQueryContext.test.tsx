import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LastQueryProvider, useLastQuery } from '../LastQueryContext';

function Probe() {
  const { lastQuery, setLastQuery } = useLastQuery();
  return (
    <div>
      <div data-testid="probe">{lastQuery ? `${lastQuery.query}|${lastQuery.resultCount}|${lastQuery.totalMs}` : 'none'}</div>
      <button
        type="button"
        onClick={() => setLastQuery({ query: 'typed-link', totalMs: 120, resultCount: 3, ts: 1 })}
      >
        写入
      </button>
    </div>
  );
}

describe('LastQueryContext', () => {
  it('默认值为 null（未包 Provider 也安全渲染）', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('none');
  });

  it('setLastQuery 更新后当前消费者读到最新值', () => {
    render(
      <LastQueryProvider>
        <Probe />
      </LastQueryProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('none');
    fireEvent.click(screen.getByText('写入'));
    expect(screen.getByTestId('probe').textContent).toBe('typed-link|3|120');
  });

  it('同一 Provider 下多个消费者共享同一状态', () => {
    render(
      <LastQueryProvider>
        <Probe />
        <Probe />
      </LastQueryProvider>,
    );
    fireEvent.click(screen.getAllByText('写入')[0]);
    const probes = screen.getAllByTestId('probe');
    expect(probes[0].textContent).toBe('typed-link|3|120');
    expect(probes[1].textContent).toBe('typed-link|3|120');
  });
});
