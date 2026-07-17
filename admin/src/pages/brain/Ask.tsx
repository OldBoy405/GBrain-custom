import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { callMcp } from '../../lib/mcp-client';
import type { PageDetail, QueryResult, QueryTrace, ThinkResult } from '../../lib/op-types';
import { useLastQuery } from '../../lib/LastQueryContext';
import { parseHash } from '../../routes';
import { PageHeader, Badge, WhyButton, TraceWaterfall, Drawer } from '../../components/brain';
import { PipelineSteps } from '../../components/brain/PipelineSteps';

/**
 * 预设问题：点一条立刻跑检索。按仓库隐私规则一律用占位符实体
 * （alice-example / a-company 等），禁止真人 / 真公司 / 真 agent 名。
 */
const PRESET_QUESTIONS: string[] = [
  'LLM Wiki 什么时候引入？',
  'LLM Wiki 怎么引入？',
  'LLM Wiki 实现步骤',
  'AI工程团队超级个体与超级团队的打造方法',
  '为什么团队里都是用 AI 的高手，产品质量还是没有飞跃，甚至还出现下滑',
  '软件研发团队的 AI 转型如何起步？',
  '软件研发团队的 AI 转型重点是什么？',
];

function formatScorePercent(score: number): string {
  return `${Math.min(100, Math.max(0, Math.round(score * 100)))}%`;
}

/** 弱启发式步骤归因（后端未透传 recall arm 时的占位，对齐案例卡布局）。 */
function guessSourceStep(r: QueryResult): string {
  const slug = r.slug ?? '';
  if (slug.includes('compiled') || slug.startsWith('compiled/')) return 'compiled_truth boost';
  if (slug.startsWith('chat/') || slug.includes('wechat')) return 'typed-link 倒排';
  if (slug.startsWith('bookmarks/') || slug.includes('jike')) return '时间窗 boost';
  if (r.type === 'reading') return '向量召回';
  return 'RRF 融合';
}

export function Ask() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalMs, setTotalMs] = useState<number | undefined>(undefined);
  const [trace, setTrace] = useState<QueryTrace | undefined>(undefined);
  // Phase 3 — 合成答案（think）：检索表单勾选后随 query 自动触发。
  const [synthesizeAnswer, setSynthesizeAnswer] = useState(false);
  const [thinkResult, setThinkResult] = useState<ThinkResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [thinkError, setThinkError] = useState<string | null>(null);
  const [gapsDrawerOpen, setGapsDrawerOpen] = useState(false);
  // 引用抽屉：点击「引用：#N」take 行号打开，展示 page_slug 匹配详情。
  const [citationIndex, setCitationIndex] = useState<number | null>(null);
  // 「定位到来源卡」：点击后短暂高亮来源命中列表里对应的命中项。
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  // 「打开原资料」：抽屉内直接展开对应 slug 的完整正文（get_page），按 slug 缓存已取过的结果。
  const [originalDocSlug, setOriginalDocSlug] = useState<string | null>(null);
  const [originalDocLoading, setOriginalDocLoading] = useState(false);
  const [originalDocError, setOriginalDocError] = useState<string | null>(null);
  const [originalDocCache, setOriginalDocCache] = useState<Record<string, PageDetail>>({});
  // 点击「来源」命中卡：右侧抽屉展示该 slug 的原文（默认 1/3 屏，可拖拽调宽）。
  const [sourceDocSlug, setSourceDocSlug] = useState<string | null>(null);
  const hitRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRunRef = useRef('');
  const { setLastQuery } = useLastQuery();

  const runThink = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setThinking(true);
    setThinkError(null);
    try {
      const r = await callMcp<ThinkResult>('think', { question: trimmed });
      setThinkResult(r);
    } catch (err) {
      setThinkError(err instanceof Error ? err.message : String(err));
    } finally {
      setThinking(false);
    }
  }, []);

  const runQuery = useCallback(
    async (query: string, options?: { synthesize?: boolean }) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      const doThink = options?.synthesize ?? synthesizeAnswer;
      setLoading(true);
      setError(null);
      // 换新查询：重置合成答案与耗时。
      setThinkResult(null);
      setThinkError(null);
      setGapsDrawerOpen(false);
      setCitationIndex(null);
      setOriginalDocSlug(null);
      setSourceDocSlug(null);
      setOriginalDocError(null);
      setOriginalDocCache({});
      setTotalMs(undefined);
      setTrace(undefined);
      const t0 = Date.now();
      try {
        const r = await callMcp<{ results: QueryResult[]; trace: QueryTrace }>('query', {
          query: trimmed,
          limit: 20,
          trace: true,
        });
        const results = Array.isArray(r?.results) ? r.results : [];
        const elapsed = Date.now() - t0;
        setResults(results);
        setTotalMs(elapsed);
        setTrace(r?.trace);
        // 供本页 TraceWaterfall 读取："最近一次 ask" 跨页共享状态。
        setLastQuery({ query: trimmed, totalMs: elapsed, resultCount: results.length, ts: Date.now(), trace: r?.trace });
        if (doThink) {
          await runThink(trimmed);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [setLastQuery, synthesizeAnswer, runThink],
  );

  const handleSynthesizeChange = (checked: boolean) => {
    setSynthesizeAnswer(checked);
  };

  const syncFromHash = useCallback(() => {
    const fromHash = parseHash(window.location.hash).query.get('q')?.trim() ?? '';
    if (!fromHash) return;
    setQ(fromHash);
    if (fromHash !== lastRunRef.current) {
      lastRunRef.current = fromHash;
      void runQuery(fromHash);
    }
  }, [runQuery]);

  useEffect(() => {
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [syncFromHash]);

  const navigateToQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const target = `/ask?q=${encodeURIComponent(trimmed)}`;
    const current = window.location.hash.replace(/^#/, '');
    if (current !== target) {
      window.location.hash = target;
      return;
    }
    // 已在目标 URL（如再次点同一条）：强制重跑。
    lastRunRef.current = trimmed;
    void runQuery(trimmed);
  };

  const run = async (e: FormEvent) => {
    e.preventDefault();
    navigateToQuery(q);
  };

  const showPanels = loading || (results && !error);

  // 布局测量：以「检索栈 · 12 步」卡片高度为基准，左栏（答复 + 来源）与其对齐。
  const pipelineColRef = useRef<HTMLDivElement>(null);
  const hitsListRef = useRef<HTMLDivElement>(null);
  const [pipelineHeight, setPipelineHeight] = useState<number | undefined>(undefined);
  const [hitsListMaxHeight, setHitsListMaxHeight] = useState<number | undefined>(undefined);
  const [isLg, setIsLg] = useState(false);

  // lg 断点（1024px）：仅在双栏布局下做等高对齐；移动端保持自然高度。
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return; // jsdom / 无 matchMedia 环境
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 检索栈卡片高度：ResizeObserver 跟踪其动态高度（running / done / trace 展开）。
  useLayoutEffect(() => {
    const el = pipelineColRef.current;
    if (!el) {
      setPipelineHeight(undefined);
      return;
    }
    const update = () => setPipelineHeight(el.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver !== 'function') return; // jsdom 无 ResizeObserver
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPanels, loading, results, trace]);

  // 来源命中：最多显示 2 条命中的高度（测量第 2 条底边），超过则内部滚动。
  useLayoutEffect(() => {
    const el = hitsListRef.current;
    if (!el || !results || results.length <= 2) {
      setHitsListMaxHeight(undefined);
      return;
    }
    const items = el.children;
    if (items.length < 3) {
      setHitsListMaxHeight(undefined);
      return;
    }
    const listTop = el.getBoundingClientRect().top;
    const secondBottom = items[1].getBoundingClientRect().bottom;
    setHitsListMaxHeight(Math.ceil(secondBottom - listTop));
  }, [results]);

  // 仅在 lg 且渲染答复卡片时，把左栏高度锁到检索栈高度：
  // 答复卡片 + 来源命中卡片的（最大）高度之和 = 检索栈卡片高度。
  const fillMode = isLg && synthesizeAnswer && results !== null && !!pipelineHeight;
  const leftColHeight = fillMode ? pipelineHeight : undefined;

  // 卸载时清掉未完成的高亮定时器，避免内存泄漏/操作已卸载组件。
  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

  /** 定位到来源卡：滚动到并短暂高亮「来源 · 命中」列表里对应的命中项，同时关闭引用抽屉。 */
  const locateHit = (slug: string) => {
    setCitationIndex(null);
    setOriginalDocSlug(null);
    const el = hitRefs.current.get(slug);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    setHighlightedSlug(slug);
    clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedSlug(null), 1800);
  };

  /** 取原文：取过就走本地缓存，否则调 get_page（fuzzy 兜底）。引用内联展开与来源抽屉共用。 */
  const fetchOriginalDoc = async (slug: string) => {
    if (originalDocCache[slug]) return;
    setOriginalDocLoading(true);
    setOriginalDocError(null);
    try {
      const doc = await callMcp<PageDetail>('get_page', { slug, fuzzy: true });
      setOriginalDocCache((prev) => ({ ...prev, [slug]: doc }));
    } catch (err) {
      setOriginalDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setOriginalDocLoading(false);
    }
  };

  /** 引用抽屉里「打开原资料」：折叠态点击展开对应 slug 的正文。 */
  const openOriginalDoc = (slug: string) => {
    setOriginalDocSlug(slug);
    void fetchOriginalDoc(slug);
  };

  /** 点击「来源」命中卡：打开右侧原文抽屉并按需取文。 */
  const openSourceDoc = (slug: string) => {
    setSourceDocSlug(slug);
    void fetchOriginalDoc(slug);
  };

  const closeCitationDrawer = () => {
    setCitationIndex(null);
    setOriginalDocSlug(null);
    setOriginalDocError(null);
  };

  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 提问 · ASK"
        kickerMono
        title="问 GBrain 任何关于自己 brain 的问题"
        subtitle={
          <span className="inline leading-relaxed">
            混合检索：向量 + 关键词 + 关系 · 12 步管道示意 · 每步可独立 ablate · ~20 项算子叠加。
            <WhyButton topic="retrieval-stack-overview" className="ml-1 align-middle" />
          </span>
        }
      />

      {/* 预设问题 */}
      <div className="mb-4">
        <div className="type-mono-tiny mb-2">// 预设问题 · 点一条立刻检索</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUESTIONS.map((preset) => {
            const active = q.trim() === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setQ(preset);
                  navigateToQuery(preset);
                }}
                disabled={loading}
                className={`rounded-full border px-2.5 py-1 font-mono text-brain-xs transition disabled:opacity-50 ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-hairline text-muted hover:border-emphasis hover:text-ink'
                }`}
                style={active ? { background: 'var(--color-accent-soft)' } : undefined}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-surface focus-within:border-emphasis">
          <label className="flex cursor-pointer items-center justify-end gap-2 border-b border-hairline px-4 py-2">
            <span className="text-right text-brain-sm leading-relaxed text-ink">
              <span className="font-medium">让 GBrain 综合作答</span>
              <span className="text-muted">
                {' '}
                — 勾选后点「检索并作答」会额外调用模型（有成本）；不勾选则仅检索来源。
              </span>
            </span>
            <input
              type="checkbox"
              checked={synthesizeAnswer}
              onChange={(e) => handleSynthesizeChange(e.target.checked)}
              disabled={loading || thinking}
              data-testid="synthesize-answer"
              className="size-4 shrink-0 accent-[var(--color-node-synthesis)]"
            />
          </label>
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="向大脑提问…"
            rows={3}
            className="min-h-20 resize-none border-0 bg-transparent px-4 py-2.5 text-brain-md leading-relaxed text-ink outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || thinking || !q.trim()}
          className="self-stretch rounded-lg bg-accent px-5 text-brain-md font-medium text-inverse disabled:opacity-40"
        >
          {loading ? '检索中…' : thinking ? '综合中…' : synthesizeAnswer ? '检索并作答' : '检索'}
        </button>
      </form>

      {error && <div className="mt-4 text-brain-base text-contra">{error}</div>}

      {showPanels && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,13fr)_minmax(0,5fr)] lg:items-start">
          {/* 左栏：答复 + 来源命中；lg 下锁定到检索栈卡片高度 */}
          <div className="flex min-w-0 flex-col gap-4 overflow-hidden" style={{ height: leftColHeight }}>
            {/* Phase 3 — 勾选后自动合成答案 */}
            {synthesizeAnswer && results !== null && (
              <section
                className={`flex flex-col rounded-xl border border-hairline bg-surface p-5${
                  fillMode ? ' min-h-0 flex-1' : ''
                }`}
              >
                <div className="type-mono-tiny mb-2 flex shrink-0 items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  // GBrain 答复
                </div>
                <div className={fillMode ? 'min-h-0 flex-1 overflow-y-auto pr-1' : undefined}>
                {thinking && !thinkResult && !thinkError && (
                  <div className="text-brain-sm text-muted">综合中…</div>
                )}
                {thinkError && <div className="text-brain-base text-contra">{thinkError}</div>}
                {thinkResult && (
                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap text-brain-md leading-relaxed text-ink">
                      {thinkResult.answer || '（无答案文本）'}
                    </div>
                    {Array.isArray(thinkResult.citations) && thinkResult.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="type-section-label">引用：</span>
                        {thinkResult.citations.map((c, i) => {
                          // 标签为 take 行号（citation_index / row_num 兜底到序号 i+1）。
                          const n = c.citation_index ?? c.row_num ?? i + 1;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setCitationIndex(i);
                                setOriginalDocSlug(null);
                                setOriginalDocError(null);
                              }}
                              data-testid={`citation-chip-${i}`}
                              className="rounded-full border border-hairline px-2 py-0.5 font-mono text-brain-xs text-accent transition hover:border-emphasis hover:text-ink"
                              title="点击查看该引用来源（page_slug 匹配）"
                            >
                              #{n}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-brain-sm text-ink-soft">
                      {Array.isArray(thinkResult.gaps) && thinkResult.gaps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setGapsDrawerOpen(true)}
                          data-testid="think-gaps-trigger"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent p-0 text-ink-soft transition hover:text-ink"
                          title="查看证据缺口详情"
                        >
                          <Badge tone="amber">{thinkResult.gaps.length}</Badge>
                          <span className="underline decoration-dotted underline-offset-2">缺口</span>
                        </button>
                      )}
                      {(thinkResult.modelUsed || typeof thinkResult.pagesGathered === 'number') && (
                        <span className="font-mono text-brain-xs text-muted">
                          {thinkResult.modelUsed ? `模型 ${thinkResult.modelUsed}` : ''}
                          {typeof thinkResult.pagesGathered === 'number'
                            ? ` · ${thinkResult.pagesGathered} 页`
                            : ''}
                          {typeof thinkResult.takesGathered === 'number'
                            ? ` / ${thinkResult.takesGathered} takes`
                            : ''}
                        </span>
                      )}
                    </div>
                    {Array.isArray(thinkResult.warnings) && thinkResult.warnings.length > 0 && (
                      <div className="rounded-lg border border-hairline bg-surface px-4 py-3 text-brain-sm text-muted">
                        {thinkResult.warnings.join('；')}
                      </div>
                    )}
                    {thinkResult.remote_persisted_blocked && (
                      <div className="text-brain-sm text-muted">注：远程调用不持久化到大脑（save/take 已忽略）。</div>
                    )}
                  </div>
                )}
                </div>
              </section>
            )}

            {/* Phase 4 — 来源结果卡：最多显示 2 条命中，超过则内部滚动 */}
            {results && (
              <section
                className={`flex flex-col rounded-xl border border-hairline bg-surface p-5${
                  fillMode ? ' min-h-0 flex-none' : ''
                }`}
              >
                <div className="type-mono-tiny mb-3 shrink-0">// 来源 · {results.length} 条命中</div>
                {results.length === 0 ? (
                  <div className="py-10 text-center text-brain-base text-muted">无匹配结果。</div>
                ) : (
                  <div
                    ref={hitsListRef}
                    className="space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: hitsListMaxHeight }}
                  >
                    {results.map((r, i) => {
                      const clickable = !!r.slug;
                      return (
                        <button
                          key={r.slug ?? i}
                          type="button"
                          ref={(el) => {
                            if (!r.slug) return;
                            if (el) hitRefs.current.set(r.slug, el);
                            else hitRefs.current.delete(r.slug);
                          }}
                          onClick={() => {
                            if (r.slug) openSourceDoc(r.slug);
                          }}
                          disabled={!clickable}
                          data-testid={`hit-card-${r.slug ?? i}`}
                          title={clickable ? '点击查看原资料' : undefined}
                          className={`block w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                            clickable ? 'cursor-pointer hover:border-emphasis' : ''
                          } ${
                            r.slug && r.slug === highlightedSlug
                              ? 'border-accent bg-accent-soft'
                              : 'border-hairline bg-canvas'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {r.slug && (
                              <div className="min-w-0 truncate font-mono text-brain-xs text-muted">
                                {r.slug}
                              </div>
                            )}
                            {typeof r.score === 'number' && (
                              <span
                                className="shrink-0 font-mono text-brain-xs text-accent"
                                title="融合相关度分（RRF + cosine）的用户向百分比展示；仅用于同次结果内相对比较"
                              >
                                {formatScorePercent(r.score)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 type-serif text-brain-lg font-semibold text-ink">
                            {r.title || r.slug || `结果 ${i + 1}`}
                          </div>
                          <div className="mt-1 font-mono text-brain-xs italic text-muted">
                            ↑ 来自步骤: {guessSourceStep(r)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* 右栏：检索栈（约为原 7:5 布局下 5 列宽的 2/3） */}
          <div ref={pipelineColRef} className="min-w-0">
            <PipelineSteps running={loading} done={!loading && !!results} totalMs={totalMs} trace={trace} />
          </div>
        </div>
      )}

      {/* 为什么多算子叠加（定性说明；不展示未经本地复现的数字）—— 独占一行 */}
      {showPanels && results && results.length > 0 && (
        <section
          className="mt-4 rounded-xl border border-hairline p-4"
          style={{ background: 'color-mix(in srgb, var(--color-accent-soft) 40%, transparent)' }}
        >
          <div className="type-mono-tiny mb-2" style={{ color: 'var(--color-accent)' }}>
            // 为什么多算子叠加
          </div>
          <p className="text-brain-sm leading-relaxed text-ink-soft">
            检索是 ~20 项确定性 + 概率算子叠加（意图 / 扩展 / 向量 / 关键词 / 关系 / RRF / 精排 / 去重 / 截断…），
            没有单点 silver bullet —— 每一臂贡献一段召回质量，且都可独立 ablate。
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-1 text-brain-sm text-ink-soft">
            其中 typed-link 关系召回与 source-aware SQL boost 对相关问题影响最显著 ·
            <WhyButton topic="typed-link-precision" />
            <WhyButton topic="source-aware-sql-boost" />
          </p>
          <p className="mt-1.5 text-brain-xs text-muted">
            各算子的量化贡献请跑离线基准（<span className="font-mono">gbrain eval</span>）—— 本页不展示未经本地复现的数字。
          </p>
        </section>
      )}

      {results && (
        <div className="mt-6">
          <TraceWaterfall />
        </div>
      )}

      <Drawer
        open={gapsDrawerOpen}
        title={`证据缺口 · ${thinkResult?.gaps?.length ?? 0}`}
        onClose={() => setGapsDrawerOpen(false)}
      >
        <p className="mb-4 text-brain-sm leading-relaxed text-ink-soft">
          模型在综合作答时认为大脑中缺少以下证据，因此未做无依据推断。补全相关笔记后重新检索可获得更完整答案。
        </p>
        {thinkResult?.gaps && thinkResult.gaps.length > 0 ? (
          <ol className="list-decimal space-y-2 pl-[2em] text-brain-sm leading-relaxed text-ink">
            {thinkResult.gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ol>
        ) : (
          <div className="text-brain-sm text-muted">无缺口记录。</div>
        )}
      </Drawer>

      {/* 引用来源抽屉：按 page_slug 在本次来源命中里匹配，展示 slug + 标题 + 摘要 */}
      {(() => {
        const cites = thinkResult?.citations;
        const c = citationIndex !== null && cites ? cites[citationIndex] : undefined;
        const slug = c ? c.page_slug ?? c.slug : undefined;
        const match = slug ? results?.find((r) => r.slug === slug) : undefined;
        const snippet = match?.snippet || match?.excerpt || match?.text;
        const label = c ? (c.citation_index ?? c.row_num ?? (citationIndex ?? 0) + 1) : '';
        return (
          <Drawer
            open={citationIndex !== null}
            title={`引用 #${label}`}
            onClose={closeCitationDrawer}
            resizable
          >
            {c ? (
              <div className="space-y-4">
                <div>
                  <div className="type-section-label mb-1">page_slug 匹配</div>
                  <div className="font-mono text-brain-sm break-all text-accent">
                    {slug || '（无 slug）'}
                  </div>
                  {typeof c.row_num === 'number' && (
                    <div className="mt-1 font-mono text-brain-xs text-muted">take 行号：{c.row_num}</div>
                  )}
                </div>
                {match && (
                  <div className="flex flex-wrap items-center gap-2">
                    {match.type && <Badge tone="muted">{match.type}</Badge>}
                    {typeof match.score === 'number' && (
                      <span
                        className="font-mono text-brain-xs text-accent"
                        title="融合相关度分（RRF + cosine）的用户向百分比展示；仅用于同次结果内相对比较"
                      >
                        {formatScorePercent(match.score)}
                      </span>
                    )}
                    <span className="font-mono text-brain-xs italic text-muted">
                      ↑ 来自步骤: {guessSourceStep(match)}
                    </span>
                  </div>
                )}
                {slug && (
                  <div className="flex flex-wrap gap-2">
                    {match && (
                      <button
                        type="button"
                        onClick={() => locateHit(slug)}
                        data-testid="citation-locate-hit"
                        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-brain-xs text-ink-soft transition hover:border-emphasis hover:text-ink"
                      >
                        ↓ 定位到来源卡
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        originalDocSlug === slug ? setOriginalDocSlug(null) : void openOriginalDoc(slug)
                      }
                      disabled={originalDocLoading && originalDocSlug === slug}
                      data-testid="citation-open-original"
                      className="inline-flex w-fit items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-brain-xs text-ink-soft transition hover:border-emphasis hover:text-ink disabled:opacity-50"
                    >
                      {originalDocSlug === slug
                        ? originalDocLoading
                          ? '加载中…'
                          : '↑ 收起原资料'
                        : '📄 打开原资料'}
                    </button>
                  </div>
                )}
                {originalDocSlug === slug && slug && (
                  <div className="rounded-lg border border-hairline bg-surface p-3">
                    {originalDocLoading && <div className="text-brain-sm text-muted">加载原资料中…</div>}
                    {originalDocError && (
                      <div className="text-brain-sm text-contra">加载失败：{originalDocError}</div>
                    )}
                    {!originalDocLoading && !originalDocError && originalDocCache[slug] && (
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="type-serif text-brain-base font-semibold text-ink">
                            {originalDocCache[slug].title || slug}
                          </span>
                          {originalDocCache[slug].updated_at && (
                            <span className="font-mono text-brain-xs text-muted">
                              更新于 {originalDocCache[slug].updated_at}
                            </span>
                          )}
                        </div>
                        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-brain-xs leading-relaxed text-ink">
                          {originalDocCache[slug].compiled_truth || '（正文为空）'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                {(match?.title || c.title) && (
                  <div>
                    <div className="type-section-label mb-1">标题</div>
                    <div className="type-serif text-brain-lg font-semibold text-ink">
                      {match?.title || c.title}
                    </div>
                  </div>
                )}
                {snippet && (
                  <div>
                    <div className="type-section-label mb-1">摘要</div>
                    <div className="text-brain-sm leading-relaxed text-ink-soft">{snippet}</div>
                  </div>
                )}
                {!match && (
                  <div className="rounded-lg border border-hairline bg-surface px-4 py-3 text-brain-sm text-muted">
                    未在本次来源命中里找到匹配的 page_slug（可能被截断或来自其他来源）。
                  </div>
                )}
              </div>
            ) : (
              <div className="text-brain-sm text-muted">无引用详情。</div>
            )}
          </Drawer>
        );
      })()}

      {/* 来源原文抽屉：点击「来源」命中卡打开，右侧滑出，默认 1/3 屏、可自由拖拽调宽 */}
      {(() => {
        const slug = sourceDocSlug;
        const doc = slug ? originalDocCache[slug] : undefined;
        const match = slug ? results?.find((r) => r.slug === slug) : undefined;
        return (
          <Drawer
            open={sourceDocSlug !== null}
            title={doc?.title || match?.title || slug || '原资料'}
            onClose={() => {
              setSourceDocSlug(null);
              setOriginalDocError(null);
            }}
            resizable
            initialWidthRatio={1 / 3}
          >
            {slug ? (
              <div className="space-y-3">
                <div className="font-mono text-brain-xs break-all text-muted">{slug}</div>
                {doc?.updated_at && (
                  <div className="font-mono text-brain-xs text-muted">更新于 {doc.updated_at}</div>
                )}
                {originalDocLoading && !doc && (
                  <div className="text-brain-sm text-muted">加载原资料中…</div>
                )}
                {originalDocError && !doc && (
                  <div className="text-brain-sm text-contra">加载失败：{originalDocError}</div>
                )}
                {doc && (
                  <pre className="whitespace-pre-wrap font-mono text-brain-sm leading-relaxed text-ink">
                    {doc.compiled_truth || '（正文为空）'}
                  </pre>
                )}
                {!originalDocLoading && !originalDocError && !doc && (
                  <div className="text-brain-sm text-muted">暂无正文。</div>
                )}
              </div>
            ) : null}
          </Drawer>
        );
      })()}
    </div>
  );
}
