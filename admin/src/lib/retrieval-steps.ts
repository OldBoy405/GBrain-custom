import type { QueryTrace } from './op-types';

/**
 * 12 步混合检索管道的结构说明（对齐 src/core/search/* 真实模块）。
 *
 * 共享于两处可视化：`components/brain/PipelineSteps.tsx`（Ask 页纵向清单）与
 * `components/brain/TraceWaterfall.tsx`（Ask 页横向瀑布），避免同一套步骤描述
 * 在两个组件里各写一份、日后漂移。
 */
export interface RetrievalStep {
  label: string;
  desc: string;
  /** 该步的输入（定性标签，非实时计数） */
  in: string;
  /** 该步的输出（定性标签，非实时计数） */
  out: string;
  /** 该步在 src/core/search/* 的真实实现文件（仓库相对路径），可点开跳转源码 */
  source: string;
  /** 该文件里的关键锚点提示（常量名 / 关键函数名等），帮助定位；纯提示，不做链接 */
  sourceHint?: string;
  /** 有文档 / 源码注释依据的开关或门控说明；只在确有依据时填，不猜测 */
  note?: string;
}

export const RETRIEVAL_STEPS: RetrievalStep[] = [
  {
    label: '意图识别',
    desc: '判定查询类型（实体 / 时间 / 事件 / 通用）并计算意图权重',
    in: 'raw query',
    out: 'intent + weights',
    source: 'src/core/search/query-intent.ts',
    sourceHint: '意图判定与 RRF 加权；LLM 兜底见 llm-intent.ts',
  },
  {
    label: '缓存查询',
    desc: '语义缓存命中则短路返回，按 knobs_hash + 相似度阈值匹配',
    in: 'query',
    out: 'cache hit / miss',
    source: 'src/core/search/query-cache.ts',
    sourceHint: '相似度阈值 0.92；二级失效门控见 query-cache-gate.ts',
  },
  {
    label: '多查询扩展',
    desc: '把 1 条查询扩展为多条子查询以提升召回（可关）',
    in: '1 query',
    out: 'N sub-queries',
    source: 'src/core/search/expansion.ts',
    note: '默认仅 tokenmax 模式开启（conservative / balanced 关闭）',
  },
  {
    label: '向量嵌入',
    desc: '子查询转为向量，路由到配置的 embedding 列',
    in: 'sub-queries',
    out: 'embeddings',
    source: 'src/core/search/embedding-column.ts',
    sourceHint: '解析 embedding 列与 provider',
  },
  {
    label: '向量召回',
    desc: '按 embedding 相似度并行召回候选 chunk',
    in: 'embeddings',
    out: 'vector candidates',
    source: 'src/core/search/vector.ts',
  },
  {
    label: '关键词召回',
    desc: '中文 tsvector 全文检索补召回（BM25 类）',
    in: 'raw query',
    out: 'keyword candidates',
    source: 'src/core/search/keyword.ts',
  },
  {
    label: '关系召回',
    desc: '关系型问题解析实体并沿 typed-link 图谱扩展召回',
    in: 'seed entity',
    out: 'graph neighbors',
    source: 'src/core/search/relational-recall.ts',
    sourceHint: '实体解析与置信度门控见 relational-intent.ts',
    note: '默认仅 balanced / tokenmax 开启（conservative 关闭）',
  },
  {
    label: 'RRF 融合',
    desc: '多路召回用 Reciprocal Rank Fusion（K=60）融合排序',
    in: 'multi-arm candidates',
    out: 'fused ranking',
    source: 'src/core/search/hybrid.ts',
    sourceHint: 'export const RRF_K = 60',
  },
  {
    label: '精排',
    desc: '对 top-N 用 reranker 精排（LLM / cross-encoder）',
    in: 'fused top-N',
    out: 'reranked',
    source: 'src/core/search/rerank.ts',
    note: '默认仅 tokenmax 开启；上游报错 fail-open 回退 RRF 排序',
  },
  {
    label: '自动截断',
    desc: 'autocut 在相关度断崖处截断，只留高置信簇',
    in: 'reranked',
    out: 'confident cluster',
    source: 'src/core/search/autocut.ts',
    note: '只在 reranker 产出分数时生效，否则 no-op',
  },
  {
    label: 'Token 预算',
    desc: '按 token 预算裁剪结果负载，控制下游成本',
    in: 'cluster',
    out: 'budgeted',
    source: 'src/core/search/token-budget.ts',
    note: 'conservative ≈4000 / balanced ≈12000 tokens；tokenmax 关闭（off）',
  },
  {
    label: '组装结果',
    desc: '去重 + 组装最终 SearchResult（含 score / snippet）',
    in: 'budgeted',
    out: 'results',
    source: 'src/core/search/dedup.ts',
    sourceHint: '去重后经 return-policy.ts 组装最终返回',
  },
];

/**
 * 把某一步映射到 `query` op（`trace: true`）真实返回的 QueryTrace 诊断字段——
 * hybridSearchCached 的 HybridSearchMeta，是这次查询实际发生了什么，不是示意。
 * 只在确有对应真实字段时返回文本；没有对应字段的步骤（关系召回 / RRF 融合 / 精排 /
 * 组装结果）返回 undefined —— 不编造。
 */
export function describeStepTrace(index: number, trace: QueryTrace | undefined): string | undefined {
  if (!trace) return undefined;
  switch (index) {
    case 0: // 意图识别
      return trace.intent
        ? `本次实测：意图 = ${trace.intent}${trace.detail_resolved ? ` · detail = ${trace.detail_resolved}` : ''}`
        : undefined;
    case 1: // 缓存查询
      return `本次实测：${
        trace.cache_status === 'hit' ? '缓存命中（短路返回）' : trace.cache_status === 'miss' ? '缓存未命中' : '缓存已关闭'
      }`;
    case 2: // 多查询扩展
      return `本次实测：${trace.expansion_applied ? '已触发扩展' : '未触发（模式未开或缓存已短路）'}`;
    case 4: // 向量召回
      return `本次实测：向量召回${trace.vector_enabled ? '已启用' : '未启用'}`;
    case 9: // 自动截断
      return `本次实测：${trace.autocut ? '已触发截断' : '未触发'}`;
    case 10: // Token 预算
      return `本次实测：${trace.token_budget ? '已裁剪' : '未裁剪（tokenmax 或未超预算）'}`;
    default:
      return undefined;
  }
}
