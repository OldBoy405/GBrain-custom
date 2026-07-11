/**
 * Why? 教育按钮 topic 目录（静态文案 + 源码引用）。
 */

export type WhyTopicId =
  | 'enrichment-pipeline'
  | 'typed-link-extraction'
  | 'retrieval-stack-overview'
  | 'typed-link-precision'
  | 'source-aware-sql-boost'
  | 'typed-link-zero-llm'
  | 'compiled-truth-cache'
  | 'minions-queue'
  | 'dream-cycle'
  | 'trace-rrf-boost'
  | 'skillify-permanent-fix'
  | 'sse-activity-feed';

export type WhyComparisonRow = {
  label: string;
  chosen: string;
  alternative: string;
};

export type WhySourceRef = {
  path: string;
  hint?: string;
};

export type WhyTopicContent = {
  id: WhyTopicId;
  tooltip: string;
  title: string;
  summary?: string;
  bullets: string[];
  comparison?: WhyComparisonRow[];
  sources: WhySourceRef[];
};

const enrichmentPipeline: WhyTopicContent = {
  id: 'enrichment-pipeline',
  tooltip: '为什么 enrichment 是 4 步串行 · 不是一次 LLM 总结？',
  title: '为什么 enrichment 是 4 步串行 · 不是一次 LLM 总结？',
  summary:
    '入库 enrichment 把「结构化 → 元数据 → 关系边 → 落盘」拆成可独立检查的四步，而不是让 LLM 一次吐出最终页面。',
  bullets: [
    '可审计：每步产出可单独 diff（RAW vs ENRICHED），失败停在明确状态。',
    '确定性优先：typed-link 用英文动词正则抽边，零 LLM token。',
    '可重跑：RAW 永久保留，某步失败只重跑该步，不必整页重来。',
    '与实体 enrich 解耦：inbox 4 步是入库结构化；外部 API 画像 enrich 是另一粒度。',
  ],
  comparison: [
    { label: '可审计', chosen: '每步可检查、可 ablate', alternative: '一次 LLM 黑盒，难回归' },
    { label: '失败恢复', chosen: '单步重跑', alternative: '整页丢弃重来' },
    { label: '关系边', chosen: '正则 + wikilink，确定性', alternative: 'LLM 幻觉边，难对账' },
  ],
  sources: [
    { path: 'src/core/inbox.ts', hint: '收件箱队列与状态机' },
    { path: 'src/core/minions/handlers/inbox-enrich.ts', hint: '4 步流水线 handler' },
    { path: 'src/core/link-extraction.ts', hint: 'inferLinkType 优先级' },
    { path: 'skills/ingest/SKILL.md', hint: 'ingest 路由与 Iron Law' },
  ],
};

const typedLinkExtraction: WhyTopicContent = {
  id: 'typed-link-extraction',
  tooltip: '为什么 typed-link 是 4 个正则 · 不是 LLM 抽？',
  title: '为什么 typed-link 是 4 个正则 · 不是 LLM 抽？',
  summary:
    '关系边在写入时就用英文动词模式匹配抽取，附带证据引文，供检索与图谱消费——不等到查询时再让 LLM「猜」关系。',
  bullets: [
    '零 LLM：works_at / invested_in / advises / founded 等由正则与 schema-pack 动词表驱动。',
    '可追溯：每条边带 context 引文，UI 右侧 italic 证据可满足「可反驳」。',
    '优先级确定：founded > invested_in > advises > works_at > mentions（inferLinkType）。',
    '写入即建联：put_page 后自动投影边，#/graph 与 relationalRetrieval 直接消费。',
  ],
  sources: [
    { path: 'src/core/link-extraction.ts', hint: 'WORKS_AT_RE、INVESTED_IN_RE 等' },
    { path: 'docs/architecture/schema-packs.md', hint: '动词表与 page type' },
    { path: 'src/core/search/relational-recall.ts', hint: '关系召回消费 typed 边' },
  ],
};

const retrievalStackOverview: WhyTopicContent = {
  id: 'retrieval-stack-overview',
  tooltip: '为什么用 ~20 项算子叠加 · 不是 1 个 magic？',
  title: '为什么用 ~20 项算子叠加 · 不是 1 个 magic？',
  summary:
    '混合检索把意图、缓存、扩展、向量、关键词、关系、RRF、精排、截断、预算等拆成可独立 ablate 的算子链——没有单点 silver bullet。',
  bullets: [
    '可 ablate：BrainBench 可关掉 typed-link / compiled_truth / RRF / source boost 等单臂，量化各自贡献。',
    '确定性 + 概率混合：关系召回与 SQL boost 是确定性的；向量与精排承担语义召回。',
    '成本可控：search mode（conservative/balanced/tokenmax）打包 token 预算与 expansion 开关。',
    '缓存防污染：knobs_hash 把 mode、embedding 列、relational 等写入 cache key，避免跨配置串味。',
  ],
  comparison: [
    { label: '召回', chosen: '多臂并行 + RRF 融合', alternative: '单次 embedding top-K' },
    { label: '演进', chosen: '单臂可关、可测', alternative: '端到端黑盒难归因' },
    { label: '关系问', chosen: '第四臂 relational recall', alternative: '纯向量猜关系' },
  ],
  sources: [
    { path: 'src/core/search/hybrid.ts', hint: 'RRF K=60、compiled_truth boost' },
    { path: 'src/core/search/mode.ts', hint: 'search mode 捆绑与 knobs_hash' },
    { path: 'docs/architecture/RETRIEVAL.md', hint: '检索架构总览' },
  ],
};

const typedLinkPrecision: WhyTopicContent = {
  id: 'typed-link-precision',
  tooltip: '为什么 typed-link 抽取对关系型问题召回影响最大？',
  title: '为什么 typed-link 抽取对关系型问题召回影响最大？',
  summary:
    '关系型问题（「谁投资了 X」「A 和 B 什么关系」）在向量-only RAG 上系统性吃亏；写入时建的 typed 边让第四召回臂能确定性 fanout。',
  bullets: [
    '第四召回臂：relationalRetrieval 解析种子实体后沿图谱扩展，注入 RRF（balanced/tokenmax 默认开）。',
    '影响显著：关掉 typed-link 关系召回后，关系型问题的命中会明显变差（量化以本地 gbrain eval 复现为准，本页不引用未复现的数字）。',
    '零查询时 LLM：边在 put_page / enrichment 时已存在，查询侧只遍历图。',
    '与 mentions 边区分：动词正则边带类型与证据，mentions 是弱默认边。',
  ],
  sources: [
    { path: 'src/core/search/relational-recall.ts', hint: '关系召回 fanout' },
    { path: 'src/core/search/relational-intent.ts', hint: '关系意图判定' },
    { path: 'src/core/link-extraction.ts', hint: '写入时抽边' },
  ],
};

const sourceAwareSqlBoost: WhyTopicContent = {
  id: 'source-aware-sql-boost',
  tooltip: '为什么 source boost 写在 SQL 层 · 不在后处理？',
  title: '为什么 source boost 写在 SQL 层 · 不在后处理？',
  summary:
    '多 source 大脑里，allowedSources / source_id 过滤与加权必须在召回阶段完成，否则先捞全库再在 JS 里滤会浪费 pool 且易漏隔离。',
  bullets: [
    '源隔离密封：读路径经 sourceScopeOpts，SQL 层即带 source_id 谓词，不是事后 filter。',
    '召回效率：向量与 BM25 候选在 DB 内就按 source 加权/限制，减少跨源泄漏与无效行。',
    '消融可见：关掉 source boost 后跨源结果排序变差（量化以本地 gbrain eval 为准，视基准集而定）。',
    '与 federated 挂载一致：scalar source 与 allowedSources 数组走同一套 precedence。',
  ],
  sources: [
    { path: 'src/core/search/hybrid.ts', hint: 'hybrid 召回与 boost 链' },
    { path: 'src/core/operations.ts', hint: 'sourceScopeOpts 契约' },
    { path: 'docs/architecture/brains-and-sources.md', hint: 'Brain / Source 双轴' },
  ],
};

const typedLinkZeroLlm: WhyTopicContent = {
  id: 'typed-link-zero-llm',
  tooltip: '为什么 typed-link 写入时就建联 · 不查询时建？',
  title: '为什么 typed-link 写入时就建联 · 不查询时建？',
  summary:
    '图谱是记忆的索引，不是查询的副产品。每次 put_page 同步抽边，traverse_graph 与 relational recall 才能零延迟消费。',
  bullets: [
    'Auto-link 钩子：put_page 后 pattern match wikilink + 动词正则，无 LLM。',
    '查询时只读：traverse_graph 遍历已落盘边；不在 ask 时再 NLP 抽关系。',
    '一致性：写入与检索看到同一张 typed 图，避免「查的时候才猜边」的非确定性。',
    '失败可修：边带证据引文，入库页可人工核对后再合并。',
  ],
  sources: [
    { path: 'src/core/link-extraction.ts', hint: '抽边与 inferLinkType' },
    { path: 'src/core/operations.ts', hint: 'put_page / traverse_graph' },
    { path: 'admin/src/components/brain/ForceGraph.tsx', hint: '图谱可视化消费边' },
  ],
};

const compiledTruthCache: WhyTopicContent = {
  id: 'compiled-truth-cache',
  tooltip: '为什么 compiled_truth 给 2.0× boost · 而不是单独存表？',
  title: '为什么 compiled_truth 给 2.0× boost · 而不是单独存表？',
  summary:
    'compiled_truth 是页面上的「当前共识摘要」chunk，检索时与正文 chunk 同表存储，RRF 归一化后乘 2.0× boost，而不是维护第二套平行索引。',
  bullets: [
    '单表语义：chunk_source=compiled_truth 与正文 chunk 走同一 hybrid 管道，运维简单。',
    '2.0× boost：在 RRF 归一化后施加（COMPILED_TRUTH_BOOST），拉高人工策展摘要排名。',
    'think 产出：综合沉淀写入 compiled_truth + citations，检索与问答共享。',
    '消融：关掉 compiled_truth boost 后人工策展摘要排名下降（量化以本地 gbrain eval 为准）。',
  ],
  comparison: [
    { label: '存储', chosen: '同 pages/chunks 管道', alternative: '独立摘要表 + 双写同步' },
    { label: '检索', chosen: 'RRF 后加权', alternative: '查询时临时拼摘要' },
    { label: '审计', chosen: '与页面同 slug 溯源', alternative: '摘要与正文分裂' },
  ],
  sources: [
    { path: 'src/core/search/hybrid.ts', hint: 'COMPILED_TRUTH_BOOST = 2.0' },
    { path: 'src/core/operations.ts', hint: 'think / query 契约' },
    { path: 'docs/guides/enrichment-pipeline.md', hint: 'compiled truth 更新语义' },
  ],
};

const minionsQueue: WhyTopicContent = {
  id: 'minions-queue',
  tooltip: '为什么用 Minions 队列 · 不是 sub-agent？',
  title: '为什么用 Minions 队列 · 不是 sub-agent？',
  summary:
    '后台任务（embed、sync、enrich、inbox）走 DB 持久化 minion 队列 + 确定性 handler，而不是每次启 LLM sub-agent 编排。',
  bullets: [
    '可恢复：作业状态在 DB，kill 后可续跑；progress 经 job.updateProgress 回写。',
    '成本：shell/SQL 路径 ~百毫秒级；sub-agent 循环 ~十秒级且 token 不可控。',
    '信任边界：handler 白名单（brain-allowlist），remote MCP 不能随意提交任意 shell。',
    '可观测：jobs watch 暴露 waiting/active/stalled 与 lease 压力。',
  ],
  comparison: [
    { label: '延迟', chosen: '确定性 task ~753ms', alternative: 'sub-agent 10s+' },
    { label: '成本', chosen: '无 LLM 默认路径', alternative: '每任务多轮 completion' },
    { label: '失败', chosen: 'dead letter + 重试策略', alternative: '对话上下文丢失' },
  ],
  sources: [
    { path: 'src/commands/jobs.ts', hint: 'CLI jobs 与 watch' },
    { path: 'src/core/minions/tools/brain-allowlist.ts', hint: 'handler 白名单' },
    { path: 'skills/minion-orchestrator/SKILL.md', hint: '后台作业路由' },
  ],
};

const dreamCycle: WhyTopicContent = {
  id: 'dream-cycle',
  tooltip: '为什么夜跑多阶段 pipeline · 不是实时维护？',
  title: '为什么夜跑多阶段 pipeline · 不是实时维护？',
  summary:
    'Dream cycle 把 salience 重算、矛盾检测、schema 建议、综合摘要等重活拆成多个夜间 phase（各阶段独立可观测、可重入；具体列表见 src/core/cycle.ts 的 ALL_PHASES，含若干按 pack/config 门控的可选 phase），避免白天交互路径被拖慢。',
  bullets: [
    '批量友好：recompute、dedup、purge 等适合低峰全库扫描，不适合每次 put_page 同步做。',
    'phase 可观测：每 phase 独立进度与失败隔离，cron 触发可重入。',
    '与实时 ingest 分工：白天 capture + enrich；夜间整理、打分、沉淀 dream-cycle 摘要页。',
    '成本控制：LLM 步骤集中在夜跑预算门控内，不污染在线 query 延迟。',
  ],
  sources: [
    { path: 'src/core/cycle/synthesize.ts', hint: 'dream cycle 综合 phase' },
    { path: 'src/core/cycle/schema-suggest.ts', hint: 'schema-suggest phase' },
    { path: 'src/commands/salience.ts', hint: 'salience 与 emotional weight' },
  ],
};

const traceRrfBoost: WhyTopicContent = {
  id: 'trace-rrf-boost',
  tooltip: '为什么 RRF K=60 · 不是简单加权？',
  title: '为什么 RRF K=60 · 不是简单加权？',
  summary:
    'Reciprocal Rank Fusion 用 rank 而非原始分数融合向量/BM25/关系多路列表，K=60 是业界常用稳定常数，避免某一路分数尺度碾压另一路。',
  bullets: [
    '公式：score += 1/(K + rank)，K 越大越平滑，越小越偏向各榜榜首。',
    'K=60：与 hybrid.ts 导出常量 RRF_K 一致，BrainBench 消融可单独关闭 RRF 臂对比。',
    '多臂输入：keyword、vector、relational（+ 可选 image/cross-modal）分别排序后融合。',
    '非简单加权和：各臂分数量纲不同，RRF 只消费名次，工程上更稳。',
  ],
  comparison: [
    { label: '融合', chosen: 'RRF rank-based', alternative: 'raw score 线性加权和' },
    { label: '标定', chosen: '单一 K 超参', alternative: '每臂独立权重网格搜索' },
    { label: '可解释', chosen: '每臂贡献可查 rank', alternative: '分数尺度混用' },
  ],
  sources: [
    { path: 'src/core/search/hybrid.ts', hint: 'export const RRF_K = 60' },
    { path: 'src/core/search/query-intent.ts', hint: 'intent 加权 RRF' },
    { path: 'docs/eval/SEARCH_MODE_METHODOLOGY.md', hint: '检索评测方法论' },
  ],
};

const skillifyPermanentFix: WhyTopicContent = {
  id: 'skillify-permanent-fix',
  tooltip: '为什么 Skillify 是 11 项 checklist · 不是一个文件？',
  title: '为什么 Skillify 是 11 项 checklist · 不是一个文件？',
  summary:
    'Skill 不是单个 markdown：需要路由元数据、脚本、测试 receipt、scope 声明、与 skillpack 清单对齐——Skillify 用 11 项 checklist 防止「写了个 md 就算技能」。',
  bullets: [
    '永久修复：check 失败项必须补到仓库（脚本/测试/文档），不是临时 prompt 补丁。',
    'gbrain skillify check：输出 properly skilled / close / needs skillify 三态 verdict。',
    '与 MCP 发布门控：mcp.publish_skills 暴露的目录需通过 health 检查。',
    '进化闭环：skillpack-check + advisor 建议 → skillify 落地 → 再 check。',
  ],
  sources: [
    { path: 'skills/skillify/SKILL.md', hint: '11 项 checklist 流程' },
    { path: 'skills/skillpack-check/SKILL.md', hint: 'skillpack 健康报告' },
    { path: 'src/commands/skillify.ts', hint: 'scaffold / check CLI' },
  ],
};

const sseActivityFeed: WhyTopicContent = {
  id: 'sse-activity-feed',
  tooltip: '为什么活动流用 SSE 推送 · 不是 MCP 轮询？',
  title: '为什么活动流用 SSE 推送 · 不是 MCP 轮询？',
  summary:
    '今日动态的「实时活动」是运维审计流（哪个 Agent 调了哪个 op），走 Tier1 `/admin/events` SSE 前插推送；与 `#/ask` 的 MCP `query` 是不同信道。',
  bullets: [
    '推送 vs 拉：每次 MCP 请求立刻出现在表格，轮询会有空窗且浪费连接。',
    'Tier1 分界：HttpOnly cookie + `/admin/api/*` 管运维指标；MCP 管大脑读写，不应混查 request log。',
    '页面隐藏暂停：useSSE 在标签页隐藏时关连接，避免后台无意义重连抖动。',
    '粗指标 30s 轮询：connected_agents / error_rate 不需亚秒级，与 SSE 细流分工。',
  ],
  comparison: [
    { label: '活动流', chosen: 'SSE 前插推送', alternative: 'MCP/REST 秒级轮询' },
    { label: '鉴权', chosen: 'Tier1 cookie 会话', alternative: 'MCP Bearer（Agent 侧）' },
    { label: '数据域', chosen: 'request audit 表', alternative: 'brain pages 检索' },
  ],
  sources: [
    { path: 'admin/src/lib/useSSE.ts', hint: 'SSE 订阅与可见性暂停' },
    { path: 'admin/src/pages/brain/Today.tsx', hint: '运营概览编排' },
    { path: 'admin/src/api.ts', hint: 'stats / health Tier1' },
    { path: 'src/commands/serve-http.ts', hint: '/admin/events 推送' },
  ],
};

export const WHY_TOPICS: Record<WhyTopicId, WhyTopicContent> = {
  'enrichment-pipeline': enrichmentPipeline,
  'typed-link-extraction': typedLinkExtraction,
  'retrieval-stack-overview': retrievalStackOverview,
  'typed-link-precision': typedLinkPrecision,
  'source-aware-sql-boost': sourceAwareSqlBoost,
  'typed-link-zero-llm': typedLinkZeroLlm,
  'compiled-truth-cache': compiledTruthCache,
  'minions-queue': minionsQueue,
  'dream-cycle': dreamCycle,
  'trace-rrf-boost': traceRrfBoost,
  'skillify-permanent-fix': skillifyPermanentFix,
  'sse-activity-feed': sseActivityFeed,
};

export const GBRAIN_SOURCE_REPO =
  'https://github.com/OldBoy405/GBrain-custom/blob/custom%2Fmain';
