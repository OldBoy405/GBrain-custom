import { DREAM_CYCLE_GROUPS } from '../../lib/dream-cycle-phases';

/**
 * Dream Cycle 7 组语义 pipeline（静态两行文案：组标题 + 缩进 phase 链）。
 */
export function DreamCyclePipeline({
  phases: _phases,
}: {
  phases: Array<{ phase: string; status: string; duration_ms: number; summary: string }> | null | undefined;
}) {
  void _phases;

  return (
    <div
      data-testid="dream-cycle-pipeline"
      className="rounded-md border border-hairline bg-canvas px-3 py-2"
    >
      <ul className="m-0 list-none space-y-2.5 p-0">
        {DREAM_CYCLE_GROUPS.map((g) => (
          <li key={g.id}>
            <div className="text-brain-sm leading-snug text-ink">
              <span className="font-medium">{g.label}</span>
              <span className="text-ink-soft">：{g.titleLine}</span>
            </div>
            <div className="mt-0.5 pl-3 font-mono text-brain-2xs leading-relaxed text-muted">{g.phaseLine}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
