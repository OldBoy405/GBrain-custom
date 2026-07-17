/**
 * Client-side traversal cache. Pure frontend; avoids re-hitting `traverse_graph`
 * (recursive CTE is not cheap) for the same (slug, depth, linkType, direction).
 * Returning to a prior root, or toggling depth/direction back and forth, is
 * instant. Unrelated to the backend query_cache (search-only).
 *
 * LRU: Map insertion order is recency; a hit deletes-then-reinserts to move the
 * key to the tail; over capacity evicts the oldest. The cached value is the
 * already-transformed render state (GraphNode[] + pathsMode), so a hit in
 * load() can setState directly.
 */

import type { GraphNode } from './op-types';

export interface GraphCacheEntry {
  data: GraphNode[];
  /** Filtered mode (link_type/direction → GraphPath[] run through pathsToNodes). */
  pathsMode: boolean;
}

const MAX_ENTRIES = 20;
const DELIM = '|';
const store = new Map<string, GraphCacheEntry>();

/** Canonical cache key. Trims linkType so equivalent queries share one entry. */
export function graphCacheKey(
  slug: string,
  depth: number,
  linkType: string,
  direction: string,
): string {
  return [slug, String(depth), linkType.trim(), direction].join(DELIM);
}

export function getCachedGraph(key: string): GraphCacheEntry | undefined {
  const hit = store.get(key);
  if (hit === undefined) return undefined;
  // LRU touch: move to tail.
  store.delete(key);
  store.set(key, hit);
  return hit;
}

export function setCachedGraph(key: string, entry: GraphCacheEntry): void {
  if (store.has(key)) store.delete(key);
  store.set(key, entry);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** For tests and a future "force refresh" control. */
export function clearGraphCache(): void {
  store.clear();
}
