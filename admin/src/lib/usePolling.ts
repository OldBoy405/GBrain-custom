import { useEffect, useRef, useState } from 'react';

/**
 * 声明式轮询数据（Tier1 /admin/api/* 端点，以及现在薄包装的 Tier3 轮询场景）。
 * 挂载即取，按 intervalMs 周期刷新，卸载自动停止。标签页隐藏时暂停（镜像
 * useSSE.ts 的 visibilitychange 处理），重新可见时立即恢复一次。
 * 与 useMcp 返回同一签名 { data, loading, error }。
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  opts: {
    intervalMs: number;
    initialData: T;
    /** 为假时完全跳过轮询，data 重置为 initialData（默认 true）。 */
    enabled?: boolean;
    /** 拿到的结果满足此条件时停止后续轮询（例如任务进入终态）。 */
    stopWhen?: (data: T) => boolean;
    /** 请求失败时的重试间隔；不传则复用 intervalMs。 */
    intervalMsOnError?: number;
  },
): { data: T; loading: boolean; error: string | null } {
  const { intervalMs, initialData, enabled = true, stopWhen, intervalMsOnError } = opts;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  // fetcher/stopWhen 常是内联箭头（每次 render 新引用）。存进 ref 并把它们移出
  // effect 依赖，否则调用方每次 render 都会 cleanup+重启轮询。
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const stopWhenRef = useRef(stopWhen);
  stopWhenRef.current = stopWhen;

  useEffect(() => {
    if (!enabled) {
      setData(initialData);
      setError(null);
      setLoading(false);
      return;
    }

    aliveRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pausedWhileHidden = false;

    const scheduleNext = (delayMs: number) => {
      if (document.hidden) {
        pausedWhileHidden = true;
        return;
      }
      timer = setTimeout(tick, delayMs);
    };

    const tick = async () => {
      try {
        const result = await fetcherRef.current();
        if (!aliveRef.current) return;
        setData(result);
        setError(null);
        setLoading(false);
        if (!stopWhenRef.current?.(result)) scheduleNext(intervalMs);
      } catch (e) {
        if (!aliveRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
        scheduleNext(intervalMsOnError ?? intervalMs);
      }
    };

    const onVisibility = () => {
      if (!document.hidden && pausedWhileHidden && aliveRef.current) {
        pausedWhileHidden = false;
        void tick();
      }
    };

    void tick();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, intervalMsOnError, enabled]);

  return { data, loading, error };
}
