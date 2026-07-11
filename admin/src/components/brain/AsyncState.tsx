/** 统一的加载/错误/空态渲染，减少各页重复。 */
export function AsyncState({
  loading,
  error,
  empty,
  emptyText = '暂无数据。',
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText?: string;
}) {
  if (loading) return <div className="px-5 py-10 text-center text-brain-base text-muted">加载中…</div>;
  if (error) return <div className="px-5 py-10 text-center text-brain-base text-contra">{error}</div>;
  if (empty) return <div className="px-5 py-10 text-center text-brain-base text-muted">{emptyText}</div>;
  return null;
}
