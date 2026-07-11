import { useState } from 'react';
import { Moon } from 'lucide-react';
import { useMcp } from '../../lib/useMcp';
import { callMcp } from '../../lib/mcp-client';
import type { StatusSnapshotResult } from '../../lib/op-types';
import { WhyButton } from './WhyButton';

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

/** PhaseStatus values from src/core/cycle.ts ('ok' | 'warn' | 'fail' | 'skipped'). */
const PHASE_STATUS_COLOR: Record<string, string> = {
  ok: 'var(--color-ok)',
  warn: 'var(--color-amber)',
  fail: 'var(--color-contra)',
  skipped: 'var(--color-muted)',
};

/**
 * Dream Cycle（autopilot-cycle 全量 phase 扫）最近一次运行摘要 + 手动触发。
 *
 * 诚实声明：`totals` 是最近一次完成的 autopilot-cycle job 的 `result.report.totals`
 * 原样透传（`get_status_snapshot` → `buildCycleSnapshot`），字段随实际跑过的 phase 变化
 * ——不假设固定 phase 数量（真实 `ALL_PHASES` 有 ~20+ 项，且部分按 pack/config 门控）。
 */
export function DreamCycleCard() {
  const { data, reload } = useMcp<StatusSnapshotResult>('get_status_snapshot');
  const last = data?.cycle?.last_full ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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

  const totalsEntries = last?.totals ? Object.entries(last.totals) : [];

  return (
    <div className="rounded-lg border border-hairline bg-elevated p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="type-mono-tiny flex items-center gap-1.5">
          <Moon size={11} aria-hidden />
          // DREAM CYCLE
        </div>
        <WhyButton topic="dream-cycle" />
      </div>
      <h3 className="type-serif text-brain-lg font-semibold text-ink">
        上次：{formatWhen(last?.finished_at ?? null)}
        {last?.duration_ms != null && ` · ${formatDuration(last.duration_ms)}`}
      </h3>
      <p className="mt-1 text-brain-xs text-muted">由 autopilot 按 source 扇出调度（非固定 cron）。</p>

      {totalsEntries.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {totalsEntries.map(([key, value]) => (
            <li key={key} className="flex items-baseline gap-2 text-brain-sm text-ink-soft">
              <span className="w-[110px] shrink-0 font-mono text-brain-2xs uppercase text-accent">{key}</span>
              <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-brain-sm text-muted">尚无已完成的 dream cycle 记录。</p>
      )}

      {last?.phases && last.phases.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {last.phases.map((p) => (
            <span
              key={p.phase}
              className="rounded-full border px-2 py-0.5 font-mono text-brain-2xs"
              style={{ borderColor: `color-mix(in srgb, ${PHASE_STATUS_COLOR[p.status] ?? 'var(--color-muted)'} 40%, transparent)`, color: PHASE_STATUS_COLOR[p.status] ?? 'var(--color-muted)' }}
              title={`${p.phase} · ${p.duration_ms}ms · ${p.summary}`}
            >
              {p.phase}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void trigger()}
        disabled={submitting}
        className="mt-3 w-full cursor-pointer rounded-md border border-hairline bg-canvas px-3 py-1.5 text-brain-sm text-ink-soft transition hover:bg-subtle disabled:opacity-50"
      >
        {submitting ? '提交中…' : '立即触发'}
      </button>
      {note && <p className="mt-2 text-brain-xs text-muted">{note}</p>}
    </div>
  );
}
