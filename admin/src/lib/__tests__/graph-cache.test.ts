import { describe, it, expect, beforeEach } from 'vitest';
import { graphCacheKey, getCachedGraph, setCachedGraph, clearGraphCache } from '../graph-cache';
import type { GraphNode } from '../op-types';

const node = (slug: string): GraphNode => ({ slug, title: slug, type: 'concept', depth: 0, links: [] });

beforeEach(() => clearGraphCache());

describe('graph-cache', () => {
  it('规范化键：空 linkType / direction 归一', () => {
    expect(graphCacheKey('a', 2, '', 'out')).toBe('a|2||out');
    expect(graphCacheKey('a', 2, ' invested_in ', 'in')).toBe('a|2|invested_in|in');
  });

  it('miss → set → hit 回填相同引用', () => {
    const key = graphCacheKey('a', 2, '', 'out');
    expect(getCachedGraph(key)).toBeUndefined();
    const entry = { data: [node('a')], pathsMode: false };
    setCachedGraph(key, entry);
    expect(getCachedGraph(key)).toBe(entry);
  });

  it('LRU：超出容量淘汰最旧；命中会刷新为最新', () => {
    // 填满 20 条 + 1 条触发淘汰。
    for (let i = 0; i < 20; i++) {
      setCachedGraph(graphCacheKey(`k${i}`, 1, '', 'out'), { data: [node(`k${i}`)], pathsMode: false });
    }
    // 命中 k0 使其变最新，随后写入新键应淘汰 k1（而非 k0）。
    expect(getCachedGraph(graphCacheKey('k0', 1, '', 'out'))).toBeDefined();
    setCachedGraph(graphCacheKey('k20', 1, '', 'out'), { data: [node('k20')], pathsMode: false });
    expect(getCachedGraph(graphCacheKey('k0', 1, '', 'out'))).toBeDefined();
    expect(getCachedGraph(graphCacheKey('k1', 1, '', 'out'))).toBeUndefined();
    expect(getCachedGraph(graphCacheKey('k20', 1, '', 'out'))).toBeDefined();
  });
});
