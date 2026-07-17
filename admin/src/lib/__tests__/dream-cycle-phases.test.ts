import { describe, it, expect } from 'vitest';
import {
  DREAM_CYCLE_GROUPS,
  DREAM_CYCLE_PHASE_IDS,
  mergePhaseRunState,
  groupAggregateStatus,
  normalizePhaseStatus,
} from '../dream-cycle-phases';

describe('dream-cycle-phases', () => {
  it('covers 22 phases in ALL_PHASES order', () => {
    expect(DREAM_CYCLE_PHASE_IDS).toHaveLength(22);
    expect(DREAM_CYCLE_PHASE_IDS[0]).toBe('lint');
    expect(DREAM_CYCLE_PHASE_IDS[DREAM_CYCLE_PHASE_IDS.length - 1]).toBe('purge');
  });

  it('groups sum to full phase list without duplicates', () => {
    const flat = DREAM_CYCLE_GROUPS.flatMap((g) => g.phases.map((p) => p.id));
    expect(flat).toEqual(DREAM_CYCLE_PHASE_IDS);
    expect(new Set(flat).size).toBe(22);
  });

  it('mergePhaseRunState defaults missing phases to pending', () => {
    const groups = mergePhaseRunState([
      { phase: 'lint', status: 'ok', duration_ms: 100, summary: 'fixed 2' },
      { phase: 'sync', status: 'skipped', duration_ms: 0, summary: 'fresh' },
    ]);
    const filesystem = groups.find((g) => g.id === 'filesystem')!;
    expect(filesystem.phases[0].status).toBe('ok');
    expect(filesystem.phases[1].status).toBe('pending');
    expect(filesystem.aggregateStatus).toBe('ok');

    const ingest = groups.find((g) => g.id === 'ingest')!;
    expect(ingest.phases[0].status).toBe('skipped');
    expect(ingest.aggregateStatus).toBe('skipped');
  });

  it('groupAggregateStatus prioritizes fail over warn', () => {
    expect(
      groupAggregateStatus([
        {
          id: 'a',
          status: 'ok',
          duration_ms: null,
          summary: null,
          def: DREAM_CYCLE_GROUPS[0].phases[0],
        },
        {
          id: 'b',
          status: 'fail',
          duration_ms: null,
          summary: null,
          def: DREAM_CYCLE_GROUPS[0].phases[1],
        },
      ]),
    ).toBe('fail');
  });

  it('groups carry titleLine and phaseLine for pipeline display', () => {
    const filesystem = DREAM_CYCLE_GROUPS.find((g) => g.id === 'filesystem')!;
    expect(filesystem.titleLine).toContain('wikilink/backlink');
    expect(filesystem.phaseLine).toContain('lint → backlinks');
  });
});
