# Progress (newest first, keep ≤5 entries)

## 2026-10-01 — 0.2 neuPrint client
Done: `apps/pipeline/src/neuprint/` — `cypher` tagged template (safe literals, `raw` identifiers), `createClient` (retry 429/5xx/timeout, p-limit, token redacted), `kStrongestPaths` (best-first, Σ1/weight), tools `findNeurons`/`getPartners`/`strongestPaths` (bidirectional type-graph expansion), CLI `query.ts` (`--schema`, `--tool=`, compact table). 27 tests.
State: all mocked; never run against live neuPrint — `.env` absent.
Next: user adds NEUPRINT_TOKEN → `pnpm scout` (dataset check) → `query.ts --schema` → 0.3 escape scouting via neuprint-scout agent. If response shapes differ from mocks, fix client first.
Gotchas: files written via Bash skip the format hook — run `pnpm fix` before commit; `cmd | tail && git commit` hides failures.

## 2026-09-30 — 0.1 project bootstrap
Done: monorepo skeleton (apps/pipeline, apps/web, packages/data, packages/sim), CLAUDE.md, PRODUCT.md, docs/, .claude (4 agents, /next, /handoff, path rules, biome format hook), UI skills installed.
State: packages are stubs with one smoke test each; web shows a black page; `pnpm snap` works on it.
Next: 0.2 neuPrint client — needs NEUPRINT_TOKEN in `.env` (copy .env.example).
Gotchas: pnpm not on PATH until `sudo corepack enable pnpm`; use `corepack pnpm`.
