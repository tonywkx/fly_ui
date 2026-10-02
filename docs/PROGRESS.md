# Progress (newest first, keep ≤5 entries)

## 2026-10-02 — 1.8 bake orchestrator
Done: `packages/data`: manifest v2 (`unitNm`), `pruneTypeGraph`, `bboxUnion` + tests; `apps/pipeline/src/process/{skeletons,bake}.ts` (`buildSkeletons`, `buildManifest`, `checkBudget`) + tests; `fetch/graph.ts` `loadGraphCache` (shared with `pnpm graph`); CLI `src/bake.ts`.
State: `pnpm bake` (~70 s, no token) → `apps/web/public/data/` 17 chunks + `manifest.json`; first-frame 11.20 MB raw / 7.19 MB br (escape skeletons 8.88 MB of it), lazy 80.8 MB raw / 39.3 MB br. All chunks decode via the manifest bbox. Phase 1 done.
Next: 2.1 web shell (Vite/React/MobX/Tailwind v4/shadcn, theme tokens, `?debug=`/`?stats=`, `window.__snapReady`).
Gotchas: skeleton chunk order is scout bodyId order, meta/graph order is (type, bodyId) — join by bodyId on the client. Skeleton bytes ≈ 11.5 B/node (pos 6 + radius 2 + parent 4); implicit parent (i−1) would cut ~30% if budget gets tight. Radius is u16 whole source units (8 nm steps). Default scenario = `--default` (escape), first in `manifest.scenarios`.

## 2026-10-02 — 1.7b cell-type graph
Done: `packages/data/src/typegraph.ts` (`collapseByType`, `encodeTypeGraph`/`decodeTypeGraph`; node k = `meta.strings.types[k]`, weight u32 + signed i32 Σ sign[pre]·w, count per type, untyped skipped, self-loops kept) + tests; `pnpm graph` also writes `data/build/typegraph-full.bin`.
State: 11751 types / 934k edges, unpruned: 10.89 MB raw / 2.43 MB br. Not yet in a manifest.
Next: 1.8 `pnpm bake` orchestrator + manifest + size report (first-frame ≤15 MB); decide typegraph tier/prune there.
Gotchas: type-edge prune tradeoff (edges / br / synapse mass): w≥10 633k/1.65 MB/98% · w≥20 443k/1.24 MB/95% · w≥50 241k/0.76 MB/88% · w≥100 132k/0.48 MB/79%. Prune after `collapseByType` (filter rows), codec is threshold-agnostic.

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
