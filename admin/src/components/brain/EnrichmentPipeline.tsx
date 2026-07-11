import type { EnrichmentStatus } from '../../lib/op-types';

/**
 * 4 步 enrichment 流水线示意。
 *
 * 与 PipelineSteps 同模式（圆点 + 标签 + accent 完成态），但步数是 4 而非 12。
 * 仅在 status === 'merging' 时运行动画；其他状态为静态展示。
 */
const STEPS = [
  { label: '归一化', desc: 'normalize' },
  { label: 'Frontmatter', desc: 'merge' },
  { label: 'Typed-link', desc: 'regex' },
  { label: '合并入图', desc: 'merge' },
];

function stepFromJobProgress(progress?: { phase?: string; completed?: number; total?: number } | null): number | null {
  if (!progress) return null;
  if (typeof progress.completed === 'number' && typeof progress.total === 'number' && progress.total > 0) {
    return Math.min(STEPS.length, Math.round((progress.completed / progress.total) * STEPS.length));
  }
  if (progress.phase?.includes('merge')) return 3;
  if (progress.phase?.includes('normalize')) return 1;
  return null;
}

/** 根据 EnrichmentStatus 推断当前已完成的步数 + 是否在运行动画 + 是否失败。 */
function stepFromStatus(
  status: EnrichmentStatus,
  jobProgress?: { phase?: string; completed?: number; total?: number } | null,
): { cur: number; running: boolean; failed: boolean } {
  if (status === 'merging') {
    const fromJob = stepFromJobProgress(jobProgress);
    if (fromJob != null) {
      return { cur: fromJob, running: true, failed: false };
    }
    return { cur: 2, running: true, failed: false };
  }
  switch (status) {
    case 'pending_frontmatter':
      return { cur: 0, running: false, failed: false };
    case 'pending_typed_link':
      return { cur: 1, running: false, failed: false };
    case 'merged':
      return { cur: STEPS.length, running: false, failed: false };
    case 'failed':
      // Enrichment errored and rolled back — don't fake progress; the detail
      // panel carries the error banner. Steps render muted, header flags failure.
      return { cur: 0, running: false, failed: true };
  }
}

export function EnrichmentPipeline({
  status,
  jobProgress,
  jobLabel,
}: {
  status?: EnrichmentStatus;
  jobProgress?: { phase?: string; completed?: number; total?: number } | null;
  jobLabel?: string | null;
}) {
  const { cur, running, failed } = stepFromStatus(status ?? 'pending_frontmatter', jobProgress);

  return (
    <div className="space-y-1.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="type-section-label">ENRICHMENT 流水线</div>
        {failed ? (
          <span className="font-mono text-brain-xs" style={{ color: 'var(--color-contra)' }}>
            已失败 · 可重新触发
          </span>
        ) : (
          jobLabel && <span className="font-mono text-brain-xs text-muted">{jobLabel}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const isDone = i < cur;
          const isActive = i === cur && running;
          const color = isDone || isActive ? 'var(--color-accent)' : 'var(--color-muted)';
          return (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors"
              style={{
                borderColor: isDone || isActive ? 'var(--color-accent)' : 'var(--color-hairline)',
                background: isActive ? 'var(--color-accent-soft)' : 'transparent',
              }}
            >
              <span
                className="flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-brain-2xs"
                style={{
                  background: isDone ? 'var(--color-accent)' : 'transparent',
                  color: isDone ? 'var(--color-inverse)' : color,
                  border: isDone ? 'none' : `1px solid ${color}`,
                }}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <div className="min-w-0">
                <div
                  className="truncate text-brain-sm font-medium"
                  style={{ color: isDone || isActive ? 'var(--color-ink)' : 'var(--color-muted)' }}
                >
                  {s.label}
                </div>
                <div className="truncate font-mono text-brain-xs text-muted">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
