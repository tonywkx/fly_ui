# TOUR — first-visit onboarding (Phase 7 brief)

Approved copy + layout for 7.1–7.6. Copy tables are the source for `i18n/{ru,en}.ts`; key names are suggestions. RU is default, addresses the viewer as «ты», lively but not cute. Cell-type names never translate.

## Brief

1. **Job & audience.** Curious non-scientists from a video / Habr post, laptop or phone, 1–3 min, no idea what a connectome is. They need: what am I looking at → make it do something → break it → I get it.
2. **Outcome & proof.** In ~60 s they can say "that's a fly's nervous system; a shadow made it jump; switching off one neuron stopped the jump". Proof is the real thing: the actual run (¼×), the actual DNp01 silenced, the FlyCam showing the jump / no jump.
3. **Direction.** Inside the established world (DESIGN.md / PRODUCT.md): the scene is the hero, text is sparse and floats on black. One step card, one violet pill per step, everything else ghost. The focal moment is the contrast between step 2 (jump) and step 3 (no jump) — both use the same camera, FlyCam large, same captions slot, so the difference is the only thing that changes.
4. **Scope & boundaries.** Escape only. Sugar / Song get a one-line "what to watch" card, no tour. Instrument HUD (legend, toolbar, timeline, inspector, scopes) is hidden during steps 0–3 and fades back on step 4. Untouched: the intro particle assembly, camera intro, scene look. Anti-goals: no modal over the scene, no arrows/coach marks pointing at buttons, no textbook paragraphs, no mascot tone, no confetti.
5. **States.** First visit (auto-start) · skipped (seen-flag set, normal app) · restarted via "?" · `?tour=0` off · `?tour=<1..4>` jump to step · `snap=1` → off unless `tour=` given · live switch slow → "preparing" line · reduced motion → opacity-only, no camera moves · phone → same steps, no tools, step 4 shortened.
6. **Interaction & layout.** Desktop: title + scenario stay bottom-left; step card bottom-centre where toolbar/timeline sit (they are hidden, so the slot is free); captions keep their slot under it; FlyCam grows top-right (~2× current). Phone: card replaces the ViewerBar at the bottom (ViewerBar returns after the tour); FlyCam as a wide strip at the top during steps 2–3. Skip is always one tap away (top-right ghost on desktop, inside the card on phone). Card text changes crossfade ≤200 ms; card never moves between steps.
7. **Constraints & open decisions.** RU strings run ~20–30 % longer than EN — card width is set by RU. Numbers via `Intl.NumberFormat` (RU: `176 000` with NBSP). Plural via `Intl.PluralRules`. Open for 7.3: if the live switch takes > ~3 s the "preparing" line shows inside the card; if unacceptable on phones → baked GF-silenced variant. Finish = restore the default baked escape, paused at t=0 (the broken state is not kept; "Silence" in the cheat sheet tells them how to redo it).

## Steps

Step counter `1 / 4` (mono, dim) sits at the top of the card for steps 1–4. Step 0 has no card.

### 0 · Narration (while loading)

Lines fade in one at a time over the assembling dust, bottom-centre, display type, ~2.5 s each; the last one holds until ready. Ready + last line shown → step 1. Skip (ghost) visible from the start.

| key | RU | EN |
|---|---|---|
| `tour.narr.1` | Это нервная система плодовой мушки. | This is the nervous system of a fruit fly. |
| `tour.narr.2` | 176 000 нейронов. Каждое соединение нанесено на карту под электронным микроскопом. | 176,000 neurons. Every connection mapped under an electron microscope. |
| `tour.narr.3` | Всё, что ты увидишь, работает на настоящей проводке. | Everything you'll see runs on the real wiring. |

### 1 · What you see

Paused at t=0. Three anatomy labels in 3D (thin leader line to the shell centre, label text in the void beside it). Count line under the body (mono number).

| key | RU | EN |
|---|---|---|
| `tour.see.title` | Что перед тобой | What you're looking at |
| `tour.see.body` | Каждая точка — нейрон. Сигнал идёт от глаз через мозг вниз, к ногам и крыльям. | Every dot is a neuron. Signals run from the eyes, through the brain, down to the legs and wings. |
| `tour.see.count` | {n} из 176 000 нейронов участвует / участвуют в этом опыте | {n} of 176,000 neurons take part in this run |
| `tour.label.optic` | Глаза и зрительные доли | Eyes & optic lobes |
| `tour.label.brain` | Центральный мозг | Central brain |
| `tour.label.vnc` | Нервная цепочка → ноги, крылья | Nerve cord → legs & wings |
| `tour.label.*Short` (phone) | Глаза · Мозг · Нервная цепочка | Eyes · Brain · Nerve cord |
| pill `tour.see.cta` | Напугай муху | Scare the fly |

`tour.see.count` RU verb by `PluralRules('ru')`: `one` → «участвует», else «участвуют» (1 251 → участвует, 1 254 → участвуют).

### 2 · Scare the fly

Pill press → card collapses to its title line; shadow looms; run plays once at ¼× (≈4 s), FlyCam large; captions run in their slot (plain-language, see below). At the end (takeoff or `byMs` timeout) the card expands with the result.

| key | RU | EN |
|---|---|---|
| `tour.scare.running` | Смотри на муху справа ↗ | Watch the fly, top right ↗ |
| `tour.scare.title` | Взлёт за {ms} мс | Takeoff in {ms} ms |
| `tour.scare.body` | Тень → глаза → один «нейрон паники» → мышца прыжка. Это быстрее, чем моргнуть. | Shadow → eyes → one "panic neuron" → jump muscle. Faster than a blink. |
| ghost `tour.again` | Ещё раз | Again |
| pill `tour.scare.cta` | Теперь сломай её | Now break it |

Phone `tour.scare.running`: «Смотри на муху вверху ↑» / "Watch the fly up top ↑".

### 3 · Now break it

Card first shows the setup; pill silences every DNp01 (both turn grey, camera does not move), then replays the shadow automatically at ¼×.

| key | RU | EN |
|---|---|---|
| `tour.break.title` | Выключи нейрон паники | Switch off the panic neuron |
| `tour.break.body` | Их всего два — по одному на сторону («гигантские волокна»). Что будет без них? | There are only two, one per side (the "giant fibers"). What happens without them? |
| pill `tour.break.cta` | Выключить и напугать | Silence and scare |
| `tour.preparing` | Готовлю весь мозг… | Waking up the whole brain… |
| `tour.break.running` | Нейрон паники выключен · DNp01 | Panic neuron off · DNp01 |
| `tour.broken.title` | Муха не взлетела | No takeoff |
| `tour.broken.body` | Глаза видят тень, но команды «прыгай» нет. Настоящая муха улетела бы запасным путём — в модели его нет. | The eyes see the shadow, but there's no "jump" command. A real fly would still leave by a backup route — the model doesn't have it. |
| ghost `tour.again` | Ещё раз | Again |
| pill `tour.broken.cta` | Дальше | Next |

### 4 · Your turn (cheat sheet)

HUD fades back in; silencing is undone (default baked escape, paused at t=0). Card becomes a compact key list; closes on the pill, Esc, or the first tool use.

| key | RU | EN |
|---|---|---|
| `tour.end.title` | Теперь сам | Your turn |
| `tour.end.select` | V · Выбор — наведи на нейрон, узнай, кто это | V · Select — hover a neuron to see what it is |
| `tour.end.stim` | S · Стимул — заставь нейрон стрелять | S · Stimulate — make a neuron fire |
| `tour.end.silence` | X · Заглушить — выключи нейрон | X · Silence — switch a neuron off |
| `tour.end.probe` | E · Электрод — смотри напряжение | E · Electrode — watch its voltage |
| `tour.end.play` | Пробел — пауза · [ ] — скорость · ⌘K — поиск | Space pause · [ ] speed · ⌘K search |
| `tour.end.more` | Ещё опыты: | More runs: |
| link `tour.end.sugar` | Сахар → | Sugar → |
| link `tour.end.song` | Песня → | Song → |
| pill `tour.end.cta` | Начать | Start |

Phone step 4 (no tools): title + `tour.end.phone` «Инструменты — на компьютере: стимулируй, выключай, ставь электроды.» / "On a computer you can stimulate, silence and probe neurons yourself." + Sugar / Song links + pill «Готово» / "Done".

### Chrome

| key | RU | EN |
|---|---|---|
| `tour.skip` | Пропустить | Skip |
| `tour.restart` (aria + tooltip on "?") | Показать тур заново | Replay the tour |
| `tour.step` | {i} / {n} | {i} / {n} |
| `lang.switch` (aria) | Язык интерфейса | Interface language |
| `lang.ru` / `lang.en` | RU / EN | RU / EN |

## "What to watch" cards (Sugar, Song)

Shown once per scenario per visit, bottom-centre (desktop) / above the ViewerBar (phone), dismissed by Play or ×. One ghost × only — the pill stays "Play".

| key | RU | EN |
|---|---|---|
| `watch.sugar` | Сахар на хоботке. Смотри, как вкус доходит до мотонейрона — и муха тянет хоботок к еде. | Sugar on the proboscis. Watch the taste reach a motor neuron — and the fly reaches out to feed. |
| `watch.song` | Включаем у самца «желание ухаживать». Смотри, как команда спускается в грудь — и крыло начинает петь. | We switch on the male's courtship drive. Watch the command travel down to the thorax — and a wing starts to sing. |

## Captions (7.2)

Format: human phrase + term as a small mono suffix after `·` (term = the dataset's name, never translated). `missing` keeps today's `byMs`.

| beat | RU | EN | term |
|---|---|---|---|
| escape 1 | Тень надвигается — глаза замечают | Shadow looming — the eyes notice | LC4, LPLC2 |
| escape 2 | Нейрон паники бьёт тревогу | Panic neuron fires | DNp01 |
| ↳ missing | Нейрон паники молчит | Panic neuron silent | DNp01 |
| escape 3 | Команда дошла до мышцы прыжка | The jump muscle gets the command | TTMn |
| escape 4 | Взлёт | Takeoff | {ms} мс / ms |
| ↳ missing | Взлёта нет | No takeoff | — |
| sugar 1 | Хоботок чувствует сахар | The proboscis tastes sugar | LB3 |
| sugar 2 | Вкусовой центр подхватывает | The taste centre takes it up | GNG |
| sugar 3 | Команда «ешь» | Command to feed | MN9 |
| ↳ missing | Команды «ешь» нет | No command to feed | MN9 |
| sugar 4 | Хоботок тянется к еде | Proboscis extends | {ms} |
| ↳ missing | Хоботок не двинулся | No proboscis extension | — |
| song 1 | Включается желание ухаживать | Courtship drive switches on | P1 (pC1) |
| song 2 | Команда «пой» уходит в грудь | Song command heads to the thorax | pIP10 |
| ↳ missing | Команды «пой» нет | No song command | pIP10 |
| song 3 | Мышцы крыла получают сигнал | Wing muscles get the signal | wing MN |
| song 4 | Крыло дрожит — это песня | The wing vibrates — that's the song | {ms} |
| ↳ missing | Песни нет | No song | — |

## Wireframes

`░` = scene (3D, untouched). Desktop 1600×1000, phone 390×844. Only step 0 and 2 are full; other steps list the delta.

### Desktop · step 0 (narration)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                            Skip      │
│                                                                                      │
│                         ░░░░░░  dust assembling  ░░░░░░                              │
│                      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                            │
│                         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                               │
│                                                                                      │
│                    176 000 нейронов. Каждый провод нанесён                           │
│                    на карту под электронным микроскопом.        ← display, 2 lines   │
│                                                                                      │
│ fly_ui                                                                               │
│ Бегство                                                  male-cns v1.0 · CC BY 4.0   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Desktop · step 2 (after the run)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                     Skip  ┌─────────────────────┐    │
│                                                           │                     │    │
│            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             │   FlyCam  ×2        │    │
│        ░░░░░ optic ░░░░░░ brain ░░░░░░ optic ░░░░░        │   (fly mid-jump)    │    │
│            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             │                     │    │
│                     ░░░░ nerve cord ░░░░                  │ Поведение  взлёт 30 │    │
│                                                           └─────────────────────┘    │
│                     ┌──────────────────────────────────────┐                         │
│                     │ 2 / 4                                │                         │
│                     │ Взлёт за 29,7 мс                     │  ← card, ~32rem, panel  │
│                     │ Тень → глаза → один «нейрон паники»  │                         │
│                     │ → мышца прыжка. Это в разы быстрее,  │                         │
│                     │ чем ты моргаешь.                     │                         │
│                     │  Ещё раз        ( Теперь сломай её ) │  ← ghost + violet pill  │
│                     └──────────────────────────────────────┘                         │
│ fly_ui                       Взлёт  29.7 ms                    ← captions slot       │
│ Бегство                                                  male-cns v1.0 · CC BY 4.0   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Deltas: **step 1** — no FlyCam; three anatomy labels with leader lines on the brain (`Глаза и зрительные доли` left of an optic lobe, `Центральный мозг` above, `Нервная цепочка → ноги, крылья` below the cord); card = title, body, mono count line, pill «Напугай муху». **Step 2 running** — card shrinks to `2 / 4 · Смотри на муху справа ↗`, captions tick under it. **Step 3** — same frame as step 2; DNp01 pair grey; card shows `Готовлю весь мозг…` if needed, then the result «Муха не взлетела»; FlyCam shows the fly staying put. **Step 4** — legend, toolbar, timeline fade back; card moves nothing, grows to the key list (two columns: key mono, text), Sugar → / Song → as text links, pill «Начать».

### Phone · step 2 (after the run)

```
┌──────────────────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ FlyCam strip (fly mid-jump)  │ │
│ └──────────────────────────────┘ │
│        Взлёт  29.7 ms            │ ← captions slot (top, as today)
│                                  │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│ ░░░░░░░░ brain ░░░░░░░░░░░░░░░   │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│          ░░░ cord ░░░            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 2 / 4                Skip    │ │
│ │ Взлёт за 29,7 мс             │ │
│ │ Тень → глаза → один «нейрон  │ │
│ │ паники» → мышца прыжка.      │ │
│ │ Ещё раз  ( Теперь сломай её )│ │
│ └──────────────────────────────┘ │ ← replaces the ViewerBar
│ male-cns v1.0 · CC BY 4.0        │
└──────────────────────────────────┘
```

Phone deltas: **step 0** — narration lines centred over the dust, `fly_ui` wordmark as today, Skip top-right. **Step 1** — labels shortened to `Глаза` / `Мозг` / `Нервная цепочка` (full names don't fit at 390), no FlyCam strip. **Step 3** — as step 2. **Step 4** — `tour.end.phone` line + Sugar / Song links + pill «Готово»; then the ViewerBar returns.
