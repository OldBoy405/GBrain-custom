import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InboxCard } from '../InboxCard';
import type { InboxItem } from '../../../lib/op-types';

function makeItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    slug: 'inbox/foo',
    source_id: 'host',
    type: 'inbox',
    title: '测试条目',
    updated_at: '2026-07-14T10:00:00Z',
    source_kind: 'manual',
    source_uri: null,
    ingested_at: null,
    status: 'pending_frontmatter',
    tier: null,
    job_id: null,
    error: null,
    preview: '',
    ...overrides,
  };
}

describe('InboxCard 勾选框', () => {
  it('merging 状态下勾选框禁用', () => {
    const { getByRole } = render(
      <InboxCard
        item={makeItem({ status: 'merging' })}
        selected={false}
        checked={false}
        onSelect={() => {}}
        onCheck={() => {}}
      />,
    );
    expect(getByRole('checkbox')).toBeDisabled();
  });

  it('非 merging 状态下勾选框可用，点击触发 onCheck', () => {
    const onCheck = vi.fn();
    const { getByRole } = render(
      <InboxCard
        item={makeItem({ status: 'pending_frontmatter' })}
        selected={false}
        checked={false}
        onSelect={() => {}}
        onCheck={onCheck}
      />,
    );
    const checkbox = getByRole('checkbox');
    expect(checkbox).not.toBeDisabled();
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCheck).toHaveBeenCalledWith('inbox/foo', true);
  });
});
