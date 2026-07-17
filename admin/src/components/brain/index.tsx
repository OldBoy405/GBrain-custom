/**
 * Brain 表层通用组件 barrel。全部用 @theme token 驱动，不写死颜色。
 */

export { PageHeader } from './PageHeader';
export { StatCard } from './StatCard';
export { Badge } from './Badge';
export type { BadgeTone } from './Badge';
export { StatusPill } from './StatusPill';
export { McpConnect } from './McpConnect';
export { Drawer } from './Drawer';
export { AsyncState } from './AsyncState';
export { BrainTopBar } from './BrainTopBar';
export { PipelineSteps } from './PipelineSteps';
export { EnrichmentPipeline } from './EnrichmentPipeline';
export { InboxCard } from './InboxCard';
export { InboxDetail } from './InboxDetail';
export { InboxDiscardDialog } from './InboxDiscardDialog';
export type { InboxDiscardMode } from './InboxDiscardDialog';
export { NewCaptureDialog } from './NewCaptureDialog';
export { EnrichmentDiff } from './EnrichmentDiff';
export { TypedLinkTable } from './TypedLinkTable';
export { WhyButton } from './WhyButton';
export { WhyProvider, useWhy } from './WhyProvider';
export { JobQueueColumns } from './JobQueueColumns';
export { JobsQueueSection } from './JobsQueueSection';
export { DreamCycleCard } from './DreamCycleCard';
export { DeterministicExplainer } from './DeterministicExplainer';
export { TraceWaterfall } from './TraceWaterfall';

