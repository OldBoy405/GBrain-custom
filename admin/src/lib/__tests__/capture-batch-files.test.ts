import { describe, it, expect } from 'vitest';
import {
  MAX_BATCH_FILES,
  buildBatchEntries,
  formatSize,
  relativeName,
  titleFromName,
} from '../capture-batch-files';

function makeFile(name: string, content: string, opts?: { relativePath?: string }): File {
  const file = new File([content], name, { type: 'text/plain' });
  if (opts?.relativePath) {
    Object.defineProperty(file, 'webkitRelativePath', { value: opts.relativePath, configurable: true });
  }
  return file;
}

describe('titleFromName', () => {
  it('去掉扩展名，支持嵌套路径', () => {
    expect(titleFromName('notes/a.md')).toBe('a');
    expect(titleFromName('README')).toBe('README');
  });
});

describe('formatSize', () => {
  it('字节与 KB 格式化', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2.0 KB');
  });
});

describe('relativeName', () => {
  it('优先 webkitRelativePath', () => {
    const file = makeFile('a.md', 'x', { relativePath: 'folder/a.md' });
    expect(relativeName(file)).toBe('folder/a.md');
  });
});

describe('buildBatchEntries', () => {
  it('文件夹模式过滤非文本文件', async () => {
    const { entries, skipped } = await buildBatchEntries(
      [makeFile('a.md', '# A'), makeFile('photo.png', 'binary')],
      { filterText: true },
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('a.md');
    expect(skipped).toBe(1);
  });

  it('单选文件模式不过滤扩展名', async () => {
    const { entries, skipped } = await buildBatchEntries([makeFile('photo.png', 'x')], { filterText: false });
    expect(entries).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it(`超过 ${MAX_BATCH_FILES} 个文件时截断`, async () => {
    const files = Array.from({ length: MAX_BATCH_FILES + 5 }, (_, i) => makeFile(`f${i}.md`, 'x'));
    const { entries, truncated } = await buildBatchEntries(files, { filterText: false });
    expect(entries).toHaveLength(MAX_BATCH_FILES);
    expect(truncated).toBe(5);
  });
});
