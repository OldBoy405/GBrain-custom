import { Badge } from '../../components/brain';
import type { FeedEvent } from '../../lib/op-types';
import type { SSEStatus } from '../../lib/useSSE';
import { scopeTone, statusTone, timeAgo } from './format';

/**
 * 运营概览 · 实时活动流表格（Tier1/SSE 实链路）。
 * 从 Today.tsx 抽出：让页面只做编排，表格结构 + 稳定 key 收敛到一处。
 */
export function ActivityFeedTable({ events, status }: { events: FeedEvent[]; status: SSEStatus }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      {events.length === 0 ? (
        <div className="px-5 py-10 text-center text-brain-base text-muted">
          {status === 'connected' ? '暂无请求。Agent 调用时会实时出现在这里。' : '连接中…'}
        </div>
      ) : (
        <table className="brain-table">
          <thead>
            <tr className="border-b border-hairline brain-table-head">
              <th className="px-4 py-2.5 text-left font-medium">Agent</th>
              <th className="px-4 py-2.5 text-left font-medium">操作</th>
              <th className="px-4 py-2.5 text-left font-medium">权限</th>
              <th className="px-4 py-2.5 text-left font-medium">耗时</th>
              <th className="px-4 py-2.5 text-left font-medium">状态</th>
              <th className="px-4 py-2.5 text-left font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              // SSE 前插新事件，纯下标 key 会让每行 key 漂移；用复合 key 稳定行标识。
              <tr
                key={`${e.timestamp ?? ''}-${e.agent}-${e.operation}-${i}`}
                className="border-b border-hairline/60 last:border-0"
              >
                <td className="px-4 py-2.5 font-mono text-ink">{e.agent}</td>
                <td className="px-4 py-2.5 font-mono text-ink">{e.operation}</td>
                <td className="px-4 py-2.5">
                  {e.scopes
                    ? e.scopes.split(',').map((s) => (
                        <span key={s} className="mr-1 inline-block">
                          <Badge tone={scopeTone[s.trim()] ?? 'muted'}>{s.trim()}</Badge>
                        </span>
                      ))
                    : null}
                </td>
                <td className="px-4 py-2.5 font-mono text-ink-soft">{e.latency_ms != null ? `${e.latency_ms} ms` : '—'}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={statusTone(e.status)}>{e.status ?? '—'}</Badge>
                </td>
                <td className="px-4 py-2.5 text-muted">{timeAgo(e.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
