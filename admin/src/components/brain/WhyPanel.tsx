import type { WhyTopicId } from '../../lib/why-topics';
import { GBRAIN_SOURCE_REPO, WHY_TOPICS } from '../../lib/why-topics';
import { Drawer } from './Drawer';

export function WhyPanel({
  topic,
  onClose,
}: {
  topic: WhyTopicId | null;
  onClose: () => void;
}) {
  if (!topic) return null;

  const content = WHY_TOPICS[topic];

  return (
    <Drawer open title={content.title} onClose={onClose}>
      <div className="space-y-5 text-brain-sm text-ink-soft">
        {content.summary && <p className="leading-relaxed text-ink-soft">{content.summary}</p>}

        <section>
          <div className="type-section-label mb-2">设计取舍</div>
          <ul className="list-disc space-y-1.5 pl-4 leading-relaxed">
            {content.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        {content.comparison && content.comparison.length > 0 && (
          <section>
            <div className="type-section-label mb-2">对照</div>
            <div className="overflow-hidden rounded-lg border border-hairline">
              <table className="brain-table brain-table-no-hover w-full">
                <thead>
                  <tr className="border-b border-hairline brain-table-head">
                    <th className="px-3 py-2 text-left font-medium">维度</th>
                    <th className="px-3 py-2 text-left font-medium">本方案</th>
                    <th className="px-3 py-2 text-left font-medium">替代</th>
                  </tr>
                </thead>
                <tbody>
                  {content.comparison.map((row) => (
                    <tr key={row.label} className="border-b border-hairline/60 last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{row.label}</td>
                      <td className="px-3 py-2">{row.chosen}</td>
                      <td className="px-3 py-2 text-muted">{row.alternative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {content.sources.length > 0 && (
          <section>
            <div className="type-section-label mb-2">源码引用</div>
            <ul className="space-y-2">
              {content.sources.map((src) => (
                <li key={src.path}>
                  <a
                    href={`${GBRAIN_SOURCE_REPO}/${src.path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-brain-xs text-accent hover:underline"
                  >
                    {src.path}
                  </a>
                  {src.hint && <div className="mt-0.5 text-brain-xs text-muted">{src.hint}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
