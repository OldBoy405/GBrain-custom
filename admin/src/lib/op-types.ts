/**
 * 后端响应的手写类型镜像（跨编译边界 —— admin tsconfig include:['src'] 无法直接
 * import ../../src/core，故照 scope-constants.ts 的模式手写副本）。
 *
 * 每个类型标注其后端来源。上游若改这些端点/操作，需人工同步这里
 * （详见 admin/docs/TYPE-MIRROR-CHECKLIST.md）。
 */

/** MIRROR OF serve-http.ts `GET /admin/api/stats` 响应。 */
export interface AdminStats {
  connected_agents: number;
  active_tokens: number;
  active_api_keys: number;
  requests_today: number;
}

/** MIRROR OF serve-http.ts `GET /admin/api/health-indicators` 响应。 */
export interface HealthIndicators {
  expiring_soon: number;
  error_rate: string; // 形如 "1.2%"
}

/** MIRROR OF serve-http.ts `broadcastEvent(...)` 推送到 /admin/events 的 SSE 负载。 */
export interface FeedEvent {
  agent: string;
  operation: string;
  scopes: string; // 逗号分隔
  latency_ms?: number;
  status?: string; // 'success' | 'error' | ...
  params?: unknown;
  timestamp?: string;
}

/** MIRROR OF serve-http.ts `GET /admin/api/agents`（宽松：仅运营概览抽屉用到的字段）。 */
export interface AgentRow {
  id: string;
  name: string;
  auth_type: 'oauth' | 'api_key';
  scope: string; // 空格分隔（如 "read write admin"）
  status: 'active' | 'revoked';
  last_used_at?: string | null;
  total_requests?: number;
  requests_today?: number;
  token_ttl?: number | null;
}

/** MIRROR OF serve-http.ts `GET /admin/api/requests` 的行（宽松镜像）。 */
export interface RequestLogRow {
  id: string | number;
  token_name: string;
  agent_name: string;
  operation: string;
  latency_ms?: number | null;
  status?: string; // 'success' | 'error' | ...
  error_message?: string | null;
  created_at?: string;
}

/** MIRROR OF serve-http.ts `GET /admin/api/requests` 的分页信封。 */
export interface RequestLogResult {
  rows: RequestLogRow[];
  total: number;
  page: number;
  pages: number;
}

/** MIRROR OF serve-http.ts `GET /admin/api/api-keys` 的行（宽松镜像）。 */
export interface ApiKeyRow {
  id: string;
  name: string;
  created_at?: string;
  last_used_at?: string | null;
  status: 'active' | 'revoked';
}

/** MIRROR OF serve-http.ts `GET /admin/api/jobs/watch`（readSnapshot 的形状）。 */
export interface JobsWatchSnapshot {
  ts_ms: number;
  by_type: Array<{ name: string; total: number; completed: number; failed: number; dead: number }>;
  queue_health: { waiting: number; active: number; stalled: number };
  lease_pressure_1h: number;
  top_errors: Array<{ cluster: string; count: number }>;
  budget_owners: Array<{ owner_id: number; remaining_cents: number; total_spent_cents: number }>;
}

/** MIRROR OF operations.ts `list_pages` 返回项。 */
export interface PageSummary {
  slug: string;
  type?: string;
  title?: string;
  updated_at?: string;
  deleted_at?: string;
}

/** MIRROR OF operations.ts `query` 结果项（宽松镜像，按需取字段）。 */
export interface QueryResult {
  page_id?: number | string;
  slug?: string;
  title?: string;
  type?: string;
  score?: number;
  snippet?: string;
  excerpt?: string;
  text?: string;
}

/**
 * MIRROR OF operations.ts `query` op's opt-in `trace` field (v0.43.x fork,
 * only present when the call passes `trace: true`). Real diagnostics already
 * computed by hybridSearchCached's HybridSearchMeta — NOT per-step timing;
 * the 12-step waterfall stays illustrative (no genuine per-span ms exists).
 */
export interface QueryTrace {
  total_ms: number;
  cache_status: 'hit' | 'miss' | 'disabled';
  cache_hit: boolean;
  vector_enabled: boolean;
  expansion_applied: boolean;
  intent: string | null;
  detail_resolved: string | null;
  autocut: Record<string, unknown> | null;
  adaptive_return: Record<string, unknown> | null;
  token_budget: Record<string, unknown> | null;
}

/** MIRROR OF skill-catalog.ts `SkillCatalogEntry`。 */
export interface SkillEntry {
  name: string;
  description: string;
  section: string;
  triggers: string[];
  tools: string[];
  usable_tools: string[];
  unavailable_tools: string[];
  writes_pages: boolean;
  mutating: boolean;
}

/** MIRROR OF skill-catalog.ts `ListSkillsResult`。 */
export interface ListSkillsResult {
  skills: SkillEntry[];
  instructions?: unknown;
}

/** MIRROR OF skill-catalog.ts `GetSkillResult`。 */
export interface GetSkillResult {
  schema_version: 1;
  name: string;
  frontmatter: {
    name?: string;
    description?: string;
    triggers?: string[];
    tools?: string[];
    writes_pages?: boolean;
    mutating?: boolean;
  };
  body: string;
  usable_tools: string[];
  unavailable_tools: string[];
  client_guidance: {
    nature: string;
    protocol: string[];
    available_brain_tools: string[];
    mutating: boolean;
  };
}

/** MIRROR OF skillpack/brain-resident-locate.ts `ResidentPackSkill`。 */
export interface ResidentPackSkill {
  slug: string;
  description: string;
}

/** MIRROR OF skillpack/brain-resident-locate.ts `ResidentPackEntry`。 */
export interface ResidentPackEntry {
  source_id: string;
  name: string;
  version: string;
  schema_pack: string | null;
  active_schema_pack: string | null;
  schema_pack_match: boolean | null;
  skills: ResidentPackSkill[];
  /** git-source spec for `gbrain skillpack scaffold <spec>`; null when the source has no git remote. */
  scaffold_spec: string | null;
  installed: boolean;
}

/** MIRROR OF skillpack/brain-resident-locate.ts `ResidentPackResult`（`list_brain_skillpack` 返回）。 */
export interface ListBrainSkillpackResult {
  packs: ResidentPackEntry[];
}

/** MIRROR OF advisor/types.ts `AdvisorSeverity`。 */
export type AdvisorSeverity = 'critical' | 'warn' | 'info';

/** MIRROR OF advisor/types.ts `AdvisorFix`。 */
export interface AdvisorFix {
  /** argv array for the fix command — never a shell string. Null when there's no single mechanical fix. */
  command_argv: string[] | null;
  dispatch_id?: string;
}

/** MIRROR OF advisor/types.ts `AdvisorFinding`。 */
export interface AdvisorFinding {
  id: string;
  severity: AdvisorSeverity;
  title: string;
  detail?: string;
  fix: AdvisorFix;
  collector: string;
  ask_user: boolean;
  workspace_dependent?: boolean;
}

/** MIRROR OF advisor/types.ts `AdvisorReport`（`advisor` 返回）。 */
export interface AdvisorReport {
  version: string;
  generated_at: string;
  findings: AdvisorFinding[];
  worst: AdvisorSeverity | null;
}

// ── 收件箱（Inbox）类型镜像 ──

/** MIRROR OF types.ts `InboxStatus`。 */
export type EnrichmentStatus =
  | 'pending_frontmatter'
  | 'pending_typed_link'
  | 'merging'
  | 'merged'
  | 'failed';

/** UI 已知来源；后端允许 skillpack 自定义 source_kind。 */
export type SourceType = 'jike' | 'mail' | 'paste' | 'file' | 'voice' | 'manual' | 'unknown';

/** MIRROR OF types.ts `InboxTier`。 */
export type TierLevel = 'T1' | 'T2' | 'T3';

/** MIRROR OF operations.ts `list_inbox` 返回项。 */
export interface InboxItem {
  slug: string;
  source_id: string;
  type: string;
  title: string;
  updated_at: string;
  source_kind: string | null;
  source_uri: string | null;
  ingested_at: string | null;
  status: EnrichmentStatus;
  tier: TierLevel | null;
  job_id: number | null;
  error: string | null;
  preview: string;
  raw_content?: string;
  enriched_content?: string;
  frontmatter?: Record<string, unknown>;
  typed_links?: TypedLink[];
}

export interface InboxListResult {
  items: InboxItem[];
  stats: {
    total: number;
    pending_enrich: number;
    merging: number;
    merged: number;
    failed: number;
    capped: boolean;
  };
}

/** MIRROR OF types.ts `Link`（get_inbox_item.typed_links）。 */
export interface TypedLink {
  from_slug: string;
  to_slug: string;
  link_type: string;
  context: string;
  link_source?: string | null;
  origin_slug?: string | null;
  origin_field?: string | null;
}

/** MIRROR OF operations.ts `trigger_inbox_enrichment` 返回。 */
export interface TriggerInboxEnrichmentResult {
  accepted: Array<{ slug: string; job_id: number; status: string }>;
  skipped: Array<{ slug: string; reason: string }>;
}

/** MIRROR OF operations.ts `discard_inbox_items` 返回。 */
export interface DiscardInboxItemsResult {
  mode?: 'soft' | 'hard';
  discarded: string[];
  failed: Array<{ slug: string; reason: string }>;
}

/** MIRROR OF operations.ts `get_stats`（BrainStats，宽松：仅 UI 用到的字段）。 */
export interface BrainStats {
  page_count: number;
  link_count: number;
  pages_by_type: Record<string, number>;
  chunk_count?: number;
  embedded_count?: number;
}

/** MIRROR OF operations.ts `schema_stats`（StatsResult，宽松：仅 UI 用到的字段）。 */
export interface SchemaStatsResult {
  aggregate: {
    total_pages: number;
    typed_pages?: number;
    untyped_pages?: number;
    coverage?: number;
    by_type: Array<{ type: string; count: number }>;
  };
}

/** MIRROR OF types.ts `GraphNode`（traverse_graph 仅传 slug 时的返回项）。 */
export interface GraphNode {
  slug: string;
  title: string;
  type: string;
  depth: number;
  links: Array<{ to_slug: string; link_type: string }>;
}

/**
 * MIRROR OF types.ts `GraphPath`（traverse_graph 传了 link_type/direction 时
 * 切换到的返回项——只有边信息，没有 title/type，见 operations.ts:2332-2337 的
 * 「Backward compat」分支注释）。
 */
export interface GraphPath {
  from_slug: string;
  to_slug: string;
  link_type: string;
  context: string;
  depth: number;
}

/**
 * MIRROR OF operations.ts `think` 返回（宽松镜像）。
 * 真实后端 ThinkResult（src/core/think/index.ts）字段：answer、citations（
 * `{page_slug,row_num,citation_index}`——注意不是 slug/title）、gaps（string[]）、
 * pagesGathered/takesGathered/graphHits/modelUsed/rounds/warnings/synthesisOk，
 * op 层再补 saved_slug/evidence_inserted/remote_persisted_blocked。
 * 后端**不返回 conflicts**——冲突数据在 `find_conflicts` op（真理编译工作台）里。
 */
export interface ThinkResult {
  answer?: string;
  // 兼容宽松：真实字段是 page_slug；保留 slug/title 兜底以防上游演进。
  citations?: Array<{
    page_slug?: string;
    row_num?: number | null;
    citation_index?: number;
    slug?: string;
    title?: string;
  }>;
  gaps?: string[];
  warnings?: string[];
  saved_slug?: string | null;
  evidence_inserted?: number;
  remote_persisted_blocked?: boolean;
  // 以下为可选透传字段（后端 ThinkResult 提供，UI 仅在存在时渲染脚注）。
  modelUsed?: string;
  pagesGathered?: number;
  takesGathered?: number;
  graphHits?: number;
  rounds?: number;
  synthesisOk?: boolean;
  [k: string]: unknown;
}

// --- Compiled Truth 工作台（/compile 页）---

/** MIRROR OF operations.ts `find_conflicts` 组成员（已 enrich 的候选页）。 */
export interface ConflictMember {
  slug: string;
  title: string;
  type: string;
  updated_at: string;
  excerpt: string;
}

/** MIRROR OF operations.ts `find_conflicts` 冲突组。 */
export interface ConflictGroup {
  id: string;
  topic: string;
  source: 'probe' | 'cluster';
  severity: 'low' | 'medium' | 'high' | null;
  members: ConflictMember[];
}

/** MIRROR OF operations.ts `find_conflicts` 返回。 */
export interface FindConflictsResult {
  groups: ConflictGroup[];
  source: 'probe' | 'cluster';
  note?: string;
}

/** MIRROR OF compile-truth.ts `CompileDiffRow`。 */
export interface CompileDiffRow {
  op: 'keep' | 'merge' | 'add' | 'remove';
  text: string;
}

/** MIRROR OF operations.ts `compile_truth` 返回。 */
export interface CompileTruthResult {
  compiled_markdown: string;
  diff: CompileDiffRow[];
  model_used: string;
  sources: string[];
  warnings: string[];
}

/** MIRROR OF operations.ts `adopt_compiled_truth` 返回。 */
export interface AdoptCompiledTruthResult {
  slug: string;
  status: 'imported' | 'skipped' | 'error';
  compiled_from: string[];
}

// --- 后台调度（/jobs 页）类型镜像 ---

/** MIRROR OF minions/types.ts `MinionJob`（宽松：仅 UI 渲染用到的字段）。 */
export interface MinionJobRow {
  id: number;
  name: string;
  queue: string;
  status:
    | 'waiting'
    | 'active'
    | 'completed'
    | 'failed'
    | 'delayed'
    | 'dead'
    | 'cancelled'
    | 'waiting-children'
    | 'paused';
  data: Record<string, unknown>;
  attempts_made: number;
  max_attempts: number;
  parent_job_id: number | null;
  depth: number;
  error_text: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** v0.43.x fork: backend-authoritative lane, derived from worker.register(...) names in jobs.ts. */
  execution_lane: 'shell' | 'subagent' | 'handler';
}

/** MIRROR OF commands/status.ts `CycleRow`（buildCycleSnapshot 的一行）。 */
export interface CycleRow {
  finished_at: string | null;
  name: string;
  status: string;
  duration_ms: number | null;
  totals: Record<string, unknown> | null;
  /** v0.43.x fork: per-phase real duration_ms, projected from result.report.phases (already computed by runCycle). */
  phases: Array<{ phase: string; status: string; duration_ms: number; summary: string }> | null;
}

/**
 * MIRROR OF commands/status.ts `CycleSnapshot`（宽松：get_status_snapshot 返回体
 * 里仅取 `.cycle`，其余字段（sync/locks/workers/queue/autopilot）本页不用）。
 */
export interface StatusSnapshotResult {
  cycle?: { last_full: CycleRow | null; last_targeted: CycleRow | null };
  [k: string]: unknown;
}
