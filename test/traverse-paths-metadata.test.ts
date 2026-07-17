/**
 * traversePaths metadata + frontier-cap regression (v0.43 Graph-page wave).
 *
 * traversePaths powers the admin Graph page's FILTERED mode (link_type /
 * direction set). Two additive guarantees this test pins:
 *   1. Each edge carries `to_title` / `to_type` for its `to_slug` in all three
 *      directions, so the UI can color path-mode nodes by type instead of the
 *      `unknown` fallback.
 *   2. `frontierCap` bounds per-iteration fanout (hub-fanout DB-work guard), and
 *      is a no-op when unset (back-compat).
 *
 * Runs against PGLite (unit, always). The postgres-engine path uses the same
 * SQL shape; the DATABASE_URL-gated engine-parity e2e covers Postgres.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';

let engine: PGLiteEngine;

async function linkBySlug(fromSlug: string, toSlug: string, linkType: string) {
  const f = await (engine as any).db.query(`SELECT id FROM pages WHERE slug = $1`, [fromSlug]);
  const t = await (engine as any).db.query(`SELECT id FROM pages WHERE slug = $1`, [toSlug]);
  await (engine as any).db.query(
    `INSERT INTO links (from_page_id, to_page_id, link_type, origin_page_id, link_source)
     VALUES ($1, $2, $3, $1, 'markdown')`,
    [f.rows[0].id, t.rows[0].id, linkType],
  );
}

beforeAll(async () => {
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
});

afterAll(async () => {
  await engine.disconnect();
});

beforeEach(async () => {
  for (const t of ['links', 'pages']) {
    await (engine as any).db.exec(`DELETE FROM ${t}`);
  }
});

describe('traversePaths — to_title / to_type metadata', () => {
  test('out direction carries to_slug title + type on every edge', async () => {
    await engine.putPage('people/alice', { type: 'person', title: 'Alice', compiled_truth: '', frontmatter: {} });
    await engine.putPage('companies/acme', { type: 'company', title: 'Acme Inc', compiled_truth: '', frontmatter: {} });
    await linkBySlug('people/alice', 'companies/acme', 'invested_in');

    const paths = await engine.traversePaths('people/alice', { direction: 'out', depth: 2 });
    const edge = paths.find((p) => p.to_slug === 'companies/acme');
    expect(edge).toBeDefined();
    expect(edge!.to_title).toBe('Acme Inc');
    expect(edge!.to_type).toBe('company');
  });

  test('in direction carries the pointed-at node title + type', async () => {
    await engine.putPage('people/alice', { type: 'person', title: 'Alice', compiled_truth: '', frontmatter: {} });
    await engine.putPage('companies/acme', { type: 'company', title: 'Acme Inc', compiled_truth: '', frontmatter: {} });
    // alice -> acme; walking 'in' from acme reaches alice via the incoming edge.
    await linkBySlug('people/alice', 'companies/acme', 'invested_in');

    const paths = await engine.traversePaths('companies/acme', { direction: 'in', depth: 2 });
    // 'in' preserves the edge's natural from->to; to_slug is the walk node (acme).
    const edge = paths[0];
    expect(edge).toBeDefined();
    expect(edge.to_title).toBe('Acme Inc');
    expect(edge.to_type).toBe('company');
  });

  test('both direction carries to_slug title + type', async () => {
    await engine.putPage('people/alice', { type: 'person', title: 'Alice', compiled_truth: '', frontmatter: {} });
    await engine.putPage('companies/acme', { type: 'company', title: 'Acme Inc', compiled_truth: '', frontmatter: {} });
    await linkBySlug('people/alice', 'companies/acme', 'invested_in');

    const paths = await engine.traversePaths('people/alice', { direction: 'both', depth: 2 });
    const edge = paths.find((p) => p.to_slug === 'companies/acme');
    expect(edge).toBeDefined();
    expect(edge!.to_title).toBe('Acme Inc');
    expect(edge!.to_type).toBe('company');
  });
});

describe('traversePaths — frontierCap', () => {
  test('bounds recursive-walk breadth; fewer deep edges when capped', async () => {
    // hub -> m0..m4 (depth 1); each mi -> di (depth 2).
    await engine.putPage('hub', { type: 'concept', title: 'Hub', compiled_truth: '', frontmatter: {} });
    for (let i = 0; i < 5; i++) {
      const mid = `mid/${i}`;
      const deep = `deep/${i}`;
      await engine.putPage(mid, { type: 'note', title: `Mid ${i}`, compiled_truth: '', frontmatter: {} });
      await engine.putPage(deep, { type: 'note', title: `Deep ${i}`, compiled_truth: '', frontmatter: {} });
      await linkBySlug('hub', mid, 'refs');
      await linkBySlug(mid, deep, 'refs');
    }

    // Uncapped depth-2: 5 hub->mid + 5 mid->deep = 10 edges.
    const uncapped = await engine.traversePaths('hub', { direction: 'out', depth: 2 });
    expect(uncapped.length).toBe(10);

    // frontierCap=2 caps the recursive term: only 2 mids get walked, so only
    // their deep edges surface. Seed's own 5 direct edges still emit (final
    // projection from the seed is uncapped — node_limit is the payload guard),
    // but total is strictly fewer than uncapped because deep edges are bounded.
    const capped = await engine.traversePaths('hub', { direction: 'out', depth: 2, frontierCap: 2 });
    expect(capped.length).toBeLessThan(uncapped.length);
    expect(capped.length).toBeGreaterThan(0);
    // Deep edges (depth 2) are bounded by the cap.
    const deepEdges = capped.filter((p) => p.depth === 2);
    expect(deepEdges.length).toBeLessThanOrEqual(2);
  });
});
