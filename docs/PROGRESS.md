# Progress (newest first, keep ≤5 entries)

## 2026-10-03 — 4.2 Inspector, focus dimming, stimulate/silence
Done: `data/partners.ts` (`partners` by type, `focusRoles`; tested), `state/experiment.ts` (selected / stimulated / silenced / live status / fly request), `scene/focus.ts` (roles + silenced → RG row-state texture, `focus` uniform fade, fly-to, `?select=<bodyId>`), `segments.ts` `rowBounds`, `engine.flyTo` + `scene/orbit.ts` (`orbitDistance` uniform: depth dim around the target, not the origin), `ui/Inspector.tsx`.
State: 283 tests, typecheck, lint green. Snap `--scenario=escape --t=40 --select=10001` → GF white, inputs blue, outputs saffron, rest dim; same on webgl2. One-off Playwright run: click selects, Stimulate starts live sim on demand (graph-full ~0.5 s), Silence, Esc. Click-select is mouse/pen only. Partners = scenario graph only (labelled).
Next: 4.3 tools + hotkeys (Stimulate brush, Silence, Electrode), stimulus strength/frequency sliders.
Gotchas: partner glow must stay at normal additive gain — GF has ~140 LC4/LPLC2 inputs, brighter partners bloom into a white blob. Fly-to frames the bbox half-diagonal (long neurons like GF ≈ whole CNS). Silenced rows grey + no wave even on baked. Live sim re-applies experiment diffs after tune/reset (applied sets cleared). Panel covers the right edge of the view; centring the target in the free area (camera view offset) left for 4.8.

## 2026-10-03 — 4.1 GPU picking, hover highlight + tooltip
Done: `apps/web/src/scene/pick.ts` (`Picker`: RGBA8 id target = drawing-buffer size, 9×9 readback, `nearestHit`/`decodeIds` tested); `neuronsLayer` → shared `ribbon()` vertex, `pickMesh` (id = row+1 as 24-bit rgb) + `hovered` uniform (whole-neuron boost, colour modes whiten); `startPicking` in `Stage.tsx` → `app.hover`; `ui/NeuronTooltip.tsx` (position imperative, content via MobX); `?pick=x,y` param + `pick` ready flag.
State: 72 web tests, typecheck, lint green. Snap `--scenario=escape --t=40 --pick=0.39,0.37` → DNpe042 highlighted + tooltip, identical on `--gl=webgl2`; `--debug=id --pick=0.766,0.405` → LPLC2. Picks only on pointer/camera move, off while dragging, mouse/pen only (no touch).
Next: 4.2 Inspector (type, NT, inputs/outputs, fly-to / stimulate / silence); focus dimming, inputs vs outputs colours.
Gotchas: R32F `readPixels(RED, FLOAT)` returns nothing on WebGL2 → RGBA8 packing. WebGL readback is bottom-up (Picker flips window + centre). `fragmentNode` bypasses tone mapping/colour space, so ids are exact. Tailwind v4 drops unused `@theme` vars (`--color-nt-*` empty in inline styles) → use `NT_COLORS[nt].hex`. Snaps fire right after the pick → tooltip fade disabled under `snap`.

## 2026-10-02 — 3.7 GF-silenced residual TTMn route
Done: `apps/pipeline/src/process/drive.ts` (`inputDrive` = per-pre Σ spikes·w onto targets, `firstSpike`; tested); `apps/pipeline/src/explore/gfRoute.ts` (`pnpm --filter pipeline explore:gf`, ~1 min, prints markdown); findings in `data/scout/escape.md` §GF silenced.
State: Phase 3 done. Without GF, TTMn 30–62 Hz, 1st spike 16–19 ms (intact ≈225 Hz, 8 ms). Route is distributed: DNp02+DNp06+DNp103 → AN19B001 → IN07B055/GFC2 → TTMn, plus weak direct DNp06/DNp02. No single knockout kills it; DN group → 5 Hz, relays → 7 Hz, all → 0.
Next: Phase 4.1 GPU picking (id buffer), hover highlight whole neuron + tooltip.
Gotchas: several single ablations *raise* TTMn (GFC2 → 105 Hz, DNp04 → 67) — they also feed TTMn's inhibitory INs (IN13A022, IN13B008). GF silencing changes no other DN rate (sign 0 → only NET_OVERRIDES outputs). GFC2 is chemically driven here, in vivo GF-coupled → residual route likely overstated.

## 2026-10-02 — 3.6 biology checks as tests
Done: `packages/sim/src/overrides.ts` (`applyOverrides`, `NET_OVERRIDES`: GF→TTMn/PSI 40 mV) used by pipeline `buildNet` (`process/spikes.ts`, also `RunConfig.silence`) and `sim.worker.ts`; sugar stim BM_Taste → LB3a–d (added to `data/scout/sugar.json`, skeletons pulled); `process/scenarios.bio.ts` + `vitest.bio.config.ts` → `pnpm test:bio` (6 tests, ~20 s).
State: all green (257 unit + 6 bio), rebaked. Hz @300 ms: escape GF 415, TTMn 230 (GF silenced → ≈35, first spike 8.5 → 21 ms), PSI 120; sugar MN9 227, MN8 62, DNge062 203; song pIP10 68, hg1 128, hg3 197. Bio tests run on the whole graph as one "scenario" (all rows), not the scout subset.
Next: 3.7 exploratory — GF silenced, TTMn still ≈35 Hz with ≈21 ms latency: trace which DNs (DNp02/DNp11 at 350/275 Hz?) carry it; document, no assert.
Gotchas: DNp01 NT conf 0.53 → sign 0, so GF drives nothing chemically; overrides only touch existing edges. TTMn has heavy inhibitory input (IN13A022 987 syn) — 10 mV overrides gave only 90 Hz. Snap sugar t=40: SEZ blob saturated white (bloom/gain, like song) — visual tuning still open. Scout JSON files are minified one-liners; keep them that way.

## 2026-10-02 — 3.5 dev tweakpane sim panel
Done: `Live.retune(params, net?)` (`apps/web/src/sim/live.ts`, tests); worker `tune(Tuning)` (`Tuning = Partial<LifParams> & {gain}`, net rebuilt via `netFromCsr` only when wSyn·gain changes) + `LiveClient.tune`; `apps/web/src/dev/tuning.ts` (Tweakpane, imperative, lazy-imported under `import.meta.env.DEV`), mounted in Stage `startActivity` when live and (!snap or `ui=tune`).
State: 253 tests, typecheck, lint green; `pnpm snap --scenario=escape --t=40 --sim=live --ui=tune` shows panel top-right. Released slider → scenario restarts at t = 0 (same seed); "copy JSON" = diff from defaults. Prod-bundle exclusion of tweakpane not inspected (dist reads denied).
Next: 3.6 biology checks as tests (GF fires on shadow, MN9 on sugar — currently 0 Hz, pIP10/wing MNs on song, GF silencing kills TTMn); use the panel to find params first.
Gotchas: Tweakpane v4 types need `@tweakpane/core` devDep. A readonly monitor binding emits `change` on every poll → listen on folders, not the root pane (otherwise endless restarts). `gain` scales synapses only; `wSyn` also scales the Poisson kick.
