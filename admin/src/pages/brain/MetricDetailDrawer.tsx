import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Badge, Drawer, AsyncState } from '../../components/brain';
import type { AgentRow, ApiKeyRow, RequestLogResult, RequestLogRow } from '../../lib/op-types';
import { scopeTone, statusTone, timeAgo } from './format';

/** 运营概览 6 张指标卡对应的详情 metric key。 */
export type MetricKey =
  | 'connected_agents'
  | 'requests_today'
  | 'active_tokens'
  | 'active_api_keys'
  | 'expiring_soon'
  | 'error_rate';

type LoadResult =
  | { kind: 'agents'; rows: AgentRow[] }
  | { kind: 'requests'; rows: RequestLogRow[] }
  | { kind: 'apiKeys'; rows: ApiKeyRow[] };

type MetricConfig = {
  title: string;
  /** 说明注记（活跃令牌/即将过期令牌无逐条数据源，复用 Agent 列表 + 注记）。 */
  note?: string;
  load: () => Promise<LoadResult>;
};

const METRIC_CONFIG: Record<MetricKey, MetricConfig> = {
  connected_agents: {
    title: '连接的 Agent',
    load: async () => ({
      kind: 'agents',
      rows: ((await api.agents()) as AgentRow[]).filter((a) => a.auth_type === 'oauth'),
    }),
  },
  requests_today: {
    title: '今日请求 · 最近 50 条',
    load: async () => ({ kind: 'requests', rows: ((await api.requests(1)) as RequestLogResult).rows }),
  },
  active_tokens: {
    title: '活跃令牌 · 持令牌的 Agent',
    note: '本机未向前端暴露单条令牌到期时间；下面是当前持有活跃令牌的 Agent。',
    load: async () => ({
      kind: 'agents',
      rows: ((await api.agents()) as AgentRow[]).filter((a) => a.status === 'active'),
    }),
  },
  active_api_keys: {
    title: 'API Keys',
    load: async () => ({
      kind: 'apiKeys',
      rows: ((await api.apiKeys()) as ApiKeyRow[]).filter((k) => k.status === 'active'),
    }),
  },
  expiring_soon: {
    title: '即将过期令牌 · 持令牌的 Agent',
    note: '本机未向前端暴露单条令牌到期时间；下面是当前持有活跃令牌的 Agent（含 token TTL）。',
    load: async () => ({
      kind: 'agents',
      rows: ((await api.agents()) as AgentRow[]).filter((a) => a.status === 'active'),
    }),
  },
  error_rate: {
    title: '24h 错误请求',
    load: async () => ({
      kind: 'requests',
      rows: ((await api.requests(1, '&status=error')) as RequestLogResult).rows,
    }),
  },
};

function AgentList({ rows }: { rows: AgentRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((a) => (
        <li key={a.id} className="rounded-lg border border-hairline bg-canvas px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-brain-sm text-ink">{a.name || a.id}</span>
            <Badge tone={a.status === 'active' ? 'ok' : 'muted'}>{a.status}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {a.scope
              ? a.scope.split(/\s+/).filter(Boolean).map((s) => (
                  <Badge key={s} tone={scopeTone[s] ?? 'muted'}>{s}</Badge>
                ))
              : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-brain-xs text-muted">
            <span>今日 {a.requests_today ?? 0} 次</span>
            <span>累计 {a.total_requests ?? 0} 次</span>
            {a.token_ttl != null && <span>TTL {a.token_ttl}s</span>}
            <span>最近活跃 {timeAgo(a.last_used_at ?? undefined)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RequestList({ rows }: { rows: RequestLogRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={String(r.id)} className="rounded-lg border border-hairline bg-canvas px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-brain-sm text-ink">{r.operation}</span>
            <Badge tone={statusTone(r.status)}>{r.status ?? '—'}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-brain-xs text-muted">
            <span className="truncate">{r.agent_name || r.token_name}</span>
            <span>{r.latency_ms != null ? `${r.latency_ms} ms` : '—'}</span>
            <span>{timeAgo(r.created_at)}</span>
          </div>
          {r.error_message && (
            <div className="mt-1.5 rounded border border-hairline bg-surface px-2 py-1 font-mono text-brain-xs" style={{ color: 'var(--color-contra)' }}>
              {r.error_message}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ApiKeyList({ rows }: { rows: ApiKeyRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((k) => (
        <li key={k.id} className="rounded-lg border border-hairline bg-canvas px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-brain-sm text-ink">{k.name}</span>
            <Badge tone={k.status === 'active' ? 'ok' : 'muted'}>{k.status}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-brain-xs text-muted">
            <span>创建 {timeAgo(k.created_at)}</span>
            <span>最近使用 {timeAgo(k.last_used_at ?? undefined)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultList({ result }: { result: LoadResult }) {
  switch (result.kind) {
    case 'agents':
      return <AgentList rows={result.rows} />;
    case 'requests':
      return <RequestList rows={result.rows} />;
    case 'apiKeys':
      return <ApiKeyList rows={result.rows} />;
  }
}

/** 运营概览指标卡 → 右侧详情抽屉。metric 为 null 时不渲染。 */
export function MetricDetailDrawer({ metric, onClose }: { metric: MetricKey | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LoadResult | null>(null);

  // metric 变化时拉取对应端点；关闭（null）时清空，避免复用旧列表闪现。
  useEffect(() => {
    if (!metric) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    METRIC_CONFIG[metric]
      .load()
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [metric]);

  if (!metric) return null;

  const cfg = METRIC_CONFIG[metric];
  const isEmpty = !!result && result.rows.length === 0;

  return (
    <Drawer open title={cfg.title} onClose={onClose}>
      <div className="space-y-4">
        {cfg.note && (
          <p className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-brain-xs leading-relaxed text-muted">
            {cfg.note}
          </p>
        )}
        <AsyncState loading={loading} error={error} empty={isEmpty} emptyText="暂无记录。" />
        {result && result.rows.length > 0 && <ResultList result={result} />}
      </div>
    </Drawer>
  );
}
