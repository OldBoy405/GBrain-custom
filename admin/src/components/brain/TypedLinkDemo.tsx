import { useMemo, useState } from 'react';
import { extractTypedLinks, DEFAULT_DEMO_TEXT, type ExtractedLink } from '../../lib/typed-link-extract';
import type { GraphNode } from '../../lib/op-types';
import { ForceGraph } from './ForceGraph';
import { WhyButton } from './WhyButton';

/** 抽出的边 → 自包含演示图（不注入真实脑库图，保持真实图为真）。 */
function toGraph(links: ExtractedLink[]): { data: GraphNode[]; root: string } {
  const byId = new Map<string, GraphNode>();
  const ensure = (name: string, type: string) => {
    const existing = byId.get(name);
    if (existing) {
      if (existing.type === 'entity' && type !== 'entity') existing.type = type;
      return existing;
    }
    const node: GraphNode = { slug: name, title: name, type, depth: 0, links: [] };
    byId.set(name, node);
    return node;
  };
  // 粗略类型推断，仅为演示图上色。
  const subjType = (p: string) => (p === 'invested_in' ? 'company' : 'person');
  for (const l of links) {
    const s = ensure(l.subject, subjType(l.predicate));
    ensure(l.object, 'company');
    s.links.push({ to_slug: l.object, link_type: l.predicate });
  }
  return { data: [...byId.values()], root: links[0]?.subject ?? '' };
}

/**
 * Live 抽边演示：粘贴文本 → 前端 4 个动词正则实时抽 typed-link（零 LLM），
 * 结果既列表展示，又渲染成一张自包含的小号演示图。
 */
export function TypedLinkDemo() {
  const [text, setText] = useState(DEFAULT_DEMO_TEXT);
  const [links, setLinks] = useState<ExtractedLink[] | null>(null);

  const graph = useMemo(() => (links && links.length > 0 ? toGraph(links) : null), [links]);

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="type-section-label mb-1 flex flex-wrap items-center gap-2">
        <span>
          // LIVE TYPED-LINK DEMO ·{' '}
          <span className="text-muted">粘贴文本 · 前端 4 个英文动词正则实时抽边 · 零 LLM</span>
        </span>
        <WhyButton topic="typed-link-zero-llm" />
      </div>

      <textarea
        data-testid="typed-link-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-brain-sm text-ink outline-none focus:border-accent"
      />

      <div className="mt-3">
        <button
          type="button"
          data-testid="extract-button"
          onClick={() => setLinks(extractTypedLinks(text))}
          className="rounded-lg bg-accent px-4 py-2 text-brain-md font-medium text-inverse hover:opacity-90"
        >
          Extract
        </button>
      </div>

      {links && (
        <div className="mt-4" data-testid="typed-link-output">
          <div className="type-section-label mb-2">
            // 抽出 {links.length} 条 typed-link · 全部 deterministic
          </div>
          {links.length === 0 ? (
            <div className="text-brain-sm text-muted">未命中动词模式（需专有名词作 subject/object）。</div>
          ) : (
            <>
              <div className="space-y-1">
                {links.map((l, i) => (
                  <div
                    key={`${l.subject}-${l.predicate}-${l.object}-${i}`}
                    className="flex items-center gap-2 rounded border border-hairline bg-elevated px-2.5 py-1.5 text-brain-sm"
                  >
                    <span className="truncate font-mono text-ink">{l.subject}</span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 font-mono text-brain-2sm uppercase"
                      style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                    >
                      --{l.predicate}--&gt;
                    </span>
                    <span className="truncate font-mono text-ink">{l.object}</span>
                    <span className="ml-auto truncate text-brain-2sm italic text-muted">"{l.evidence}"</span>
                  </div>
                ))}
              </div>
              {graph && (
                <div className="mt-3">
                  <div className="type-section-label mb-1 text-muted">演示图 · 前端正则输出（与真实脑库图分离）</div>
                  <ForceGraph
                    data={graph.data}
                    rootSlug={graph.root}
                    onSelect={() => {}}
                    charge={-180}
                    linkDistance={60}
                    centering={0.05}
                    height={240}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
