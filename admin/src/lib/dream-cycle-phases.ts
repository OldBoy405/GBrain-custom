/**
 * Dream Cycle phase 目录（镜像 src/core/cycle.ts ALL_PHASES 语义顺序）。
 *
 * upstream merge 后对照 `src/core/cycle.ts` `ALL_PHASES` 手工同步
 * （与 op-types.ts 同策略；admin 不能 import ../../src/core/*）。
 */

export type PhaseRunStatus = 'ok' | 'warn' | 'fail' | 'skipped' | 'pending';

export interface DreamCyclePhaseDef {
  id: string;
  label: string;
  desc: string;
  effect: string;
  source: string;
  gated?: boolean;
  gateNote?: string;
}

export interface DreamCycleGroupDef {
  id: string;
  label: string;
  /** 组标题后半：`链接与结构 · wikilink/backlink 修复` */
  titleLine: string;
  /** 缩进 phase 链：`lint → backlinks（修 markdown / 补链）` */
  phaseLine: string;
  effectSummary: string;
  phases: DreamCyclePhaseDef[];
}

export interface PhaseRunRow {
  id: string;
  status: PhaseRunStatus;
  duration_ms: number | null;
  summary: string | null;
  def: DreamCyclePhaseDef;
}

export interface DreamCycleGroupWithRun extends DreamCycleGroupDef {
  phases: PhaseRunRow[];
  aggregateStatus: PhaseRunStatus;
}

const PHASE = (
  id: string,
  label: string,
  desc: string,
  effect: string,
  source: string,
  gated?: boolean,
  gateNote?: string,
): DreamCyclePhaseDef => ({ id, label, desc, effect, source, gated, gateNote });

/** 7 组语义 pipeline；组内 phase 顺序与 ALL_PHASES 一致。 */
export const DREAM_CYCLE_GROUPS: DreamCycleGroupDef[] = [
  {
    id: 'filesystem',
    label: '文件层',
    titleLine: '链接与结构 · wikilink/backlink 修复',
    phaseLine: 'lint → backlinks（修 markdown / 补链）',
    effectSummary: '链接与结构：wikilink/backlink 修复',
    phases: [
      PHASE('lint', 'Lint', '修 markdown 格式与 frontmatter', 'markdown 自动修复', 'src/core/cycle.ts'),
      PHASE('backlinks', 'Backlinks', '补缺失 wikilink 反向链', 'wikilink/backlink 补链', 'src/core/cycle.ts'),
    ],
  },
  {
    id: 'ingest',
    label: '入库',
    titleLine: '索引刷新 · 磁盘与 DB 对齐',
    phaseLine: 'sync（磁盘 → DB）',
    effectSummary: '索引新鲜：磁盘与 DB 对齐',
    phases: [
      PHASE('sync', 'Sync', 'repo 文件变更导入 DB', '磁盘 → DB 同步', 'src/commands/sync.ts'),
    ],
  },
  {
    id: 'extract',
    label: '内容生成/抽取',
    titleLine: '内容沉淀 + 事实/符号边抽取',
    phaseLine: 'synthesize、extract、extract_facts、extract_atoms(门控)、resolve_symbol_edges',
    effectSummary: '内容沉淀 + 事实/符号边抽取',
    phases: [
      PHASE('synthesize', 'Synthesize', 'transcript → 反思/人物/原创页', 'transcript 综合为新页', 'src/core/cycle/synthesize.ts'),
      PHASE('extract', 'Extract', 'typed-link / timeline / graph 物化', 'typed-link 与图谱边更新', 'src/commands/extract.ts'),
      PHASE('extract_facts', 'Extract facts', '## Facts 围栏 → facts 索引', '实体事实索引对齐', 'src/core/cycle/extract-facts.ts'),
      PHASE(
        'extract_atoms',
        'Extract atoms',
        '长文/会议 → atom 页',
        '原子页抽取（pack 开启时）',
        'src/core/cycle/extract-atoms.ts',
        true,
        'active schema pack 声明 phases 时启用',
      ),
      PHASE(
        'resolve_symbol_edges',
        'Resolve symbols',
        '代码边 bare-token → resolved chunk',
        '符号边解析 / 歧义标记',
        'src/core/cycle/resolve-symbol-edges.ts',
      ),
    ],
  },
  {
    id: 'graph',
    label: '图谱/主题',
    titleLine: '跨会话主题与概念页沉淀',
    phaseLine: 'patterns、synthesize_concepts(门控)',
    effectSummary: '跨会话主题与概念页沉淀',
    phases: [
      PHASE('patterns', 'Patterns', '跨 session 主题聚类', '跨会话主题页', 'src/core/cycle/patterns.ts'),
      PHASE(
        'synthesize_concepts',
        'Synthesize concepts',
        'atom 聚合 → tier 概念页',
        '概念页综合（pack 开启时）',
        'src/core/cycle/synthesize-concepts.ts',
        true,
        'active schema pack 声明 phases 时启用',
      ),
    ],
  },
  {
    id: 'calibration',
    label: '打分/校准',
    titleLine: '检索质量 + 校准闭环',
    phaseLine: 'recompute_emotional_weight、consolidate、propose_takes / grade_takes / calibration_profile',
    effectSummary: '检索质量 + 校准闭环',
    phases: [
      PHASE(
        'recompute_emotional_weight',
        'Salience',
        'emotional_weight / salience 重算',
        'salience 重算',
        'src/commands/salience.ts',
      ),
      PHASE('consolidate', 'Consolidate', '事实簇 → takes', '事实合并为 takes', 'src/core/cycle/consolidate.ts'),
      PHASE('propose_takes', 'Propose takes', '扫描 prose 提议可评分 claim', '校准：提议新 takes', 'src/core/cycle/propose-takes.ts'),
      PHASE('grade_takes', 'Grade takes', '证据检索 + judge 裁决', '校准：grade takes', 'src/core/cycle/grade-takes.ts'),
      PHASE(
        'calibration_profile',
        'Calibration profile',
        '已决议 takes → 偏差画像',
        '校准：profile 更新（voice-gated）',
        'src/core/cycle/calibration-profile.ts',
      ),
    ],
  },
  {
    id: 'optional_llm',
    label: '可选 LLM 回填',
    titleLine: 'opt-in 批量 LLM enrichment / skill 自动化',
    phaseLine: 'conversation_facts_backfill(门控)、enrich_thin(门控)、skillopt（多数默认 OFF，靠 config 门控）',
    effectSummary: 'opt-in 批量 LLM enrichment / skill 自进化',
    phases: [
      PHASE(
        'conversation_facts_backfill',
        'Conv. facts',
        '长对话页 bulk fact 抽取',
        '对话事实回填',
        'src/core/cycle/conversation-facts-backfill.ts',
        true,
        'cycle.conversation_facts_backfill.enabled',
      ),
      PHASE(
        'enrich_thin',
        'Enrich thin',
        'stub 页 grounded  synthesis',
        '薄页 enrichment',
        'src/core/cycle/enrich-thin.ts',
        true,
        'cycle.enrich_thin.enabled',
      ),
      PHASE(
        'skillopt',
        'SkillOpt',
        'stale skill benchmark 自优化',
        '技能 benchmark 自进化',
        'src/core/cycle/skillopt.ts',
        true,
        'cycle.skillopt.enabled',
      ),
    ],
  },
  {
    id: 'finalize',
    label: '收尾',
    titleLine: 'embedding、orphan 报告、schema 建议、过期清理',
    phaseLine: 'embed、orphans、schema-suggest、purge',
    effectSummary: 'embedding、orphan 报告、schema 建议、过期清理',
    phases: [
      PHASE('embed', 'Embed', 'stale chunk embedding 回填', '检索向量更新', 'src/commands/embed.ts'),
      PHASE('orphans', 'Orphans', '无链/无引用页报告', 'orphan 报告', 'src/core/cycle.ts'),
      PHASE('schema-suggest', 'Schema suggest', '被动 schema 建议扫描', 'schema 建议', 'src/core/cycle/schema-suggest.ts'),
      PHASE('purge', 'Purge', '过期软删硬清理', 'purge 过期软删', 'src/core/cycle.ts'),
    ],
  },
];

/** 扁平 ALL_PHASES 顺序（用于测试与顺序校验）。 */
export const DREAM_CYCLE_PHASE_IDS: string[] = DREAM_CYCLE_GROUPS.flatMap((g) => g.phases.map((p) => p.id));

export function normalizePhaseStatus(raw: string | undefined | null): PhaseRunStatus {
  if (raw === 'ok' || raw === 'warn' || raw === 'fail' || raw === 'skipped') return raw;
  return 'pending';
}

export function groupAggregateStatus(phases: PhaseRunRow[]): PhaseRunStatus {
  if (phases.length === 0) return 'pending';
  if (phases.some((p) => p.status === 'fail')) return 'fail';
  if (phases.some((p) => p.status === 'warn')) return 'warn';
  if (phases.every((p) => p.status === 'skipped')) return 'skipped';
  if (phases.every((p) => p.status === 'pending')) return 'pending';
  if (phases.some((p) => p.status === 'ok')) return 'ok';
  return 'skipped';
}

type SnapshotPhase = { phase: string; status: string; duration_ms: number; summary: string };

export function mergePhaseRunState(
  runPhases: SnapshotPhase[] | null | undefined,
): DreamCycleGroupWithRun[] {
  const byId = new Map<string, SnapshotPhase>();
  for (const p of runPhases ?? []) byId.set(p.phase, p);

  return DREAM_CYCLE_GROUPS.map((group) => {
    const phases: PhaseRunRow[] = group.phases.map((def) => {
      const run = byId.get(def.id);
      return {
        id: def.id,
        def,
        status: run ? normalizePhaseStatus(run.status) : 'pending',
        duration_ms: run?.duration_ms ?? null,
        summary: run?.summary ?? null,
      };
    });
    return { ...group, phases, aggregateStatus: groupAggregateStatus(phases) };
  });
}

export const PHASE_STATUS_COLOR: Record<PhaseRunStatus, string> = {
  ok: 'var(--color-ok)',
  warn: 'var(--color-amber)',
  fail: 'var(--color-contra)',
  skipped: 'var(--color-muted)',
  pending: 'var(--color-muted)',
};

export function formatPhaseDuration(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}min`;
}
