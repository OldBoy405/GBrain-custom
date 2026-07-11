import { describe, it, expect } from 'vitest';
import { extractTypedLinks, DEFAULT_DEMO_TEXT } from './typed-link-extract';

describe('extractTypedLinks', () => {
  it('从默认演示文案抽出 4 条边（四个动词各一次）', () => {
    const links = extractTypedLinks(DEFAULT_DEMO_TEXT);
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.predicate)).toEqual(['invested_in', 'founded', 'advises', 'works_at']);
    expect(links[0]).toMatchObject({ subject: 'Sequoia', object: 'Stripe', evidence: 'invested in' });
    expect(links[3]).toMatchObject({ subject: 'Alice Rivera', object: 'Stripe', evidence: 'works at' });
  });

  it('确定性：同输入多次结果一致', () => {
    expect(extractTypedLinks(DEFAULT_DEMO_TEXT)).toEqual(extractTypedLinks(DEFAULT_DEMO_TEXT));
  });

  it('大小写不敏感命中动词，但要求专有名词作 subject/object', () => {
    expect(extractTypedLinks('Acme INVESTED IN Widget')).toEqual([
      { subject: 'Acme', predicate: 'invested_in', object: 'Widget', evidence: 'invested in' },
    ]);
  });

  it('无专有名词 → 不产出边', () => {
    expect(extractTypedLinks('she invested in things')).toEqual([]);
  });

  it('无动词 → 空数组', () => {
    expect(extractTypedLinks('Alice Rivera and Stripe met yesterday')).toEqual([]);
  });

  it('一句只取第一个动词，避免重复', () => {
    const links = extractTypedLinks('Acme founded Widget which invested in Beta');
    expect(links).toHaveLength(1);
    expect(links[0].predicate).toBe('founded');
  });
});
