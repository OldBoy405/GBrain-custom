import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { QueryTrace } from './op-types';

/**
 * Brain 表层跨页共享的"最近一次 ask"状态。Ask 页发起真实查询成功后写入，
 * Jobs 页的 TraceWaterfall 读取渲染。纯内存（刷新即失，与 McpTokenContext
 * 同一信任模型精神——这里非敏感数据，但保持模式一致，不落 localStorage）。
 *
 * 默认 context 值内含 no-op，未包 Provider 时也能安全渲染（不炸现有测试）。
 */
export interface LastQuery {
  query: string;
  totalMs: number;
  resultCount: number;
  ts: number;
  /** v0.43.x fork: real query diagnostics (query op called with trace:true). Optional for back-compat. */
  trace?: QueryTrace;
}

interface LastQueryCtx {
  lastQuery: LastQuery | null;
  setLastQuery: (q: LastQuery) => void;
}

const Ctx = createContext<LastQueryCtx>({ lastQuery: null, setLastQuery: () => {} });

export function LastQueryProvider({ children }: { children: React.ReactNode }) {
  const [lastQuery, setLastQueryState] = useState<LastQuery | null>(null);
  const setLastQuery = useCallback((q: LastQuery) => setLastQueryState(q), []);
  const value = useMemo(() => ({ lastQuery, setLastQuery }), [lastQuery, setLastQuery]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLastQuery(): LastQueryCtx {
  return useContext(Ctx);
}
