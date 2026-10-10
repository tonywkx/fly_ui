# Progress (newest first, keep ≤5 entries)

## 2026-10-10 — 9.3 Experiment model
Done: `scene/dish/discoveries.ts` (`CARD_STIMULI`, `Pair`/`pairId`/`parsePair`, 12 `DISCOVERIES` with `level` on 5–8, `chips(pair)` derived from `NORM` + per-stimulus distractors, seeded `shuffle`); `scene/dish/take.ts` (`Take`: first decision, hit, end = decision + 300 ms or 600 ms, result + all command peaks); `DishLoop.script` (delivery hook before each world step) + `DishLoop.peak`, both cleared by `reset()`; `state/trial.ts` (`TrialStore` `trial`: slots, bet on first run only, phases setup/running/result, `run` counter, `finish(take)` → `outcome` vs `NORM[stim].none`, journal in `fly_ui.found`, puzzles solved in `fly_ui.levels` migrate to discoveries 5–8).
State: tests 593 / typecheck / lint green. Model only: nothing calls `trial.start()` / `finish()` yet, no UI change.
Next: 9.4 card + palette; wire `DishRun` to `trial.run` (clear arena, put the fly at the start pose, `dish.setOps` from `trial.op`, `loop.script = delivery(stim)`, feed `Take` with `loop.decisions` + `advance` events each frame, on `done` → `trial.finish(take.result(loop.peak))`; `stop`/Esc drops the script).
Gotchas: `state/experiment.ts` is the brain view's `ExperimentStore` — the card model is `state/trial.ts`. `outcome.hz` is the deciding command's peak; for swatter × DNp01 off the card wants TTMn (the norm's command) → read `outcome.peak.jump`. Changing a slot after a result drops back to setup; slots are locked while running.

## 2026-10-10 — 9.2 Norm table + determinism
Done: `World(seed)` reseeds on `reset()` (reruns retrace; tests in `world.test.ts`, `loop.test.ts`). `packages/sim/src/deliver.ts`: scripted delivery per stimulus (`STIMULI`, `delivery(stim)` tick before each step), shared by pipeline + card. `apps/pipeline/src/explore/norm.ts` (`explore:norm [--write]`, ≈4.5 min) → `apps/web/src/scene/dish/table.ts` (`NORM[stim][brain]`), findings + 12 discoveries with bet chips in `docs/TERRARIUM.md` §Norm table; EXPERIMENT-SHAPE §Open settled.
State: tests 568 / typecheck / lint green. No UI change.
Next: 9.3 experiment model `state/experiment.ts` (slots, bet, phases, run end = decision + 300 ms or 600 ms, result vs `NORM`, journal, `fly_ui.found`; puzzles = discoveries 5–8).
Gotchas: banana is out of the stimulus slot (never decides) but stays in `STIMULI`. MDN-on × shadow/swatter and P1 on flicker (not robust) — not discoveries, P1 on not a card op. Latency in `NORM` is from sense onset in the closed loop (eat 61, back 60, court 110, jump 24–35), not `USUAL.ms` (8.1 open-loop first spike). Swatter × DNp01 off = hit in all seeds (`hit: true`, action 'back' is after reassembly). Discovery titles/teasers are EN drafts — RU copy with the user in 9.6.

## 2026-10-10 — 9.1 Experiment shape
Done: `docs/EXPERIMENT-SHAPE.md` (approved): loop give → change → bet → run → result (обычно / сейчас / прогноз) → replay → discovery; card states, replay, discoveries tab, 4-step onboarding in the card, phone tabs «Опыт · Положить · Открытия», what goes (DishLevels, why-card popover, multi-op list), states, RU/EN copy table.
State: docs only, no code. PLAN 9.1 ticked.
Next: 9.2 norm table + determinism (`apps/pipeline/src/explore/`, `scene/dish/table.ts`, `World.reset()` reseeds rng); also settle the shape's §Open: the 12 discoveries + 3 bet choices per pair, banana in the slot, «Ничего» stimulus for MDN on, run timeout.
Gotchas: bet/result copy is gender-neutral on purpose («прогноз: взлетит · вышло иначе», no «ты думал(а)»); the bet subject flips to «он» for the female stimulus.

## 2026-10-10 — 8.16 Russian copy pass + Phase 9 plan
Done: `apps/web/src/i18n/ru.ts` rewritten block by block with the user (glossary → terrarium → ops/puzzles → why-card → tour/captions → brain HUD); EN names kept in step (`en.ts`); glossary in DECISIONS. `ui/DishLevels.tsx` strip wraps (label nowrap, title drops below on phones); nbsp before units in op lines. Phase 9 written in `docs/PLAN.md` (terrarium home, experiment loop, prediction, replay, discoveries).
State: tests 561 / typecheck / lint green; RU snaps 1600/390 OK for dish, ops, puzzles, puppet, tour, legend. Not snapped: why-card + dish caption (needs a live decision), inspector, an open op card on the phone.
Next: 9.1 shape — `docs/EXPERIMENT-SHAPE.md` with wireframes 1600/390 via `impeccable`; user approves before code.
Gotchas: the dish slow-mo factor isn't fixed (`SlowMo.slow` can be any integer), so RU can't say «в N раз» without plurals. visual-qa hit its turn limit on a 6-state brief — give it ≤3 states per call. `?why=1` shows nothing in a static snap (no decision yet).

## 2026-10-07 — 8.15 Perf / release check
Done: `scene/dish/frame.ts` (+test) — pure fit: camera distance + view offset that centre the dish in the band the chrome leaves (`GUTTER` 24 px, `SPREAD` 1.08 for the near half/glow, floor `MIN_FREE` 0.3); `DishScene.frameBand(Band)` eases x/y offset, a refit rescales the camera (keeps the visitor's zoom); `Dish.tsx` measures `[data-band-left]` (palette) / `[data-band-right]` (ops card) on desktop, ResizeObserver on both. `e2e/smoke.spec.ts` «terrarium loads + an operation changes behaviour» (MDN on → status «backs off for no reason», skipped on CI).
State: tests 561 / typecheck / lint / smoke 8 green; visual-qa 1280/1600 RU/EN + 390 OK (≈36–40 px gap each side, phone unchanged); ui-critic no P1.
Next: 8.16 Russian copy pass (walk `i18n/ru.ts` by screen with the user). ui-critic P2 left: fly ~50 px at 1280 (maybe slimmer columns at md–xl), palette/ops column tops not aligned, ops card `bg-card` barely visible at 1280 (hairline?), puppet mono ash contrast, phone tabs `h-8` < 44 px touch target.
Gotchas: the screen spread of the dish isn't its diameter — the near half + wall + glow add ~4–8 % and grow with size, so a fixed px gutter looked fine at 1280 and touched at 1600.
