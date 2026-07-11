import { CircleHelp } from 'lucide-react';

import type { WhyTopicId } from '../../lib/why-topics';
import { WHY_TOPICS } from '../../lib/why-topics';
import { useWhy } from './WhyProvider';

/**
 * 行内「Why?」教育按钮 —— 对齐案例 MHTML data-why-topic 交互。
 * 悬停：title tooltip + accent 高亮；点击：打开 layout 级 WhyPanel。
 */
export function WhyButton({ topic, className = '' }: { topic: WhyTopicId; className?: string }) {
  const { open } = useWhy();
  const { tooltip } = WHY_TOPICS[topic];

  return (
    <button
      type="button"
      data-why-topic={topic}
      data-testid={`why-${topic}`}
      title={tooltip}
      aria-label={tooltip}
      onClick={() => open(topic)}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-hairline bg-elevated px-2 py-0.5 font-mono text-brain-xs text-accent transition hover:border-accent/30 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent/40 ${className}`}
    >
      <CircleHelp size={11} aria-hidden />
      Why?
    </button>
  );
}
