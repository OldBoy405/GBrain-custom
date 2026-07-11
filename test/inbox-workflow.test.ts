import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { resetPgliteState } from './helpers/reset-pglite.ts';
import { operationsByName } from '../src/core/operations.ts';
import { makeInboxEnrichHandler } from '../src/core/minions/handlers/inbox-enrich.ts';
import { prepareInboxCaptureContent } from '../src/core/inbox.ts';
import { LATEST_VERSION, runMigrations } from '../src/core/migrate.ts';
import type { MinionJobContext } from '../src/core/minions/types.ts';

let engine: PGLiteEngine;

beforeAll(async () => {
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
});

afterAll(async () => {
  await engine.disconnect();
});

beforeEach(async () => {
  await resetPgliteState(engine);
  await engine.setConfig('version', String(LATEST_VERSION));
});

function ctx(sourceId = 'default') {
  return {
    engine,
    config: {},
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    dryRun: false,
    remote: true,
    sourceId,
  } as any;
}

function job(id: number, slug: string): MinionJobContext {
  return {
    id,
    name: 'inbox_enrich',
    data: { slug, source_id: 'default' },
    attempts_made: 1,
    signal: new AbortController().signal,
    shutdownSignal: new AbortController().signal,
    updateProgress: async () => {},
    updateTokens: async () => {},
    log: async () => {},
    isActive: async () => true,
    readInbox: async () => [],
  };
}

async function put(slug: string, body: string, frontmatter: Record<string, unknown> = {}) {
  return engine.putPage(slug, {
    type: 'note',
    title: slug,
    compiled_truth: body,
    timeline: '',
    frontmatter,
  }, { sourceId: 'default' });
}

describe('Inbox operation definitions', () => {
  test('registers dedicated read/write operations', () => {
    expect(operationsByName.list_inbox.scope).toBe('read');
    expect(operationsByName.get_inbox_item.scope).toBe('read');
    expect(operationsByName.trigger_inbox_enrichment.scope).toBe('write');
    expect(operationsByName.trigger_inbox_enrichment.mutating).toBe(true);
    expect(operationsByName.discard_inbox_items.scope).toBe('write');
  });
});

describe('Inbox deterministic workflow', () => {
  test('capture metadata preserves raw body and source', () => {
    const content = prepareInboxCaptureContent('# Hello\n\nBody', {
      sourceKind: 'webhook',
      receivedAt: '2026-07-10T00:00:00Z',
      metadata: { channel: 'test' },
    });
    expect(content).toContain('inbox_status: pending_frontmatter');
    expect(content).toContain('source_kind: webhook');
    expect(content).toContain('raw_content:');
    expect(content).toContain('channel: test');
  });

  test('list/get project canonical inbox state and typed links', async () => {
    await put('concepts/x', '# X');
    await put('inbox/a', '# A\n\n[[concepts/x|X]]', {
      raw_content: '# A',
      inbox_status: 'pending_typed_link',
      enrichment_tier: 'T2',
    });
    await engine.addLink(
      'inbox/a',
      'concepts/x',
      'explicit evidence',
      'mentions',
      'manual',
      undefined,
      undefined,
      { fromSourceId: 'default', toSourceId: 'default' },
    );
    await put('people/not-inbox', '# Person');

    const list = await operationsByName.list_inbox.handler(ctx(), { limit: 100 }) as any;
    expect(list.items).toHaveLength(1);
    expect(list.items[0].slug).toBe('inbox/a');
    expect(list.items[0].status).toBe('pending_typed_link');
    expect(list.items[0].tier).toBe('T2');
    expect(list.stats.pending_enrich).toBe(1);

    const detail = await operationsByName.get_inbox_item.handler(ctx(), { slug: 'inbox/a' }) as any;
    expect(detail.raw_content).toBe('# A');
    expect(detail.enriched_content).toContain('inbox_status: pending_typed_link');
    expect(detail.typed_links).toHaveLength(1);
    expect(detail.typed_links[0].context).toBe('explicit evidence');
  });

  test('list_inbox honors source scope', async () => {
    await engine.executeRaw(
      `INSERT INTO sources (id, name, config) VALUES ($1, $2, '{}'::jsonb)`,
      ['team', 'team'],
    );
    await put('inbox/default', '# Default');
    await engine.putPage('inbox/team', {
      type: 'note',
      title: 'Team',
      compiled_truth: '# Team',
      timeline: '',
      frontmatter: { inbox_status: 'pending_frontmatter' },
    }, { sourceId: 'team' });
    const result = await operationsByName.list_inbox.handler(ctx('default'), {}) as any;
    expect(result.items.map((x: any) => x.slug)).toEqual(['inbox/default']);
  });

  test('trigger is idempotent for the same raw revision', async () => {
    await put('inbox/a', '# A', {
      raw_content: '# A',
      inbox_status: 'pending_frontmatter',
    });
    const first = await operationsByName.trigger_inbox_enrichment.handler(
      ctx(),
      { slugs: ['inbox/a'] },
    ) as any;
    const second = await operationsByName.trigger_inbox_enrichment.handler(
      ctx(),
      { slugs: ['inbox/a'] },
    ) as any;
    expect(first.accepted).toHaveLength(1);
    expect(second.accepted).toHaveLength(1);
    expect(second.accepted[0].job_id).toBe(first.accepted[0].job_id);
    const rows = await engine.executeRaw<{ count: string }>(
      `SELECT count(*)::text AS count FROM minion_jobs WHERE name = 'inbox_enrich'`,
    );
    expect(rows[0].count).toBe('1');
  });

  test('trigger rejects non-inbox slugs and skips out-of-scope pages', async () => {
    await expect(
      operationsByName.trigger_inbox_enrichment.handler(ctx(), { slugs: ['people/a'] }),
    ).rejects.toThrow(/inbox/);

    await engine.executeRaw(
      `INSERT INTO sources (id, name, config) VALUES ($1, $2, '{}'::jsonb)`,
      ['team', 'team'],
    );
    await engine.putPage('inbox/team-only', {
      type: 'note',
      title: 'Team',
      compiled_truth: '# Team',
      timeline: '',
      frontmatter: { inbox_status: 'pending_frontmatter' },
    }, { sourceId: 'team' });
    const result = await operationsByName.trigger_inbox_enrichment.handler(
      ctx('default'),
      { slugs: ['inbox/team-only'] },
    ) as any;
    expect(result.accepted).toEqual([]);
    expect(result.skipped).toEqual([
      { slug: 'inbox/team-only', reason: 'not_found_or_out_of_scope' },
    ]);
  });

  test('handler merges deterministically and reconciles explicit links', async () => {
    await put('concepts/x', '# X');
    await put('inbox/a', '# A\n\n[Concept](concepts/x)', {
      raw_content: '# A\n\n[Concept](concepts/x)',
      inbox_status: 'merging',
      inbox_job_id: 42,
    });
    const result = await makeInboxEnrichHandler(engine)(job(42, 'inbox/a'));
    expect(result.status).toBe('merged');
    const page = await engine.getPage('inbox/a', { sourceId: 'default' });
    expect(page?.frontmatter.inbox_status).toBe('merged');
    expect(page?.frontmatter.inbox_enriched_at).toBeString();
    const links = await engine.getLinks('inbox/a', { sourceId: 'default' });
    expect(links.some(link => link.to_slug === 'concepts/x')).toBe(true);
  });

  test('handler lands on failed (not a workflow stage) when enrichment throws', async () => {
    await put('inbox/boom', '# Boom', {
      raw_content: '# Boom',
      inbox_status: 'merging',
      inbox_job_id: 7,
    });
    const aborted = new AbortController();
    aborted.abort();
    const abortedJob: MinionJobContext = { ...job(7, 'inbox/boom'), signal: aborted.signal };
    await expect(makeInboxEnrichHandler(engine)(abortedJob)).rejects.toThrow(/aborted/);
    const page = await engine.getPage('inbox/boom', { sourceId: 'default' });
    expect(page?.frontmatter.inbox_status).toBe('failed');
    expect(page?.frontmatter.inbox_error).toContain('aborted');
  });

  test('list_inbox stats exclude merging from pending_enrich and count failed', async () => {
    await put('inbox/f1', '# F1', { raw_content: '# F1', inbox_status: 'pending_frontmatter' });
    await put('inbox/f2', '# F2', { raw_content: '# F2', inbox_status: 'pending_typed_link' });
    await put('inbox/f3', '# F3', { raw_content: '# F3', inbox_status: 'merging' });
    await put('inbox/f4', '# F4', { raw_content: '# F4', inbox_status: 'merged' });
    await put('inbox/f5', '# F5', { raw_content: '# F5', inbox_status: 'failed' });
    const list = await operationsByName.list_inbox.handler(ctx(), {}) as any;
    expect(list.stats.total).toBe(5);
    // pending_frontmatter + pending_typed_link + failed = 3 (excludes merging + merged)
    expect(list.stats.pending_enrich).toBe(3);
    expect(list.stats.merging).toBe(1);
    expect(list.stats.merged).toBe(1);
    expect(list.stats.failed).toBe(1);
    expect(list.stats.capped).toBe(false);
  });

  test('capture classifies content shipping its own frontmatter as pending_typed_link', () => {
    const withFm = prepareInboxCaptureContent('---\ntype: person\n---\n# Alice', {
      sourceKind: 'mail',
      receivedAt: '2026-07-10T00:00:00Z',
    });
    expect(withFm).toContain('inbox_status: pending_typed_link');
    const bare = prepareInboxCaptureContent('# Just a heading', {
      sourceKind: 'paste',
      receivedAt: '2026-07-10T00:00:00Z',
    });
    expect(bare).toContain('inbox_status: pending_frontmatter');
  });

  test('discard soft-deletes only inbox pages', async () => {
    await put('inbox/a', '# A');
    const result = await operationsByName.discard_inbox_items.handler(
      ctx(),
      { slugs: ['inbox/a'] },
    ) as any;
    expect(result.mode).toBe('soft');
    expect(result.discarded).toEqual(['inbox/a']);
    expect(await engine.getPage('inbox/a', { sourceId: 'default' })).toBeNull();
  });

  test('discard hard mode requires confirm_destructive', async () => {
    await put('inbox/hard-unconfirmed', '# Hard');
    await expect(
      operationsByName.discard_inbox_items.handler(ctx(), { slugs: ['inbox/hard-unconfirmed'], mode: 'hard' }),
    ).rejects.toThrow(/confirm_destructive/);
    // Refused before any delete — page is untouched.
    expect(await engine.getPage('inbox/hard-unconfirmed', { sourceId: 'default' })).not.toBeNull();
  });

  test('discard hard mode permanently removes inbox pages when confirmed', async () => {
    await put('inbox/hard', '# Hard');
    const result = await operationsByName.discard_inbox_items.handler(
      ctx(),
      { slugs: ['inbox/hard'], mode: 'hard', confirm_destructive: true },
    ) as any;
    expect(result.mode).toBe('hard');
    expect(result.discarded).toEqual(['inbox/hard']);
    expect(await engine.getPage('inbox/hard', { sourceId: 'default', includeDeleted: true })).toBeNull();
  });

  test('discard hard mode skips a page mid-enrichment instead of racing it', async () => {
    await put('inbox/hard-merging', '# Merging', { inbox_status: 'merging' });
    const result = await operationsByName.discard_inbox_items.handler(
      ctx(),
      { slugs: ['inbox/hard-merging'], mode: 'hard', confirm_destructive: true },
    ) as any;
    expect(result.discarded).toEqual([]);
    expect(result.failed).toEqual([{ slug: 'inbox/hard-merging', reason: 'enrichment_in_progress' }]);
    expect(await engine.getPage('inbox/hard-merging', { sourceId: 'default' })).not.toBeNull();
  });

  test('migration backfills legacy inbox frontmatter', async () => {
    await put('inbox/legacy', '# Legacy');
    await engine.setConfig('version', '122');
    const result = await runMigrations(engine);
    expect(result.current).toBe(123);
    const page = await engine.getPage('inbox/legacy', { sourceId: 'default' });
    expect(page?.frontmatter.raw_content).toBe('# Legacy');
    expect(page?.frontmatter.inbox_status).toBe('pending_frontmatter');
    expect(page?.frontmatter.inbox_legacy_source).toBe(true);
  });
});
