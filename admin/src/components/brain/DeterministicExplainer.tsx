import { WHY_TOPICS } from '../../lib/why-topics';
import { WhyButton } from './WhyButton';

/**
 * 静态诚实基准卡：确定性任务（minion 队列直算）vs sub-agent gateway 的延迟/成本对比。
 *
 * 刻意不做成可点击触发的实时演示——没有对应的后端 op（无 page-rank 触发端点），且
 * 随意触发重算违背"确定性任务不应被随意触发"的设计初衷。数字直接复用已上线的
 * `WHY_TOPICS['minions-queue'].comparison`（Why? 面板同一组结论），避免同一组数字
 * 在两处各写一份、日后漂移。
 */
export function DeterministicExplainer() {
  const topic = WHY_TOPICS['minions-queue'];
  const rows = topic.comparison ?? [];

  return (
    <div className="rounded-lg border border-hairline bg-elevated p-5">
      <div className="type-mono-tiny mb-2">// DETERMINISTIC TASK · 示意基准</div>
      <h3 className="type-serif text-brain-lg font-semibold text-ink">{topic.title}</h3>
      <p className="mt-1 text-brain-xs text-muted">示意基准（非实时触发）· 数字对应 Why? 面板同一组结论</p>

      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-2 gap-2 text-brain-sm">
              <div className="rounded border border-contra/30 bg-contra/5 p-2.5">
                <div className="font-mono text-brain-2xs uppercase text-contra">{row.label} · sub-agent</div>
                <div className="mt-0.5 text-ink">{row.alternative}</div>
              </div>
              <div className="rounded border border-ok/30 bg-ok/5 p-2.5">
                <div className="font-mono text-brain-2xs uppercase text-ok">{row.label} · minions</div>
                <div className="mt-0.5 text-ink">{row.chosen}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-1 text-brain-sm text-ink-soft">
        {topic.summary}
        <WhyButton topic="minions-queue" />
      </p>
    </div>
  );
}
