import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useMcpToken } from '../../lib/McpTokenContext';
import { McpConnect } from './McpConnect';
import { Badge } from './Badge';

export function BrainTopBar({
  pageLabel,
  navigate,
}: {
  pageLabel: string;
  navigate: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const { token } = useMcpToken();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/ask?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="brain-brand-strip flex items-center border-b border-hairline bg-elevated">
      <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-[clamp(1rem,3vw,1.5rem)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2 font-mono text-brain-sm text-muted">
            <span>GBrain</span>
            <span aria-hidden>/</span>
          </div>
          <h1 className="type-serif truncate text-brain-xl font-medium text-ink">{pageLabel}</h1>
        </div>

        <form onSubmit={submit} className="brain-topbar-search-form relative hidden justify-self-center md:block">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 page · concept · trace…"
            className="brain-topbar-search"
          />
          <kbd className="brain-topbar-search-kbd pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-hairline px-1 py-0.5 font-mono text-brain-xs text-muted">
            ⌘K
          </kbd>
        </form>

        <div className="hidden justify-self-end md:block">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-hairline bg-canvas px-2.5 py-1.5 font-mono text-brain-sm text-ink-soft transition hover:bg-subtle hover:text-ink [&::-webkit-details-marker]:hidden">
              <span>高级：Bearer 令牌</span>
              {token ? <Badge tone="ok">已连接</Badge> : null}
              <ChevronDown
                size={13}
                className="text-muted transition group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.375rem)] z-50 rounded-xl border border-hairline bg-elevated p-4 shadow-lg">
              <McpConnect variant="compact" />
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
