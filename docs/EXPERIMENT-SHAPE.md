# EXPERIMENT — shape (Phase 9 brief)

Approved look, flow and copy for 9.3–9.8. Builds on [TERRARIUM-SHAPE.md](TERRARIUM-SHAPE.md) (world, items, hands, operations stay as built in Phase 8) and the RU glossary in DECISIONS (2026-10-10). Behaviour numbers come from the norm table (9.2); every `{ms}` / `{hz}` below is filled from it or from the live run, never hard-coded. Copy keys are suggestions. RU default, «ты», the fly is «она», the courting male «он».

## Brief

1. **Job & audience.** A curious laptop visitor from a video/post (1–3 min, no idea what a connectome is) lands on the Terrarium as the home page. Today they meet five competing modes (items, hands, Remote, Neurosurgeon, puzzles) and no structure. They need one obvious thing to do within seconds. Mode: **Operate** around an **Experience** (the arena leads; the card is the instrument).
2. **Outcome & proof.** The visitor completes one experiment unaided: they pick what the fly gets and what we change in her brain, bet on what she'll do, watch, see "normally → now" side by side, replay the decision in slow motion and get a discovery. Proof stays the live connectome: verdicts are the run's own numbers; the normal row comes from the baked norm table (9.2).
3. **Direction.** Same world, no new visual language: void, glass arena, hologram, saffron decision thread, one violet pill per view. Structural thesis: **a lab protocol card** on the right (slots read like a sentence: *give → change → bet → run*) beside the arena. Focal moment 1: the result headline («Не взлетела») with the normal row above it. Focal moment 2: the slow replay where the thread of light runs eye → brain → legs.
4. **Scope & boundaries.** Home = Terrarium; the brain view becomes "look inside" (9.7). Anti-goals: no score, lives, timers or streaks; no modal over the arena; no coach-marks or arrows (onboarding lives in the card); no "wrong answer" shame (a missed bet is interesting, not a failure); no new item or operation; aiming is never needed for an experiment.
5. **States & ranges.** 6 stimuli (+ «ничего» if 9.2 keeps it) × 5 brain states (none + 4 ops) = 30–35 pairs; ~10–12 are discoveries. Bet: 3 choices, asked only on the first run of a pair. Discoveries 0–12. Brain-view operations may coexist (shown as one line, as today's `op.brain`).
6. **Interaction & layout.** See §Layout, §Card. A click fills a slot; a drag (items and hands alike) is free play, as today. One operation per experiment (the slot), so the comparison stays readable.
7. **Constraints & open decisions.** 60 fps with live sim + replay buffer; ≤15 MB before first frame (the norm table is tiny); RU sets widths (card ~340 px); reduced motion honoured; phone at 390 is a first-class target (9.8). Open: see §Open.

## The loop

```
 give ──► change ──► bet* ──► run ──► result (normally → now) ──► replay ──► discovery
  ▲  palette click    op list   3 choices   clean arena,   same card,         slow-mo,      counter ticks,
  │  or slot          in card    (*first    scripted       verdict +          thread,       entry in the grid
  │                              run of     delivery       your bet           caption
  └───────────────── «Новый опыт» / «Ещё раз» / «Повторить опыт» from a discovery ──────────────┘
```

- **A run is a clean take.** «Запустить» clears the arena (items, hands, puppet keys let go), puts the fly at the start pose, applies the op, then delivers the stimulus by script. Free-play objects are not restored after the run (the arena stays as the run left it; «Очистить арену» as today).
- **Scripted delivery** (no aiming; exact geometry in 9.3): sugar / bitter dropped ~2.5 mm ahead of the fly; banana placed at the far rim; female placed ~4 mm ahead, circling; shadow sweeps in from the fly's left by itself; swatter swings at the fly and lands at a fixed sim time (~120 ms after the loom starts, as in free play). Run ends at the first decision + a short tail, or at a timeout (9.2 sets it).
- **Free play stays.** Drag items onto the arena, drag a hand out to hold it, hold Remote keys: the fly lives and the decision caption appears as today. Free play never fills the card's result and never unlocks a discovery; the card's «сейчас» row ignores it.
- **The op is live state, not a run-only setting.** Choosing an op in the slot applies it to the fly immediately (hologram mark, as Phase 8), so free play uses it too. «Ничего не меняем» = all four ops off. Brain-view edits stay separate and show as one line under the op slot.
- **Bet only the first time.** The first run of a pair asks «Что она сделает?» (3 choices); «Запустить» unlocks once a choice is made. Later runs of the same pair go straight to running; the result then shows the old bet greyed.
- **Discovery for doing it.** Running a listed pair once unlocks it, whatever the bet. The bet is written into the entry as «прогноз: взлетит» (gender-neutral; no «ты думал»).

## Layout

### Desktop 1600 × 900 — home, setup

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                │
│                         замедление ×6 · 0,412 с · идёт                                         │
│                                                                                                │
│  ПОЛОЖИТЬ                          · · ·⁘· ·                    ОПЫТ   ·  Открытия 3/12        │
│                                   · hologram ·                 ┌───────────────────────────┐   │
│  ◆ Сахар           1               · ·⁘·· ·                    │ ЧТО ДАЁМ МУХЕ             │   │
│    остановится и поест                                         │ ⟋ Мухобойка             ▾ │   │
│  ◇ Горечь          2         ╭──────────────────────╮          │ ударит рядом с мухой      │   │
│    попятится              ╭──╯                      ╰──╮       │                           │   │
│  ≋ Банан           3      │                            │       │ ЧТО МЕНЯЕМ В МОЗГЕ        │   │
│    пойдёт на запах        │           ※ fly            │       │ ● Нейрон бегства        ▾ │   │
│  ♀ Самка           4      │                            │       │ выключить · DNp01         │   │
│    он начнёт ухаживать    ╰──╮                      ╭──╯       │                           │   │
│                              ╰──────────────────────╯          │ ЧТО ОНА СДЕЛАЕТ?          │   │
│  НАПУГАТЬ                                                      │ (взлетит) (замрёт)        │   │
│  ◐ Тень            5                                           │ (ничего не заметит)       │   │
│    взлетит                                                     │                           │   │
│  ⟋ Мухобойка  ◉    6                                           │ ( ЗАПУСТИТЬ )             │   │
│    взлетит до удара                                            └───────────────────────────┘   │
│                                                                                                │
│  ещё ▾                       клик — в опыт · перетащи — на арену                               │
│                                                                                                │
│  fly_ui  · заглянуть в мозг   RU / EN   ?                  male-cns v1.0 · Janelia FlyEM · CC BY│
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Palette (left, no panel).** Two groups as now («Положить / Напугать»). Each row: glyph + name + dim mono hotkey, and a second line in ash: *what the normal fly does* (from the norm table, 9.2). The row in the stimulus slot gets a saffron dot `◉` («в опыте»). Click / key = fill the stimulus slot. Drag = free play (items to the arena; a hand dragged out becomes the cursor tool, the row reads «в руке · Esc»). «ещё ▾» at the bottom reveals «Пульт» (today's puppet group, unchanged).
- **Hint line** bottom-centre while the arena is empty and no run happened: «клик — в опыт · перетащи — на арену». It sits in the decision-caption slot, which takes over after the first encounter.
- **Card (right).** Translucent panel (`--color-panel`, blur, 24 px radius), ~340 px wide, top aligned with the palette top (fixes the 8.15 ui-critic P2). Header = two ghost-word tabs «Опыт · Открытия 3/12» (active bone, inactive ash); the counter *is* the "counter in the top line". The arena keeps `frameBand` between palette and card.
- **Wordmark row.** «Мозг · Террариум» switch becomes one ghost link «заглянуть в мозг» (9.7). The `?` opens the onboarding again.

### Experiment card — states

Desktop width; the phone uses the same blocks stacked (see §Phone).

**1 · Setup** (slots empty on a return visit; prefilled on first visit, see §First visit)

```
 ЧТО ДАЁМ МУХЕ
 — выбери слева или здесь ▾
 ЧТО МЕНЯЕМ В МОЗГЕ
 Ничего, обычная муха      ▾
                                 ( ЗАПУСТИТЬ )  ← disabled until a stimulus is set
```

- Each slot is a ghost select. Stimulus picker = the six palette rows (name + "what she does"). Op picker = today's Neurosurgeon list in place: name, mono term, `role` line, source chip (`из коннектома` / `предположение`); the chosen op shows «выключить» / «включить» under its name. «Ничего, обычная муха» on top. Today's open-card `fact` moves into the picker row (expanded on hover/focus) and into the discovery entry.
- One line under the op slot when the brain view changed cells: «+ в мозге: выключено 2, включено 0» (reuses `op.brain.cells`).

**2 · Bet** (first run of the pair only; same card, appears under the slots)

```
 ЧТО ОНА СДЕЛАЕТ?
 ( взлетит )  ( замрёт )  ( ничего не заметит )
                                 ( ЗАПУСТИТЬ )
```

- Three outline chips (tag radius 9999, bone hairline), one choice; choosing lights it saffron-outline. Choices per pair come from 9.2 (always includes the true normal and the true operated outcome, plus one plausible distractor; order fixed per pair, not shuffled, so a share link reproduces it).
- Subject follows the stimulus: «Что он сделает?» for the female (the courting male).

**3 · Running**

```
 ⟋ Мухобойка  ·  ● Нейрон бегства выкл.
 Опыт идёт · мухобойка ударит через 0,3 с
 ─────────────────────────── progress hairline (sim time / timeout)
                                          стоп
```

- Slots collapse to one summary line; no pill (the view's action is watching). Ghost «стоп» (Esc) aborts back to Setup, nothing recorded. Palette dims to 40 % and ignores drags during the run. Timecode + status word top-centre as today.

**4 · Result**

```
 НЕ ВЗЛЕТЕЛА                                   ← heading-2xs, bone; the outcome word of "now"
 обычно   взлетает через 8 мс · TTMn 227 Гц    ← norm table, ash
 сейчас   не взлетела · TTMn 44 Гц             ← this run, bone; mono numbers
 прогноз  взлетит · вышло иначе                ← or «взлетит · так и вышло»; greyed on repeat runs

 ✦ Открытие 4/12: без нейрона бегства муху можно прихлопнуть   ← only when it unlocks (saffron)

 ( ПОВТОР )                     ещё раз · новый опыт
```

- When now = normal: headline is the action itself («Взлетела»), the `сейчас` row says «так же, как обычно» in place of a second verdict. No "wrong" colour anywhere: the bet line is ash either way, «вышло иначе» is not red.
- «Повтор» (pill) plays the decision replay (§Replay); it auto-plays once after the visitor's **first** result ever, then waits for the click. «ещё раз» reruns the same pair (no bet). «новый опыт» returns to Setup with the slots kept.
- Free play after a result leaves the card as is; the next «Запустить» replaces it.

### Replay (9.5)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     ПОВТОР · замедление ×60 · 0,019 с                                          │
│                                                                                                │
│                                   · ·⁘·· hologram heat ·                                       │
│                                  ⁘ DNp01 ⁘ ──── thread                                         │
│                       ╭──────────────┆────────────╮                    ┌───────────────────┐   │
│                    ╭──╯              ┆            ╰──╮                 │ ПОЧЕМУ МУХА       │   │
│                    │        ⟋ shadow ※ fly           │                 │ ВЗЛЕТЕЛА?         │   │
│                    ╰──╮                           ╭──╯                 │ Тень слева        │   │
│                       ╰───────────────────────────╯                    │ LC4 → DNp01 → TTMn│   │
│                                                                        │ 3 мс   8 мс       │   │
│        ◀ ━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━ ▶   ‖                  │ сработало 9 из 11 │   │
│                                                                        │      ( ЗАКРЫТЬ )  │   │
│                                                                        └───────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- The arena replays the recorded ~1.5 sim s (fly pose, items, hands) at a much slower factor than live, with the hologram heat and the decision thread drawn at its real time; the camera holds its framing (no fly-through).
- The card shows the replay caption: today's `DishWhy` content (title, sense line, the cell path with timings, `сработало n из m`, the bypass / forced / Remote notes). The why-card as a separate popover goes away.
- Controls: one hairline scrubber + play/pause under the arena, Space toggles, ←/→ step. «Закрыть» (pill, the replay's only action) returns to Result. Palette hidden during replay.
- Reduced motion: no playback; the arena shows the decision frame frozen, the thread drawn whole, scrubber still works.

### Discoveries (9.6)

Second tab of the card («Открытия 3/12»):

```
 ОТКРЫТИЯ  3/12
 ┌──────────────────────────────┐
 │ ⟋ + ● DNp01 выкл.            │   found: stimulus glyph + op mark
 │ Без нейрона бегства муху     │   title, bone
 │ можно прихлопнуть            │
 │ не взлетела · TTMn 44 Гц     │   mono, ash
 │ прогноз: взлетит             │
 │ повторить опыт →             │
 └──────────────────────────────┘
 ┌──────────────┐ ┌──────────────┐
 │ ◆  ?         │ │ ♀  ?         │   locked: stimulus glyph + teaser (9.2)
 │ Пусть пройдёт│ │ Самка рядом, │
 │ по сахару…   │ │ а ему всё…   │
 └──────────────┘ └──────────────┘
```

- List of 12 tiles, 2 columns at card width; the open tile spans both. Found: what we did → what happened (this visitor's numbers from the run) → which cells, + `fact` from the op, «повторить опыт →» fills the slots and switches to the Опыт tab. Locked: stimulus glyph + a teaser (the four Phase 8 puzzle goals become the first four teasers) — never the answer.
- **Unlock moment:** the result line «✦ Открытие n/12 …» appears under the result; the ✦ travels to the tab counter and the counter ticks (exact motion per `animate` in 9.6; reduced motion = the line and counter just change). No sound, no confetti.
- All found: header line «Все 12. У каждого поведения свои клетки — и их можно выключить по одной.»
- Persisted in `fly_ui.found` (pair ids + bet + numbers of the first run). `?found=` is not a URL param (discoveries are personal); share links carry the experiment.

### First visit (onboarding, 9.7)

In the card itself, no overlay, no arrows; the palette and arena stay usable. `fly_ui.onboarded` set at step 4 or on «пропустить».

| step | card shows | what moves |
|---|---|---|
| 1 | Slots prefilled «Мухобойка» + «Ничего, обычная муха». Line: «Это опыт. Мухобойка ударит рядом с мухой. Что она сделает?» + bet chips. | Nothing pulses. The pill waits for the bet. |
| 2 | Result (normal: «Взлетела · через 8 мс»), replay auto-plays. Line: «Она увидела тень раньше удара. Теперь выключим ей один нейрон.» Pill: «Выключить нейрон бегства». | — |
| 3 | Op slot filled «Нейрон бегства · выключить» (the slot row glows once), bet chips again: «Та же мухобойка. Что теперь?» | Hologram marks DNp01. |
| 4 | Result «Не взлетела», unlock «✦ Открытие 1/12». Line: «Дальше — твои опыты: что дать мухе — слева, что поменять в мозге — здесь.» → ghost «понятно». | Counter ticks. |

- Ghost «пропустить» under steps 1–3; skipping leaves an empty Setup. `?` in the wordmark row replays the steps.
- Phone: the same four steps in the Опыт tab.

## Phone 390 × 844

```
 Опыт tab (setup / bet)            Result + replay                 Открытия tab
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│ fly_ui    заглянуть в мозг   │ │ ПОВТОР · ×60 · 0,019 с       │ │ fly_ui    заглянуть в мозг   │
│ замедление ×6 · 0,41 с · идёт│ │       ⁘ hologram ⁘           │ │ замедление ×6 · идёт         │
│        · ⁘ · hologram        │ │   ╭──────┆───────────╮      │ │     ╭──────────────╮         │
│   ╭──────────────────╮       │ │ ╭─╯      ※           ╰─╮    │ │   ╭─╯     ※        ╰─╮       │
│ ╭─╯        ※          ╰─╮    │ │ ╰─╮                  ╭─╯    │ │   ╰─╮              ╭─╯       │
│ ╰─╮                   ╭─╯    │ │   ╰──────────────────╯      │ │     ╰──────────────╯         │
│   ╰──────────────────╯       │ │ ◀ ━━━━━━━●━━━━━━━ ▶  ‖      │ │──────────────────────────────│
│──────────────────────────────│ │──────────────────────────────│ │ Опыт · Положить · Открытия 3 │
│ Опыт · Положить · Открытия 3 │ │ ПОЧЕМУ МУХА ВЗЛЕТЕЛА?        │ │ ┌────────────┐┌────────────┐ │
│ ДАЁМ   ⟋ Мухобойка        ▾  │ │ Тень слева                   │ │ │⟋+DNp01     ││◆ ?         │ │
│ МЕНЯЕМ ● Нейрон бегства   ▾  │ │ LC4 → DNp01 → TTMn · 8 мс    │ │ │Без нейрона ││Пусть пройдёт│ │
│ ЧТО ОНА СДЕЛАЕТ?             │ │ сработало 9 из 11            │ │ │бегства…    ││по сахару…  │ │
│ (взлетит) (замрёт)           │ │                              │ │ └────────────┘└────────────┘ │
│ (ничего не заметит)          │ │            ( ЗАКРЫТЬ )       │ │ ┌────────────┐┌────────────┐ │
│ ( ЗАПУСТИТЬ )                │ │                              │ │ │♀ ?         ││◇ ?         │ │
│ RU/EN  ?     male-cns · CC BY│ │ RU/EN  ?     male-cns · CC BY│ │ RU/EN  ?     male-cns · CC BY│
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

- Sheet tabs «Опыт · Положить · Открытия n» replace «Предметы · Нейрохирург · Кукла» (`DishSheet`), tabs ≥ 44 px tall (fixes the 8.15 P2). Sheet ≤ 42svh; the arena keeps gliding into the band above it.
- **Опыт:** slots as two compact rows (label left in caps, value right, ▾ opens the picker inside the sheet, replacing the card body; back = «готово»). Bet chips wrap. Result = headline + 3 rows + pill «Повтор» + ghosts in one line; on screens < 760 px tall the bet row hides on repeat runs and `fact` never shows.
- **Положить:** today's glyph grid with the "what she does" line under each name; tap = fill the stimulus slot and jump to Опыт; drag onto the arena = free play; swatter / shadow free play as today (tap / drag a finger on the arena after dragging the hand out). «ещё» → Пульт keys.
- **Replay:** the sheet shows the caption; the scrubber sits on the arena's bottom edge; tabs hidden until «Закрыть».
- **Открытия:** 2-column tiles, scroll inside the sheet; an open tile spans both columns.

## What goes, moves, hides

| today | Phase 9 |
|---|---|
| `DishLevels` puzzle strip (4 puzzles + hints) | gone. Puzzle 1 = onboarding; puzzles 2–4 = the first locked teasers in Открытия. `?level=` ignored. |
| Why-card popover (`DishWhy`, «почему?») | becomes the replay caption in the card; the «почему?» link on the decision caption opens the replay of the last *run* (free-play encounters keep the short caption only). |
| Neurosurgeon list (right column, multi-op toggles) | becomes the op-slot picker; one op at a time. Multi-cell editing stays in the brain view. |
| Puppet group in the palette | under «ещё ▾» as «Пульт»; unchanged otherwise. |
| `Мозг · Террариум` switch | «заглянуть в мозг» link + the fly zoom (9.7). |
| Tour into the brain | only on the first brain visit (9.7). |
| Decision caption bottom-centre | stays for free play; hint line uses its slot while the arena is empty. |

## States

| state | what the visitor sees |
|---|---|
| Loading | As Phase 8 (arena and hologram assemble from dust); card slots render immediately, pill disabled with «готовлю мозг…». |
| First visit | §First visit step 1. |
| Return visit | Setup with the last pair in the slots (from `fly_ui.found` / last run), no bet if already made. |
| Setup, no stimulus | Pill disabled; stimulus slot reads «— выбери слева или здесь». |
| Bet pending | Chips shown, pill disabled. |
| Running | §Card 3; palette dimmed; Esc = стоп. |
| Run timed out with no decision | Headline «Ничего не сделала» (or «не заметил» for the female); rows as usual. A valid result, not an error. |
| Result (same as normal / different) | §Card 4. |
| Replay | §Replay; reduced motion = frozen decision frame. |
| Discovery unlocked | Saffron line + counter tick. |
| All discoveries | Header line in Открытия; counter reads «12/12» in saffron. |
| Brain-view ops active | One line under the op slot; they apply to runs too (and the norm row then says «обычно (без операций)»). |
| Worker behind (slow-mo forced) | Timecode shows the real factor, as Phase 8; runs still deterministic (sim time, not wall time). |
| URL / snap | `?exp=swatter:panic` fills the slots (no bet asked, no auto-run); `?exp=…&run=1` runs it (snaps); `?tab=found`; `?onb=0..4` for snaps. Old `?view=dish`, `?items`, `?ops` keep working (9.7). |

## Copy

| key | RU | EN |
|---|---|---|
| `exp.tab` | Опыт | Experiment |
| `exp.found.tab` | Открытия {n}/{of} | Discoveries {n}/{of} |
| `exp.give` | Что даём мухе | What the fly gets |
| `exp.change` | Что меняем в мозге | What we change in her brain |
| `exp.give.empty` | — выбери слева или здесь | — pick on the left or here |
| `exp.op.none` | Ничего, обычная муха | Nothing — a normal fly |
| `exp.op.off` / `on` (under the op name) | выключить / включить | switch off / switch on |
| `exp.brainOps` | + в мозге: {cells} | + in the brain: {cells} |
| `exp.bet.she` / `he` | Что она сделает? / Что он сделает? | What will she do? / What will he do? |
| `exp.act.jump` / `eat` / `back` / `court` / `ignore` / `walk` / `freeze` | взлетит / поест / попятится / начнёт ухаживать / ничего не заметит / пройдёт мимо / замрёт | takes off / eats / backs off / courts / doesn't notice / walks past / freezes |
| `exp.run` (pill) | Запустить | Run |
| `exp.running` | Опыт идёт · {what} | Running · {what} |
| `exp.deliver.swatter` / `shadow` / `sugar` / `bitter` / `odor` / `female` | мухобойка ударит через {t} с / тень наползёт слева / сахар перед ней / горечь перед ней / запах у края / самка рядом | the swatter lands in {t} s / a shadow sweeps in from the left / sugar right ahead / bitter right ahead / smell at the rim / a female nearby |
| `exp.stop` | стоп | stop |
| `exp.usual` / `exp.now` | обычно / сейчас | normally / now |
| `exp.same` | так же, как обычно | same as normally |
| `exp.usual.noops` | обычно (без операций) | normally (no operations) |
| `exp.bet` | прогноз | your bet |
| `exp.bet.hit` / `miss` | {act} · так и вышло / {act} · вышло иначе | {act} · that's what happened / {act} · it went otherwise |
| `exp.none.she` / `he` | Ничего не сделала / Не заметил | She did nothing / He didn't notice |
| `exp.replay` (pill) | Повтор | Replay |
| `exp.again` | ещё раз | run again |
| `exp.new` | новый опыт | new experiment |
| `exp.replay.title` | Повтор · замедление ×{slow} · {t} с | Replay · slowed ×{slow} · {t} s |
| `exp.replay.close` (pill) | Закрыть | Close |
| `exp.unlock` | ✦ Открытие {n}/{of}: {title} | ✦ Discovery {n}/{of}: {title} |
| `exp.found.again` | повторить опыт → | repeat the experiment → |
| `exp.found.all` | Все {of}. У каждого поведения свои клетки — и их можно выключить по одной. | All {of}. Every behaviour has its own cells — and you can switch them off one by one. |
| `pal.inExp` (aria / tooltip on ◉) | в опыте | in the experiment |
| `pal.inHand` | в руке · Esc | in hand · Esc |
| `pal.more` | ещё | more |
| `pal.hint` | клик — в опыт · перетащи — на арену | click to use in the experiment · drag onto the arena |
| `pal.does.*` (second line; from the norm table) | остановится и поест · попятится · пойдёт на запах · он начнёт ухаживать · взлетит · взлетит до удара | stops and eats · backs off · heads for the smell · he starts courting · takes off · takes off before the hit |
| `view.peek` | заглянуть в мозг | look inside the brain |
| `onb.1` | Это опыт. Мухобойка ударит рядом с мухой. Что она сделает? | This is an experiment. The swatter will strike next to the fly. What will she do? |
| `onb.2` | Она увидела тень раньше удара. Теперь выключим ей один нейрон. | She saw the shadow before the hit. Now let's switch off one neuron. |
| `onb.2.pill` | Выключить нейрон бегства | Switch off the escape neuron |
| `onb.3` | Та же мухобойка. Что теперь? | Same swatter. What now? |
| `onb.4` | Дальше — твои опыты: что дать мухе — слева, что поменять в мозге — здесь. | Your turn: what the fly gets is on the left, what changes in her brain is here. |
| `onb.ok` / `onb.skip` | понятно / пропустить | got it / skip |

Discovery titles and teasers (12 + 12) are written in 9.2 with the list; the four puzzle goals (`level.*.goal`) seed the first teasers. Retired keys: `level.*`, `why.open`, `why.test`, `op.title` (kept only if the picker header needs it), `dish.hint.empty` / `dish.hint.tap`.

## Open (for 9.2+)

- **The 12 discoveries and their 3 bet choices** — picked from the norm table in 9.2 (pairs where the op changes the outcome, plus 2–3 "normal" pairs that teach the norm, e.g. sugar → eats).
- **Banana in the stimulus slot**: alone it never reaches a decision (TERRARIUM.md: no steering, decides only at a source). Either drop it from the slot (palette-only free play) or deliver it with sugar at the source. 9.2 decides from the table.
- **«Ничего» as a stimulus** for «Нейрон заднего хода · включить» (MDN on needs no stimulus): keep a «Ничего не даём» row, or have the op imply it. 9.2.
- **Run timeout and tail** (sim ms) — 9.2 from the latencies (sugar 22 ms … bitter 52 ms; the walk-in for sugar is scripted and longer).
- **Replay of the normal fly** («как было бы обычно») — needs a second recorded run; backlog with the ghost-of-the-norm trail unless 9.5 gets it cheap.
- **P1 on** as a fifth op (pIP10 188 Hz → courts with no female) — only if 9.2 shows it's robust; the slot design holds 5–6 ops.
