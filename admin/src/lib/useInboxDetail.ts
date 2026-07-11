import { useMcp } from './useMcp';
import type { InboxItem } from './op-types';

/**
 * 选中 slug 时通过专用契约懒加载 raw/enriched/typed-links。
 * 薄包装：实际取数/loading/error/新鲜度保护全部交给 useMcp；这里只额外处理
 * "slug 变 null 时立即清空"这个 useMcp 本身不提供的语义（disabled 时它保留旧 data）。
 */
export function useInboxDetail(slug: string | null) {
  const { data, loading, error } = useMcp<InboxItem>(
    'get_inbox_item',
    { slug: slug ?? '' },
    { enabled: slug != null },
  );

  if (slug == null) {
    return { detail: null, loading: false, error: null };
  }
  return { detail: data, loading, error };
}
