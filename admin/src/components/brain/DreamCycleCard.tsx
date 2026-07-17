import { useState } from 'react';
import { Moon } from 'lucide-react';
import { useMcp } from '../../lib/useMcp';
import { callMcp } from '../../lib/mcp-client';
import type { StatusSnapshotResult } from '../../lib/op-types';
import { formatDreamCycleOutcomes } from '../../lib/dream-cycle-outcomes';
import { WhyButton } from './WhyButton';
import { DreamCyclePipeline } from './DreamCyclePipeline';

function formatWhen(iso: string | null): string {
  if (!iso) return '暂无记录';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '暂无记录';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? `今 ${time}` : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

/**
 * Dream Cycle（autopilot-cycle 全量 phase 扫）语义 pipeline + 产出摘要 + 手动触发。
 *
 * 诚实声明：7 组 phase 顺序为静态结构说明（镜像 ALL_PHASES）；status / duration /
 * totals 来自 get_status_snapshot → cycle.last_full 的真实 job report。
 */
export function DreamCycleCard() {
  const { data, reload } = useMcp<StatusSnapshotResult>('get_status_snapshot');
  const last = data?.cycle?.last_full ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const outcomeLines = formatDreamCycleOutcomes(last?.totals ?? null, last?.phases ?? null);
  const hasRun = last?.finished_at != null;

  const trigger = async () => {
    if (!window.confirm('将提交一次完整 dream cycle（autopilot-cycle），可能运行数分钟，确定？')) return;
    setSubmitting(true);
    setNote(null);
    try {
      const job = await callMcp<{ id: number }>('submit_job', { name: 'autopilot-cycle', data: {} });
      setNote(`已提交作业 #${job.id}，可在上方"运行中"栏查看进度。`);
    } catch (e) {
      setNote(`提交失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
      void reload();
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-elevated p-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="type-mono-tiny flex items-center gap-1.5">
            <Moon size={11} aria-hidden />
            // DREAM CYCLE
          </div>
          <WhyButton topic="dream-cycle" />
        </div>

        <div className="flex items-start justify-between gap-3">
          <h3 className="type-serif min-w-0 text-brain-lg font-semibold text-ink">
            上次：{formatWhen(last?.finished_at ?? null)}
            {last?.duration_ms != null && ` · ${formatDuration(last.duration_ms)}`}
          </h3>
          <button
            type="button"
            onClick={() => void trigger()}
            disabled={submitting}
            className="shrink-0 cursor-pointer rounded-md border border-hairline bg-canvas px-3 py-1.5 text-brain-sm text-ink-soft transition hover:bg-subtle disabled:opacity-50"
          >
            {submitting ? '提交中…' : '立即触发'}
          </button>
        </div>
        <p className="mt-1 text-brain-xs text-muted">由 autopilot 按 source 扇出调度（非固定 cron）。</p>
        {note && <p className="mt-1 text-brain-xs text-muted">{note}</p>}
      </div>

      <div className="mt-3">
        <div>
          <div className="type-section-label mb-1.5">本轮产出</div>
          {outcomeLines.length > 0 ? (
            <ul className="list-none space-y-1 p-0 text-brain-sm text-ink-soft">
              {outcomeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-brain-sm text-muted">{hasRun ? '本轮无计数型产出' : '尚无产出计数'}</p>
          )}
        </div>

        <div className="mt-3">
          <div className="type-section-label mb-1.5">语义 pipeline</div>
          <DreamCyclePipeline phases={last?.phases ?? null} />
        </div>
      </div>
    </div>
  );
}
