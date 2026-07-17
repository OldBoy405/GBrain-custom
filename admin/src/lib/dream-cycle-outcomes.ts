/**
 * Dream Cycle 产出摘要：CycleReport.totals 键 → 人类可读 bullet。
 * 镜像 src/core/cycle.ts CycleReport.totals 字段名。
 */

type SnapshotPhase = { phase: string; status: string; duration_ms: number; summary: string };

function num(totals: Record<string, unknown> | null | undefined, key: string): number {
  const v = totals?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

/** phase id → totals 键集合（无 totals 键的 phase 走 summary fallback）。 */
const PHASES_WITHOUT_TOTALS = new Set([
  'synthesize_concepts',
  'propose_takes',
  'grade_takes',
  'calibration_profile',
  'conversation_facts_backfill',
  'enrich_thin',
  'skillopt',
  'schema-suggest',
]);

const PHASE_LABEL: Record<string, string> = {
  synthesize_concepts: '概念页综合',
  propose_takes: '校准提议',
  grade_takes: '校准裁决',
  calibration_profile: '校准画像',
  conversation_facts_backfill: '对话事实回填',
  enrich_thin: '薄页 enrichment',
  skillopt: 'SkillOpt',
  'schema-suggest': 'Schema 建议',
};

function pushIf(lines: string[], n: number, fmt: (n: number) => string) {
  if (n > 0) lines.push(fmt(n));
}

export function formatDreamCycleOutcomes(
  totals: Record<string, unknown> | null | undefined,
  phases: SnapshotPhase[] | null | undefined,
): string[] {
  const lines: string[] = [];

  pushIf(lines, num(totals, 'lint_fixes'), (n) => `markdown 自动修复 ${n} 处`);
  pushIf(lines, num(totals, 'backlinks_added'), (n) => `补 wikilink ${n} 条`);
  pushIf(lines, num(totals, 'pages_synced'), (n) => `磁盘 → DB 同步 ${n} 页`);

  const extracted = num(totals, 'pages_extracted');
  pushIf(lines, extracted, (n) => `typed-link / 链接抽取 ${n}`);

  const transcripts = num(totals, 'transcripts_processed');
  const synthPages = num(totals, 'synth_pages_written');
  if (transcripts > 0) lines.push(`transcript 综合处理 ${transcripts} 条`);
  if (synthPages > 0) lines.push(`synthesize 新页写入 ${synthPages}`);

  pushIf(lines, num(totals, 'patterns_written'), (n) => `跨会话主题 ${n} 条`);
  pushIf(lines, num(totals, 'facts_consolidated'), (n) => `事实合并 ${n}`);
  pushIf(lines, num(totals, 'consolidate_takes_written'), (n) => `consolidate 新 takes ${n}`);
  pushIf(lines, num(totals, 'pages_emotional_weight_recomputed'), (n) => `salience 重算 ${n} 页`);

  const resolved = num(totals, 'edges_resolved');
  const ambiguous = num(totals, 'edges_ambiguous');
  if (resolved > 0) lines.push(`符号边解析 ${resolved}`);
  if (ambiguous > 0) lines.push(`符号边歧义 ${ambiguous}`);

  pushIf(lines, num(totals, 'pages_embedded'), (n) => `stale chunk embedding ${n}`);
  pushIf(lines, num(totals, 'orphans_found'), (n) => `orphan 报告 ${n}`);

  const purgedSources = num(totals, 'purged_sources_count');
  const purgedPages = num(totals, 'purged_pages_count');
  if (purgedSources > 0 || purgedPages > 0) {
    lines.push(`purge 硬删 source ${purgedSources} · page ${purgedPages}`);
  }

  const phantoms = num(totals, 'phantoms_redirected');
  if (phantoms > 0) lines.push(`phantom 重定向 ${phantoms}`);

  for (const p of phases ?? []) {
    if (!PHASES_WITHOUT_TOTALS.has(p.phase)) continue;
    if (p.status !== 'ok' && p.status !== 'warn') continue;
    if (!p.summary?.trim()) continue;
    const label = PHASE_LABEL[p.phase] ?? p.phase;
    lines.push(`${label}：${p.summary.trim()}`);
  }

  return lines;
}
