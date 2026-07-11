import type { TypedLink } from '../../lib/op-types';
import { WhyButton } from './WhyButton';

/**
 * Typed-link 边紧凑表格。
 *
 * 4 列：Subject | Predicate | Object | Source Evidence
 * 空数组时整体不渲染（调用处负责条件渲染）。
 */
export function TypedLinkTable({ links }: { links: TypedLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="type-section-label flex flex-wrap items-center gap-2">
        <span>
          提取的 typed-link ·{' '}
          <span style={{ color: 'var(--color-accent)' }}>{links.length} 条</span>
          {' · '}
          <span className="text-muted">4 个英文动词正则零 LLM</span>
        </span>
        <WhyButton topic="typed-link-extraction" />
      </div>
      <div className="overflow-hidden rounded-lg border border-hairline">
        <table className="brain-table">
          <thead>
            <tr className="border-b border-hairline brain-table-head">
              <th className="px-3 py-2 text-left font-medium">Subject</th>
              <th className="px-3 py-2 text-left font-medium">Predicate</th>
              <th className="px-3 py-2 text-left font-medium">Object</th>
              <th className="px-3 py-2 text-left font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link, i) => (
              <tr key={`${link.from_slug}-${link.link_type}-${link.to_slug}-${i}`} className="border-b border-hairline/60 last:border-0">
                {/* Subject */}
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 font-mono text-brain-sm hover:underline"
                    style={{ color: 'var(--color-accent)' }}
                    onClick={() => {
                      window.location.hash = `#/graph?q=${encodeURIComponent(link.from_slug)}`;
                    }}
                    title={`在图谱中查看 ${link.from_slug}`}
                  >
                    {link.from_slug}
                  </button>
                </td>
                {/* Predicate */}
                <td className="px-3 py-1.5 font-mono text-brain-sm" style={{ color: 'var(--color-amber)' }}>
                  {link.link_type}
                </td>
                {/* Object */}
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 font-mono text-brain-sm hover:underline"
                    style={{ color: 'var(--color-accent)' }}
                    onClick={() => {
                      window.location.hash = `#/graph?q=${encodeURIComponent(link.to_slug)}`;
                    }}
                    title={`在图谱中查看 ${link.to_slug}`}
                  >
                    {link.to_slug}
                  </button>
                </td>
                {/* Source Evidence */}
                <td className="max-w-[14rem] px-3 py-1.5 text-brain-sm text-ink-soft line-clamp-1">
                  {link.context ? (
                    <span title={link.context}>{link.context}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
