import { useCallback, useEffect, useRef, useState } from 'react';
import { callMcp } from './mcp-client';

/**
 * 声明式调用一个 gbrain 操作（Tier3 JSON-RPC）。挂载即取，enabled 为假时不发。
 * args 以 JSON 串比较，避免对象新引用触发重复请求。
 */
export function useMcp<T>(
  name: string,
  args: Record<string, unknown> = {},
  opts?: { enabled?: boolean },
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const enabled = opts?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const argsKey = JSON.stringify(args);
  // 请求序号：慢的旧请求在快的新请求之后返回时，不能覆盖新请求已写入的状态。
  const requestIdRef = useRef(0);

  const run = useCallback(async () => {
    if (!enabled) return;
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const r = await callMcp<T>(name, JSON.parse(argsKey));
      if (requestIdRef.current !== myId) return;
      setData(r);
    } catch (e) {
      if (requestIdRef.current !== myId) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (requestIdRef.current === myId) setLoading(false);
    }
  }, [name, argsKey, enabled]);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, loading, error, reload: run };
}
