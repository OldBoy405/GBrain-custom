# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## What is GBrain

GBrain is a personal knowledge brain and retrieval system written in TypeScript (Bun runtime). It provides hybrid RAG search (vector + keyword + relational) over a personal knowledge base of markdown pages. Two storage engines: PGLite (embedded Postgres via WASM, zero-config default) and Postgres + pgvector (managed Supabase or self-hosted). The CLI and MCP server are both generated from a single contract-first operation definitions file.

> **Becoming someone's persistent personal agent** (identity + memory + private repo)?
> Follow [`BOOTSTRAP_FOR_AGENTS.md`](./BOOTSTRAP_FOR_AGENTS.md) — the `gbrain bootstrap`
> flow — instead of the plain install below, then come back here for the operating
> protocol. Connecting to an EXISTING remote brain from a laptop agent?
> `gbrain connect https://your-host/mcp --token gbrain_xxx --install` (see the MCP
> table in [`README.md`](./README.md)).

## Install (5 min)

<!-- npm-trap + #218 recovery: canonical copy lives in README.md ("Install" warning) — sync edits. -->
1. Install gbrain via Bun (the canonical path):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   export PATH="$HOME/.bun/bin:$PATH"
   bun install -g github:garrytan/gbrain
   ```
   If `bun install -g` aborts or `gbrain doctor` reports `schema_version: 0`,
   the CLI prints a recovery hint pointing at [#218](https://github.com/garrytan/gbrain/issues/218).
   Run `gbrain apply-migrations --yes` to recover, or fall back to the
   deterministic install: `git clone https://github.com/garrytan/gbrain.git ~/gbrain && cd ~/gbrain && bun install && bun link`.
2. Init the brain: `gbrain init` (defaults to PGLite, zero-config). For 1000+ files or
   multi-machine sync, init suggests Postgres + pgvector via Supabase.
3. **STOP — ask the user about search mode.** `gbrain init` auto-applied a
   default but printed a 9-cell cost matrix (mode × downstream model)
   preceded by `[AGENT]` markers. You MUST relay the matrix to the operator
   and confirm their choice before continuing. Cost spread between corners
   is 25x — silent acceptance is the wrong default. See
   [`./INSTALL_FOR_AGENTS.md`](./INSTALL_FOR_AGENTS.md) Step 3.5 for the
   exact ask-the-user protocol. Same banner fires on `gbrain post-upgrade`
   for existing users (search modes were added in v0.32.3).
4. Read [`./INSTALL_FOR_AGENTS.md`](./INSTALL_FOR_AGENTS.md) for the full step-by-step
   flow (API keys, identity, cron, verification).

## Common tasks

- **Configure:** [`docs/ENGINES.md`](./docs/ENGINES.md),
  [`docs/guides/live-sync.md`](./docs/guides/live-sync.md),
  [`docs/mcp/DEPLOY.md`](./docs/mcp/DEPLOY.md).
- **Debug:** [`docs/GBRAIN_VERIFY.md`](./docs/GBRAIN_VERIFY.md),
  [`docs/guides/minions-fix.md`](./docs/guides/minions-fix.md), `gbrain doctor --fix`.
- **Migrate / upgrade:** `gbrain upgrade` (binary self-update + schema migrations + post-upgrade prompts),
  [`docs/UPGRADING_DOWNSTREAM_AGENTS.md`](./docs/UPGRADING_DOWNSTREAM_AGENTS.md),
  [`skills/migrations/`](./skills/migrations/), `gbrain apply-migrations --yes` (manual schema-only).
- **Everything else:** [`./llms.txt`](./llms.txt) is the full documentation map.
  [`./llms-full.txt`](./llms-full.txt) is the same map with core docs inlined for
  single-fetch ingestion.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Run the CLI directly (dev mode)
bun run src/cli.ts <command>

# Compile binary
bun build --compile --outfile bin/gbrain src/cli.ts

# Typecheck (no emit)
bun run typecheck
```

## Testing

```bash
# Inner edit loop — parallel 8-shard fan-out, ~85s, 3700+ unit tests, no DB needed
bun run test

# Run a single test file
bun test test/markdown.test.ts

# Run a single test by name
bun test test/markdown.test.ts -t "splitBody"

# Pre-push gate — ~30 static checks + typecheck, fanned out in parallel
bun run verify

# Everything CI runs (verify + unit + slow + smart e2e)
bun run test:full

# Slow tests only (*.slow.test.ts)
bun run test:slow

# Serial-quarantined tests (*.serial.test.ts, one bun process per file)
bun run test:serial

# E2E tests (requires Docker + DATABASE_URL)
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/gbrain_test bun run test:e2e

# Full local CI gate (gitleaks + guards + typecheck + unit + E2E in Docker)
bun run ci:local

# Diff-aware subset (fast iteration on a focused branch)
bun run ci:local:diff
```

### Test file taxonomy

- `*.test.ts` — fast loop (parallel 8-shard fan-out, no DB)
- `*.slow.test.ts` — cold-path correctness, run via `bun run test:slow` only
- `*.serial.test.ts` — quarantined files that use `mock.module()` or touch `process.env`; one bun process per file
- `test/e2e/*.test.ts` — real-Postgres E2E, skipped when `DATABASE_URL` is unset
- `tests/heavy/*.sh` — ops-shape shell scripts, minutes per run, nightly CI only
- `test/fuzz/*.test.ts` — property-based fuzz, fast (~3s), runs in default `bun test`

### Test isolation rules (enforced by CI lint)

Unit test files in the parallel loop share a process per shard. Four rules prevent cross-file contamination:

| Rule | Banned | Fix |
|---|---|---|
| R1 | `process.env.X = ...` | Use `withEnv()` from `test/helpers/with-env.ts`, or rename to `*.serial.test.ts` |
| R2 | `mock.module(...)` | Rename to `*.serial.test.ts` |
| R3 | `new PGLiteEngine(` outside `beforeAll(` | Use the canonical PGLite block (see below) |
| R4 | `new PGLiteEngine(` without `afterAll(disconnect)` | Add `afterAll(() => engine.disconnect())` |

Canonical PGLite test block:
```ts
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { resetPgliteState } from './helpers/reset-pglite.ts';

let engine: PGLiteEngine;
beforeAll(async () => {
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
});
afterAll(async () => { await engine.disconnect(); });
beforeEach(async () => { await resetPgliteState(engine); });
```

### Capturing test output

NEVER pipe test output through `tail`/`head` — the exit code becomes `tail`'s (always 0), hiding failures. Always redirect to a file first:
```bash
bun test > /tmp/test-output.txt 2>&1; echo "EXIT=$?"; tail -50 /tmp/test-output.txt
```

## Architecture

### Contract-first operations (`src/core/operations.ts`)

The single source of truth. ~90 operations define params, handler, scope (`read`|`write`|`admin`), and optional `cliHints`. CLI commands and MCP tools are both **generated** from this file. To add a new operation: add it to `operations.ts` — CLI, MCP, and tools-json pick it up automatically. Parity tests (`test/parity.test.ts`) enforce they stay in sync.

For CLI-only commands (init, upgrade, import, export, embed, doctor, sync, etc.): create `src/commands/mycommand.ts` and add the case to `src/cli.ts`'s `CLI_ONLY` set.

### Two-engine parity (`src/core/postgres-engine.ts` + `src/core/pglite-engine.ts`)

Both implement the `BrainEngine` interface from `src/core/engine.ts`. Every new method/SQL shape must land in **both** engines. Pinned by `test/e2e/engine-parity.test.ts`. Forward-referenced columns/indexes go in the bootstrap probe set, guarded by `test/schema-bootstrap-coverage.test.ts`.

Engine factory (`src/core/engine-factory.ts`) dynamically imports the configured engine. The interface is large (~60 methods covering pages, chunks, search, links, graph, timeline, eval, sources, code edges, etc.).

### Trust boundary (`OperationContext.remote`)

- `remote = false`: trusted local CLI callers (set by `src/cli.ts`)
- `remote = true`: untrusted agent-facing callers (set by `src/mcp/server.ts` and HTTP transport)

Trust is **fail-closed**: anything not strictly `false` is treated as remote/untrusted. Security-sensitive ops tighten behavior when `remote=true`. Don't default it falsy.

### Two organizational axes

- **Brain** = which database. Routing: `--brain`, `GBRAIN_BRAIN_ID`. Default: `host`.
- **Source** = which content repo inside the database. Routing: `--source`, `GBRAIN_SOURCE`. Default: `default`.

Every read-side op routes through `sourceScopeOpts(ctx)`. Slug uniqueness is `(source_id, slug)`, not slug alone. Don't hand-roll source filtering — a missed thread is a cross-source data leak.

### Search pipeline (`src/core/search/`)

Hybrid search combines vector similarity, keyword BM25, source-boost, and relational recall via Reciprocal Rank Fusion (RRF). Three named search modes (`conservative`/`balanced`/`tokenmax`) bundle cost knobs. Mode resolution: `src/core/search/mode.ts`. Cache keys include a `knobs_hash` to prevent cross-mode contamination.

### Migrations (`src/core/migrate.ts`)

Schema DDL lives in the `MIGRATIONS` array. `CREATE INDEX CONCURRENTLY` needs `transaction: false`. PGLite-specific SQL goes in `sqlFor.pglite`. The migration system is append-only — never modify a past migration.

### MCP server (`src/mcp/`)

Generated from operations. `server.ts` sets `remote: true` for all stdio MCP callers. `dispatch.ts` is shared with the HTTP transport. Tool definitions are built by `buildToolDefs()` from the operations array.

### Admin dashboard (`admin/`)

Separate Vite + React SPA. Build with `bun run build:admin`. The output gets embedded into the binary via `scripts/build-admin-embedded.ts`. Dark theme only.

## Critical Invariants (must-never-violate)

- **JSONB: never `JSON.stringify` into a `::jsonb` cast.** postgres.js double-encodes it. Pass raw objects to `engine.executeRaw`, or use `executeRawJsonb`. Guarded by `scripts/check-jsonb-pattern.sh`.
- **One canonical pricing table.** All chat/completion prices live ONCE in `src/core/model-pricing.ts` (`CANONICAL_PRICING`). Every other pricing table is a DERIVED view. Update prices there only.
- **Progress writes to stderr only.** Stdout stays clean for data output (`--json` payloads). `scripts/check-progress-to-stdout.sh` is a CI guard.
- **Privacy: never commit real names** of people, companies, or funds into public artifacts (`CHANGELOG.md`, `README.md`, `docs/`, `skills/`, PR titles, commit messages). Use generic placeholders (`alice-example`, `acme-example`, `fund-a`).
- **Source isolation seal.** Every query path applies source filtering. `test/e2e/source-isolation-pglite.test.ts` pins this at both engine and op-handler layers.

## Skills (`skills/`)

Fat markdown files (tool-agnostic) that teach agents how to perform specific tasks. `skills/RESOLVER.md` is the skill dispatcher/routing table. `skills/conventions/` has cross-cutting rules. Read the relevant skill file before performing brain operations.

## Version Management

Single source of truth: `VERSION` file (4-segment format: `MAJOR.MINOR.PATCH.MICRO`). Must stay in sync with `package.json` and `CHANGELOG.md`. CI version-gate fails if they drift. After editing CLAUDE.md, run `bun run build:llms` — the llms bundle generator inlines/links these docs and a freshness test fails CI otherwise.

## Before Shipping

- `bun run ci:local` — full CI gate in Docker
- `bun run ci:local:diff` — diff-aware subset for fast iteration
- Ship via the `/ship` skill, not by hand
- Read `docs/RELEASING.md` for the full release process

<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
