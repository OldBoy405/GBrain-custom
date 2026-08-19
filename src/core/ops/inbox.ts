/**
 * Inbox workflow ops — custom fork (Brain Inbox page).
 * Never import from '../operations.ts' here (cycle).
 */

import { clampSearchLimit } from '../engine.ts';
import { computeContentHash } from '../ingestion/types.ts';
import type { InboxStatus, InboxTier } from '../types.ts';
import { INBOX_STATUSES } from '../types.ts';
import {
  isInboxSlug,
  pageToInboxDetail,
  pageToInboxItem,
  patchInboxFrontmatter,
} from '../inbox.ts';
import { OperationError } from './contract.ts';
import type { Operation } from './contract.ts';
import { linkReadScopeOpts, sourceScopeOpts } from './context.ts';

const LIST_PAGES_SORT_VALUES = ['updated_desc', 'updated_asc', 'created_desc', 'slug'] as const;
type ListPagesSort = typeof LIST_PAGES_SORT_VALUES[number];

const INBOX_STATS_SCAN = 2000;

const list_inbox: Operation = {
  name: 'list_inbox',
  description: 'List inbox/* pages with deterministic enrichment workflow state and aggregate counts.',
  params: {
    status: { type: 'string', enum: [...INBOX_STATUSES] },
    source_kind: { type: 'string', description: 'Filter by ingestion source kind' },
    tier: { type: 'string', enum: ['T1', 'T2', 'T3'] },
    limit: { type: 'number', description: 'Max results (default 50, max 100)' },
    sort: {
      type: 'string',
      enum: [...LIST_PAGES_SORT_VALUES],
      description: 'Sort order (default updated_desc)',
    },
  },
  scope: 'read',
  handler: async (ctx, p) => {
    const rawSort = p.sort as string | undefined;
    const sort = rawSort && (LIST_PAGES_SORT_VALUES as readonly string[]).includes(rawSort)
      ? (rawSort as ListPagesSort)
      : undefined;
    const pages = await ctx.engine.listPages({
      slugPrefix: 'inbox/',
      limit: INBOX_STATS_SCAN + 1,
      sort,
      ...sourceScopeOpts(ctx),
    });
    const capped = pages.length > INBOX_STATS_SCAN;
    const allItems = (capped ? pages.slice(0, INBOX_STATS_SCAN) : pages).map(pageToInboxItem);
    let merging = 0;
    let merged = 0;
    let failed = 0;
    for (const item of allItems) {
      if (item.status === 'merging') merging++;
      else if (item.status === 'merged') merged++;
      else if (item.status === 'failed') failed++;
    }
    const stats = {
      total: allItems.length,
      pending_enrich: allItems.length - merging - merged,
      merging,
      merged,
      failed,
      capped,
    };
    const status = p.status as InboxStatus | undefined;
    const tier = p.tier as InboxTier | undefined;
    const sourceKind = typeof p.source_kind === 'string' ? p.source_kind : undefined;
    const limit = clampSearchLimit(p.limit as number | undefined, 50, 100);
    const items = allItems
      .filter(item => !status || item.status === status)
      .filter(item => !tier || item.tier === tier)
      .filter(item => !sourceKind || item.source_kind === sourceKind)
      .slice(0, limit);
    return { items, stats };
  },
};

const get_inbox_item: Operation = {
  name: 'get_inbox_item',
  description: 'Get one inbox item with raw/enriched content and typed links.',
  params: {
    slug: { type: 'string', required: true },
  },
  scope: 'read',
  handler: async (ctx, p) => {
    const slug = p.slug as string;
    if (!isInboxSlug(slug)) {
      throw new OperationError('invalid_params', 'Inbox slug must start with inbox/');
    }
    const page = await ctx.engine.getPage(slug, sourceScopeOpts(ctx));
    if (!page) throw new OperationError('page_not_found', `Page not found: ${slug}`);
    const [tags, links] = await Promise.all([
      ctx.engine.getTags(slug, { sourceId: page.source_id }),
      ctx.engine.getLinks(slug, linkReadScopeOpts(ctx)),
    ]);
    return pageToInboxDetail(page, tags, links);
  },
};

function parseInboxSlugsParam(raw: unknown): string[] {
  const slugs = [...new Set(
    (Array.isArray(raw) ? raw : []).filter((v): v is string => typeof v === 'string'),
  )];
  if (slugs.length === 0 || slugs.length > 50 || slugs.some(slug => !isInboxSlug(slug))) {
    throw new OperationError('invalid_params', 'slugs must contain 1-50 unique inbox/ slugs');
  }
  return slugs;
}

function inboxMergingPatch(jobId: number, tier: InboxTier | undefined): Record<string, unknown> {
  return {
    inbox_status: 'merging',
    inbox_job_id: jobId,
    inbox_error: null,
    ...(tier ? { enrichment_tier: tier } : {}),
  };
}

const trigger_inbox_enrichment: Operation = {
  name: 'trigger_inbox_enrichment',
  description: 'Queue deterministic, zero-LLM enrichment for inbox pages.',
  params: {
    slugs: { type: 'array', required: true, items: { type: 'string' } },
    tier: { type: 'string', enum: ['T1', 'T2', 'T3'] },
  },
  mutating: true,
  scope: 'write',
  handler: async (ctx, p) => {
    const slugs = parseInboxSlugsParam(p.slugs);
    if (ctx.dryRun) return { dry_run: true, action: 'trigger_inbox_enrichment', slugs };

    const { MinionQueue } = await import('../minions/queue.ts');
    const queue = new MinionQueue(ctx.engine);
    const accepted: Array<{ slug: string; job_id: number; status: string }> = [];
    const skipped: Array<{ slug: string; reason: string }> = [];
    const tier = p.tier as InboxTier | undefined;
    const pages = await Promise.all(slugs.map(slug => ctx.engine.getPage(slug, sourceScopeOpts(ctx))));

    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const page = pages[i];
      if (!page) {
        skipped.push({ slug, reason: 'not_found_or_out_of_scope' });
        continue;
      }
      const raw = typeof page.frontmatter?.raw_content === 'string'
        ? page.frontmatter.raw_content
        : page.compiled_truth;
      const revision = computeContentHash(raw).slice(0, 16);
      let job = await queue.add(
        'inbox_enrich',
        { slug, source_id: page.source_id },
        {
          max_attempts: 3,
          delay: 250,
          idempotency_key: `inbox-enrich:${page.source_id}:${slug}:${revision}`,
        },
      );
      if (job.status === 'failed' || job.status === 'dead') {
        await patchInboxFrontmatter(ctx.engine, page, inboxMergingPatch(job.id, tier));
        job = (await queue.retryJob(job.id)) ?? job;
      }
      if (job.status === 'completed') {
        skipped.push({ slug, reason: 'already_enriched_for_revision' });
        continue;
      }
      if (job.status !== 'active' && job.status !== 'waiting') {
        await patchInboxFrontmatter(ctx.engine, page, inboxMergingPatch(job.id, tier));
      }
      accepted.push({ slug, job_id: job.id, status: job.status });
    }
    return { accepted, skipped };
  },
};

const discard_inbox_items: Operation = {
  name: 'discard_inbox_items',
  description:
    'Discard inbox pages in a bounded batch. mode=soft (default) hides pages for 72h and allows restore_page; ' +
    'mode=hard permanently deletes pages and cascaded graph data and requires confirm_destructive:true ' +
    '(mirrors sources_remove — irreversible, so it needs an explicit ack even though the op itself stays write-scoped/remote-reachable).',
  params: {
    slugs: { type: 'array', required: true, items: { type: 'string' } },
    mode: {
      type: 'string',
      enum: ['soft', 'hard'],
      description: 'soft=recoverable via restore_page (default); hard=permanent delete',
    },
    confirm_destructive: {
      type: 'boolean',
      description: 'Required when mode=hard. Without it the op refuses (soft mode ignores this param).',
    },
  },
  mutating: true,
  scope: 'write',
  handler: async (ctx, p) => {
    const slugs = parseInboxSlugsParam(p.slugs);
    const mode = p.mode === 'hard' ? 'hard' : 'soft';
    if (mode === 'hard' && p.confirm_destructive !== true) {
      throw new OperationError(
        'invalid_params',
        'mode=hard permanently deletes pages — pass confirm_destructive:true to proceed',
      );
    }
    if (ctx.dryRun) return { dry_run: true, action: 'discard_inbox_items', slugs, mode };

    const pages = await Promise.all(slugs.map(slug => ctx.engine.getPage(slug, sourceScopeOpts(ctx))));
    const discarded: string[] = [];
    const failed: Array<{ slug: string; reason: string }> = [];
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const page = pages[i];
      if (!page) {
        failed.push({ slug, reason: 'not_found_or_out_of_scope' });
        continue;
      }
      if (mode === 'hard') {
        try {
          await ctx.engine.deletePage(slug, { sourceId: page.source_id });
          discarded.push(slug);
        } catch {
          failed.push({ slug, reason: 'hard_delete_failed' });
        }
        continue;
      }
      const result = await ctx.engine.softDeletePage(slug, { sourceId: page.source_id });
      if (result) discarded.push(slug);
      else failed.push({ slug, reason: 'already_soft_deleted' });
    }
    return { mode, discarded, failed };
  },
};

export const inboxOperations: Operation[] = [
  list_inbox, get_inbox_item, trigger_inbox_enrichment, discard_inbox_items,
];
