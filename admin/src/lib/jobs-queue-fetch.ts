import { api } from '../api';
import { callMcp } from './mcp-client';
import type { JobsWatchSnapshot, MinionJobRow } from './op-types';

/** 三栏 list_jobs 每栏最多展示的样本条数（与 MCP limit / slice 对齐）。 */
export const JOB_QUEUE_SAMPLE_LIMIT = 20;

/** 分桶错误：单个请求失败时只标记它所属的区块，其余照常渲染（降级而非全灭）。 */
export interface JobsQueuePanelErrors {
  /** jobsWatch 聚合（队列健康 / 运维摘要）。 */
  watch: string | null;
  /** 待处理栏任一子桶（waiting/delayed/paused/waiting-children）失败。 */
  pending: string | null;
  /** 运行中栏（active）失败。 */
  active: string | null;
  /** 已结束栏任一子桶（completed/failed/dead/cancelled）失败。 */
  done: string | null;
}

export interface JobsQueuePanelData {
  watch: JobsWatchSnapshot | null;
  pending: MinionJobRow[];
  active: MinionJobRow[];
  done: MinionJobRow[];
  /** 每区块的局部错误；全部为 null 表示本 tick 各桶都成功。 */
  errors: JobsQueuePanelErrors;
}

/**
 * 按 id 去重，保留先出现的一个。作业状态在多路并行查询之间跳变时（例如
 * waiting→active），可能被两个子桶同时抓到，合并后同一 job 出现两次，
 * 会撞 React key 并偷占样本上限的一个名额。去重必须在 sort 之后、slice
 * 之前——否则重复项可能顶掉一条本该展示的真实作业。
 */
function dedupeById(jobs: MinionJobRow[]): MinionJobRow[] {
  const seen = new Set<number>();
  return jobs.filter((j) => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });
}

export function mergePendingJobs(
  waiting: MinionJobRow[],
  delayed: MinionJobRow[],
  paused: MinionJobRow[],
  waitingChildren: MinionJobRow[],
): MinionJobRow[] {
  return dedupeById(
    [...waiting, ...delayed, ...paused, ...waitingChildren].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
  ).slice(0, JOB_QUEUE_SAMPLE_LIMIT);
}

export function mergeTerminalJobs(
  completed: MinionJobRow[],
  failed: MinionJobRow[],
  dead: MinionJobRow[],
  cancelled: MinionJobRow[],
): MinionJobRow[] {
  return dedupeById(
    [...completed, ...failed, ...dead, ...cancelled].sort((a, b) => {
      const ta = new Date(a.finished_at ?? a.created_at).getTime();
      const tb = new Date(b.finished_at ?? b.created_at).getTime();
      return tb - ta;
    }),
  ).slice(0, JOB_QUEUE_SAMPLE_LIMIT);
}

function settledError(r: PromiseSettledResult<unknown>): string | null {
  if (r.status !== 'rejected') return null;
  return r.reason instanceof Error ? r.reason.message : String(r.reason);
}

function settledRows(r: PromiseSettledResult<unknown>): MinionJobRow[] {
  return r.status === 'fulfilled' ? (r.value as MinionJobRow[]) : [];
}

/** 一组 settled 结果里第一个非空错误（用于把多子桶折叠成单栏错误）。 */
function firstError(...rs: PromiseSettledResult<unknown>[]): string | null {
  for (const r of rs) {
    const e = settledError(r);
    if (e) return e;
  }
  return null;
}

/**
 * 单 tick：jobsWatch 聚合 + 批量 list_jobs（9 路并行）。
 *
 * 用 allSettled 而非 all——单个桶偶发失败（某次 list_jobs 500、瞬时抖动）只让
 * 对应栏显示局部错误，其余栏继续用本 tick 拿到的新数据（降级而非全灭）。
 * 仅当 10 路**全部**失败（后端不可达 / 鉴权失效）才 throw，交给 usePolling 进入
 * 错误态并按 intervalMsOnError 退避——避免对已经出错的后端继续高频施压。
 */
export async function fetchJobsQueuePanel(): Promise<JobsQueuePanelData> {
  const settled = await Promise.allSettled([
    api.jobsWatch() as Promise<JobsWatchSnapshot>,
    callMcp<MinionJobRow[]>('list_jobs', { status: 'waiting', limit: JOB_QUEUE_SAMPLE_LIMIT }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'delayed', limit: 10 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'paused', limit: 10 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'waiting-children', limit: 10 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'active', limit: JOB_QUEUE_SAMPLE_LIMIT }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'completed', limit: 15 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'failed', limit: 10 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'dead', limit: 10 }),
    callMcp<MinionJobRow[]>('list_jobs', { status: 'cancelled', limit: 10 }),
  ]);

  // 全灭 = 后端整体不可达；抛出让 usePolling 切错误态 + 退避。
  if (settled.every((r) => r.status === 'rejected')) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new Error(String(first.reason));
  }

  const [watch, waiting, delayed, paused, waitingChildren, active, completed, failed, dead, cancelled] =
    settled;

  return {
    watch: watch.status === 'fulfilled' ? (watch.value as JobsWatchSnapshot) : null,
    pending: mergePendingJobs(
      settledRows(waiting),
      settledRows(delayed),
      settledRows(paused),
      settledRows(waitingChildren),
    ),
    active: settledRows(active),
    done: mergeTerminalJobs(
      settledRows(completed),
      settledRows(failed),
      settledRows(dead),
      settledRows(cancelled),
    ),
    errors: {
      watch: settledError(watch),
      pending: firstError(waiting, delayed, paused, waitingChildren),
      active: settledError(active),
      done: firstError(completed, failed, dead, cancelled),
    },
  };
}

export const EMPTY_JOBS_QUEUE_PANEL: JobsQueuePanelData = {
  watch: null,
  pending: [],
  active: [],
  done: [],
  errors: { watch: null, pending: null, active: null, done: null },
};
