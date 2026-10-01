# Progress (newest first, keep ≤5 entries)

## 2026-10-01 — 0.2 neuPrint client
Done: `apps/pipeline/src/neuprint/` — `cypher` tagged template (safe literals, `raw` identifiers), `createClient` (retry 429/5xx/timeout, p-limit, token redacted), `kStrongestPaths` (best-first, Σ1/weight), tools `findNeurons`/`getPartners`/`strongestPaths` (bidirectional type-graph expansion), CLI `query.ts` (`--schema`, `--tool=`, compact table). 27 tests.
State: verified live — `pnpm scout` OK (male-cns:v1.0); findNeurons/getPartners on DNp01 return GF_L/GF_R (ACh, descending) → TTMn, GFC2, DNp11.
Next: 0.3 escape scouting via neuprint-scout agent. Useful Neuron fields: type, instance, consensusNt/predictedNt(+Confidence), superclass/class/subclass, somaSide, somaLocation, fruDsx (male-specific?), flywireType, mancType, roiInfo.
Gotchas: GF→TTMn is largely electrical (gap junctions absent from connectome: weight only 90) — Phase 3 may need an explicit electrical-coupling override. Files written via Bash skip the format hook — run `pnpm fix` before commit; `cmd | tail && git commit` hides failures.

## 2026-09-30 — 0.1 project bootstrap
Done: monorepo skeleton (apps/pipeline, apps/web, packages/data, packages/sim), CLAUDE.md, PRODUCT.md, docs/, .claude (4 agents, /next, /handoff, path rules, biome format hook), UI skills installed.
State: packages are stubs with one smoke test each; web shows a black page; `pnpm snap` works on it.
Next: 0.2 neuPrint client — needs NEUPRINT_TOKEN in `.env` (copy .env.example).
Gotchas: pnpm not on PATH until `sudo corepack enable pnpm`; use `corepack pnpm`.
