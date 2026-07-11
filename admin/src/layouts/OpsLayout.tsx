import React from 'react';
import { OPS_ROUTES } from '../routes';
import { api } from '../api';

/**
 * Ops 表层壳（暗色 cockpit）—— 逐字沿用原 App.tsx 的侧边栏结构与 className，
 * 仅把导航项改为从 OPS_ROUTES 生成，行为与视觉保持不变（零回归）。
 */
export function OpsLayout({
  activePath,
  navigate,
  children,
}: {
  activePath: string;
  navigate: (path: string) => void;
  children: React.ReactNode;
}) {
  const handleSignOutEverywhere = async () => {
    if (
      !confirm(
        'Sign out every active admin session, including other browsers and tabs? Each one will need to re-authenticate via a fresh magic link.',
      )
    ) {
      return;
    }
    try {
      await api.signOutEverywhere();
    } catch {
      // Even if the call fails, push to login — cookie is likely already invalid.
    }
    navigate('login');
  };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-logo">GBrain</div>
        <div className="sidebar-nav">
          {OPS_ROUTES.map((r) => (
            <a
              key={r.path}
              className={`nav-item ${activePath === r.path ? 'active' : ''}`}
              onClick={() => navigate(r.path)}
            >
              {r.label}
            </a>
          ))}
        </div>
        <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSignOutEverywhere}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              width: '100%',
            }}
            title="Revoke every active admin session — every browser, every tab"
          >
            Sign out everywhere
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
