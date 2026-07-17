/** 今日动态静态文案 —— 同步自 docs/前端案例/01.GBrain _ 项目案例_今日动态.mhtml */

export const READING_NOTE_CODE = `---
type: reading-note
date: 2026-02-08
tags: [llm-memory, typed-link]
source: arxiv.org/abs/2602.xxxx
---

# typed-link 想法

论文 §4.2 提出了一个思路：

> 与其调 LLM 提取关系，不如在
> markdown 写入时用 4 个英文动词
> 正则锚点扫一遍：
> FOUNDED / INVESTED / ADVISES / WORKS_AT

零 LLM 调用 · 0.3ms/篇 · BrainBench
P@5 据说能拉到 49.1%（vs 单纯
vector RAG 的 22.1%）。

**有意思 · 待验证**`;

export const HERO_STEPS = [
  {
    glyph: '入',
    color: 'var(--color-amber)',
    bg: 'rgba(180, 83, 9, 0.08)',
    icon: 'inbox' as const,
    title: 'Inbox · 自动归集',
    desc: '邮件 / 群聊 / 笔记 / 收藏 → 自动转 markdown 落盘',
  },
  {
    glyph: '联',
    color: 'var(--color-accent)',
    bg: 'rgba(15, 118, 110, 0.08)',
    icon: 'network' as const,
    title: 'Typed-Link · 自动建联',
    desc: '4 个动词正则 · 0 LLM · 0.3ms / 篇',
  },
  {
    glyph: '问',
    color: 'var(--color-coral)',
    bg: 'rgba(212, 97, 58, 0.08)',
    icon: 'search' as const,
    title: 'Ask · 精准检索',
    desc: '12 步检索栈叠加 · BrainBench P@5 比 vector RAG 高 27 个百分点',
  },
  {
    glyph: '梦',
    color: 'var(--color-node-synthesis)',
    bg: 'rgba(123, 63, 158, 0.08)',
    icon: 'moon' as const,
    title: 'Dream Cycle · 夜间维护',
    desc: '夜里自动整理 · 标记过时 · 重算重要度',
  },
  {
    glyph: '化',
    color: 'var(--color-amber)',
    bg: 'rgba(180, 83, 9, 0.08)',
    icon: 'sparkles' as const,
    title: 'Skillify · 永久学习',
    desc: '答错被纠正一次 → 永久 skill · 同类问题不再错',
  },
] as const;

/** 微信群聊 demo 消息 */
export const WECHAT_MESSAGES = [
  { who: '小李', self: false, text: '问个事——你们 RAG 系统里 markdown 之间的关系图怎么建的？' },
  { who: '小李', self: false, text: '我现在每次新 ingest 一篇文档都跑一次 LLM 提取关系，token 烧爆了' },
  { who: '你', self: true, text: '我前阵子看过一篇论文，提议用动词正则做 zero-LLM 建联' },
  { who: '你', self: true, text: 'FOUNDED / INVESTED / ADVISES / WORKS_AT 这 4 个动词覆盖大部分实体关系' },
  { who: '你', self: true, text: '写入时直接扫 markdown，提取三元组 (subject, verb, object)' },
  { who: '小李', self: false, text: '靠！这思路可以。精度比 LLM 提取好吗？' },
  { who: '你', self: true, text: '论文里 P@5 能到 49.1%，比 vector-only 高 27 个点' },
  { who: '小李', self: false, text: '回头试试。先过会儿那个 incident 啊' },
] as const;

/** 即刻收藏 demo 内容 */
export const JIKE_BOOKMARK = {
  sourceLabel: '即刻 · 信息流随手收藏',
  date: '2026-05-06 23:14',
  title: 'garrytan/gbrain · YC 总裁开源的 Markdown 第二大脑',
  excerpt: `🔥 <strong class="text-ink">YC 总裁 Garry Tan</strong> 开源了他个人在用 12 个月的 Markdown 第二大脑：
<span class="font-mono text-coral">garrytan/gbrain</span>
<br />
<br />· 17,000+ 篇个人 markdown · Postgres + pgvector + tsvector 4 数据库原语
<br />· <strong class="text-accent">typed-link 自动建联</strong>（4 个英文动词正则 · 零 LLM）
<br />· BrainBench P@5 = <strong class="text-accent">49.1%</strong>（vs vector RAG 22.1%）
<br />· 夜间 Dream Cycle 自维护 · Skillify 永久学习
<br />
<br />
看 README 里那个 typed-link 章节，就是 4 动词正则——
<em class="text-amber">跟我之前看的论文 + 群里聊过的思路完全一样</em>。`,
  sourceUrl: 'jike.app/post/2026-05-06-23-14',
  statusLabel: '已收藏 · 未写评论',
} as const;

/** 检索结果 demo 命中列表 */
export const ASK_RESULT_HITS = [
  {
    color: 'var(--color-amber)',
    icon: 'file-text' as const,
    date: '2026-02-08',
    path: 'reading/2026-02-typed-link-paper.md',
    text: '你最早在论文 §4.2 笔记里 mark 过这个想法 · 标了"有意思 · 待验证"',
  },
  {
    color: 'var(--color-accent)',
    icon: 'message-circle' as const,
    date: '2026-04-03',
    path: 'chat/wechat-2026-04-03-typedlink.md',
    text: '微信群跟小李讨论时，你提议用 4 个英文动词正则 (FOUNDED/INVESTED/ADVISES/WORKS_AT) · 引用了 2 月论文的 P@5 49.1%',
  },
  {
    color: 'var(--color-coral)',
    icon: 'bookmark' as const,
    date: '2026-05-06',
    path: 'bookmarks/jike-2026-05-06-gbrain.md',
    text: '昨晚即刻刷到 garrytan/gbrain · README 里 typed-link 章节就是 4 动词正则的工业实现 · 你点了收藏未评论',
  },
] as const;

/** 检索答复 demo 文本 */
export const ASK_ANSWER = {
  intro: '基于你过去 12 个月的全部 markdown，我找到 <strong class="text-ink">3 个相关 fragment</strong>，按时间排序如下：',
  evolutionPath: '你 2 月在论文里 <em>认识</em> 这个想法 → 4 月在工程讨论里 <em>具体化</em>（4 个动词） → 5 月看到 <em>工业实现</em> 出现，触发收藏。',
  queryText: '我对 typed-link 这个想法的演变路径是什么？',
  operators: ['typed-link 倒排', 'tsvector 中文分词', 'Compiled Truth boost', '时间窗 boost'] as readonly string[],
  pipelineLabel: '12 步检索栈 · 4.1s',
} as const;

export const STORY_BEATS = [
  {
    index: 1,
    label: '2个月前',
    kicker: '// 状态 1 / 4 · 3个月前的论文笔记',
    title: '「3个月前 · 一篇读到一半的论文」',
    narrative: `2026-02-08 的傍晚，你在读一篇关于 LLM 长期记忆系统的论文。

看到 typed-link 这一节觉得「有点意思」——作者提议用几个英文动词当正则锚点，写入时就把 markdown 之间的关系建出来，零 LLM 调用。

你顺手在 Obsidian 里 mark 了一份读书笔记。带个 frontmatter 标了 type: reading-note。然后忘了。`,
  },
  {
    index: 2,
    label: '2周前',
    kicker: '// 状态 2 / 4 · 两周前的微信群讨论',
    title: '「两周前 · 工程师群里那场闲聊」',
    narrative: `2026-04-03 中午，工程师群里小李丢出一个问题：「typed-link 自动建联怎么实现？让 LLM 跑一遍提取关系太贵了吧」。

你想起 2 月那篇论文，回了一句：「或许可以用 4 个动词正则——FOUNDED / INVESTED / ADVISES / WORKS_AT，写入 markdown 时直接扫一遍」。

小李说「靠！这思路可以」。然后讨论就被新话题冲走了。你也没想着把这事记下来。`,
  },
  {
    index: 3,
    label: '昨天',
    kicker: '// 状态 3 / 4 · 昨天的即刻收藏',
    title: '「昨天 · 即刻刷到一条」',
    narrative: `2026-05-06 晚上，你在即刻随手刷信息流。

刷到一条：「YC 总裁 Garry Tan 开源 Markdown 第二大脑 garrytan/gbrain · 12 个月生产验证 · BrainBench P@5 49.1%」。

你点开 README 看了一眼——里面有一个章节就叫 typed-link extraction，正是用 4 个英文动词正则做的零 LLM 建联。

感觉这跟自己 2 月看的论文 + 4 月的群聊串起来，但具体哪些细节、什么时候自己第一次想到这个，已经记不清了。

你点了一下「收藏」，没写任何评论。`,
  },
  {
    index: 4,
    label: '今天',
    kicker: '// 状态 4 / 4 · 今天 · 问 GBrain',
    title: '「今天 · 问 GBrain 同一个问题」',
    narrative: `你在 GBrain 的查询框里输入：
「我对 typed-link 这个想法的演变路径是什么？」

GBrain 不是凭空猜——它把你过去 12 个月所有 markdown 全部检索一遍，跑完 12 步检索栈（vector × 3 + tsvector + RRF + Compiled Truth boost + backlink + graph traversal + LLM rerank），命中 3 个关键 fragment：02-08 论文笔记 + 04-03 群聊截图自动 ingest 的转写 + 05-06 即刻收藏。

然后按时间排好序，给你一条完整时间线 + 每条引用原始 markdown 文件路径。

这是 ChatGPT、单纯 vector RAG、Mem0 都做不到的——因为它们不知道**你过去**写过、看过、点过收藏的一切。`,
  },
] as const;
