# Development plan

Each `- [ ]` ≈ one Claude Code session (start `/next`, end `/handoff` + `/clear`).
Tags: **[T]** test-first (Vitest) · **[V]** verify with `visual-qa` · **[UI]** run `ui-critic` · **[S]** use skill.
Phase exit = its "Done when" is true and demoable.

## Reference data (verified 2026-09-30)
- Dataset: neuPrint `male-cns:v1.0` (Janelia MaleCNS, whole brain + VNC, male; CC-BY — attribution required in app + README).
- Bulk Feather: `https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/`
  `body-annotations-…-minconf-0.5.feather` 13 MB · `body-neurotransmitters-…feather` 42 MB · `connectome-weights-…-minconf-0.5.feather` 1.1 GB (needed for the full sandbox graph: stream with polars `scanIpc` + weight filter). Never download `syn-points` (12.7 GB) / `syn-partners`.
- Skeletons SWC (8 nm units): `gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/` (also JRC2018 unisex template variant in µm).
- Neuropil ROIs: `gs://flyem-male-cns/rois/fullbrain-roi-v4`, `…/malecns-vnc-neuropil-roi-v0`; or neuPrint ROI mesh API (see neuprint-python `fetch_roi_mesh`).
- neuPrint API: `POST /api/custom/custom {cypher, dataset}`, Bearer token (neuprint-python `Client.fetch_custom`).
- LIF baseline — Shiu et al. 2024 (`philshiu/Drosophila_brain_model`, MIT): v_0=v_rst=−52 mV, v_th=−45 mV, τ_m=20 ms, τ_syn=5 ms, t_ref=2.2 ms, delay=1.8 ms, w_syn=0.275 mV × synapse count × sign, Poisson stim 150 Hz × f_poi=250. Sign: ACh +1, GABA −1, Glu −1.
  `dv/dt=(v_0−v+g)/τ_m`, `dg/dt=−g/τ_syn`.
- Known circuit anchors: escape = LC4/LPLC2 → Giant Fiber (DNp01) → TTMn / PSI; sugar = sugar GRNs (Gr5a/Gr64f) → … → MN9 (proboscis); song = P1 → pIP10 → VNC song circuit (dPR1, vPR6…) → wing motor neurons.

## Phase 0 — Setup & scouting (2–3 evenings)
- [x] 0.1 Monorepo skeleton, CLAUDE.md, PRODUCT.md, .claude (agents, skills, rules, hook), docs.
- [x] 0.2 neuPrint client in `apps/pipeline/src/neuprint/` (fetch + token from .env, typed Cypher helper, retry, p-limit) + `query.ts` CLI. Expose tool-shaped functions (findNeurons, getPartners, strongestPaths) so a future MCP server is a thin wrapper. **[T]** response parsing.
- [x] 0.3 Scout escape circuit with `neuprint-scout` → `data/scout/escape.{json,md}`: types, bodyIds, roles (sensor/inter/descending/motor), key edges.
- [x] 0.4 Scout sugar + song circuits (same format). Sizes: escape 1254, sugar 945, song 1703 neurons (core+extended).
- [x] 0.5 Commit the scenario manifests (small JSON, OK to commit); record choices in DECISIONS.md.
**Done when:** three scenario JSONs + readable summaries exist, paths agree with literature anchors.

## Phase 1 — Data pipeline (≈1 week)
- [x] 1.1 `packages/data`: zod manifest schema, chunk index, versioning. **[T]**
- [x] 1.2 SWC parser + skeleton model (tree, radii, soma). **[T]** with tiny fixture SWCs.
- [x] 1.3 Skeleton processing: simplify (RDP on tree segments), path distance from soma, Uint16 quantization in CNS bbox; encoder/decoder roundtrip. **[T]**
- [x] 1.4 Fetch skeletons for scenario lists (p-limit, disk cache in `data/cache/`, resumable).
- [x] 1.5 Background cloud: sample points from all/most skeletons (or synapse centroids) → quantized point buffer, LOD tiers.
- [x] 1.6 Neuropil meshes: fetch, decimate, encode (brain + VNC).
- [x] 1.7 Connectivity CSR with signed weights (transmitter predictions), prune weak edges (threshold in DECISIONS.md), neuron metadata table (type, class, NT, region, male-specific flag). Two tiers: scenario subgraphs (first frame) and full pruned CNS graph (~10–20 MB compressed, lazy — loaded only when the sandbox opens). **[T]**
- [x] 1.7b Cell-type-level graph (neurons collapsed by type, summed signed weights) — small, powers the path tracer, ⌘K and inspector. **[T]**
- [x] 1.8 `pnpm bake` orchestrator + size report (fails if first-frame bundle > 15 MB).
**Done when:** `pnpm bake` produces `apps/web/public/data/` within budget; all decoders tested.

## Phase 2 — Scene core (1–2 weeks) → first "wow", record a clip
- [x] 2.1 Web shell: Vite/React/MobX/Tailwind v4/shadcn, theme tokens from DESIGN.md/PRODUCT.md, `?debug=`/`?stats=` plumbing, `window.__snapReady` for snap. **[S]** impeccable
- [x] 2.2 WebGPURenderer + WebGL2 fallback, camera controls, data loader (streamed, Worker decode).
- [x] 2.3 Background cloud + neuropil shells render. **[V]**
- [x] 2.4 Hero neurons as instanced quads/ribbons (thick glowing lines; WebGPU lines are 1 px). **[V]**
- [x] 2.5 Wave shader along neurites (distance-from-soma attribute) + bloom; fake activity = BFS over CSR with per-hop delay. **[V]**
- [x] 2.6 Debug modes: soma-distance, id, transmitter, region. **[V]**
- [x] 2.7 Intro assembly: particles fly into CNS silhouette while data loads → camera dive → "click the shadow" hint. **[V]** **[S]** animate
- [x] 2.8 Quality presets (low/med/high), perf pass.
**Done when:** stable 60 fps at high, wave looks right in snaps.

## Phase 3 — Simulation engine (1–2 weeks)
- [x] 3.1 `packages/sim` LIF neuron + event queue with delays; toy nets: 3-chain, inhibition, threshold. **[T]**
- [x] 3.2 Poisson stimulus, silencing, seeded RNG, determinism test. **[T]**
- [ ] 3.3 Full-graph run in Node: bake scenarios → spike trains (compact binary via packages/data). **[T]** format
- [ ] 3.4 Worker live mode via comlink, ring buffer to scene (SharedArrayBuffer if COOP/COEP possible on Pages, else transfer).
- [ ] 3.5 Tweakpane param panel (thresholds, weights, gain), dev-only.
- [ ] 3.6 Biology checks as tests: shadow → Giant Fiber fires; sugar → MN9; song → pIP10 / wing MNs; silencing GF kills TTMn. Activity neither dies instantly nor explodes. **[T]**
- [ ] 3.7 Exploratory: with GF silenced, does the model find the slower non-GF takeoff route (other descending neurons)? Document result, no hard assert.
**Done when:** scenarios plausible, bio tests green.
**Risk:** parameter tuning (dies out vs. seizure-like explosion) is the least predictable part of the project — budget +1 week here. Validate against published Shiu et al. results, not by running Brian2.

## Phase 4 — Interaction layer (≈2 weeks)
- [ ] 4.1 GPU picking (id buffer), hover highlight whole neuron + tooltip. **[V]**
- [ ] 4.2 Inspector (type, NT, inputs/outputs, fly-to / stimulate / silence); focus dimming, inputs vs outputs colors. **[UI]**
- [ ] 4.3 Tools + hotkeys: Stimulate (click/brush), Silence, Electrode (≤4 probes); sliders for stimulus strength/frequency. **[UI]**
- [ ] 4.3b Signal tracer "eye to leg": pick input type + output type → strongest paths (type graph, k-best by summed weight) → highlighted hop by hop in 3D. **[T]** path search **[V]**
- [ ] 4.4 Timeline: canvas raster by region, scrub/pause/slow-mo. **[V]** **[UI]**
- [ ] 4.5 Oscilloscopes (uPlot) for electrodes. Bklit UI only for non-realtime stats (firing-rate bars etc.).
- [ ] 4.6 ⌘K (cmdk) cell-type search, color modes (region/NT/class/male-specific) with legend. **[UI]**
- [ ] 4.7 Experiment URL encoding (stimuli + silenced ids, compact base64url) + "Share experiment". **[T]**
- [ ] 4.8 Motion pass over the whole HUD. **[S]** find-animation-opportunities → animate → review-animations
**Done when:** silence the Giant Fiber, replay shadow, fly doesn't jump, share the link.

## Phase 5 — Cinematics (1–2 weeks)
- [ ] 5.1 Director camera following the activity front (GSAP timelines). **[V]**
- [ ] 5.2 Fly body: jump / proboscis / wing vibration (flybody mesh — check license — or stylized own). **[V]**
- [ ] 5.3 Sound (Tone.js): spikes as clicks, courtship song synthesis, mute by default.
- [ ] 5.4 Scenario captions ("signal descends into the thorax…") synced to the timeline. **[UI]**

## Phase 6 — Polish & release (≈1 week)
- [ ] 6.1 Profiling, WebGL2 fallback check, mobile viewer mode.
- [ ] 6.2 Playwright smoke tests; GitHub Actions → Pages (optional RU mirror).
- [ ] 6.3 `impeccable` audit + polish of every screen. **[S]** **[UI]**
- [ ] 6.4 README (with CC-BY attribution), 30–60 s video, article.

## Backlog / spin-offs (not scheduled)
- Dust close-up: sprites are sized in µm, so at deep zoom they become big discs that clutter the view (seen in a live recording). Clamp on-screen size and fade dust near the camera.
- Cheap dense dust: lod1/lod2 (+900k sprites) halve fps on M4 whatever the pixel ratio (primitive-bound instanced quads). Try one triangle per sprite, native 1 px points, or a baked density volume; then raise `QUALITY.high.dustTiers` (`apps/web/src/scene/quality.ts`).
- neuPrint MCP server (find_neurons, get_partners, shortest_path, neuroglancer_link) + eval set — reuse `apps/pipeline/src/neuprint` client; strong AI-portfolio piece. Check GitHub for an existing one first.
- Neuron-as-art: skeleton projection → SVG poster/tattoo/print styles (CC-BY allows commercial use with attribution; hook: male-only neurons).
- Scrollytelling "How a male fly sings": P1 → pIP10 → VNC rhythm generators, 3D scenes + Web Audio song. Reuses scene + song synth from Phase 5.

## Library decisions (see DECISIONS.md)
Motion (motion/react) = UI · GSAP = camera/cinematics · Anime.js not used (overlaps GSAP) · Kokonut UI = copy-in components via shadcn registry when they fit the instrument look · Bklit UI = non-realtime charts only; realtime = uPlot + custom canvas.
