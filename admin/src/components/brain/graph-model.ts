/**
 * 知识网络图的纯数据模型 —— 与渲染器解耦，便于单测（无 canvas/DOM 依赖）。
 *
 * 提供：GraphNode[] → 力导向所需的 node/link 集合、以及类型→颜色 token 的映射。
 * 颜色以 CSS 自定义属性名（如 '--color-node-synthesis'）返回：
 * - HTML 消费方直接 `var(<name>)`；
 * - canvas 消费方用 getComputedStyle 解析为具体色值（见 ForceGraph.tsx）。
 */

import type { GraphNode, GraphPath } from '../../lib/op-types';

export interface SimNode {
  slug: string;
  title: string;
  type: string;
  depth: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  link_type: string;
}

/**
 * 类型 → 颜色 token 名。尽量复用现有语义 token，不新增调色板：
 *   concept  → synthesis(紫)   person   → accent(teal)
 *   company  → coral           source   → source(苔绿)
 *   media/daily → recent(琥珀)  writing/analysis → ink-soft
 *   其余     → entity(棕)
 * 真实页面类型见 gbrain-base-v2 包（无 paper/skill 类型，故不照抄案例图例）。
 */
const TYPE_COLOR: Record<string, string> = {
  concept: '--color-node-synthesis',
  concepts: '--color-node-synthesis',
  person: '--color-accent',
  company: '--color-coral',
  deal: '--color-coral',
  source: '--color-node-source',
  media: '--color-node-recent',
  daily: '--color-node-recent',
  event: '--color-node-recent',
  writing: '--color-ink-soft',
  analysis: '--color-ink-soft',
  note: '--color-ink-soft',
  entity: '--color-node-entity',
};

/** 返回类型对应的 CSS 变量名；根节点恒为 accent。未知类型兜底 entity。 */
export function colorVarFor(type: string, isRoot: boolean): string {
  if (isRoot) return '--color-accent';
  return TYPE_COLOR[type] ?? '--color-node-entity';
}

/**
 * 边（link_type）→ 颜色 token 名。link_type 是开放集（invested_in/works_at/
 * founded/refs…），无法逐个硬编码，故用确定性哈希落到一组现有语义 token 上——
 * 同一 link_type 恒得同色，无需新增调色板。空类型回退到 hairline（细灰）。
 */
const EDGE_PALETTE = [
  '--color-accent',
  '--color-node-synthesis',
  '--color-coral',
  '--color-node-source',
  '--color-node-recent',
  '--color-node-entity',
  '--color-ink-soft',
];

export function edgeColorVarFor(linkType: string): string {
  if (!linkType) return '--color-hairline';
  let h = 0;
  for (let i = 0; i < linkType.length; i++) h = (h * 31 + linkType.charCodeAt(i)) >>> 0;
  return EDGE_PALETTE[h % EDGE_PALETTE.length];
}

/** 已知类型集合（供图例只渲染有配色的类型，其余归入「其他」）。 */
export const KNOWN_TYPES = Object.keys(TYPE_COLOR).filter((t) => t !== 'concepts');

/** 从 GraphNode[] 构建力导向所需的 node/link 集合（含被引用但未展开的叶子节点）。 */
export function buildGraph(data: GraphNode[]): { nodes: SimNode[]; links: SimLink[] } {
  const byId = new Map<string, SimNode>();
  for (const n of data) {
    byId.set(n.slug, { slug: n.slug, title: n.title, type: n.type, depth: n.depth });
  }
  const links: SimLink[] = [];
  for (const n of data) {
    for (const l of n.links ?? []) {
      if (!byId.has(l.to_slug)) {
        byId.set(l.to_slug, { slug: l.to_slug, title: l.to_slug, type: 'unknown', depth: n.depth + 1 });
      }
      links.push({ source: n.slug, target: l.to_slug, link_type: l.link_type });
    }
  }
  return { nodes: [...byId.values()], links };
}

/**
 * 把 `traverse_graph` 在 link_type/direction 过滤模式下返回的 GraphPath[] 规整成
 * buildGraph 能消费的 GraphNode[] 形状，好让 ForceGraph/Drawer 不用为两种响应
 * 形状各写一套渲染逻辑。
 *
 * GraphPath 携带 to_slug 的 title/type（后端 v0.43+ 补齐），据此给非根节点着色。
 * 兜底：根节点（渲染恒为 accent）与从未作为某条边 to_slug 出现的 from 节点，
 * title 兜底为 slug、type 兜底为 'unknown'（entity 兜底色）。旧后端不带
 * to_title/to_type 时整体回退到旧行为。
 */
export function pathsToNodes(paths: GraphPath[], rootSlug: string): GraphNode[] {
  const bySlug = new Map<string, GraphNode>();
  const ensure = (slug: string, depth: number, title?: string, type?: string): GraphNode => {
    const existing = bySlug.get(slug);
    if (existing) {
      // 已存在但此前是兜底占位：一旦拿到真实 title/type 就补上。
      if (title && existing.title === existing.slug) existing.title = title;
      if (type && existing.type === 'unknown') existing.type = type;
      return existing;
    }
    const node: GraphNode = { slug, title: title || slug, type: type || 'unknown', depth, links: [] };
    bySlug.set(slug, node);
    return node;
  };
  ensure(rootSlug, 0);
  for (const p of paths) {
    const from = ensure(p.from_slug, p.depth - 1);
    ensure(p.to_slug, p.depth, p.to_title, p.to_type);
    from.links.push({ to_slug: p.to_slug, link_type: p.link_type });
  }
  return [...bySlug.values()];
}
