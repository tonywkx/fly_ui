# WELCOME — shape (Phase 10 brief)

Approved look, flow and copy for 10.2–10.5. Builds on [EXPERIMENT-SHAPE.md](EXPERIMENT-SHAPE.md) (home = Terrarium, card, onboarding in the card) and the RU glossary in DECISIONS. RU default, «ты», the fly is «она». Copy keys are suggestions. User decisions (2026-10-14): full screen on the first visit, a short splash on later visits that leaves by itself, «?» reopens the full one, «Начать» is active from the first frame with the brain's progress under it; text block on the left with the dish visible, ~40 words, voice "about the fly", not about science.

## Brief

1. **Job & audience.** A curious visitor from a video or post (laptop or phone, 1–3 min, has never heard the word "connectome") opens the bare link. Today the screen stays black until ~1.8 MB of JS arrives, then the dish shows up with nothing to explain it, and the live brain (graph-full, 38 MB) loads into the worker with no progress. They need to know what this is, what they can do, and how, in about 15 s. Mode: **Experience** with a thin **Persuade** layer. The live dish is the hero and the text explains it.
2. **Outcome & proof.** The visitor reads one screen, presses «Начать» and lands on onboarding step 1 with the brain loading or already loaded. Proof is the thing itself: the fly is already alive behind the text, and the number (176 000, same as `tour.narr.2`) and the credit are the dataset's own.
3. **Direction.** No new visual language: void, Inter display at −0.04em, one violet pill, Geist Mono for the progress number. Structural thesis: **a caption to a living specimen**. The text sits in the left column over a left-edge scrim, and the arena stays bright on the right. Focal moment: the headline next to the moving fly. While loading, the progress line is the only thing that changes (principle 1: the show is the loading screen, never a spinner).
4. **Scope & boundaries.** One full screen and one short splash, desktop and phone, RU and EN. Anti-goals: no carousel or multi-step tour (onboarding already does that), no video, no illustration of the brain, no scroll on desktop, no "skip intro" chrome, no cookie-style bar, no claim the model doesn't back up ("the fly thinks", "artificial life"). The dish, card, palette and onboarding stay as built. The brain tour is untouched.
5. **States & ranges.** Brain bytes from 0 to 38 MB. On a fast line it is ready in ~2 s, on slow mobile in 30 s or more. The total size may be unknown (see §Open). There are three visit kinds: first, returning, and reopened via «?». Loading can fail. RU copy sets the widths (column ≤ 440 px).
6. **Interaction & layout.** See §Layout. «Начать» = Enter. Esc closes. On a first visit both start onboarding step 1. On a reopen via «?», «Начать» restarts onboarding and Esc just closes. The short splash leaves by itself, and any click or key skips it.
7. **Constraints & open decisions.** First paint before JS (10.3). ≤15 MB before first frame unchanged. `role="dialog" aria-modal`, focus on «Начать», contrast ≥ 4.5:1 over the brightest frame behind the column. Reduced motion means instant. 60 fps with the dish running behind. See §Open.

## Flow

```
bare link ─► index.html: void + wordmark (no white flash, 10.3)
           ─► welcome state (10.2):
                ?welcome=full|short|0                      wins
                snap · ?exp= · from=brain · view=brain     off
                fly_ui.welcomed set                        short
                else                                       full
full  ─ «Начать» / Enter / Esc ─► set fly_ui.welcomed ─► onboarding step 1 (if startOnb says so)
short ─ dish.cells ready and ≥ 1 s shown, or 4 s cap, or any click/key ─► gone (no onboarding; it is a returning visit)
«?» in the wordmark row ─► full ─ «Начать» ─► onboarding.restart()   (Esc ─► just close)
```

- **Onboarding waits for the welcome.** `startOnb` runs as today but its step 1 shows only after the welcome closes, so the card never fills under a scrim.
- **«Начать» before the brain is ready** is fine. Onboarding step 1 needs a bet first, and the card's pill then reads «готовлю мозг · 64 %» (today's `exp.loading` plus the percentage) until `dish.cells` arrives, so progress carries over from the welcome to the card.
- **Short splash cap: 4 s.** If the brain is not ready by then (a slow line, or a cache miss: GitHub Pages caches for ~10 min), the splash leaves anyway and the card's pill carries the percentage. A returning visitor is never held behind a splash.

## Layout

### Desktop 1600 × 900 — full

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░░                                                         │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░░                     · · ·⁘· ·                           │
│▓                             ▓▒▒▒▒▒░░░                    · hologram ·                         │
│▓  Настоящий мозг мухи        ▓▒▒▒▒▒░░░                                                         │
│▓                             ▓▒▒▒▒▒░░░          ╭──────────────────────────╮                   │
│▓  Дай ей повод — и смотри,   ▓▒▒▒▒▒░░░       ╭──╯                          ╰──╮                │
│▓  как она решает.            ▓▒▒▒▒▒░░░       │               ※               │                │
│▓                             ▓▒▒▒▒▒░░░       │          (fly, alive)         │                │
│▓  176 000 нейронов, каждую   ▓▒▒▒▒▒░░░       ╰──╮                          ╭──╯                │
│▓  связь разглядели под       ▓▒▒▒▒▒░░░          ╰──────────────────────────╯                   │
│▓  электронным микроскопом.   ▓▒▒▒▒▒░░░                                                         │
│▓  Модель на этих связях      ▓▒▒▒▒▒░░░                                                         │
│▓  и управляет мухой.         ▓▒▒▒▒▒░░░                                                         │
│▓                             ▓▒▒▒▒▒░░░                                                         │
│▓  1  Выбери, что дать мухе   ▓▒▒▒▒▒░░░                                                         │
│▓     и что поменять в мозге  ▓▒▒▒▒▒░░░                                                         │
│▓  2  Угадай, что она сделает ▓▒▒▒▒▒░░░                                                         │
│▓  3  Запусти и сравни        ▓▒▒▒▒▒░░░                                                         │
│▓     с нормой                ▓▒▒▒▒▒░░░                                                         │
│▓                             ▓▒▒▒▒▒░░░                                                         │
│▓  ( НАЧАТЬ )                 ▓▒▒▒▒▒░░░                                                         │
│▓  загружаем мозг · 42 %      ▓▒▒▒▒▒░░░                                                         │
│▓  ━━━━━━━━━━──────────────   ▓▒▒▒▒▒░░░                                                         │
│▓                             ▓▒▒▒▒▒░░░                                                         │
│▓  fly_ui        RU / EN      ▓▒▒▒▒▒░░░                               male-cns v1.0 · Janelia FlyEM│
└────────────────────────────────────────────────────────────────────────────────────────────────┘
  ▓ void ~0.85   ▒░ gradient to 0 by ~45 % of the width
```

- **Column.** Left gutter matches the palette's (same x), ≤ 440 px, vertically centred as a block. Hierarchy: headline `text-heading-sm` 400 −0.04em bone. Lede `text-body` bone. What-it-is `text-label` mist. Steps `text-label` bone with Geist Mono numbers in ash. Pill (violet, the view's only one). Progress line `text-caption` mono ash. A 1 px hairline, as wide as the pill row, bone 15 % track with a bone fill.
- **Behind.** The dish boots as it does today (arena, fly wandering, whatever the hologram shows while cells arrive), with no new scene work. Palette and card are hidden (`inert`, opacity 0) while the full welcome is open, so the column is the only UI on screen. They fade in as it leaves. The wordmark row is replaced by the column's own footer (wordmark + `LangSwitch`). `Credit` stays bottom right.
- **Scrim.** A horizontal gradient, void ~0.85 under the column fading to 0 by ~45 % of the width, plus the panel's backdrop blur only under the column. The arena keeps its full brightness. Contrast is checked against the brightest dish frame.

### Desktop — short splash (returning visit)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (dish booting, void ~0.6) ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Настоящий мозг мухи  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   загружаем мозг · 87 %  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ━━━━━━━━━━━━━━━━━━──  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Centred: headline (`text-heading-sm`), then the progress line and hairline. No pill, no steps. It is not a dialog: `role="status"`, no focus trap. Any click or key dismisses it, and the click does not pass through to the dish.

### Phone 390 × 844 — full

```
┌──────────────────────────────┐
│        · ⁘ hologram ⁘ ·      │
│    ╭──────────────────╮      │   dish keeps its phone framing,
│  ╭─╯        ※         ╰─╮    │   bright (upper ~40 %)
│  ╰─╮                  ╭─╯    │
│    ╰──────────────────╯      │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   gradient bottom → top
│▓ Настоящий мозг мухи         │
│▓ Дай ей повод — и смотри,    │
│▓ как она решает.             │
│▓ 176 000 нейронов… мухой.    │   (full text, wraps)
│▓ 1 Выбери, что дать мухе…    │
│▓ 2 Угадай, что она сделает   │
│▓ 3 Запусти и сравни с нормой │
│▓ (          НАЧАТЬ         ) │   full-width pill, h-8 (48 px), thumb zone
│▓ загружаем мозг · 42 %  ━━── │
│▓ RU/EN     male-cns · CC BY  │
└──────────────────────────────┘
```

- One column, bottom-anchored, 16 px gutters, safe-area aware. Headline drops to ~32 px (between `text-body` and `heading-sm`, clamp). Scrim is a vertical gradient (void 0 at ~35 % height → ~0.9 under the text).
- **390 × 700:** the what-it-is line goes to `text-caption`, and the steps keep one line each where RU allows. If it still overflows, the text block scrolls inside itself above a pinned pill + progress row (same `useMore` fade as the card). The pill is never pushed off-screen.
- **Short splash on phone:** as desktop, centred, headline ~32 px.

## Progress & states

| state | progress line (RU / EN) | hairline | pill |
|---|---|---|---|
| bytes, total known | «загружаем мозг · 42 %» / «loading the brain · 42%» | fill = loaded/total | «Начать», active |
| bytes, total unknown | «загружаем мозг…» / «loading the brain…» | hidden | active |
| ready (`dish.cells` set) | «мозг готов» / «brain ready» | full, then fades out in 300 ms | active |
| failed (worker fetch / decode error) | «мозг не загрузился» + ghost «ещё раз» (reload) / «the brain didn't load» + «try again» | hidden | active (the dish still runs, the card keeps its disabled pill) |
| reopened via «?», already ready | «мозг готов» | hidden | «Начать» = restart onboarding |

- The percentage is an integer, never above 99 until `dish.cells` (bytes done ≠ graph decoded), then switches to «мозг готов». No easing on the number. The hairline follows with `transform: scaleX` at 150 ms linear so it doesn't jump.
- The card's pill after the welcome closes: «готовлю мозг · 64 %» / «preparing the brain · 64%» (extends `exp.loading`).

## Motion

Per `animate`: one entrance, one exit, nothing loops.

- **Full, enter** (after first paint, as soon as React mounts): the scrim is already there from the inline first paint (10.3), so it never fades in. Column items fade in with an 8 px rise, 240 ms `--ease-out`, staggered 40 ms (headline → lede → what → steps → pill + progress), all done by ~400 ms. The dish needs no entrance.
- **Full, exit** («Начать»/Esc): the column fades out over 180 ms `--ease-out` (no movement), then the scrim fades over 300 ms. Palette and card fade in over 240 ms starting at the scrim's midpoint. Focus moves to onboarding step 1's first bet chip, or the card's first control.
- **Short, exit:** the whole splash fades over 300 ms `--ease-out`. On skip, the same fade starts from the current frame.
- **Ready:** the progress text crossfades over 150 ms. Nothing celebrates; the brain being ready is a state, not a reward.
- **Interrupts:** pressing «Начать» during the entrance jumps straight to the exit from the current opacities.
- **Reduced motion:** no rise, no stagger, no crossfades; appear and disappear instantly. The hairline still moves, because it carries information.

## Copy

| key | RU | EN |
|---|---|---|
| `welcome.title` | Настоящий мозг мухи | A real fly's brain |
| `welcome.lede` | Дай ей повод — и смотри, как она решает. | Give her a reason — and watch her decide. |
| `welcome.what` | {n} нейронов, каждую связь разглядели под электронным микроскопом. Модель на этих связях и управляет мухой. | {n} neurons, every connection traced under an electron microscope. A model running on that wiring drives the fly. |
| `welcome.step.1` | Выбери, что дать мухе и что поменять в мозге | Pick what the fly gets and what to change in her brain |
| `welcome.step.2` | Угадай, что она сделает | Guess what she'll do |
| `welcome.step.3` | Запусти и сравни с нормой | Run it and compare with the norm |
| `welcome.start` | Начать | Start |
| `welcome.loading` | загружаем мозг · {pct} % | loading the brain · {pct}% |
| `welcome.loadingAny` | загружаем мозг… | loading the brain… |
| `welcome.ready` | мозг готов | brain ready |
| `welcome.failed` | мозг не загрузился | the brain didn't load |
| `welcome.retry` | ещё раз | try again |
| `exp.loadingPct` | готовлю мозг · {pct} % | preparing the brain · {pct}% |
| `onb.again` (the «?» label, changed) | Что это и как играть | What is this and how to play |

- RU ≈ 44 words, EN ≈ 46. `{n}` = `num(176000)` (NBSP in RU). The «ничего не меняем» case stays implicit: step 1 says "what to change", and onboarding then shows the none / off pair.
- What isn't on the screen (switching a neuron off/on, the slow-mo replay, looking inside the brain) is shown by onboarding steps 2–4 and the «заглянуть в мозг» link; the welcome doesn't list it.
- Honesty: "Модель на этих связях" names the simulation as a model (principle 3). No "живой мозг", no "she thinks".

## What changes

| today | Phase 10 |
|---|---|
| Black page until ~1.8 MB JS | inline void + wordmark in `index.html`, the welcome as soon as React mounts (10.3 may lazy-load `App`) |
| Onboarding boots with the dish | waits for the welcome to close |
| «?» = restart onboarding | opens the full welcome; «Начать» there restarts onboarding |
| Card pill «готовлю мозг…» with no number | «готовлю мозг · N %» while the brain streams |
| No brain progress anywhere | worker streams bytes → `dish.loading` (10.2) |

## Open (for 10.2–10.4)

- **Gzip makes Content-Length wrong.** If GitHub Pages serves graph-full with `Content-Encoding: gzip`, `Content-Length` is the compressed size, but the stream reader counts decoded bytes, so the percentage would pass 100. 10.2 should take the total from the manifest (the decoded byte size, if the manifest has it, otherwise add it in `packages/data`), and use Content-Length only when there is no encoding. Unknown → `welcome.loadingAny`.
- **Lazy split (10.3).** If the main chunk is > ~300 KB, `main.tsx` renders `Welcome` first and lazy-loads `App`/`Dish`. The inline first paint in `index.html` must then match the welcome's scrim and wordmark position, so nothing jumps on mount.
- **Phone 700 tall.** Check that the full text fits without the inner scroll; if it doesn't, cut `welcome.what` to its first sentence on short screens only.
- **Short splash cap (4 s)** is proposed here, not a user decision. Change it if the "leaves when ready" reading was meant literally.
