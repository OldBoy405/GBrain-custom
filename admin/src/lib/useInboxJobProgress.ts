import { usePolling } from './usePolling';
import { callMcp } from './mcp-client';

export interface InboxJobProgress {
  id: number;
  name: string;
  status: string;
  progress?: {
    phase?: string;
    completed?: number;
    total?: number;
  } | null;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'dead', 'cancelled']);

/**
 * 合并中条目轮询 get_job_progress（P2：替代静态「合并中…」）。
 * 薄包装：timer/cleanup/tab-hidden 暂停全部交给 usePolling；这里只提供
 * "任务到终态就停" 的 stopWhen 和成功/失败不同重试间隔。
 */
export function useInboxJobProgress(jobId: number | null | undefined, enabled: boolean) {
  const { data, error } = usePolling<InboxJobProgress | null>(
    () => callMcp<InboxJobProgress>('get_job_progress', { id: jobId as number }),
    {
      intervalMs: 1500,
      intervalMsOnError: 3000,
      initialData: null,
      enabled: enabled && jobId != null,
      stopWhen: (result) => result != null && TERMINAL_STATUSES.has(result.status),
    },
  );

  return { progress: data, error };
}
