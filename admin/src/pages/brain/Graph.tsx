import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { callMcp } from '../../lib/mcp-client';
import type { GraphNode, GraphPath, BrainStats, SchemaStatsResult, PageSummary } from '../../lib/op-types';
import { parseHash } from '../../routes';
import { PageHeader, Drawer, Badge, WhyButton } from '../../components/brain';
import { ForceGraph } from '../../components/brain/ForceGraph';
import { TypedLinkDemo } from '../../components/brain/TypedLinkDemo';
import { buildGraph, colorVarFor, edgeColorVarFor, pathsToNodes } from '../../components/brain/graph-model';
import { graphCacheKey, getCachedGraph, setCachedGraph } from '../../lib/graph-cache';

type Direction = 'out' | 'in' | 'both';

/**
 * 尺寸门控阈值（与后端 graph_overview 默认 node/edge 上限一致）：无根进页时，
 * 小库直接渲染全量概览；超阈值的大库改为自动选中心节点 + 深度2，避免 canvas 卡死。
 */
const OVERVIEW_MAX_NODES = 500;
const OVERVIEW_MAX_LINKS = 1500;

interface GraphStats {
  nodes: number;
  /** typed-link 总数；schema_stats 降级时为 null（该 op 不含边数）。 */
  links: number | null;
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
  const [locate, setLocate] = useState('');
  // 力参数默认折叠：小众高级控件，收起后图占满整宽。
  const [showControls, setShowControls] = useState(false);
  // 全量概览模式：无根 slug 时默认渲染度数 top-N 骨架图（graph_overview）。
  const [overviewMode, setOverviewMode] = useState(false);

  // 力参数（对应三个滑块，实时喂给 ForceGraph）。
  const [charge, setCharge] = useState(-180);
  const [linkDistance, setLinkDistance] = useState(60);
  const [centering, setCentering] = useState(0.05);

  const [stats, setStats] = useState<GraphStats | null>(null);
  const [examplePages, setExamplePages] = useState<PageSummary[] | null>(null);
  // Live 演示 与 数据库真实图谱 二选一展示，避免两块内容纵向堆叠挤占首屏。
  const [activeTab, setActiveTab] = useState<'demo' | 'database'>('demo');
  // 边类型下拉选项：来自 active schema pack 的 link_types（与 slug 输入同款 datalist 下拉体验）。
  const [linkTypeOptions, setLinkTypeOptions] = useState<string[]>([]);

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
    setSelected(null);
    setOverviewMode(false);

    // 客户端缓存命中：同一 (slug, depth, linkType, direction) 直接回填渲染态，
    // 不打后端。seq 已自增，任何在途的旧请求解析时会因 seq 不匹配而放弃。
    const cacheKey = graphCacheKey(slug, d, lt, dir);
    const cached = getCachedGraph(cacheKey);
    if (cached) {
      setError(null);
      setData(cached.data);
      setPathsMode(cached.pathsMode);
      setRootSlug(slug);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { slug, depth: d };
      const trimmedLt = lt.trim();
      if (trimmedLt) params.link_type = trimmedLt;
      if (dir !== 'out') params.direction = dir;
      const filtered = !!trimmedLt || dir !== 'out';
      const r = await callMcp<GraphNode[] | GraphPath[]>('traverse_graph', params);
      if (loadSeqRef.current !== seq) return;
      const arr = Array.isArray(r) ? r : [];
      const nextData = filtered ? pathsToNodes(arr as GraphPath[], slug) : (arr as GraphNode[]);
      setData(nextData);
      setPathsMode(filtered);
      setRootSlug(slug);
      setCachedGraph(cacheKey, { data: nextData, pathsMode: filtered });
    } catch (err) {
      if (loadSeqRef.current !== seq) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (loadSeqRef.current === seq) setLoading(false);
    }
  };

  // 全量概览：无根 slug 时渲染度数 top-N 骨架图（graph_overview）。走同一 loadSeq
  // 竞态保护，任何用户提交/深链会顶掉在途的概览请求。
  const loadOverview = async () => {
    const seq = ++loadSeqRef.current;
    setSelected(null);
    setLoading(true);
    setError(null);
    try {
      const r = await callMcp<GraphNode[]>('graph_overview', {});
      if (loadSeqRef.current !== seq) return;
      setData(Array.isArray(r) ? r : []);
      setPathsMode(false);
      setOverviewMode(true);
      setRootSlug('');
    } catch (err) {
      if (loadSeqRef.current !== seq) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (loadSeqRef.current === seq) setLoading(false);
    }
  };

  // 统计头：get_stats（含边数）失败则降级 schema_stats（仅节点数）。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await callMcp<BrainStats>('get_stats', {});
        if (cancelled) return;
        setStats({ nodes: s.page_count, links: s.link_count });
      } catch {
        try {
          const s = await callMcp<SchemaStatsResult>('schema_stats', {});
          if (cancelled) return;
          setStats({ nodes: s.aggregate?.total_pages ?? 0, links: null });
        } catch {
          /* 统计头静默省略，不阻塞探索器 */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 冷启动引导 + slug 自动补全：拉一批真实页面，既做「从这里开始」chip（取前 5），
  // 又灌进 <datalist> 给根输入框做原生自动补全，用户不用猜 slug 怎么填。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pages = await callMcp<PageSummary[]>('list_pages', { limit: 100 });
        if (!cancelled) setExamplePages(Array.isArray(pages) ? pages : []);
      } catch {
        /* 冷启动引导降级为纯文本占位提示，不阻塞探索器 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 边类型下拉：schema_graph 给出 active schema pack 定义的 link_types（verb），
  // 供边类型过滤 datalist 自动补全，不再要求用户记住/盲打 invested_in 这类精确拼写。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await callMcp<{ edges: Array<{ verb: string }> }>('schema_graph', {});
        if (cancelled) return;
        const verbs = [...new Set((r.edges ?? []).map((e) => e.verb).filter(Boolean))].sort();
        setLinkTypeOptions(verbs);
      } catch {
        /* 降级为纯文本输入，不阻塞探索器 */
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

  // 尺寸自适应默认渲染：无根 slug、无 #?q 深链、尚无图时，进页自动出图一次。
  // 小库 → 全量概览；大库 → 自动选中心节点（首个示例页）深度2。只跑一次。
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current || data || loading || error) return;
    // 深链场景交给上面的 q 效果处理，这里让路。
    const { path, query } = parseHash(window.location.hash);
    if (path === '/graph' && query.get('q')) return;
    // 统计头未就绪时无法判断库大小，暂不自动出图（保留探索器）。
    if (!stats) return;
    const smallEnough =
      stats.nodes <= OVERVIEW_MAX_NODES && (stats.links == null || stats.links <= OVERVIEW_MAX_LINKS);
    if (smallEnough) {
      autoLoadedRef.current = true;
      void loadOverview();
    } else if (examplePages && examplePages.length > 0) {
      // 大库：以度数未知的首个页面为中心，深度2 展开一个可控邻域。
      autoLoadedRef.current = true;
      const seed = examplePages[0].slug;
      setSlugInput(seed);
      void load(seed, 2, '', 'out');
    }
    // 大库且 examplePages 未就绪：等待下一次依赖变化再决定。
  }, [stats, examplePages, data, loading, error]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const slug = slugInput.trim();
    if (slug) void load(slug, depth, linkType, direction);
  };

  const selectedNode = useMemo(
    () => (selected && data ? data.find((n) => n.slug === selected) : undefined),
    [selected, data],
  );

  // 当前已加载子图的节点/边计数，供「知识图谱」tab 标题展示（与 ForceGraph 内 overlay 同一份 buildGraph 结果，口径一致）。
  const graphCounts = useMemo(() => {
    if (!data) return null;
    const built = buildGraph(data);
    return { nodes: built.nodes.length, links: built.links.length };
  }, [data]);

  // 当前图里出现过的边类型（去重 + 排序），供边类型图例渲染。
  const edgeTypes = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    for (const n of data) for (const l of n.links ?? []) if (l.link_type) s.add(l.link_type);
    return [...s].sort();
  }, [data]);

  // typed-link 类型是开放词表（demo 可现抽出全新动词），schema_graph 的声明式列表可能为空
  // 或不全 —— 累积每次实际加载过的边类型，边类型过滤 datalist 才始终有真实可选项。
  useEffect(() => {
    if (edgeTypes.length === 0) return;
    setLinkTypeOptions((prev) => {
      const merged = new Set([...prev, ...edgeTypes]);
      return merged.size === prev.length ? prev : [...merged].sort();
    });
  }, [edgeTypes]);

  // 图内定位：按 slug/title 子串命中已加载节点并选中（不重新遍历，纯前端）。
  const doLocate = () => {
    const q = locate.trim().toLowerCase();
    if (!q || !data) return;
    const hit = data.find(
      (n) => n.slug.toLowerCase().includes(q) || n.title.toLowerCase().includes(q),
    );
    if (hit) setSelected(hit.slug);
  };

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

      {/* 知识图谱容器：tab 切换 + 对应内容都收进一张卡片 */}
      <div className="rounded-xl border border-hairline bg-surface p-5">
        {/* Live 演示 / 数据库真实图谱 二选一 tab（案例 MHTML 同款 segmented pill 样式） */}
        <div className="mb-6 flex w-fit gap-1 rounded-lg border border-hairline bg-elevated p-1">
          <button
            type="button"
            data-testid="graph-tab-demo"
            onClick={() => setActiveTab('demo')}
            aria-pressed={activeTab === 'demo'}
            className={`rounded-md px-4 py-1.5 font-mono text-brain-2sm transition ${
              activeTab === 'demo' ? 'bg-accent text-inverse' : 'text-ink-soft hover:bg-subtle hover:text-ink'
            }`}
          >
            动态类型链接演示
          </button>
          <button
            type="button"
            data-testid="graph-tab-real"
            onClick={() => setActiveTab('database')}
            aria-pressed={activeTab === 'database'}
            className={`rounded-md px-4 py-1.5 font-mono text-brain-2sm transition ${
              activeTab === 'database'
                ? 'bg-accent text-inverse'
                : 'text-ink-soft hover:bg-subtle hover:text-ink'
            }`}
          >
            知识图谱{graphCounts ? ` · ${graphCounts.nodes} 节点 · ${graphCounts.links} 边` : ''}
          </button>
        </div>

        {activeTab === 'demo' && <TypedLinkDemo />}

        {activeTab === 'database' && (
          <>
      {/* 探索器：根 slug + 深度 + 边类型/方向过滤 */}
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
          placeholder="根页面 slug，例如 concepts/gbrain"
          list="graph-slug-options"
          className="min-w-0 flex-1 sm:min-w-brain-input rounded-lg border border-hairline bg-surface px-4 py-2.5 font-mono text-brain-base text-ink outline-none focus:border-emphasis"
        />
        <datalist id="graph-slug-options">
          {(examplePages ?? []).map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title || p.slug}
            </option>
          ))}
        </datalist>
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
          list="graph-link-type-options"
          className="min-w-0 flex-1 sm:min-w-brain-input rounded-lg border border-hairline bg-surface px-4 py-2.5 font-mono text-brain-base text-ink outline-none focus:border-emphasis"
        />
        <datalist id="graph-link-type-options">
          {linkTypeOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
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
            {examplePages.slice(0, 5).map((p) => (
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
              {overviewMode ? '脑库暂无带链接的页面，先建立一些 typed-link 再来看全量图。' : '该页面没有可遍历的链接。'}
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-brain-sm text-muted">
                <span className="flex items-center gap-2">
                  {overviewMode ? (
                    <>
                      {data.length} 个节点 · <Badge tone="accent">全量概览 · 度数 top</Badge>
                    </>
                  ) : (
                    <>
                      {data.length} 个节点 · 根 <span className="font-mono text-ink-soft">{rootSlug}</span>
                    </>
                  )}
                  {pathsMode && <Badge tone="muted">按边过滤中</Badge>}
                </span>
                <span className="flex items-center gap-2">
                  <input
                    value={locate}
                    onChange={(e) => setLocate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        doLocate();
                      }
                    }}
                    placeholder="定位节点…"
                    aria-label="定位节点"
                    className="w-32 rounded-lg border border-hairline bg-surface px-2.5 py-1 font-mono text-brain-2sm text-ink outline-none focus:border-emphasis"
                  />
                  <button
                    type="button"
                    onClick={() => setShowControls((v) => !v)}
                    aria-pressed={showControls}
                    className="rounded-lg border border-hairline bg-surface px-2.5 py-1 text-brain-2sm text-ink-soft hover:border-emphasis hover:text-ink"
                  >
                    力参数 {showControls ? '▾' : '▸'}
                  </button>
                  <span className="text-brain-2sm">点击节点查看详情 · 悬停高亮邻居 · 滚轮缩放</span>
                </span>
              </div>

              {/* 边类型图例：反映当前图里实际出现的 link_type，颜色与 canvas 边一致 */}
              {edgeTypes.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {edgeTypes.slice(0, 12).map((t) => (
                    <span key={t} className="flex items-center gap-1.5 font-mono text-brain-2sm text-ink-soft">
                      <span className="h-0.5 w-4 shrink-0 rounded" style={{ background: `var(${edgeColorVarFor(t)})` }} />
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className={`grid grid-cols-1 gap-3 ${showControls ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
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

                {/* 力参数滑块：默认折叠；展开后桌面宽度移入右栏竖排，小屏回退到图上方 */}
                {showControls && (
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
                )}
              </div>

              {/* 可访问性：canvas 图无法被键盘/读屏遍历，这里挂一份等价的节点列表镜像。
                  Tab 到任意节点、Enter 打开其详情 Drawer（与点击 canvas 节点同效）。 */}
              <details className="mt-3 rounded-xl border border-hairline bg-surface">
                <summary className="cursor-pointer px-4 py-2 text-brain-sm text-ink-soft">
                  节点列表（键盘可达 · {data.length}）
                </summary>
                <ul role="list" className="max-h-64 overflow-auto px-2 pb-2">
                  {data.map((n) => (
                    <li key={n.slug}>
                      <button
                        type="button"
                        onClick={() => setSelected(n.slug)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-brain-sm hover:bg-hairline/40"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: `var(${colorVarFor(n.type, n.slug === rootSlug)})` }}
                        />
                        <span className="truncate text-ink">{n.title}</span>
                        <span className="ml-auto shrink-0 font-mono text-brain-2sm text-muted">
                          {n.type} · d{n.depth}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}
        </>
        )}
      </div>

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
