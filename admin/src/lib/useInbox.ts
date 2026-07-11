import { useEffect } from 'react';
import { useMcp } from './useMcp';
import type { InboxListResult } from './op-types';

const MERGING_POLL_MS = 2500;

/**
 * 专用收件箱契约：服务端完成 inbox/ 范围、状态和统计投影。
 * 有合并中条目时自动轮询刷新列表（P2）。
 */
export function useInbox() {
  const { data, loading, error, reload } = useMcp<InboxListResult>('list_inbox', { limit: 100 });
  const merging = data?.stats.merging ?? 0;

  useEffect(() => {
    if (merging <= 0) return;
    const timer = setInterval(() => {
      void reload();
    }, MERGING_POLL_MS);
    return () => clearInterval(timer);
  }, [merging, reload]);

  return {
    items: data?.items ?? [],
    stats: data?.stats ?? { total: 0, pending_enrich: 0, merging: 0, merged: 0, failed: 0, capped: false },
    loading,
    error,
    reload,
  };
}
