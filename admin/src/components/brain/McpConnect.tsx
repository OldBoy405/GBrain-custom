import { useState } from 'react';
import { useMcpToken } from '../../lib/McpTokenContext';
import { api } from '../../api';
import { Badge } from './Badge';

/**
 * 可选 Bearer /mcp 通道：粘贴 gbrain_ 令牌后 callMcp 走 Bearer（覆盖 cookie）。
 * variant=panel 为整页门禁样式；variant=compact 供顶栏折叠面板复用。
 */
export function McpConnect({ variant = 'panel' }: { variant?: 'panel' | 'compact' }) {
  const { token, connect, disconnect } = useMcpToken();
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { token: t } = await api.createApiKey(`brain-ui-${Date.now()}`);
      connect(t);
      setVal('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      {variant === 'panel' ? (
        <>
          <h2 className="type-serif text-brain-2xl font-semibold text-ink">连接大脑</h2>
          <p className="mt-2 text-brain-md leading-relaxed text-ink-soft">
            本页数据经 MCP（<span className="font-mono">/mcp</span>）读取，需要一个{' '}
            <span className="font-mono">gbrain_</span> API 令牌。令牌仅保存在本次会话内存中，刷新后需重新连接。
          </p>
        </>
      ) : (
        <p className="text-brain-sm leading-relaxed text-ink-soft">
          粘贴令牌后请求走 <span className="font-mono">/mcp</span> Bearer，覆盖默认 cookie 通道。仅内存保存，刷新失效。
        </p>
      )}

      {token && (
        <div className={`flex items-center gap-2 ${variant === 'panel' ? 'mt-4' : 'mt-3'}`}>
          <Badge tone="ok">Bearer 已连接</Badge>
          <button
            type="button"
            onClick={disconnect}
            className="text-brain-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            断开
          </button>
        </div>
      )}

      <div className={variant === 'panel' ? 'mt-5 flex gap-2' : 'mt-3 flex gap-2'}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="粘贴 gbrain_ 令牌"
          className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-brain-base text-ink outline-none focus:border-emphasis"
        />
        <button
          type="button"
          onClick={() => val.trim() && connect(val.trim())}
          disabled={!val.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-brain-base font-medium text-inverse disabled:opacity-40"
        >
          使用
        </button>
      </div>
      <div className={`flex flex-wrap items-center gap-3 ${variant === 'panel' ? 'mt-3' : 'mt-2'}`}>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-lg border border-hairline px-3 py-1.5 text-brain-base text-ink-soft hover:bg-hairline/40 disabled:opacity-40"
        >
          {busy ? '生成中…' : '一键生成新令牌'}
        </button>
        {variant === 'panel' && (
          <span className="text-brain-sm text-muted">会在「API Keys」中新增一条，可随时撤销。</span>
        )}
      </div>
      {err && <div className="mt-3 text-brain-base text-contra">{err}</div>}
    </>
  );

  if (variant === 'compact') {
    return <div className="w-[min(20rem,80vw)]">{body}</div>;
  }

  return <div className="brain-panel mx-auto mt-10 rounded-2xl border border-hairline bg-surface p-7">{body}</div>;
}
