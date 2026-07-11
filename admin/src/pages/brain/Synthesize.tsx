import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GitMerge, Layers } from 'lucide-react';
import { callMcp } from '../../lib/mcp-client';
import { useConflicts } from '../../lib/useConflicts';
import { parseHash } from '../../routes';
import type {
  ConflictGroup,
  CompileTruthResult,
  CompileDiffRow,
  AdoptCompiledTruthResult,
} from '../../lib/op-types';
import { PageHeader, AsyncState, Badge, WhyButton, type BadgeTone } from '../../components/brain';

/** diff op → 色调映射（keep 中性 / merge 琥珀 / add 绿 / remove 珊瑚）。 */
const DIFF_TONE: Record<CompileDiffRow['op'], BadgeTone> = {
  keep: 'muted',
  merge: 'amber',
  add: 'ok',
  remove: 'coral',
};

const DIFF_TONE_VAR: Record<CompileDiffRow['op'], string> = {
  keep: '--color-muted',
  merge: '--color-amber',
  add: '--color-ok',
  remove: '--color-coral',
};

/** Faint op-colored row background so the diff reads at a glance, not just via the badge. */
function diffRowStyle(op: CompileDiffRow['op']): CSSProperties {
  const color = `var(${DIFF_TONE_VAR[op]})`;
  return { background: `color-mix(in srgb, ${color} 6%, transparent)` };
}

function initialTopic(): string {
  return parseHash(window.location.hash).query.get('topic')?.trim() ?? '';
}

/**
 * 真理沉淀 · Compiled Truth 工作台。
 * 检测冲突 markdown 组 → 选一组 → Compile 合并 → 看 keep/merge/add/remove diff
 * → 采纳进 compiled_truth。消费 find_conflicts / compile_truth / adopt_compiled_truth
 * 三个后端 op。这一页对齐案例样机（无自由提问框——综合对象由冲突检测自动产出）；
 * 需要"打字提问 → 综合作答"的场景在「精准检索」页（query + think）里。
 */
export function Synthesize() {
  const [topic, setTopic] = useState(initialTopic);
  useEffect(() => {
    const applyHash = () => {
      setTopic(parseHash(window.location.hash).query.get('topic')?.trim() ?? '');
    };
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);
  const { groups, note, loading, error, reload } = useConflicts(topic || undefined);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compiled, setCompiled] = useState<CompileTruthResult | null>(null);
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  const [adoptSlug, setAdoptSlug] = useState('');
  const [adoptLoading, setAdoptLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 默认选中第一组。
  useEffect(() => {
    if (!selectedId && groups.length > 0) setSelectedId(groups[0].id);
  }, [groups, selectedId]);

  const selected: ConflictGroup | undefined = useMemo(
    () => groups.find((g) => g.id === selectedId),
    [groups, selectedId],
  );

  // 切换组时清空编译产出。
  useEffect(() => {
    setCompiled(null);
    setCompileError(null);
    setActionNotice(null);
    setActionError(null);
    // 采纳目标 slug 的默认建议：compiled/<topic slug 化>。
    if (selected) {
      const t = selected.topic
        .toLowerCase()
        .replace(/[^a-z0-9一-龥]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setAdoptSlug(`compiled/${t || 'topic'}`);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const runCompile = async () => {
    if (!selected) return;
    setCompileLoading(true);
    setCompileError(null);
    setCompiled(null);
    try {
      const r = await callMcp<CompileTruthResult>('compile_truth', {
        slugs: selected.members.map((m) => m.slug),
        topic: selected.topic,
      });
      setCompiled(r);
    } catch (e) {
      setCompileError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompileLoading(false);
    }
  };

  const runAdopt = async () => {
    if (!compiled || !adoptSlug.trim()) return;
    setAdoptLoading(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const r = await callMcp<AdoptCompiledTruthResult>('adopt_compiled_truth', {
        slug: adoptSlug.trim(),
        compiled_markdown: compiled.compiled_markdown,
        sources: compiled.sources,
      });
      setActionNotice(`已采纳 → ${r.slug}（${r.status}）`);
      void reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdoptLoading(false);
    }
  };

  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 合并 · SYNTHESIZE"
        icon={<Layers size={26} className="text-node-synthesis" />}
        title="Compiled Truth 工作台"
        subtitle={
          <span className="inline leading-relaxed">
             GBrain 检测到 {groups.length} 组潜在冲突 markdown · 选一组 → Compile → 看 diff → 采纳进 compiled_truth。
            <WhyButton topic="compiled-truth-cache" className="ml-1 align-middle" />
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* 左：冲突组列表 */}
        <div className="space-y-2 lg:col-span-4">
          <div className="type-mono-tiny mb-2">// 冲突组 · {groups.length} 个</div>
          <AsyncState
            loading={loading}
            error={error}
            empty={groups.length === 0}
            emptyText={
              note
                ? '暂无冲突组：可运行 `gbrain eval suspected-contradictions` 生成矛盾探针，或从「内容入库」的合并中条目进入，或在地址栏加 `?topic=` 实时聚类。'
                : '暂无冲突组。传入 ?topic= 可实时聚类。'
            }
          />
          {groups.map((g) => {
            const active = g.id === selectedId;
            return (
              <button
                key={g.id}
                data-testid={`conflict-g-${g.id}`}
                onClick={() => setSelectedId(g.id)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  active ? 'border-emphasis bg-accent-soft/40' : 'border-hairline bg-surface hover:bg-subtle'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-brain-md font-medium leading-snug text-ink">{g.topic}</div>
                  {g.severity && <Badge tone="contra">{g.severity}</Badge>}
                </div>
                <div className="mt-1 type-mono-tiny text-muted">
                  {g.members.length} 份冲突 markdown · {g.source === 'probe' ? '探针' : '聚类'}
                </div>
              </button>
            );
          })}
        </div>

        {/* 右：候选 + 编译产出 */}
        <div className="space-y-4 lg:col-span-8">
          {selected && (
            <section className="rounded-lg border border-hairline bg-surface p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <div className="type-mono-tiny mb-1">// 候选 markdown · {selected.members.length} 份</div>
                  <h2 className="type-serif text-[18px] font-semibold text-ink">{selected.topic}</h2>
                </div>
                <button
                  data-testid="compile-button"
                  onClick={runCompile}
                  disabled={compileLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-node-synthesis px-4 py-2 text-brain-md font-medium text-inverse transition hover:opacity-90 disabled:opacity-50"
                >
                  <GitMerge size={15} /> {compileLoading ? '编译中…' : 'Compile'}
                </button>
              </div>
              <div className="space-y-2">
                {selected.members.map((m) => (
                  <div key={m.slug} className="rounded border border-hairline bg-canvas p-3">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-brain-sm text-accent">{m.slug}</span>
                      <span className="font-mono text-brain-xs text-muted">{m.updated_at.slice(0, 10)}</span>
                    </div>
                    <div className="text-brain-md leading-snug text-ink">{m.title}</div>
                    <div className="mt-1 font-mono text-brain-xs text-muted">{`{type: ${m.type}}`}</div>
                    <p className="mt-2 text-brain-sm italic leading-relaxed text-ink-soft">{m.excerpt}</p>
                  </div>
                ))}
              </div>
              {compileError && <div className="mt-3 text-brain-sm text-contra">{compileError}</div>}
            </section>
          )}

          {compiled && (
            <section data-testid="compile-output" className="rounded-lg border border-emphasis/30 bg-accent-soft/30 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="type-mono-tiny text-accent">// COMPILED OUTPUT</div>
                <div className="flex items-center gap-2">
                  <input
                    value={adoptSlug}
                    onChange={(e) => setAdoptSlug(e.target.value)}
                    placeholder="compiled/…"
                    className="w-56 rounded-md border border-hairline bg-surface px-2.5 py-1.5 font-mono text-brain-sm text-ink outline-none focus:border-emphasis"
                  />
                  <button
                    data-testid="adopt-button"
                    onClick={runAdopt}
                    disabled={adoptLoading || !adoptSlug.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-ok px-3 py-1.5 text-brain-sm font-medium text-inverse transition hover:opacity-90 disabled:opacity-50"
                  >
                    {adoptLoading ? '采纳中…' : '采纳 → compiled_truth 表'}
                  </button>
                </div>
              </div>

              <pre className="mb-4 whitespace-pre-wrap rounded-md border border-hairline bg-surface p-3 font-mono text-brain-sm leading-relaxed text-ink">
                {compiled.compiled_markdown || '（空）'}
              </pre>

              {compiled.diff.length > 0 && (
                <>
                  <div className="type-mono-tiny mb-2">// DIFF · keep / merge / add / remove</div>
                  <div className="space-y-1.5">
                    {compiled.diff.map((d, i) => (
                      <div
                        key={i}
                        style={diffRowStyle(d.op)}
                        className="flex gap-2 rounded border border-hairline px-2.5 py-1.5 text-brain-sm leading-snug"
                      >
                        <span className="shrink-0">
                          <Badge tone={DIFF_TONE[d.op]}>{d.op}</Badge>
                        </span>
                        <span className="text-ink-soft">{d.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {compiled.warnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-hairline bg-surface px-3 py-2 text-brain-sm text-muted">
                  {compiled.warnings.join('；')}
                </div>
              )}
              {compiled.model_used && (
                <div className="mt-2 type-mono-tiny text-muted">{compiled.model_used}</div>
              )}

              {actionNotice && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-brain-sm text-ok">
                  <span>{actionNotice}</span>
                  {selected && (
                    <a
                      href={`#/ask?q=${encodeURIComponent(selected.topic)}`}
                      className="rounded-md border border-hairline bg-surface px-2 py-0.5 text-accent hover:bg-subtle"
                    >
                      去精确检索验证 boost →
                    </a>
                  )}
                </div>
              )}
              {actionError && <div className="mt-3 text-brain-sm text-contra">{actionError}</div>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
