import { describe, expect, test } from 'bun:test';
import { groupConflicts, type RawConflictFinding } from '../src/core/conflicts.ts';
import { parseCompileJSON, coerceCompileResult } from '../src/core/compile-truth.ts';

describe('groupConflicts (union-find over probe pairs)', () => {
  test('folds transitively-overlapping pairs into one component', () => {
    const findings: RawConflictFinding[] = [
      { a: { slug: 'a' }, b: { slug: 'b' }, axis: 'dream-cycle', severity: 'low' },
      { a: { slug: 'b' }, b: { slug: 'c' }, axis: 'dream-cycle', severity: 'high' },
    ];
    const groups = groupConflicts(findings);
    expect(groups).toHaveLength(1);
    expect(groups[0].slugs).toEqual(['a', 'b', 'c']);
    expect(groups[0].source).toBe('probe');
    // Topic = most frequent axis.
    expect(groups[0].topic).toBe('dream-cycle');
    // Severity = max across the component.
    expect(groups[0].severity).toBe('high');
  });

  test('keeps disjoint pairs as separate groups', () => {
    const findings: RawConflictFinding[] = [
      { a: { slug: 'a' }, b: { slug: 'b' }, axis: 'x' },
      { a: { slug: 'p' }, b: { slug: 'q' }, axis: 'y' },
    ];
    const groups = groupConflicts(findings);
    expect(groups).toHaveLength(2);
    const slugSets = groups.map((g) => g.slugs.join(','));
    expect(slugSets).toContain('a,b');
    expect(slugSets).toContain('p,q');
  });

  test('drops self-pairs and singletons', () => {
    const findings: RawConflictFinding[] = [
      { a: { slug: 'x' }, b: { slug: 'x' } }, // self — ignored
    ];
    expect(groupConflicts(findings)).toHaveLength(0);
  });

  test('orders by severity then member count (deterministic)', () => {
    const findings: RawConflictFinding[] = [
      { a: { slug: 'lo1' }, b: { slug: 'lo2' }, severity: 'low' },
      { a: { slug: 'hi1' }, b: { slug: 'hi2' }, severity: 'high' },
    ];
    const groups = groupConflicts(findings);
    expect(groups[0].severity).toBe('high');
  });
});

describe('parseCompileJSON', () => {
  test('parses plain JSON', () => {
    expect(parseCompileJSON('{"compiled_markdown":"x","diff":[]}')).toEqual({
      compiled_markdown: 'x',
      diff: [],
    });
  });

  test('strips ```json fences', () => {
    const out = parseCompileJSON('```json\n{"compiled_markdown":"y"}\n```');
    expect((out as { compiled_markdown: string }).compiled_markdown).toBe('y');
  });

  test('extracts first {...} block amid prose', () => {
    const out = parseCompileJSON('here you go: {"compiled_markdown":"z"} done');
    expect((out as { compiled_markdown: string }).compiled_markdown).toBe('z');
  });

  test('returns null on unparseable text', () => {
    expect(parseCompileJSON('not json at all')).toBeNull();
  });
});

describe('coerceCompileResult', () => {
  test('validates diff ops and drops unknown ones', () => {
    const parsed = {
      compiled_markdown: '## merged',
      diff: [
        { op: 'keep', text: 'a' },
        { op: 'bogus', text: 'b' },
        { op: 'merge', text: '' }, // empty text dropped
        { op: 'add', text: 'c' },
      ],
    };
    const r = coerceCompileResult(parsed, 'fallback');
    expect(r.malformed).toBe(false);
    expect(r.compiled_markdown).toBe('## merged');
    expect(r.diff).toEqual([
      { op: 'keep', text: 'a' },
      { op: 'add', text: 'c' },
    ]);
  });

  test('falls back to raw text when markdown missing', () => {
    const r = coerceCompileResult({ diff: [] }, 'raw body');
    expect(r.malformed).toBe(true);
    expect(r.compiled_markdown).toBe('raw body');
  });

  test('malformed when parsed is not an object', () => {
    const r = coerceCompileResult(null, 'raw');
    expect(r.malformed).toBe(true);
    expect(r.compiled_markdown).toBe('raw');
  });
});
