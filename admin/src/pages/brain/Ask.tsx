import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { callMcp } from '../../lib/mcp-client';
import type { QueryResult, QueryTrace, ThinkResult } from '../../lib/op-types';
import { useLastQuery } from '../../lib/LastQueryContext';
import { parseHash } from '../../routes';
import { PageHeader, Badge, WhyButton } from '../../components/brain';
import { PipelineSteps } from '../../components/brain/PipelineSteps';

/**
 * 预设问题：点一条立刻跑检索。按仓库隐私规则一律用占位符实体
 * （alice-example / a-company 等），禁止真人 / 真公司 / 真 agent 名。
 */
const PRESET_QUESTIONS: string[] = [
  '我什么时候开始关注 typed-link 这个想法的？',
  '我对 typed-link 这个想法的演变路径是什么？',
  'alice-example 投了哪几家公司？',
  '上周关于 dream cycle 的设计讨论里我说过什么？',
  '我关于 RRF K=60 的依据笔记在哪里？',
  'a-company 的尽调笔记里有哪些风险点？',
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
  // Phase 3 — 按需合成答案（think）。默认不触发，用户点击才调。
  const [thinkResult, setThinkResult] = useState<ThinkResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [thinkError, setThinkError] = useState<string | null>(null);
  const lastRunRef = useRef('');
  const { setLastQuery } = useLastQuery();

  const runQuery = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    // 换新查询：重置合成答案与耗时。
    setThinkResult(null);
    setThinkError(null);
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
      // 供 Jobs 页 TraceWaterfall 读取："最近一次 ask" 跨页共享状态。
      setLastQuery({ query: trimmed, totalMs: elapsed, resultCount: results.length, ts: Date.now(), trace: r?.trace });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [setLastQuery]);

  const runThink = useCallback(async () => {
    const trimmed = q.trim();
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
  }, [q]);

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
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="向大脑提问…"
          rows={2}
          className="min-h-16 flex-1 resize-none rounded-lg border border-hairline bg-surface px-4 py-2.5 text-brain-md leading-relaxed text-ink outline-none focus:border-emphasis"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="self-stretch rounded-lg bg-accent px-5 text-brain-md font-medium text-inverse disabled:opacity-40"
        >
          {loading ? '检索中…' : '检索'}
        </button>
      </form>

      {error && <div className="mt-4 text-brain-base text-contra">{error}</div>}

      {showPanels && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
          {/* 左栏：合成答案 + 来源 + 说明卡 */}
          <div className="space-y-4 lg:col-span-7">
            {/* Phase 3 — 按需合成答案 */}
            {results && results.length > 0 && (
              <section className="rounded-xl border border-hairline bg-surface p-5">
                <div className="type-mono-tiny mb-2 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  // GBrain 答复
                </div>
                {!thinkResult && !thinkError && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void runThink()}
                      disabled={thinking}
                      className="rounded-lg bg-node-synthesis px-4 py-2 text-brain-sm font-medium text-inverse disabled:opacity-40"
                    >
                      {thinking ? '综合中…' : '让 GBrain 综合作答'}
                    </button>
                    <span className="text-brain-sm text-muted">会额外调用一次模型综合作答（有成本）。</span>
                  </div>
                )}
                {thinkError && <div className="text-brain-base text-contra">{thinkError}</div>}
                {thinkResult && (
                  <div className="space-y-4">
                    <div className="whitespace-pre-wrap text-brain-md leading-relaxed text-ink">
                      {thinkResult.answer || '（无答案文本）'}
                    </div>
                    {Array.isArray(thinkResult.citations) && thinkResult.citations.length > 0 && (
                      <div>
                        <div className="type-section-label mb-1.5">引用</div>
                        <div className="space-y-2">
                          {thinkResult.citations.map((c, i) => {
                            // 本地按 slug 匹配检索结果，enrich 出标题/摘要（零后端）。
                            const match = c.slug
                              ? results?.find((r) => r.slug === c.slug)
                              : undefined;
                            const label = c.slug || c.title || `#${i + 1}`;
                            return (
                              <div key={i} className="rounded-lg border border-hairline bg-canvas px-3 py-2">
                                <div className="font-mono text-brain-xs text-accent">{label}</div>
                                {match?.title && (
                                  <div className="mt-0.5 text-brain-sm text-ink">{match.title}</div>
                                )}
                                {match && (match.snippet || match.excerpt || match.text) && (
                                  <div className="mt-0.5 line-clamp-2 text-brain-xs text-muted">
                                    {match.snippet || match.excerpt || match.text}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-brain-sm text-ink-soft">
                      {Array.isArray(thinkResult.gaps) && thinkResult.gaps.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Badge tone="amber">{thinkResult.gaps.length}</Badge> 缺口
                        </span>
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
              </section>
            )}

            {/* Phase 4 — 来源结果卡 */}
            {results && (
              <section className="rounded-xl border border-hairline bg-surface p-5">
                <div className="type-mono-tiny mb-3">// 来源 · {results.length} 条命中</div>
                {results.length === 0 ? (
                  <div className="py-10 text-center text-brain-base text-muted">无匹配结果。</div>
                ) : (
                  <div className="space-y-2">
                    {results.map((r, i) => (
                      <div
                        key={r.slug ?? i}
                        className="rounded-lg border border-hairline bg-canvas px-4 py-3"
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
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 为什么多算子叠加（定性说明；不展示未经本地复现的数字） */}
            {results && results.length > 0 && (
              <section
                className="rounded-xl border border-hairline p-4"
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
          </div>

          {/* 右栏：检索栈（PipelineSteps 自带 sticky + 独立滚动） */}
          <div className="lg:col-span-5">
            <PipelineSteps running={loading} done={!loading && !!results} totalMs={totalMs} trace={trace} />
          </div>
        </div>
      )}
    </div>
  );
}
