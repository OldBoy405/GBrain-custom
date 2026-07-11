import { describe, it, expect } from 'vitest';
import { ALL_ROUTES, BRAIN_ROUTES, OPS_ROUTES, normalizeHash, parseHash, resolveRoute, DEFAULT_ROUTE } from './routes';

describe('parseHash', () => {
  it('剥离查询参数后保留路径键', () => {
    expect(parseHash('#/ask?q=typed-link').path).toBe('/ask');
    expect(parseHash('#/ask?q=typed-link').query.get('q')).toBe('typed-link');
  });
});

describe('normalizeHash', () => {
  it('空 hash 回落默认路由', () => {
    expect(normalizeHash('')).toBe(DEFAULT_ROUTE);
    expect(normalizeHash('#')).toBe(DEFAULT_ROUTE);
  });
  it('保留前导斜杠区分 brain 路由', () => {
    expect(normalizeHash('#/')).toBe('/');
    expect(normalizeHash('#/inbox')).toBe('/inbox');
    expect(normalizeHash('#jobs')).toBe('jobs');
  });
});

describe('resolveRoute 双表层派发', () => {
  it('brain 首页 #/ 命中今日动态', () => {
    const r = resolveRoute('#/');
    expect(r?.surface).toBe('brain');
    expect(r?.label).toBe('今日动态');
  });
  it('ops #jobs 与 brain #/jobs 不冲突', () => {
    const ops = resolveRoute('#jobs');
    const brain = resolveRoute('#/jobs');
    expect(ops?.surface).toBe('ops');
    expect(ops?.label).toBe('Jobs Watch');
    expect(brain?.surface).toBe('brain');
    expect(brain?.label).toBe('后台调度');
  });
  it('未知 hash 返回 undefined', () => {
    expect(resolveRoute('#/nope')).toBeUndefined();
  });
  it('带查询参数的 ask 路由仍可解析', () => {
    const r = resolveRoute('#/ask?q=hello');
    expect(r?.path).toBe('/ask');
    expect(r?.label).toBe('精准检索');
  });
});

describe('路由表完整性', () => {
  it('8 个 brain 页 + 5 个 ops 页', () => {
    expect(BRAIN_ROUTES).toHaveLength(8);
    expect(OPS_ROUTES).toHaveLength(5);
  });
  it('路由键全局唯一（无碰撞）', () => {
    const paths = ALL_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
  it('每个 brain 路由都带图标', () => {
    expect(BRAIN_ROUTES.every((r) => r.icon)).toBe(true);
  });
});
