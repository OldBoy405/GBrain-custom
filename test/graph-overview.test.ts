/**
 * graphOverview regression (v0.43 Graph-page "no root → whole graph" default).
 *
 * graphOverview returns the highest-degree pages plus edges among them, as
 * GraphNode[] (same shape as traverseGraph). This test pins:
 *   1. Nodes are degree-ranked and bounded by nodeLimit.
 *   2. Only edges whose BOTH endpoints are in the returned node set appear
 *      (self-contained backbone).
 *   3. Soft-deleted pages are excluded.
 *
 * Runs against PGLite (unit, always). The postgres-engine path uses the same
 * SQL shape; the DATABASE_URL-gated engine-parity e2e covers Postgres.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';

let engine: PGLiteEngine;

async function link(fromSlug: string, toSlug: string, linkType: string) {
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

describe('graphOverview', () => {
  test('returns nodes + edges among them; empty brain → []', async () => {
    expect(await engine.graphOverview()).toEqual([]);

    await engine.putPage('hub', { type: 'concept', title: 'Hub', compiled_truth: '', frontmatter: {} });
    await engine.putPage('a', { type: 'person', title: 'A', compiled_truth: '', frontmatter: {} });
    await engine.putPage('b', { type: 'company', title: 'B', compiled_truth: '', frontmatter: {} });
    await engine.putPage('c', { type: 'note', title: 'C', compiled_truth: '', frontmatter: {} });
    await link('hub', 'a', 'refs');
    await link('hub', 'b', 'refs');
    await link('hub', 'c', 'refs');
    await link('a', 'b', 'works_at');

    const nodes = await engine.graphOverview();
    expect(nodes.map((n) => n.slug).sort()).toEqual(['a', 'b', 'c', 'hub']);
    // hub has highest degree (3) → ranked first (deg DESC, slug ASC).
    expect(nodes[0].slug).toBe('hub');
    // Every node depth is 0 (root-less).
    expect(nodes.every((n) => n.depth === 0)).toBe(true);
    // hub's edges point to a, b, c.
    const hub = nodes.find((n) => n.slug === 'hub')!;
    expect(hub.links.map((l) => l.to_slug).sort()).toEqual(['a', 'b', 'c']);
  });

  test('nodeLimit keeps the highest-degree nodes and drops edges to excluded nodes', async () => {
    // hub (deg 3) -> x,y,z ; x also -> orphan (orphan has deg 1 only via x).
    for (const s of ['hub', 'x', 'y', 'z', 'orphan']) {
      await engine.putPage(s, { type: 'note', title: s, compiled_truth: '', frontmatter: {} });
    }
    await link('hub', 'x', 'refs');
    await link('hub', 'y', 'refs');
    await link('hub', 'z', 'refs');
    await link('x', 'orphan', 'refs');

    // nodeLimit 4 → keep hub(3), x(2), and two of y/z/orphan(1 each, slug-tiebroken).
    const nodes = await engine.graphOverview({ nodeLimit: 4 });
    expect(nodes.length).toBe(4);
    const slugs = new Set(nodes.map((n) => n.slug));
    expect(slugs.has('hub')).toBe(true);
    expect(slugs.has('x')).toBe(true);
    // Edges only among the returned set: x->orphan present iff orphan survived.
    const x = nodes.find((n) => n.slug === 'x')!;
    const orphanIn = slugs.has('orphan');
    expect(x.links.some((l) => l.to_slug === 'orphan')).toBe(orphanIn);
  });

  test('excludes soft-deleted pages', async () => {
    await engine.putPage('keep', { type: 'concept', title: 'Keep', compiled_truth: '', frontmatter: {} });
    await engine.putPage('gone', { type: 'concept', title: 'Gone', compiled_truth: '', frontmatter: {} });
    await link('keep', 'gone', 'refs');
    await (engine as any).db.query(`UPDATE pages SET deleted_at = now() WHERE slug = 'gone'`);

    const nodes = await engine.graphOverview();
    expect(nodes.map((n) => n.slug)).toEqual(['keep']);
    // Edge to the deleted node is dropped (target not in the node set).
    expect(nodes[0].links).toEqual([]);
  });
});
