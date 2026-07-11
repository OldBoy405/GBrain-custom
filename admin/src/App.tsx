import React, { useEffect, useState, lazy, Suspense } from 'react';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { AgentsPage } from './pages/Agents';
import { RequestLogPage } from './pages/RequestLog';
import { CalibrationPage } from './pages/Calibration';
import { JobsWatchPage } from './pages/JobsWatch';
import { OpsLayout } from './layouts/OpsLayout';
import { BrainLayout } from './layouts/BrainLayout';
import { ThreeParadigms } from './pages/brain/ThreeParadigms';
import { Today } from './pages/brain/Today';
import { Jobs } from './pages/brain/Jobs';
import { Inbox } from './pages/brain/Inbox';
import { Ask } from './pages/brain/Ask';
import { Skills } from './pages/brain/Skills';
import { Synthesize } from './pages/brain/Synthesize';
import { BrainPlaceholder } from './pages/brain/Placeholder';
import { ErrorBoundary } from './components/brain/ErrorBoundary';
import { McpTokenProvider } from './lib/McpTokenContext';
import { LastQueryProvider } from './lib/LastQueryContext';
import { DEFAULT_ROUTE, normalizeHash, resolveRoute } from './routes';

// 代码分割：知识网络页拉入 d3-force（最重的可视化依赖），按路由懒加载。
const Graph = lazy(() => import('./pages/brain/Graph').then((m) => ({ default: m.Graph })));

function renderOpsPage(path: string) {
  switch (path) {
    case 'agents':
      return <AgentsPage />;
    case 'log':
      return <RequestLogPage />;
    case 'calibration':
      return <CalibrationPage />;
    case 'jobs':
      return <JobsWatchPage />;
    case 'dashboard':
    default:
      return <DashboardPage />;
  }
}

function renderBrainPage(path: string) {
  switch (path) {
    case '/three-paradigms':
      return <ThreeParadigms />;
    case '/':
      return <Today />;
    case '/inbox':
      return <Inbox />;
    case '/ask':
      return <Ask />;
    case '/graph':
      return <Graph />;
    case '/synthesize':
      return <Synthesize />;
    case '/jobs':
      return <Jobs />;
    case '/skills':
      return <Skills />;
    default:
      return <BrainPlaceholder title="未知页面" phase="—" note="该路由暂未注册。" />;
  }
}

export function App() {
  const [hash, setHash] = useState<string>(() => window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const key = normalizeHash(hash);
  if (key === 'login') {
    return <LoginPage onLogin={() => navigate('/')} />;
  }

  const route = resolveRoute(hash);

  if (route?.surface === 'brain') {
    return (
      <McpTokenProvider>
        <LastQueryProvider>
          <BrainLayout activePath={route.path} navigate={navigate}>
            <ErrorBoundary key={route.path}>
              <Suspense fallback={<div className="px-8 py-16 text-center text-brain-base text-muted">加载中…</div>}>
                {renderBrainPage(route.path)}
              </Suspense>
            </ErrorBoundary>
          </BrainLayout>
        </LastQueryProvider>
      </McpTokenProvider>
    );
  }

  // ops 表层（默认）：未匹配到路由时回落到现有 dashboard，保持原有落地行为。
  const opsPath = route?.surface === 'ops' ? route.path : DEFAULT_ROUTE;
  return (
    <OpsLayout activePath={opsPath} navigate={navigate}>
      {renderOpsPage(opsPath)}
    </OpsLayout>
  );
}
