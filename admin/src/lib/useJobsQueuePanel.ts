import { usePolling } from './usePolling';
import {
  EMPTY_JOBS_QUEUE_PANEL,
  fetchJobsQueuePanel,
  type JobsQueuePanelData,
  type JobsQueuePanelErrors,
} from './jobs-queue-fetch';
import type { MinionJobRow } from './op-types';

const POLL_INTERVAL_MS = 3000;
/** 全灭出错后退避到更长间隔，别对已经出错的后端继续 3s 高频施压。 */
const POLL_INTERVAL_ON_ERROR_MS = 15000;

/**
 * Brain Jobs 页队列区统一轮询：每 tick 一次拉 jobsWatch + 批量 list_jobs。
 * `error` 仅在全灭（后端不可达）时非空；单桶失败走 `errors` 分桶降级。
 * `reload` 供 cancel/retry 等写操作成功后即时刷新。
 */
export function useJobsQueuePanel(): {
  watch: JobsQueuePanelData['watch'];
  pending: MinionJobRow[];
  active: MinionJobRow[];
  done: MinionJobRow[];
  errors: JobsQueuePanelErrors;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const { data, loading, error, reload } = usePolling<JobsQueuePanelData>(fetchJobsQueuePanel, {
    intervalMs: POLL_INTERVAL_MS,
    intervalMsOnError: POLL_INTERVAL_ON_ERROR_MS,
    initialData: EMPTY_JOBS_QUEUE_PANEL,
  });

  return {
    watch: data.watch,
    pending: data.pending,
    active: data.active,
    done: data.done,
    errors: data.errors,
    loading,
    error,
    reload,
  };
}
