import { useMcp } from '../../lib/useMcp';
import type { GetSkillResult } from '../../lib/op-types';
import { Badge, Drawer, AsyncState } from '../../components/brain';

/** Skill 卡片点击 → 右侧详情抽屉（`get_skill` 全文）。name 为 null 时不渲染。 */
export function SkillDetailDrawer({ name, onClose }: { name: string | null; onClose: () => void }) {
  const { data, loading, error } = useMcp<GetSkillResult>('get_skill', { name }, { enabled: !!name });

  if (!name) return null;

  return (
    <Drawer open title={name} onClose={onClose}>
      <div className="space-y-4">
        <AsyncState loading={loading} error={error} empty={false} />
        {data && (
          <>
            <div className="flex flex-wrap gap-1">
              {data.client_guidance.mutating && <Badge tone="amber">mutating</Badge>}
              {data.frontmatter.writes_pages && <Badge tone="coral">writes</Badge>}
            </div>
            {data.frontmatter.description && (
              <p className="text-brain-base leading-relaxed text-ink-soft">{data.frontmatter.description}</p>
            )}
            {data.frontmatter.triggers && data.frontmatter.triggers.length > 0 && (
              <div>
                <div className="type-section-label mb-1.5">Trigger</div>
                <div className="flex flex-wrap gap-1">
                  {data.frontmatter.triggers.map((t) => (
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
                {data.usable_tools.map((t) => (
                  <Badge key={t} tone="ok">{t}</Badge>
                ))}
                {data.unavailable_tools.map((t) => (
                  <Badge key={t} tone="muted">{t}（不可用）</Badge>
                ))}
                {data.usable_tools.length === 0 && data.unavailable_tools.length === 0 && (
                  <span className="text-brain-sm text-muted">该 skill 未声明工具。</span>
                )}
              </div>
            </div>
            <div>
              <div className="type-section-label mb-1.5">SKILL.md 正文</div>
              <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-3 font-mono text-brain-xs leading-relaxed text-ink-soft">
                {data.body}
              </pre>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
