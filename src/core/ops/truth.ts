/**
 * Compiled Truth workbench ops — custom fork (find_conflicts / compile_truth /
 * adopt_compiled_truth). Never import from '../operations.ts' here (cycle).
 */

import matter from 'gray-matter';
import { groupConflicts, type ConflictGroupCore } from '../conflicts.ts';
import { compileTruth } from '../compile-truth.ts';
import { importFromContent } from '../import-file.ts';
import { hybridSearch } from '../search/hybrid.ts';
import { OperationError } from './contract.ts';
import type { Operation } from './contract.ts';
import { sourceScopeOpts } from './context.ts';

interface ConflictMemberOut {
  slug: string;
  title: string;
  type: string;
  updated_at: string;
  excerpt: string;
}

interface ConflictGroupOut {
  id: string;
  topic: string;
  source: 'probe' | 'cluster';
  severity: 'low' | 'medium' | 'high' | null;
  members: ConflictMemberOut[];
}

const find_conflicts: Operation = {
  name: 'find_conflicts',
  description:
    'Detect groups of conflicting/overlapping markdown pages on a topic, for the Compiled Truth workbench. Hybrid source: prefers precomputed contradiction-probe pairs (eval_contradictions_runs), falls back to live hybridSearch clustering when a topic is supplied and no probe has run. Read-only.',
  scope: 'read',
  params: {
    topic: {
      type: 'string',
      description: 'Optional topic filter (probe) / seed query (cluster fallback). Substring match on group topic or member slug.',
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'Optional severity filter (probe groups only).',
    },
    limit: { type: 'number', description: 'Max conflict groups to return. Default 5, max 50.' },
  },
  handler: async (ctx, p) => {
    const limit = typeof p.limit === 'number' && p.limit > 0 ? Math.min(p.limit, 50) : 5;
    const topic = typeof p.topic === 'string' ? p.topic.trim() : '';
    const sevFilter =
      p.severity === 'low' || p.severity === 'medium' || p.severity === 'high' ? p.severity : null;
    const scope = sourceScopeOpts(ctx);

    let groups: ConflictGroupCore[] = [];
    let source: 'probe' | 'cluster' = 'probe';

    const rows = await ctx.engine.loadContradictionsTrend(30);
    if (rows.length > 0) {
      const report = rows[0].report_json as Record<string, unknown> | null;
      const perQuery =
        (report?.per_query as Array<{
          contradictions: Array<{
            axis: string;
            severity: 'low' | 'medium' | 'high';
            a: { slug: string };
            b: { slug: string };
          }>;
        }> | undefined) ?? [];
      const findings = perQuery.flatMap((q) => q.contradictions).map((f) => ({
        a: { slug: f.a.slug },
        b: { slug: f.b.slug },
        axis: f.axis,
        severity: f.severity,
      }));
      groups = groupConflicts(findings);
      if (sevFilter) groups = groups.filter((g) => g.severity === sevFilter);
      if (topic) {
        const t = topic.toLowerCase();
        groups = groups.filter(
          (g) => g.topic.toLowerCase().includes(t) || g.slugs.some((s) => s.toLowerCase().includes(t)),
        );
      }
    }

    if (groups.length === 0 && topic) {
      source = 'cluster';
      const results = await hybridSearch(ctx.engine, topic, { limit: 12, ...scope });
      const seen = new Set<string>();
      const slugs: string[] = [];
      for (const r of results) {
        if (!seen.has(r.slug)) {
          seen.add(r.slug);
          slugs.push(r.slug);
        }
      }
      if (slugs.length >= 2) {
        groups = [{ id: `cluster:${topic}`, topic, slugs, severity: null, source: 'cluster' }];
      }
    }

    const shownGroups = groups.slice(0, limit);
    const allMemberSlugs = shownGroups.flatMap(g => g.slugs);
    const fetchedPages = await Promise.all(allMemberSlugs.map(slug => ctx.engine.getPage(slug, scope)));
    const pageBySlug = new Map(allMemberSlugs.map((slug, i) => [slug, fetchedPages[i]]));

    const out: ConflictGroupOut[] = [];
    for (const g of shownGroups) {
      const members: ConflictMemberOut[] = [];
      for (const slug of g.slugs) {
        const page = pageBySlug.get(slug);
        if (!page) continue;
        members.push({
          slug: page.slug,
          title: page.title,
          type: String(page.type),
          updated_at:
            typeof page.updated_at === 'string'
              ? page.updated_at
              : page.updated_at.toISOString(),
          excerpt: page.compiled_truth.replace(/\s+/g, ' ').trim().slice(0, 180),
        });
      }
      if (members.length >= 2) {
        out.push({ id: g.id, topic: g.topic, source: g.source, severity: g.severity, members });
      }
    }

    return {
      groups: out,
      source,
      ...(out.length === 0
        ? {
            note:
              'No conflict groups. Run `gbrain eval suspected-contradictions` to populate the probe, or pass a `topic` to cluster live.',
          }
        : {}),
    };
  },
  cliHints: { name: 'find-conflicts' },
};

const compile_truth: Operation = {
  name: 'compile_truth',
  description:
    'LLM-merge a set of candidate pages into one authoritative markdown body plus a keep/merge/add/remove diff. Read-only proposal — does NOT persist. Adopt the result with `adopt_compiled_truth`.',
  scope: 'read',
  params: {
    slugs: {
      type: 'array',
      required: true,
      items: { type: 'string' },
      description: 'Candidate page slugs to merge (from a find_conflicts group).',
    },
    topic: { type: 'string', description: 'Optional topic label to steer the merge.' },
    model: { type: 'string', description: 'Model override (alias or full id). Falls through models.think → default → opus.' },
  },
  handler: async (ctx, p) => {
    const slugs = Array.isArray(p.slugs) ? (p.slugs as unknown[]).filter((s): s is string => typeof s === 'string') : [];
    if (slugs.length === 0) {
      throw new OperationError('invalid_params', 'compile_truth requires a non-empty `slugs` array');
    }
    const scope = sourceScopeOpts(ctx);
    return compileTruth(ctx.engine, {
      slugs,
      topic: typeof p.topic === 'string' ? p.topic : undefined,
      model: typeof p.model === 'string' ? p.model : undefined,
      ...(scope.sourceIds !== undefined ? { sourceIds: scope.sourceIds } : {}),
      ...(scope.sourceId !== undefined ? { sourceId: scope.sourceId } : {}),
    });
  },
  cliHints: { name: 'compile-truth', positional: ['slugs'] },
};

const adopt_compiled_truth: Operation = {
  name: 'adopt_compiled_truth',
  description:
    'Persist a compiled-truth body into a page (chunks + re-embeds so the body earns the compiled_truth retrieval boost). Records `compiled_from` provenance in frontmatter. Write op.',
  scope: 'write',
  mutating: true,
  params: {
    slug: { type: 'string', required: true, description: 'Target page slug for the adopted compiled truth.' },
    compiled_markdown: { type: 'string', required: true, description: 'The merged markdown body (no frontmatter).' },
    type: { type: 'string', description: 'Page type for frontmatter (default: inferred from slug).' },
    title: { type: 'string', description: 'Page title for frontmatter (default: derived from slug tail).' },
    sources: {
      type: 'array',
      items: { type: 'string' },
      description: 'Candidate slugs this was compiled from (audit provenance → frontmatter.compiled_from).',
    },
  },
  handler: async (ctx, p) => {
    const slug = p.slug as string;
    const body = p.compiled_markdown as string;
    if (!slug || typeof body !== 'string' || !body.trim()) {
      throw new OperationError('invalid_params', 'adopt_compiled_truth requires `slug` and non-empty `compiled_markdown`');
    }
    if (ctx.dryRun) return { dry_run: true, action: 'adopt_compiled_truth', slug };

    const sources = Array.isArray(p.sources)
      ? (p.sources as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const fm: Record<string, unknown> = {};
    if (typeof p.type === 'string' && p.type) fm.type = p.type;
    if (typeof p.title === 'string' && p.title) fm.title = p.title;
    if (sources.length > 0) fm.compiled_from = sources;
    const content = matter.stringify(body.trim() + '\n', fm);

    const { isAvailable } = await import('../ai/gateway.ts');
    const noEmbed = !isAvailable('embedding');
    const result = await importFromContent(ctx.engine, slug, content, {
      noEmbed,
      remote: ctx.remote !== false,
      ...(ctx.sourceId ? { sourceId: ctx.sourceId } : {}),
      source_kind: ctx.remote === false ? 'compile-truth' : 'mcp:adopt_compiled_truth',
      source_uri: null,
      ingested_via: ctx.remote === false ? 'adopt_compiled_truth' : 'mcp:adopt_compiled_truth',
    });

    return {
      slug: result.slug,
      status: result.status,
      compiled_from: sources,
    };
  },
  cliHints: { name: 'adopt-compiled-truth', positional: ['slug'], stdin: 'compiled_markdown' },
};

export const truthOperations: Operation[] = [
  find_conflicts, compile_truth, adopt_compiled_truth,
];
