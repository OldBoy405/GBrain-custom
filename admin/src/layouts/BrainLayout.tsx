import React from 'react';

import { GitBranch } from 'lucide-react';

import { BRAIN_ROUTES, type NavRoute } from '../routes';

import { BrainTopBar } from '../components/brain/BrainTopBar';
import { WhyProvider } from '../components/brain/WhyProvider';

import { api } from '../api';



/**

 * Brain 表层壳 —— 对齐 docs/前端案例 MHTML 侧边栏：

 * 四色 logo、分组导航、左侧激活条、底部仓库链接。

 * 顶栏与侧栏 logo 区同处 Grid 第一行，行高由内容自适应对齐。

 */



function groupRoutes(routes: NavRoute[]): Array<{ group: string; items: NavRoute[] }> {

  const order: string[] = [];

  const map = new Map<string, NavRoute[]>();

  for (const r of routes) {

    if (!map.has(r.group)) {

      map.set(r.group, []);

      order.push(r.group);

    }

    map.get(r.group)!.push(r);

  }

  return order.map((group) => ({ group, items: map.get(group)! }));

}



function BrandMark() {
  return (
    <div className="brain-sidebar-brand-mark relative shrink-0">
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 rounded-md bg-ink p-0.5">
        <div className="rounded-sm bg-accent" />
        <div className="rounded-sm bg-amber" />
        <div className="rounded-sm bg-coral" />
        <div className="rounded-sm bg-node-synthesis" />
      </div>
    </div>
  );
}



export function BrainLayout({

  activePath,

  navigate,

  children,

}: {

  activePath: string;

  navigate: (path: string) => void;

  children: React.ReactNode;

}) {

  const groups = groupRoutes(BRAIN_ROUTES);

  const pageLabel = BRAIN_ROUTES.find((r) => r.path === activePath)?.label ?? '页面';

  const handleSignOut = async () => {

    if (!confirm('退出所有活跃的管理会话（含其他浏览器与标签页）？每个会话都需通过新的魔法链接重新登录。')) return;

    try {

      await api.signOutEverywhere();

    } catch {

      // 即便调用失败也跳登录页 —— cookie 很可能已失效。

    }

    navigate('login');

  };



  return (
    <WhyProvider>
    <div

      data-surface="brain"

      className="grid h-screen overflow-hidden bg-canvas font-sans-sc text-ink"

      style={{ gridTemplateColumns: 'clamp(13rem,16vw,15rem) minmax(0,1fr)', gridTemplateRows: 'auto 1fr' }}

    >

      <div className="brain-brand-strip flex items-center border-b border-r border-hairline bg-elevated py-5 pr-4">

        <button

          type="button"

          onClick={() => navigate('/')}

          className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left"

        >

          <BrandMark />

          <div className="flex min-w-0 flex-col leading-tight">

            <span className="brain-sidebar-brand-title type-serif font-semibold tracking-tight text-ink">GBrain 工程台</span>
            <span className="brain-sidebar-brand-subtitle font-mono text-muted">知识大脑 · 管理界面</span>

          </div>

        </button>

      </div>



      <BrainTopBar pageLabel={pageLabel} navigate={navigate} />



      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-hairline bg-elevated">

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">

          {groups.map((g) => (

            <div key={g.group}>

              <div className="brain-sidebar-group-label mb-1.5 px-2 font-mono tracking-wider text-muted">{g.group}</div>

              <div className="flex flex-col gap-0.5">

                {g.items.map((r) => {

                  const Icon = r.icon;

                  const active = r.path === activePath;

                  return (

                    <button

                      key={r.path}

                      type="button"

                      onClick={() => navigate(r.path)}

                      className={`brain-sidebar-nav-btn relative flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent pr-2.5 text-left transition ${
                        active
                          ? 'font-medium text-accent'
                          : 'text-ink-soft hover:bg-subtle hover:text-ink'
                      }`}
                    >
                      {active && (
                        <span className="brain-sidebar-nav-btn-active-bar absolute left-0 w-0.5 rounded-full bg-accent" aria-hidden />
                      )}
                      <span className="brain-sidebar-nav-btn-content">
                        {Icon && (
                          <Icon
                            strokeWidth={2}
                            className={active ? 'shrink-0 text-accent' : 'shrink-0 text-muted'}
                            aria-hidden
                          />
                        )}
                        <span className="truncate">{r.label}</span>
                      </span>

                    </button>

                  );

                })}

              </div>

            </div>

          ))}

        </nav>



        <div className="space-y-2 border-t border-hairline p-3">

          <a

            href="https://github.com/garrytan/gbrain"

            target="_blank"

            rel="noreferrer"

            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-brain-sm text-ink-soft transition hover:bg-subtle hover:text-ink"

          >

            <GitBranch size={14} aria-hidden />

            garrytan/gbrain

          </a>



          <button

            type="button"

            onClick={handleSignOut}

            className="w-full cursor-pointer border-0 bg-transparent px-2 py-1 text-left font-mono text-brain-xs text-muted hover:text-ink"

            title="撤销所有活跃管理会话"

          >

            退出所有会话

          </button>

        </div>

      </aside>



      <main className="brain-main-scroll min-h-0 min-w-0 overflow-y-auto">{children}</main>

    </div>
    </WhyProvider>
  );

}

