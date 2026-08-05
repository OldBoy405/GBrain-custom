---
type: Quickstart
title: GBrain Code Wiki
description: Entrypoint to the GBrain code wiki — a personal knowledge brain with hybrid RAG search, dual-engine Postgres storage, and autonomous dream-cycle enrichment. Covers architecture, data pipelines, search/retrieval, the dream cycle, and testing.
tags: [quickstart, overview, gbrain]
---

GBrain is a **personal knowledge brain** built in TypeScript (Bun runtime) by Y Combinator CEO Garry Tan. It provides hybrid RAG search (vector HNSW + keyword FTS + relational recall + graph signals) over a personal knowledge base of markdown pages, backed by two pluggable engines: **PGLite** (WASM-embedded Postgres, zero-config default) and **Postgres + pgvector** (Supabase or self-hosted).

The production deployment runs 146,646 pages, 24,585 people, 5,339 companies, with 66 cron jobs autonomously enriching the brain overnight.

> **This is a fork** maintained at `github.com/OldBoy405/GBrain-custom` on branch `custom/main`, aligned to upstream v0.42.62.0. See [CUSTOM.md](/CUSTOM.md) for the full fork change log.

## How the wiki is organized

- [Architecture Overview](/openwiki/architecture/overview.md) — the two-engine model, contract-first operations, trust boundaries, MCP server, and skill system
- [Ingest Pipeline](/openwiki/workflows/ingest-pipeline.md) — how data enters the brain: sync, import, capture, chunking, embedding, and atomic write-through
- [Search and Retrieval](/openwiki/workflows/search-retrieval.md) — the hybrid search pipeline, graph signals, Retrieval Reflex, and the `think` synthesis command
- [Dream Cycle](/openwiki/workflows/dream-cycle.md) — the 24/7 autonomous enrichment cycle: phases, Minions job queue, and overnight compound effect
- [Testing and Operations](/openwiki/operations/testing.md) — test taxonomy, isolation rules, doctor health checks, CI pipeline, and operational runbook

## Quick source map

| Area | Key source |
|------|-----------|
| CLI entrypoint | [`src/cli.ts`](/src/cli.ts) |
| Contract-first operations | [`src/core/operations.ts`](/src/core/operations.ts) |
| Engine interface | [`src/core/engine.ts`](/src/core/engine.ts) |
| PGLite engine | [`src/core/pglite-engine.ts`](/src/core/pglite-engine.ts) |
| Postgres engine | [`src/core/postgres-engine.ts`](/src/core/postgres-engine.ts) |
| Engine factory | [`src/core/engine-factory.ts`](/src/core/engine-factory.ts) |
| Hybrid search | [`src/core/search/hybrid.ts`](/src/core/search/hybrid.ts) |
| Link extraction (graph) | [`src/core/link-extraction.ts`](/src/core/link-extraction.ts) |
| Markdown parsing | [`src/core/markdown.ts`](/src/core/markdown.ts) |
| Import pipeline | [`src/core/import-file.ts`](/src/core/import-file.ts) |
| Sync engine | [`src/core/sync.ts`](/src/core/sync.ts) |
| Dream cycle | [`src/core/cycle.ts`](/src/core/cycle.ts) |
| Minions (job queue) | [`src/core/minions/`](/src/core/minions/) |
| MCP server | [`src/mcp/server.ts`](/src/mcp/server.ts) |
| Config system | [`src/core/config.ts`](/src/core/config.ts) |
| Migrations | [`src/core/migrate.ts`](/src/core/migrate.ts) |
| Doctor (health) | [`src/commands/doctor.ts`](/src/commands/doctor.ts) |
| Admin SPA | [`admin/`](/admin/) |
| Skills | [`skills/`](/skills/) |
| Tests | [`test/`](/test/) |

## Fork-specific customizations

This fork adds several features on top of upstream:

- **Inbox workflow** — `src/core/inbox.ts`, plus ops `list_inbox`, `get_inbox_item`, `trigger_inbox_enrichment`, `discard_inbox_items`
- **Truth compilation** — `src/core/conflicts.ts`, `src/core/compile-truth.ts`, plus ops `find_conflicts`, `compile_truth`, `adopt_compiled_truth`
- **Graph overview** — `graph_overview` op with degree-based top-N subgraph
- **Graph node metadata** — `to_title`/`to_type` on `GraphPath` for frontend rendering
- **Jobs execution lane** — `src/core/minions/execution-lane.ts` for per-job lane tagging
- **Admin cookie proxy** — `POST /admin/api/op` route in `src/commands/serve-http.ts`
- **DeepSeek provider** — AI recipe at `src/core/ai/recipes/deepseek.ts`
- **Ollama embedding dimensions** — provider-aware dimension passthrough in `src/core/ai/dims.ts`

Full change log with merge conflict resolution rules is in [CUSTOM.md](/CUSTOM.md).

## Key architectural invariants

These are load-bearing — see the [Architecture Overview](/openwiki/architecture/overview.md) for details:

1. **Trust is fail-closed.** `OperationContext.remote` is required; anything not strictly `false` is treated as remote/untrusted.
2. **Source isolation.** Every read-side op routes through `sourceScopeOpts(ctx)` — a missed thread is a cross-source data leak.
3. **JSONB: never `JSON.stringify` into `::jsonb`.** Postgres.js double-encodes it; PGLite hides the bug.
4. **Engine parity.** New methods/SQL shapes land in BOTH `pglite-engine.ts` and `postgres-engine.ts`, pinned by `test/e2e/engine-parity.test.ts`.
5. **Contract-first.** `src/core/operations.ts` is the single source; CLI + MCP are generated from it.
6. **Migrations.** Schema DDL lives in the `MIGRATIONS` array in `src/core/migrate.ts`.
7. **Multi-source.** Slug uniqueness is `(source_id, slug)`, not slug alone.

## Development quickstart

```bash
bun install                          # install dependencies
bun run typecheck                    # TypeScript check
bun run test                         # run unit tests (~85s, 3700+ tests)
bun run verify                       # pre-push gate (~30 static checks + typecheck)
bun run src/cli.ts doctor            # run health checks
bun run dev                          # run CLI in dev mode
```

## Backlog

- **Minions deep dive** — the job queue system is substantial; covered briefly in the dream cycle page. Deferred until a dedicated operations page is needed.
- **Knowledge graph internals** — link extraction and graph traversal algorithms; covered in architecture overview but deeper exploration deferred.
- **Admin SPA** — `admin/` directory (Vite/React app); out of scope for initial code wiki.
- **Schema pack authoring** — already documented comprehensively in `docs/schema-author-tutorial.md` and `docs/architecture/schema-packs.md`.
- **Skill authoring** — already documented comprehensively in `docs/GBRAIN_SKILLPACK.md` and `docs/skillpack-anatomy.md`.
- **Integration/provider setup** — already documented in `docs/ai-providers/`, `docs/mcp/`, and `docs/integrations/`.
