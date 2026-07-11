import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { callMcp } from '../../lib/mcp-client';
import type { GraphNode, GraphPath, BrainStats, SchemaStatsResult, PageSummary } from '../../lib/op-types';
import { parseHash } from '../../routes';
import { PageHeader, Drawer, Badge, WhyButton } from '../../components/brain';
import { ForceGraph } from '../../components/brain/ForceGraph';
import { TypedLinkDemo } from '../../components/brain/TypedLinkDemo';
import { colorVarFor, pathsToNodes } from '../../components/brain/graph-model';

type Direction = 'out' | 'in' | 'both';

interface GraphStats {
  nodes: number;
  /** typed-link 总数；schema_stats 降级时为 null（该 op 不含边数）。 */
  links: number | null;
  byType: Array<{ type: string; count: number }>;
}

export function Graph() {
  const [slugInput, setSlugInput] = useState('');
  const [rootSlug, setRootSlug] = useState('');
  const [depth, setDepth] = useState(2);
  const [linkType, setLinkType] = useState('');
  const [direction, setDirection] = useState<Direction>('out');
  const [data, setData] = useState<GraphNode[] | null>(null);
  const [pathsMode, setPathsMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // 力参数（对应三个滑块，实时喂给 ForceGraph）。
  const [charge, setCharge] = useState(-180);
  const [linkDistance, setLinkDistance] = useState(60);
  const [centering, setCentering] = useState(0.05);

  const [stats, setStats] = useState<GraphStats | null>(null);
  const [examplePages, setExamplePages] = useState<PageSummary[] | null>(null);

  const depthRef = useRef(depth);
  depthRef.current = depth;
  const linkTypeRef = useRef(linkType);
  linkTypeRef.current = linkType;
  const directionRef = useRef(direction);
  directionRef.current = direction;

  // 请求序号：两次 load() 快速连发时，先发后至的旧响应不能覆盖新响应已写入的状态。
  const loadSeqRef = useRef(0);

  const load = async (slug: string, d: number, lt: string, dir: Direction) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const params: Record<string, unknown> = { slug, depth: d };
      const trimmedLt = lt.trim();
      if (trimmedLt) params.link_type = trimmedLt;
      if (dir !== 'out') params.direction = dir;
      const filtered = !!trimmedLt || dir !== 'out';
      const r = await callMcp<GraphNode[] | GraphPath[]>('traverse_graph', params);
      if (loadSeqRef.current !== seq) return;
      const arr = Array.isArray(r) ? r : [];
      setData(filtered ? pathsToNodes(arr as GraphPath[], slug) : (arr as GraphNode[]));
      setPathsMode(filtered);
      setRootSlug(slug);
    } catch (err) {
      if (loadSeqRef.current !== seq) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (loadSeqRef.current === seq) setLoading(false);
    }
  };

  // 统计头：get_stats（含边数）失败则降级 schema_stats（仅节点/类型）。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await callMcp<BrainStats>('get_stats', {});
        if (cancelled) return;
        const byType = Object.entries(s.pages_by_type ?? {})
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);
        setStats({ nodes: s.page_count, links: s.link_count, byType });
      } catch {
        try {
          const s = await callMcp<SchemaStatsResult>('schema_stats', {});
          if (cancelled) return;
          const byType = (s.aggregate?.by_type ?? []).slice().sort((a, b) => b.count - a.count);
          setStats({ nodes: s.aggregate?.total_pages ?? 0, links: null, byType });
        } catch {
          /* 统计头静默省略，不阻塞探索器 */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 冷启动引导：拉几条真实存在的页面做「从这里开始」chip，避免新用户不知道 slug 怎么填。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pages = await callMcp<PageSummary[]>('list_pages', { limit: 5 });
        if (!cancelled) setExamplePages(Array.isArray(pages) ? pages : []);
      } catch {
        /* 冷启动引导降级为纯文本占位提示，不阻塞探索器 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // #/graph?q=<slug> 深链：进页 / hash 变化时自动以该 slug 为根展开。
  const loadedQ = useRef<string | null>(null);
  useEffect(() => {
    const applyHash = () => {
      const { path, query } = parseHash(window.location.hash);
      if (path !== '/graph') return;
      const q = query.get('q');
      if (q && loadedQ.current !== q) {
        loadedQ.current = q;
        setSlugInput(q);
        void load(q, depthRef.current, linkTypeRef.current, directionRef.current);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const slug = slugInput.trim();
    if (slug) void load(slug, depth, linkType, direction);
  };

  const selectedNode = useMemo(
    () => (selected && data ? data.find((n) => n.slug === selected) : undefined),
    [selected, data],
  );

  const pageTitle = useMemo(() => {
    if (!stats) return '— 节点 · — typed-link';
    if (stats.links != null) {
      return `${stats.nodes.toLocaleString()} 节点 · ${stats.links.toLocaleString()} typed-link`;
    }
    return `${stats.nodes.toLocaleString()} 节点`;
  }, [stats]);

  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 知识图谱 · GRAPH"
        title={pageTitle}
        subtitle={
          <span className="inline leading-relaxed">
            从一个页面出发遍历 typed 边图谱（traverse_graph）· 边在写入时即建好。
            <WhyButton topic="typed-link-zero-llm" className="ml-1 align-middle" />
          </span>
        }
      />

      {/* 类型图例（节点/边数已上移到 PageHeader 标题） */}
      {stats && stats.byType.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1.5">
          {stats.byType.slice(0, 10).map(({ type, count }) => (
            <span key={type} className="flex items-center gap-1.5 font-mono text-brain-2sm text-ink-soft">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: `var(${colorVarFor(type, false)})` }}
              />
              {type || '(untyped)'} <span className="text-muted">{count.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* Live 抽边演示 */}
      <div className="mb-6">
        <TypedLinkDemo />
      </div>

      {/* 探索器：根 slug + 深度 + 边类型/方向过滤 */}
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
          placeholder="根页面 slug，例如 concepts/gbrain"
          className="min-w-0 flex-1 sm:min-w-brain-input rounded-lg border border-hairline bg-surface px-4 py-2.5 font-mono text-brain-base text-ink outline-none focus:border-emphasis"
        />
        <select
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="rounded-lg border border-hairline bg-surface px-3 py-2.5 text-brain-base text-ink outline-none"
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              深度 {d}
            </option>
          ))}
        </select>
        <input
          value={linkType}
          onChange={(e) => setLinkType(e.target.value)}
          placeholder="边类型过滤，如 invested_in（留空 = 不过滤）"
          className="min-w-0 flex-1 sm:min-w-brain-input rounded-lg border border-hairline bg-surface px-4 py-2.5 font-mono text-brain-base text-ink outline-none focus:border-emphasis"
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
          className="rounded-lg border border-hairline bg-surface px-3 py-2.5 text-brain-base text-ink outline-none"
        >
          <option value="out">方向：出边</option>
          <option value="in">方向：入边</option>
          <option value="both">方向：双向</option>
        </select>
        <button
          type="submit"
          disabled={loading || !slugInput.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-brain-md font-medium text-inverse disabled:opacity-40"
        >
          {loading ? '遍历中…' : '展开'}
        </button>
      </form>

      {error && <div className="mt-4 text-brain-base text-contra">{error}</div>}

      {/* 冷启动引导：进页无图时，用真实存在的页面 slug 一键展开，不用猜 */}
      {!data && !loading && !error && examplePages && examplePages.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-brain-sm text-muted">从这里开始：</div>
          <div className="flex flex-wrap gap-2">
            {examplePages.map((p) => (
              <button
                key={p.slug}
                type="button"
                data-testid="graph-example-chip"
                onClick={() => {
                  setSlugInput(p.slug);
                  void load(p.slug, depth, linkType, direction);
                }}
                className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-brain-sm text-ink-soft hover:border-emphasis hover:text-ink"
              >
                {p.title || p.slug}
              </button>
            ))}
          </div>
        </div>
      )}

      {data && !error && (
        <div className="mt-6">
          {data.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-surface px-5 py-10 text-center text-brain-base text-muted">
              该页面没有可遍历的链接。
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-brain-sm text-muted">
                <span className="flex items-center gap-2">
                  {data.length} 个节点 · 根 <span className="font-mono text-ink-soft">{rootSlug}</span>
                  {pathsMode && <Badge tone="muted">按边过滤中 · 类型着色不可用</Badge>}
                </span>
                <span className="text-brain-2sm">点击节点查看详情 · 悬停高亮邻居 · 滚轮缩放 · 拖拽平移</span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
                <ForceGraph
                  data={data}
                  rootSlug={rootSlug}
                  selected={selected ?? undefined}
                  onSelect={setSelected}
                  charge={charge}
                  linkDistance={linkDistance}
                  centering={centering}
                  height={640}
                />

                {/* 力参数滑块：桌面宽度移入右栏竖排，小屏回退到图上方 */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <ForceSlider
                    label="斥力 repulsion"
                    value={charge}
                    min={-400}
                    max={-60}
                    step={10}
                    onChange={setCharge}
                  />
                  <ForceSlider
                    label="连边距离 link distance"
                    value={linkDistance}
                    min={20}
                    max={140}
                    step={4}
                    onChange={setLinkDistance}
                  />
                  <ForceSlider
                    label="向心力 centering"
                    value={centering}
                    min={0.01}
                    max={0.2}
                    step={0.005}
                    onChange={setCentering}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Drawer open={!!selectedNode} title={selectedNode?.title} onClose={() => setSelected(null)}>
        {selectedNode && (
          <div className="space-y-4">
            <div>
              <div className="font-mono text-brain-sm text-muted">{selectedNode.slug}</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="accent">{selectedNode.type}</Badge>
                <span className="text-brain-sm text-muted">深度 {selectedNode.depth}</span>
              </div>
            </div>
            <div>
              <div className="type-section-label mb-2">出链（{selectedNode.links?.length ?? 0}）</div>
              <div className="space-y-1.5">
                {(selectedNode.links ?? []).map((l, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(l.to_slug)}
                    className="flex w-full items-center justify-between rounded-lg border border-hairline bg-canvas px-3 py-2 text-left text-brain-base hover:bg-hairline/40"
                  >
                    <span className="truncate font-mono text-ink-soft">{l.to_slug}</span>
                    <span className="ml-2 shrink-0 text-brain-2sm text-muted">{l.link_type}</span>
                  </button>
                ))}
                {(selectedNode.links?.length ?? 0) === 0 && <div className="text-brain-base text-muted">无出链。</div>}
              </div>
            </div>
            <button
              onClick={() => {
                setSlugInput(selectedNode.slug);
                void load(selectedNode.slug, depth, linkType, direction);
              }}
              className="w-full rounded-lg bg-node-synthesis px-4 py-2 text-brain-base font-medium text-inverse"
            >
              以此为根重新展开
            </button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function ForceSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="rounded-lg border border-hairline bg-surface px-3 py-2">
      <div className="flex items-center justify-between font-mono text-brain-2sm text-ink-soft">
        <span>{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-accent)]"
      />
    </label>
  );
}
