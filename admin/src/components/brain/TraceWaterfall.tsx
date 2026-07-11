import { useState } from 'react';
import { useLastQuery } from '../../lib/LastQueryContext';
import { RETRIEVAL_STEPS } from '../../lib/retrieval-steps';
import { WhyButton } from './WhyButton';

/**
 * 每步的示意占比权重 + 色系（index 对齐 RETRIEVAL_STEPS）。纯结构示意——
 * 后端 `query` 只返回 SearchResult[]，不返回逐步计时（同 PipelineSteps.tsx 的诚实声明）。
 * LLM 类步骤（扩展 / 精排）给更宽的示意占比，DB/CPU 步骤更窄；不代表真实毫秒占比。
 */
const WATERFALL_WEIGHTS: Array<{ weight: number; kind: 'llm' | 'db' | 'cpu' }> = [
  { weight: 6, kind: 'llm' }, // 意图识别
  { weight: 3, kind: 'cpu' }, // 缓存查询
  { weight: 14, kind: 'llm' }, // 多查询扩展
  { weight: 6, kind: 'db' }, // 向量嵌入
  { weight: 8, kind: 'db' }, // 向量召回
  { weight: 5, kind: 'db' }, // 关键词召回
  { weight: 8, kind: 'db' }, // 关系召回
  { weight: 4, kind: 'cpu' }, // RRF 融合
  { weight: 18, kind: 'llm' }, // 精排
  { weight: 4, kind: 'cpu' }, // 自动截断
  { weight: 4, kind: 'cpu' }, // Token 预算
  { weight: 6, kind: 'cpu' }, // 组装结果
];

const KIND_COLOR: Record<'llm' | 'db' | 'cpu', string> = {
  llm: 'var(--color-node-synthesis)',
  db: 'var(--color-accent)',
  cpu: 'var(--color-amber)',
};

const KIND_LABEL: Record<'llm' | 'db' | 'cpu', string> = {
  llm: 'llm',
  db: 'db',
  cpu: 'cpu',
};

/** 是否烧 token：llm 步骤调用模型；db/cpu 步骤纯 Postgres/本地计算，不过模型。 */
const BURNS_TOKEN: Record<'llm' | 'db' | 'cpu', boolean> = {
  llm: true,
  db: false,
  cpu: false,
};

const TOTAL_WEIGHT = WATERFALL_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);

/**
 * "最近一次 ask" 的检索管道瀑布图。数据来自跨页共享的 `LastQueryContext`——
 * Ask 页发起真实查询成功后写入 `{query, totalMs, resultCount}`；本组件读取渲染。
 * 未曾在本次会话问过问题时（含刷新后，Context 纯内存）显示空态引导去 Ask 页。
 */
export function TraceWaterfall() {
  const { lastQuery } = useLastQuery();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!lastQuery) {
    return (
      <section className="rounded-lg border border-hairline bg-elevated p-5">
        <div className="type-mono-tiny mb-2">// TRACE WATERFALL · 最近一次 ask</div>
        <p className="text-brain-sm text-muted">
          暂无最近查询 · 前往<a href="#/ask" className="text-accent hover:underline">「精确检索」</a>问一个问题后回到本页查看。
        </p>
      </section>
    );
  }

  let acc = 0;

  return (
    <section className="rounded-lg border border-hairline bg-elevated p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="type-mono-tiny mb-1">// TRACE WATERFALL · 最近一次 ask</div>
          <h3 className="type-serif truncate text-brain-lg font-semibold text-ink">"{lastQuery.query}"</h3>
          <div className="mt-0.5 flex items-center gap-1 font-mono text-brain-xs text-muted">
            总 {lastQuery.totalMs}ms（实测）· {lastQuery.resultCount} 条结果 ·
            <WhyButton topic="trace-rrf-boost" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-1 lg:col-span-8">
          {RETRIEVAL_STEPS.map((step, i) => {
            const { weight, kind } = WATERFALL_WEIGHTS[i];
            const widthPct = (weight / TOTAL_WEIGHT) * 100;
            const leftPct = (acc / TOTAL_WEIGHT) * 100;
            acc += weight;
            const isOpen = openIdx === i;
            return (
              <button
                key={step.label}
                type="button"
                onClick={() => setOpenIdx((o) => (o === i ? null : i))}
                className={`flex w-full items-center gap-3 rounded border px-3 py-2 text-left text-brain-sm transition ${
                  isOpen ? 'border-accent bg-accent-soft' : 'border-hairline bg-canvas hover:bg-subtle'
                }`}
              >
                <span className="w-[12px] shrink-0 font-mono text-brain-2xs text-muted">{i + 1}</span>
                <span className="w-[150px] shrink-0 truncate font-mono text-brain-xs text-ink">{step.label}</span>
                <span className="relative h-3 flex-1 rounded" style={{ background: 'var(--color-hairline)' }}>
                  <span
                    className="absolute top-0 bottom-0 rounded"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: KIND_COLOR[kind] }}
                  />
                </span>
              </button>
            );
          })}
          <p className="pt-2 text-brain-2xs text-muted">
            示意流程 · 各步为管道结构说明与示意占比，非逐步实时耗时；唯一实测值为总耗时与结果数。
          </p>
        </div>

        <div className="rounded-md border border-hairline bg-canvas p-4 lg:col-span-4">
          {openIdx != null ? (
            <>
              <div className="type-mono-tiny mb-2">// SPAN DETAIL</div>
              <div className="font-mono text-brain-sm text-accent">{RETRIEVAL_STEPS[openIdx].label}</div>
              <p className="mt-2 text-brain-xs leading-relaxed text-ink-soft">{RETRIEVAL_STEPS[openIdx].desc}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-brain-2xs">
                <div>
                  <div className="font-mono uppercase text-muted">kind</div>
                  <div className="mt-0.5 font-mono text-ink">{KIND_LABEL[WATERFALL_WEIGHTS[openIdx].kind]}</div>
                </div>
                <div>
                  <div className="font-mono uppercase text-muted">token</div>
                  <div
                    className="mt-0.5 font-mono"
                    style={{ color: BURNS_TOKEN[WATERFALL_WEIGHTS[openIdx].kind] ? 'var(--color-coral)' : 'var(--color-ok)' }}
                  >
                    {BURNS_TOKEN[WATERFALL_WEIGHTS[openIdx].kind] ? '烧 · 调用模型' : '不烧 · 纯 DB/CPU'}
                  </div>
                </div>
                <div>
                  <div className="font-mono uppercase text-muted">in</div>
                  <div className="mt-0.5 font-mono text-ink">{RETRIEVAL_STEPS[openIdx].in}</div>
                </div>
                <div>
                  <div className="font-mono uppercase text-muted">out</div>
                  <div className="mt-0.5 font-mono text-ink">{RETRIEVAL_STEPS[openIdx].out}</div>
                </div>
              </div>
              <p className="mt-3 text-brain-2xs text-muted">
                kind/token 为结构分类（llm 步骤过模型；db/cpu 步骤纯 Postgres 或本地计算），非本次查询的实测计费。
              </p>
            </>
          ) : (
            <p className="text-brain-xs text-muted">点击左侧任意一步查看结构说明。</p>
          )}
        </div>
      </div>

      {lastQuery.trace && (
        <div className="mt-4 rounded-md border border-hairline bg-canvas p-4">
          <div className="type-mono-tiny mb-2">// 查询诊断 · 真实结果（非示意）</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-brain-2xs sm:grid-cols-3">
            <div>
              <span className="font-mono uppercase text-muted">cache</span>{' '}
              <span className="font-mono text-ink">{lastQuery.trace.cache_status}</span>
            </div>
            <div>
              <span className="font-mono uppercase text-muted">intent</span>{' '}
              <span className="font-mono text-ink">{lastQuery.trace.intent ?? '—'}</span>
            </div>
            <div>
              <span className="font-mono uppercase text-muted">vector</span>{' '}
              <span className="font-mono text-ink">{lastQuery.trace.vector_enabled ? 'on' : 'off'}</span>
            </div>
            <div>
              <span className="font-mono uppercase text-muted">expansion</span>{' '}
              <span className="font-mono text-ink">{lastQuery.trace.expansion_applied ? 'on' : 'off'}</span>
            </div>
            <div>
              <span className="font-mono uppercase text-muted">autocut</span>{' '}
              <span className="font-mono text-ink">{lastQuery.trace.autocut ? 'on' : 'off'}</span>
            </div>
            <div>
              <span className="font-mono uppercase text-muted">detail</span>{' '}
              <span className="font-mono text-ink">{lastQuery.trace.detail_resolved ?? '—'}</span>
            </div>
          </div>
          <p className="mt-2 text-brain-2xs text-muted">
            以上为本次查询的真实诊断字段（HybridSearchMeta），非上方瀑布图的示意占比——没有逐步实时耗时数据。
          </p>
        </div>
      )}
    </section>
  );
}
