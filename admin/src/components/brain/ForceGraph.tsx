import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphNode } from '../../lib/op-types';
import { buildGraph, colorVarFor, edgeColorVarFor, type SimNode } from './graph-model';

/**
 * 知识网络 canvas 渲染器（react-force-graph-2d）。
 *
 * 相较旧 SVG 版：自带缩放/平移/悬停，可撑更大规模。新增：
 * - 三个力参数（charge/linkDistance/centering）实时可调；
 * - 悬停节点 → 邻居高亮，其余 dim 到 0.18；命中边高亮。
 * canvas 无法解析 CSS 变量，故用 getComputedStyle 把 token 名解析为具体色值（带缓存）。
 */

type Force = { strength?: (v: number) => unknown; distance?: (v: number) => unknown } | undefined;
type FgHandle = {
  d3Force: (name: string) => Force;
  d3ReheatSimulation: () => void;
};
type FgNode = SimNode & { x?: number; y?: number };
type FgLink = { source: string | FgNode; target: string | FgNode; link_type: string };

const idOf = (e: string | FgNode): string => (typeof e === 'string' ? e : e.slug);

export function ForceGraph({
  data,
  rootSlug,
  selected,
  onSelect,
  charge,
  linkDistance,
  centering,
  height = 560,
}: {
  data: GraphNode[];
  rootSlug: string;
  selected?: string;
  onSelect: (slug: string) => void;
  charge: number;
  linkDistance: number;
  centering: number;
  height?: number;
}) {
  const graphData = useMemo(() => buildGraph(data), [data]);

  // 邻接表从原始 data 计算（不依赖 d3 变异后的 link 对象）。
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const n of data) {
      for (const l of n.links ?? []) {
        add(n.slug, l.to_slug);
        add(l.to_slug, n.slug);
      }
    }
    return m;
  }, [data]);

  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  const fgRef = useRef<FgHandle | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);

  // CSS 变量名 → 具体色值缓存（token 静态，解析一次即可）。
  const colorCache = useRef<Map<string, string>>(new Map());
  const resolve = (varName: string): string => {
    const cache = colorCache.current;
    let v = cache.get(varName);
    if (v === undefined) {
      v =
        (typeof document !== 'undefined'
          ? getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
          : '') || '#8b8a80';
      cache.set(varName, v);
    }
    return v;
  };

  // 容器测宽：优先 ResizeObserver（侧栏折叠/布局变化即 reflow，不依赖窗口 resize）；
  // 无 ResizeObserver 的环境（如 jsdom）回退到 window.resize。
  useEffect(() => {
    const el = wrapRef.current;
    const measure = () => {
      if (wrapRef.current) setWidth(wrapRef.current.clientWidth);
    };
    measure();
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 力参数变化 → 重配并重热模拟。
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength?.(charge);
    fg.d3Force('link')?.distance?.(linkDistance);
    fg.d3Force('center')?.strength?.(centering);
    fg.d3ReheatSimulation();
  }, [charge, linkDistance, centering, graphData]);

  const hairline = resolve('--color-hairline');
  const accent = resolve('--color-accent');
  const inkSoft = resolve('--color-ink-soft');
  const ink = resolve('--color-ink');
  const inverse = resolve('--color-inverse');

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl border border-hairline bg-surface" style={{ height }}>
      <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-brain-2sm text-ink-soft">
        {graphData.nodes.length} 节点 · {graphData.links.length} 边
      </div>
      <ForceGraph2D
        ref={fgRef as never}
        width={width}
        height={height}
        graphData={graphData as never}
        nodeId="slug"
        backgroundColor="rgba(0,0,0,0)"
        nodeLabel={(n: unknown) => (n as FgNode).title}
        cooldownTicks={120}
        onNodeClick={(n: unknown) => onSelect((n as FgNode).slug)}
        onNodeHover={(n: unknown) => setHoverSlug(n ? (n as FgNode).slug : null)}
        linkColor={(l: unknown) => {
          const link = l as FgLink;
          // 悬停时命中边高亮为 accent；有悬停但未命中则淡到近乎隐形，聚焦邻域。
          if (hoverSlug) {
            return idOf(link.source) === hoverSlug || idOf(link.target) === hoverSlug ? accent : hairline;
          }
          // 无悬停：按 link_type 着色，让边的语义（invested_in 等）可见。
          return resolve(edgeColorVarFor(link.link_type));
        }}
        linkWidth={(l: unknown) => {
          const link = l as FgLink;
          return hoverSlug && (idOf(link.source) === hoverSlug || idOf(link.target) === hoverSlug) ? 1.5 : 1;
        }}
        nodePointerAreaPaint={(n: unknown, color: string, ctx: CanvasRenderingContext2D) => {
          const node = n as FgNode;
          const r = node.slug === rootSlug ? 7 : 5;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r + 2, 0, 2 * Math.PI);
          ctx.fill();
        }}
        nodeCanvasObject={(n: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const node = n as FgNode;
          const isRoot = node.slug === rootSlug;
          const isSel = node.slug === selected;
          const dimmed = hoverSlug && node.slug !== hoverSlug && !adjacency.get(hoverSlug)?.has(node.slug);
          const r = isRoot ? 7 : 5;
          const x = node.x ?? 0;
          const y = node.y ?? 0;

          ctx.globalAlpha = dimmed ? 0.18 : 1;

          // 节点圆点 + 描边（选中用墨色环，否则纸白细环）。
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 2 * Math.PI);
          ctx.fillStyle = resolve(colorVarFor(node.type, isRoot));
          ctx.fill();
          ctx.lineWidth = isSel ? 2 / globalScale : 1.5 / globalScale;
          ctx.strokeStyle = isSel ? ink : inverse;
          ctx.stroke();

          // 标签：缩得够近或为根/选中/高亮邻居时才画，避免拥挤。
          const showLabel = globalScale >= 0.6 || isRoot || isSel || (!!hoverSlug && !dimmed);
          if (showLabel) {
            const label = node.title.length > 22 ? `${node.title.slice(0, 22)}…` : node.title;
            const fontSize = 11 / globalScale;
            ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = inkSoft;
            ctx.fillText(label, x + r + 3 / globalScale, y);
          }
          ctx.globalAlpha = 1;
        }}
      />
    </div>
  );
}
