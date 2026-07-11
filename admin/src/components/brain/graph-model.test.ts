import { describe, it, expect } from 'vitest';
import { buildGraph, colorVarFor, pathsToNodes } from './graph-model';
import type { GraphNode, GraphPath } from '../../lib/op-types';

describe('buildGraph', () => {
  it('为被引用但未展开的目标补建叶子节点', () => {
    const data: GraphNode[] = [
      { slug: 'a', title: 'A', type: 'concept', depth: 0, links: [{ to_slug: 'b', link_type: 'refs' }] },
    ];
    const { nodes, links } = buildGraph(data);
    expect(nodes.map((n) => n.slug).sort()).toEqual(['a', 'b']);
    expect(links).toHaveLength(1);
    const b = nodes.find((n) => n.slug === 'b')!;
    expect(b.depth).toBe(1); // source.depth + 1
    expect(b.type).toBe('unknown');
  });

  it('已展开节点不被叶子覆盖，边数等于总链接数', () => {
    const data: GraphNode[] = [
      { slug: 'a', title: 'A', type: 'concept', depth: 0, links: [{ to_slug: 'b', link_type: 'refs' }] },
      { slug: 'b', title: 'B', type: 'daily', depth: 1, links: [{ to_slug: 'a', link_type: 'refs' }] },
    ];
    const { nodes, links } = buildGraph(data);
    expect(nodes).toHaveLength(2);
    expect(links).toHaveLength(2);
    expect(nodes.find((n) => n.slug === 'b')!.type).toBe('daily');
  });

  it('无链接时仅有根节点、无边', () => {
    const data: GraphNode[] = [{ slug: 'solo', title: 'Solo', type: 'concept', depth: 0, links: [] }];
    const { nodes, links } = buildGraph(data);
    expect(nodes).toHaveLength(1);
    expect(links).toHaveLength(0);
  });
});

describe('colorVarFor', () => {
  it('根节点恒为 accent', () => {
    expect(colorVarFor('concept', true)).toBe('--color-accent');
  });
  it('已知类型映射到对应 token', () => {
    expect(colorVarFor('concept', false)).toBe('--color-node-synthesis');
    expect(colorVarFor('person', false)).toBe('--color-accent');
    expect(colorVarFor('company', false)).toBe('--color-coral');
    expect(colorVarFor('source', false)).toBe('--color-node-source');
    expect(colorVarFor('media', false)).toBe('--color-node-recent');
  });
  it('未知类型兜底 entity', () => {
    expect(colorVarFor('paper', false)).toBe('--color-node-entity');
    expect(colorVarFor('unknown', false)).toBe('--color-node-entity');
  });
});

describe('pathsToNodes', () => {
  it('按 from_slug 分组建 links，根节点depth为0', () => {
    const paths: GraphPath[] = [
      { from_slug: 'root', to_slug: 'b', link_type: 'invested_in', context: '', depth: 1 },
      { from_slug: 'root', to_slug: 'c', link_type: 'invested_in', context: '', depth: 1 },
    ];
    const nodes = pathsToNodes(paths, 'root');
    expect(nodes.map((n) => n.slug).sort()).toEqual(['b', 'c', 'root']);
    const root = nodes.find((n) => n.slug === 'root')!;
    expect(root.depth).toBe(0);
    expect(root.links).toEqual([
      { to_slug: 'b', link_type: 'invested_in' },
      { to_slug: 'c', link_type: 'invested_in' },
    ]);
  });

  it('非根节点 title 兜底 slug、type 兜底 unknown', () => {
    const paths: GraphPath[] = [{ from_slug: 'root', to_slug: 'b', link_type: 'refs', context: '', depth: 1 }];
    const nodes = pathsToNodes(paths, 'root');
    const b = nodes.find((n) => n.slug === 'b')!;
    expect(b.title).toBe('b');
    expect(b.type).toBe('unknown');
    expect(b.depth).toBe(1);
  });

  it('多跳链路：中间节点既是 to 也是 from', () => {
    const paths: GraphPath[] = [
      { from_slug: 'root', to_slug: 'b', link_type: 'refs', context: '', depth: 1 },
      { from_slug: 'b', to_slug: 'c', link_type: 'refs', context: '', depth: 2 },
    ];
    const nodes = pathsToNodes(paths, 'root');
    expect(nodes).toHaveLength(3);
    const b = nodes.find((n) => n.slug === 'b')!;
    expect(b.links).toEqual([{ to_slug: 'c', link_type: 'refs' }]);
  });

  it('无边时只有根节点', () => {
    const nodes = pathsToNodes([], 'solo');
    expect(nodes).toEqual([{ slug: 'solo', title: 'solo', type: 'unknown', depth: 0, links: [] }]);
  });
});
