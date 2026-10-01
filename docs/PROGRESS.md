# Progress (newest first, keep ≤5 entries)

## 2026-10-01 — 0.4 sugar + song scouting
Done: `data/scout/sugar.{json,md}` (277 types / 945 neurons, core 85) and `data/scout/song.{json,md}` (234 types / 1703, core 158), same shape as escape.json. Song types add `maleSpecific` + `fruDsx`.
State: sugar path: BM_Taste (40, GRN proxy) → GNG015/GNG095 (GABA), GNG568 → DNge051, DNge055 → MN9/MN6/MN8/MN11/MN12D. Song path: pC1_* (P1) → pMP2/pIP10 → dPR1, TN1a_*, vPR9 → vMS11 → wing MNs (hg1, ps1, …) + DLMn/DVMn.
Next: 0.5 record per-scenario choices in DECISIONS.md (sizes, thresholds, sign rules, sugar input ambiguity) and close Phase 0.
Gotchas: male-cns has no Gr5a/Gr64f/Fdg/IN1/Rph types; BM_Taste is untyped by modality (flywireType = BM_Taste too), so it is unclear which cells are sugar. The strongest GRN→MN9 routes are GABAergic, so the net sign is ambiguous. The excitatory MN9 drivers DNge062/DNge080 are not reachable from BM_Taste at weight ≥50, so Phase 3 likely needs an override or a stimulus on DNge062. "P1" = pC1_* family (52 types; 9 in core). Direct P1→pIP10 is weak and goes mainly via pMP2. Wing MN NT is noisy, so MN edge sign is 0. Thresholds: sugar ≥200 summed weight (types ≤100 neurons, BM_InOm 745 excluded); song ≥1200.

## 2026-10-01 — 0.3 escape scouting
Done: `data/scout/escape.{json,md}` — 111 types / 1254 neurons (core 627: LC4/LPLC2/LPLC1/LC6 → DNp01 + DNp02/04/06/11 → GFC1-4/PSI → TTMn/DLMn; extended +627 by summed weight ≥500 to GF/GFC/PSI/TTMn/DLMn). JSON: types[{type,role,tier,count,nt,ntConf,superclass,somaSide,bodyIds}], edges (type-level, weight≥50, sign), paths, overrides, sizeEstimate, openQuestions.
State: bodyIds unique, counts verified. Overrides: DNp01→TTMn, DNp01→PSI (electrical), DNp01→GFC2 (uncertain).
Next: 0.4 sugar + song scouting, same JSON shape (reuse escape.json as template in the agent prompt).
Gotchas: `strongestPaths` misses GF route (chemical GF→TTMn only 90) → direct paths added by hand; Phase 3 needs override edges. Low NT confidence for DNp01 (0.53), TTMn/DLMn/PSI unclear → sign 0 in edges. Ambiguous "Tergotr. MN" (12) vs TTMn (2); DLMn types are "DLMn a, b"/"DLMn c-f". LC types have flywireType, no mancType.

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
