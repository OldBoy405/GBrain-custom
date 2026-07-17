import { isDefaultTextFile } from './capture-frontmatter';

/** 一次弹窗会话最多处理的文件数；超出的部分截断并可见提示，避免误选巨大目录卡死 UI。 */
export const MAX_BATCH_FILES = 200;

export interface BatchFileEntry {
  key: string;
  name: string;
  size: number;
  body: string;
  included: boolean;
}

export function relativeName(file: File): string {
  const relPath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath;
  return relPath && relPath.length > 0 ? relPath : file.name;
}

/** 派生 title：取路径最后一段并去掉扩展名（如 `notes/a.md` → `a`）。 */
export function titleFromName(name: string): string {
  const base = name.split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export async function buildBatchEntries(
  files: File[],
  opts: { filterText: boolean },
): Promise<{ entries: BatchFileEntry[]; skipped: number; truncated: number }> {
  let candidates = files;
  let skipped = 0;
  if (opts.filterText) {
    const filtered = candidates.filter((f) => isDefaultTextFile(f.name));
    skipped = candidates.length - filtered.length;
    candidates = filtered;
  }
  let truncated = 0;
  if (candidates.length > MAX_BATCH_FILES) {
    truncated = candidates.length - MAX_BATCH_FILES;
    candidates = candidates.slice(0, MAX_BATCH_FILES);
  }
  const entries = await Promise.all(
    candidates.map(async (file, i) => {
      const name = relativeName(file);
      const body = await file.text();
      return {
        key: `${name}-${i}`,
        name,
        size: file.size,
        body,
        included: true,
      } satisfies BatchFileEntry;
    }),
  );
  return { entries, skipped, truncated };
}
