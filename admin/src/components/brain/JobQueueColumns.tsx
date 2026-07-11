import React, { useEffect, useState } from 'react';
import { callMcp } from '../../lib/mcp-client';
import { usePolling } from '../../lib/usePolling';
import type { MinionJobRow } from '../../lib/op-types';
import { AsyncState } from './AsyncState';
import { Badge, type BadgeTone } from './Badge';
import { Drawer } from './Drawer';

/** 从任意 job payload 里按常见字段名猜目标 slug；取不到就不渲染该行（不瞎猜）。 */
function targetLabel(job: MinionJobRow): string | null {
  const d = job.data ?? {};
  const candidate =
    (d.slug as string | undefined) ??
    (d.page_slug as string | undefined) ??
    (d.source_id as string | undefined) ??
    null;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

function timeStr(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function durationStr(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const TERMINAL_TONE: Record<string, BadgeTone> = {
  completed: 'ok',
  failed: 'amber',
  dead: 'contra',
  cancelled: 'muted',
};

/**
 * 执行通道展示：`job.execution_lane` 是后端权威字段（`getExecutionLane()`，
 * `src/core/minions/execution-lane.ts`，按 `worker.register(...)` 真实名字
 * 判定），只在 shell/subagent 两个特殊通道时打标签——常规确定性 handler
 * （sync、embed、extract、synthesize…）是默认路径，不加标签以免每张卡都被打标。
 */
const LANE_LABEL: Record<'subagent' | 'shell', string> = {
  subagent: 'subagent',
  shell: 'shell',
};

const LANE_COLOR: Record<'subagent' | 'shell', string> = {
  subagent: 'var(--color-coral)',
  shell: 'var(--color-accent)',
};

async function fetchTerminalJobs(): Promise<MinionJobRow[]> {
  const [completed, failed, dead] = await Promise.all([
    callMcp<MinionJobRow[]>('list_jobs', { status: 'completed', limit: 15 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'failed', limit: 10 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'dead', limit: 10 }),
  ]);
  return [...completed, ...failed, ...dead]
    .sort((a, b) => {
      const ta = new Date(a.finished_at ?? a.created_at).getTime();
      const tb = new Date(b.finished_at ?? b.created_at).getTime();
      return tb - ta;
    })
    .slice(0, 20);
}

function JobCard({
  job,
  now,
  onOpen,
  onCancel,
  onRetry,
}: {
  job: MinionJobRow;
  /** 共享的"当前时间"tick（每秒刷新一次），用于运行中作业的实时耗时，避免每张卡各开一个 interval。 */
  now: number;
  onOpen: (job: MinionJobRow) => void;
  onCancel?: (job: MinionJobRow) => void;
  onRetry?: (job: MinionJobRow) => void;
}) {
  const target = targetLabel(job);
  const nested = job.depth > 0;
  const lane = job.execution_lane === 'handler' ? null : job.execution_lane;

  let rightMeta: React.ReactNode = timeStr(job.created_at);
  if (job.status === 'active' && job.started_at) {
    const elapsed = now - new Date(job.started_at).getTime();
    rightMeta = (
      <span className="inline-flex items-center gap-1 font-mono text-brain-2xs text-accent">
        <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
        {durationStr(Math.max(0, elapsed))}
      </span>
    );
  } else if (job.finished_at && job.started_at) {
    const dur = new Date(job.finished_at).getTime() - new Date(job.started_at).getTime();
    rightMeta = (
      <span className="font-mono text-brain-2xs text-muted">{timeStr(job.finished_at)} · {durationStr(dur)}</span>
    );
  }

  return (
    <div className="rounded border border-hairline bg-canvas p-2.5">
      <button
        type="button"
        onClick={() => onOpen(job)}
        className="w-full cursor-pointer text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-brain-sm text-ink">{job.name}</span>
          <span className="shrink-0">{rightMeta}</span>
        </div>
        {target && <div className="mt-0.5 truncate text-brain-xs text-ink-soft">{target}</div>}
        {lane && (
          <div
            className="mt-0.5 font-mono text-brain-2xs"
            style={{ color: LANE_COLOR[lane] }}
            title="执行通道（后端权威字段，按 worker.register 名字判定）"
          >
            {LANE_LABEL[lane]}
          </div>
        )}
        {nested && (
          <div className="mt-1 font-mono text-brain-2xs" style={{ color: 'var(--color-coral)' }}>
            depth={job.depth} (nested)
          </div>
        )}
        {(job.status === 'completed' || job.status === 'failed' || job.status === 'dead') && (
          <div className="mt-1">
            <Badge tone={TERMINAL_TONE[job.status] ?? 'muted'}>{job.status}</Badge>
          </div>
        )}
      </button>
      {(onCancel || onRetry) && (
        <div className="mt-1.5 flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={() => onCancel(job)}
              className="cursor-pointer text-brain-2xs text-muted hover:text-contra"
            >
              取消
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(job)}
              className="cursor-pointer text-brain-2xs text-muted hover:text-accent"
            >
              重试
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  count,
  extra,
  loading,
  error,
  children,
  emptyText,
}: {
  title: string;
  count: number;
  /** 附加说明（如 24h 完成总数），非本栏抓取条数，标注来源避免误读为同一口径。 */
  extra?: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
  emptyText: string;
}) {
  const empty = !loading && !error && count === 0;
  return (
    <div className="rounded-lg border border-hairline bg-elevated p-4">
      <div className="type-mono-tiny mb-2">
        // {title} · {count}
        {extra && <span className="text-muted"> · {extra}</span>}
      </div>
      {(loading || error || empty) ? (
        <AsyncState loading={loading} error={error} empty={empty} emptyText={emptyText} />
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">{children}</ul>
      )}
    </div>
  );
}

/**
 * 三栏逐作业队列看板（待处理 / 运行中 / 已完成）。数据走 Tier3 MCP `list_jobs`
 * （scope admin，走 /admin/api/op 代理，无需配置 MCP token）。补充
 * `Jobs.tsx` 现有聚合快照（`api.jobsWatch()`）看不到的逐条明细。
 */
export function JobQueueColumns({ completed24h }: { completed24h?: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const waiting = usePolling<MinionJobRow[]>(
    () => callMcp<MinionJobRow[]>('list_jobs', { status: 'waiting', limit: 20 }),
    { intervalMs: 3000, initialData: [] },
  );
  const active = usePolling<MinionJobRow[]>(
    () => callMcp<MinionJobRow[]>('list_jobs', { status: 'active', limit: 20 }),
    { intervalMs: 2000, initialData: [] },
  );
  const done = usePolling<MinionJobRow[]>(fetchTerminalJobs, { intervalMs: 5000, initialData: [] });

  const [openJob, setOpenJob] = useState<MinionJobRow | null>(null);

  const cancel = async (job: MinionJobRow) => {
    if (!window.confirm(`取消作业 #${job.id}（${job.name}）？`)) return;
    try {
      await callMcp('cancel_job', { id: job.id });
    } catch (e) {
      window.alert(`取消失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const retry = async (job: MinionJobRow) => {
    if (!window.confirm(`重新提交作业 #${job.id}（${job.name}）？`)) return;
    try {
      await callMcp('retry_job', { id: job.id });
    } catch (e) {
      window.alert(`重试失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <Column title="待处理" count={waiting.data.length} loading={waiting.loading} error={waiting.error} emptyText="暂无待处理作业。">
          {waiting.data.map((job) => (
            <li key={job.id} className="m-0 p-0">
              <JobCard job={job} now={now} onOpen={setOpenJob} onCancel={cancel} />
            </li>
          ))}
        </Column>
        <Column title="运行中" count={active.data.length} loading={active.loading} error={active.error} emptyText="暂无运行中作业。">
          {active.data.map((job) => (
            <li key={job.id} className="m-0 p-0">
              <JobCard job={job} now={now} onOpen={setOpenJob} onCancel={cancel} />
            </li>
          ))}
        </Column>
        <Column
          title="已完成"
          count={done.data.length}
          extra={completed24h != null ? `24h 完成 ${completed24h}` : undefined}
          loading={done.loading}
          error={done.error}
          emptyText="暂无已完成作业。"
        >
          {done.data.map((job) => (
            <li key={job.id} className="m-0 p-0">
              <JobCard
                job={job}
                now={now}
                onOpen={setOpenJob}
                onRetry={job.status === 'failed' || job.status === 'dead' ? retry : undefined}
              />
            </li>
          ))}
        </Column>
      </section>

      <Drawer open={openJob != null} title={openJob ? `作业 #${openJob.id} · ${openJob.name}` : undefined} onClose={() => setOpenJob(null)}>
        {openJob && (
          <div className="space-y-3">
            <div>
              <div className="type-section-label mb-1">状态</div>
              <Badge tone={TERMINAL_TONE[openJob.status] ?? 'accent'}>{openJob.status}</Badge>
            </div>
            {openJob.error_text && (
              <div>
                <div className="type-section-label mb-1">错误</div>
                <pre className="whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-3 text-brain-xs text-contra">
                  {openJob.error_text}
                </pre>
              </div>
            )}
            <div>
              <div className="type-section-label mb-1">Payload</div>
              <pre className="whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-3 font-mono text-brain-xs text-ink-soft">
                {JSON.stringify(openJob.data, null, 2)}
              </pre>
            </div>
            {openJob.result && (
              <div>
                <div className="type-section-label mb-1">Result</div>
                <pre className="whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-3 font-mono text-brain-xs text-ink-soft">
                  {JSON.stringify(openJob.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
