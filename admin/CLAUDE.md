# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: the `admin/` GBrain admin dashboard SPA. For the backend/CLI/MCP server, read the
repo-root `CLAUDE.md` first — it owns the operations contract, engines, and release process.

## Fork-safe 默认策略 vs 非 fork-safe 例外

This SPA is a downstream fork's addition layered on top of upstream gbrain. The **goal**
is that the admin layer can usually `git merge upstream/master` with **zero conflicts**.

### 默认：fork-safe（Phase 1）

Implement admin UI features **inside `admin/` only**. Prefer existing MCP ops
(`/admin/api/op`, `/mcp`) over new backend code.

- All admin code, deps, and config live inside `admin/`.
- Add frontend deps with `cd admin && bun add <pkg>` — they go in `admin/package.json` only.
- Admin tests live under `admin/src/**/*.test.{ts,tsx}` (`cd admin && bun run test`).
  Do **not** add admin cases to the repo-root `test/` tree (upstream-owned).
- `admin/dist/` is committed (embedded into the compiled binary); `admin/node_modules/` is
  git-ignored.

### upstream 树（merge 时与 upstream 冲突的高风险区）

`src/`, `scripts/`, `test/`, root `package.json`, `VERSION`, `CHANGELOG.md`, and other
files owned by upstream gbrain — not an absolute ban on backend work, but **off the
default path** for admin features.

### 例外：非 fork-safe（Phase 2）—— **须人工确认**

When an admin feature **requires** new backend capability (new op, new route, processor
skillpack, root deps, upstream tests, etc.):

1. **Stop and ask the human operator to confirm** before editing anything in the upstream
   tree. Agents must not proceed on their own inference — explicit yes/no required.
2. Deliver as a **separate PR or commit** from fork-safe admin UI work; do not mix lanes in
   one delivery unless the human explicitly approves that combined scope.
3. Label the work **non-fork-safe** in PR title/body; expect manual conflict resolution on
   `git merge upstream/master` and run `admin/docs/TYPE-MIRROR-CHECKLIST.md` afterward.
4. Ideal end state: contribute upstream, or track fork-only patches (e.g. `CUSTOM.md`).

### 编译边界（与是否改后端无关，始终成立）

`admin/tsconfig.json` scopes `include: ['src']` to `admin/src/`, so you **cannot
`import` from `../../src/core/*`**. The admin bundle is a browser SPA; core is Bun/DB
server code. Shared shapes are **hand-maintained mirrors** (see "Type & scope mirrors"
below); copy pure helpers into `admin/src/lib/` when behavior must match upstream.

## Commands (run from `admin/`)

```bash
cd admin
bun install            # deps (first time / after admin/package.json changes)
bun run dev            # Vite dev server (proxies /admin/api + /mcp → :3131)
bun run build          # vite build → admin/dist/  (base path is /admin/)
bun run test           # vitest run (full suite, jsdom)
bun run test:watch     # vitest watch mode
bun run test -- src/routes.test.ts            # single file
bun run test -- -t "resolveRoute"             # match test name
```

**本地联调（热更新前端 + 真实后端）** — 两个终端：

```bash
# 终端 1（仓库根目录）：HTTP 服务 + admin API + MCP
bun run src/cli.ts serve --http --port 3131

# 终端 2
cd admin && bun run dev
# 打开 http://localhost:5173/admin/#/inbox
# 首次在 #login 粘贴终端打印的 Admin Token
```

`vite.config.ts` 把 `/admin/login`、`/admin/api/*`、`/admin/events`、`/mcp` 代理到
`GBRAIN_DEV_API`（默认 `http://127.0.0.1:3131`）。Cookie 鉴权与生产一致。
PGLite 下 `trigger_inbox_enrichment` 入队后需手动 `--follow` 执行 job（见根目录 `gbrain jobs submit inbox_enrich --follow`）。

From the repo root, `bun run build:admin` runs the admin build **and** re-embeds it into the
binary (`vite build` → `scripts/build-admin-embedded.ts` → `src/admin-embedded.ts`'s
`ADMIN_ASSETS`). CI guards this pipeline: `scripts/check-admin-build.sh`,
`check-admin-embedded.sh`, and `check-admin-scope-drift.sh` all run in `bun run verify`.
There is no typecheck script inside `admin/`; the root `bun run typecheck` (`tsc --noEmit`)
covers admin sources too — run it after changes.

## Two surfaces, one SPA

The dashboard hosts two visually distinct products sharing font family + 4px spacing base,
diverging on theme/color (see `admin/DESIGN.md`):

- **Ops** surface — the original dark "cockpit" (6 pages: Dashboard/Agents/RequestLog/
  Calibration/JobsWatch/Login). Plain CSS, no brand color, "data is the color".
- **Brain** surface — a newer light "warm-paper" reading UI (8 knowledge pages under
  `pages/brain/`). Tailwind v4 + teal accent + Lucide icon nav. Scoped by
  `[data-surface='brain']`; tokens live in `admin/src/tailwind.css` `@theme`.

Do not "unify" them — the split is a deliberate, confirmed decision (route A in
`admin/docs/FRONTEND_PLAN.zh.md` §0). Match the surface you're editing.

## Routing

Hash-based, no router library. `admin/src/routes.ts` is the **single source** for both the
sidebar and page dispatch — adding a page = adding one row to `BRAIN_ROUTES`/`OPS_ROUTES`
plus a `case` in `App.tsx`'s `renderBrainPage`/`renderOpsPage`. Brain routes carry a leading
slash (`#/inbox`); Ops routes are bare names (`#dashboard`). That leading slash is what keeps
`#/jobs` (Brain scheduling) and `#jobs` (Ops JobsWatch) from colliding. Empty hash → Ops
dashboard (preserves original landing behavior). Query params are parsed (`#/ask?q=foo`).
The heavy `Graph` page (d3-force) is `React.lazy`-loaded.

## Data access: two channels

- **Tier1 REST** (`admin/src/api.ts`) → `/admin/api/*`, cookie-authenticated. Backend-shaped
  endpoints (stats, agents, requests, calibration, jobs/watch). `apiFetch` for JSON,
  `apiFetchText` for SVG.
- **Tier3 MCP** (`admin/src/lib/mcp-client.ts`, consumed via the `useMcp` hook) → the full
  `operations.ts` contract as JSON-RPC. Channel auto-selects: an **in-memory** MCP token
  (from the API Keys page) → `POST /mcp` with `Bearer`; otherwise falls back to the
  cookie-authed `/admin/api/op` proxy. Handles both `application/json` and `text/event-stream`
  responses, and unwraps MCP tool-level errors (`result.isError`) into thrown `McpError`.
- **Live feed** via SSE (`admin/src/lib/useSSE.ts`) and polling (`usePolling.ts`).

**Trust model (D11/D12) — do not weaken it:** no session token is ever written to
`localStorage`/`sessionStorage`. The HttpOnly cookie from `/admin/login` is the only session
credential; the MCP Bearer token lives only in a module-level variable. Any `401` redirects
to `#login` — there is no silent re-auth from a saved token.

## Type & scope mirrors (sync after every upstream merge)

Because of the compile boundary, two files are **hand-maintained duplicates** of upstream:

- `admin/src/lib/op-types.ts` mirrors response shapes from `src/commands/serve-http.ts`,
  `src/core/operations.ts`, `src/core/types.ts`, etc. Follow the checklist in
  `admin/docs/TYPE-MIRROR-CHECKLIST.md` after `git merge upstream/master`. There is
  deliberately **no CI guard** for these (fork-safe 下不在 `scripts/` 新增；见上文非 fork-safe 例外);
  it's a manual cross-check. Some mirrors (`QueryResult`, `ThinkResult`) are intentionally loose — only
  the fields the UI renders — so upstream adding fields never breaks the frontend.
- `admin/src/lib/scope-constants.ts` mirrors `ALLOWED_SCOPES_LIST` from `src/core/scope.ts`.
  This one **is** guarded — `scripts/check-admin-scope-drift.sh` fails `bun run verify` if the
  two lists drift. Keep it alphabetically sorted.

## Conventions

- `pages/brain/` reusable components live in `components/brain/` (PageHeader, StatCard, Badge,
  StatusPill, Drawer, AsyncState, McpConnect, PipelineSteps, GraphCanvas). Use `AsyncState` for
  loading/error/empty rather than hand-rolling per page.
- Read `admin/DESIGN.md` before adding UI — it encodes hard anti-patterns (no centered table
  data, no gradients/shadows, no loading spinners — show stale data until fresh arrives).
- Docs and comments in this subtree are largely in Chinese, matching the surrounding code —
  match the local language of the file you're editing.
