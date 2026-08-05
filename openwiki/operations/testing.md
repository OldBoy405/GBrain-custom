---
type: Operations
title: GBrain Testing and Operations
description: Test taxonomy and isolation rules, the doctor health check system, CI pipeline, static checks, and operational runbook for GBrain development and deployment.
tags: [testing, operations, ci, doctor, runbook]
---

GBrain aims to be "the most well-tested, widest-coverage retrieval and agent memory system." The testing strategy spans six tiers, guarded by strict isolation rules and dozens of static checks. This page covers how to test, verify, and operate the brain. All components are verified against the [architecture](/openwiki/architecture/overview.md) described elsewhere; the [dream cycle](/openwiki/workflows/dream-cycle.md) has its own operational considerations.

## Test taxonomy

| Tier | File pattern | Runtime | What it tests |
|------|-------------|---------|---------------|
| **Unit** | `*.test.ts` | ~85s parallel 8-shard | Pure logic, no DB, no network. ~3700+ tests. |
| **Slow** | `*.slow.test.ts` | `bun run test:slow` | Cold-path correctness, LLM integration, expensive computations. |
| **Serial** | `*.serial.test.ts` | One bun process per file | Tests that use `mock.module()` or mutate `process.env`. Cannot share a process. |
| **E2E** | `test/e2e/*.test.ts` | Docker + DATABASE_URL | Real Postgres integration tests. Auto-skipped when `DATABASE_URL` is unset. |
| **Heavy** | `tests/heavy/*.sh` | Nightly CI only | Ops-shape shell scripts, minutes per run. |
| **Fuzz** | `test/fuzz/*.test.ts` | ~3s, default `bun test` | Property-based fuzz testing. |

### Test isolation rules

Unit test files in the parallel loop share a process per shard. Four rules prevent cross-file contamination (enforced by CI lint):

| Rule | Banned | Fix |
|------|--------|-----|
| **R1** | `process.env.X = ...` | Use `withEnv()` from `test/helpers/with-env.ts`, or rename to `*.serial.test.ts` |
| **R2** | `mock.module(...)` | Rename to `*.serial.test.ts` |
| **R3** | `new PGLiteEngine(` outside `beforeAll(` | Use the canonical PGLite block |
| **R4** | `new PGLiteEngine(` without `afterAll(disconnect)` | Add `afterAll(() => engine.disconnect())` |

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

### Engine parity

`test/e2e/engine-parity.test.ts` compares Postgres vs. PGLite behavior on identical datasets. Any new method or SQL shape must pass parity — this is the real backstop for JSONB encoding bugs (which PGLite silently hides).

### E2E test isolation

E2E execution is single-file serial with `pg_terminate_backend` cleanup between files to guarantee cross-file state isolation. The `describeE2E` wrapper auto-skips when no `DATABASE_URL` or `.env.testing` is configured.

## Development commands

```bash
bun run test                          # Inner edit loop: parallel 8-shard, ~85s
bun test test/markdown.test.ts        # Run a single test file
bun test test/markdown.test.ts -t "splitBody"  # Run a single test by name
bun run verify                        # Pre-push gate: ~30 static checks + typecheck
bun run test:full                     # Everything CI runs (verify + unit + slow + e2e)
bun run test:slow                     # Slow tests only
bun run test:serial                   # Serial-quarantined tests
bun run test:e2e                      # E2E tests (requires Docker + DATABASE_URL)
bun run ci:local                      # Full local CI gate
bun run ci:local:diff                 # Diff-aware subset for fast iteration
bun run typecheck                     # tsc --noEmit
```

### Test output capture

Never pipe test output through `tail`/`head` — the exit code becomes `tail`'s (always 0), hiding failures. Always redirect to a file first:
```bash
bun test > /tmp/test-output.txt 2>&1; echo "EXIT=$?"; tail -50 /tmp/test-output.txt
```

## Doctor — health checks

[`src/commands/doctor.ts`](/src/commands/doctor.ts) is the comprehensive health check system. It runs dozens of checks categorized by [`src/core/doctor-categories.ts`](/src/core/doctor-categories.ts):

```bash
gbrain doctor                   # Full health report
gbrain doctor --json            # Machine-readable
gbrain doctor --remote          # HTTP MCP thin-client path
```

Key checks include:
- **Schema version** — is the DB at the latest migration?
- **Engine connectivity** — can the engine execute queries?
- **Retrieval reflex health** — is the reflex heartbeat alive?
- **Graph signals coverage** — what percentage of pages have inbound links?
- **Sync failure ledger** — are there open/blocking sync failures?
- **Hidden by search policy** — how many pages are withheld by hard-exclude prefixes?
- **Stale embeddings** — how many pages need re-embedding?
- **Federation health** — are mounted team brains reachable?
- **Idle blockers** — are there pending migrations or schema changes?

## Static checks

Dozens of `scripts/check-*.sh` scripts enforce architectural invariants:

| Check | What it enforces |
|-------|-----------------|
| `check-jsonb-pattern.sh` | No `JSON.stringify` into `::jsonb` |
| `check-test-isolation.sh` | R1-R4 test isolation rules |
| `check-privacy.sh` | No PII in codebase |
| `check-gateway-routed-no-direct-anthropic.sh` | All Anthropic calls route through the AI gateway |
| `check-worker-pool-atomicity.sh` | Worker pool correctness |
| `check-source-id-projection.sh` | Every projection feeding `rowToPage` includes `source_id` |
| `check-key-files-current-state.sh` | KEY_FILES.md entries describe current behavior, not release history |
| `check-wasm-embedded.sh` | Tree-sitter WASMs are embedded in compiled binary |
| `check-exports-count.sh` | Export count stability |
| `check-admin-build.sh` | Admin SPA build is up to date |

Run all checks: `bun run check:all`

## CI pipeline

### GitHub Actions

| Workflow | Purpose |
|----------|---------|
| **test.yml** | Core pipeline: content-hash caching, parallel matrix (10 shards), serial tests, static checks |
| **e2e.yml** | Tier 1 (mechanical) + Tier 2 (LLM skills) E2E; requires PostgreSQL service container + API keys |
| **heavy-tests.yml** | High-resource perf/stress tests; triggered by label or `workflow_dispatch` |
| **release.yml** | Watches version tags; parallel builds for macOS ARM64 + Linux x64 to GitHub Release |

All workflows use `concurrency` groups to cancel stale runs on the same branch. `actions/cache` with `bun.lock` hash for dependency caching.

### Test sharding

`scripts/sharding.ts` implements **LPT (Longest Processing Time first)** greedy bin-packing. Deterministic — same input produces identical shards across environments for cacheability. E2E selection uses Git diff analysis plus `e2e-test-map.ts` for precise test selection.

## Operational runbook

### Upgrading

```bash
gbrain upgrade                  # Schema evolution + chunker version bump
```

Upgrade prompts for re-embedding cost when the chunker version changes. `GBRAIN_NO_REEMBED=1` skips with a doctor-warning marker.

### Reindexing

```bash
gbrain reindex --markdown       # Re-chunk and re-embed markdown pages (chunker version bump)
gbrain reindex --code           # Re-chunk and re-embed code files
gbrain reindex --aliases        # Backfill page aliases from frontmatter
gbrain reindex-search-vector    # Change FTS language on an existing brain
```

### Engine migration

```bash
gbrain migrate --to supabase    # PGLite to Postgres
gbrain migrate --to pglite      # Postgres to PGLite
```

Bidirectional. Copies the source catalog FIRST so every page write has a valid FK parent. Resume manifest is target-aware (hashed engine and locator) so a different target starts fresh.

### Repairs

```bash
gbrain sync --skip-failed       # Acknowledge sync failures, advance bookmark
gbrain sync --all               # Force full re-sync
gbrain doctor                   # Identify issues
gbrain embed --stale            # Re-embed pages with stale vectors
gbrain schema verify            # Verify schema pack integrity
```

### Building

```bash
bun build --compile --outfile bin/gbrain src/cli.ts   # Compile standalone binary
bun run build:all                                      # Cross-compile macOS + Linux
bun run build:admin                                    # Build admin SPA + embed
```

## Related pages

- [Architecture Overview](/openwiki/architecture/overview.md) — the architecture verified by these tests
- [Dream Cycle](/openwiki/workflows/dream-cycle.md) — dream cycle operations and monitoring
- [Ingest Pipeline](/openwiki/workflows/ingest-pipeline.md) — sync and import operations
