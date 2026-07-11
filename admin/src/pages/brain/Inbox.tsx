import { useMemo, useState } from 'react';
import { Inbox as InboxIcon, Zap, Trash2 } from 'lucide-react';
import { callMcp } from '../../lib/mcp-client';
import { useInbox } from '../../lib/useInbox';
import { useInboxDetail } from '../../lib/useInboxDetail';
import { useInboxJobProgress } from '../../lib/useInboxJobProgress';
import type {
  DiscardInboxItemsResult,
  InboxItem,
  SourceType,
  EnrichmentStatus,
  TierLevel,
  TriggerInboxEnrichmentResult,
} from '../../lib/op-types';
import {
  PageHeader,
  AsyncState,
  InboxCard,
  InboxDetail,
  InboxDiscardDialog,
  WhyButton,
  type InboxDiscardMode,
} from '../../components/brain';

/** 可过滤的字段 */
type FilterKey = 'source' | 'status' | 'tier';

/** 过滤选项 */
interface FilterState {
  source: SourceType | 'all';
  status: EnrichmentStatus | 'all';
  tier: TierLevel | 'all';
}

const INITIAL_FILTER: FilterState = { source: 'all', status: 'all', tier: 'all' };

/** 来源过滤选项 */
const SOURCE_OPTIONS: Array<{ value: FilterState['source']; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'jike', label: '即刻' },
  { value: 'mail', label: '邮件' },
  { value: 'paste', label: '粘贴' },
  { value: 'file', label: '文件' },
  { value: 'voice', label: '语音' },
  { value: 'manual', label: '手动' },
];

/** 状态过滤选项 */
const STATUS_OPTIONS: Array<{ value: FilterState['status']; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending_frontmatter', label: '待 frontmatter' },
  { value: 'pending_typed_link', label: '待 typed-link' },
  { value: 'merging', label: '合并中' },
  { value: 'merged', label: '已合并' },
  { value: 'failed', label: '失败' },
];

/** Tier 过滤选项 */
const TIER_OPTIONS: Array<{ value: FilterState['tier']; label: string }> = [
  { value: 'all', label: '全部 Tier' },
  { value: 'T1', label: 'T1' },
  { value: 'T2', label: 'T2' },
  { value: 'T3', label: 'T3' },
];

/** 过滤药丸组。模块级组件，避免定义在 Inbox() 内导致每次渲染重挂载。 */
function FilterPills({
  options,
  active,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="过滤">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-brain-xs transition ${
            active === o.value
              ? 'border-accent text-accent'
              : 'border-hairline text-muted hover:border-emphasis hover:text-ink-soft'
          }`}
          style={{
            background: active === o.value ? 'var(--color-accent-soft)' : 'transparent',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function mergeListAndDetail(listItem: InboxItem | null, detail: InboxItem | null): InboxItem | null {
  if (!listItem && !detail) return null;
  if (!listItem) return detail;
  if (!detail) return listItem;
  return { ...listItem, ...detail };
}

/**
 * 收件箱页面 —— 双栏布局。
 * P1：专用 Inbox 契约 + 确定性 enrichment 写路径。
 * P2：丢弃软/硬选择、合并进度、失败态展示。
 */
export function Inbox() {
  const { items, stats, loading, error, reload } = useInbox();
  const [selected, setSelected] = useState<string | null>(null);
  const { detail, loading: detailLoading, error: detailError } = useInboxDetail(selected);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const selectedListItem = useMemo(
    () => (selected ? items.find((it) => it.slug === selected) ?? null : null),
    [items, selected],
  );

  const displayItem = useMemo(
    () => mergeListAndDetail(selectedListItem, detail),
    [selectedListItem, detail],
  );

  const { progress: jobProgress } = useInboxJobProgress(
    displayItem?.job_id,
    displayItem?.status === 'merging',
  );
  // No explicit reload-on-completion here: useInbox() already polls the list
  // every 2.5s while any item is merging and stops once merging hits 0, so a
  // completed job converges to `merged` within one poll cycle.

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const row = item.slug === selected ? displayItem ?? item : item;
      if (filters.source !== 'all' && row?.source_kind !== filters.source) return false;
      if (filters.status !== 'all' && row?.status !== filters.status) return false;
      if (filters.tier !== 'all' && row?.tier !== filters.tier) return false;
      return true;
    });
  }, [items, filters, selected, displayItem]);

  const handleToggleCheck = (slug: string, v: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (v) next.add(slug);
      else next.delete(slug);
      return next;
    });
  };

  // Eligible to enrich now = not already done and not in-flight. Matches
  // stats.pending_enrich (pending_frontmatter | pending_typed_link | failed).
  const pendingSlugs = useMemo(() => {
    const pending = new Set<string>();
    for (const item of filtered) {
      const row = item.slug === selected && displayItem ? displayItem : item;
      if (row && row.status !== 'merged' && row.status !== 'merging') pending.add(item.slug);
    }
    return pending;
  }, [filtered, selected, displayItem]);

  const allPendingChecked =
    pendingSlugs.size > 0 && [...pendingSlugs].every((slug) => checked.has(slug));

  const handleToggleSelectAllPending = () => {
    setChecked((prev) => {
      if (allPendingChecked) {
        const next = new Set(prev);
        for (const slug of pendingSlugs) next.delete(slug);
        return next;
      }
      return new Set(pendingSlugs);
    });
  };

  const handleTriggerEnrichment = async () => {
    if (checked.size === 0) return;
    setActionLoading(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await callMcp<TriggerInboxEnrichmentResult>(
        'trigger_inbox_enrichment',
        { slugs: [...checked] },
      );
      setChecked(new Set());
      if (result.skipped.length > 0) {
        setActionError(`跳过 ${result.skipped.length} 条：${result.skipped[0].reason}`);
      } else {
        setActionNotice(`已入队 ${result.accepted.length} 条 enrichment`);
      }
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const discardPreview = useMemo(
    () => items.filter((item) => checked.has(item.slug)).slice(0, 5),
    [items, checked],
  );

  const handleDiscardConfirm = async (mode: InboxDiscardMode) => {
    if (checked.size === 0) return;
    setActionLoading(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await callMcp<DiscardInboxItemsResult>(
        'discard_inbox_items',
        { slugs: [...checked], mode, ...(mode === 'hard' ? { confirm_destructive: true } : {}) },
      );
      if (result.failed.length > 0) {
        setActionError(
          `${mode === 'hard' ? '永久删除' : '软删除'}失败 ${result.failed.length} 条：${result.failed.slice(0, 3).map((x) => x.slug).join(', ')}`,
        );
      } else {
        setChecked(new Set());
        if (selected && checked.has(selected)) setSelected(null);
        setDiscardOpen(false);
        setActionNotice(
          mode === 'hard'
            ? `已永久删除 ${result.discarded.length} 条`
            : `已软删除 ${result.discarded.length} 条（72h 内可 restore_page 恢复）`,
        );
        reload();
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleFilterChange = (key: FilterKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSelected(null);
  };

  const enrichDisabled = checked.size === 0 || actionLoading;
  // 精确总数（stats 覆盖到扫描窗口，超出时显示 "N+"），而非展示分页后的 items.length。
  const totalLabel = stats.capped ? `${stats.total}+` : `${stats.total}`;

  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 收件箱 · INBOX"
        kickerMono
        icon={<InboxIcon size={26} strokeWidth={1.75} className="text-accent" aria-hidden />}
        title={`${totalLabel} 条待处理`}
        subtitle={`混合来源 · 自动 enrichment 4 步流水线。${stats.pending_enrich} 条待 enrich · 选中右侧可看 raw vs enriched diff。`}
        right={
          <button
            onClick={reload}
            className="cursor-pointer rounded-lg border border-hairline px-3 py-1.5 text-brain-base text-ink-soft hover:bg-hairline/40 transition"
          >
            刷新
          </button>
        }
      />

      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-hairline p-3"
        style={{ background: 'var(--color-elevated)' }}
      >
        <label className="flex cursor-pointer items-center gap-1.5 text-brain-sm text-ink-soft">
          <input
            type="checkbox"
            checked={allPendingChecked}
            onChange={handleToggleSelectAllPending}
            className="cursor-pointer"
            style={{ accentColor: 'var(--color-accent)' }}
          />
          全选待 enrich · {stats.pending_enrich} 条
        </label>

        <span className="h-4 w-px" style={{ background: 'var(--color-hairline)' }} />

        <button
          type="button"
          onClick={handleTriggerEnrichment}
          disabled={enrichDisabled}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 px-3 py-1.5 text-brain-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--color-accent)', color: 'var(--color-inverse)' }}
        >
          <Zap size={13} aria-hidden />
          {actionLoading ? '处理中…' : `触发 enrichment (${checked.size})`}
        </button>

        <button
          type="button"
          onClick={() => setDiscardOpen(true)}
          disabled={checked.size === 0 || actionLoading}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-transparent px-3 py-1.5 text-brain-sm text-ink-soft transition hover:border-contra hover:text-contra disabled:opacity-40"
        >
          <Trash2 size={13} aria-hidden />
          丢弃 ({checked.size})
        </button>

        {actionNotice && (
          <span className="text-brain-sm" style={{ color: 'var(--color-ok)' }}>
            {actionNotice}
          </span>
        )}

        {actionError && (
          <span className="text-brain-sm" style={{ color: 'var(--color-contra)' }}>
            {actionError}
          </span>
        )}

        <span className="hidden items-center gap-2 font-mono text-brain-xs text-muted sm:inline-flex" style={{ marginLeft: 'auto' }}>
          enrichment 4 步流水线 ·
          <WhyButton topic="enrichment-pipeline" />
        </span>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          <FilterPills options={SOURCE_OPTIONS} active={filters.source} onChange={(v) => handleFilterChange('source', v)} />
          <FilterPills options={STATUS_OPTIONS} active={filters.status} onChange={(v) => handleFilterChange('status', v)} />
          <FilterPills options={TIER_OPTIONS} active={filters.tier} onChange={(v) => handleFilterChange('tier', v)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AsyncState
            loading={loading}
            error={error}
            empty={filtered.length === 0}
            emptyText={items.length === 0 ? '暂无 inbox/ 页面。' : '没有匹配过滤条件的内容。'}
          />
          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: '72vh' }}>
              {filtered.map((item) => {
                const row = item.slug === selected && displayItem ? displayItem : item;
                return (
                  <InboxCard
                    key={item.slug}
                    item={row}
                    selected={selected === item.slug}
                    checked={checked.has(item.slug)}
                    onSelect={(slug) => setSelected(slug === selected ? null : slug)}
                    onCheck={handleToggleCheck}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          <div
            className="overflow-y-auto rounded-xl border border-hairline p-5"
            style={{ background: 'var(--color-surface)', maxHeight: '72vh' }}
          >
            <InboxDetail
              item={displayItem}
              loading={detailLoading}
              error={detailError}
              jobProgress={jobProgress}
            />
          </div>
        </div>
      </div>

      <InboxDiscardDialog
        open={discardOpen}
        count={checked.size}
        previewItems={discardPreview}
        busy={actionLoading}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={handleDiscardConfirm}
      />
    </div>
  );
}
