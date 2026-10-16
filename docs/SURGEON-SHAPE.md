# SURGEON — shape (Phase 11 brief)

Approved look, flow and copy for 11.2–11.7. Builds on [EXPERIMENT-SHAPE.md](EXPERIMENT-SHAPE.md) (card, slots, result rows), [WELCOME-SHAPE.md](WELCOME-SHAPE.md) and the RU glossary in DECISIONS. RU default, «ты», the fly is «она». Copy keys are suggestions. User decisions (2026-10-16): each op keeps its fixed action (no on/off switch, no new norm pairs); brain view default colour = region; on desktop the op list opens **over the card** (the card never changes size); hover lights the op's **brain region**, not traced cell shapes; the welcome scale line is the **poppy seed**; the slot holds **one** change (named op or brain picks); the neuron count in copy is **166 700**.

## Brief

1. **Job & audience.** The same visitor as the welcome: from a video or post, never heard "connectome", 1–3 min, laptop or phone. They have picked a stimulus and now meet «Что меняем в мозге». Today that slot is a lab menu: a five-row text list, the action hidden in a grey mono line, `DNp01` and «из коннектома · предположение» up front. The list pushes «Запустить» off a 1000 px screen, and on a phone it needs about three screens of scrolling. Once chosen, the operation is invisible on the fly. Over the fly floats a blue dot cloud that nobody has named. Mode: **Operate** (pick one of six), staged as **Experience** (the hologram is where the surgery happens).
2. **Outcome & proof.** The visitor picks an operation by reading one line («Выключить нейрон бегства»). While choosing, they see *where in her brain* it is, and after choosing they see it marked on her brain for as long as it is in force. They run it, and the result gives the number a scale they can feel («8 мс — в 12 раз быстрее моргания»). The proof is the dataset's own: real neuropil regions, real cell types behind «подробнее», and an honest data vs hypothesis line.
3. **Direction.** No new visual language: void, panel card, Inter, Geist Mono for codes and numbers, saffron = "on / in force", ash = "off". Structural thesis: **the list names the action, the hologram shows the place.** The card holds words and the hologram holds anatomy. They are linked by hover/focus and by one shared glyph set: `○` nothing, `⊘` switched off, `●` switched on. Focal moment: hovering «Выключить нейрон бегства» while the hologram, grown to ~1.8×, lights PVLP with «здесь».
4. **Scope & boundaries.** In scope: the op picker (desktop + phone, RU/EN), hologram label + preview + operated marks + decision flash, the «любой нейрон в мозге» round trip, scale lines (welcome + result), brain view plain language. Anti-goals: no on/off toggle per op, no multi-op combos in the slot, no new ops, no traced cell shapes in the hologram (backlog), no camera move when the list opens, no tooltip-on-tooltip, and no claim the model doesn't back ("she feels fear", "the fly thinks"). Out of scope: palette, bet, replay, discoveries, the brain tour.
5. **States & ranges.** Slot: none · one of 4 named ops · brain picks (1…N cells off/on from the brain view). List: closed · open (nothing hovered) · open + hover/focus on a row · details expanded. Live brain: loading (hologram has no live label yet) · ready. Result: an op with a latency (panic 8 ms, sugar 22 ms in the norm) · without one (moon, p1). Widths come from RU copy: the longest row, «Включить нейрон заднего хода», ≈ 215 px at `text-label`.
6. **Interaction & layout.** See §Layout. Slot trigger opens the list. Hover or arrow keys preview the row. Click or Enter chooses and closes. Esc closes without changing, and focus returns to the trigger. On a phone a tap chooses (no hover), and the preview plays after the choice. «вернуть» on the chip resets to none. «Выбрать любой нейрон в мозге →» dives to the brain view and comes back.
7. **Constraints & open decisions.** Tokens from `ui/theme.css`. UI motion `motion/react`, scene motion in the frame loop (no React state per frame). Reduced motion means instant UI and no hologram grow or flash. Listbox semantics + keyboard. Contrast ≥ 4.5:1 over the brightest dish frame. 60 fps. See §Open.

## Today (baseline snaps, 2026-10-16)

- 1600 × 1000, list open: the inline panel runs from y 370 to 810. Rows are name + mono ID + 1–2 role lines + «switch off · from the connectome». The bet is pushed to y ≈ 870 and «Запустить» is below the fold.
- 390 × 844, list open: the sheet list is 220 px tall and clipped by the wordmark row. Only «Ничего» and one op are fully visible.
- Op chosen: the card says «Escape neuron · switch off · DNp01» and the scene shows nothing. The op ring from `holo.ts` `setMarks` did not appear in the snap (check in 11.6).
- Hologram: a dark-blue dot cloud ~160 × 90 px floating above and behind the fly (~90 px long). It has no label and nothing ties it to her.
- Brain view: colour = Медиатор, legend «ацетилхолин 1011 · ГАМК 177 · глутамат 38 · неясно 28», raster rows «Зрит. доли · Мозг · Нисходящие · Спинной мозг» with no explanation, caption «… · LC4, LPLC2».

## Flow

```
slot closed ─ click / Enter / Space ─► list open (hologram grows 1 → 1.8×, label «её мозг · вживую» shows)
  hover / ↑↓ on a row ─► strip shows its role · hologram lights its region + «здесь»
  leave the list ─► hologram shows the chosen op again
  click / Enter ─► chosen: list closes · hologram shrinks back · region pulses once → operated mark stays
                   slot shows the chip «⊘ нейрон бегства · выкл.»  вернуть
  Esc / click outside ─► closed, nothing changed, focus back on the trigger
  «подробнее» ─► strip expands in place: term · cells · fact · data vs hypothesis
  «Выбрать любой нейрон в мозге →» ─► dive (fly → neuron zoom, 8.9) to the brain view, Silence tool on
      brain view: hint «Нажми на нейрон — выключишь его» · pill «← К мухе · выкл. 2»
      ─► back in the dish: slot = brain picks, chip «⊘ клетки из мозга · выкл. 2»  вернуть
chip «вернуть» ─► slot = none, mark fades
```

- **One slot, one value.** none | named op | brain picks (9.1: one op per experiment). Choosing a named op while brain picks exist switches them off but keeps them: the last row then reads «⊘ Клетки из мозга · выкл. 2» and can be chosen again. «вернуть» on the brain chip forgets them. This changes today's behaviour, where a named op and brain edits combine (user OK, 2026-10-16). Combinations stay possible inside the brain view itself.
- **The bet** is unaffected: a new pair still asks it, and the norm pairs stay the same, since each op has one action.
- **During a run** the card's summary line uses the chip text and glyph («◐ Тень · ⊘ нейрон бегства выкл.»).

## Layout

### Desktop 1600 × 1000 — list open, hovering an op

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               замедление ×6 · 0,000 с · идёт                                   │
│                                                                                                │
│  ПОЛОЖИТЬ                  её мозг · вживую ─┐                    ОПЫТ  ·  Открытия 3/12       │
│  ◆ Сахар          1       · ·⁘·:·⁘·· ·      │                    ┌───────────────────────────┐ │
│    остановится и поест  ·  ·⁘ ▒▒ ·:⁘·· · ◄──┘                    │ ЧТО ДАЁМ МУХЕ             │ │
│  ◇ Горечь         2      · ·⁘▒PVLP▒·· ·── здесь                  │ ◐ Тень                  ▾ │ │
│    попятится              · ·⁘·:·⁘·· ·                           │ взлетит                   │ │
│  ≋ Банан          3          hologram ×1.8                       │ ЧТО МЕНЯЕМ В МОЗГЕ        │ │
│    пойдёт на запах       ╭──────────────────────╮                │┌─────────────────────────┐│ │
│  ♀ Самка          4    ╭─╯                      ╰─╮              ││ ○ Ничего не менять    ✓ ││ │
│    он начнёт ухаживать │           ※ fly          │              ││▸⊘ Выключить нейрон      ││ │
│                        ╰─╮                      ╭─╯              ││    бегства              ││ │
│  НАПУГАТЬ                ╰──────────────────────╯                ││ ● Включить нейрон       ││ │
│  ◐ Тень  ◉        5                                              ││    заднего хода         ││ │
│    взлетит                                                       ││ ⊘ Выключить рецепторы … ││ │
│  ⟋ Мухобойка      6                                              ││ ⊘ Выключить нейроны …   ││ │
│    взлетит до удара                                              ││ ─ ─ ─                   ││ │
│                                                                  ││ ⌖ Выбрать любой нейрон  ││ │
│                                                                  ││   в мозге             → ││ │
│                                                                  ││─────────────────────────││ │
│                                                                  ││ Передаёт сигнал «тень!» ││ │
│                                                                  ││ от глаз прямо к мышце   ││ │
│                                                                  ││ прыжка.      подробнее  ││ │
│  ещё ▾                                                           │└─────────────────────────┘│ │
│  fly_ui  · заглянуть в мозг   RU / EN   ?                         male-cns v1.0 · Janelia FlyEM│
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

(The ASCII wraps rows. At the real 316 px inner width every row is one line, see widths in §Brief 5.)

- **Popover over the card.** It is anchored under the «Что меняем» trigger, card inner width, and drawn on top of the bet and «Запустить» while open. The card itself does not move or resize. Surface: the card's panel colour one step lighter (no border, no shadow), 18 px radius, 6 px inset. Max height = viewport − top − 24 px; the rows scroll only if that is hit (1280 × 720 fits without scrolling: 6 rows × 36 + strip ≈ 330 px).
- **Rows.** One line each, 36 px desktop / 44 px phone. Leading glyph in a 16 px column: `○` ash ring (nothing), `⊘` ash struck ring (switch off), `●` saffron dot (switch on), `⌖` mist (brain). Label `text-label`: «Выключить» in mist, the object in bone, so the verb is read and the object stands out. The chosen row gets `✓` at the right and bone text. Hover or focus = bone 4 % fill. The brain row sits below a short hairline (bone 15 %, 24 px) with `→` at the right edge.
- **Strip.** Below a full-width hairline, a fixed three-line block. It shows the hovered/focused row's role (`op.*.role`), else the chosen row's, else «none»'s. `text-caption` mist, with «подробнее» as a ghost link inline at the end. The strip never changes height on hover, so the list never jumps.
- **«подробнее» (technical layer).** It expands the strip in place (the popover grows downward over the card, the card doesn't move) and stays expanded for the rest of the visit:

```
│ Передаёт сигнал «тень!» от глаз прямо к мышце прыжка.  │
│ DNp01 · гигантское волокно · 2 клетки                  │  ← Geist Mono, ash
│ Самый толстый аксон в груди мухи — сигнал доходит      │  ← op.*.fact, mist
│ за миллисекунды.                                       │
│ Так эти клетки подписаны в самих данных. Что будет     │  ← source line, ash
│ с мухой — считает наша модель.                свернуть │
```

### Desktop — op chosen (setup, list closed)

```
 ЧТО МЕНЯЕМ В МОЗГЕ
 ⊘ нейрон бегства · выкл.   ▾          вернуть
```

- **Chip.** The trigger's value is glyph + object (lowercase) + «· выкл.» / «· вкл.» (reuses `exp.op.offShort` / `onShort`), in bone. «вернуть» is a separate ghost text button at the row's right, outside the trigger. Brain picks: «⊘ клетки из мозга · выкл. 2» (only non-zero parts; «● … вкл. 1» for driven cells; both when both). Today's `exp.brainOps` line under the slot goes away.
- **Hologram.** It shows the operated mark (see §Hologram) for as long as the slot holds the op: before the run, during it, and after.

### Phone 390 × 844 — list open

```
┌──────────────────────────────────────┐
│ ×1/6 · скоростная камера · 0,000 с   │
│            её мозг · вживую ─┐       │
│        · ·⁘·:·⁘▒▒· ·  ◄──────┘       │  hologram ×1.5
│    ╭───────────────────────────╮     │
│    │            ※              │     │
│    ╰───────────────────────────╯     │
│┌────────────────────────────────────┐│ ← sheet top unchanged (≈ y 350)
││ Опыт  ·  Положить  ·  Открытия 0/12││
││ ЧТО МЕНЯЕМ          ○ Ничего     ▴ ││
││ ○ Ничего не менять               ✓ ││ 44
││ ⊘ Выключить нейрон бегства         ││ 44
││ ● Включить нейрон заднего хода     ││ 44
││ ⊘ Выключить рецепторы сладкого     ││ 44
││ ⊘ Выключить нейроны ухаживания     ││ 44
││ ─ ─ ─                              ││
││ ⌖ Выбрать любой нейрон в мозге   → ││ 44
││────────────────────────────────────││
││ Обычная муха — норма, с которой    ││
││ сравниваем.              подробнее ││
│└────────────────────────────────────┘│ ← sheet reaches the bottom edge
└──────────────────────────────────────┘
```

- **Solo, taller.** The existing solo mode (open slot = whole sheet body) stays. While a slot is open the sheet extends down over the wordmark row, which fades out, so the list gets ≈ 400 px and fits without scrolling (6 × 44 + strip ≈ 340). The sheet's top edge does not move, so the dish band is unchanged.
- **No hover.** A tap chooses and closes, as today. The hologram then plays the preview on the chosen op (region pulse + «здесь» for 1.5 s) before settling into the operated mark. The strip shows the chosen row's role. «подробнее» expands it, and the sheet scrolls if needed.
- **CTA in thumb reach.** After closing, «Запустить» is back in its place at the sheet bottom.

## Hologram

All marks live in the hologram frame (`scene/dish/holo.ts`), so they yaw and follow with her.

- **Label (11.2).** «её мозг · вживую» in `text-caption` mist, with a 1 px leader (bone 40 %) to the hologram's upper-right edge. It is placed on the side away from the card (left of the hologram when the fly is right of centre). It appears **only when the live brain is running** (`dish.cells` ready, so «вживую» is true): the leader draws over 300 ms, the text fades in, it holds 4 s, then fades out over 400 ms. It shows once per page load, and again whenever the op list is open. If the welcome is up, it plays behind it (the hologram is clear of the column at 1600). Reduced motion: the label appears and disappears without the draw. The DOM node is moved by the frame loop (projected anchor), with no React state per frame.
- **Grow (11.6).** While the list is open the hologram scales 1 → 1.8× desktop / 1.5× phone around its own centre, eased over 320 ms. On close it shrinks over 260 ms. The dust dims to 60 % so the lit region reads. Reduced motion: no grow.
- **Preview (11.6).** The hovered op's region (`OPERATIONS[op].region`, the stimulus side or L) is lit: its shell from `regions` goes bone at ~35 % rim with a soft fill. A «здесь» tag with a short leader sits at the region's site. Switching rows crossfades in 120 ms. Hovering «Ничего» lights nothing. Hovering the brain row lights the whole shell faintly (the whole brain).
- **Operated marks (11.6), always while in force.**
  - *Switched off* (`⊘`): the region shell darkens (fill toward void, rim ash), its dust dims to 25 %, and an ash ring with a diagonal strike sits at the site. The path node of that cell type stays dark when the thread passes, and the thread stops there, as replay already does.
  - *Switched on* (`●`): a warm saffron glow at the region (additive, small bloom) and a saffron ring.
  - Mark size ≥ 10 px on screen at rest (desktop and phone), about 2× today's `MARK_R`.
  - Brain picks: no per-cell positions in the dish, so no region mark by default (see §Open 4). The chip carries it.
- **Decision flash (11.2).** At a decision the hologram's rim flares (rim gain 0.15 → 0.6 in 100 ms, back over 500 ms) and the thread pulse starts *from the hologram* down to the body (`thread.ts`, same `RUN_MS`). It reads "her brain decided, her body moved". Reduced motion: no flare, and the thread is drawn at once as today.

## Any neuron in the brain (11.5)

- **Out.** Last row → the existing fly → neuron dive (8.9) to `?view=brain` with the Silence tool active and a one-line hint over the scene: «Нажми на нейрон — выключишь его». Stimulate (switch on) stays one key away as today.
- **Back.** The brain view's `BackToDish` pill reads «← К мухе · выкл. 2» (counts of edits so far; plain «← К мухе» with none). The edits travel back as `?x=` by bodyId (as today), and the slot becomes *brain picks* with the chip.
- **Norm.** A brain-picks run has no norm pair. The result's «обычно» row uses `exp.usual.noops` as today, and it never unlocks a discovery (as today).

## Scale (11.3)

- **Latency → blink.** Blink = **100 ms**: the low end of the typical 100–400 ms range, so the ratio is a lower bound and never overstates. Rule: `ms ≤ 50` → «в {N} раз быстрее моргания» with N = ⌊100 / ms⌋; `50 < ms ≤ 400` → «примерно как моргание»; `ms > 400` → no comparison. RU plurals for «раз / раза» (2–4, 22–24 → «раза»). Norm examples: takeoff 8 ms → 12×; eating 22 ms → 4×.
- **Result.** One caption line under the result rows, anchored to the row that has the number (сейчас if it has one, else обычно): «8 мс — в 12 раз быстрее моргания». Mono number, mist text. Moon and P1 have no latency, so no line.
- **Welcome.** One outline chip (tag radius, bone 30 % hairline, `text-caption` mist) under the «{n} нейронов…» paragraph: «мозг — размером с маковое зерно». It describes the brain only, not the neuron count (that count includes the nerve cord).
- **Neuron count = 166 700** everywhere in copy (user, 2026-10-16), as the dataset's paper and release give it (Berg et al., Cell; [MRC LMB](https://mrclmb.ac.uk/?p=17807), [UKRI](https://www.ukri.org/news/world-first-map-of-a-male-fly-brain-a-win-for-neuroscience/); Janelia's abstract: 166 691). Today the app says 176 000 (likely the live graph's row count, ~176k in DECISIONS 8.15; why it differs from the paper is unchecked). Replace it in `tour.narr.2`, the «{n} из … нейронов» run line, `Welcome.tsx` `num(176000)`, README and `docs/article.ru.md`. The graph and the sim don't change.
- **Sources.**
  - Blink duration 100–400 ms; a review of measurements gives ~95–334 ms ([PMC8196427](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8196427/)). Driver-monitoring work gives 100–150 ms typical ([arXiv 1803.10106](https://arxiv.org/pdf/1803.10106)).
  - Fly brain "the size of a poppy seed": [NIH BRAIN Initiative](https://braininitiative.nih.gov/news-events/blog/fruit-fly-brain-map-and-wiring-diagram-major-milestone-neuroscience), [NPR 2024](https://www.npr.org/2024/10/07/1210935851/ai-brain-fruit-fly-map-connectome).
  - Human brain ~86 billion neurons (Azevedo et al. 2009, [PubMed 19226510](https://pubmed.ncbi.nlm.nih.gov/19226510/)), kept for «подробнее» or the tour, not the welcome.

## Brain view in plain words (11.4)

- **Default colour = region** when the link has no `color`. Old links with `?color=…` keep it, and Медиатор stays a mode.
- **Legend** grouped under the tour's three words with plain sub-names. Same groups and colours as today; only the labels and headings change. Counts move out of the rows into the row's hover/focus title.

```
 ГЛАЗА          ● зрительные доли
 МОЗГ           ● центральный мозг
                ● вкус и хоботок            (subesophageal zone)
 СПИННОЙ МОЗГ   ● крылья, шея, жужжальца    (upper tectulum)
                ● ноги и крылья вместе      (lower tectulum — verify, §Open 2)
                ● ноги                      (leg neuropils)
                ● брюшко                    (abdominal)
                ● остальной спинной мозг
```

- **Raster.** One line over it: «каждая точка — сработал один нейрон». Row labels become «Глаза · Мозг · Команды в тело · Спинной мозг» («Нисходящие» → «Команды в тело»).
- **Key cells.** Tooltip, inspector heading and caption put the human name first and the type after it in mono: «нейрон бегства · DNp01». The caption reads «… · детекторы приближения (LC4, LPLC2)». Add `why.cell.LPLC2` = «детектор приближения». Cells without a `why.cell.*` keep their type.

## Motion

| What | How | Duration / curve | Reduced motion |
|---|---|---|---|
| Popover open | opacity 0→1, y −4→0, scale .98→1, origin top | 160 ms, ease-out `cubic-bezier(.23,1,.32,1)` | instant |
| Popover close | opacity →0 | 120 ms ease-out | instant |
| Row hover/focus fill | — | none (instant, so the preview isn't late) | — |
| Strip text swap | crossfade | 120 ms | instant |
| «подробнее» expand | height via `motion` layout, content fade | 200 ms ease-out | instant |
| Hologram grow / shrink | scale in the frame loop (exp. ease) | 320 / 260 ms | none |
| Region preview | shell rim/fill fade | in 120, out 200 ms | instant |
| Choose → mark | region pulse bone → mark colour, then settle | 400 ms | mark appears |
| Chip in / out | opacity + scale .96→1 | 180 / 120 ms | instant |
| Label | leader draw 300 ms, text fade 200 ms (delay 150), hold 4 s, fade 400 ms | — | appear / disappear |
| Decision flash | rim gain 0.15 → 0.6 → 0.15 | 100 in / 500 out | none |

Transform and opacity only in the DOM. Interruptible: opening the list mid-shrink reverses from the current scale.

## Copy

| Key | RU | EN |
|---|---|---|
| `op.none.verb` | Ничего не менять | Change nothing |
| `op.none.role` | Обычная муха — норма, с которой сравниваем. | A normal fly, the baseline we compare with. |
| `op.panic.verb` | Выключить нейрон бегства | Switch off the escape neuron |
| `op.moon.verb` | Включить нейрон заднего хода | Switch on the reverse neuron |
| `op.sugar.verb` | Выключить рецепторы сладкого | Switch off the sugar sensors |
| `op.p1.verb` | Выключить нейроны ухаживания | Switch off the courtship neurons |
| `op.pick.verb` | Выбрать любой нейрон в мозге | Pick any neuron in the brain |
| `op.pick.role` | Откроем мозг: выключи любые клетки и вернись с ними сюда. | Opens the brain: switch off any cells, then bring them back here. |
| `op.pick.kept` | Клетки из мозга · {cells} | Cells from the brain · {cells} |
| `op.chip` | {name} · {mode} | {name} · {mode} |
| `op.more` / `op.less` | подробнее / свернуть | details / less |
| `op.src.data.long` | Так эти клетки подписаны в самих данных. Что будет с мухой — считает наша модель. | The dataset itself names these cells. What happens to the fly is our model's prediction. |
| `op.src.guess.long` | В данных у этих клеток нет такого имени — мы опознали их сами, по тому, где они и с чем связаны. Это наша гипотеза, а что будет с мухой — считает модель. | The dataset doesn't name these cells: we identified them by where they sit and what they connect to. That's our hypothesis; what happens to the fly is the model's prediction. |
| `brain.pickHint` | Нажми на нейрон — выключишь его | Click a neuron to switch it off |
| `brain.back` | ← К мухе · {cells} | ← Back to the fly · {cells} |
| `holo.label` | её мозг · вживую | her brain · live |
| `holo.here` | здесь | here |
| `scale.blink` | в {n} раз(а) быстрее моргания (plural) | {n}× faster than a blink |
| `scale.blinkAbout` | примерно как моргание | about a blink |
| `scale.line` | {ms} мс — {cmp} | {ms} ms — {cmp} |
| `welcome.scale` | мозг — размером с маковое зерно | a brain the size of a poppy seed |
| `raster.hint` | каждая точка — сработал один нейрон | each dot is one neuron firing |
| `raster.row.descending` | Команды в тело | Commands to the body |
| `why.cell.LPLC2` | детектор приближения | looming detector |

Kept: `op.*.name` (lowercased in the chip), `op.*.role`, `op.*.term`, `op.*.fact`, `op.cells`, `op.restore` («вернуть», lowercase in the chip row), `exp.op.offShort` / `onShort`. Dropped from the list rows: the mono ID column, `op.src.data` / `op.src.guess` chips (they live in «подробнее» now), and the `exp.op.off` / `on` grey line. `exp.brainOps` is replaced by the chip.

## What changes

- **11.2** `scene/dish/holo.ts` (label anchor, rim flare), `scene/dish/thread.ts` (pulse starts at the hologram), a DOM label positioned by the frame loop, debug `?debug=holo-label`, i18n `holo.*`.
- **11.3** pure `ui/scale.ts` + test (`blinkRatio`, the band rule, RU plurals), result line in `DishCard`, chip in `ui/Welcome.tsx`, i18n `scale.*`, `welcome.scale`; 176 000 → 166 700 in copy (see §Scale).
- **11.4** default colour in `state/params.ts` / app (only without an explicit `color`), `Legend.tsx` headings + plain names + counts in titles, raster hint + row label, `NeuronTooltip` / `Inspector` / captions human-name-first, i18n.
- **11.5** pure model in `state/trial.ts` (slot = none | op | brain, preview op, kept brain picks), op → region lookup for the preview, brain round trip (Silence tool + hint + `BackToDish` counts); tests first.
- **11.6** `DishCard.tsx` `Change` → popover listbox (desktop) / taller solo sheet (phone), chip + «вернуть», strip + «подробнее»; `holo.ts` grow, region preview, operated marks; motion per the table.

## Open (for 11.2–11.6)

1. **Neuron count**: settled, 166 700 (§Scale). If the graph's row count is ever shown as "neurons", label it as the model's cells instead.
2. **Lower tectulum** plain name: «ноги и крылья вместе» is from memory of Court et al. 2020 (VNC nomenclature; user OK). Verify in 11.4, or fall back to «середина спинного мозга».
3. **Region dimming** of the dust needs a point-in-region test (once, at hologram build, against the `regions` meshes or their boxes). If that costs too much, tint the shell only.
4. **Brain picks on the hologram.** The dish has no per-cell positions. If the `?x=` round trip can carry each cell's `region` from the meta table, mark those regions too (11.5 decides; otherwise chip only).
5. **Slot exclusivity**: settled (user, 2026-10-16), one value per slot (§Flow). Smoke and share links that set an op and `?x=` together must pick one; check `state/share.ts` decoding in 11.5.
6. **Today's op ring** (`setMarks`) wasn't visible in the baseline snap with `panic` set. Check the wiring in 11.6.
