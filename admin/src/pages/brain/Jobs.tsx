import { Cpu } from 'lucide-react';
import { PageHeader, WhyButton, JobsQueueSection, DreamCycleCard } from '../../components/brain';

export function Jobs() {
  return (
    <div className="brain-page-wide">
      <PageHeader
        kicker="// 引擎 · 任务监控"
        icon={<Cpu size={22} aria-hidden />}
        title="Minions 队列 · Dream Cycle"
        subtitle={
          <span className="inline leading-relaxed">
            minion 作业队列（每 3s 刷新）· deterministic task ~753ms vs sub-agent 10s+ ·
            <WhyButton topic="minions-queue" className="mx-1 align-middle" />
            <WhyButton topic="dream-cycle" className="align-middle" />
          </span>
        }
      />

      <JobsQueueSection />

      <div className="mb-6">
        <DreamCycleCard />
      </div>
    </div>
  );
}
