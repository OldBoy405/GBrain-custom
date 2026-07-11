import { useRef, useState } from 'react';
import { api } from '../../api';
import { usePolling } from '../../lib/usePolling';
import { useSSE } from '../../lib/useSSE';
import type { AdminStats, HealthIndicators, FeedEvent } from '../../lib/op-types';
import { PageHeader, StatCard, StatusPill, WhyButton } from '../../components/brain';
import { TodayHero } from './TodayHero';
import { TodayStory } from './TodayStory';
import { ActivityFeedTable } from './ActivityFeedTable';
import { MetricDetailDrawer, type MetricKey } from './MetricDetailDrawer';
import { AdvisorPanel } from './AdvisorPanel';

function goAsk() {
  window.location.hash = '#/ask';
}

export function Today() {
  const [showStory, setShowStory] = useState(false);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const storyRef = useRef<HTMLElement>(null);

  const { data: stats, error: statsError } = usePolling<AdminStats>(
    () => api.stats(),
    { intervalMs: 30_000, initialData: { connected_agents: 0, active_tokens: 0, active_api_keys: 0, requests_today: 0 } },
  );
  const { data: health, error: healthError } = usePolling<HealthIndicators>(
    () => api.health(),
    { intervalMs: 30_000, initialData: { expiring_soon: 0, error_rate: '0%' } },
  );
  const { status, events } = useSSE<FeedEvent>('/admin/events', { max: 50 });

  const refreshError = statsError ?? healthError;

  const handleHowItWorks = () => {
    // 已展开则直接滚动；否则挂载 TodayStory，由它在 mount 时把自己滚入视口。
    if (showStory) {
      storyRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } else {
      setShowStory(true);
    }
  };

  return (
    <div className="bg-canvas">
      <TodayHero onTryQuery={goAsk} onHowItWorks={handleHowItWorks} />
      {showStory && <TodayStory visible sectionRef={storyRef} onTryQuery={goAsk} />}

      <div className="brain-section py-8">
        <PageHeader
          kicker="工作台"
          title="运营概览"
          subtitle={
            <span className="inline leading-relaxed">
              实时活动流、连接与健康（Tier1 实链路）· SSE 推送活动 · 30s 轮询指标。
              <WhyButton topic="sse-activity-feed" className="ml-1 align-middle" />
            </span>
          }
          right={<StatusPill status={status} />}
        />

        {refreshError && (
          <div
            className="mb-4 rounded-lg border border-hairline bg-surface px-4 py-2 text-brain-sm"
            style={{ color: 'var(--color-contra)' }}
            role="status"
          >
            指标刷新失败：{refreshError}（显示的是最近一次成功的数据）
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard value={stats.connected_agents} label="连接的 Agent" onClick={() => setMetric('connected_agents')} />
          <StatCard value={stats.requests_today} label="今日请求" onClick={() => setMetric('requests_today')} />
          <StatCard value={stats.active_tokens} label="活跃令牌" onClick={() => setMetric('active_tokens')} />
          <StatCard value={stats.active_api_keys} label="API Keys" onClick={() => setMetric('active_api_keys')} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <StatCard value={health.expiring_soon} label="即将过期令牌" accent="var(--color-amber)" onClick={() => setMetric('expiring_soon')} />
          <StatCard value={health.error_rate} label="24h 错误率" accent="var(--color-contra)" onClick={() => setMetric('error_rate')} />
        </div>

        <div className="mt-8">
          <div className="type-section-label mb-3">实时活动</div>
          <ActivityFeedTable events={events} status={status} />
        </div>

        <AdvisorPanel />
      </div>

      <MetricDetailDrawer metric={metric} onClose={() => setMetric(null)} />
    </div>
  );
}
