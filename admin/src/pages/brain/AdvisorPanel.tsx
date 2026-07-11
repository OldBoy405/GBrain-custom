import { useMemo } from 'react';
import { useMcp } from '../../lib/useMcp';
import type { AdvisorFinding, AdvisorReport, AdvisorSeverity } from '../../lib/op-types';
import { Badge, AsyncState } from '../../components/brain';
import type { BadgeTone } from '../../components/brain';

const SEVERITY_ORDER: Record<AdvisorSeverity, number> = { critical: 0, warn: 1, info: 2 };
const SEVERITY_TONE: Record<AdvisorSeverity, BadgeTone> = { critical: 'contra', warn: 'amber', info: 'muted' };

function FindingRow({ f }: { f: AdvisorFinding }) {
  return (
    <li className="border-b border-hairline/60 px-4 py-3 last:border-0">
      <div className="flex items-center gap-2">
        <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge>
        <span className="min-w-0 flex-1 text-brain-sm text-ink">{f.title}</span>
      </div>
      {f.detail && <p className="mt-1.5 text-brain-xs leading-relaxed text-ink-soft">{f.detail}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-brain-2sm text-muted">
        <span>{f.collector}</span>
        {f.fix.command_argv && f.fix.command_argv.length > 0 ? (
          <span className="text-ink-soft">{f.fix.command_argv.join(' ')}</span>
        ) : (
          <span>无自动修复命令</span>
        )}
      </div>
    </li>
  );
}

/** 运营概览「建议行动」区块：只读展示 `advisor` 的 ranked findings，从不提供一键执行。 */
export function AdvisorPanel() {
  const { data, loading, error } = useMcp<AdvisorReport>('advisor', {});

  // advisor 用独立门控 mcp.publish_advisor（与 skills 的 mcp.publish_skills 是两回事）。
  const gated = error && /publish|disabled|not enabled/i.test(error);

  const findings = useMemo(() => {
    const list = data?.findings ?? [];
    return [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [data]);

  return (
    <div className="mt-8">
      <div className="type-section-label mb-3">建议行动</div>
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        {gated ? (
          <div className="px-5 py-10 text-center text-brain-sm text-ink-soft">
            Advisor 未通过 MCP 暴露：
            <div className="mt-2 font-mono text-brain-xs text-muted">gbrain config set mcp.publish_advisor true</div>
          </div>
        ) : (
          <>
            <AsyncState
              loading={loading}
              error={error}
              empty={findings.length === 0}
              emptyText="一切正常，无待办建议。"
            />
            {findings.length > 0 && (
              <ul className="list-none pl-0">
                {findings.map((f) => (
                  <FindingRow key={f.id} f={f} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
