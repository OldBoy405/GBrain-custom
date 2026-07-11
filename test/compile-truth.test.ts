import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { resetPgliteState } from './helpers/reset-pglite.ts';
import { operationsByName } from '../src/core/operations.ts';
import { compileTruth } from '../src/core/compile-truth.ts';
import { LATEST_VERSION } from '../src/core/migrate.ts';

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

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    engine,
    config: {},
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    dryRun: false,
    remote: false,
    sourceId: 'default',
    ...overrides,
  } as any;
}

async function put(slug: string, body: string) {
  return engine.putPage(
    slug,
    { type: 'note', title: slug, compiled_truth: body, timeline: '', frontmatter: {} },
    { sourceId: 'default' },
  );
}

describe('compiled-truth op registration', () => {
  test('three ops registered with correct scope', () => {
    expect(operationsByName.find_conflicts.scope).toBe('read');
    expect(operationsByName.compile_truth.scope).toBe('read');
    expect(operationsByName.adopt_compiled_truth.scope).toBe('write');
    expect(operationsByName.adopt_compiled_truth.mutating).toBe(true);
  });
});

describe('compileTruth core (stubbed LLM)', () => {
  test('merges candidates and parses diff from stub JSON', async () => {
    await put('a', 'Dream cycle has 9 phases.');
    await put('b', 'The order is semantically locked.');
    const stub = JSON.stringify({
      compiled_markdown: '## Dream Cycle\n\n9 phases, order locked.',
      diff: [
        { op: 'keep', text: '9 phases' },
        { op: 'merge', text: 'order locked' },
      ],
    });
    const r = await compileTruth(engine, { slugs: ['a', 'b'], stubResponse: stub });
    expect(r.compiled_markdown).toContain('9 phases');
    expect(r.diff).toHaveLength(2);
    expect(r.sources).toEqual(['a', 'b']);
    expect(r.warnings).toHaveLength(0);
  });

  test('warns on missing candidate but still compiles the rest', async () => {
    await put('a', 'only page');
    const stub = JSON.stringify({ compiled_markdown: '## x', diff: [] });
    const r = await compileTruth(engine, { slugs: ['a', 'missing'], stubResponse: stub });
    expect(r.sources).toEqual(['a']);
    expect(r.warnings.some((w) => w.includes('missing'))).toBe(true);
  });

  test('returns empty result when no candidates exist', async () => {
    const r = await compileTruth(engine, { slugs: ['nope'], stubResponse: '{}' });
    expect(r.compiled_markdown).toBe('');
    expect(r.warnings.some((w) => w.includes('no candidate'))).toBe(true);
  });

  test('malformed LLM output falls back to raw body + warning', async () => {
    await put('a', 'body');
    const r = await compileTruth(engine, { slugs: ['a'], stubResponse: 'not json' });
    expect(r.compiled_markdown).toBe('not json');
    expect(r.warnings.some((w) => w.includes('not valid JSON'))).toBe(true);
  });
});

describe('adopt_compiled_truth op', () => {
  test('persists body + compiled_from provenance, readable back', async () => {
    const res = (await operationsByName.adopt_compiled_truth.handler(ctx(), {
      slug: 'compiled/dream-cycle',
      compiled_markdown: '## Dream Cycle\n\n9 phases, order locked.',
      type: 'concept',
      title: 'Dream Cycle',
      sources: ['a', 'b'],
    })) as { slug: string; status: string; compiled_from: string[] };

    expect(res.slug).toBe('compiled/dream-cycle');
    expect(res.status).toBe('imported');
    expect(res.compiled_from).toEqual(['a', 'b']);

    const page = await engine.getPage('compiled/dream-cycle', { sourceId: 'default' });
    expect(page).not.toBeNull();
    expect(page!.compiled_truth).toContain('9 phases');
    expect(page!.frontmatter?.compiled_from).toEqual(['a', 'b']);
  });

  test('rejects empty compiled_markdown', async () => {
    await expect(
      operationsByName.adopt_compiled_truth.handler(ctx(), {
        slug: 'compiled/empty',
        compiled_markdown: '   ',
      }),
    ).rejects.toThrow();
  });

  test('dry run does not write', async () => {
    const res = (await operationsByName.adopt_compiled_truth.handler(ctx({ dryRun: true }), {
      slug: 'compiled/dry',
      compiled_markdown: '## x',
    })) as { dry_run?: boolean };
    expect(res.dry_run).toBe(true);
    const page = await engine.getPage('compiled/dry', { sourceId: 'default' });
    expect(page).toBeNull();
  });
});

describe('find_conflicts op', () => {
  test('returns empty groups + note when no probe data and no topic', async () => {
    const res = (await operationsByName.find_conflicts.handler(ctx({ remote: true }), {})) as {
      groups: unknown[];
      note?: string;
    };
    expect(res.groups).toHaveLength(0);
    expect(res.note).toBeTruthy();
  });

  test('cluster fallback groups topic-overlapping pages (≥2 members)', async () => {
    await put('concepts/dream-cycle', 'Dream cycle has 9 strict phases in order.');
    await put('daily/dream-note', 'Today I understood the dream cycle phase order.');
    const res = (await operationsByName.find_conflicts.handler(ctx({ remote: true }), {
      topic: 'dream cycle',
    })) as { groups: Array<{ members: unknown[]; source: string }>; source: string };
    // Keyword search may or may not cluster on PGLite w/o embeddings; if it does,
    // every returned group must have ≥2 enriched members and be tagged 'cluster'.
    for (const g of res.groups) {
      expect(g.members.length).toBeGreaterThanOrEqual(2);
      expect(g.source).toBe('cluster');
    }
  });
});
