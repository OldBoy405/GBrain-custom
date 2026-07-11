/**
 * RAW vs ENRICHED 左右对比组件。
 *
 * 左列：原始纯文本（hairline 边框、canvas 背景）
 * 右列：增强后文本（accent 边框、accent-soft 背景）
 * 无 enriched 时右列显示占位文案。
 */
export function EnrichmentDiff({
  raw,
  enriched,
}: {
  raw: string;
  enriched?: string;
}) {
  if (!raw) return null;

  return (
    <div className="space-y-1.5">
      <div className="type-section-label">ENRICHMENT 输出</div>
      <div className="grid grid-cols-2 gap-3">
        {/* RAW 列 */}
        <div>
          <div className="mb-1 font-mono text-brain-2xs uppercase text-muted">RAW</div>
          <pre
            className="overflow-auto rounded-lg border border-hairline p-3 font-mono text-brain-sm whitespace-pre-wrap"
            style={{ background: 'var(--color-canvas)', color: 'var(--color-ink-soft)', maxHeight: '18rem' }}
          >
            {raw}
          </pre>
        </div>

        {/* ENRICHED 列 */}
        <div>
          <div className="mb-1 font-mono text-brain-2xs uppercase" style={{ color: 'var(--color-accent)' }}>
            ENRICHED
          </div>
          {enriched ? (
            <pre
              className="overflow-auto rounded-lg border p-3 font-mono text-brain-sm whitespace-pre-wrap"
              style={{
                borderColor: 'var(--color-accent)',
                background: 'var(--color-accent-soft)',
                color: 'var(--color-ink)',
                maxHeight: '18rem',
              }}
            >
              {enriched}
            </pre>
          ) : (
            <div
              className="flex items-center justify-center rounded-lg border p-6 text-brain-sm text-muted"
              style={{ borderColor: 'var(--color-hairline)', height: '8rem' }}
            >
              尚未 enrichment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
