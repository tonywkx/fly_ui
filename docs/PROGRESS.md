# Progress (newest first, keep ≤5 entries)

## 2026-10-05 — 7.2 Plain-language captions
Done: `scene/captions.ts` `Beat.term` / `missing.term` / `CaptionEvent.term` (dataset name, untranslated) + test; `cap.*` RU/EN rewritten from TOUR.md; `ui/Captions.tsx` suffix `· <term>`, else `· <t> ms` for body beats, none for a missed body beat. Removed `ui/IntroHint.tsx`, `hint.escape`, app `hint*` state, `intro.ts` `hint`/`hintDelayMs`; `Stage.tsx` runs `afterIntro` right at `phase === 'done'`.
State: 397 tests, typecheck, lint, smoke 6/6 green. visual-qa escape t=5/40 EN 1600, RU 390, sugar RU OK.
Next: 7.3 tour engine — `state/tour.ts` step machine + `?tour=`, play-once in `state/playback.ts`, DNp01-silence preset → live sim; measure the live switch time.
Gotchas: `app.setIntro(phase)` now takes only the phase. visual-qa can misread Cyrillic «мс» as «ms» in the mono suffix — crop and look before "fixing".

## 2026-10-05 — 7.1 i18n
Done: `apps/web/src/i18n/{index,ru,en}.ts` (flat keys, `t` / `plural` (Intl.PluralRules) / `num` (Intl.NumberFormat) / `tOr` for data-built keys; `en: Shape<typeof ru>` + `i18n.test.ts` check keys, placeholders, plural categories); `?lang=ru|en` → localStorage `fly_ui.lang` → ru; `app.lang`/`setLang`, `<html lang>` synced; `ui/LangSwitch.tsx` (desktop under the scenario title, phone = one compact button in ViewerBar). Whole HUD translated incl. captions (`SCRIPTS` texts are now keys, `Beat<Key>`), colorBy groups, NT names, raster bands, palette (cmdk `value` = translated label, English in `keywords`). Tour/watch keys from TOUR.md already in the dicts.
State: 396 tests, typecheck, lint, smoke 6/6 green. snap/film/perf/smoke pin `lang=en` (`pnpm snap --lang=ru` for Russian); README demo link `?lang=en`; `scenarioHref` keeps `lang`. visual-qa RU/EN 1600 + 390 OK after fixes.
Next: 7.2 plain-language captions (rewrite `cap.*` copy from TOUR.md §Captions, mono term suffix), remove `ui/IntroHint.tsx`.
Gotchas: vitest doesn't resolve `@/` — modules imported by tests must use relative paths (`ui/viewer.ts` → `../i18n`). Superclass words («descending neuron») and ROI names stay untranslated (data vocabulary, like cell types). Instrument readouts keep `toFixed` (dot decimals); counts use `num`. Legend's trailing «C» is the hotkey kbd, not a clipped tab.

## 2026-10-05 — 7.0 Tour shape
Done: `docs/TOUR.md` — impeccable-shape brief, RU/EN copy with i18n keys for tour steps 0–4 + chrome, Sugar/Song "what to watch" cards, plain-language captions for all 3 scenarios (human phrase · term), ASCII wireframes 1600/390.
State: approved by the user as written (incl. step-3 GF honesty line, reset to baked escape on finish, card bottom-centre / phone card replaces ViewerBar + FlyCam strip, «Бегство»). User answered: RU addresses «ты», HUD hidden during steps 0–3 (back on step 4), ASCII wireframes.
Next: 7.1 i18n — `apps/web/src/i18n/{ru,en}.ts`, keys from TOUR.md.
Gotchas: escape scenario set ≈1254 neurons (legend at t=40); RU count line needs a PluralRules verb (участвует/участвуют). Real GF-silenced flies still take off (slow long-mode path) — the model has no such route, so copy must not claim "can't escape".

## 2026-10-04 — 6.4 README, video, article
Done: `README.md` (live link, scenarios/tools/hotkeys, architecture, dev, data & attribution: Berg et al. bioRxiv 2025 doi:10.1101/2025.10.09.680999 + Shiu 2024, CC BY 4.0) + `LICENSE` (MIT) + `docs/media/*.jpg`; `docs/article.ru.md` (Habr draft, ~2.1k words); `scripts/film.ts` (`pnpm film [--shot --sec --fps --join]`) → `snaps/fly_ui.mp4` master (43 s 1080p60, 194 MB) + `snaps/fly_ui.web.mp4` (30 fps, 9.6 MB); snap/perf/film share `scripts/lib.ts` (ports 5199/5198/5196).
State: typecheck, lint green; snap re-verified after the refactor. Video not uploaded; README has a placeholder comment for it. 9 local commits ahead of origin/main (6.3 polish + this), not pushed.
Next: user uploads `snaps/fly_ui.web.mp4` via the GitHub editor → paste URL into README; push main; publish the article (upload images). Phase 6 done → pick from Backlog.
Gotchas: film = Playwright `page.clock` (install with a time, then `pauseAt` later — earlier throws) + `runFor(1/fps)` + screenshot; WebGPU presents fine under the fake rAF. Loading is real time, so the ready loop must keep ticking. ~4 frames/s at 1080p (≈12 min for all shots). The escape cascade is ≈30 sim ms = <1 s at 1× — a slow-mo pass (`[` twice after Play) would read better if re-filmed.

## 2026-10-04 — 6.3 impeccable audit + polish
Done: audit (detector clean; snaps base-*/after-* at 1600/1280/1024/390). `ui/FlyCam.tsx` → top-right (overlapped the timeline below ~1470 px; enters from above); `App.tsx` stack shifts to `left-40 right-64` while the Inspector is open at 72–92rem; `--color-panel` 0.62→0.7 (contrast over glow); phone ViewerBar 66→48 px; Fatal Reload = primary pill; captions `max(16rem,min(32rem,100vw-44rem))`; Tracer swap = SVG.
State: 384 tests, typecheck, lint, smoke (6/6, real GPU) green. visual-qa after-pass PASS except the known tablet overlap (Backlog). ui-critic fixes applied; captions stay viewport-centred while the stack is shifted (accepted).
Next: 6.4 README (CC-BY attribution), 30–60 s video, article. Check the first GitHub Actions run if not yet done.
Gotchas: `--spacing` is 6px — `size-11` = 66 px, not 44; 48 px targets are `size-8`/`h-8`. Translucent panels have no visible edge over black, so a "hard edge" in snaps is just the panel border over the bright brain. `trace=` only sets the ends; add `ui=trace` to see the panel in a snap. visual-qa claims ("clipped", "cut off") need a look — two were false this session.
