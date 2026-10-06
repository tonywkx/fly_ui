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
- [x] 3.3 Full-graph run in Node: bake scenarios → spike trains (compact binary via packages/data). **[T]** format
- [x] 3.4 Worker live mode via comlink, ring buffer to scene (SharedArrayBuffer if COOP/COEP possible on Pages, else transfer).
- [x] 3.5 Tweakpane param panel (thresholds, weights, gain), dev-only.
- [x] 3.6 Biology checks as tests: shadow → Giant Fiber fires; sugar → MN9; song → pIP10 / wing MNs; silencing GF kills TTMn. Activity neither dies instantly nor explodes. **[T]**
- [x] 3.7 Exploratory: with GF silenced, does the model find the slower non-GF takeoff route (other descending neurons)? Document result, no hard assert.
**Done when:** scenarios plausible, bio tests green.
**Risk:** parameter tuning (dies out vs. seizure-like explosion) is the least predictable part of the project — budget +1 week here. Validate against published Shiu et al. results, not by running Brian2.

## Phase 4 — Interaction layer (≈2 weeks)
- [x] 4.1 GPU picking (id buffer), hover highlight whole neuron + tooltip. **[V]**
- [x] 4.2 Inspector (type, NT, inputs/outputs, fly-to / stimulate / silence); focus dimming, inputs vs outputs colors. **[UI]**
- [x] 4.3 Tools + hotkeys: Stimulate (click/brush), Silence, Electrode (≤4 probes); sliders for stimulus strength/frequency. **[UI]**
- [x] 4.3b Signal tracer "eye to leg": pick input type + output type → strongest paths (type graph, k-best by input-fraction product, see DECISIONS) → highlighted hop by hop in 3D. **[T]** path search **[V]**
- [x] 4.4 Timeline: canvas raster by region, scrub/pause/slow-mo. **[V]** **[UI]**
- [x] 4.5 Oscilloscopes (uPlot) for electrodes. Bklit UI only for non-realtime stats (firing-rate bars etc.).
- [x] 4.6 ⌘K (cmdk) cell-type search, color modes (region/NT/class/male-specific) with legend. **[UI]**
- [x] 4.7 Experiment URL encoding (stimuli + silenced ids, compact base64url) + "Share experiment". **[T]**
- [x] 4.8 Motion pass over the whole HUD. **[S]** find-animation-opportunities → animate → review-animations
**Done when:** silence the Giant Fiber, replay shadow, fly doesn't jump, share the link.

## Phase 5 — Cinematics (1–2 weeks)
- [x] 5.1 Director camera following the activity front (GSAP timelines). **[V]**
- [x] 5.2 Fly body: jump / proboscis / wing vibration (flybody mesh — check license — or stylized own). **[V]**
- [x] 5.3 Sound (Tone.js): spikes as clicks, courtship song synthesis, mute by default.
- [x] 5.4 Scenario captions ("signal descends into the thorax…") synced to the timeline. **[UI]**

## Phase 6 — Polish & release (≈1 week)
- [x] 6.1 Profiling, WebGL2 fallback check, mobile viewer mode.
- [x] 6.2 Playwright smoke tests; GitHub Actions → Pages (optional RU mirror).
- [x] 6.3 `impeccable` audit + polish of every screen. **[S]** **[UI]**
- [x] 6.4 README (with CC-BY attribution), 30–60 s video, article.

## Phase 7 — Intro, onboarding, Russian UI (≈1–2 weeks)
Goal: a non-scientist understands in ~60 s what they see and how to use it, via one real action and one "break it". UI fully in Russian (default) with a complete English switch. "Poke the fly" playground is deferred until the video/article show traction.
First-visit tour (escape only): (0) narration over the dust while loading — "the nervous system of a fruit fly", "176,000 neurons, every wire mapped by electron microscopy"; (1) "What you see" — 3D labels on the shells (eyes/optic lobes, brain, nerve cord → legs & wings) + "N glowing of 176,000", paused at t=0; (2) "Scare the fly" — one pill plays the run once at ¼× with plain-language captions and a large FlyCam; (3) "Now break it" — silence all DNp01 → shadow again → "Panic neuron silent", "No takeoff"; (4) controls cheat sheet + links to Sugar / Song. Skippable, "?" restarts, seen-flag in localStorage, `?tour=0|<step>`; off under `snap=1` unless a step is given. Sugar / Song: one-line "what to watch" card + plain captions, no tour.
- [x] 7.0 Shape: RU/EN copy for every step + wireframes (1600, 390) via `impeccable` shape; user approves before code. **[S]** **[UI]**
- [x] 7.1 i18n without a library: `apps/web/src/i18n/{ru,en}.ts` (typed keys, en checked against ru's shape), `app.lang` (MobX), `?lang=ru|en`, RU/EN switch in the HUD, choice in localStorage (try/catch), `<html lang>` synced; `Intl.NumberFormat` / `Intl.PluralRules`. Translate the whole UI (~150 strings: toolbar, timeline, inspector, legend, Fatal, ViewerBar, `SCENARIO_TITLES`, colorBy groups, raster bands, captions); cell-type names stay. Smoke / snap / film / perf pin `lang=en` (they query English aria names); README demo link gets `?lang=en`. **[T]** **[V]**
- [x] 7.2 Plain-language captions (`scene/captions.ts` `SCRIPTS`): human phrase + the term as a small mono suffix ("Panic neuron fires · DNp01"), all 3 scenarios, RU/EN. Remove `ui/IntroHint.tsx`. **[V]**
- [x] 7.3 Tour engine: `state/tour.ts` pure step machine (transitions, skip, restart, seen), `?tour=`; play-once mode in `state/playback.ts` (stop at the end of the run instead of looping) + ¼× during the tour; "silence the panic neuron" preset = scenario rows of type DNp01 → `experiment.silenced` → live sim (`Stage.tsx` `goLive`). Measure the live switch (graph-full + meta-full) and live restart from t=0: > ~3 s → "preparing the whole brain…" state; unacceptable on phones → bake an escape-without-GF spikes variant (format change in `packages/data` only). **[T]**
- [x] 7.4 Loading narration (`ui/tour/Narration.tsx`, timed from `app.introPhase` / `introTimeline`) + anatomy labels (`ui/tour/AnatomyLabels.tsx`: anchors = centres of `CentralBrain` / `OpticL/R` / `VNC` shells, DOM positions written in `engine.onFrame`, no React state per frame) + "N glowing of 176,000" line. **[V]**
- [x] 7.5 Tour UI: step card (one violet pill per view, rest ghost), Skip, large FlyCam during the tour, final cheat sheet, "?" button; motion per the HUD rule (`starting:` ≤200 ms, motion-reduce = opacity only); phone variant in the ViewerBar layout (no tools). **[V]** **[UI]**
- [x] 7.6 QA: visual-qa snaps of every step RU + EN at 1600 and 390; ui-critic on the tour; smoke: `tour=0` keeps existing tests unblocked + one "tour completes" test. **[V]** **[UI]**
- [x] 7.7 Hallway test with 3–5 non-scientists (do they know what they see after the tour?) — user-run; fix what they trip on.
Done when: a first visit on desktop and phone walks through the tour in Russian, English is complete via the switch, and smoke is green.

## Phase 8 — Terrarium (≈3–5 weeks)
Goal: the hallway test showed "switch a neuron off" changes nothing visible — no wow. The Terrarium: a glass Petri dish floating in the void where a glass fly lives on the real connectome. The visitor places things (sugar, bitter, banana odor, shadow, swatter, a female) and operates on the brain; behaviour visibly changes ("panic neuron off → the swatter lands"). Same visual language as the brain view (void, glass, glowing dots, bloom). No sound anywhere. Done when: on desktop a visitor can place items, run the 4 surgeon operations and see each change the fly's behaviour, RU + EN, smoke green; phone has a working fallback.
- [x] 8.0 FlyCam: the fly always returns (`AWAY_MS` out of frame, drops in, `HOLD_MS` standing, then may take off again under drive), caption counts takeoffs; dev sim panel bottom-right, collapsed.
- [ ] 8.0b Remove sound everywhere: Tone.js dep, `scene/sound.ts` / `scene/audio.ts`, `ui/Sound.tsx`, Timeline sound button + `m` key, i18n strings, README mentions. Tests + smoke green; note the bundle drop.

Stage 1 — MVP wow (desktop):
- [ ] 8.1 Feasibility in Node (go / no-go): `neuprint-scout` picks sensory groups (sugar GRNs Gr5a, bitter Gr66a, odor ORNs L/R, LC4/LPLC2 per side, female cues, grooming mechanosensors) and command neurons (DNp01, MDN, turning DNs L/R, walking, grooming, MN9, P1). A script runs `packages/sim` headless per input → table "input → command neurons → behaviour" in `docs/TERRARIUM.md`. Decide odor steering: if it doesn't emerge, the fly wanders on its own (labelled simplification) and the connectome decides at encounters. **[T]**
- [ ] 8.2 Shape: dish look, items, trail, brain hologram, item palette, operation card, RU/EN copy, wireframes 1600/390; where the Terrarium lives (own view vs home) and how a newcomer gets there (tour → Terrarium). User approves before code. **[S]** **[UI]**
- [ ] 8.3 Bridge world ↔ brain (pure + tests): world → per-side rates of sensory groups; command neurons → action (forward, turn, back, stop, eat, groom, jump, court); live Worker API for time-varying input (`lif.ts` `stimulate(i, hz, gain)` per tick); row groups via `packages/data` if a format change is needed. **[T]**
- [ ] 8.4 World model (pure, deterministic, tests): 2D fly kinematics; items (sugar, bitter, odor plume field, shadow, swatter, wandering female); contact + sensing. **[T]**
- [ ] 8.5 Dish scene (three.js): glass dish in the void, camera 35–45°; glass fly (reuse `scene/flycam/model.ts`) with tripod gait; light trail coloured by state; items as glowing specimens (saffron crystals, acid drop, drifting particle plume); "×1/6 · high-speed camera" timecode; closed loop with the live sim. **[V]**
- [ ] 8.6 Placement: item palette, drag / remove / reset; tap on phones. **[V]** **[UI]**
- [ ] 8.7 Neurosurgeon: 4 operations — panic neuron off → no escape from the swatter; MDN on → moonwalk; sugar GRNs off → won't eat; P1 off → ignores the female; famous-neuron cards (plain name, role, fact); before/after verdict; mark on the fly's body. **[V]** **[UI]**
- [ ] 8.8 Brain hologram + decision thread: the brain floats above the fly and follows it; on a decision a thread of light runs sense organ → path (from `sim/trace.ts`) → legs. **[V]**
- [ ] 8.9 "From fly to neuron" zoom: click the fly → one continuous camera flight into its head → full brain view → operate → back to the dish. **[V]**

Stage 2 — deeper:
- [ ] 8.10 Odor navigation (only if 8.1 allows; else drop).
- [ ] 8.11 "Why did she do that?" — explanation card for the last decision. **[UI]**
- [ ] 8.12 Puzzle levels (3–5) with a hint ladder and a success moment. **[V]** **[UI]**
- [ ] 8.13 Puppet mode: arrow keys → command neurons.
- [ ] 8.14 Phone: tabbed layout; if the live brain is too slow → baked clips instead of the live dish. Simple / Scientist mode on the home view if still needed after the Terrarium. **[V]** **[UI]**

Stage 3 — release:
- [ ] 8.15 Perf (live sim + dish, 60 fps at "high"), visual-qa RU/EN 1600/390, ui-critic, smoke "Terrarium loads + an operation changes behaviour", clip for the video. **[V]** **[UI]**

## Backlog / spin-offs (not scheduled)
- Phase 9 candidates: fly-first home layout (big fly, brain as "what happens inside"); 3-step mini tours for Sugar and Song. (Simple mode + missions of the old phase 8 are absorbed by 8.7 / 8.12 / 8.14.)
- Tablet widths (768–1151 px): the open Inspector still overlaps the tool stack (the stack only shifts aside from 72rem). Make the Inspector a bottom sheet there, or show tools from `lg` up.
- Dust close-up: sprites are sized in µm, so at deep zoom they become big discs that clutter the view (seen in a live recording). Clamp on-screen size and fade dust near the camera.
- Cheap dense dust: lod1/lod2 (+900k sprites) halve fps on M4 whatever the pixel ratio (primitive-bound instanced quads). Try one triangle per sprite, native 1 px points, or a baked density volume; then raise `QUALITY.high.dustTiers` (`apps/web/src/scene/quality.ts`).
- neuPrint MCP server (find_neurons, get_partners, shortest_path, neuroglancer_link) + eval set — reuse `apps/pipeline/src/neuprint` client; strong AI-portfolio piece. Check GitHub for an existing one first.
- Neuron-as-art: skeleton projection → SVG poster/tattoo/print styles (CC-BY allows commercial use with attribution; hook: male-only neurons).
- Scrollytelling "How a male fly sings": P1 → pIP10 → VNC rhythm generators, 3D scenes + Web Audio song. Reuses scene + song synth from Phase 5.

## Library decisions (see DECISIONS.md)
Motion (motion/react) = UI · GSAP = camera/cinematics · Anime.js not used (overlaps GSAP) · Kokonut UI = copy-in components via shadcn registry when they fit the instrument look · Bklit UI = non-realtime charts only; realtime = uPlot + custom canvas.
