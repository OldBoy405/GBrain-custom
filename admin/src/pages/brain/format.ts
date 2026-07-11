/** 今日动态 · 运营概览的活动流格式化工具（Brain 表层专用）。
 *  与 Ops 版 Dashboard 的英文 timeAgo 刻意不共用——两个 surface 不统一（见 admin/CLAUDE.md）。 */
import type { BadgeTone } from '../../components/brain';

export const scopeTone: Record<string, BadgeTone> = { read: 'accent', write: 'amber', admin: 'contra' };

export function statusTone(status?: string): BadgeTone {
  if (status === 'success') return 'ok';
  if (status === 'error') return 'contra';
  return 'muted';
}

export function timeAgo(ts?: string): string {
  if (!ts) return '刚刚';
  const diff = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(diff)) return '刚刚';
  if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  return `${Math.floor(diff / 3_600_000)}小时前`;
}
