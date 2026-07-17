/**
 * Inbox 新建采集的纯函数：生成与后端 `prepareInboxCaptureContent`
 * （src/core/inbox.ts）等价形状的 frontmatter，使 admin 面板写入的条目
 * 与 CLI `gbrain capture` / webhook 采集的条目无法区分，从而被现有
 * enrichment 4 步流水线原样消费。不引入 YAML 解析依赖 —— 只做够用的
 * frontmatter 检测/合并，而非通用 YAML 处理。
 */

/** 去 BOM、统一换行、trim。仅用于 slug 哈希输入，不影响存储正文。 */
export function normalizeForHash(s: string): string {
  return s.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
}

/**
 * 同步、非加密的短哈希（FNV-1a，32 位，转 6 位十六进制）。只用于生成
 * 稳定的 slug 后缀（同内容同天生成同 slug，避免重复提交刷屏），不是
 * 安全属性，因此不用 crypto.subtle（异步、jsdom 下不稳定）。
 */
export function shortHash(s: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/** `inbox/YYYY-MM-DD-<hash6>`，与 CLI `gbrain capture` 的默认 slug 形状一致（哈希算法不同）。 */
export function defaultInboxSlug(body: string, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `inbox/${y}-${m}-${d}-${shortHash(normalizeForHash(body))}`;
}

/** 检测正文是否以一个 frontmatter 块开头（`---\n` 或 `---\r\n`，容忍前导 BOM）。 */
function hasFrontmatter(body: string): boolean {
  return /^---\r?\n/.test(body.replace(/^﻿/, ''));
}

/**
 * 切出 frontmatter 块的原始 YAML 文本与其后的正文。假定 `hasFrontmatter(body)` 为真。
 * 关闭围栏后的所有紧邻空行（常见的「围栏后空一行再写正文」排版习惯）一并吃掉，
 * 使 raw_content 不带一段无意义的前导空行。
 */
function splitFrontmatter(body: string): { yaml: string; rest: string } {
  const trimmed = body.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n*([\s\S]*)$/.exec(trimmed);
  if (!match) return { yaml: '', rest: trimmed };
  return { yaml: match[1], rest: match[2] };
}

/** 把简单 `key: value` 形式的行追加进已有 YAML 文本（不覆盖已存在的同名 key）。 */
function appendYamlLines(yaml: string, lines: string[]): string {
  const existingKeys = new Set(
    yaml
      .split('\n')
      .map((l) => /^([A-Za-z0-9_]+):/.exec(l)?.[1])
      .filter((k): k is string => Boolean(k)),
  );
  const toAdd = lines.filter((l) => {
    const key = /^([A-Za-z0-9_]+):/.exec(l)?.[1];
    return key ? !existingKeys.has(key) : true;
  });
  if (toAdd.length === 0) return yaml;
  return yaml.length > 0 ? `${yaml}\n${toAdd.join('\n')}` : toAdd.join('\n');
}

/** YAML 字符串标量的安全引用（转义反斜杠/双引号，换行replaced）。 */
function yamlString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

/** 文件夹选取时默认采集的文本扩展名（大小写不敏感）。 */
export const DEFAULT_TEXT_EXTENSIONS = ['.md', '.markdown', '.txt', '.mdx'] as const;

/** 文件夹递归选取后过滤非文本文件用；显式单选文件不经过此过滤。 */
export function isDefaultTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return DEFAULT_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface BuildCaptureOptions {
  title?: string;
  type?: string;
  tags?: string[];
}

/**
 * 构建可直接传给 `put_page` 的完整 Markdown（frontmatter + 正文）。
 * 已有 frontmatter 的输入按用户字段优先合并；无 frontmatter 的输入整体
 * 包一层。inbox_status 按 arrival 分类：已有 frontmatter → 'pending_typed_link'
 * （只差 typed-link 对账），否则 'pending_frontmatter'。
 */
export function buildInboxCaptureContent(body: string, opts: BuildCaptureOptions = {}): string {
  const nowIso = new Date().toISOString();
  const capturedVia = 'admin-capture';

  if (!hasFrontmatter(body)) {
    const rawContent = body;
    const lines = [
      `type: ${yamlString(opts.type ?? 'note')}`,
      ...(opts.title ? [`title: ${yamlString(opts.title)}`] : []),
      ...(opts.tags && opts.tags.length > 0 ? [`tags: [${opts.tags.map(yamlString).join(', ')}]`] : []),
      `inbox_status: pending_frontmatter`,
      `raw_content: ${yamlString(rawContent)}`,
      `source_kind: ${yamlString(capturedVia)}`,
      `captured_at: ${yamlString(nowIso)}`,
    ];
    return `---\n${lines.join('\n')}\n---\n\n${rawContent}`;
  }

  const { yaml, rest } = splitFrontmatter(body);
  const extraLines = [
    ...(opts.title ? [`title: ${yamlString(opts.title)}`] : []),
    ...(opts.type ? [`type: ${yamlString(opts.type)}`] : []),
    ...(opts.tags && opts.tags.length > 0 ? [`tags: [${opts.tags.map(yamlString).join(', ')}]`] : []),
    `inbox_status: pending_typed_link`,
    `raw_content: ${yamlString(rest)}`,
    `source_kind: ${yamlString(capturedVia)}`,
    `captured_at: ${yamlString(nowIso)}`,
  ];
  const mergedYaml = appendYamlLines(yaml, extraLines);
  return `---\n${mergedYaml}\n---\n${rest}`;
}
