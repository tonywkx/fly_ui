# Progress (newest first, keep ≤5 entries)

## 2026-10-02 — 3.5 dev tweakpane sim panel
Done: `Live.retune(params, net?)` (`apps/web/src/sim/live.ts`, tests); worker `tune(Tuning)` (`Tuning = Partial<LifParams> & {gain}`, net rebuilt via `netFromCsr` only when wSyn·gain changes) + `LiveClient.tune`; `apps/web/src/dev/tuning.ts` (Tweakpane, imperative, lazy-imported under `import.meta.env.DEV`), mounted in Stage `startActivity` when live and (!snap or `ui=tune`).
State: 253 tests, typecheck, lint green; `pnpm snap --scenario=escape --t=40 --sim=live --ui=tune` shows panel top-right. Released slider → scenario restarts at t = 0 (same seed); "copy JSON" = diff from defaults. Prod-bundle exclusion of tweakpane not inspected (dist reads denied).
Next: 3.6 biology checks as tests (GF fires on shadow, MN9 on sugar — currently 0 Hz, pIP10/wing MNs on song, GF silencing kills TTMn); use the panel to find params first.
Gotchas: Tweakpane v4 types need `@tweakpane/core` devDep. A readonly monitor binding emits `change` on every poll → listen on folders, not the root pane (otherwise endless restarts). `gain` scales synapses only; `wSyn` also scales the Poisson kick.

## 2026-10-02 — 3.4 worker live mode + real spikes in scene
Done: `packages/sim` `clearSpikes()`; `apps/web/src/sim/` — `feed.ts` (`SpikeFeed` ring buffer, `bakedEvents`, `nextSimTime`, `NEVER`), `live.ts` (`Live`, `rowMap`), `sim.worker.ts` (comlink: init/advance/stimulate/silence/reset), `client.ts` (`LiveClient` pump); `scene/playback.ts` (`bakedSource`, `play`); Stage plays baked by default, `?sim=live` swaps to Worker; fake BFS (`scene/activity.ts`) deleted; `?sim=baked|live` param, ready flag `'sim'`, `data.url(chunk)`.
State: 251 tests, typecheck, lint green. Snaps escape t=40 baked ≈ live (same engine/seed); live loads 176k/6.3M in ~0.2 s locally, runs ≈54 sim ms/s in headless Chromium (needs 40 → 1.35× headroom; clock slows, never desyncs). No UI yet for stimulate/silence (phase 4).
Next: 3.5 Tweakpane dev-only param panel (thresholds, weights, gain) — live mode needs `Live` params reset path (currently only seed/params at construction).
Gotchas: visual-qa: escape t=40 lights mostly optic-lobe patches (GF etc. not distinct); song t=60 is a near-saturated blob in SEZ — gain/bloom or tuning (3.6). Live stim order = sorted scenario rows vs baked full-row order → RNG stream differs, so live ≠ baked bit-exactly. Speed only logged after 20 batches (`[sim] N sim ms/s`).

## 2026-10-02 — 3.3 full-graph run → baked spike trains
Done: `packages/data/src/spikes.ts` (`spikes` chunk, FORMAT_VERSION 3, `spikeTrainFrom`/`encodeSpikes`/`decodeSpikes`, web `decode.ts` case); `apps/pipeline/src/process/spikes.ts` (`runScenario`, `scenarioRows`, `typeRates`) + `scenarios.ts` (`SCENARIO_RUNS`); `bake.ts` runs each scenario on the full graph → `<id>-spikes.bin` first-frame.
State: bake green, first-frame 11.32/15 MB, spikes chunks 0.02–0.06 MB; tests/typecheck/lint clean; escape snap unchanged. Scene does not play spikes yet (still fake BFS wave).
Next: 3.4 Worker live mode via comlink + ring buffer to the scene's last-spike R32F texture (baked `spikes` can drive the same texture as a playback fallback).
Gotchas: 300 ms runs (Hz): escape GF 415 (near max), TTMn 35, DLMn c-f 345; song pIP10 68 → dPR1 102 → hg1 MN 128; **sugar MN9/MN8 0** (GNG015 252, DNge055 153) → 3.6. Peak active set ≈95k/176k (subthreshold included), ≈3.5 s/run in Node. No overrides (GF→TTMn electrical) yet. `stats.spikes` == Σtotal only because run(duration) ends exactly on the last binned step.

## 2026-10-02 — 3.2 poisson stimulus, silencing, rng
Done: `packages/sim/src/rng.ts` (`mulberry32(seed): Rng`, passed as 3rd arg of `createSim`, default seed 0); `lif.ts`: `stimulate(i, hz=150)` (0 removes), `silence(i, on=true)`; tests `rng.test.ts`, `stim.test.ts` (rate ≈112.8 Hz ±5%, same-step spike, stop, chain block/recover, silenced stim, seed determinism).
State: 20/20 green, typecheck + lint clean. Sim still not wired to web; no full-graph run yet.
Next: 3.3 Node full-graph run: load real Csr + sign (via `netFromCsr`), bake scenario spike trains to a compact binary format in `packages/data` (schema + encoder + decoder + test together).
Gotchas: Shiu Poisson targets **v**, not g (verified in philshiu/Drosophila_brain_model `model.py`); kick 68.75 mV always spikes the same step. Refractory loses kicks → ~112.8 Hz, not 150. Silencing = clamp at rest (differs from Shiu's zeroed weights, same downstream) — see DECISIONS. Spikes already queued before `silence()` still get delivered. rng is drawn once per stimulated neuron per step regardless of state.

## 2026-10-02 — 3.1 sim LIF + delay queue
Done: `packages/sim/src/lif.ts` (`Sim`/`createSim(net, params?)`: `step`, `run(ms)`, `inject(i, mV)`, `v`/`g` f64, `lastSpike` f32 (−Infinity = never), growable `spikes {count,t,id}`, `activeCount`); `net.ts` (`Net {n, offsets, cols, w mV signed}`, `netFromCsr(csr, sign, wSyn)` structural, no `@fly/data` import; `netFromEdges` for toy nets); `params.ts` (`LIF_DEFAULTS` + `dt: 0.1`). Tests: rest, analytic PSP (peak 0.1575·w @ 9.24 ms), threshold (40 no / 50 mV spike), 3-chain (hop = delay + rise), inhibition cancel, refractory ISI, active-set drain, determinism.
State: 11/11 green, typecheck + lint clean. No stimulus/RNG/silencing yet; not wired to web.
Next: 3.2 Poisson stimulus (rate 150 Hz, kick wSyn·poissonScale = 68.75 mV), silencing mask, seeded RNG passed in, determinism test with seed.
Gotchas: f32 v near −52 mV stalls the exponential decay at ~4e-4 mV (ulp 3.8e-6 > per-step decrement) → v/g are Float64. Single kick needs ≥44.4 mV to reach threshold (≈162 synapses × 0.275). Step order: deliver due spikes → integrate active → threshold; spike time = end of step, arrives exactly `delay` later. `vitest --root /` scans the whole disk — put scratch tests inside the package.
