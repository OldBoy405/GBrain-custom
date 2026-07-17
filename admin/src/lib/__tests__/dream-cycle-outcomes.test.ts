import { describe, it, expect } from 'vitest';
import { formatDreamCycleOutcomes } from '../dream-cycle-outcomes';

describe('dream-cycle-outcomes', () => {
  it('formats non-zero totals into Chinese bullets', () => {
    const lines = formatDreamCycleOutcomes(
      {
        lint_fixes: 3,
        pages_synced: 10,
        pages_extracted: 47,
        synth_pages_written: 12,
        pages_embedded: 5,
      },
      null,
    );
    expect(lines).toContain('markdown 自动修复 3 处');
    expect(lines).toContain('磁盘 → DB 同步 10 页');
    expect(lines).toContain('typed-link / 链接抽取 47');
    expect(lines).toContain('synthesize 新页写入 12');
    expect(lines).toContain('stale chunk embedding 5');
  });

  it('omits zero totals', () => {
    const lines = formatDreamCycleOutcomes({ lint_fixes: 0, pages_synced: 0 }, null);
    expect(lines).toHaveLength(0);
  });

  it('falls back to phase summary for phases without totals keys', () => {
    const lines = formatDreamCycleOutcomes(
      {},
      [{ phase: 'schema-suggest', status: 'ok', duration_ms: 50, summary: '3 suggestions queued' }],
    );
    expect(lines).toEqual(['Schema 建议：3 suggestions queued']);
  });

  it('skips skipped phases in summary fallback', () => {
    const lines = formatDreamCycleOutcomes(
      {},
      [{ phase: 'skillopt', status: 'skipped', duration_ms: 0, summary: 'disabled' }],
    );
    expect(lines).toHaveLength(0);
  });
});
