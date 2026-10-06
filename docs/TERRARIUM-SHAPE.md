# TERRARIUM — shape (Phase 8 brief)

Approved look, layout and copy for 8.3–8.9. Behaviour facts come from [TERRARIUM.md](TERRARIUM.md) (8.1). Copy tables are the source for `i18n/{ru,en}.ts`; key names are suggestions. RU default, «ты», lively not cute; cell-type names never translate.

## Brief

1. **Job & audience.** The tour's visitor (laptop, 1–3 min, no idea what a connectome is) who just saw "neuron off → no jump" on the brain and felt little. Here they need to *see a fly behave* and break it by hand. Mode: Experience with an Operate layer (place, operate, compare).
2. **Outcome & proof.** In ~60 s they can say "I put sugar in, she ate; I cut her sugar neurons, she walked over it; I switched off the panic neuron and the swatter got her." Proof is the live connectome: every encounter runs `packages/sim`, the decision thread shows the real path, numbers are the run's own (Hz, ms).
3. **Direction.** Same world as the brain view: void, glass, glowing dots, bloom. A 24 mm glass arena floating in the void, seen from 40°; one glass fly lives in it; its brain floats above it as a hologram. Items are glowing specimens. Focal moment: an encounter — the thread of light runs sense organ → brain → legs, and the fly acts. Second focal moment: the same encounter after an operation, with a different ending.
4. **Scope & boundaries.** Own view beside the brain view (`?view=dish`), the brain view stays home and untouched. 6 items, 4 operations, desktop full, phone fallback. Anti-goals: no game HUD (scores, lives, timers), no cartoon fly, no gore (the swatter shatters the glass fly into dust, it reassembles), no sound, no modal over the scene, no arrows pointing at buttons, no claim the model can't back (walking/turning/odor approach are labelled as scripted).
5. **States.** See §States. Ranges: 0–8 items in the dish (sugar ≤3, bitter ≤3, odor 1, female 1); hands (shadow, swatter) are tools, unlimited, one strike in the air at a time; 0–4 operations at once.
6. **Interaction & layout.** See §Layout. Items: drag from the palette onto the dish (desktop), tap-to-place (phone). Hands: pick the shadow or the swatter, then aim and strike with the cursor / finger yourself. Operations: right-hand card list, one card open, its violet pill is the view's only primary action. Everything else ghost.
7. **Constraints & open decisions.** Live sim in the Worker must keep 60 fps at "high" (8.15); phone may fall back to baked clips (8.14). Card width set by RU. Open: see §Open.

## Where it lives

- **Switch** under the wordmark, beside `RU / EN` and `?`: two ghost words `Мозг · Террариум` (active bone, inactive ash, like Dala nav). Phone: beside the wordmark, where `?` sits now. URL `?view=dish`; the brain view keeps today's URLs.
- **Entry for a newcomer**: tour step 4 (cheat sheet) — the violet pill becomes «В террариум →», the old «Начать» becomes a ghost «Остаться в мозге». Phone step 4: same pill, ghost «Готово».
- **First arrival from the tour** opens the dish with the swatter already in hand (cursor = swatter) and a one-line nudge (`dish.nudge.tour`) — continuity with "now break it".
- Switching view crossfades the canvas (≤400 ms, opacity) — no camera flight in 8.2–8.8; 8.9 adds the fly → neuron zoom.
- In the dish view the brain HUD is hidden: toolbar, timeline, scopes, legend, inspector, FlyCam (the dish *is* the fly camera). Wordmark, switch, lang, credit line stay.

## The world

| element | look | behaviour |
|---|---|---|
| Arena | 24 mm glass dish (≈ 10 fly lengths across — room for 8 items, a female and backing off): a thin bright rim ring (bone, bloom), glass floor with faint fresnel and two concentric agar rings at 8 % white; nothing under it but void. Camera 40° pitch, yaw orbit free, pitch 25–60°, no pan. | Fixed; fills ~60 % of viewport height on desktop. |
| Fly | Reuse `scene/flycam/model.ts` glass fly, 2.5 mm ≈ 1/10 of the arena: ≈ 90 px long at 1600 (legs and gait readable, items still fit around her). Wheel / pinch zoom clamped to fly 60–200 px. Phone: follow framing, fly ≈ 60 px. Final size is tuned on a snap in 8.5 (dev panel slider), not by reasoning. Tripod gait. | Scripted wanderer (walk, turn, drift toward odor) overridden by command neurons: TTMn → jump, MDN → back, MN9 → stop + eat (proboscis down), pIP10 + pC1 → court (one wing out, vibrating). |
| Trail | 1 px light line on the floor, fades over ~4 s sim time. Colour = action: walk bone 30 %, eat saffron, back `#4f8cff`, court male magenta; jump = trail gap + a white ring at the takeoff point. | Hue is never alone: the status word top-centre names the action. |
| Timecode | Top-centre, mono: `×1/6 · скоростная камера · 0,412 с` + status word (`идёт`, `ест`, `пятится`, `прыжок`, `ухаживает`). | Space pauses; the sim runs at 1/6 so a 8 ms jump command is watchable. |
| Brain hologram | The fly's brain as ~4k dots (same points as the brain view, sampled), iris-tinted shell at 15 %, transmitter colours at low alpha; ~1.3 fly lengths wide, floats 2 fly lengths above the fly, follows with a soft spring lag, faces the camera. Live spikes flash. | Mark for an operation: silenced cell → ash dot with a ring (as the brain-view Silence); forced cell → saffron ring (as Stimulate). |
| Decision thread | Saffron light pulse: sense organ on the body (eye / proboscis / leg) → up into the hologram → path from `sim/trace.ts` → down to the legs; ~600 ms real time; one thread per decision. | Caption under the dish names it (format of Captions: phrase + mono term), e.g. «Тень слева → прыжок · DNp01 → TTMn · 8 мс». |

### Items

Glyphs echo Dala's triangles: every item is built from small faceted particles, so items and neurons read as one material.

| item | look | place | what happens (source) |
|---|---|---|---|
| Sugar | cluster of 5–7 saffron crystals, soft glow | anywhere on the floor | fly walks into it (scripted) → LB3 fires → MN9 → stops, proboscis down, eats (connectome) |
| Bitter | acid drop: a teal `#22c3a1` lens with an inner glow | floor | contact → LB1 → MDN → backs away (connectome; LB1 = bitter proxy, labelled) |
| Banana odor | drifting plume of pale mist-white particles from a small source point | floor, 1 max | fly drifts toward it (scripted, labelled «упрощение»); the connectome only decides at the source |
| Female | second glass fly, a touch larger, scripted slow circles; no trail | floor, 1 max | in the male's view → LC10a → pC1 + pIP10 → he turns to her and sings (wing out; connectome for *whether*, scripted for *where*) |

Items are removable: drag back to the palette or off the dish, hover → `×`. `R` resets the dish (items + fly; operations stay).

### Hands (the visitor's own strikes)

Shadow and swatter are tools, not items: pick one (palette or key), the cursor becomes it, you aim and strike. Esc / right-click / the same key puts it down. One strike in the air at a time; no limit on strikes.

| hand | look | gesture | what happens (source) |
|---|---|---|---|
| Shadow | dark disc with a soft edge and a thin rim ring, growing over the floor under the cursor | press and hold: the disc grows (loom) as long as you hold; release: it withdraws | loom from the cursor's side of the fly's heading → LC4/LPLC2 → DNp01 → TTMn → jump (connectome). Harmless: nothing lands. |
| Swatter | glass swatter descending from the camera side; its shadow grows on the floor under the cursor | click = swing at that point; lands ~120 ms sim later (≈ 0.7 s real at ×1/6, so you watch it come down) | same loom. Jumped → the swatter slaps empty glass (dust puff), the fly lands elsewhere (FlyCam drop-in). No jump → hit: the glass fly shatters into dust and reassembles at the rim. Strike > 4 fly lengths away → no loom, «мимо», she doesn't even notice. |

Why it's fair: an intact fly always escapes (jump command at 8 ms ≪ 120 ms), so the visitor learns "you can't swat her" first; after «Нейрон паники» off (TTMn 44 Hz, no jump) every aimed strike lands. The difference is the neuron, not their aim.

### Operations (neurosurgeon)

Card list on the right. Closed card = one line (plain name + mono term + on/off chip). Open card:

```
 НЕЙРОН ПАНИКИ                  DNp01 · {n} клетки
 Передаёт «тень!» от глаз прямо к прыжковой мышце.
 Самый толстый аксон в груди мухи — сигнал за миллисекунды.
 
 обычно   прыжок через 8 мс · TTMn 227 Гц
 сейчас   —  (наведи тень или замахнись)
 
 ( ВЫКЛЮЧИТЬ )                  из коннектома
```

- `обычно` = the reference run from 8.1 (baked numbers); `сейчас` = the last live encounter of that kind. After an operation + encounter it becomes the verdict line, e.g. «сейчас  нет прыжка · TTMn 44 Гц → мухобойка попала».
- Source chip bottom-right: `из коннектома` or `предположение` (for inferred types: LB3 = sugar, pC1 = P1).
- The pill toggles: «Выключить» ↔ «Вернуть». Several operations may be on at once; ghost «Отменить все» under the list when ≥1 is on. Operated cards stay marked (dot) when closed.

## Layout

### Desktop 1600 × 900

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                │
│                          ×1/6 · скоростная камера · 0,412 с · идёт                             │
│                                                                                                │
│  ПРЕДМЕТЫ                         · · ·⁘· ·                       НЕЙРОХИРУРГ                  │
│                                  · hologram ·                                                  │
│  ◆ Сахар        1                 · ·⁘·· ·                       ● Нейрон паники      DNp01    │
│  ◇ Горечь       2                    ┆ thread                    ┌─────────────────────────┐   │
│  ≋ Банан        3          ╭─────────┆──────────────╮            │ НЕЙРОН ОТСТУПЛЕНИЯ      │   │
│  ♀ Самка        4       ╭──╯         ┆              ╰──╮         │ MDN · {n} клетки        │   │
│                         │      ✦     ※ ─ ─ trail       │         │ Одна команда — и муха   │   │
│  РУКИ                   │   sugar                      │         │ отступает задом наперёд │   │
│  ◐ Тень         5       ╰──╮                        ╭──╯         │ обычно —   сейчас —     │   │
│  ⟋ Мухобойка    6          ╰────────────────────────╯            │ ( ВКЛЮЧИТЬ ) коннектом  │   │
│                                                                  └─────────────────────────┘   │
│  перетащи в чашку · возьми в руку                                ○ Сахарные рецепторы   LB3    │
│                     «Сахар под хоботком → ест · LB3 → MN9 · 22 мс»                             │
│                                                                  ○ Нейроны желания       P1    │
│  fly_ui                                                                                        │
│  Мозг · Террариум   RU / EN   ?                  male-cns v1.0 · Janelia FlyEM · CC BY 4.0     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Palette: left column, vertically centred, no panel — glyph (the item's own mini render, 24 px) + name + dim mono hotkey. Drag ghost = the real item at 60 %; valid drop shows a faint ring on the floor. Keys 1–4 place the item at the cursor if over the dish, else a free spot ahead of the fly. Below a gap, group «Руки»: 5 = shadow, 6 = swatter; picked hand = cursor glyph + its palette row lit; Esc puts it down.
- Operations: right column, translucent panel (`--color-panel`, blur, 24 px radius), width set by RU (~320 px).
- Decision caption: bottom-centre, the Captions slot.
- Hint `перетащи в чашку` only while the dish is empty.

### Phone 390 × 844

```
┌──────────────────────────────┐
│ fly_ui              Мозг·Терр│
│ ×1/6 · 0,412 с · идёт        │
│                              │
│          · ⁘ ·  hologram     │
│     ╭──────────────────╮     │
│   ╭─╯       🪰          ╰─╮  │
│   │    ✦         ◇        │  │
│   ╰─╮                   ╭─╯  │
│     ╰──────────────────╯     │
│ «Горечь → назад · LB1 → MDN» │
│──────────────────────────────│
│  Предметы  ·  Операции       │
│  ◆ ◇ ≋ ♀  ·  ◐ ⟋             │
│                              │
│  RU/EN  ?    male-cns · CC BY│
└──────────────────────────────┘
```

- Bottom sheet with two tabs replaces the ViewerBar. Items: tap → placed ahead of the fly (no drag). Hands: tap the tool, then tap the dish = swing there; shadow = touch and hold. Operations tab: the same cards, one open, pill full-width.
- Arena fills the width; camera pitch fixed at 45°, one-finger yaw orbit.
- If live sim can't hold ~30 fps → baked clips per (item × operation), labelled `запись` in the timecode line (decision in 8.14).

## States

| state | what the visitor sees |
|---|---|
| Loading live sim | The arena assembles from dust (rim first, then floor), the hologram assembles from the intro's particle field; timecode slot shows «готовлю мозг…». Never a spinner. |
| Empty dish | Fly wanders; hint «перетащи в чашку»; palette glyphs breathe once (no loop). |
| From the tour | As empty, plus `dish.nudge.tour`, swatter already in hand. |
| Hand picked | Cursor = the tool glyph; on the floor under it a faint aim ring; palette row lit. |
| Missed (far strike) | Dust puff, status «мимо», fly keeps walking. |
| Dodged | Fly jumps, lands elsewhere; status «увернулась»; swatter slaps empty glass. |
| Encounter | Thread + caption; status word changes; trail colour changes. |
| Hit by swatter | Shatter to dust (≤400 ms) → reassemble at the rim (`LAND_MS` as FlyCam) → status «снова здесь». |
| Operation on | Hologram mark + body mark (a small ring on the head); card dot; verdict after the next matching encounter. |
| Paused | Space; timecode shows `пауза`; thread freezes mid-flight. |
| Reduced motion | Camera fixed (no orbit inertia), plume as a static stipple, thread drawn whole then fades, shatter = instant swap. |
| No WebGPU / fatal | Existing `Fatal`. |
| URL / snap | `?view=dish&items=sugar:x,y;female&ops=dnp01` restores a dish (hands are not saved); `snap` freezes the wanderer seed. |

## Copy

| key | RU | EN |
|---|---|---|
| `view.brain` | Мозг | Brain |
| `view.dish` | Террариум | Terrarium |
| `tour.end.dish` (pill) | В террариум → | To the terrarium → |
| `tour.end.stay` (ghost) | Остаться в мозге | Stay with the brain |
| `dish.loading` | готовлю мозг… | wiring the brain… |
| `dish.timecode` | ×1/6 · скоростная камера · {t} с | ×1/6 · high-speed camera · {t} s |
| `dish.paused` | пауза | paused |
| `dish.recorded` | запись | recording |
| `dish.state.walk` / `eat` / `back` / `jump` / `court` / `back_again` | идёт / ест / пятится / прыжок / ухаживает / снова здесь | walking / eating / backing off / jump / courting / back again |
| `dish.items` | Предметы | Things |
| `dish.hint.empty` | перетащи в чашку · возьми в руку | drag into the dish · or pick up a hand |
| `dish.hint.tap` | нажми — и положу в чашку | tap to drop into the dish |
| `dish.item.sugar` | Сахар | Sugar |
| `dish.item.bitter` | Горечь | Bitter |
| `dish.item.odor` | Банан | Banana |
| `dish.hands` | Руки | Hands |
| `dish.hand.shadow` | Тень | Shadow |
| `dish.hand.swatter` | Мухобойка | Swatter |
| `dish.hand.put` (hint while held) | Esc — положить | Esc to put down |
| `dish.state.miss` / `dodge` | мимо / увернулась | missed / dodged |
| `dish.item.female` | Самка | Female |
| `dish.remove` (aria) | Убрать | Remove |
| `dish.reset` | Сбросить чашку | Reset dish |
| `dish.nudge.tour` | Мухобойка в руке. Попробуй прихлопнуть муху. Потом выключи нейрон паники — и ещё раз. | The swatter's in your hand. Try to swat the fly. Then switch off the panic neuron and try again. |
| `dish.simplified` (tooltip on odor + wander) | Упрощение: ходьбу и путь к запаху задаёт сценарий. Что делать у цели — решает коннектом. | Simplified: walking and heading for the smell are scripted. What to do on arrival is up to the connectome. |
| `dish.ops` | Нейрохирург | Neurosurgeon |
| `dish.op.usual` | обычно | usually |
| `dish.op.now` | сейчас | now |
| `dish.op.waiting` | — ({action}) | — ({action}) |
| `dish.op.off` / `on` / `undo` | Выключить / Включить / Вернуть | Switch off / Switch on / Restore |
| `dish.op.undoAll` | Отменить все | Undo all |
| `dish.src.connectome` | из коннектома | from the connectome |
| `dish.src.guess` | предположение | inferred |
| `dish.op.share` (ghost) | Поделиться опытом | Share this experiment |

### Operation cards

| key | RU | EN |
|---|---|---|
| `op.panic.name` | Нейрон паники | Panic neuron |
| `op.panic.term` | DNp01 · гигантское волокно | DNp01 · Giant Fiber |
| `op.panic.role` | Передаёт «тень!» от глаз прямо к прыжковой мышце. | Carries "shadow!" from the eyes straight to the jump muscle. |
| `op.panic.fact` | Самый толстый аксон в груди мухи — сигнал доходит за миллисекунды. | The thickest axon in the fly's thorax — the signal arrives in milliseconds. |
| `op.panic.try` | наведи тень или замахнись | cast a shadow or take a swing |
| `op.panic.verdict` | нет прыжка · TTMn {hz} Гц — мухобойка попала | no jump · TTMn {hz} Hz — the swatter hit |
| `op.moon.name` | Нейрон отступления | Retreat neuron |
| `op.moon.term` | MDN · moonwalker | MDN · moonwalker |
| `op.moon.role` | Одна команда — и муха отступает задом наперёд. | One command and the fly retreats, walking backwards. |
| `op.moon.fact` | Учёные назвали его «лунным» — в честь лунной походки, шага назад. | Scientists named it the moonwalker, after the backward dance step. |
| `op.moon.try` | просто смотри | just watch |
| `op.moon.verdict` | пятится без причины · MDN {hz} Гц | backs off for no reason · MDN {hz} Hz |
| `op.sugar.name` | Сахарные рецепторы | Sugar sensors |
| `op.sugar.term` | LB3 · вкус на хоботке | LB3 · taste on the proboscis |
| `op.sugar.role` | Чувствуют сладкое и велят остановиться и есть. | Taste sweetness and tell the fly to stop and eat. |
| `op.sugar.fact` | Вкусовые волоски у мухи есть на хоботке, на ногах и даже на крыльях. | A fly has taste hairs on its proboscis, its legs and even its wings. |
| `op.sugar.try` | положи сахар | put sugar down |
| `op.sugar.verdict` | прошла по сахару · MN9 {hz} Гц | walked over the sugar · MN9 {hz} Hz |
| `op.p1.name` | Нейроны желания | Desire neurons |
| `op.p1.term` | P1 · пул pC1 | P1 · pC1 pool |
| `op.p1.role` | Около двадцати клеток с каждой стороны мозга решают, ухаживать ли за самкой. | About twenty cells on each side of the brain decide whether to court a female. |
| `op.p1.fact` | Есть только у самцов. | Only males have them. |
| `op.p1.try` | посади самку | add a female |
| `op.p1.verdict` | не замечает самку · pIP10 {hz} Гц | ignores the female · pIP10 {hz} Hz |

Facts checked (2026-10-06). Panic: the GF axon is the largest in the *thoracic* ganglia (4–8 µm), not the whole CNS — copy says «в груди» ([JEB 2014](https://journals.biologists.com/jeb/article/217/12/2121/12086/Responses-of-Drosophila-giant-descending-neurons)). Retreat: MDN = moonwalker descending neuron, sufficient for backward walking (Bidaye et al., Science 2014); the Michael Jackson link is folklore, not in the paper — dropped. Sugar: the old «ногами раньше, чем ртом» did not fit LB3 (labellar) — replaced by taste hairs on proboscis, legs and wing margin. P1: ~20 cells per hemisphere, male-only, fru⁺/dsx⁺ ([PNAS 2012](https://www.pnas.org/doi/full/10.1073/pnas.1207107109)). Cell counts in `op.*.term` (`{n} клетки`) come from the dataset at runtime, never hard-coded.

## Open (for 8.3+)

- P1 op mechanics (8.3): courtship gate needs pC1 > 0 *and* pIP10 above threshold, otherwise the op is relabelled «pIP10 off». The card copy above assumes the gate works.
- Sugar op is trivial (silences the input itself) — acceptable; the verdict still reads well.
- Hologram point budget vs live sim cost — measured in 8.5/8.15.
- Share URL format lives in `state/share.ts`; dish params added in 8.6.
