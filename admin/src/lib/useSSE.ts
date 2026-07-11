import { useEffect, useRef, useState } from 'react';

export type SSEStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * 通用 SSE 订阅 hook：统一断线重连与"页面隐藏时暂停"。
 * - 浏览器 EventSource 在可见时自身会自动重试；
 * - 页面隐藏（切标签页/最小化）时主动关闭连接，避免后台重连抖动；重新可见时重开。
 * 新事件前插，最多保留 max 条。
 */
export function useSSE<T = unknown>(
  url: string,
  opts?: { max?: number; enabled?: boolean },
): { status: SSEStatus; events: T[]; clear: () => void } {
  const max = opts?.max ?? 50;
  const enabled = opts?.enabled ?? true;
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const [events, setEvents] = useState<T[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    let closed = false;

    const close = () => {
      esRef.current?.close();
      esRef.current = null;
    };

    const open = () => {
      // 注意：不要在这里再判一次 document.hidden。mount 时的首次 open() 若被
      // "此刻恰好读到 hidden=true"挡住，且往后从没有一次真实的 visibilitychange
      // 事件把它翻回 visible（嵌入式/未聚焦面板、后台标签页从不被激活等场景都会这样），
      // 状态会永久卡在初始值 'connecting'（灰色），且没有任何自愈路径。
      // hidden 时"暂停/关闭"完全交给下面的 visibilitychange 监听处理即可。
      if (closed || esRef.current) return;
      const es = new EventSource(url);
      esRef.current = es;
      setStatus('connecting');
      es.onopen = () => setStatus('connected');
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as T;
          setEvents((prev) => [data, ...prev].slice(0, max));
        } catch {
          /* 忽略畸形帧 */
        }
      };
      es.onerror = () => {
        setStatus('disconnected');
        if (document.hidden) close(); // 隐藏时停止后台重连
      };
    };

    const onVisibility = () => {
      if (document.hidden) {
        close();
        setStatus('disconnected');
      } else {
        open();
      }
    };

    open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      closed = true;
      close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [url, enabled, max]);

  return { status, events, clear: () => setEvents([]) };
}
