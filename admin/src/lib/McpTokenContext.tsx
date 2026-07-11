import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { setMcpToken } from './mcp-client';

/**
 * Brain 表层的 MCP 令牌上下文。令牌只在内存（React state + mcp-client 模块变量），
 * 刷新即失（遵循 api.ts D11/D12 信任模型：不写 localStorage/sessionStorage）。
 */
interface McpTokenCtx {
  token: string | null;
  connect: (t: string) => void;
  disconnect: () => void;
}

const Ctx = createContext<McpTokenCtx>({ token: null, connect: () => {}, disconnect: () => {} });

export function McpTokenProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const connect = useCallback((t: string) => {
    setMcpToken(t);
    setToken(t);
  }, []);
  const disconnect = useCallback(() => {
    setMcpToken(null);
    setToken(null);
  }, []);
  const value = useMemo(() => ({ token, connect, disconnect }), [token, connect, disconnect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMcpToken(): McpTokenCtx {
  return useContext(Ctx);
}
