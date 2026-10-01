# Progress (newest first, keep ≤5 entries)

## 2026-10-01 — 1.2 SWC parser + skeleton model
Done: `packages/data/src/swc.ts` (`parseSwc` → `Skeleton {pos, radius, parent, type, soma}`, `childrenOf` CSR, `SwcError`), `swc.test.ts` (15 inline-fixture tests).
State: skeletons in topological order (parent[i] < i), soma = node 0, soma component rerooted; extra fragments kept as roots. No skeleton encoder yet.
Next: 1.3 RDP on unbranched segments (use `childrenOf`), path distance from soma, Uint16 quantization in CNS bbox + skeletons chunk encoder/decoder roundtrip.
Gotchas: tsconfig has noUncheckedIndexedAccess — `arr[i]++` on typed arrays fails typecheck; use the private `csr()` helper in swc.ts or explicit `as number`. Biome flags comma operators.

## 2026-10-01 — 1.1 data manifest + chunk container
Done: `packages/data/src/manifest.ts` (zod Manifest, ChunkEntry, Scenario, `parseManifest` + FormatVersionError), `chunks.ts` (`chunksFor`, `firstFrameBytes`), `container.ts` (`encodeChunk`/`decodeChunk`, FLYD layout); 16 tests. `biome.json` excludes `data/`.
State: format v1 defined; no real chunk producers yet (kinds: skeletons/cloud/neuropil/graph/typegraph/meta). Layout recorded in DECISIONS.md.
Next: 1.2 SWC parser + skeleton model (tree, radii, soma) in packages/data, TDD with tiny fixture SWCs.
Gotchas: never run `pnpm fix` expecting it to touch only your files — it reformatted frozen scout JSONs (now excluded). Container sections are ≤4-byte dtypes only; decoder copies once if input byteOffset is unaligned. test-runner agent hit its 8-turn limit on test+typecheck+lint; ask for one command per call or run filtered output directly.

## 2026-10-01 — 0.5 phase 0 decisions
Done: `docs/DECISIONS.md` +6 lines (edge sign rules, scout edge ≥50, per-circuit extended thresholds, escape/sugar/song stimulus + readout + overrides); PLAN 0.5 ticked → Phase 0 closed. Removed stray `apps/pipeline/MN`.
State: scenario manifests `data/scout/*.json` committed and frozen as Phase 1 input.
Next: 1.1 `packages/data` zod manifest schema + chunk index + versioning, TDD.
Gotchas: sugar sign ambiguity is deliberately deferred to a Phase 3 test (BM_Taste → MN9 spikes); CSR prune threshold still open (decide in 1.7).

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
