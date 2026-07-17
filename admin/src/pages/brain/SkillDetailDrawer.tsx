import { useMcp } from '../../lib/useMcp';
import type { GetSkillResult, ResidentSkillDetail } from '../../lib/op-types';
import { Badge, Drawer, AsyncState } from '../../components/brain';

/** 抽屉打开的目标：host 目录 skill 只有 name；brain-resident pack skill 还带 sourceId。 */
export type SelectedSkill = { name: string; sourceId?: string };

/**
 * Skill 卡片点击 → 右侧详情抽屉（`get_skill` 全文）。skill 为 null 时不渲染。
 *
 * 两种后端形态共用一个 op：
 * - host 目录（无 source_id）→ `GetSkillResult`（含 frontmatter / 工具可用性）。
 * - brain-resident pack（带 source_id）→ `ResidentSkillDetail`（只有 pack_name /
 *   description / body）。用 `'frontmatter' in data` 判别。
 */
export function SkillDetailDrawer({
  skill,
  onClose,
}: {
  skill: SelectedSkill | null;
  onClose: () => void;
}) {
  const args = skill
    ? { name: skill.name, ...(skill.sourceId ? { source_id: skill.sourceId } : {}) }
    : {};
  const { data, loading, error } = useMcp<GetSkillResult | ResidentSkillDetail>('get_skill', args, {
    enabled: !!skill,
  });

  if (!skill) return null;

  const host = data && 'frontmatter' in data ? (data as GetSkillResult) : null;
  const resident = data && !('frontmatter' in data) ? (data as ResidentSkillDetail) : null;

  return (
    <Drawer open title={skill.name} onClose={onClose}>
      <div className="space-y-4">
        <AsyncState loading={loading} error={error} empty={false} />

        {resident && (
          <>
            <div className="flex flex-wrap gap-1">
              <Badge tone="muted">pack: {resident.pack_name}</Badge>
              <Badge tone="muted">source: {resident.source_id}</Badge>
            </div>
            {resident.description && resident.description !== '(no description)' && (
              <p className="text-brain-base leading-relaxed text-ink-soft">{resident.description}</p>
            )}
            <div>
              <div className="type-section-label mb-1.5">SKILL.md 正文</div>
              <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-3 font-mono text-brain-xs leading-relaxed text-ink-soft">
                {resident.body}
              </pre>
            </div>
          </>
        )}

        {host && (
          <>
            <div className="flex flex-wrap gap-1">
              {host.client_guidance.mutating && <Badge tone="amber">mutating</Badge>}
              {host.frontmatter.writes_pages && <Badge tone="coral">writes</Badge>}
            </div>
            {host.frontmatter.description && (
              <p className="text-brain-base leading-relaxed text-ink-soft">{host.frontmatter.description}</p>
            )}
            {host.frontmatter.triggers && host.frontmatter.triggers.length > 0 && (
              <div>
                <div className="type-section-label mb-1.5">Trigger</div>
                <div className="flex flex-wrap gap-1">
                  {host.frontmatter.triggers.map((t) => (
                    <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-brain-2sm text-accent">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="type-section-label mb-1.5">工具</div>
              <div className="flex flex-wrap gap-1">
                {host.usable_tools.map((t) => (
                  <Badge key={t} tone="ok">{t}</Badge>
                ))}
                {host.unavailable_tools.map((t) => (
                  <Badge key={t} tone="muted">{t}（不可用）</Badge>
                ))}
                {host.usable_tools.length === 0 && host.unavailable_tools.length === 0 && (
                  <span className="text-brain-sm text-muted">该 skill 未声明工具。</span>
                )}
              </div>
            </div>
            <div>
              <div className="type-section-label mb-1.5">SKILL.md 正文</div>
              <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-3 font-mono text-brain-xs leading-relaxed text-ink-soft">
                {host.body}
              </pre>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
