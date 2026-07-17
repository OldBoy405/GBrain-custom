import type { SkillEntry } from '../../lib/op-types';
import { Badge } from '../../components/brain';

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
    <div className="mt-2" title={truncated ? tools.map(toolCardLabel).join(', ') : undefined}>
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

/**
 * 单个 host-repo skill 卡片（`list_skills` 一条）。点击 → 详情抽屉。
 * `sectionColor` 是父组件按「本屏实际出现的分类顺序」解析好的 CSS 颜色串
 * （见 Skills.tsx `colorVarFor`），卡片只负责展示，不重复取色逻辑。
 */
export function SkillCard({
  skill,
  sectionColor,
  onClick,
}: {
  skill: SkillEntry;
  sectionColor: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-hairline bg-surface p-5 transition hover:border-emphasis"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-brain-lg font-medium text-ink">{skill.name}</div>
        <div className="flex gap-1">
          {skill.mutating && <Badge tone="amber">mutating</Badge>}
          {skill.writes_pages && <Badge tone="coral">writes</Badge>}
        </div>
      </div>
      <div className="mt-1">
        <span
          className="inline-block rounded-full border px-2 py-0.5 text-brain-2sm font-medium uppercase tracking-wider"
          style={{
            color: sectionColor,
            borderColor: sectionColor,
            background: `color-mix(in srgb, ${sectionColor} 10%, transparent)`,
          }}
        >
          {skill.section}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-brain-base leading-relaxed text-ink-soft">{skill.description}</p>
      {skill.triggers?.length > 0 && (
        <div
          className="mt-3 truncate font-mono text-brain-2sm text-muted"
          title={skill.triggers.length > 4 ? skill.triggers.join(' / ') : undefined}
        >
          trigger · {skill.triggers.slice(0, 4).join(' / ')}
        </div>
      )}
      {skill.tools?.length > 0 && (
        <SkillToolsPreview
          tools={skill.tools}
          usableCount={skill.usable_tools.length}
          unavailableCount={skill.unavailable_tools?.length ?? 0}
        />
      )}
    </div>
  );
}
