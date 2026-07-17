import { useState } from 'react';
import { callMcp } from './mcp-client';
import { buildInboxCaptureContent, defaultInboxSlug } from './capture-frontmatter';
import type { TriggerInboxEnrichmentResult } from './op-types';

/** 宽松镜像：只取 UI 用得到的字段（put_page 的完整返回见 operations.ts）。 */
interface PutPageResult {
  slug: string;
  status?: string;
  chunks?: number;
}

export interface CaptureInput {
  body: string;
  title?: string;
  type?: string;
  tags?: string[];
  triggerEnrichment?: boolean;
}

export interface CaptureSuccess {
  slug: string;
}

/** 单条采集的核心逻辑，被 submit（手动粘贴）和 submitBatch（文件/文件夹）共用。失败直接抛错。 */
async function performCapture(input: CaptureInput): Promise<CaptureSuccess> {
  const trimmed = input.body.trim();
  if (trimmed.length === 0) {
    throw new Error('正文不能为空');
  }
  const slug = defaultInboxSlug(input.body);
  const content = buildInboxCaptureContent(input.body, {
    title: input.title,
    type: input.type,
    tags: input.tags,
  });
  await callMcp<PutPageResult>('put_page', { slug, content });
  if (input.triggerEnrichment) {
    await callMcp<TriggerInboxEnrichmentResult>('trigger_inbox_enrichment', { slugs: [slug] });
  }
  return { slug };
}

export interface CaptureBatchItem {
  /** 列表行 key（相对路径或文件名），仅用于 UI 关联，不参与 slug 生成。 */
  key: string;
  /** 展示名：webkitRelativePath || file.name。 */
  name: string;
  body: string;
  title?: string;
  type?: string;
  tags?: string[];
}

export type CaptureBatchItemOutcome =
  | { key: string; status: 'success'; slug: string }
  | { key: string; status: 'error'; error: string };

export interface CaptureBatchOptions {
  triggerEnrichment?: boolean;
  /** 每条结束后触发，用于让调用方（弹窗）实时刷新该行状态。 */
  onItemSettled?: (outcome: CaptureBatchItemOutcome) => void;
}

export interface CaptureBatchResult {
  succeeded: { key: string; name: string; slug: string }[];
  failed: { key: string; name: string; error: string }[];
}

/**
 * Inbox「新建采集」的提交动作：拼出与 CLI/webhook 采集等价形状的 inbox
 * frontmatter，写入 put_page，可选紧接着触发 enrichment。全部走已暴露给
 * SPA 的 write-scope 操作（无新后端能力）。
 */
export function useCapture() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: CaptureInput): Promise<CaptureSuccess | null> => {
    setSubmitting(true);
    setError(null);
    try {
      return await performCapture(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 顺序（非并发）逐条提交，避免同时并发大量 put_page 请求；一条失败不影响
   * 后续条目继续提交。每条结束后调用 opts.onItemSettled 供调用方实时刷新
   * 该行状态。整体不 throw —— 结果都在返回的 succeeded/failed 里。
   */
  const submitBatch = async (
    items: CaptureBatchItem[],
    opts: CaptureBatchOptions = {},
  ): Promise<CaptureBatchResult> => {
    setSubmitting(true);
    setError(null);
    const succeeded: CaptureBatchResult['succeeded'] = [];
    const failed: CaptureBatchResult['failed'] = [];
    try {
      for (const item of items) {
        try {
          const result = await performCapture({
            body: item.body,
            title: item.title,
            type: item.type,
            tags: item.tags,
            triggerEnrichment: opts.triggerEnrichment,
          });
          succeeded.push({ key: item.key, name: item.name, slug: result.slug });
          opts.onItemSettled?.({ key: item.key, status: 'success', slug: result.slug });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          failed.push({ key: item.key, name: item.name, error: message });
          opts.onItemSettled?.({ key: item.key, status: 'error', error: message });
        }
      }
      return { succeeded, failed };
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitBatch, submitting, error, setError };
}
