import React, { useEffect, useState } from 'react';
import { callMcp } from '../../lib/mcp-client';
import { JOB_QUEUE_SAMPLE_LIMIT } from '../../lib/jobs-queue-fetch';
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

/**
 * 真实状态机（`minions/types.ts` `MinionJobStatus`，9 项）逐一给中文标签，
 * 不再把 waiting/active 之外的子状态默默合并进三栏标题里——每张卡片按
 * 真实 status 打对应徽标，栏目只是视觉分组，不改写语义。
 */
const STATUS_LABEL: Record<MinionJobRow['status'], string> = {
  waiting: '等待中',
  active: '执行中',
  completed: '已完成',
  failed: '失败',
  delayed: '延迟',
  dead: '死亡',
  cancelled: '已取消',
  'waiting-children': '等待子任务',
  paused: '已暂停',
};

const STATUS_TONE: Record<MinionJobRow['status'], BadgeTone> = {
  waiting: 'muted',
  active: 'accent',
  completed: 'ok',
  failed: 'amber',
  delayed: 'muted',
  dead: 'contra',
  cancelled: 'muted',
  'waiting-children': 'muted',
  paused: 'muted',
};

/**
 * 执行通道展示：`job.execution_lane` 是后端权威字段（`getExecutionLane()`，
 * `src/core/minions/execution-lane.ts`，按 `worker.register(...)` 真实名字
 * 判定）。两条通用调度通道——subagent（LLM 驱动的 agent 循环）、shell（脚本/
 * 命令执行）——都打成醒目 Badge；常规确定性 handler（sync、embed、extract、
 * synthesize…）是默认路径，不加标签以免每张卡都被打标。
 */
const LANE_LABEL: Record<'subagent' | 'shell', string> = {
  subagent: 'subagent',
  shell: 'shell',
};

const LANE_TONE: Record<'subagent' | 'shell', BadgeTone> = {
  subagent: 'synthesis',
  shell: 'accent',
};

/** `queue.ts:getStats()` 对 "stalled" 的定义：active 且 lock_until 已过期。同一定义，不发明新口径。 */
export function isStalledJob(job: MinionJobRow, now: number): boolean {
  return job.status === 'active' && job.lock_until != null && new Date(job.lock_until).getTime() < now;
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
  const stalled = isStalledJob(job, now);

  let rightMeta: React.ReactNode = timeStr(job.created_at);
  if (job.status === 'active' && job.started_at) {
    const elapsed = now - new Date(job.started_at).getTime();
    rightMeta = (
      <span
        className="inline-flex items-center gap-1 font-mono text-brain-2xs"
        style={{ color: stalled ? 'var(--color-amber)' : 'var(--color-accent)' }}
      >
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full"
          style={{ background: stalled ? 'var(--color-amber)' : 'var(--color-accent)' }}
        />
        {durationStr(Math.max(0, elapsed))}
      </span>
    );
  } else if (job.finished_at && job.started_at) {
    const dur = new Date(job.finished_at).getTime() - new Date(job.started_at).getTime();
    rightMeta = (
      <span className="font-mono text-brain-2xs text-muted">{timeStr(job.finished_at)} · {durationStr(dur)}</span>
    );
  }

  // 待处理栏里非纯 waiting 的子状态（delayed/paused/waiting-children）单独打标，
  // 避免"待处理"栏悄悄吞掉这些真实存在但不同语义的状态。
  const showStatusBadge = job.status !== 'waiting' && job.status !== 'active';

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
          <div className="mt-1">
            <Badge tone={LANE_TONE[lane]}>{LANE_LABEL[lane]}</Badge>
          </div>
        )}
        {nested && (
          <div className="mt-1 font-mono text-brain-2xs" style={{ color: 'var(--color-coral)' }}>
            depth={job.depth} (nested)
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {stalled && <Badge tone="amber">停滞</Badge>}
          {showStatusBadge && <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>}
        </div>
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
  trueTotal,
  extra,
  loading,
  error,
  children,
  emptyText,
}: {
  title: string;
  /** 本次抓到的样本条数（≤ JOB_QUEUE_SAMPLE_LIMIT），不是队列里的真实总数。 */
  count: number;
  /**
   * 后端权威真实总数（如 `queue_health.active`）。只有"运行中"栏能干净对应
   * 单一状态，待处理/已结束栏各自合并了多个子状态，没有对应的单一真值口径，
   * 故这两栏不传——避免编造一个看似精确实则拼凑的数字。
   */
  trueTotal?: number;
  /** 附加说明（如停滞计数），非本栏抓取条数，标注来源避免误读为同一口径。 */
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
        // {title} · 最近 {JOB_QUEUE_SAMPLE_LIMIT} 条样本 · 本次 {count} 条
        {trueTotal != null && <span className="text-muted"> · 实时总数 {trueTotal}</span>}
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

export interface JobQueueColumnsProps {
  pending: MinionJobRow[];
  active: MinionJobRow[];
  done: MinionJobRow[];
  loading: boolean;
  /** 分桶错误：单栏失败只显示该栏错误，其余栏照常。 */
  errors: { pending: string | null; active: string | null; done: string | null };
  /** `queue_health.active` 真实总数（来自 jobsWatch 聚合），供"运行中"栏标注。 */
  activeTotal?: number;
  /** cancel/retry 成功后回调父级即时刷新（不必干等一个轮询周期）。 */
  onChanged?: () => void;
}

/**
 * 三栏逐作业队列看板（待处理 / 运行中 / 已结束）。数据由父级
 * `useJobsQueuePanel` 统一轮询后 props 注入；本组件仅保留 UI 级 1s tick
 * 用于运行耗时展示，不再自行打 list_jobs API。
 */
export function JobQueueColumns({ pending, active, done, loading, errors, activeTotal, onChanged }: JobQueueColumnsProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stalledCount = active.filter((j) => isStalledJob(j, now)).length;

  const [openJob, setOpenJob] = useState<MinionJobRow | null>(null);

  const cancel = async (job: MinionJobRow) => {
    if (!window.confirm(`取消作业 #${job.id}（${job.name}）？`)) return;
    try {
      await callMcp('cancel_job', { id: job.id });
      onChanged?.();
    } catch (e) {
      window.alert(`取消失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const retry = async (job: MinionJobRow) => {
    if (!window.confirm(`重新提交作业 #${job.id}（${job.name}）？`)) return;
    try {
      await callMcp('retry_job', { id: job.id });
      onChanged?.();
    } catch (e) {
      window.alert(`重试失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <Column title="待处理" count={pending.length} loading={loading} error={errors.pending} emptyText="暂无待处理作业。">
          {pending.map((job) => (
            <li key={job.id} className="m-0 p-0">
              <JobCard job={job} now={now} onOpen={setOpenJob} onCancel={cancel} />
            </li>
          ))}
        </Column>
        <Column
          title="运行中"
          count={active.length}
          trueTotal={activeTotal}
          extra={stalledCount > 0 ? `${stalledCount} 停滞` : undefined}
          loading={loading}
          error={errors.active}
          emptyText="暂无运行中作业。"
        >
          {active.map((job) => (
            <li key={job.id} className="m-0 p-0">
              <JobCard job={job} now={now} onOpen={setOpenJob} onCancel={cancel} />
            </li>
          ))}
        </Column>
        <Column title="已结束" count={done.length} loading={loading} error={errors.done} emptyText="暂无已结束作业。">
          {done.map((job) => (
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
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={STATUS_TONE[openJob.status]}>{STATUS_LABEL[openJob.status]}</Badge>
                {isStalledJob(openJob, now) && <Badge tone="amber">停滞</Badge>}
              </div>
            </div>
            <div>
              <div className="type-section-label mb-1">执行通道</div>
              {openJob.execution_lane === 'handler' ? (
                <span className="font-mono text-brain-xs text-muted">handler（确定性）</span>
              ) : (
                <Badge tone={LANE_TONE[openJob.execution_lane]}>{LANE_LABEL[openJob.execution_lane]}</Badge>
              )}
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
