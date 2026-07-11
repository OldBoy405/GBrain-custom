# GBrain「知识网络」实现对照评估

> 对照基准：`admin/docs/前端案例/04.GBrain _ 项目案例_知识网路.mhtml`（案例站 `#/graph`）  
> 实现代码：`admin/src/pages/brain/Graph.tsx`、`admin/src/components/brain/ForceGraph.tsx`、`TypedLinkDemo.tsx`、`graph-model.ts`  
> 后端契约：`src/core/operations.ts`（`traverse_graph` / `get_stats` / `schema_stats`）、`src/core/link-extraction.ts`（后端抽边，与前端 demo 同思路）  
> 生成日期：2026-07-11

---

## 总览结论

**概念层已对齐案例目标态约 75%**：typed-link 零 LLM 演示、力导向图、三力滑块、悬停邻居高亮、Why? 按钮、节点抽屉等核心叙事一致。

与案例的差异主要在两类：

1. **有意增强**（比静态 demo 更可用）：live MCP `traverse_graph`、全库 `get_stats` / 降级 `schema_stats`、`#/graph?q=` 深链、出链跳转与「重新展开」、Vitest 覆盖、隐私合规 demo 文案。
2. **尚未 polish**（案例有、实现还没有）：30px 统计大标题、双 Tab（500 概览 / 17k 全量）、左图右栏 640px 布局、抽边结果汇入主图、Canvas 浮层图例、底部实现说明卡、Drawer page 预览。

**重要澄清**：本页是 **typed 边图谱可视化 + 写入时建联演示**，不是「精确检索」页。12 步检索管道、预设问题、消融 P@5 网格属于 `#/ask`，见 `admin/docs/ASK_PAGE_COMPARISON.zh.md`。关系召回（管道第 7 步）在 Ask 页 Why 面板中叙事，Graph 页展示的是**图拓扑本身**。

| 维度 | 对齐度 | 一句话 |
|------|--------|--------|
| 核心叙事（写入时建联） | ~90% | Why? + Live Demo + force-graph |
| Live 抽边演示 | ~80% | 结构一致；汇入方式与视觉 polish 有差 |
| 力导向交互 | ~85% | 三滑块 + 悬停 dim + 点击抽屉 |
| 图谱布局与规模策略 | ~50% | 案例双 Tab + 双栏；实现按需 explore + 单栏 |
| 真实 MCP 集成 | 实现更强 | 案例静态 17k 数字；仓库 live 遍历 |
| 页头视觉 / 沙箱标识 | ~60% | 案例大标题含统计；实现 PageHeader + 统计卡 |
| 测试 | 实现更强 | Vitest 7 条；案例仅 data-testid 钩子 |

**图例**：✅ 已对齐 / 实现更好 · ⚠️ 部分对齐 · ❌ 未实现 / 不适用

---

## 先澄清：这页在做什么

案例 MHTML 的 `#/graph` 定义的是 **知识图谱可视化 + typed-link 机制教学**：

> 宏观规模（节点/边数）→ **Live 抽边 Demo**（4 个英文动词正则 · 零 LLM）→ **双尺度图渲染**（500 节点 force-graph / 17k canvas2d）→ 力参数调优与节点探索

**不是** `query` → 12 步管道 → `think` 答问链路。站点 meta 里「12 步高精度检索」是全产品叙事，不是本页 UI 组成部分。

本页与 Ask 的间接关系：Inbox enrichment 产出的 typed-link 会成为 `#/graph` 的节点边；`#/ask` 的关系召回（`relationalRetrieval`）在图上游走同一 typed-edge 存储，但 UI 不展示检索栈。

---

## 逐项对照表

| 维度 | 案例 MHTML 目标 | 当前实现 | 状态 |
|------|----------------|----------|------|
| **1. 整体布局** | `max-w-[1280px]` + 垂直区块 + 主图 `lg:grid-cols-[1fr_320px]` | `brain-page-wide` + 垂直堆叠 | ⚠️ 部分 |
| **页头** | `// 知识图谱 · GRAPH` + **30px**「17,234 节点 · 89,512 typed-link」+ Why? | `PageHeader`「工作台 · 知识网络」+ 副标题 + WhyButton | ⚠️ 部分 |
| **页头沙箱 Badge** | 脉冲沙箱标识 | 无（顶栏/侧栏全局有） | ⚠️ 部分 |
| **2. 统计头** | 融入大标题 | 独立 `rounded-xl` 卡；live `get_stats` → 降级 `schema_stats` | ✅ 信息等价 / 实现更强 |
| **类型图例** | Canvas 右上角浮层（5 类型） | 页顶统计卡最多 10 类型 | ⚠️ 位置不同 |
| **3. Live Demo** | accent 边框 + serif 标题 + Extract(Zap) | 普通边框 + mono label + Extract | ⚠️ 部分 |
| **Demo 默认文案** | 投资人叙事（3 条边） | 隐私占位符（4 条边） | ✅ 实现更好（合规） |
| **抽边 → 主图** | 「已高亮加入下方图谱 ↓」 | 列表 + **独立 240px 演示小图**（与脑库分离） | ⚠️ 分离 vs 汇入 |
| **4. 图谱 Tab** | 概览 500 / 全量 17k | 无 Tab | ❌ |
| **5. 图谱数据** | 静态预载 | slug + depth → `traverse_graph` | ✅ 实现更强 |
| **探索表单** | 无（进页即见图） | slug 输入 + 深度 1–5 +「展开」 | ✅ 实现更强 |
| **Hash 深链** | 无 | `#/graph?q=<slug>` 自动展开 | ✅ 实现更强 |
| **6. 力导向图** | react-force-graph · 640px | react-force-graph-2d · 560px | ✅ 技术等价 |
| **三力滑块** | 右栏 320px 竖排 | 图上方 horizontal grid | ⚠️ 位置不同 |
| **悬停高亮** | 邻居高亮 · 其余 dim 0.18 | 同 | ✅ 已对齐 |
| **Canvas overlay** | 节点/边计数 Badge | 图上方文字 meta 行 | ⚠️ 部分 |
| **7. 节点抽屉** | page 预览 + 邻居数量 | slug/type/depth/出链 +「重新展开」 | ⚠️ 缺正文预览 |
| **8. 全量视图** | canvas2d + 边采样 16k + 12 cluster | 未实现 | ❌ |
| **Cosmograph WebGL** | 文档提及 1M 扩展 | 未实现 | ❌（远期） |
| **9. 底部说明卡** | 概览/全量实现要点两列 | 无 | ❌ |
| **10. Why? 按钮** | `typed-link-zero-llm` | `WhyButton` + `why-topics.ts` | ✅ 已对齐 |
| **11. 12 步检索栈** | 本页无 | 本页无 | ❌ 见 `#/ask` |
| **12. 消融分析** | 本页无 | 本页无 | ❌ 见 `#/ask` |
| **13. MCP 契约** | 静态 HTML | live `callMcp` | ✅ 实现更强 |
| **14. 测试** | data-testid 钩子 | Vitest 统计/抽边/traverse/深链 | ✅ 实现更强 |
| **FRONTEND_PLAN spec** | D3 + 聚类/god-node 折叠 | force-graph + depth 限规模 | ⚠️ 首版已落地，大规模 defer |

---

## 分块细评

### 1）整体布局与 UI 组件结构

#### 案例设计意图

- **壳层**：240px 侧栏 + 顶栏（⌘K、沙箱 Badge、帮助、GitHub）
- **内容区**：`max-w-[1280px] px-6 py-8`，`data-page="graph"`
- **页头**：
  - Kicker：`// 知识图谱 · GRAPH`
  - 大标题：`17,234 节点 · 89,512 typed-link`（30px display）
  - 副标题：双渲染策略（react-force-graph 500 节点 / canvas2d 17k）+ Live Demo 说明 + Why?（`typed-link-zero-llm`）
  - 右侧：沙箱 Badge
- **主区块顺序**：Typed-Link Demo → Tab 切换 → 双栏主图（左 canvas + 右控件）→ 底部说明卡 × 2

#### 三层叙事架构

```
L1 宏观规模 ──→ 17k 节点 / 89k typed-link（建立「这是图数据库」认知）
L2 机制演示 ──→ Live Demo（证明边是写入时 deterministic 抽出，非查询时 LLM）
L3 可视化   ──→ 双 Tab（交互探索 vs 规模展示）
```

#### 已实现

- 容器：`brain-page-wide` → `max-width: var(--max-width-brain-xwide)`
- 组件：`PageHeader`、`WhyButton`、`TypedLinkDemo`、`ForceGraph`、`Drawer`、`Badge`
- 壳层：`BrainLayout` + `BrainTopBar`（与案例侧栏/顶栏结构对齐，见 `BrainLayout.tsx` 注释）

#### 尚未对齐

| 案例 | 当前实现 |
|------|----------|
| 统计数字作为 30px 主标题 | 「知识网络」serif 标题 + 独立统计卡 |
| `// 知识图谱 · GRAPH` kicker | `// 工作台` kicker |
| Demo 区块 accent 高亮边框 | 普通 `border-hairline` |
| `lg:grid-cols-[1fr_320px]` 双栏 | 垂直堆叠：表单 → 滑块 → 全宽图 |
| 主图 `h-[640px]` | ForceGraph 默认 `560px` |
| Tab：概览 500 / 全量 17k | 无 Tab |
| 底部实现说明卡 × 2 | 无 |

**相关文件**：`admin/src/pages/brain/Graph.tsx` L107–278

---

### 2）Live Typed-Link Demo 与处理机制

#### 案例设计

- 预填 3 行 markdown；点击 Extract → 前端 4 动词正则
- 输出 3 条 `invested_in` 边 + 证据短语
- 文案强调：**全部 deterministic · 已高亮加入下方图谱**
- 教学点：GBrain 边在**写入时**建好，检索时走图遍历而非临时 LLM 抽关系

#### 当前实现

```
用户编辑 textarea
    → 点击 Extract
    → extractTypedLinks()（admin/src/lib/typed-link-extract.ts）
    → 边列表 + 可选 240px 自包含 ForceGraph（toGraph()）
```

- 默认文案：`DEFAULT_DEMO_TEXT`（占位人名 + 公开品牌，4 条边）
- 与后端 `src/core/link-extraction.ts` **同思路**（pattern + 动词正则），前端为可复现教学版
- **刻意分离**：演示小图不注入真实脑库 traverse 结果（`TypedLinkDemo.tsx` 注释）

#### 差异评价

| 项 | 案例 | 实现 | 评价 |
|----|------|------|------|
| 边数 | 3（demo 文案） | 4（不同文案） | 机制等价 |
| 汇入主图 | 抽边高亮进下方 500 节点图 | 独立小图 | ⚠️ 案例联动感更强 |
| Extract 按钮 | Zap 图标 + accent | 纯文字 | ⚠️ 视觉 polish |
| data-testid | demo/input/output/extract-button | 同名保留 | ✅ |

**相关文件**：

- `admin/src/components/brain/TypedLinkDemo.tsx`
- `admin/src/lib/typed-link-extract.ts`
- `admin/src/lib/typed-link-extract.test.ts`

---

### 3）图谱可视化与规模策略

#### 案例：双模式渲染

| 模式 | 规模 | 技术 | 交互 |
|------|------|------|------|
| 概览视图 | 500 节点 / 1503 边 | `react-force-graph` + d3-force | 缩放/拖拽/悬停/点击 |
| 全量视图 | 17,234 节点 / 89,512 边 | canvas2d 单帧 | 边采样至 16k；12 cluster 配色 |

案例底部说明卡要点：

- 三 force 滑块直连 d3-force（repulsion / link distance / centering）
- 悬停 → 邻居高亮，其余 dim 0.18
- 节点辉光 = 类型色 + 径向渐变
- 全量：节点全绘、边采样防 fill-rate 爆炸
- 远期：真实 GBrain 可用 Cosmograph WebGL 扩展到 1M 节点

#### 当前实现：按需探索

```
用户输入 root slug + depth (1–5)
    → MCP traverse_graph({ slug, depth })
    → buildGraph(data) → ForceGraph2D
    → 三力滑块实时 reheat simulation
```

- 后端 depth 默认 5，MCP cap 10（`TRAVERSE_DEPTH_CAP`）
- 无预载图：进页默认空态，需点「展开」
- `#/graph?q=<slug>` hash 深链自动 traverse
- `link_type` / `direction` 参数 op 支持，**UI 未暴露**

#### 力参数（与案例数值一致）

| 参数 | 默认 | 范围 | 案例 | 实现 |
|------|------|------|------|------|
| repulsion (charge) | -180 | -400 ~ -60 | ✅ | ✅ |
| link distance | 60 | 20 ~ 140 | ✅ | ✅ |
| centering | 0.05 | 0.01 ~ 0.2 | ✅ | ✅ |

**相关文件**：

- `admin/src/components/brain/ForceGraph.tsx`
- `admin/src/components/brain/graph-model.ts`
- `admin/src/pages/brain/Graph.tsx` L36–49、L198–234

---

### 4）节点交互与 Drawer

#### 案例（说明卡描述）

- 点击节点 → **右侧抽屉**：page 预览 + 邻居数量
- 悬停 → 邻居高亮
- Canvas 浮层：504 节点 / 1503 边 + 类型图例

#### 当前实现

- 点击 → `Drawer`：slug、type Badge、depth、出链列表（可点选跳转）
- 「以此为根重新展开」→ 以选中节点为新 root 再 `traverse_graph`
- **未实现**：page 正文 preview（需 `get_page`）、邻居计数 Badge
- 悬停 dim 0.18 + 命中边 accent 高亮：**已对齐**

**相关文件**：`admin/src/components/brain/Drawer.tsx`、`Graph.tsx` L240–277

---

### 5）类型着色与图例

#### 案例图例（Canvas 浮层）

concept · person · **paper** · company · **skill**

#### 当前 `graph-model.ts`

| 类型 | CSS token |
|------|-----------|
| concept | `--color-node-synthesis` |
| person | `--color-accent` |
| company / deal | `--color-coral` |
| source | `--color-node-source` |
| media / daily / event | `--color-node-recent` |
| writing / analysis / note | `--color-ink-soft` |
| 未知 | `--color-node-entity` |
| 根节点 | 恒 `--color-accent` |

**刻意不照抄** paper/skill：真实 gbrain-base-v2 schema pack 无此类型（见 `graph-model.ts` 注释）。

图例数据来源：live `get_stats.pages_by_type`（Top 10），非 Canvas overlay。

---

### 6）检索栈分析（12 步可视化）

**本页案例 MHTML 中不存在 12 步检索栈 UI。**

若需要该能力：

- 页面：`#/ask` + `admin/src/components/brain/PipelineSteps.tsx`
- 文档：`admin/docs/ASK_PAGE_COMPARISON.zh.md` §6

与本页连接：`relationalRetrieval`（balanced/tokenmax 模式）在 hybrid 管道中做图遍历召回——在 **Why? → `typed-link-precision`** 等主题中说明，非 Graph 页控件。

Inbox enrichment → typed edges → `#/graph` 可视化，见 `admin/docs/INBOX_PAGE_ANALYSIS.zh.md` §集成关系图。

---

### 7）消融分析

**本页案例 MHTML 中不存在消融网格。**

- 消融 UI 在 **`#/ask`**
- Graph 页可解释性来自：**typed-link 确定性抽边** + **力导向拓扑探索**，不是 P@5 算子消融

---

### 8）与其他系统模块的集成

| 集成点 | 案例 | 当前实现 | 状态 |
|--------|------|----------|------|
| MCP `traverse_graph` | 静态 JSON | live + depth + hash `?q=` | ✅ |
| MCP `get_stats` | 硬编码 17,234 / 89,512 | live；失败降级 `schema_stats` | ✅ |
| MCP `get_links` / `get_backlinks` | 未展示 | op 存在，UI 未用 | ⚠️ |
| `find_experts` / `find_contradictions` | FRONTEND_PLAN 提及 | UI 未做 | ❌ |
| Why `typed-link-zero-llm` | 页头 + Demo | PageHeader + TypedLinkDemo | ✅ |
| Inbox → Graph | 未展示 | enrichment 产出边可 traverse | ⚠️ 无深链 CTA |
| 顶栏 ⌘K | 占位 | `BrainTopBar` | ✅ 壳层共有 |
| Graph 懒加载 | — | `React.lazy` in `App.tsx` | ✅ 实现更强 |

#### 集成关系图

```
内容入库 (Inbox enrich)
    └─→ typed-link 写入 DB
            ├─→ #/graph traverse_graph（可视化）
            └─→ #/ask relational recall（检索召回）

用户 explore
    └─→ traverse_graph(slug, depth)
            └─→ ForceGraph + Drawer
                    └─→ 出链点击 / 重新展开
```

**相关文件**：

- `admin/src/lib/why-topics.ts`（`typed-link-zero-llm`、`typed-link-extraction`、`typed-link-precision`）
- `admin/docs/INBOX_PAGE_ANALYSIS.zh.md`

---

### 9）与当前仓库落地状态对比

#### 已对齐（高优先级）

- [x] Live Typed-Link Demo（4 动词正则 · 零 LLM）
- [x] Why? `typed-link-zero-llm`
- [x] react-force-graph-2d 力导向渲染
- [x] 三力滑块 + 悬停邻居高亮 / dim 0.18
- [x] 点击节点 → Drawer + 出链
- [x] live `traverse_graph` + `get_stats`
- [x] `data-testid`：typed-link-demo/input/output/extract-button
- [x] Vitest：`admin/src/pages/brain/__tests__/Graph.page.test.tsx`

#### 部分差距（polish）

| 项 | 优先级 | 说明 |
|----|--------|------|
| 页头大标题 = 统计数字 | P2 | 案例品牌感 |
| kicker `// 知识图谱 · GRAPH` | P2 | 与案例一致 |
| Demo accent 边框 + Extract 图标 | P2 | 视觉 |
| 双栏布局（图左 + 控件右 320px） | P2 | 案例主图区结构 |
| Canvas 浮层（节点/边计数 + 图例） | P2 | 信息密度 |
| 进页默认概览图（500 节点） | P3 | 需 demo 数据集或 auto-root |
| 抽边结果汇入主图 | P3 | 需定义 demo/真实图合并策略 |
| Drawer page 预览 | P3 | 需 `get_page` op 调用 |
| 底部实现说明卡 | P3 | 教学向 |

#### 实现优于案例

| 项 | 说明 |
|----|------|
| live MCP 探索 | slug + depth 真实 traverse |
| `#/graph?q=` 深链 | hash 自动展开 |
| 统计降级链 | get_stats → schema_stats |
| 隐私合规 demo 文案 | 占位符人名/品牌 |
| 出链导航 + 重新展开 | 图内多跳探索 |
| 演示图与脑库分离 | 避免假数据污染真实图 |
| Vitest 7 条 | 统计/抽边/traverse/深链 |
| graph-model 单测 | buildGraph / colorVarFor 无 DOM |

#### 远期 / 产品决策

| 项 | 说明 |
|----|------|
| 全量 17k Tab | canvas2d + 边采样；或 Cosmograph WebGL |
| god-node 折叠 / 聚类 | FRONTEND_PLAN 原 spec，首版 defer |
| link_type / direction UI | op 已支持，UI 未暴露 |

---

### 10）案例有、评估未单独列出的功能

1. **赋范空间课例壳**：面包屑、`CaseExitBridge`、查看引导（MHTML 外层，非 admin SPA）
2. **静态进页即有 500 节点图**：零交互可截图的教学快照
3. **全量视图 Tab + 12 cluster 配色**：语义聚集可视化
4. **Cosmograph 1M 节点叙事**：性能路线图教育
5. **侧栏沙箱/在线切换**：案例侧栏底部 toggle
6. **Onboarding root**：`data-onboarding-root`（案例有钩子，admin 未接）
7. **节点径向渐变辉光**：案例说明卡提及；实现为 flat 填色 + 描边
8. **FRONTEND_PLAN 大规模策略**：聚类/god-node — 首版用 depth 限规模替代

---

## 架构决策评价

| 实现选择 | 评价 |
|----------|------|
| slug 探索器 + `traverse_graph` 而非纯静态 demo | ✅ 正确：fork-safe live MCP，可探索真实脑库 |
| TypedLinkDemo 小图与主图分离 | ✅ 正确：避免正则 demo 污染 traverse 结果 |
| react-force-graph-2d 而非自研 D3 SVG | ✅ 正确：缩放/平移/性能开箱即用 |
| 无 17k 全量 Tab 首版 | ✅ 可接受：需独立渲染器；depth 限规模够用 |
| 类型色跟随 gbrain-base-v2 而非案例 paper/skill | ✅ 正确：与真实 schema 一致 |
| 统计放独立卡而非大标题 | ⚠️ 信息等价，视觉待 polish |
| Drawer 无 page 预览 | ⚠️ 可接受首版；增强需额外 op |
| FRONTEND_PLAN「聚类/god-node」未落地 | ⚠️ 文档仍有效为远期 spec |

---

## 用户体验评估

### 做得好的

1. **机制透明**：Live Demo + Why? 把「写入时建联」讲清楚，区别于 RAG 临时抽关系。
2. **真实可探索**：连上 MCP 后可从任意 slug 展开子图，比静态 500 节点更有用。
3. **力参数可调**：三滑块让密集/稀疏布局可感知调节，符合案例教学意图。
4. **失败路径**：traverse 错误展示；统计失败静默省略不阻塞探索器。
5. **fork-safe**：admin 只消费 MCP；`graph-model` 纯函数可单测。

### 可改进

1. **冷启动空态**：进页无图，新用户不知 slug 填什么；案例用预载 500 节点掩盖。
2. **视觉层级**：「知识网络」标题未传达规模感；案例「17,234 节点」一眼建立信心。
3. **Demo 与主图断层**：抽边结果在小图，未汇入下方 explore 区，叙事连贯性弱于案例。
4. **Drawer 信息偏少**：无正文 preview，策展者需另开 CLI/编辑器看 page。
5. **大规模脑库**：仅靠 depth 1–5 限规模；万级节点单 force-graph 可能卡顿，需全量 Tab 或聚类。
6. **与 Inbox / Ask 断层**：无「从 enrichment 预览跳 Graph」「从 Graph 节点跳 Ask 关系 query」CTA。

### 角色适用性

| 用户 | 本页价值 |
|------|----------|
| 知识策展者 | 高 — 看 typed 边拓扑、从 slug 探索邻域 |
| 检索调试者 | 低 — 应去 `#/ask` 看管道与来源 |
| 机制学习者 | 高 — Live Demo + Why? |
| 大规模全景 | 中 — 当前缺 17k 全量视图 |

---

## 测试覆盖

`admin/src/pages/brain/__tests__/Graph.page.test.tsx` 已覆盖：

| 用例 | 状态 |
|------|------|
| 标题「知识网络」渲染 | ✅ |
| 统计头（节点/typed-link/类型图例） | ✅ |
| get_stats 失败降级 schema_stats | ✅ |
| Extract 默认文案抽出 4 条边 | ✅ |
| slug 展开调用 traverse_graph | ✅ |
| `#/graph?q=` 深链自动展开 | ✅ |

`admin/src/components/brain/graph-model.test.ts`：buildGraph、colorVarFor。

案例仅有 `data-testid` 钩子（`graph-tab-demo`、`graph-tab-real` 等），无自动化测试。

---

## 九项关注点在本页的归属

| # | 主题 | 本页案例 | 本页仓库 | 正确页面 |
|---|------|----------|----------|----------|
| 1 | 布局/UI | ✅ 核心 | ⚠️ ~75% | `#/graph` |
| 2 | 工作流 | Demo + 双 Tab 图 | traverse + Demo | `#/graph` |
| 3 | 预设/答案/引用 | 无 | 无 | Ask 才有 |
| 4 | 分类标签 | 类型色 + Canvas 图例 | type Badge + 统计图例 | `#/graph` |
| 5 | 12 步检索栈 | ❌ | ❌ | `#/ask` |
| 6 | 消融分析 | ❌ | ❌ | `#/ask` |
| 7 | 模块集成 | 壳层+Why | + MCP+深链 | 两页共同 |
| 8 | 落地对比 | — | ~75% + 更强后端 | — |
| 9 | 未列功能 | 双 Tab、说明卡、课例壳 | 深链、测试、隐私文案 | — |

---

## 后续打磨优先级

### P1 — 布局与页头（约 2–3h）

1. kicker 改为 `// 知识图谱 · GRAPH`
2. 有 stats 时主标题展示「{N} 节点 · {M} typed-link」（保留「知识网络」为副标题或 kicker 下说明）
3. 主图区改为 `lg:grid-cols-[1fr_320px]`，滑块移入右栏；图高 640px
4. Canvas 左上角节点/边计数 overlay（traverse 结果有图时）

### P2 — Demo 视觉与联动（约 1–2h）

5. TypedLinkDemo accent 边框 + Extract Zap 图标
6. 空态引导：示例 slug chip（如 `concepts/gbrain`）一键展开
7. 可选：采纳后 CTA「在精确检索中问关系 → `#/ask?q=...`」

### P3 — 规模与 Drawer（产品决策）

8. 进页默认概览：内置 500 节点 demo JSON **或** auto traverse 热门根
9. 全量 Tab：canvas2d 渲染器 + 边采样（或 defer Cosmograph）
10. Drawer 增加 `get_page` 正文 preview + 邻居计数
11. 底部实现说明卡（概览/全量要点，可折叠）

### P4 — 文档

12. 确认 `FRONTEND_PLAN.zh.md` §graph 首版状态与远期聚类 spec 分界清晰

---

## 相关文件索引

| 文件 | 职责 |
|------|------|
| `admin/src/pages/brain/Graph.tsx` | 页面主实现 |
| `admin/src/components/brain/ForceGraph.tsx` | react-force-graph-2d 渲染器 |
| `admin/src/components/brain/graph-model.ts` | buildGraph / colorVarFor |
| `admin/src/components/brain/TypedLinkDemo.tsx` | Live 抽边演示 |
| `admin/src/lib/typed-link-extract.ts` | 4 动词正则抽边 |
| `admin/src/components/brain/Drawer.tsx` | 节点详情抽屉 |
| `admin/src/lib/why-topics.ts` | typed-link 系列 Why 内容 |
| `admin/src/pages/brain/__tests__/Graph.page.test.tsx` | 页面测试 |
| `admin/src/components/brain/graph-model.test.ts` | 图模型单测 |
| `src/core/operations.ts` | traverse_graph / get_stats 契约 |
| `src/core/link-extraction.ts` | 后端抽边（Demo 同思路） |
| `admin/docs/ASK_PAGE_COMPARISON.zh.md` | 精确检索页对照 |
| `admin/docs/INBOX_PAGE_ANALYSIS.zh.md` | Inbox → Graph 集成叙事 |
| `admin/docs/WHY_BUTTON_PLAN.zh.md` | Why 按钮规划 |
| `admin/docs/FRONTEND_PLAN.zh.md` | 前端总规划 §graph |

---

## 结论

`04.GBrain _ 项目案例_知识网路.mhtml` 定义的是 **typed 边图谱可视化 + 写入时建联机制教学**：宏观规模 → Live Demo → 双尺度 force-graph / canvas2d → 力参数探索。

仓库 `Graph.tsx` 在**核心叙事、Demo 机制、力导向交互、Why 主题和 MCP traverse** 上与案例**高度一致**，并在 **live 探索、深链、统计降级、测试、隐私合规** 等方面**超出静态 demo**。

主要差距在 **页头视觉、双 Tab 规模策略、双栏布局、Demo 汇入主图、Canvas overlay、Drawer 预览、底部说明卡** 等「教学沙盘 polish」层。12 步检索栈与消融应对照 `03.GBrain _ 项目案例_精确检索.mhtml` 与 `ASK_PAGE_COMPARISON.zh.md`。

Graph 与 Ask 的桥梁是：**typed-link 写入 → traverse_graph 可视化 ↔ relational recall 检索召回**。
