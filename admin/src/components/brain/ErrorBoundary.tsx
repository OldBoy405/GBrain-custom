import React from 'react';

/**
 * Brain 表层错误边界：单个页面渲染崩溃时兜底展示，不至于整个 SPA 白屏。
 * 在 App 里以 route.path 作 key 包裹，导航到新页会自动重置。
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="brain-panel mx-auto px-8 py-16 text-center">
          <div className="type-serif text-brain-2xl font-semibold text-ink">页面出错了</div>
          <p className="mt-2 text-brain-md text-ink-soft">该页面渲染时抛出异常，其他页面不受影响。</p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface px-4 py-3 text-left font-mono text-brain-sm text-muted">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-brain-base font-medium text-inverse"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
