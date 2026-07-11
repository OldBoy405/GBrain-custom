/**
 * Execution-lane classification for minion jobs, derived from the job's
 * registered handler name. Only `shell` and `subagent`/`subagent_aggregator`
 * are generic dispatch jobs (LLM-orchestrated or ad-hoc shell); every other
 * registered name (`sync`, `embed`, `extract`, `synthesize`, …) is a
 * deterministic handler. Kept as a pure function (not stored on the job row)
 * so it can never drift from `worker.register(...)` in `src/commands/jobs.ts`.
 */
export type ExecutionLane = 'shell' | 'subagent' | 'handler';

const SUBAGENT_JOB_NAMES = new Set(['subagent', 'subagent_aggregator']);
const SHELL_JOB_NAMES = new Set(['shell']);

export function getExecutionLane(name: string): ExecutionLane {
  if (SUBAGENT_JOB_NAMES.has(name)) return 'subagent';
  if (SHELL_JOB_NAMES.has(name)) return 'shell';
  return 'handler';
}
