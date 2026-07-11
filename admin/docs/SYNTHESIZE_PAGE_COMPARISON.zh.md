# GBrain「真理沉淀」实现对照评估

> 对照基准：`admin/docs/前端案例/05.GBrain _ 项目案例_整理沉淀.mhtml`（案例站 `#/synthesize`）  
> 实现代码：`admin/src/pages/brain/Synthesize.tsx`、`admin/src/lib/useConflicts.ts`  
> 后端契约：`src/core/operations.ts`（`find_conflicts` / `compile_truth` / `adopt_compiled_truth`）、`src/core/compile-truth.ts`、`src/core/conflicts.ts`  
> 生成日期：2026-07-11

---

## 总览结论

**骨架已对齐案例目标态约 90%**：4/8 双栏、冲突组 → 候选 → Compile → diff → 采纳、Why? 按钮、MCP 三 op 集成、Vitest 覆盖均已落地。

与案例的差异主要在两类：

1. **有意增强**（比静态 demo 更可用）：live MCP、severity/探针标签、adopt slug 可编辑、warnings/model_used、Inbox 深链。
2. **尚未 polish**（案例有、实现还没有）：页头大标题 + Layers 图标、页头沙箱 Badge、默认展示示例编译结果、diff 行彩色底。

**重要澄清**：本页是 **Compiled Truth 合并工作台**，不是「精确检索」页。预设问题、12 步检索栈、消融 P@5 网格属于 `#/ask`，见 `admin/docs/ASK_PAGE_COMPARISON.zh.md`。早期 `FRONTEND_PLAN.zh.md` 曾把整理沉淀写成 `think` / `find_trajectory`；**当前实现已与案例 MHTML 及后端三 op 对齐**，应以 `Synthesize.tsx` 为准。

| 维度 | 对齐度 | 一句话 |
|------|--------|--------|
| 整体布局与主流程 | ~90% | 4/8 双栏、冲突组 → 候选 → Compile → diff → 采纳 |
| 真实 MCP 集成 | 实现更强 | 案例静态 demo；仓库 live 三 op |
| 检索栈 / 消融 | 不适用本页 | 关系在 compiled_truth 2.0× boost（Why 面板） |
| 页头视觉 / 沙箱标识 | ~70% | 案例更大标题 + 图标 + 页头沙箱 Badge |
| 测试 | 实现更强 | Vitest 5 条；案例仅 data-testid 钩子 |

**图例**：✅ 已对齐 / 实现更好 · ⚠️ 部分对齐 · ❌ 未实现 / 不适用

---

## 先澄清：这页在做什么

案例 MHTML 的 `#/synthesize` 定义的是 **Compiled Truth 工作台**：

> 检测冲突 markdown 组 → 选一组 → **Compile** → 看 **keep/merge/add/remove diff** → **采纳进 compiled_truth 表**

**不是** `query` → 12 步管道 → `think` 答问链路。站点 meta 里「12 步高精度检索」是全产品叙事，不是本页 UI 组成部分。

---

## 逐项对照表

| 维度 | 案例 MHTML 目标 | 当前实现 | 状态 |
|------|----------------|----------|------|
| **1. 整体布局** | `max-w-[1400px]` + 4/8 双栏 | `brain-page-wide` + `lg:grid-cols-12` 4/8 | ✅ 已对齐 |
| **页头** | `// 合并 · SYNTHESIZE` + `Compiled Truth 工作台` + Layers 30px + Why? | `PageHeader`「工作台 · 合并」+「真理沉淀」+ WhyButton | ⚠️ 部分 |
| **页头沙箱 Badge** | 脉冲沙箱标识 | 无（侧栏/顶栏全局有） | ⚠️ 部分 |
| **自由提问框** | 无 | 无（测试断言） | ✅ 设计一致 |
| **2. 工作流** | 选冲突组 → Compile → diff → 采纳 | `find_conflicts` → `compile_truth` → `adopt_compiled_truth` | ✅ 已对齐 |
| **静态 demo 预填** | Dream Cycle 组已选 + 产出已展示 | 需点击 Compile 才出现产出 | ⚠️ 案例为教学快照 |
| **3. 预设问题** | 无 | 无 | ✅ 不适用（在 `#/ask`） |
| **答案形态** | 编译后 markdown（## 标题 + 段落） | `compiled_markdown` pre 展示 | ✅ 已对齐 |
| **来源引用** | 候选卡 slug + excerpt | 同 + `sources` 传 adopt | ✅ 已对齐 |
| **think 式 citations** | 无 | 无 | ✅ 不适用 |
| **4. 分类标签** | `{type: concept\|daily\|essay}` + diff op | + severity Badge + 探针/聚类 | ✅ 实现更好 |
| **diff 四 op** | keep / merge / add（彩色底） | keep / merge / add / remove + Badge tone | ✅ 功能等价 |
| **5. 12 步检索栈** | 本页无 | 本页无 | ❌ 见 `#/ask` |
| **6. 消融分析** | 本页无 | 本页无（Why 提及 boost 消融叙事） | ❌ 见 `#/ask` |
| **7. Why? 按钮** | `compiled-truth-cache` | `WhyButton` + `why-topics.ts` | ✅ 已对齐 |
| **8. Inbox 集成** | MHTML 未展示 | merging → `#/synthesize?topic=` | ✅ 实现更强 |
| **9. MCP 契约** | 静态 HTML | live `callMcp` 三 op | ✅ 实现更强 |
| **10. 测试** | data-testid 钩子 | Vitest compile/adopt/空态 | ✅ 实现更强 |
| **FRONTEND_PLAN 旧 spec** | — | 曾写 think/find_trajectory | ⚠️ 文档漂移，实现已更正 |

---

## 分块细评

### 1）整体布局与 UI 组件结构

#### 案例设计意图

- **壳层**：240px 侧栏 + 顶栏（⌘K、沙箱 Badge、帮助、GitHub）
- **内容区**：`max-w-[1400px] px-6 py-8`，`data-page="synthesize"`
- **页头**：
  - Kicker：`// 合并 · SYNTHESIZE`
  - 大标题：`Compiled Truth 工作台` + Layers 图标（30px display）
  - 副标题：五步流程 + Why?（`compiled-truth-cache`）
  - 右侧：沙箱 Badge
- **主网格**：左 4 列冲突组，右 8 列候选 + 编译产出

#### 已实现

- 容器：`brain-page-wide` → `max-width: var(--max-width-brain-xwide)`（对齐 1400px）
- 组件：`PageHeader`、`AsyncState`、`Badge`、`WhyButton`
- 左栏：`// 冲突组 · N 个` + 可点击组卡片（`data-testid="conflict-g-*"`）
- 右栏：候选 markdown 卡 + Compile 按钮 + COMPILED OUTPUT + diff + 采纳

#### 尚未对齐

| 案例 | 当前实现 |
|------|----------|
| `Compiled Truth 工作台` + 26px Layers 图标 | `真理沉淀`，无页内图标 |
| Compile 按钮 `bg-accent` | `bg-node-synthesis` |
| diff 行 `bg-amber/10`、`bg-ok/10` 彩色底 | `Badge` 四 tone，行背景中性 |
| 编译产出默认可见（静态 demo） | 点击 Compile 后才渲染 |
| 采纳仅按钮，无 slug 输入 | slug 输入框 + 默认 `compiled/<topic>` |

**相关文件**：`admin/src/pages/brain/Synthesize.tsx` L111–252

---

### 2）工作流程与处理机制

#### 本页实际数据流

```
find_conflicts（读）
    → 用户选冲突组
    → 展示候选 markdown 卡
    → compile_truth（读，LLM 提案）
    → compiled_markdown + keep/merge/add/remove diff
    → adopt_compiled_truth（写）
    → 写页 + chunk + embed → 检索时 2.0× compiled_truth boost
```

**不是** `query` → 12 步管道 → `think`。

#### 后端机制

**`find_conflicts`**（`src/core/operations.ts`）：

1. **探针优先**：`eval_contradictions_runs` 矛盾对 → `groupConflicts` 连通分量（`src/core/conflicts.ts`）
2. **聚类回退**：无探针且带 `topic` → `hybridSearch` 聚成单组
3. 丰富成员：title / type / excerpt / updated_at

**`compile_truth`**（`src/core/compile-truth.ts`）：

- 读候选 slug 正文 → LLM 合并 JSON
- 只读提案，不写库；LLM 失败降级拼接 + warnings

**`adopt_compiled_truth`**：

- `importFromContent` + frontmatter `compiled_from` 溯源
- chunk + embed，使正文进入 compiled_truth boost 路径

#### 与检索页的间接关系

- 本页**产出**会被 `#/ask` 的 hybrid 检索优先召回（2.0× boost）
- `?topic=` 深链：`useConflicts(topic)`；Inbox merging 态跳转 `#/synthesize?topic=`

**相关文件**：

- `admin/src/lib/useConflicts.ts`
- `admin/src/pages/brain/Synthesize.tsx` L73–109
- `src/core/compile-truth.ts`、`src/core/conflicts.ts`

---

### 3）结果展示方式

| 字段/能力 | 案例 | 当前实现 |
|-----------|------|----------|
| 预设问题 chip | 无 | 无（在 `#/ask`） |
| 自由提问 | 无 | 无 |
| 编译正文 | `pre` 内 ## Dream Cycle… | `compiled.compiled_markdown` |
| diff | keep / merge / add 行 | 四 op + Badge |
| 候选来源 | slug + date + title + type + excerpt | 同结构 |
| 模型信息 | demo 未展示 | `model_used` 脚注 |
| warnings | 无 | `compiled.warnings` |
| think citations | 无 | 无 |

案例预填 Dream Cycle 产出是**教学叙事**（9 phase 顺序、self-consumption guard），展示合并后共识长什么样，非实时 LLM 结果。

---

### 4）分类标记系统

#### 案例

- 冲突组：`N 份冲突 markdown`（mono）
- 候选：`{type: concept|daily|essay}`
- diff op：keep / merge / add（颜色区分）
- 无 severity、无 probe/cluster 标签

#### 当前实现

- 冲突组：`severity` → `Badge tone="contra"`（high/medium/low）
- 数据来源：`探针` / `聚类`（`g.source`）
- diff：`Badge` — keep muted / merge amber / add ok / remove coral

**评价**：仓库对运维/调试更友好；案例更简洁，适合静态演示。

---

### 5）检索栈分析（12 步可视化）

**本页案例 MHTML 中不存在 12 步检索栈 UI。**

若需要该能力：

- 页面：`#/ask` + `admin/src/components/brain/PipelineSteps.tsx`
- 文档：`admin/docs/ASK_PAGE_COMPARISON.zh.md` §6

与本页连接：采纳后的 `compiled_truth` chunk 进入 hybrid 管道并在 RRF 后获得 boost——在 **Why? → `compiled-truth-cache`** 中说明，非本页控件。

---

### 6）消融分析

**本页案例 MHTML 中不存在消融网格。**

- 消融 UI 在 **`#/ask`**（静态说明 + 离线 BrainBench 叙事）
- `why-topics.ts` 的 `compiled-truth-cache` 提到：关掉 compiled_truth boost 后策展摘要排名下降——属于**检索侧消融叙事**，不是整理沉淀页控件

本页「可解释性」来自 **diff 四分类**（keep/merge/add/remove），不是 P@5 算子消融。

---

### 7）与其他系统模块的集成

| 集成点 | 案例 | 当前实现 | 状态 |
|--------|------|----------|------|
| MCP `find_conflicts` | 静态 5 组 | live + `?topic=` 过滤 | ✅ |
| MCP `compile_truth` | 静态预填产出 | 按需调用 | ✅ |
| MCP `adopt_compiled_truth` | 静态按钮 | slug 输入 + 成功提示 + reload | ✅ |
| Inbox → 真理沉淀 | 未展示 | `InboxDetail` merging → `?topic=` | ✅ |
| Why `compiled-truth-cache` | 有 | `WhyButton` + Drawer | ✅ |
| 顶栏 ⌘K | 有 | `BrainTopBar` | ✅ 壳层共有 |
| 与 `#/ask` 互跳 | 无 | 无 | ⚠️ 可加强 |
| 长任务 job 轮询 | — | 不需要（compile 为同步 read op） | FRONTEND_PLAN 旧 spec 已过时 |

#### 集成关系图

```
内容入库 (Inbox merging)
    └─→ #/synthesize?topic=
            └─→ find_conflicts
                    └─→ compile_truth
                            └─→ adopt_compiled_truth
                                    └─→ pages/chunks/embed
                                            └─→ #/ask query (2.0× boost)

矛盾探针 (eval_contradictions_runs)
    └─→ find_conflicts（探针路径）
```

**相关文件**：

- `admin/src/components/brain/InboxDetail.tsx` L98–111
- `admin/src/lib/why-topics.ts`（`compiled-truth-cache`）

---

### 8）与当前仓库落地状态对比

#### 已对齐（高优先级）

- [x] 4/8 双栏布局
- [x] 冲突组列表 + 默认选中第一组
- [x] 候选 markdown 卡（slug、日期、title、type、excerpt）
- [x] Compile → COMPILED OUTPUT → diff → 采纳
- [x] Why? `compiled-truth-cache`
- [x] 无自由提问框（与案例一致）
- [x] `data-testid`：`conflict-g-*`、`compile-button`、`compile-output`、`adopt-button`
- [x] Vitest：`admin/src/pages/brain/__tests__/Synthesize.page.test.tsx`

#### 部分差距（polish）

| 项 | 优先级 | 说明 |
|----|--------|------|
| 页头大标题 + Layers 图标 | P2 | 案例品牌感 |
| 页头沙箱 Badge | P2 | 演示态标识 |
| 空脑库 onboarding / 示例编译结果 | P3 | 冷启动引导 |
| diff 行彩色背景 | P3 | 贴近案例 |
| Compile 按钮 `bg-accent` | P3 | 纯视觉 |

#### 实现优于案例

| 项 | 说明 |
|----|------|
| 真实 MCP + 空态/错误态 | `AsyncState` + probe note |
| adopt slug 可编辑 | 默认 `compiled/<topic-slugified>` |
| severity + 探针/聚类标签 | 数据来源可审计 |
| warnings / model_used | LLM 失败可观测 |
| `?topic=` 与 Inbox 联动 | 深链过滤 |
| 自动化测试 | 5 条 Vitest |

#### 文档漂移

`admin/docs/FRONTEND_PLAN.zh.md` §3.2 / §4.2 仍写整理沉淀 → `think`/`find_trajectory`；**应以当前 `Synthesize.tsx` + 三 op 为准**。

---

### 9）案例有、评估未单独列出的功能

1. **赋范空间课例壳**：面包屑、`CaseExitBridge`、查看引导/添加助教（MHTML 外层，非 admin SPA 范畴）
2. **静态 demo 预选中态**：Dream Cycle 组已选 + 编译结果已渲染（零交互可截图）
3. **侧栏沙箱/在线切换**：案例侧栏底部 toggle
4. **compiled_truth 检索 boost 叙事**：Why 面板 2.0×、同表 chunk、与 think 产出关系
5. **矛盾探针数据管道**：案例写死 5 组（typed-link、dream-cycle、minions、RRF、source-boost）
6. **工程概念教育**：demo 编译正文含 self-consumption / dream_generated 等
7. **Onboarding root**：`data-onboarding-root`（案例有钩子，admin 未接）
8. **采纳后检索反馈闭环**：案例未展示；仓库 adopt 后需手动去 `#/ask` 验证 boost

---

## 架构决策评价

| 实现选择 | 评价 |
|----------|------|
| Compiled Truth 三 op 而非 think 问答 | ✅ 正确：与案例 MHTML 语义一致 |
| compile 同步调用而非 job 轮询 | ✅ 正确：read op，无需 SSE |
| 无自由提问框 | ✅ 正确：综合对象由冲突检测产出 |
| adopt 前可编辑 slug | ✅ 增强：案例 demo 省略 |
| severity / 探针·聚类 标签 | ✅ 增强：可审计 |
| 与 `#/ask` 无互跳 | ⚠️ 可接受；采纳后验证 boost 需手动 |
| FRONTEND_PLAN 未更新 | ⚠️ 易误导后续开发 |

---

## 用户体验评估

### 做得好的

1. **任务模型清晰**：冲突 → 合并 → 可审计 diff → 显式采纳，比隐式 think 更符合「整理沉淀」。
2. **可解释合并**：diff 四 op 降低 LLM 黑盒焦虑。
3. **成本可控**：Compile 按需触发；无 Ask 页「每次检索隐含 synthesis」。
4. **fork-safe 真实集成**：三 op 在 `operations.ts`；admin 只消费 MCP。
5. **失败路径**：空冲突 note、compile/adopt 错误、warnings；符合 DESIGN.md 反对 spinner 假装进度。

### 可改进

1. **冷启动**：无探针、无冲突时用户不知下一步；案例用 5 组静态数据掩盖。
2. **与 Ask 断层**：采纳成功后无「去检索验证」CTA。
3. **页头识别度**：`真理沉淀` vs `Compiled Truth 工作台`，新用户可能不懂与 Ask 分工。
4. **Compile 等待态**：仅按钮「编译中…」；长 LLM 可加步骤提示（非 spinner）。
5. **diff 可读性**：长列表无折叠/分组。
6. **文档一致性**：FRONTEND_PLAN 旧映射需更新。

### 角色适用性

| 用户 | 本页价值 |
|------|----------|
| 知识策展者 | 高 — 合并重复/冲突笔记为权威页 |
| 检索调试者 | 低 — 应去 `#/ask` |
| 算法评估者 | 中 — diff 审计 + Why boost；完整消融在 Ask / `gbrain eval` |

---

## 测试覆盖

`admin/src/pages/brain/__tests__/Synthesize.page.test.tsx` 已覆盖：

| 用例 | 状态 |
|------|------|
| 标题「真理沉淀」渲染 | ✅ |
| 无 think 式提问输入框 | ✅ |
| 冲突组列表与默认选中 | ✅ |
| 候选卡 slug / type | ✅ |
| Compile 调 `compile_truth` + diff 渲染 | ✅ |
| 采纳调 `adopt_compiled_truth` + 成功提示 | ✅ |
| 空冲突组 note 空态 | ✅ |

案例仅有 `data-testid` 钩子，无对应自动化测试。

---

## 九项关注点在本页的归属

| # | 主题 | 本页案例 | 本页仓库 | 正确页面 |
|---|------|----------|----------|----------|
| 1 | 布局/UI | ✅ 核心 | ✅ ~90% | `#/synthesize` |
| 2 | 工作流 | conflict→compile | ✅ 三 op | `#/synthesize` |
| 3 | 预设/答案/引用 | 无预设；答案=compiled md | 同 + 元数据 | Ask 才有预设/think |
| 4 | 分类标签 | type + diff op | + severity/探针 | `#/synthesize` |
| 5 | 12 步检索栈 | ❌ | ❌ | `#/ask` |
| 6 | 消融分析 | ❌ | ❌（Why 提 boost） | `#/ask` |
| 7 | 模块集成 | 壳层+Why | + Inbox+MCP | 两页共同 |
| 8 | 落地对比 | — | ~90% + 更强后端 | — |
| 9 | 未列功能 | 静态 demo、课例壳 | adopt slug、测试 | — |

---

## 后续打磨优先级

### P1 — 文档与引导（约 0.5h）

1. 更新 `FRONTEND_PLAN.zh.md` §4.2：整理沉淀 → `find_conflicts` / `compile_truth` / `adopt_compiled_truth`
2. 空态 copy：无冲突时提示「运行矛盾探针 / 从 Inbox merging 进入 / 传 `?topic=`」

### P2 — 低成本视觉对齐（约 1–2h）

3. 页头：可选 Layers 图标 + 副标题「Compiled Truth 工作台」
4. 采纳成功后 CTA：「去精确检索验证 → `#/ask?q=<topic>`」
5. diff 行可选彩色底（merge amber / add ok）

### P3 — 可选增强

6. 冷启动静态示例组（无 MCP 数据时只读展示，标注 demo）
7. Compile 进行中分步文案（读候选 / 调模型 / 解析 diff）
8. `#/synthesize` ↔ `#/ask` 双向链接（页脚说明分工）

---

## 相关文件索引

| 文件 | 职责 |
|------|------|
| `admin/src/pages/brain/Synthesize.tsx` | 页面主实现 |
| `admin/src/lib/useConflicts.ts` | `find_conflicts` hook |
| `admin/src/lib/op-types.ts` | `CompileTruthResult` 等 mirror |
| `admin/src/components/brain/InboxDetail.tsx` | Inbox → 真理沉淀跳转 |
| `admin/src/lib/why-topics.ts` | `compiled-truth-cache` 内容 |
| `admin/src/pages/brain/__tests__/Synthesize.page.test.tsx` | 页面测试 |
| `src/core/compile-truth.ts` | compile 核心逻辑 |
| `src/core/conflicts.ts` | 探针对分组 |
| `src/core/operations.ts` | 三 op 契约 |
| `admin/docs/ASK_PAGE_COMPARISON.zh.md` | 精确检索页对照（检索栈/消融） |
| `admin/docs/WHY_BUTTON_PLAN.zh.md` | Why 按钮规划 |
| `admin/docs/FRONTEND_PLAN.zh.md` | 前端总规划（§整理沉淀需更新） |

---

## 结论

`05.GBrain _ 项目案例_整理沉淀.mhtml` 定义的是 **Compiled Truth 合并工作台**，不是检索调试台。仓库 `Synthesize.tsx` 在流程、布局、Why 主题和 MCP 契约上已与案例**高度对齐**，并在 adopt slug、severity、探针/聚类、测试等方面**超出静态 demo**。

12 步检索栈与消融应对照 `03.GBrain _ 项目案例_精确检索.mhtml` 与 `ASK_PAGE_COMPARISON.zh.md`。整理沉淀与检索的桥梁是：**采纳 → compiled_truth chunk → hybrid 2.0× boost**。
