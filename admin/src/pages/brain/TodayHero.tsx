import {
  ArrowDown,
  ArrowRight,
  Inbox,
  Moon,
  Network,
  Search,
  Sparkles,
} from 'lucide-react';
import { HERO_STEPS } from './today-static';

const STEP_ICONS = {
  inbox: Inbox,
  network: Network,
  search: Search,
  moon: Moon,
  sparkles: Sparkles,
} as const;

export function TodayHero({
  onTryQuery,
  onHowItWorks,
}: {
  onTryQuery: () => void;
  onHowItWorks: () => void;
}) {
  return (
    <section className="relative flex min-h-[min(100vh,56.25rem)] items-center overflow-hidden border-b border-hairline bg-dot-grid">
      <div className="brain-section grid w-full items-center gap-10 py-16 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-brain-sm tracking-wide text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={11} className="text-accent" aria-hidden />
              GBrain 工程台
            </span>
            <span className="text-muted">·</span>
            <span>17,234 篇 markdown · 12 个月生产验证</span>
            <span
              className="rounded border border-hairline px-1.5 py-0.5 text-brain-2xs text-muted"
              title="Hero 展示数字为示例，下方「运营概览」才是本机 Tier1 实时数据"
            >
              演示数据
            </span>
          </div>

          <h1 className="type-hero-title text-ink">
            <span className="block">你过去写过、看过、说过的一切</span>
            <span className="block">都自动入库</span>
            <span className="block text-accent">问它任何事，它给精准答案</span>
          </h1>

          <p className="max-w-2xl text-brain-lg leading-brain-prose text-ink-soft">
            GBrain 工程台 · 基于 YC 总裁 Garry Tan 开源的「Markdown 第二大脑」。
            <br className="hidden sm:block" />
            跟 ChatGPT 内置记忆不一样——它把你过去的笔记 / 邮件 / 群讨论 / 公众号文章 / 即刻收藏全部沉淀成 markdown
            文件，建好 typed-link 关系图，索引进 Postgres。
            <br className="hidden sm:block" />
            你问它的时候，它不是凭空猜，而是从你<strong className="text-ink">过去 12 个月所有内容</strong>里找精准答案。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onTryQuery}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-accent px-5 py-3 text-brain-md font-medium text-inverse shadow-sm transition hover:opacity-90"
            >
              <Sparkles size={15} aria-hidden />
              立即体验 · 跑一次真实查询
              <ArrowRight size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onHowItWorks}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-elevated px-4 py-3 text-brain-base text-ink-soft transition hover:bg-subtle hover:text-ink"
            >
              先看看它怎么工作
              <ArrowDown size={13} aria-hidden />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="space-y-0">
            {HERO_STEPS.map((step, i) => {
              const Icon = STEP_ICONS[step.icon];
              const isLast = i === HERO_STEPS.length - 1;
              return (
                <div key={step.title}>
                  <div
                    className="flex items-start gap-3 rounded-lg border border-hairline bg-elevated p-3.5 transition hover:border-emphasis"
                    style={{ background: step.bg }}
                  >
                    <div
                      className="type-serif grid h-10 w-10 shrink-0 place-items-center rounded-md text-brain-2xl font-semibold text-inverse"
                      style={{ background: step.color }}
                    >
                      {step.glyph}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon size={13} style={{ color: step.color }} aria-hidden />
                        <span className="text-brain-base font-medium text-ink">{step.title}</span>
                      </div>
                      <p className="mt-0.5 text-brain-sm leading-relaxed text-ink-soft">{step.desc}</p>
                    </div>
                  </div>
                  {!isLast && <div className="brain-step-connector" aria-hidden />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
