import { Cpu } from 'lucide-react';
import { api } from '../../api';
import { usePolling } from '../../lib/usePolling';
import type { JobsWatchSnapshot } from '../../lib/op-types';
import {
  PageHeader,
  StatCard,
  Badge,
  WhyButton,
  JobQueueColumns,
  DreamCycleCard,
  DeterministicExplainer,
  TraceWaterfall,
} from '../../components/brain';

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function leaseAccent(n: number): string {
  if (n === 0) return 'var(--color-ok)';
  if (n >= 100) return 'var(--color-contra)';
  return 'var(--color-amber)';
}

export function Jobs() {
  const { data: snap, error: err } = usePolling<JobsWatchSnapshot | null>(
    () => api.jobsWatch() as Promise<JobsWatchSnapshot>,
    { intervalMs: 1000, initialData: null },
  );

  const q = snap?.queue_health;
  const completed24h = snap ? snap.by_type.reduce((sum, t) => sum + t.completed, 0) : null;

  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 引擎 · 任务监控"
        icon={<Cpu size={22} aria-hidden />}
        title="Minions 队列 · Dream Cycle · Trace Waterfall"
        subtitle={
          <span className="inline leading-relaxed">
            minion 作业实时快照（每秒刷新）· deterministic task ~753ms vs sub-agent 10s+ ·
            <WhyButton topic="minions-queue" className="mx-1 align-middle" />
            <WhyButton topic="dream-cycle" className="align-middle" />
          </span>
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-hairline bg-surface px-4 py-3 text-brain-base text-contra">
          读取失败：{err}
        </div>
      )}

      <JobQueueColumns completed24h={completed24h} />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <DeterministicExplainer />
        <DreamCycleCard />
      </div>

      <div className="mb-8">
        <TraceWaterfall />
      </div>

      <div className="type-section-label mb-3">队列健康</div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard value={q?.waiting ?? '—'} label="等待中" />
        <StatCard value={q?.active ?? '—'} label="执行中" accent="var(--color-accent)" />
        <StatCard value={q?.stalled ?? '—'} label="停滞" accent="var(--color-amber)" />
        <StatCard
          value={snap?.lease_pressure_1h ?? '—'}
          label="租约压力 (1h)"
          accent={snap ? leaseAccent(snap.lease_pressure_1h) : undefined}
        />
      </div>

      <div className="mt-8">
        <div className="type-section-label mb-3">按类型</div>
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
          {!snap || snap.by_type.length === 0 ? (
            <div className="px-5 py-10 text-center text-brain-base text-muted">{snap ? '暂无作业。' : '加载中…'}</div>
          ) : (
            <table className="brain-table">
              <thead>
                <tr className="border-b border-hairline brain-table-head">
                  <th className="px-4 py-2.5 text-left font-medium">类型</th>
                  <th className="px-4 py-2.5 text-left font-medium">总计</th>
                  <th className="px-4 py-2.5 text-left font-medium">完成</th>
                  <th className="px-4 py-2.5 text-left font-medium">失败</th>
                  <th className="px-4 py-2.5 text-left font-medium">死亡</th>
                </tr>
              </thead>
              <tbody>
                {snap.by_type.map((t) => (
                  <tr key={t.name} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-ink">{t.name}</td>
                    <td className="px-4 py-2.5 font-mono text-ink-soft">{t.total}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-ok)' }}>{t.completed}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: t.failed > 0 ? 'var(--color-amber)' : 'var(--color-muted)' }}>{t.failed}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: t.dead > 0 ? 'var(--color-contra)' : 'var(--color-muted)' }}>{t.dead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {snap && snap.top_errors.length > 0 && (
        <div className="mt-8">
          <div className="type-section-label mb-3">错误聚类</div>
          <div className="space-y-2">
            {snap.top_errors.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-2.5 text-brain-base">
                <span className="truncate font-mono text-ink-soft">{e.cluster}</span>
                <Badge tone="contra">{e.count}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {snap && snap.budget_owners.length > 0 && (
        <div className="mt-8">
          <div className="type-section-label mb-3">预算账户</div>
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <table className="brain-table">
              <thead>
                <tr className="border-b border-hairline brain-table-head">
                  <th className="px-4 py-2.5 text-left font-medium">Owner</th>
                  <th className="px-4 py-2.5 text-left font-medium">剩余</th>
                  <th className="px-4 py-2.5 text-left font-medium">已花费</th>
                </tr>
              </thead>
              <tbody>
                {snap.budget_owners.map((b) => (
                  <tr key={b.owner_id} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-ink">#{b.owner_id}</td>
                    <td className="px-4 py-2.5 font-mono text-ink-soft">{dollars(b.remaining_cents)}</td>
                    <td className="px-4 py-2.5 font-mono text-ink-soft">{dollars(b.total_spent_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
