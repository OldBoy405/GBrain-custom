import type { ComponentType } from 'react';
import {
  Home,
  Inbox,
  MessageCircleQuestionMark,
  Network,
  Layers,
  Cpu,
  Wrench,
  GitCompare,
  type LucideProps,
} from 'lucide-react';

/**
 * 配置化路由/导航的单一真相。侧边栏与页面派发都从这里生成 —— 加页 = 加一行。
 *
 * 双表层共存（见 admin/docs/FRONTEND_PLAN.zh.md §0 路线 A）：
 * - brain 表层：8 个新页，hash 带前导斜杠（'/'、'/inbox'…），匹配示例 URL；
 * - ops 表层：现有 6 页，hash 为裸名（'dashboard'…），行为保持不变。
 * '/jobs'(brain 后台调度) 与 'jobs'(ops JobsWatch) 靠前导斜杠天然区分，不冲突。
 */

export type Surface = 'ops' | 'brain';

export interface NavRoute {
  /** hash 路由键（brain 带前导斜杠，ops 为裸名） */
  path: string;
  label: string;
  /** 侧边栏分组（仅 brain 表层渲染分组头） */
  group: string;
  surface: Surface;
  icon?: ComponentType<LucideProps>;
}

export const BRAIN_ROUTES: NavRoute[] = [
  { path: '/', label: '今日动态', group: '工作台', surface: 'brain', icon: Home },
  { path: '/inbox', label: '内容入库', group: '工作台', surface: 'brain', icon: Inbox },
  { path: '/ask', label: '精准检索', group: '工作台', surface: 'brain', icon: MessageCircleQuestionMark },
  { path: '/graph', label: '知识网络', group: '知识网络', surface: 'brain', icon: Network },
  { path: '/synthesize', label: '真理沉淀', group: '知识网络', surface: 'brain', icon: Layers },
  { path: '/jobs', label: '后台调度', group: '后台引擎', surface: 'brain', icon: Cpu },
  { path: '/skills', label: '技能进化', group: '后台引擎', surface: 'brain', icon: Wrench },
  { path: '/three-paradigms', label: '三大范式', group: '行业参考', surface: 'brain', icon: GitCompare },
];

export const OPS_ROUTES: NavRoute[] = [
  { path: 'dashboard', label: 'Dashboard', group: 'Ops', surface: 'ops' },
  { path: 'agents', label: 'Agents', group: 'Ops', surface: 'ops' },
  { path: 'log', label: 'Request Log', group: 'Ops', surface: 'ops' },
  { path: 'calibration', label: 'Calibration', group: 'Ops', surface: 'ops' },
  { path: 'jobs', label: 'Jobs Watch', group: 'Ops', surface: 'ops' },
];

export const ALL_ROUTES: NavRoute[] = [...BRAIN_ROUTES, ...OPS_ROUTES];

/** 保留现有落地页行为：空 hash → ops dashboard。 */
export const DEFAULT_ROUTE = 'dashboard';

/** 解析 hash：路径键 + 查询参数（如 #/ask?q=foo）。 */
export function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const raw = hash.replace(/^#/, '');
  const key = raw === '' ? DEFAULT_ROUTE : raw;
  const qIndex = key.indexOf('?');
  if (qIndex === -1) {
    return { path: key, query: new URLSearchParams() };
  }
  return {
    path: key.slice(0, qIndex),
    query: new URLSearchParams(key.slice(qIndex + 1)),
  };
}

/** 去掉前导 '#' 与查询串，空则回落默认路由。 */
export function normalizeHash(hash: string): string {
  return parseHash(hash).path;
}

export function resolveRoute(hash: string): NavRoute | undefined {
  const { path } = parseHash(hash);
  return ALL_ROUTES.find((r) => r.path === path);
}
