# Progress (newest first, keep ≤5 entries)

## 2026-10-05 — 7.0 Tour shape (draft)
Done: `docs/TOUR.md` — impeccable-shape brief, RU/EN copy with i18n keys for tour steps 0–4 + chrome, Sugar/Song "what to watch" cards, plain-language captions for all 3 scenarios (human phrase · term), ASCII wireframes 1600/390.
State: draft committed, NOT approved yet; 7.0 unticked. User answered: RU addresses «ты», HUD hidden during steps 0–3 (back on step 4), ASCII wireframes.
Next: get user OK or one edit round on TOUR.md's 4 open points (GF honesty line in step 3, reset to baked escape on finish, card placement/phone FlyCam strip, «Бегство» vs «Побег») → tick 7.0 → 7.1 i18n.
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

## 2026-10-04 — 6.2 Smoke tests, CI → Pages
Done: `e2e/smoke.spec.ts` + `playwright.config.ts` (`pnpm smoke`: fresh prod build → `vite preview` :5197; 3 scenarios ready with 0 console errors and ≤15 MB before first frame — 10.6/11.7/12.5 MB; play/pause moves the clock; phone `ViewerBar` switches scenario; manifest 500 → `Fatal`), `e2e/tsconfig.json` in `pnpm typecheck`; `scripts/data-push.sh` (`pnpm data:push [remote|url]`, orphan `data` branch, one force-pushed commit); `.github/workflows/ci.yml` (check → smoke with `data` checked out into `public/data` → deploy-pages from the smoke job's dist, main only).
State: 384 tests, typecheck, lint green; smoke green on real GPU (4 s) and with `CI=1` (SwiftShader WebGL2, ≈6 min). data-push verified against a local bare repo. No remote yet: workflow never ran on GitHub, actionlint not installed.
Next: user creates the GitHub repo → `git remote add origin`, `pnpm data:push`, push main, Pages Source = GitHub Actions; check the first run. Then 6.3 `impeccable` audit.
Gotchas: `CI=1` switches pages to `?gl=webgl2` + SwiftShader flags; ≈50 s per load there regardless of viewport (not pixel-bound). Real clicks hang under SwiftShader (input ack waits on a frame commit) → smoke uses `dispatchEvent('click')`; a link navigation there never unloads the busy page within 30 s → phone test checks hrefs only. Repo default branch must be `main` (data was pushed first) or the github-pages env rejects the deploy. `--reporter=json` stdout is polluted by pnpm/webServer output: use `PLAYWRIGHT_JSON_OUTPUT_NAME`.

## 2026-10-04 — 6.1 Profiling, WebGL2 fallback, phone viewer
Done: `pnpm perf` prints bytes until drawn + `--profile` (CDP self-time top 15), stats read via `data-stat`; `data/plan.ts` loads only shared + chosen scenario chunks (song 23.4 → 13.7 MB); `Preset.blur` (off on low, `[data-blur=off]` in theme.css = denser panels) + `FpsGuard` < 54 fps; `ui/Fatal.tsx` (`app.rendererFailed` / `data.error`, tools hidden, `ready` true on renderer failure); phone `ui/ViewerBar.tsx` (play/pause + scenario links via `ui/viewer.ts` `scenarioHref`, `SCENARIO_TITLES` moved there), director on for coarse pointers.
State: 384+ tests, typecheck, lint green. visual-qa: WebGL2 ≡ WebGPU on all scenarios/tools/low; phone snaps 390×844 ok; ui-critic fixes applied. Song at high still 48 fps headless (guard steps it to low); not checked on a real phone.
Next: 6.2 Playwright smoke tests; GitHub Actions → Pages.
Gotchas: zsh doesn't word-split `$a` — use `${=a}` when looping perf/snap args. Debug modes hide the HUD, so they also hide blur cost. Pick ties among overlapping ribbons differ by backend (same spot, different neuron) — not a flip bug. Snap pins quality to high, so FpsGuard can't be exercised by perf.
