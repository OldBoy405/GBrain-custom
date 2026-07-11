/**
 * 前端 typed-link 抽取（零 LLM · 确定性正则）。
 *
 * 演示 GBrain 「写入时建联」的机制：4 个英文动词模式在浏览器里实时抽边。
 * 与后端 src/core/link-extraction.ts 同思路（pattern match + 动词正则），
 * 这里是纯前端可复现的教学版：动词短语左右各取最近的专有名词作 subject/object。
 *
 * 纯函数、无副作用，便于单测。
 */

export interface ExtractedLink {
  subject: string;
  predicate: string;
  object: string;
  /** 命中的动词短语，作为证据。 */
  evidence: string;
}

/** 默认演示文案（占位人名 + 公开品牌，符合隐私规则；四个动词各命中一次）。 */
export const DEFAULT_DEMO_TEXT =
  'Sequoia invested in Stripe. Alice Rivera founded Acme. Alice Rivera advises OpenAI. Alice Rivera works at Stripe.';

const PREDICATES: Array<{ predicate: string; re: RegExp }> = [
  { predicate: 'invested_in', re: /\b(invested in|invests in|backed by)\b/i },
  { predicate: 'works_at', re: /\b(works at|C[TE]O at|investor at|engineer at)\b/i },
  { predicate: 'advises', re: /\b(advises|advised|advisor to)\b/i },
  { predicate: 'founded', re: /\b(founded|co-founded|acquired)\b/i },
];

// 结尾处的专有名词序列（连续大写词）。
const TRAILING_PROPER = /([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)*)\s*$/;
// 开头处的专有名词序列。
const LEADING_PROPER = /^\s*([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)*)/;

/**
 * 从一段 markdown/纯文本抽取 typed-link。
 * 按句切分；每句只取第一个命中的动词模式，要求 subject/object 均为专有名词。
 */
export function extractTypedLinks(text: string): ExtractedLink[] {
  const out: ExtractedLink[] = [];
  const sentences = text.split(/[.!?\n]+/);
  for (const sentence of sentences) {
    // 一句一边：取句中最早出现的动词模式（按位置，不按列表顺序）。
    let best: { predicate: string; evidence: string; index: number; len: number } | null = null;
    for (const { predicate, re } of PREDICATES) {
      const m = re.exec(sentence);
      if (m && (best === null || m.index < best.index)) {
        best = { predicate, evidence: m[1], index: m.index, len: m[0].length };
      }
    }
    if (!best) continue;
    const before = sentence.slice(0, best.index);
    const after = sentence.slice(best.index + best.len);
    const subjMatch = TRAILING_PROPER.exec(before.trim());
    const objMatch = LEADING_PROPER.exec(after);
    if (subjMatch && objMatch) {
      out.push({
        subject: subjMatch[1].trim(),
        predicate: best.predicate,
        object: objMatch[1].trim(),
        evidence: best.evidence.toLowerCase(),
      });
    }
  }
  return out;
}
