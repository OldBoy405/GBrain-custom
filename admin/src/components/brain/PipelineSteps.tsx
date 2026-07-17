import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RETRIEVAL_STEPS as STEPS, describeStepTrace } from '../../lib/retrieval-steps';
import { GBRAIN_SOURCE_REPO } from '../../lib/why-topics';
import type { QueryTrace } from '../../lib/op-types';

/**
 * 12 步混合检索管道的可视化。
 *
 * 诚实声明（重要）：MCP 的 `query` 只返回 SearchResult[] + 可选 `trace`（`trace: true`
 * 时后端算好的 HybridSearchMeta 诊断），**不返回逐步计时或候选数**。因此：
 *  - 逐步的名称/描述/入→出/源码路径 是管道**结构说明**（对齐 src/core/search/* 真实模块），
 *    非实时数据；进行中的点亮是**状态机驱动的示意动画**；
 *  - 展开后如出现"本次实测：…"一行，那是本次查询真实的 `QueryTrace` 字段（意图 / 缓存命中 /
 *    是否触发扩展或截断…），不是编造的——只在 `describeStepTrace` 里有对应字段时才显示；
 *  - 唯一真实的"耗时"数字仍然是 `totalMs`（前端实测的端到端往返耗时），由 Ask 页传入。
 *  - 卡片样式对齐 `docs/前端案例/03.GBrain _ 项目案例_精确检索.mhtml`，但那份案例稿里每步旁的
 *    毫秒数是静态案例数据，本组件不copy（会违反上面这条诚实声明），逐步耗时保持不展示。
 *
 * 步骤数据本身在 `lib/retrieval-steps.ts` 里共享给 `TraceWaterfall.tsx`（Ask 页的
 * "最近一次 ask" 瀑布图复用同一套结构说明，避免两处定义漂移）。
 *
 * 面板自带 `sticky top-4 max-h-[80vh] overflow-y-auto`：检索栈卡片列表在自己的高度里
 * 独立上下滚动 —— 页面向上滚动时本面板跟随滚动，贴顶（top-4）后固定，内部列表继续用自己的
 * 滚动条翻页，不随页面主体滚动条联动。这依赖 Ask.tsx 里网格容器的 `lg:items-start`
 * （否则 grid 默认 `align-items: stretch` 会把两栏拉成等高，sticky 计算随之失真）。
 */

export function PipelineSteps({
  running,
  done,
  totalMs,
  trace,
}: {
  running: boolean;
  done: boolean;
  totalMs?: number;
  /** 本次查询的真实 QueryTrace（`query` op 传 `trace: true` 时后端返回）；用于展开面板里的"本次实测"行 */
  trace?: QueryTrace;
}) {
  const [cur, setCur] = useState(-1);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (running) {
      setCur(0);
      const id = setInterval(() => setCur((c) => Math.min(c + 1, STEPS.length - 1)), 160);
      return () => clearInterval(id);
    }
    setCur(done ? STEPS.length : -1);
  }, [running, done]);

  const completed = Math.min(Math.max(cur, 0), STEPS.length);

  return (
    <div
      data-testid="retrieval-stack"
      className="sticky top-4 max-h-[80vh] overflow-hidden overflow-y-auto rounded-lg border border-hairline bg-elevated"
    >
      <header className="border-b border-hairline bg-subtle px-4 py-3">
        <div className="type-mono-tiny">// 检索栈 · {STEPS.length} 步</div>
        <div className="mt-1 text-brain-sm text-ink">
          {done ? '完成' : '进行'} {completed} / {STEPS.length}
          {done && typeof totalMs === 'number' && (
            <span className="text-muted"> · 总耗时 ~{totalMs}ms（实测端到端）</span>
          )}
        </div>
      </header>

      <ol className="list-none divide-y divide-hairline p-0 m-0">
        {STEPS.map((s, i) => {
          const isDone = i < cur;
          const isActive = i === cur && running;
          const lit = isDone || isActive;
          const isOpen = openIdx === i;
          const traceLine = describeStepTrace(i, trace);
          return (
            <li key={s.label}>
              <button
                type="button"
                data-testid={`step-${i + 1}`}
                onClick={() => setOpenIdx((o) => (o === i ? null : i))}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-subtle"
              >
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-brain-2sm font-semibold text-inverse"
                  style={{ background: lit ? 'var(--color-accent)' : 'var(--color-emphasis)' }}
                >
                  {i + 1}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-brain-sm"
                  style={{ color: lit ? 'var(--color-ink)' : 'var(--color-muted)' }}
                >
                  {s.label}
                </span>
                <ChevronDown
                  aria-hidden
                  size={14}
                  className="mt-1 shrink-0 text-muted transition-transform"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-3">
                  <div className="pl-9">
                    <div className="text-brain-2sm leading-snug text-ink-soft">{s.desc}</div>

                    <div className="mt-1.5 font-mono text-brain-xs text-muted">
                      入：{s.in}
                      <span className="mx-1.5">→</span>
                      出：<span className="text-accent">{s.out}</span>
                    </div>

                    {traceLine && (
                      <div className="mt-1.5 font-mono text-brain-xs text-accent">● {traceLine}</div>
                    )}

                    {s.note && <div className="mt-1.5 text-brain-xs text-muted">ⓘ {s.note}</div>}

                    <div className="mt-1.5">
                      <a
                        href={`${GBRAIN_SOURCE_REPO}/${s.source}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-brain-xs text-accent hover:underline"
                      >
                        {s.source}
                      </a>
                      {s.sourceHint && <span className="ml-1.5 text-brain-xs text-muted">· {s.sourceHint}</span>}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="border-t border-hairline px-4 py-2 text-brain-2xs text-muted">
        示意流程 · 逐步为管道结构说明，非逐步实时耗时
      </div>
    </div>
  );
}
