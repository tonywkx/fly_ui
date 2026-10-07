# Progress (newest first, keep ≤5 entries)

## 2026-10-07 — 8.3 Bridge world ↔ brain
Done: `packages/sim/src/bridge.ts` (+ test): groups `SENSES`/`COMMANDS`/`OPERATIONS` by type + somaSide, `senseDrive`/`diffDrive`, `CommandMeter`, `decide` (hysteresis, jump > back > eat > court > walk), `eyes(bearing, x)`; `Kernel` moved to `packages/sim/src/kernel.ts`. Live Worker by full-graph row: `groups`, `watch`, `drive`, `silenceRows` (`apps/web/src/sim/{live,sim.worker,client}.ts`). Calibration `explore:terrarium --bridge` (`apps/pipeline/src/explore/bridge.ts`) → `docs/TERRARIUM.md` §Bridge.
State: all expected cases pass on seeds 1–3 (loom → jump 30 ms, panic off → walk, sugar → eat, bitter / MDN on → back, female → court, P1 off → walk). No UI yet; nothing calls the new Worker API. 463 tests, typecheck, lint green.
Next: 8.4 world model (pure, deterministic, tests): 2D kinematics, items, contact + sensing → `Senses` (use `eyes()` for loom/female), consume `Action`.
Gotchas: one eye alone is too weak (loom TTMn ≤ 187, female → MDN bursts) → far eye ≥ ¾ via `eyes()`. Thresholds on/off: TTMn 170/110, MDN 60/35, MN9 150/100, pIP10 50/30 + pC1 3/1.5 (FlyCam keeps its own 200). `reset()` clears `drive` — the dish must reset its prev drive map. `watch` resets the client log. Taste/ORN cells have no somaSide (unsided is fine). Scratch inspect scripts need `.mts` for top-level await under tsx.

## 2026-10-07 — 8.2 Terrarium shape
Done: `docs/TERRARIUM-SHAPE.md` (approved): brief, world (24 mm arena, fly ≈ 90 px at 1600, trail colours, ×1/6 timecode, brain hologram + decision thread), 4 items + 2 visitor-aimed hands (shadow = hold, swatter = click), 4 operation cards (usual vs now verdict), ASCII wireframes 1600/390, states, RU/EN copy (`dish.*`, `op.*`, tour step 4 pill «В террариум →»). DECISIONS line (own view `?view=dish`, entry from tour step 4).
State: docs only, no code. User approved with edits: hands instead of one-shot items, MDN = «Нейрон отступления», fact lines verified.
Next: 8.3 bridge world ↔ brain (pure + tests): per-side sensory rates in, command-neuron thresholds out (TTMn jump, MDN back, MN9 eat, pIP10 + pC1 gate court); live Worker `stimulate` per tick.
Gotchas: GF axon is the largest in the *thoracic* ganglia, not the whole CNS; MDN ↔ Michael Jackson is folklore (not in Bidaye 2014) — copy avoids both. LB3 is labellar, so leg-taste facts don't fit the sugar card. Cell counts on op cards come from the dataset at runtime. `/handoff` cannot be invoked by the model — user runs it.

## 2026-10-06 — 8.1 Terrarium feasibility
Done: `apps/pipeline/src/explore/terrarium.ts` (`pnpm -C apps/pipeline explore:terrarium [--ops]`): sensory input → command-neuron rates (L/R) + surgeon ops on the full graph; results + verdict in `docs/TERRARIUM.md`; DECISIONS line; 8.10 marked "drop unless model changes".
State: GO. Connectome-driven: loom → DNp01 → TTMn (GF off → TTMn 44 Hz, no jump), sugar LB3 → MN9, bitter LB1 → MDN, LC10a → pIP10. Scripted: forward walk, turning, odor approach (L/R ORN input gives identical output). P1 off only cuts pIP10 by 30 %. Grooming dropped.
Next: 8.2 Shape (dish look, items, operation card, RU/EN copy, wireframes 1600/390, where the Terrarium lives); user approves before code.
Gotchas: sensory cells have no `somaSide`, so the L/R split needs neuPrint `rootSide` (the script queries it, token needed). Full run ≈ 4.5 min (≈3 s per 300 ms full-graph run). neuPrint has no Gr/ppk labels: LB3 = sugar, LB1 = bitter, pC1_* = P1 are inferred. There is no "P1"/"oDN1"/"aDN" type. DNb06 fires L ≫ R for any input (artefact). DNg11 fires 20–30 Hz for almost any input.

## 2026-10-06 — 8.0b Remove sound
Done: deleted `scene/sound.ts`, `scene/audio.ts`, `ui/Sound.tsx`, `tone` dep, Timeline speaker button + `M` key, palette item, `app.sound`, `sound.*` i18n; `continuous` (play-step test used by Captions) moved to `sim/feed.ts` + test. README / PRODUCT / article.ru cleaned; DECISIONS 2026-10-04 sound line marked superseded.
State: no sound anywhere. Bundle `dist/assets` 2532 → 2304 KB (−228 KB, the lazy Tone chunk; first-frame size unchanged). 439 tests, typecheck, lint, smoke 7/7 green; snap escape t=40 RU/EN OK.
Next: 8.1 feasibility in Node — `neuprint-scout` picks sensory groups + command neurons, headless `packages/sim` per input → table in `docs/TERRARIUM.md`, go / no-go.
Gotchas: visual-qa noticed (pre-existing, not fixed): FlyCam dark backdrop edge cuts the brain silhouette at 1600; legend card truncates «Male C…». Reading `dist/` and `pnpm-lock.yaml` via Bash is permission-denied — measure with `du -sk`.

## 2026-10-06 — 8.0 FlyCam returns + phase 8 planned
Done: `scene/behavior.ts` — the fly no longer waits for TTMn quiet: out of frame `AWAY_MS`=60 → new fly drops in (`drop`, `LAND_MS`=30) → stands ≥`HOLD_MS`=120 → may take off again; `FlyPose` + `firstJumpAt` / `jumps` / `drop`; FlyCam caption «взлёт 26,5 мс · ×3» (`flycam.takeoffs`); captions' jump beat reads `firstJumpAt`. Dev Tweakpane panel bottom-right, collapsed. Phase 8 (Simple mode, famous neurons, missions) written into PLAN.md; D/E/F → backlog "Phase 9 candidates".
State: 7.7 hallway test done by the user — "more or less fine", phase 7 closed. 443 tests, typecheck, lint, smoke 7/7 green. Live check: panic rows stimulated non-stop → fly lands back and stays; repeats when TTMn burst ≥200 Hz.
Next: 8.0b remove sound everywhere, then 8.1 feasibility in Node (Terrarium go / no-go). Phase 8 was re-planned as the Terrarium (see PLAN.md, DECISIONS.md).
Gotchas: smoke `tour completes` is skipped under `CI` (SwiftShader: frames take seconds, the clock moves ≤ `MAX_FRAME_MS`=100 per frame, so ¼× tour runs take minutes) — run smoke locally before pushing. CI logs without gh: `curl api.github.com/repos/tonywkx/fly_ui/check-runs/<job>/annotations`. Baked escape loop now shows a 2nd takeoff (×2) — the TTMn burst again after the fly is back (was hidden by the old quiet rule); tour play-once stops before it. Driving live from Playwright (dev): `await import('/src/data/store.ts')` / `'/src/state/tour.ts'` share the app's module instances; `__tour.panic` is empty unless the tour is active.
