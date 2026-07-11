# Brain 表层「Why?」教育按钮实现方案

> 状态：阶段 A + B 已实现（11 处 Why? 全站接入）
> 依据：`admin/docs/前端案例/*.mhtml` 逆向 + `INBOX_PAGE_ANALYSIS.zh.md` §六  
> 约束：全部改动限定在 `admin/`，零上游触碰；复用 Brain 表层 token 与现有 `Drawer`

---

## 0. 目标

在 Brain 8 页中复刻案例的 **Why? 教育按钮**：悬停给一句「为什么这样设计」，点击打开**原理说明 + 源码引用**面板。  
**不参与业务逻辑**——不触发 enrichment、不改检索参数、不写库。

### 非目标

- 不复刻 beyondata 课件平台的 `data-onboarding-root` / `data-ff-autopilot` 全站引导系统  
- 不做右下角「查看引导」浮 dock（案例 `CaseExitBridge` 专属）  
- 不把 topic 内容做成远程 CMS；首期全部前端静态 catalog

---

## 1. 案例规格（必须对齐）

### 1.1 按钮 DOM / 样式

```html
<button
  type="button"
  data-why-topic="enrichment-pipeline"
  title="为什么 enrichment 是 4 步串行 · 不是一次 LLM 总结？"
  class="inline-flex items-center gap-1 rounded-md border border-hairline
         bg-elevated px-2 py-0.5 text-[11px] font-mono text-accent
         hover:bg-accent-soft hover:border-accent/30 transition"
>
  <CircleQuestionMark size={11} aria-hidden />
  Why?
</button>
```

| 行为 | 案例实现 | admin 落地 |
|------|----------|------------|
| 悬停 | 浏览器 `title` tooltip + CSS hover | 同左 |
| 点击 | onboarding 按 `data-why-topic` 开面板 | `WhyProvider` + 右侧 `Drawer` |
| 键盘 | 未在快照中体现 | `button` 原生可聚焦；面板 `Escape` 关闭 |
| 业务副作用 | 无 | 无 |

### 1.2 放置模式

- **行内后缀**：静态说明文案 + `·` + `Why?`（工具栏 `ml-auto` 右对齐）  
- **区块标题后缀**：如 typed-link 列表标题旁再挂一颗  
- 图标统一 `lucide-react` 的 `CircleQuestionMark`，11px

### 1.3 面板内容结构（从案例「原理说明与源码引用」归纳）

每条 topic 固定四段：

1. **问题标题**（与 `title` 一致，问句形式）  
2. **设计取舍**（2–4 条 bullet：可审计 / 确定性 / 成本 / 可重跑）  
3. **对照表**（可选：案例式「4 步串行 vs 一次 LLM」）  
4. **源码引用**（`repo` 内相对路径 + 可选行号；链到 GitHub 用占位 org `garrytan/gbrain`）

---

## 2. 架构

```
BrainLayout
  └── WhyProvider          ← 全局单例面板状态
        ├── {children}     ← 各 Brain 页
        └── WhyPanel       ← 复用 Drawer，挂 layout 层

WhyButton(topic)           ← 行内按钮，onClick → openWhy(topic)
why-topics.ts              ← topic id → WhyTopicContent（静态 catalog）
```

### 2.1 为何不用每页各自 Drawer

- 案例是**单例 onboarding root**；对齐为 layout 级一个面板，避免 z-index / 滚动锁冲突  
- 未来可加 `#/inbox?why=enrichment-pipeline` 深链，Provider 在 `BrainLayout` 读 hash 即可

### 2.2 与现有 `Drawer` 的关系

复用 `admin/src/components/brain/Drawer.tsx`：

- 宽：`--width-brain-drawer`（已有 `clamp(18rem, 40vw, 25rem)`）  
- 遮罩点击关闭、`✕` 关闭  
- 内容区用 `type-serif` 标题 + `font-mono` 源码块（对齐 Brain DESIGN §字体）

**不**为 Why 单独做 bottom sheet；案例截图的 tooltip 是 hover，面板是 click 后右侧/浮层，与现有图谱 Drawer 一致。

---

## 3. 组件 API（草案）

### `WhyButton`

```tsx
// admin/src/components/brain/WhyButton.tsx
export function WhyButton({
  topic,
  className?,
}: {
  topic: WhyTopicId;
  className?: string;
}) 
```

- 从 `WHY_TOPICS[topic].tooltip` 读 `title`  
- `data-why-topic={topic}` 保留，便于 E2E：`getByTestId` 或 `querySelector('[data-why-topic="…"]')`  
- 建议加 `data-testid={`why-${topic}`}`

### `WhyProvider` / `useWhy`

```tsx
type WhyContext = {
  topic: WhyTopicId | null;
  open: (id: WhyTopicId) => void;
  close: () => void;
};
```

- `BrainLayout` 包裹 `<WhyProvider>`  
- `WhyPanel` 在 Provider 内渲染，`open={topic !== null}`

### `why-topics.ts`

```tsx
export type WhyTopicId =
  | 'enrichment-pipeline'
  | 'typed-link-extraction'
  | 'retrieval-stack-overview'
  | 'typed-link-precision'
  | 'source-aware-sql-boost'
  | 'typed-link-zero-llm'
  | 'compiled-truth-cache'
  | 'minions-queue'
  | 'dream-cycle'
  | 'trace-rrf-boost'
  | 'skillify-permanent-fix';
  // 第 12 处：今日动态页案例页脚宣称有 12 处，MHTML 快照仅确认 11 处；
  // 预留 'salience-scoring' 或今日动态专用 topic，落地时对照最新案例补全。

export type WhyTopicContent = {
  id: WhyTopicId;
  tooltip: string;       // button title
  title: string;         // 面板 H1
  summary?: string;      // 首段导语
  bullets: string[];
  comparison?: { label: string; case: string; alt: string }[];
  sources: { path: string; hint?: string }[];
};
```

---

## 4. Topic 目录（MHTML 已确认 11 处）

| # | topic id | 页面 | 挂载位置 | tooltip（案例原文） |
|---|----------|------|----------|---------------------|
| 1 | `enrichment-pipeline` | `#/inbox` | 批量工具栏右侧 | 为什么 enrichment 是 4 步串行 · 不是一次 LLM 总结？ |
| 2 | `typed-link-extraction` | `#/inbox` | 详情 typed-link 区标题 | 为什么 typed-link 是 4 个正则 · 不是 LLM 抽？ |
| 3 | `retrieval-stack-overview` | `#/ask` | PageHeader 副标题行尾 | 为什么用 ~20 项算子叠加 · 不是 1 个 magic？ |
| 4 | `typed-link-precision` | `#/ask` | 结果/管道区 | 为什么 typed-link 抽取能带来 P@5 +27 点？ |
| 5 | `source-aware-sql-boost` | `#/ask` | 结果/管道区 | 为什么 source boost 写在 SQL 层 · 不在后处理？ |
| 6 | `typed-link-zero-llm` | `#/graph` | PageHeader 副标题 | 为什么 typed-link 写入时就建联 · 不查询时建？ |
| 7 | `compiled-truth-cache` | `#/synthesize` | PageHeader 副标题 | 为什么 compiled_truth 给 2.0× boost · 而不是单独存表？ |
| 8 | `minions-queue` | `#/jobs` | PageHeader 副标题 | 为什么用 Minions 队列 · 不是 sub-agent？ |
| 9 | `dream-cycle` | `#/jobs` | PageHeader 副标题 | 为什么夜跑 9 phase · 不是实时维护？ |
| 10 | `trace-rrf-boost` | `#/jobs` | Trace 区块 | 为什么 RRF K=60 · 不是简单加权？ |
| 11 | `skillify-permanent-fix` | `#/skills` | PageHeader 副标题 | 为什么 Skillify 是 11 项 checklist · 不是一个文件？ |

### 4.1 `#/inbox` 两条 topic 内容要点（首期必写）

**`enrichment-pipeline`**

- bullets：可审计（每步可 diff）/ 确定性 typed-link 零 LLM / 失败可重跑单步 / RAW 永久保留  
- comparison：4 步串行 vs 一次 LLM 总结（黑盒、难回归、难 ablate）  
- sources：`src/core/inbox.ts`、`src/core/minions/handlers/inbox-enrich.ts`、`skills/ingest/SKILL.md`

**`typed-link-extraction`**

- bullets：`inferLinkType` 优先级 `founded > invested_in > advises > works_at > mentions`  
- sources：`src/core/link-extraction.ts`、`docs/architecture/schema-packs.md`

（其余 9 条在阶段 B 按页补全，结构同上。）

---

## 5. 分阶段实施

### 阶段 A — 基础设施 + Inbox（P0，约 0.5–1 天）

| 步骤 | 产出 |
|------|------|
| A1 | `why-topics.ts`：类型 + `enrichment-pipeline` / `typed-link-extraction` 全文 |
| A2 | `WhyButton.tsx`、`WhyProvider.tsx`、`WhyPanel.tsx` |
| A3 | `BrainLayout` 接入 Provider + Panel |
| A4 | `Inbox.tsx` 工具栏：`<span>` → `<WhyButton topic="enrichment-pipeline" />` |
| A5 | `TypedLinkTable.tsx` 标题行加 `<WhyButton topic="typed-link-extraction" />` |
| A6 | `WhyButton.test.tsx`：点击打开面板、显示 title、Escape/遮罩关闭 |
| A7 | `components/brain/index.tsx` export；`DESIGN.md` Brain 组件表补一行 |

**验收**

- [ ] hover 出现案例同款 tooltip 文案  
- [ ] hover 按钮浅青底 + accent 边框  
- [ ] click 右侧 Drawer，显示 4 段结构内容  
- [ ] 点击「触发 enrichment」与 Why 互不影响  
- [ ] `bunx vitest run` 通过；`bun run typecheck` 通过  

### 阶段 B — 其余 9 topic（P1，按页 0.5 天）

| 页面 | 改动文件 |
|------|----------|
| `#/ask` | `Ask.tsx` ×3 |
| `#/graph` | `Graph.tsx` ×1 |
| `#/synthesize` | `Synthesize.tsx` ×1 |
| `#/jobs` | `Jobs.tsx` ×3 |
| `#/skills` | `Skills.tsx` ×1 |

每页仅加 `WhyButton`，内容进 `why-topics.ts`。

### 阶段 C — 增强（P2，可选）

- Hash 深链：`#/inbox?why=enrichment-pipeline` 自动 `openWhy`  
- 源码引用可点击：链到 `https://github.com/garrytan/gbrain/blob/master/{path}`  
- `localStorage` 记录「已读」topic（弱提示，非必需）  
- 第 12 topic：对照最新在线案例或 `#/` 今日动态页补一条  

---

## 6. 文件清单

```
admin/src/
  components/brain/
    WhyButton.tsx          # 新增
    WhyPanel.tsx           # 新增（薄封装 Drawer）
    WhyProvider.tsx        # 新增
    index.tsx              # export
  lib/
    why-topics.ts          # 新增：catalog + WhyTopicId
  layouts/
    BrainLayout.tsx        # 包 WhyProvider
  pages/brain/
    Inbox.tsx              # 阶段 A
    TypedLinkTable.tsx     # 阶段 A（或 InboxDetail 传 prop）
  components/brain/__tests__/
    WhyButton.test.tsx     # 新增

admin/docs/
  WHY_BUTTON_PLAN.zh.md    # 本文
  INBOX_PAGE_ANALYSIS.zh.md  # 可选：§2.2 补「已实现 Why」状态列
```

**不改动**：`src/`、`operations.ts`、根 `package.json`。

---

## 7. 样式与 a11y

- 作用域：`[data-surface='brain']` 内，token 来自 `tailwind.css` `@theme`  
- `WhyButton`：`cursor-pointer`；`focus-visible:ring-2 ring-accent/40`（键盘可见）  
- `WhyPanel`：标题 `type-serif`；正文 `text-brain-sm text-ink-soft`；源码 `font-mono text-brain-xs`  
- 面板打开时：`body overflow` 不锁（与现有 Drawer 一致）；`Escape` 调用 `close()`  
- 屏幕阅读器：按钮 `aria-label={tooltip}` 或保留可见 "Why?" + title

---

## 8. 测试策略

```tsx
// WhyButton.test.tsx（jsdom）
it('opens panel with enrichment-pipeline content', async () => {
  render(<WhyProvider><InboxToolbar /></WhyProvider>);
  await userEvent.click(screen.getByTestId('why-enrichment-pipeline'));
  expect(screen.getByText(/4 步串行/)).toBeInTheDocument();
  expect(screen.getByText(/link-extraction/)).toBeInTheDocument();
});
```

- 不测 topic 全文快照（易碎）；测 **topic id → 面板标题 + 至少一条 source path**  
- 不测 11 条全文；catalog 用 TypeScript `satisfies Record<WhyTopicId, WhyTopicContent>` 保证 **每条 id 有内容**

---

## 9. 与当前实现的 diff

| 项 | 当前 `Inbox.tsx` | 目标 |
|----|------------------|------|
| 元素 | `<span title="…">Why?</span>` | `<WhyButton topic="enrichment-pipeline" />` |
| 可点击 | 否 | 是 |
| `data-why-topic` | 无 | 有 |
| 面板 | 无 | Drawer |
| typed-link 区 | 无 Why | 标题旁第二颗 |

---

## 10. 风险与约束

| 风险 | 缓解 |
|------|------|
| topic 文案与上游实现漂移 | `sources[].path` 指向真实文件；bullets 写设计意图不写版本号 |
| 面板遮挡 inbox 详情 | Drawer 宽度上限 25rem；大屏 12 栏布局仍可见左侧列表 |
| 维护 11 条长文 | 单文件 catalog；每条控制在 ~15 行 markdown 等价 |
| 案例第 12 处未在 MHTML 出现 | 类型预留扩展；页脚文案写「11+ 处」直至确认 |

---

## 11. 建议实施顺序（给执行 agent）

1. 读 `Drawer.tsx`、`BrainLayout.tsx`、`Inbox.tsx`  
2. 实现 `why-topics.ts`（先 2 条）  
3. 实现 `WhyProvider` + `WhyPanel` + `WhyButton`  
4. 改 `BrainLayout` → `Inbox` → `TypedLinkTable`  
5. 写测试 → `bunx vitest run` → `bun run typecheck`  
6. 阶段 B 按 FRONTEND_PLAN 页面优先级（ask → graph → jobs）铺开  

---

## 相关文档

| 文档 | 说明 |
|------|------|
| `admin/docs/前端案例/02.*内容入库.mhtml` | 工具栏 Why 快照 |
| `admin/docs/INBOX_PAGE_ANALYSIS.zh.md` | §六 4 步流水线设计哲学 |
| `admin/docs/FRONTEND_PLAN.zh.md` | Brain 表层总规划 |
| `admin/DESIGN.md` | Brain 组件与 Drawer 规范 |

---

*方案供 `#/inbox` 及全站 Why 教育层落地；执行时以本文件 + 案例 MHTML 为准，不引入上游依赖。*
