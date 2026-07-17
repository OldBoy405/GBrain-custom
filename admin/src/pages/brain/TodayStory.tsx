import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Bookmark,
  FileText,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import {
  READING_NOTE_CODE,
  WECHAT_MESSAGES,
  JIKE_BOOKMARK,
  ASK_RESULT_HITS,
  ASK_ANSWER,
  STORY_BEATS,
} from './today-static';

const ICON_MAP = {
  'file-text': FileText,
  'message-circle': MessageCircle,
  bookmark: Bookmark,
} as const;

function ReadingNoteCard() {
  return (
    <div className="rounded-2xl border-2 bg-elevated p-5 shadow-2xl" style={{ borderColor: 'var(--color-amber)66' }}>
      <div className="mb-3 flex items-center gap-2.5 border-b border-hairline pb-3">
        <FileText size={16} style={{ color: 'var(--color-amber)' }} aria-hidden />
        <span className="text-brain-caption font-medium text-ink">读书笔记 · Obsidian</span>
        <span className="ml-auto font-mono text-brain-2sm text-muted">2026-02-08</span>
      </div>
      <div className="mb-3 text-brain-lg font-medium text-ink">《长期记忆系统设计》读书笔记</div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-hairline bg-canvas p-3 font-mono text-brain-code leading-relaxed text-ink-soft">
        {READING_NOTE_CODE}
      </pre>
    </div>
  );
}

function WechatCard() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 bg-elevated p-5 shadow-2xl" style={{ borderColor: 'var(--color-accent)66' }}>
        <div className="mb-3 flex items-center gap-2.5 border-b border-hairline pb-3">
          <MessageCircle size={16} className="text-accent" aria-hidden />
          <span className="text-brain-caption font-medium text-ink">微信群 · 工程师群</span>
          <span className="ml-auto font-mono text-brain-2sm text-muted">2026-04-03 12:47</span>
        </div>
        <div className="mb-3 text-brain-lg font-medium text-ink">技术讨论 · typed-link 自动建联</div>
        <div className="brain-chat-scroll space-y-2 overflow-hidden">
          {WECHAT_MESSAGES.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-lg border px-3 py-1.5 text-brain-sm leading-snug ${
                m.self
                  ? 'ml-auto border-accent/30 bg-accent-soft text-ink'
                  : 'mr-auto border-hairline bg-canvas text-ink-soft'
              }`}
            >
              <span className="mr-1.5 font-mono text-brain-xs text-muted">{m.who}:</span>
              {m.text}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-elevated/70 px-3 py-2 backdrop-blur-sm">
        <span className="mr-1 shrink-0 font-mono text-brain-xs text-muted">// 已沉淀历史</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-md border bg-canvas px-2 py-1 text-brain-2sm text-ink-soft"
          style={{ borderColor: 'var(--color-amber)55' }}
        >
          <FileText size={11} style={{ color: 'var(--color-amber)' }} aria-hidden />
          <span className="font-mono text-brain-xs text-muted">2月已沉淀</span>
          <span className="truncate text-ink">读书笔记 · typed-link</span>
        </span>
      </div>
    </div>
  );
}

function JikeCard() {
  const b = JIKE_BOOKMARK;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 bg-elevated p-5 shadow-2xl" style={{ borderColor: 'var(--color-coral)66' }}>
        <div className="mb-3 flex items-center gap-2.5 border-b border-hairline pb-3">
          <Bookmark size={16} className="text-coral" aria-hidden />
          <span className="text-brain-caption font-medium text-ink">{b.sourceLabel}</span>
          <span className="ml-auto font-mono text-brain-2sm text-muted">{b.date}</span>
        </div>
        <div className="mb-3 text-brain-lg font-medium text-ink">{b.title}</div>
        <div className="space-y-3">
          <div
            className="rounded-lg border border-hairline bg-canvas p-3 text-brain-sm leading-relaxed text-ink-soft"
            dangerouslySetInnerHTML={{ __html: b.excerpt }}
          />
          <div className="flex items-center justify-between text-brain-2sm">
            <span className="truncate font-mono text-muted">{b.sourceUrl}</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-coral/30 bg-coral/10 px-2.5 py-1 font-medium text-coral">
              <Bookmark size={11} aria-hidden />
              {b.statusLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-elevated/70 px-3 py-2 backdrop-blur-sm">
        <span className="mr-1 shrink-0 font-mono text-brain-xs text-muted">// 已沉淀历史</span>
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-canvas px-2 py-1 text-brain-2sm text-ink-soft" style={{ borderColor: 'var(--color-amber)55' }}>
          <FileText size={11} style={{ color: 'var(--color-amber)' }} aria-hidden />
          <span className="font-mono text-brain-xs text-muted">2月已沉淀</span>
          <span className="brain-chip-truncate truncate text-ink">读书笔记 · typed-link</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-canvas px-2 py-1 text-brain-2sm text-ink-soft" style={{ borderColor: 'var(--color-accent)55' }}>
          <MessageCircle size={11} className="text-accent" aria-hidden />
          <span className="font-mono text-brain-xs text-muted">4月已沉淀</span>
          <span className="brain-chip-truncate truncate text-ink">微信群讨论 · typed-link</span>
        </span>
      </div>
    </div>
  );
}

function AskResultCard({ onTryQuery }: { onTryQuery: () => void }) {
  return (
    <div className="space-y-4 rounded-2xl border border-accent/40 bg-elevated p-5 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-hairline pb-3">
        <div className="h-2 w-2 rounded-full bg-coral" />
        <div className="h-2 w-2 rounded-full bg-amber" />
        <div className="h-2 w-2 rounded-full bg-ok" />
        <span className="ml-2 font-mono text-brain-2sm text-muted">localhost:3131/ask</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 font-mono text-brain-2xs text-accent">
          <Sparkles size={9} aria-hidden />
          {ASK_ANSWER.pipelineLabel}
        </span>
      </div>
      <div className="rounded-lg border border-hairline bg-canvas p-3">
        <div className="mb-1 font-mono text-brain-xs text-muted">// 你的查询</div>
        <div className="text-brain-base leading-snug text-ink">{ASK_ANSWER.queryText}</div>
      </div>
      <div className="space-y-3">
        <div className="font-mono text-brain-2sm text-accent">// GBrain 答复</div>
        <p className="text-brain-base leading-brain-prose text-ink-soft" dangerouslySetInnerHTML={{ __html: ASK_ANSWER.intro }} />
        <div className="space-y-2">
          {ASK_RESULT_HITS.map((h) => {
            const Icon = ICON_MAP[h.icon];
            return (
              <div
                key={h.path}
                className="flex gap-3 rounded-lg border bg-canvas p-2.5"
                style={{ borderColor: `${h.color}55`, borderLeftWidth: 3 }}
              >
                <div className="flex flex-col items-center pt-0.5">
                  <Icon size={12} style={{ color: h.color }} aria-hidden />
                  <span className="mt-1 whitespace-nowrap font-mono text-brain-2xs text-muted">{h.date}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate font-mono text-brain-xs text-muted">{h.path}</div>
                  <div className="text-brain-code leading-snug text-ink-soft">{h.text}</div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="border-t border-hairline pt-2 text-brain-caption leading-[1.8] text-ink-soft">
          <strong className="text-ink">演变路径</strong>：{ASK_ANSWER.evolutionPath}
        </p>
        <div className="flex flex-wrap gap-1.5 border-t border-hairline pt-3">
          <span className="mr-1 font-mono text-brain-xs text-muted">主要命中算子：</span>
          {ASK_ANSWER.operators.map((t) => (
            <span key={t} className="inline-flex rounded border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-mono text-brain-xs text-accent">
              {t}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onTryQuery}
          className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-accent px-4 py-2 text-brain-base font-medium text-inverse transition hover:opacity-90"
        >
          立即体验 · 跑一次真实查询
        </button>
      </div>
    </div>
  );
}

function StoryCard({ index, onTryQuery }: { index: number; onTryQuery: () => void }) {
  switch (index) {
    case 0: return <ReadingNoteCard />;
    case 1: return <WechatCard />;
    case 2: return <JikeCard />;
    default: return <AskResultCard onTryQuery={onTryQuery} />;
  }
}

function useActiveBeatIndex(sectionCount: number, enabled: boolean) {
  const beatRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const nodes = beatRefs.current.filter(Boolean) as HTMLElement[];
    if (nodes.length === 0) return;

    const ratios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.beatIndex);
          ratios.set(index, entry.intersectionRatio);
        }
        let bestIndex = 0;
        let bestRatio = -1;
        for (const [index, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        }
        if (bestRatio > 0) setActiveIndex(bestIndex);
      },
      { threshold: [0, 0.15, 0.35, 0.55, 0.75, 1], rootMargin: '-30% 0px -30% 0px' },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sectionCount, enabled]);

  return { beatRefs, activeIndex };
}

function StickyStoryCards({
  activeIndex,
  onTryQuery,
}: {
  activeIndex: number;
  onTryQuery: () => void;
}) {
  return (
    <div className="brain-sticky-panel">
      <div className="relative mx-auto w-full max-w-brain-card">
        {STORY_BEATS.map((beat, i) => {
          // 只挂载当前及相邻卡片：非激活卡含大段 pre/聊天气泡，全量常驻 DOM 太重；
          // activeIndex 随滚动逐格变化，±1 足够保留交叉淡入过渡。
          if (Math.abs(i - activeIndex) > 1) return null;
          return (
            <div
              key={beat.index}
              aria-hidden={activeIndex !== i}
              className={`transition-opacity duration-500 ease-in-out ${
                activeIndex === i
                  ? 'relative z-10 opacity-100'
                  : 'pointer-events-none absolute inset-x-0 top-0 opacity-0'
              }`}
            >
              <StoryCard index={i} onTryQuery={onTryQuery} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TodayStory({
  visible,
  sectionRef,
  onTryQuery,
}: {
  visible: boolean;
  sectionRef: RefObject<HTMLElement | null>;
  onTryQuery: () => void;
}) {
  const { beatRefs, activeIndex } = useActiveBeatIndex(STORY_BEATS.length, visible);

  // 由调用方懒挂载（{showStory && <TodayStory/>}）；mount 后把自己滚入视口，
  // 无需调用方在 setState 后手动 rAF 追 ref。
  useEffect(() => {
    if (!visible) return;
    sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [visible, sectionRef]);

  if (!visible) return null;

  return (
    <section ref={sectionRef} id="screen-2-story" className="relative border-b border-hairline bg-elevated">
      <div className="brain-section py-20">
        <div className="mb-14 text-center">
          <div className="type-mono-tiny mb-2">// 屏 2 · 跨平台时间线 · 真实场景</div>
          <h2 className="type-story-section text-ink">3个月前的笔记 → 今天的精准回答</h2>
          <p className="mx-auto mt-3 max-w-2xl text-brain-md leading-relaxed text-ink-soft">
            滚动看 GBrain 怎么把跨平台 fragment（论文笔记 · 微信群聊 · 即刻收藏）拼成一条完整的时间线。
          </p>
        </div>

        <div className="grid lg:grid-cols-2 lg:gap-10">
          <div className="hidden lg:block">
            <StickyStoryCards activeIndex={activeIndex} onTryQuery={onTryQuery} />
          </div>

          <div className="space-y-[60vh] py-[20vh]">
            {STORY_BEATS.map((beat, i) => (
              <article
                key={beat.index}
                ref={(el) => { beatRefs.current[i] = el; }}
                data-beat-index={i}
              >
                <div className="mb-8 lg:hidden">
                  <StoryCard index={i} onTryQuery={onTryQuery} />
                </div>
                <div>
                  <div className="type-mono-tiny mb-2 text-accent">{beat.kicker}</div>
                  <h3 className="type-story-beat mb-3 text-ink">{beat.title}</h3>
                  <p className="whitespace-pre-line text-brain-lg leading-brain-prose text-ink-soft">{beat.narrative}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-20 border-t border-hairline pt-10 text-center">
          <p className="type-story-quote mx-auto max-w-3xl text-ink">
            这是 ChatGPT / RAG 玩具 / mem0 都做不到的——
            <br />
            因为它们不知道<strong className="text-accent">你过去</strong>。
          </p>
        </div>
      </div>
    </section>
  );
}
