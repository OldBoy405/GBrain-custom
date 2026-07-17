/**
 * Conflict grouping for the `find_conflicts` op (真理编译工作台).
 *
 * Two data sources feed the op (see operations.ts `find_conflicts`):
 *   1. Precomputed contradiction-probe findings (`eval_contradictions_runs`),
 *      each a slug↔slug pair on some `axis`. `groupConflicts` folds overlapping
 *      pairs into connected components — a "conflict group" is a cluster of
 *      pages that transitively contradict each other on a topic.
 *   2. Live `hybridSearch` clustering (fallback when no probe has run) — that
 *      lives in the op handler; this module only owns the deterministic,
 *      pure, unit-testable grouping of probe pairs.
 *
 * Kept engine-free and side-effect-free so `test/conflicts.test.ts` runs
 * without a DB.
 */

export type ConflictSeverity = 'low' | 'medium' | 'high';

/** One probe finding: a contradicting pair on an axis. Loose — extra fields ignored. */
export interface RawConflictFinding {
  a: { slug: string };
  b: { slug: string };
  axis?: string;
  severity?: ConflictSeverity;
}

/** A grouped topic cluster of mutually-conflicting slugs (pre-enrichment). */
export interface ConflictGroupCore {
  /** Stable id derived from the group's sorted member slugs. */
  id: string;
  /** Human topic label — most common axis, else the first member's slug tail. */
  topic: string;
  /** Distinct member slugs, sorted for determinism. */
  slugs: string[];
  /** Highest severity seen among the group's findings (probe source only). */
  severity: ConflictSeverity | null;
  source: 'probe' | 'cluster';
}

const SEVERITY_RANK: Record<ConflictSeverity, number> = { low: 1, medium: 2, high: 3 };

function slugTail(slug: string): string {
  const parts = slug.split('/');
  return parts[parts.length - 1] || slug;
}

/**
 * Fold slug↔slug contradiction pairs into connected components (union-find).
 * Each component with ≥2 members becomes one conflict group. Deterministic:
 * members and groups are sorted; id is derived from the sorted member set.
 */
export function groupConflicts(findings: RawConflictFinding[]): ConflictGroupCore[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression.
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const ensure = (x: string) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  const union = (a: string, b: string) => {
    ensure(a);
    ensure(b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Two passes so the per-component tallies key off the FINAL root: pass 1
  // unions every pair (roots settle), pass 2 tallies axis/severity against the
  // now-stable root. Tallying inside pass 1 would key off the insert-time root,
  // which later unions move — forcing a re-resolve on read.
  const valid = findings.filter((f) => f.a?.slug && f.b?.slug && f.a.slug !== f.b.slug);
  for (const f of valid) union(f.a.slug, f.b.slug);

  const axisCount = new Map<string, Map<string, number>>();
  const sevMax = new Map<string, ConflictSeverity | null>();
  for (const f of valid) {
    const root = find(f.a.slug);
    // Tally axis frequency.
    if (f.axis) {
      const m = axisCount.get(root) ?? new Map<string, number>();
      m.set(f.axis, (m.get(f.axis) ?? 0) + 1);
      axisCount.set(root, m);
    }
    // Track max severity.
    if (f.severity) {
      const prev = sevMax.get(root) ?? null;
      if (!prev || SEVERITY_RANK[f.severity] > SEVERITY_RANK[prev]) {
        sevMax.set(root, f.severity);
      }
    }
  }

  // Collect components.
  const components = new Map<string, Set<string>>();
  for (const node of parent.keys()) {
    const root = find(node);
    const set = components.get(root) ?? new Set<string>();
    set.add(node);
    components.set(root, set);
  }

  const groups: ConflictGroupCore[] = [];
  for (const [root, members] of components) {
    if (members.size < 2) continue;
    const slugs = [...members].sort();
    // Topic = most frequent axis across this component; else first member's tail.
    let topic = slugTail(slugs[0]);
    const axes = axisCount.get(root);
    if (axes && axes.size > 0) {
      topic = [...axes.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0];
    }
    const severity = sevMax.get(root) ?? null;
    groups.push({
      id: `probe:${slugs.join('|')}`,
      topic,
      slugs,
      severity,
      source: 'probe',
    });
  }
  // Deterministic order: high severity first, then more members, then id.
  groups.sort(
    (a, b) =>
      (b.severity ? SEVERITY_RANK[b.severity] : 0) - (a.severity ? SEVERITY_RANK[a.severity] : 0) ||
      b.slugs.length - a.slugs.length ||
      a.id.localeCompare(b.id),
  );
  return groups;
}
