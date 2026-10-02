# Progress (newest first, keep ≤5 entries)

## 2026-10-02 — 1.7 connectivity CSR + neuron meta
Done: `packages/data/src/graph.ts` (`csrFromEdges`, `encodeGraph`/`decodeGraph`, delta-coded cols), `meta.ts` (`encodeMeta`/`decodeMeta`/`neuronAt`, NTS/SOMA_SIDES enums) + tests; `apps/pipeline/src/fetch/graph.ts` (`allBodyIds`, `regionOf`, `fetchNeuronBatch`, `fetchEdgeBatch`, resumable `fetchBatches`/`loadBatches`), `process/graph.ts` (`ntSign`, `toRecord`, `orderNeurons`, `buildGraph`, `subgraph`) + tests; CLI `pnpm graph`.
State: full graph 176422 neurons / 6.29M edges (w≥5): graph 36.7 MB raw / 12.55 MB br, meta 0.50 MB br; scenario subgraphs escape/sugar/song ≤0.06 MB br each → `data/build/{graph,meta}-{full,escape,sugar,song}.bin`. Cache `data/cache/graph/` (ids.json + 89 meta + 353 edge batches); fetch ~2 min, rebuild from cache ~15 s. Not yet in a manifest (bake 1.8).
Next: 1.7b type-level graph: collapse full CSR by meta.type (summed weights, signed via sign[pre]), codec `typegraph` in packages/data (TDD), add to `pnpm graph`.
Gotchas: DNp01 (GF) sign = 0 (ACh conf 0.53) → needs scenario override in Phase 3. 2086 neurons have no primary-ROI region. Batch cache files are indexed by position in `ids.json`; delete batches if ids.json is regenerated. Full-graph edge count via a single Cypher times out; sample with `bodyId % 97`.

## 2026-10-02 — 1.6 neuropil meshes
Done: `packages/data/src/obj.ts` (`parseObj`), `neuropil.ts` (`encodeNeuropils`/`decodeNeuropils`) + tests; `client.roiMesh`, `apps/pipeline/src/fetch/rois.ts` (`SHELL_ROIS`, `primaryRois`, resumable `fetchRoiMeshes`, shared `fetch/cache.ts`); `process/neuropil.ts` (`weld`, `decimate` via meshoptimizer, `buildNeuropils`) + CLI `pnpm neuropil` → `data/build/neuropil-{shells,regions}.bin`.
State: 144 ROI OBJs cached in `data/cache/rois/`; shells 5 meshes / 69k tris / 0.59 MB (first-frame), regions 139 meshes / 270k tris / 2.33 MB (lazy); build ~9 s cached. Not yet in a manifest (bake 1.8 reuses `buildNeuropils`).
Next: 1.7 connectivity CSR with signed weights + neuron metadata table (scenario subgraphs + full pruned CNS graph), codec in packages/data (TDD).
Gotchas: ROI mesh API `GET /api/roimeshes/mesh/{dataset}/{roi}` returns OBJ in 8 nm voxels (same as SWC); only primary ROIs + `CentralBrain`/`Optic(L|R)`/`CV`/`VNC` have meshes (not `CNS`, `CX`, `MB(L)`…). packages/data has ES2023 lib only — `src/text.d.ts` declares TextEncoder/TextDecoder. node_modules reads are denied; check third-party APIs via typecheck.

## 2026-10-01 — 1.5 background cloud
Done: `packages/data/src/cloud.ts` (`mulberry32`, `sampleCable`, `lodTiers`, `bboxOf`, `encodeCloud`/`decodeCloud`) + tests; `pickRandom`/`randomBodyIds` + `pnpm pull --random=N [--seed]`; `apps/pipeline/src/process/cloud.ts` `buildCloud` + CLI `pnpm cloud` → `data/build/cloud-lod{0,1,2}.bin` (gitignored).
State: 5000 random CNS skeletons cached (cache 8496 bodies, ~636 MB); cloud = 2.16M pts → 200k/600k/1.2M tiers (1.14/3.43/6.87 MB), built in ~12 s. Not yet in a manifest (bake 1.8 reuses `buildCloud`).
Next: 1.6 neuropil meshes: fetch ROI meshes (neuPrint ROI mesh API), decimate, encode (brain + VNC), codec in packages/data (TDD).
Gotchas: SWC coords are 8 nm voxels, not nm (CNS ≈ 91k×65k×126k units); manifest bbox unit still to settle in 1.8. `pnpm cloud` re-queries all :Neuron ids to rebuild the same random sample (same --random/--seed as pull). Reading `data/cache` via shell is denied by permissions; use scripts.

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
