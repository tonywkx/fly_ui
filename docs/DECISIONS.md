# Decisions (settled — don't re-litigate without new facts)

- 2026-09-30 TypeScript only; pnpm workspaces; Biome for lint+format (no ESLint/Prettier).
- 2026-09-30 Dataset `male-cns:v1.0` (brain+VNC in one volume; male-specific neurons for song). CC-BY attribution.
- 2026-09-30 LIF baseline = Shiu et al. 2024 params (see PLAN.md §Reference data); Glu treated inhibitory.
- 2026-09-30 UI motion = motion/react; camera = GSAP; no Anime.js. shadcn/ui base so Kokonut/Bklit registries drop in.
- 2026-09-30 Realtime plots = uPlot + custom canvas raster (Bklit/visx too slow for 60 fps streams).
- 2026-09-30 Fonts: Inter Variable + Geist Mono (PP Neue Montreal is commercial).
- 2026-09-30 Docs/config for Claude written in English (token economy); chat with user in Russian.
- 2026-09-30 No DuckDB-WASM / react-three-fiber (early chat idea): own binary format + vanilla three.js (frame loop outside React). Type-level graph replaces DuckDB queries.
- 2026-09-30 Same TS engine for baked scenarios and live sandbox; Brian2 not used (validate against published results).
- 2026-10-01 Scenario neuron sets: core (anchor types) + extended (types with summed weight ≥500 to key hubs), target 200–2000 neurons; gap-junction links (absent from connectome) go into `overrides` as electrical.
- 2026-10-01 Edge sign from predicted NT: ACh +, GABA/Glu −; NT conf <0.6 or unclear → 0; motor-neuron presynaptic sign → 0. Unclear signs are resolved only by explicit `overrides` in the scenario JSON.
- 2026-10-01 Scout manifests keep type-level edges with weight ≥50 (CSR prune threshold is decided in 1.7, not here).
- 2026-10-01 Extended-set thresholds differ per circuit on purpose (density differs): escape ≥500 → 1254 neurons; sugar ≥200, types ≤100 neurons only (BM_InOm excluded) → 945; song ≥1200 → 1703.
- 2026-10-01 Escape: GF = DNp01. Overrides DNp01→TTMn and DNp01→PSI electrical; DNp01→GFC2 optional sim boost.
- 2026-10-01 Sugar: stimulus = all 40 BM_Taste (sugar-GRN proxy; male-cns has no Gr5a/Gr64f types); PER readout = MN9. Sign ambiguity (GABAergic GRN→MN9 routes) is deferred: Phase 3 test "BM_Taste stimulus → MN9 spikes" (anchor Shiu 2024); if it fails, add an override or fall back to stimulating DNge062.
- 2026-10-01 Song: P1 = pC1_* family (9 core types). Readout pIP10 → vPR9/vMS11/TN1a → wing MNs + DLMn/DVMn. maleSpecific flag from fruDsx (≠ fru_low).
- 2026-10-01 Data format: one `manifest.json` (zod, `formatVersion` must match exactly, else FormatVersionError → re-bake) + binary chunks `FLYD` container (16 B header, 12 B/section table, LE, 4-byte aligned sections; dtypes ≤4 B only, no Float64). Chunk tier `first-frame | lazy` drives the 15 MB budget.
- 2026-10-01 Skeleton model: soma = largest-radius node with SWC type=1, else largest radius overall; soma component rerooted at soma and BFS-renumbered (soma = 0, parent[i] < i); disconnected fragments kept as extra roots, not dropped.
