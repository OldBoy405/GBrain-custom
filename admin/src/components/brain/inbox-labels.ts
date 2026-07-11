/**
 * 收件箱来源 / 状态的单一映射源。
 *
 * InboxCard、InboxDetail、EnrichmentPipeline 共用，避免同一份标签在多个组件里
 * 各写一份（历史上 SOURCE_LABEL 曾在两个文件里逐字重复）。
 */
import {
  MessageSquare,
  Mail,
  FileText,
  File,
  Mic,
  type LucideIcon,
} from 'lucide-react';
import type { BadgeTone } from './Badge';
import type { EnrichmentStatus } from '../../lib/op-types';

/** 来源→Lucide 图标。未知来源回退到 FileText。 */
export const SOURCE_ICON: Record<string, LucideIcon> = {
  jike: MessageSquare,
  mail: Mail,
  paste: FileText,
  file: File,
  voice: Mic,
  manual: FileText,
};

/** 来源→短标签。未知来源回退到大写原值。 */
export const SOURCE_LABEL: Record<string, string> = {
  jike: 'JIKE',
  mail: 'MAIL',
  paste: 'PASTE',
  file: 'FILE',
  voice: 'VOICE',
  manual: '手动',
};

/** 来源标签解析（含回退）。 */
export function sourceLabel(kind: string): string {
  return SOURCE_LABEL[kind] ?? kind.toUpperCase();
}

/** 状态→Badge tone + 中文文本。 */
export const STATUS_META: Record<EnrichmentStatus, { tone: BadgeTone; label: string }> = {
  pending_frontmatter: { tone: 'muted', label: '待 frontmatter' },
  pending_typed_link: { tone: 'accent', label: '待 typed-link' },
  merging: { tone: 'amber', label: '合并中…' },
  merged: { tone: 'ok', label: '已合并' },
  failed: { tone: 'contra', label: '失败' },
};

/** 状态元数据解析（含未知回退）。 */
export function statusMeta(status: string): { tone: BadgeTone; label: string } {
  return STATUS_META[status as EnrichmentStatus] ?? { tone: 'muted', label: status };
}
