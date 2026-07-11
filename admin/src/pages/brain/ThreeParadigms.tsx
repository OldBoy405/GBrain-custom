import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Database, GitBranch, Quote, Server, Star } from 'lucide-react';

/**
 * 三大范式 —— 静态对照页，内容与布局同步自
 * docs/前端案例/08.GBrain _ 项目案例_三大范式.mhtml
 */

const LETTA_COLOR = '#0E7490';

const PARADIGMS: Array<{
  icon: LucideIcon;
  color: string;
  badge: string;
  name: string;
  tagline: string;
  code: string;
  pros: string[];
  cons: string[];
}> = [
  {
    icon: Server,
    color: 'rgb(123, 63, 158)',
    badge: 'Memory as API · 把记忆做成 API',
    name: 'Mem0',
    tagline: 'memory.add(user_id, content)',
    code: `# Python
from mem0 import Memory
m = Memory()
m.add("alice", "I love sushi")
result = m.search(
  "what does alice like?",
  user_id="alice"
)`,
    pros: [
      'REST API · 任何语言可调用',
      '用户级 memory 隔离 · 可托管',
      'Pricing：按 token + storage 收费',
    ],
    cons: ['黑盒：不能审计 memory 决策', '厂商锁定 · 数据迁出有摩擦', '无图结构 · 关系查询弱'],
  },
  {
    icon: GitBranch,
    color: LETTA_COLOR,
    badge: 'Memory as Runtime · 把记忆做成运行时',
    name: 'Letta',
    tagline: 'MemGPT 风格的有状态 agent',
    code: `# Python
from letta import create_client
client = create_client()
agent = client.create_agent(
  memory_blocks=[
    {"label": "human", "value": "..."},
    {"label": "persona", "value": "..."},
  ]
)
client.send_message(agent.id, "...")`,
    pros: [
      'core_memory + recall_memory 双层',
      'Agent 自管理 · 自决策淘汰',
      '类操作系统的虚拟上下文分页',
    ],
    cons: [
      'Runtime 强耦合 · 难嵌入现有系统',
      'core_memory 有上限 · 仍受 context 限制',
      '调试需要查看 Letta 专属 trace',
    ],
  },
  {
    icon: Database,
    color: 'rgb(15, 118, 110)',
    badge: 'Memory as Git + SQL · 把记忆做成 Git + SQL',
    name: 'GBrain',
    tagline: 'Postgres + markdown · open core 模式',
    code: `# bash
gbrain put-page people/alice "..."
gbrain query "what does alice like?"
# → hits compiled_truth chunks first
# → graph traversal for relations
# → ~12 spans per query`,
    pros: [
      '完全可审计 · 每一 page 都是 git markdown',
      '~20 个确定性算子 · 写入时零 LLM 调用',
      'compiled_truth 一次编译，永久命中',
      '多阶段 dream cycle 自维护',
    ],
    cons: ['需要自托管 Postgres + pgvector', '学习曲线：Bun + TypeScript', '仍处于 v0.x · API 可能 breaking'],
  },
];

const COMPARE_ROWS: Array<{
  dim: string;
  mem0: string;
  letta: string;
  gbrain: string;
}> = [
  {
    dim: '存储介质',
    mem0: 'vector DB (Qdrant)',
    letta: 'Postgres core_memory + recall_memory',
    gbrain: 'Postgres pages + chunks + links + timeline',
  },
  {
    dim: '写入开销',
    mem0: 'LLM extract + embed',
    letta: 'agent self-edit + LLM',
    gbrain: '正则级联 (zero LLM)',
  },
  {
    dim: '关系查询',
    mem0: '弱 · 主要 vector',
    letta: '中 · message-passing',
    gbrain: '强 · recursive CTE + typed-link',
  },
  {
    dim: '可审计性',
    mem0: 'API logs',
    letta: 'agent traces',
    gbrain: 'git diff + page_versions',
  },
  {
    dim: '部署形态',
    mem0: 'SaaS / self-host',
    letta: 'Runtime container',
    gbrain: 'Bun CLI + Postgres',
  },
  {
    dim: '许可',
    mem0: 'Apache 2.0 (core)',
    letta: 'Apache 2.0',
    gbrain: 'MIT',
  },
  {
    dim: 'GitHub Stars',
    mem0: '27.4k',
    letta: '13.8k',
    gbrain: '8.3k 且增速最快',
  },
];

function ProConList({ kind, items }: { kind: 'pro' | 'con'; items: string[] }) {
  const isPro = kind === 'pro';
  return (
    <div className={isPro ? 'mt-4' : 'mt-3'}>
      <div className={`mb-2 font-mono text-brain-xs uppercase ${isPro ? 'text-ok' : 'text-coral'}`}>
        {isPro ? '优势' : '劣势'}
      </div>
      <ul className={`space-y-1 text-brain-caption ${isPro ? 'text-ink' : 'text-ink-soft'}`}>
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={isPro ? 'text-ok' : 'text-coral'}>{isPro ? '+' : '−'}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParadigmCard({ p }: { p: (typeof PARADIGMS)[number] }) {
  const Icon = p.icon;
  return (
    <div className="rounded-xl border border-hairline bg-elevated p-6">
      <div
        className="inline-flex items-center gap-2 rounded-md px-2 py-1 font-mono text-brain-xs"
        style={{ background: 'var(--color-subtle)', color: p.color }}
      >
        <Icon size={12} aria-hidden />
        {p.badge}
      </div>
      <h3 className="type-card-title mt-3 tracking-tight" style={{ color: p.color }}>
        {p.name}
      </h3>
      <div className="mt-1 font-mono text-brain-2sm text-muted">{p.tagline}</div>
      <pre className="mt-4 overflow-x-auto rounded-md border border-hairline bg-canvas p-3 font-mono text-brain-2sm leading-relaxed text-ink-soft">
        <code>{p.code}</code>
      </pre>
      <ProConList kind="pro" items={p.pros} />
      <ProConList kind="con" items={p.cons} />
    </div>
  );
}

export function ThreeParadigms() {
  return (
    <div className="relative bg-canvas">
      <section className="brain-section-content bg-dot-grid pb-12 pt-16 text-center">
        <div className="type-mono-tiny mb-3">// 行业参考 · 三大范式横向对照</div>
        <h1 className="type-display type-paradigm-hero text-ink">三种 LLM 记忆范式</h1>
        <p className="mx-auto mt-5 max-w-2xl text-brain-lg leading-[1.7] text-ink-soft">
          同一个问题——「如何让 LLM 拥有 durable memory」——三家给出的工程答案完全不同。向下滑动看清各自定位、代码、优劣势，最后看
          Karpathy LLM Wiki 帖子如何验证 GBrain 的工程选择。
        </p>
        <p className="mx-auto mt-3 max-w-xl font-mono text-brain-sm leading-relaxed text-muted">
          其余 7 页是真实工作台 · 每页关键交互旁的「Why?」按钮提供原理说明与源码引用。
        </p>
      </section>

      <section className="brain-section pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {PARADIGMS.map((p) => (
            <ParadigmCard key={p.name} p={p} />
          ))}
        </div>
      </section>

      <section className="brain-section-table py-14">
        <h2 className="type-display type-paradigm-section mb-6 text-ink">架构对比</h2>
        <div className="overflow-x-auto rounded-xl border border-hairline bg-elevated">
          <table className="brain-table brain-paradigm-compare-table">
            <thead className="bg-subtle">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono text-brain-2sm uppercase text-muted">维度</th>
                <th className="px-4 py-3 text-node-synthesis">Mem0</th>
                <th className="px-4 py-3" style={{ color: LETTA_COLOR }}>
                  Letta
                </th>
                <th className="px-4 py-3 text-accent">GBrain</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.dim}>
                  <td className="px-4 py-3 font-mono text-brain-2sm text-muted">{row.dim}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.mem0}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.letta}</td>
                  <td className="px-4 py-3 font-medium text-accent">{row.gbrain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="brain-section-table pb-20">
        <div className="bg-paper-grain rounded-xl border border-hairline bg-elevated p-8">
          <Quote className="text-accent" size={24} aria-hidden />
          <p className="type-serif mt-3 text-brain-2xl leading-[1.6] text-ink">
            个人 LLM Wiki 是介于&quot;笔记 app&quot;和&quot;agent runtime&quot;之间缺失的那一层。 Markdown · vectors ·
            真实 graph schema 三件套——这就是答案。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-brain-sm text-muted">
            <span>— Andrej Karpathy</span>
            <span>·</span>
            <span className="text-accent">24 小时 520 万阅读</span>
            <span>·</span>
            <span>Karpathy LLM Wiki 帖子引爆 GBrain</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/garrytan/gbrain"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-brain-base font-medium text-inverse transition hover:opacity-90"
            >
              <Star size={14} aria-hidden />
              8,267 stars · garrytan/gbrain 仓库
              <ArrowRight size={14} aria-hidden />
            </a>
            <a
              href="#/"
              className="inline-flex items-center gap-2 rounded-md border border-hairline bg-canvas px-4 py-2 text-brain-base font-medium text-ink hover:bg-subtle"
            >
              ← 回到首页
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
