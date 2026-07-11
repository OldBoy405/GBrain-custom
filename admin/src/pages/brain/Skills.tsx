import { useMemo, useState } from 'react';
import { Search, Sparkles, Wrench } from 'lucide-react';
import { useMcp } from '../../lib/useMcp';
import type { ListSkillsResult, SkillEntry, ListBrainSkillpackResult } from '../../lib/op-types';
import { PageHeader, Badge, AsyncState, WhyButton, useWhy } from '../../components/brain';
import { SkillDetailDrawer } from './SkillDetailDrawer';

// 分类展示顺序对齐设计稿（ingest→enrich→…→meta）；未知 section 追加在后、字母序。
const PREFERRED_SECTION_ORDER = ['ingest', 'enrich', 'brain-ops', 'research', 'publish', 'ops', 'meta'];

// 分类色点/badge 用的调色板（复用 tailwind.css 里图谱节点色板）。不能按案例那样按
// 固定的 ingest/enrich/… 短 slug 做字面量映射 —— 本仓库 skills/RESOLVER.md 的真实
// section 是人类可读标题（"Brain operations"/"Operational"/"Uncategorized"…），
// 与案例的短 slug taxonomy 完全不同，字面量映射会全部落回 muted 灰色（已在真实数据上
// 验证过这个问题）。改为按「本次渲染实际出现的分类列表」里的位置取色 —— 只要分类数
// ≤ 调色板长度（本仓库 7 类，正好打满），保证每类颜色互不相同；哈希取色在分类数较少
// 时反而容易撞色（同样在真实数据上验证过）。
const SECTION_PALETTE = [
  '--color-accent',
  '--color-amber',
  '--color-coral',
  '--color-node-synthesis',
  '--color-node-source',
  '--color-node-entity',
  '--color-node-recent',
];

function colorVarFor(sectionColorIndex: Map<string, number>, section: string): string {
  const idx = sectionColorIndex.get(section);
  return idx === undefined ? 'var(--color-muted)' : `var(${SECTION_PALETTE[idx % SECTION_PALETTE.length]})`;
}

const TOOL_PREVIEW_MAX = 4;

/** 卡片上工具名缩短：`gbrain schema explain` → `explain`，`mcp:foo` → `foo`。 */
function toolCardLabel(tool: string): string {
  const t = tool.trim();
  if (t.startsWith('gbrain ')) {
    const rest = t.slice(7).trim();
    const space = rest.indexOf(' ');
    return space === -1 ? rest : rest.slice(space + 1).trim() || rest;
  }
  if (t.startsWith('mcp:')) return t.slice(4);
  return t;
}

function SkillToolsPreview({
  tools,
  usableCount,
  unavailableCount,
}: {
  tools: string[];
  usableCount: number;
  unavailableCount: number;
}) {
  if (tools.length === 0) return null;
  const preview = tools.slice(0, TOOL_PREVIEW_MAX);
  const truncated = tools.length > TOOL_PREVIEW_MAX;

  return (
    <div
      className="mt-2"
      title={truncated ? tools.map(toolCardLabel).join(', ') : undefined}
    >
      <ul className="m-0 list-none space-y-0.5 p-0 font-mono text-brain-2sm text-ink-soft">
        {preview.map((t) => (
          <li key={t} className="truncate">
            <span className="text-muted">- </span>
            {toolCardLabel(t)}
          </li>
        ))}
        {truncated && (
          <>
            <li className="text-muted">.</li>
            <li className="text-muted">.</li>
            <li className="text-muted">.</li>
          </>
        )}
      </ul>
      <div className="mt-1 text-brain-2sm text-muted">
        工具 {usableCount}/{tools.length} 可用
        {unavailableCount > 0 && <span className="text-contra"> · {unavailableCount} 个受限</span>}
      </div>
    </div>
  );
}

export function Skills() {
  const { data, loading, error } = useMcp<ListSkillsResult>('list_skills', {});
  const skills = data?.skills ?? [];
  const { open: openWhy } = useWhy();

  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  // 按 section 归组 + 计数，用于筛选 pill（含各分类 skill 数）。
  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of skills) counts.set(s.section, (counts.get(s.section) ?? 0) + 1);
    const known = PREFERRED_SECTION_ORDER.filter((k) => counts.has(k));
    const extra = [...counts.keys()].filter((k) => !PREFERRED_SECTION_ORDER.includes(k)).sort();
    return [...known, ...extra].map((value) => ({ value, count: counts.get(value)! }));
  }, [skills]);

  // section → 调色板下标，按 sections 的渲染顺序分配，保证同屏分类色彩互不相同。
  const sectionColorIndex = useMemo(
    () => new Map(sections.map((s, i) => [s.value, i])),
    [sections],
  );

  // 纯前端过滤：section pill + 名/描述/trigger 全文搜索（大小写不敏感）。
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s: SkillEntry) => {
      if (activeSection !== 'all' && s.section !== activeSection) return false;
      if (!q) return true;
      const hay = `${s.name} ${s.description} ${(s.triggers ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [skills, activeSection, query]);

  // list_skills 受 mcp.publish_skills 门控、且需服务端有 skills 目录 —— 两类配置问题都友好降级。
  const gated = error && /publish|disabled|not enabled|skills directory|skills_dir|storage_error/i.test(error);

  const hasSkills = !loading && !error && skills.length > 0;

  // list_brain_skillpack 与 list_skills 共用 mcp.publish_skills 门控 —— 门控态下不重复发起/展示报错。
  const {
    data: packData,
    loading: packLoading,
    error: packError,
  } = useMcp<ListBrainSkillpackResult>('list_brain_skillpack', {}, { enabled: !gated });
  const packs = packData?.packs ?? [];

  const pageTitle = useMemo(() => {
    if (loading) return '— 个 skill · — 个分类';
    return `${skills.length} 个 skill · ${sections.length} 个分类`;
  }, [loading, skills.length, sections.length]);

  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 技能库 · SKILLS"
        icon={<Wrench size={22} strokeWidth={1.75} className="text-accent" aria-hidden />}
        title={pageTitle}
        subtitle={
          <span className="inline leading-relaxed">
            大脑当前暴露的 Skill 目录（list_skills）· Skillify 把临时修复变成可发布技能。
            <WhyButton topic="skillify-permanent-fix" className="ml-1 align-middle" />
          </span>
        }
      />

      {gated ? (
        <div className="rounded-xl border border-hairline bg-surface px-5 py-8 text-center text-brain-base text-ink-soft">
          技能目录未通过 MCP 暴露（需开启发布并配置 skills 目录）：
          <div className="mt-2 font-mono text-brain-sm text-muted">gbrain config set mcp.publish_skills true</div>
          <div className="mt-1 font-mono text-brain-sm text-muted">gbrain config set mcp.skills_dir &lt;path&gt;</div>
        </div>
      ) : (
        <>
          <AsyncState loading={loading} error={error} empty={skills.length === 0} emptyText="暂无技能。" />

          {hasSkills && (
            <>
              <div className="mb-4 rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      aria-hidden
                    />
                    <input
                      type="search"
                      data-testid="skills-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索 skill 名 / 描述 / trigger…"
                      aria-label="搜索技能"
                      className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-9 pr-3 text-brain-base text-ink transition placeholder:text-muted focus:border-accent focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="skillify-button"
                    onClick={() => openWhy('skillify-permanent-fix')}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-brain-base font-medium text-inverse transition hover:opacity-90"
                  >
                    <Sparkles size={14} aria-hidden />
                    Skillify
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="按分类过滤">
                  {[{ value: 'all', count: skills.length }, ...sections].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setActiveSection(o.value)}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-brain-xs transition ${
                        activeSection === o.value
                          ? 'border-accent text-accent'
                          : 'border-hairline text-muted hover:border-emphasis hover:text-ink-soft'
                      }`}
                      style={{ background: activeSection === o.value ? 'var(--color-accent-soft)' : 'transparent' }}
                    >
                      {o.value !== 'all' && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: colorVarFor(sectionColorIndex, o.value) }}
                          aria-hidden
                        />
                      )}
                      {o.value} <span className="opacity-60">({o.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-hairline bg-surface px-5 py-8 text-center text-brain-base text-muted">
                  无匹配技能。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="skills-grid">
                  {filtered.map((s) => (
                    <div
                      key={s.name}
                      onClick={() => setSelectedSkill(s.name)}
                      className="cursor-pointer rounded-xl border border-hairline bg-surface p-5 transition hover:border-emphasis"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-brain-lg font-medium text-ink">{s.name}</div>
                        <div className="flex gap-1">
                          {s.mutating && <Badge tone="amber">mutating</Badge>}
                          {s.writes_pages && <Badge tone="coral">writes</Badge>}
                        </div>
                      </div>
                      <div className="mt-1">
                        <span
                          className="inline-block rounded-full border px-2 py-0.5 text-brain-2sm font-medium uppercase tracking-wider"
                          style={{
                            color: colorVarFor(sectionColorIndex, s.section),
                            borderColor: colorVarFor(sectionColorIndex, s.section),
                            background: `color-mix(in srgb, ${colorVarFor(sectionColorIndex, s.section)} 10%, transparent)`,
                          }}
                        >
                          {s.section}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-brain-base leading-relaxed text-ink-soft">{s.description}</p>
                      {s.triggers?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {s.triggers.slice(0, 4).map((t) => (
                            <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-brain-2sm text-accent">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {s.tools?.length > 0 && (
                        <SkillToolsPreview
                          tools={s.tools}
                          usableCount={s.usable_tools.length}
                          unavailableCount={s.unavailable_tools?.length ?? 0}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="mt-8">
            <div className="type-section-label mb-3">本 Brain 发布的 Skillpack</div>
            <AsyncState
              loading={packLoading}
              error={packError}
              empty={packs.length === 0}
              emptyText="该 brain 未发布 skillpack。"
            />
            {packs.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {packs.map((p) => (
                  <div key={`${p.source_id}:${p.name}`} className="rounded-xl border border-hairline bg-surface p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-brain-lg font-medium text-ink">{p.name}</div>
                      <Badge tone={p.installed ? 'ok' : 'muted'}>{p.installed ? '已安装' : '未安装'}</Badge>
                    </div>
                    <div className="mt-1 text-brain-sm text-muted">v{p.version} · source: {p.source_id}</div>
                    {p.schema_pack && (
                      <div className="mt-2">
                        <Badge tone={p.schema_pack_match ? 'ok' : 'amber'}>
                          schema_pack {p.schema_pack}{p.schema_pack_match ? ' · 匹配' : ' · 与当前 brain 不一致'}
                        </Badge>
                      </div>
                    )}
                    {p.skills.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {p.skills.map((s) => (
                          <li key={s.slug} className="text-brain-sm text-ink-soft">
                            <span className="font-mono text-ink">{s.slug}</span> — {s.description}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 font-mono text-brain-2sm text-muted">
                      {p.scaffold_spec
                        ? `gbrain skillpack scaffold ${p.scaffold_spec}`
                        : '该 source 无 git 远程，需在本机手动 scaffold。'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <SkillDetailDrawer name={selectedSkill} onClose={() => setSelectedSkill(null)} />
    </div>
  );
}
