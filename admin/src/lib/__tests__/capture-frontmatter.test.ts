import { describe, it, expect } from 'vitest';
import {
  normalizeForHash,
  shortHash,
  defaultInboxSlug,
  buildInboxCaptureContent,
  isDefaultTextFile,
} from '../capture-frontmatter';

describe('normalizeForHash', () => {
  it('去除 BOM、统一换行、trim', () => {
    expect(normalizeForHash('﻿hello\r\nworld\r\n  ')).toBe('hello\nworld');
  });
});

describe('shortHash', () => {
  it('相同输入产生相同哈希', () => {
    expect(shortHash('hello')).toBe(shortHash('hello'));
  });

  it('不同输入产生不同哈希（绝大多数情况）', () => {
    expect(shortHash('hello')).not.toBe(shortHash('world'));
  });

  it('输出恰好 6 位十六进制字符', () => {
    expect(shortHash('anything')).toMatch(/^[0-9a-f]{6}$/);
  });
});

describe('defaultInboxSlug', () => {
  it('生成 inbox/YYYY-MM-DD-<hash6> 形状', () => {
    const now = new Date('2026-07-13T10:00:00Z');
    const slug = defaultInboxSlug('hello world', now);
    expect(slug).toMatch(/^inbox\/2026-07-13-[0-9a-f]{6}$/);
  });

  it('同内容同一天生成同 slug（幂等）', () => {
    const now = new Date('2026-07-13T10:00:00Z');
    const a = defaultInboxSlug('same content', now);
    const b = defaultInboxSlug('same content', now);
    expect(a).toBe(b);
  });

  it('不同内容生成不同 slug', () => {
    const now = new Date('2026-07-13T10:00:00Z');
    const a = defaultInboxSlug('content A', now);
    const b = defaultInboxSlug('content B', now);
    expect(a).not.toBe(b);
  });
});

describe('buildInboxCaptureContent', () => {
  it('无 frontmatter 的正文被包一层，状态为 pending_frontmatter', () => {
    const out = buildInboxCaptureContent('plain text body');
    expect(out).toMatch(/^---\n/);
    expect(out).toContain('inbox_status: pending_frontmatter');
    expect(out).toContain('raw_content: "plain text body"');
    expect(out).toContain('source_kind: "admin-capture"');
    expect(out).toContain('captured_at:');
    expect(out).toContain('type: "note"');
    expect(out.trim().endsWith('plain text body')).toBe(true);
  });

  it('已有 frontmatter 的正文合并为单一 block，状态为 pending_typed_link', () => {
    const input = '---\ntitle: "existing"\ncustom: "kept"\n---\n\nbody here';
    const out = buildInboxCaptureContent(input);
    // 单一 frontmatter block（只出现两次 `---` 分隔，不双包裹）
    expect(out.match(/^---$/gm)?.length).toBe(2);
    expect(out).toContain('title: "existing"');
    expect(out).toContain('custom: "kept"');
    expect(out).toContain('inbox_status: pending_typed_link');
    expect(out).toContain('raw_content: "body here"');
    expect(out).toContain('body here');
  });

  it('用户已有 title 优先，不被 opts.title 覆盖', () => {
    const input = '---\ntitle: "existing"\n---\n\nbody';
    const out = buildInboxCaptureContent(input, { title: 'from opts' });
    expect(out).toContain('title: "existing"');
    expect(out).not.toContain('from opts');
  });

  it('opts.title/type/tags 在无 frontmatter 时写入', () => {
    const out = buildInboxCaptureContent('body text', {
      title: 'My Title',
      type: 'idea',
      tags: ['a', 'b'],
    });
    expect(out).toContain('title: "My Title"');
    expect(out).toContain('type: "idea"');
    expect(out).toContain('tags: ["a", "b"]');
  });

  it('特殊字符（引号/反斜杠/换行）在 raw_content 中被安全转义', () => {
    const out = buildInboxCaptureContent('line one "quoted" \\ line two\nline three');
    expect(out).toContain('raw_content: "line one \\"quoted\\" \\\\ line two\\nline three"');
  });

  it('空字符串正文仍能构建（不抛错）', () => {
    expect(() => buildInboxCaptureContent('')).not.toThrow();
  });
});

describe('isDefaultTextFile', () => {
  it('匹配 .md/.markdown/.txt/.mdx（大小写不敏感）', () => {
    expect(isDefaultTextFile('notes.md')).toBe(true);
    expect(isDefaultTextFile('NOTES.MD')).toBe(true);
    expect(isDefaultTextFile('notes.markdown')).toBe(true);
    expect(isDefaultTextFile('notes.txt')).toBe(true);
    expect(isDefaultTextFile('notes.mdx')).toBe(true);
  });

  it('拒绝非文本扩展名、无扩展名、以及看似匹配但实际不同的假阳性', () => {
    expect(isDefaultTextFile('photo.png')).toBe(false);
    expect(isDefaultTextFile('README')).toBe(false);
    expect(isDefaultTextFile('foo.mdx2')).toBe(false);
    expect(isDefaultTextFile('archive.tar.gz')).toBe(false);
  });
});
