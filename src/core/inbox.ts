import matter from 'gray-matter';
import type { BrainEngine } from './engine.ts';
import { serializeMarkdown } from './markdown.ts';
import type {
  InboxDetail,
  InboxItem,
  InboxStatus,
  InboxTier,
  Link,
  Page,
} from './types.ts';
import { INBOX_STATUSES, INBOX_TIERS } from './types.ts';

// Derived from the canonical arrays so a new status/tier can't drift out of the
// read-side validation set (the `failed` state was almost silently dropped here).
const STATUS_SET = new Set<InboxStatus>(INBOX_STATUSES);
const TIER_SET = new Set<InboxTier>(INBOX_TIERS);

export function isInboxSlug(slug: string): boolean {
  return slug.startsWith('inbox/');
}

export function inboxStatus(frontmatter: Record<string, unknown>): InboxStatus {
  const raw = frontmatter.inbox_status;
  return typeof raw === 'string' && STATUS_SET.has(raw as InboxStatus)
    ? (raw as InboxStatus)
    : 'pending_frontmatter';
}

export function inboxTier(frontmatter: Record<string, unknown>): InboxTier | null {
  const raw = frontmatter.enrichment_tier ?? frontmatter.tier;
  if (typeof raw !== 'string') return null;
  const normalized = raw.toUpperCase() as InboxTier;
  return TIER_SET.has(normalized) ? normalized : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function pageToInboxItem(page: Page): InboxItem {
  const fm = page.frontmatter ?? {};
  return {
    slug: page.slug,
    source_id: page.source_id,
    type: page.type,
    title: page.title,
    updated_at: page.updated_at,
    source_kind: page.source_kind ?? optionalString(fm.source_kind) ?? optionalString(fm.captured_via),
    source_uri: page.source_uri ?? null,
    ingested_at: page.ingested_at ?? null,
    status: inboxStatus(fm),
    tier: inboxTier(fm),
    job_id: optionalNumber(fm.inbox_job_id),
    error: optionalString(fm.inbox_error),
    preview: page.compiled_truth.replace(/\s+/g, ' ').trim().slice(0, 180),
  };
}

export function pageToInboxDetail(page: Page, tags: string[], links: Link[]): InboxDetail {
  const raw = optionalString(page.frontmatter?.raw_content) ?? page.compiled_truth;
  return {
    ...pageToInboxItem(page),
    raw_content: raw,
    enriched_content: serializeMarkdown(
      page.frontmatter ?? {},
      page.compiled_truth,
      page.timeline ?? '',
      { type: page.type, title: page.title, tags },
    ),
    frontmatter: page.frontmatter ?? {},
    typed_links: links,
  };
}

/** Stamp workflow metadata onto incoming content while preserving user fields. */
export function prepareInboxCaptureContent(
  content: string,
  input: {
    sourceKind: string;
    receivedAt: string;
    metadata?: Record<string, unknown>;
  },
): string {
  const parsed = matter(content);
  const existing = (parsed.data ?? {}) as Record<string, unknown>;
  // Arrival classification (keeps the workflow enum honest — every state is
  // reachable from real captures, not just the error path). Content that
  // shipped its own frontmatter is one stage further along: frontmatter is
  // present, so it only awaits typed-link reconciliation. Bare content starts
  // at pending_frontmatter.
  const arrivalStatus: InboxStatus =
    Object.keys(existing).length > 0 ? 'pending_typed_link' : 'pending_frontmatter';
  const merged: Record<string, unknown> = {
    ...existing,
    inbox_status: existing.inbox_status ?? arrivalStatus,
    raw_content: existing.raw_content ?? parsed.content,
    source_kind: existing.source_kind ?? input.sourceKind,
    captured_at: existing.captured_at ?? input.receivedAt,
  };
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    merged.ingestion_metadata = existing.ingestion_metadata ?? input.metadata;
  }
  return matter.stringify(parsed.content, merged);
}

/** Narrow page update for workflow metadata; body/timeline/provenance survive. */
export async function patchInboxFrontmatter(
  engine: BrainEngine,
  page: Page,
  patch: Record<string, unknown>,
): Promise<Page> {
  return engine.putPage(
    page.slug,
    {
      type: page.type,
      title: page.title,
      compiled_truth: page.compiled_truth,
      timeline: page.timeline,
      frontmatter: { ...(page.frontmatter ?? {}), ...patch },
      content_hash: page.content_hash,
      source_kind: page.source_kind,
      source_uri: page.source_uri,
      ingested_via: page.ingested_via,
    },
    { sourceId: page.source_id },
  );
}
