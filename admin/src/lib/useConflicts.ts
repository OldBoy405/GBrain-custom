import { useMcp } from './useMcp';
import type { FindConflictsResult } from './op-types';

/**
 * 真理编译工作台：拉取冲突组（find_conflicts）。
 * 传 topic 时后端优先探针、回退到 hybridSearch 聚类。
 */
export function useConflicts(topic?: string, limit = 8) {
  const args: Record<string, unknown> = { limit };
  if (topic && topic.trim()) args.topic = topic.trim();
  const { data, loading, error, reload } = useMcp<FindConflictsResult>('find_conflicts', args);
  return {
    groups: data?.groups ?? [],
    source: data?.source,
    note: data?.note,
    loading,
    error,
    reload,
  };
}
