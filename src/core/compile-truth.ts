/**
 * `compile_truth` core — LLM-merge a set of candidate pages into one
 * authoritative markdown body plus a keep/merge/add/remove diff.
 *
 * Mirrors the Dream Cycle synthesize merge (src/core/cycle/synthesize.ts) but
 * as a stateless proposal: it READS candidates and calls the LLM; it never
 * writes. Persistence is a separate, explicit step (`adopt_compiled_truth`).
 *
 * Model resolution reuses the same 6-tier chain `runThink` uses
 * (`resolveModel` → models.think → default → opus), and the LLM call goes
 * through the canonical `gateway.chat` seam.
 */
import type { BrainEngine } from './engine.ts';
import { resolveModel } from './model-config.ts';
import { chat as gatewayChat } from './ai/gateway.ts';
import { AIConfigError } from './ai/errors.ts';
import { stripFences, tryParse, repairJson } from './eval-shared/json-repair.ts';

export type CompileDiffOp = 'keep' | 'merge' | 'add' | 'remove';

export interface CompileDiffRow {
  op: CompileDiffOp;
  text: string;
}

export interface CompileTruthResult {
  /** The merged, deduped, authoritative markdown body (no frontmatter). */
  compiled_markdown: string;
  /** Explainable diff of how the merge was derived. */
  diff: CompileDiffRow[];
  /** "provider:model" that produced the merge. */
  model_used: string;
  /** The candidate slugs actually fed to the merge (existing pages only). */
  sources: string[];
  /** Non-fatal notes (missing candidates, malformed LLM output, …). */
  warnings: string[];
}

export interface CompileTruthOpts {
  slugs: string[];
  topic?: string;
  model?: string;
  sourceId?: string;
  sourceIds?: string[];
  /** Test seam: bypass the gateway with a canned raw LLM response. */
  stubResponse?: string;
}

const DIFF_OPS: ReadonlySet<string> = new Set<CompileDiffOp>(['keep', 'merge', 'add', 'remove']);
const MAX_OUTPUT_TOKENS = 2048;

/**
 * Strip code fences / extract the first {...} block, then JSON.parse —
 * composed from the shared eval-shared/json-repair.ts primitives (same
 * fence-strip + repair strategies `parseModelJSON` uses) rather than a
 * second hand-rolled implementation.
 */
export function parseCompileJSON(text: string): unknown {
  const cleaned = stripFences(text).trim();
  const direct = tryParse(cleaned);
  if (direct !== null) return direct;

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  const obj = match[0];
  const parsed = tryParse(obj);
  if (parsed !== null) return parsed;

  return tryParse(repairJson(obj));
}

/** Coerce arbitrary parsed JSON into a validated CompileTruthResult payload. */
export function coerceCompileResult(
  parsed: unknown,
  fallbackText: string,
): { compiled_markdown: string; diff: CompileDiffRow[]; malformed: boolean } {
  if (!parsed || typeof parsed !== 'object') {
    return { compiled_markdown: fallbackText.trim(), diff: [], malformed: true };
  }
  const r = parsed as Record<string, unknown>;
  const md = typeof r.compiled_markdown === 'string' ? r.compiled_markdown : '';
  const diffRaw = Array.isArray(r.diff) ? r.diff : [];
  const diff: CompileDiffRow[] = [];
  for (const row of diffRaw) {
    if (!row || typeof row !== 'object') continue;
    const op = (row as Record<string, unknown>).op;
    const text = (row as Record<string, unknown>).text;
    if (typeof op === 'string' && DIFF_OPS.has(op) && typeof text === 'string' && text.trim()) {
      diff.push({ op: op as CompileDiffOp, text: text.trim() });
    }
  }
  if (!md.trim()) {
    return { compiled_markdown: fallbackText.trim(), diff, malformed: true };
  }
  return { compiled_markdown: md.trim(), diff, malformed: false };
}

const SYSTEM_PROMPT = `你是 GBrain 的「真理编译器」。给定同一主题下的多份候选 markdown（可能互相冲突或互补），
把它们合并成一份权威、去重、按语义排序的 markdown。规则：
- 保留所有不冲突的事实；冲突处取信息更完整、更新的版本，并在合并说明里指出。
- 输出必须是**严格 JSON**，无额外文字，形如：
  {"compiled_markdown": "## 标题\\n...", "diff": [{"op":"keep|merge|add|remove","text":"一句话说明该条如何得来"}]}
- diff 用四类标注合并动作：keep=原样保留，merge=多源合并，add=新增综合，remove=剔除过时/错误。
- compiled_markdown 只含正文（不要 YAML frontmatter）。`;

/**
 * Read the candidate pages (source-scoped) and LLM-merge them.
 * Never throws on a bad LLM response — falls back to concatenation + warning.
 * Throws only on AIConfigError with an explicit model (mirrors think's gate).
 */
export async function compileTruth(
  engine: BrainEngine,
  opts: CompileTruthOpts,
): Promise<CompileTruthResult> {
  const warnings: string[] = [];
  const scope =
    opts.sourceIds && opts.sourceIds.length > 0
      ? { sourceIds: opts.sourceIds }
      : opts.sourceId
        ? { sourceId: opts.sourceId }
        : {};

  const fetched = await Promise.all(opts.slugs.map((slug) => engine.getPage(slug, scope)));
  const candidates: Array<{ slug: string; title: string; type: string; body: string }> = [];
  fetched.forEach((page, i) => {
    if (!page) {
      warnings.push(`candidate not found: ${opts.slugs[i]}`);
      return;
    }
    candidates.push({
      slug: page.slug,
      title: page.title,
      type: String(page.type),
      body: page.compiled_truth,
    });
  });

  if (candidates.length === 0) {
    return {
      compiled_markdown: '',
      diff: [],
      model_used: '',
      sources: [],
      warnings: [...warnings, 'no candidate pages to compile'],
    };
  }

  const modelUsed = await resolveModel(engine, {
    cliFlag: opts.model,
    configKey: 'models.think',
    tier: 'deep',
    fallback: 'opus',
  });

  const userMessage =
    (opts.topic ? `主题：${opts.topic}\n\n` : '') +
    candidates
      .map(
        (c, i) =>
          `### 候选 ${i + 1} · ${c.slug} (${c.type})\n标题：${c.title}\n\n${c.body}`,
      )
      .join('\n\n---\n\n');

  let rawText: string;
  if (opts.stubResponse !== undefined) {
    rawText = opts.stubResponse;
  } else {
    try {
      const res = await gatewayChat({
        model: modelUsed,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: MAX_OUTPUT_TOKENS,
      });
      rawText = res.text;
    } catch (e) {
      if (e instanceof AIConfigError && opts.model) throw e;
      // No LLM available: degrade to concatenation so the workbench still works.
      warnings.push('no LLM available; compiled via concatenation');
      const fallback = candidates.map((c) => c.body.trim()).join('\n\n');
      return {
        compiled_markdown: fallback,
        diff: candidates.map((c) => ({ op: 'keep' as const, text: `原样保留 ${c.slug}` })),
        model_used: modelUsed,
        sources: candidates.map((c) => c.slug),
        warnings,
      };
    }
  }

  const parsed = parseCompileJSON(rawText);
  const { compiled_markdown, diff, malformed } = coerceCompileResult(parsed, rawText);
  if (malformed) warnings.push('LLM output not valid JSON; used raw text as body');

  return {
    compiled_markdown,
    diff,
    model_used: modelUsed,
    sources: candidates.map((c) => c.slug),
    warnings,
  };
}
