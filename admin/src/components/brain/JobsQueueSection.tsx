import { useJobsQueuePanel } from '../../lib/useJobsQueuePanel';
import { Badge } from './Badge';
import { StatCard } from './StatCard';
import { JobQueueColumns } from './JobQueueColumns';

function leaseAccent(n: number): string {
  if (n === 0) return 'var(--color-ok)';
  if (n >= 100) return 'var(--color-contra)';
  return 'var(--color-amber)';
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Minions 队列统一区块：逐作业三栏 + 队列健康 + 运维摘要（错误聚类 / 预算）。
 * 数据由 `useJobsQueuePanel` 单 interval 拉 jobsWatch + list_jobs。
 */
export function JobsQueueSection() {
  const { watch, pending, active, done, errors, loading, error, reload } = useJobsQueuePanel();
  const q = watch?.queue_health;

  const hasErrors = (watch?.top_errors.length ?? 0) > 0;
  const hasBudget = (watch?.budget_owners.length ?? 0) > 0;

  // 全灭错误（error）压过一切；否则用分桶错误让各栏独立降级。
  const colErrors = {
    pending: error ?? errors.pending,
    active: error ?? errors.active,
    done: error ?? errors.done,
  };
  const watchError = error ?? errors.watch;

  return (
    <section data-testid="jobs-queue-section" className="mb-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-hairline bg-surface px-4 py-3 text-brain-base text-contra">
          读取失败：{error}
        </div>
      )}

      <JobQueueColumns
        pending={pending}
        active={active}
        done={done}
        loading={loading}
        errors={colErrors}
        activeTotal={q?.active}
        onChanged={reload}
      />

      <div>
        <div className="type-section-label mb-3">
          队列健康
          {watchError && !error && (
            <span className="ml-2 font-normal text-brain-xs text-contra">· 本次聚合读取失败（下方队列样本仍可用）</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard value={q?.waiting ?? '—'} label="等待中" />
          <StatCard value={q?.active ?? '—'} label="执行中" accent="var(--color-accent)" />
          <StatCard value={q?.stalled ?? '—'} label="停滞" accent="var(--color-amber)" />
          <StatCard
            value={watch?.lease_pressure_1h ?? '—'}
            label="租约压力 (1h)"
            accent={watch ? leaseAccent(watch.lease_pressure_1h) : undefined}
          />
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <div className="type-section-label mb-3">运维摘要</div>

        {hasErrors && (
          <div className="mb-4">
            <div className="type-mono-tiny mb-2 text-muted">错误聚类</div>
            <div className="space-y-2">
              {watch!.top_errors.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-brain-base"
                >
                  <span className="truncate font-mono text-ink-soft">{e.cluster}</span>
                  <Badge tone="contra">{e.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasBudget && (
          <div>
            <div className="type-mono-tiny mb-2 text-muted">预算账户</div>
            <div className="overflow-hidden rounded-lg border border-hairline">
              <table className="brain-table">
                <thead>
                  <tr className="border-b border-hairline brain-table-head">
                    <th className="px-4 py-2.5 text-left font-medium">Owner</th>
                    <th className="px-4 py-2.5 text-left font-medium">剩余</th>
                    <th className="px-4 py-2.5 text-left font-medium">已花费</th>
                  </tr>
                </thead>
                <tbody>
                  {watch!.budget_owners.map((b) => (
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

        {!loading && watch && !hasErrors && !hasBudget && (
          <p className="text-brain-sm text-muted">暂无错误聚类 / 预算账户</p>
        )}

        {loading && !watch && (
          <p className="text-brain-sm text-muted">加载中…</p>
        )}
      </div>
    </section>
  );
}
