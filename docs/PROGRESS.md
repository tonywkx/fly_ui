# Progress (newest first, keep ≤5 entries)

## 2026-10-01 — 1.4 skeleton fetch
Done: `client.skeleton(bodyId)` in `apps/pipeline/src/neuprint/client.ts` (null on not-found), `apps/pipeline/src/fetch/skeletons.ts` (`scoutBodyIds`, resumable `fetchSkeletons`) + tests, CLI `apps/pipeline/src/fetch.ts` → `pnpm pull [--scenario=x]`.
State: all 3605 scenario bodies cached in `data/cache/skeletons/*.swc` (~400 MB raw, 0 missing, 0 failed); rerun is a no-op. Not yet simplified/encoded into chunks.
Next: 1.5 background cloud: sample points from cached skeletons (or synapse centroids) → quantized point buffer with LOD tiers, codec in packages/data (TDD).
Gotchas: `pnpm fetch` is a pnpm builtin, hence `pull`. Dataset in the skeleton URL must not be url-encoded (403). Missing bodies get a `{id}.missing` marker; delete it to retry. `clientFromEnv` now takes `Partial<ClientOptions>` overrides.

## 2026-10-01 — 1.3 skeleton processing + chunk codec
Done: `packages/data/src/skeleton.ts` (`simplify` RDP on unbranched runs, `pathDistance`, `quantize`/`dequantize`, `encodeSkeletons`/`decodeSkeletons` → flat `SkeletonSet`), `skeleton.test.ts` (14 tests). Chunk layout in DECISIONS.md.
State: SWC → simplify → multi-neuron `skeletons` chunk → decode works in tests; no real data run yet, epsilon not tuned.
Next: 1.4 fetch skeletons for scenario bodyIds (`data/scout/*.json`) with p-limit, disk cache `data/cache/`, resumable.
Gotchas: `dist` is recomputed from quantized positions on decode (≈0.1 nm off). parent stays i32 (4 B/node); if the first-frame budget is tight, switch to a u16 delta. Biome `useIterableCallbackReturn` rejects `forEach(x => expect(...))`, so use block bodies.

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
