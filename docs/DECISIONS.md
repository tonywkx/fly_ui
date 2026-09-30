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
