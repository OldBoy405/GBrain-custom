import type { InboxItem, SourceType } from '../../lib/op-types';
import { Badge } from './Badge';
import { EnrichmentPipeline } from './EnrichmentPipeline';
import { EnrichmentDiff } from './EnrichmentDiff';
import { TypedLinkTable } from './TypedLinkTable';
import { sourceLabel, statusMeta } from './inbox-labels';
import type { InboxJobProgress } from '../../lib/useInboxJobProgress';

function timeFull(ts?: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

/**
 * 收件箱右栏详情面板。
 * item 为 null 时渲染空态；loading 时显示加载提示（不展示 spinner，符合 DESIGN.md）。
 */
export function InboxDetail({
  item,
  loading = false,
  error = null,
  jobProgress = null,
}: {
  item: InboxItem | null;
  loading?: boolean;
  error?: string | null;
  jobProgress?: InboxJobProgress | null;
}) {
  if (!item) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
        <div className="text-brain-lg text-muted">请从左栏选择一条内容</div>
        <div className="text-brain-sm text-muted">查看 raw vs enriched 对照</div>
      </div>
    );
  }

  const source = (item.source_kind ?? 'unknown') as SourceType;
  const srcLabel = sourceLabel(source);
  const hasEnriched = Boolean(item.enriched_content);
  const hasTypedLinks = Boolean(item.typed_links && item.typed_links.length > 0);
  const hasPipeline = Boolean(item.status) || hasEnriched || hasTypedLinks;
  const showDiff = Boolean(item.raw_content);
  const jobLabel =
    item.status === 'merging' && item.job_id != null
      ? jobProgress?.progress?.phase
        ? `job #${item.job_id} · ${jobProgress.progress.phase} · ${jobProgress.progress.completed ?? '?'}/${jobProgress.progress.total ?? '?'}`
        : `job #${item.job_id} · ${jobProgress?.status ?? '…'}`
      : null;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-brain-2sm text-muted">
            // {item.slug} · {srcLabel}
          </span>
          {item.status && <Badge tone={statusMeta(item.status).tone}>{statusMeta(item.status).label}</Badge>}
          {loading && <span className="text-brain-xs text-muted">加载详情…</span>}
        </div>
        <h2 className="type-serif text-brain-2xl font-semibold leading-snug text-ink">
          {item.title || <span className="text-muted">（无标题）</span>}
        </h2>
        <div className="mt-1 flex items-center gap-3 text-brain-sm text-ink-soft">
          <span>ingested {timeFull(item.updated_at)}</span>
          {item.tier && <span>· tier {item.tier}</span>}
        </div>
        {item.status === 'merging' && (
          <div className="mt-2">
            <button
              type="button"
              data-testid="goto-compile"
              onClick={() => {
                const seed = item.title?.trim() || item.slug.split('/').pop() || '';
                window.location.hash = `/synthesize?topic=${encodeURIComponent(seed)}`;
              }}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-elevated px-2.5 py-1 text-brain-sm text-accent transition hover:bg-accent-soft"
            >
              去编译 → 真理沉淀
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-hairline px-3 py-2 text-brain-sm" style={{ color: 'var(--color-contra)' }}>
          详情加载失败：{error}
        </div>
      )}

      {item.error && (
        <div
          className="rounded-lg border px-3 py-2 text-brain-sm"
          style={{ borderColor: 'var(--color-contra)', color: 'var(--color-contra)', background: 'color-mix(in srgb, var(--color-contra) 8%, transparent)' }}
        >
          enrichment 失败：{item.error}
        </div>
      )}

      {hasPipeline && item.status && (
        <EnrichmentPipeline
          status={item.status}
          jobProgress={jobProgress?.progress}
          jobLabel={jobLabel}
        />
      )}

      {showDiff && <EnrichmentDiff raw={item.raw_content!} enriched={item.enriched_content} />}

      {hasTypedLinks && <TypedLinkTable links={item.typed_links!} />}
    </div>
  );
}
