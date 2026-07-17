import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useCapture } from '../../lib/useCapture';
import { defaultInboxSlug } from '../../lib/capture-frontmatter';
import {
  MAX_BATCH_FILES,
  buildBatchEntries,
  formatSize,
  titleFromName,
  type BatchFileEntry,
} from '../../lib/capture-batch-files';
import { Badge } from './Badge';

type CaptureTab = 'text' | 'structured';

type PickedFileEntry = BatchFileEntry & {
  status?: 'success' | 'error';
  slug?: string;
  error?: string;
};

const TYPE_OPTIONS = ['note', 'idea', 'article', 'event'];

const SOURCE_TAB_BASE =
  'cursor-pointer rounded-full border px-3 py-1 text-brain-xs transition';

function sourceTabClass(active: boolean): string {
  return `${SOURCE_TAB_BASE} ${
    active
      ? 'border-accent text-accent'
      : 'border-hairline text-muted hover:border-emphasis hover:text-ink-soft'
  }`;
}

function sourceTabStyle(active: boolean): CSSProperties {
  return { background: active ? 'var(--color-accent-soft)' : 'transparent' };
}

/**
 * Inbox「新建采集」弹窗。骨架复刻 InboxDiscardDialog：遮罩 + role=dialog 卡片。
 * Phase 1 只有「文本/Markdown」「结构化条目」两个可用来源；URL / 文件来源需要
 * 后端新增能力（见 admin/docs/NEW-CAPTURE-PLAN.zh.md §4），此处仅置灰占位。
 * 「文本/Markdown」tab 额外支持选择本地文件/文件夹（纯前端 File API 读取，
 * 不需要后端新能力，与那个仍置灰的「文件」tab 是两回事）。
 */
export function NewCaptureDialog({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (result: { slugs: string[]; failed: { name: string; error: string }[] }) => void;
}) {
  const { submit, submitBatch, submitting, error, setError } = useCapture();
  const [tab, setTab] = useState<CaptureTab>('text');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [tagsInput, setTagsInput] = useState('');
  const [triggerEnrichment, setTriggerEnrichment] = useState(true);
  const [pickedFiles, setPickedFiles] = useState<PickedFileEntry[]>([]);
  const [skippedNonText, setSkippedNonText] = useState(0);
  const [truncatedCount, setTruncatedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const resetCaptureForm = useCallback(() => {
    setTab('text');
    setBody('');
    setTitle('');
    setType('note');
    setTagsInput('');
    setTriggerEnrichment(true);
    setPickedFiles([]);
    setSkippedNonText(0);
    setTruncatedCount(0);
    setError(null);
  }, [setError]);

  useEffect(() => {
    if (!open) return;
    resetCaptureForm();
  }, [open, resetCaptureForm]);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  const slugPreview = useMemo(() => (body.trim() ? defaultInboxSlug(body) : null), [body]);

  if (!open) return null;

  const hasPickedFiles = pickedFiles.length > 0;
  const includedCount = pickedFiles.filter((f) => f.included).length;
  const structuredMissingTitle = tab === 'structured' && title.trim().length === 0;
  const canSubmit = hasPickedFiles
    ? includedCount > 0 && !submitting
    : body.trim().length > 0 && !structuredMissingTitle && !submitting;

  const clearPickedFiles = () => {
    setPickedFiles([]);
    setSkippedNonText(0);
    setTruncatedCount(0);
  };

  const handlePicked =
    (filterText: boolean) => async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;
      const { entries, skipped, truncated } = await buildBatchEntries(files, { filterText });
      setPickedFiles(entries);
      setSkippedNonText(skipped);
      setTruncatedCount(truncated);
      setError(null);
    };

  const toggleIncluded = (key: string) => {
    setPickedFiles((prev) => prev.map((f) => (f.key === key ? { ...f, included: !f.included } : f)));
  };

  const handleSubmit = async () => {
    if (hasPickedFiles) {
      const included = pickedFiles.filter((f) => f.included);
      if (included.length === 0 || submitting) return;
      const result = await submitBatch(
        included.map((f) => ({ key: f.key, name: f.name, body: f.body, title: titleFromName(f.name), type })),
        {
          triggerEnrichment,
          onItemSettled: (outcome) => {
            setPickedFiles((prev) =>
              prev.map((f) =>
                f.key === outcome.key
                  ? outcome.status === 'success'
                    ? { ...f, status: 'success', slug: outcome.slug }
                    : { ...f, status: 'error', error: outcome.error }
                  : f,
              ),
            );
          },
        },
      );
      if (result.succeeded.length > 0) {
        onCaptured({
          slugs: result.succeeded.map((s) => s.slug),
          failed: result.failed.map((f) => ({ name: f.name, error: f.error })),
        });
      }
      return;
    }

    if (!canSubmit) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await submit({
      body,
      title: title.trim() || undefined,
      type,
      tags: tags.length > 0 ? tags : undefined,
      triggerEnrichment,
    });
    if (result) onCaptured({ slugs: [result.slug], failed: [] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-ink/25"
        aria-label="关闭"
        onClick={submitting ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-capture-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-xl"
      >
        <h2 id="new-capture-title" className="type-serif text-brain-xl font-semibold text-ink">
          新建采集
        </h2>
        <p className="mt-2 text-brain-sm leading-relaxed text-ink-soft">
          写入 inbox/ 并进入现有 enrichment 4 步流水线，与终端 <span className="font-mono">gbrain capture</span>{' '}
          效果一致。
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="采集来源">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'text'}
            onClick={() => setTab('text')}
            className={sourceTabClass(tab === 'text')}
            style={sourceTabStyle(tab === 'text')}
          >
            文本/Markdown
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'structured'}
            onClick={() => {
              setTab('structured');
              clearPickedFiles();
            }}
            className={sourceTabClass(tab === 'structured')}
            style={sourceTabStyle(tab === 'structured')}
          >
            结构化条目
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            disabled
            title="需要后端支持（URL 抓取），见方案 Phase 2"
            className="cursor-not-allowed rounded-full border border-hairline px-3 py-1 text-brain-xs text-muted opacity-40"
          >
            URL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            disabled
            title="需要后端支持（content-type processor skillpack），见方案 Phase 2"
            className="cursor-not-allowed rounded-full border border-hairline px-3 py-1 text-brain-xs text-muted opacity-40"
          >
            文件
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {tab === 'structured' && (
            <div>
              <label className="mb-1 block text-brain-sm text-ink-soft" htmlFor="capture-title">
                标题 *
              </label>
              <input
                id="capture-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-1.5 text-brain-base text-ink"
                placeholder="必填"
              />
            </div>
          )}

          {tab === 'text' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={sourceTabClass(false)}
                  style={sourceTabStyle(false)}
                >
                  选择文件
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className={sourceTabClass(false)}
                  style={sourceTabStyle(false)}
                >
                  选择文件夹
                </button>
                {hasPickedFiles && (
                  <button
                    type="button"
                    onClick={clearPickedFiles}
                    className="cursor-pointer text-brain-xs text-muted underline hover:text-ink-soft"
                  >
                    清除选择，改回手动粘贴
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.txt,.mdx"
                aria-label="选择文件"
                className="hidden"
                onChange={handlePicked(false)}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                aria-label="选择文件夹"
                className="hidden"
                onChange={handlePicked(true)}
              />
              {!hasPickedFiles && (
                <p className="text-brain-xs text-muted">
                  支持选择本地文件或文件夹（默认只采集 .md/.markdown/.txt/.mdx 文本文件）；部分浏览器可能不支持文件夹选择。
                </p>
              )}
              {hasPickedFiles && (
                <>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-hairline">
                    {pickedFiles.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-center gap-2 border-b border-hairline px-3 py-1.5 text-brain-sm last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={f.included}
                          onChange={() => toggleIncluded(f.key)}
                          style={{ accentColor: 'var(--color-accent)' }}
                        />
                        <span className="flex-1 truncate font-mono text-brain-xs text-ink-soft">{f.name}</span>
                        <span className="text-brain-xs text-muted">{formatSize(f.size)}</span>
                        {f.status === 'success' && <Badge tone="ok">成功</Badge>}
                        {f.status === 'error' && (
                          <span className="flex items-center gap-1">
                            <Badge tone="contra">失败</Badge>
                            <span className="text-brain-xs text-muted">{f.error}</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {skippedNonText > 0 && (
                    <p className="text-brain-xs text-muted">已忽略 {skippedNonText} 个非文本文件</p>
                  )}
                  {truncatedCount > 0 && (
                    <p className="text-brain-xs text-muted">
                      仅处理前 {MAX_BATCH_FILES} 个文件（另有 {truncatedCount} 个未处理，可分批选择）
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-brain-sm text-ink-soft" htmlFor="capture-type">
                类型
              </label>
              <select
                id="capture-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-1.5 text-brain-base text-ink"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {tab === 'text' && !hasPickedFiles && (
              <div className="flex-1">
                <label className="mb-1 block text-brain-sm text-ink-soft" htmlFor="capture-title-opt">
                  标题（可选）
                </label>
                <input
                  id="capture-title-opt"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-transparent px-3 py-1.5 text-brain-base text-ink"
                />
              </div>
            )}
          </div>

          {tab === 'structured' && (
            <div>
              <label className="mb-1 block text-brain-sm text-ink-soft" htmlFor="capture-tags">
                标签（逗号分隔，可选）
              </label>
              <input
                id="capture-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-1.5 text-brain-base text-ink"
                placeholder="a, b, c"
              />
            </div>
          )}

          {(tab === 'structured' || !hasPickedFiles) && (
            <div>
              <label className="mb-1 block text-brain-sm text-ink-soft" htmlFor="capture-body">
                正文 *
              </label>
              <textarea
                id="capture-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-brain-base text-ink"
                placeholder={tab === 'text' ? '支持带 --- frontmatter 的粘贴内容' : '正文内容'}
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-1.5 text-brain-sm text-ink-soft">
            <input
              type="checkbox"
              checked={triggerEnrichment}
              onChange={(e) => setTriggerEnrichment(e.target.checked)}
              className="cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            采集后立即触发 enrichment
          </label>
        </div>

        {error && (
          <p className="mt-3 text-brain-sm" style={{ color: 'var(--color-contra)' }}>
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-brain-xs text-muted">
            {hasPickedFiles ? `${includedCount} 个文件待采集` : slugPreview ? `→ ${slugPreview}` : ' '}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="cursor-pointer rounded-lg border border-hairline bg-transparent px-4 py-2 text-brain-base text-ink-soft hover:bg-hairline/40 disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="cursor-pointer rounded-lg border-0 px-4 py-2 text-brain-base font-medium text-inverse disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--color-accent)' }}
            >
              {submitting ? '处理中…' : hasPickedFiles ? `采集 ${includedCount} 个文件` : '采集'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
