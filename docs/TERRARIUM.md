# Terrarium — feasibility (8.1)

Question: on the full male-cns graph (`packages/sim`, Shiu LIF + `NET_OVERRIDES`), does Poisson input into a sensory group drive the "right" command neurons, so that the Terrarium fly's behaviour can come from the connectome?
Script: `pnpm -C apps/pipeline explore:terrarium [--ops]` ([explore/terrarium.ts](../apps/pipeline/src/explore/terrarium.ts)). 150 Hz Poisson on every cell of the input, 300 ms, seeds 1–3, Hz per cell. Sensory L/R split uses neuPrint `rootSide` (sensory cells have no `somaSide`); full run ≈ 4.5 min.

## Verdict: GO (with labelled simplifications)

| item / operation | connectome result | Terrarium behaviour | status |
| --- | --- | --- | --- |
| swatter / shadow (loom) | LC4+LPLC2 → DNp01 415 Hz (3 ms) → TTMn 227 Hz (8 ms) | jump (TTMn burst, as in FlyCam ≥200 Hz) | **go** |
| op: panic neuron off | DNp01 off → TTMn 44 Hz, first spike 19 ms | no jump (below threshold) | **go**, the only non-trivial op |
| sugar | LB3a–d → MN9 224 Hz (22 ms) | stop + eat | **go** |
| op: sugar GRNs off | LB3 off → MN9 0 | walks over the sugar | **go** (trivial: the input itself is silenced) |
| bitter | LB1a–e → MDN 81 Hz, MN9 0 | back away (moonwalk) | **go**, LB1 = bitter proxy (no Gr66a label; LB2/LB4 also drive MN9 66–94, rejected) |
| op: MDN on | MDN 137 Hz, nothing else | moonwalk | **go** (command neuron read directly) |
| female (LC10a) | LC10a → pIP10 90 Hz, pC1 pool 13 Hz | court / song | **go** |
| op: P1 off | pC1 off → pIP10 63 Hz (−30 %) | ignores the female | **conditional**: LC10a reaches pIP10 also around P1. In 8.3 courtship needs both pC1 pool > 0 *and* pIP10, or the op becomes "pIP10 off". P1 on → pIP10 188 Hz. |
| banana odor | ORN_DM1/DM2/VA2/DM4 → DNb05 ~400 Hz both sides, DNb06 L only | — | **no steering**: L-only and R-only ORN input give identical outputs (ORNs project to both ALs). The fly wanders on its own toward odor = labelled simplification; the connectome decides at the encounter (sugar/bitter). 8.10 dropped unless a later model adds lateralisation. |
| forward walk | DNp09 / DNg97 silent for every input | — | wander is scripted (not from the connectome) |
| turning | DNa01/DNa02 ≤ 20 Hz, no consistent side for loom or LC10a | — | turns are scripted; loom L/R does not steer away |
| grooming | JO-FV → DNg11 26 Hz (DNg11 ~20–30 Hz for every input); BM_InOm → DNg12 72 but MDN 167 | — | **no-go** as an item (not specific) |
| female touch | LgLG1a/b → TTMn 78, MDN 80 | — | rejected (leg bristles look like a startle, not a pheromone) |

Implications for 8.3 (bridge): action = thresholds on command rates: jump ← TTMn; back ← MDN; eat ← MN9; court ← pIP10 (+ pC1 gate). Walk and turn come from a scripted wanderer that these override. DNb06 shows a fixed L ≫ R asymmetry for any input (annotation or graph artefact, not steering), so don't use it.
Type caveats (neuPrint has no Gr/ppk labels): LB3 = sugar, LB1 = bitter, pC1_* pool = P1 are inferred from labellar bristle classes, not confirmed annotations.

## Input → command neurons (Hz per cell; sided columns L/R)

| input | cells | DNp01 | TTMn | MDN | DNa01 | DNa02 | DNb05 | DNb06 | DNp09 | DNg97 | DNg11 | DNg12 | MN9 | P1 (pC1) | pIP10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — baseline | 0 | 0 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sugar | 78 | 0 | 0 | 2 | 0/0 | 0/0 | 20/12 | 17/0 | 0 | 0 | 29 | 0 | 224 | 0 | 1 |
|   sugar L | 38 | 0 | 0 | 11 | 0/0 | 0/0 | 20/21 | 18/0 | 0 | 0 | 28 | 0 | 193 | 0 | 0 |
|   sugar R | 40 | 0 | 0 | 2 | 0/2 | 0/0 | 24/16 | 8/0 | 0 | 0 | 29 | 0 | 191 | 0 | 0 |
| bitter? LB4 | 12 | 0 | 0 | 94 | 0/0 | 3/0 | 19/18 | 0/0 | 0 | 0 | 17 | 168 | 66 | 0 | 0 |
| bitter? LB2 | 18 | 0 | 0 | 80 | 0/0 | 4/0 | 27/23 | 0/0 | 0 | 0 | 24 | 139 | 94 | 0 | 0 |
| bitter? LB1 | 57 | 0 | 2 | 81 | 0/0 | 0/0 | 29/28 | 67/1 | 0 | 0 | 19 | 0 | 0 | 0 | 1 |
| odor (banana ORNs) | 243 | 0 | 6 | 3 | 0/0 | 0/0 | 403/410 | 248/24 | 0 | 0 | 24 | 1 | 78 | 2 | 31 |
|   odor (banana ORNs) L | 108 | 0 | 4 | 5 | 0/0 | 3/0 | 403/409 | 244/28 | 0 | 0 | 24 | 1 | 77 | 2 | 28 |
|   odor (banana ORNs) R | 124 | 0 | 4 | 7 | 0/0 | 0/0 | 403/410 | 249/27 | 0 | 0 | 25 | 1 | 80 | 2 | 29 |
| loom (LC4+LPLC2) | 311 | 415 | 227 | 0 | 1/1 | 0/0 | 14/21 | 0/0 | 0 | 3 | 36 | 25 | 0 | 1 | 0 |
|   loom (LC4+LPLC2) L | 165 | 241 | 136 | 6 | 0/6 | 0/0 | 2/0 | 0/0 | 0 | 1 | 11 | 12 | 0 | 1 | 0 |
|   loom (LC4+LPLC2) R | 146 | 352 | 116 | 0 | 2/0 | 0/0 | 10/27 | 0/0 | 0 | 0 | 15 | 16 | 0 | 1 | 0 |
| female visual (LC10a) | 275 | 0 | 0 | 0 | 0/0 | 6/6 | 149/174 | 217/57 | 0 | 1 | 21 | 0 | 23 | 13 | 90 |
|   female visual (LC10a) L | 135 | 0 | 0 | 16 | 3/1 | 20/0 | 79/96 | 163/12 | 0 | 3 | 18 | 0 | 1 | 2 | 31 |
|   female visual (LC10a) R | 140 | 0 | 0 | 0 | 0/14 | 0/43 | 161/112 | 82/8 | 0 | 5 | 29 | 0 | 29 | 5 | 37 |
| female touch? (LgLG1) | 270 | 4 | 78 | 80 | 3/3 | 3/0 | 59/49 | 80/0 | 3 | 9 | 13 | 3 | 0 | 1 | 0 |
| groom (JO-FV) | 70 | 0 | 12 | 4 | 0/0 | 0/0 | 360/352 | 220/13 | 0 | 0 | 26 | 1 | 66 | 2 | 20 |
|   groom (JO-FV) L | 36 | 0 | 5 | 40 | 0/0 | 0/0 | 131/129 | 107/7 | 0 | 0 | 27 | 1 | 9 | 1 | 5 |
|   groom (JO-FV) R | 34 | 0 | 15 | 14 | 0/0 | 1/0 | 257/246 | 153/11 | 0 | 0 | 25 | 0 | 52 | 1 | 15 |
| groom (BM_InOm) | 745 | 0 | 0 | 167 | 0/0 | 0/0 | 11/4 | 34/1 | 0 | 0 | 24 | 72 | 77 | 1 | 0 |


## Surgeon operations (Hz per cell · first spike ms, seed 1)

| operation | read-out |
| --- | --- |
| loom | DNp01 415 · 3, TTMn 227 · 8, MDN 0 · —, DNp09 0 · — |
| loom + DNp01 off | DNp01 0 · —, TTMn 44 · 19, MDN 0 · —, DNp09 0 · — |
| MDN on | MDN 137 · 0, DNp09 0 · —, DNa02 0 · —, DNp01 0 · — |
| sugar | MN9 224 · 22, DNp09 0 · —, MDN 2 · 76 |
| sugar + LB3 off | MN9 0 · —, DNp09 0 · —, MDN 0 · — |
| bitter (LB1) | MDN 81 · 52, MN9 0 · —, DNp09 0 · — |
| female (LC10a) | P1 (pC1) 13 · 10, pIP10 90 · 16 |
| female (LC10a) + P1 off | P1 (pC1) 0 · —, pIP10 63 · 16 |
| P1 on | P1 (pC1) 130 · 0, pIP10 188 · 5 |
| DNp01 on (puppet ↑, 150 Hz) | DNp01 106 · 0, TTMn 86 · 12, MDN 0 · — |

Puppet ↑ (8.13, `--puppet`): driving DNp01 alone needs a far higher rate than a sense — Poisson 150 / 300 / 600 / 1000 / 1500 Hz → TTMn 86 / 137 / 183 / 212 / 226 (DNp01 106 → 355; loom gives DNp01 415, TTMn 227). `gain` changes nothing. `PUPPET.up.hz = 1000`. Silencing (panic op) blocks the drive, so «panic off» + ↑ = no jump.

## Bridge (8.3)

Code: [`packages/sim/src/bridge.ts`](../packages/sim/src/bridge.ts) — `SENSES` / `COMMANDS` / `OPERATIONS` groups, `senseDrive` + `diffDrive` (world → Poisson rows), `CommandMeter` (kernel rate per cell), `decide` (thresholds with hysteresis, jump > back > eat > court > walk), `eyes(bearing, x)`. Live Worker: `groups`, `watch`, `drive`, `silenceRows` by full-graph row.
Calibration: `pnpm -C apps/pipeline explore:terrarium --bridge` (≈ 40 s, no neuPrint): the closed loop the Terrarium runs (10 ms ticks, 300 ms, seeds 1–3, sides from `somaSide`; taste groups are unsided).

Findings:
- **One eye is not enough.** Loom on one eye → TTMn ≤ 187 (no jump on most seeds); female on one eye → MDN bursts and late courtship. Big things (swatter, shadow, a female nearby) are seen by both eyes, so the world sends the far eye ≥ ¾ of the near one (`eyes`). With ½ the loom from the right missed on one seed (LC4 R has 55 cells vs 71 L).
- Thresholds (on / off, kernel Hz per cell): jump TTMn 170 / 110, back MDN 60 / 35, eat MN9 150 / 100, court pIP10 50 / 30 **and** pC1 3 / 1.5. FlyCam's 200 Hz jump threshold stays as is (different kernel input: a whole-graph escape run).
- **P1 gate works**: P1 off leaves pIP10 at 112–140 Hz but pC1 at 0 → no courtship, so the «P1 off» card stays (open question from TERRARIUM-SHAPE closed).
- Latency (first tick over threshold): jump 30 ms, eat 60–70, back 60–70 (MDN on 20–50), court 40–110.

| case | expect | seed → first action @ ms · share of ticks | peak Hz min–max over seeds (TTMn / MDN / MN9 / pIP10 / pC1) | ok |
| --- | --- | --- | --- | --- |
| baseline | walk | walk; walk; walk | 0–0 / 0–0 / 0–0 / 0–0 / 0–0 | yes |
| loom L eye only | — | jump @ 290 · 7 %; walk; jump @ 30 · 13 % | 154–187 / 6–28 / 0–0 / 0–0 / 1–1 | — |
| loom R eye only | — | jump @ 40 · 10 %; jump @ 40 · 10 %; walk | 167–170 / 0–0 / 0–0 / 0–0 / 1–1 | — |
| loom ahead | jump | jump @ 30 · 93 %; jump @ 30 · 93 %; jump @ 30 · 93 % | 266–278 / 0–0 / 0–0 / 0–0 / 1–1 | yes |
| loom left | jump | jump @ 30 · 93 %; jump @ 30 · 93 %; jump @ 30 · 93 % | 271–284 / 0–0 / 0–0 / 0–0 / 1–1 | yes |
| loom right | jump | jump @ 30 · 93 %; jump @ 30 · 93 %; jump @ 30 · 93 % | 204–272 / 0–0 / 0–0 / 0–0 / 1–1 | yes |
| loom left + panic off | walk | walk; walk; walk | 86–134 / 0–0 / 0–0 / 0–0 / 1–1 | yes |
| loom ahead + panic off | walk | walk; walk; walk | 130–133 / 0–0 / 0–0 / 0–0 / 1–1 | yes |
| sugar | eat | eat @ 70 · 80 %; eat @ 70 · 80 %; eat @ 60 · 83 % | 0–0 / 6–12 / 249–253 / 0–10 / 0–0 | yes |
| sugar + sugar off | walk | walk; walk; walk | 0–0 / 0–0 / 0–0 / 0–0 / 0–0 | yes |
| bitter | back | back @ 70 · 80 %; back @ 60 · 83 %; back @ 60 · 63 % | 0–58 / 129–166 / 0–0 / 0–12 / 0–0 | yes |
| MDN on | back | back @ 50 · 87 %; back @ 30 · 93 %; back @ 20 · 97 % | 25–70 / 151–214 / 0–0 / 0–0 / 1–1 | yes |
| female ahead | court | court @ 100 · 70 %; court @ 100 · 70 %; court @ 40 · 70 % | 0–0 / 0–0 / 0–0 / 112–164 / 18–23 | yes |
| female L eye only | — | back @ 140 · 33 %; walk; court @ 260 · 17 % | 0–0 / 6–112 / 0–20 / 54–85 / 2–5 | — |
| female left | court | court @ 90 · 53 %; court @ 100 · 70 %; court @ 90 · 73 % | 0–0 / 0–27 / 0–0 / 114–135 / 17–17 | yes |
| female left + P1 off | walk | walk; walk; walk | 0–0 / 0–0 / 81–104 / 112–120 / 0–0 | yes |
| female ahead + P1 off | walk | walk; walk; walk | 0–0 / 0–0 / 39–103 / 129–140 / 0–0 | yes |
| banana odor | walk | walk; walk; walk | 29–40 / 6–19 / 91–93 / 45–53 / 3–3 | yes |

### Long run (8.5, world + sim headless, 1.5 s, seeds 1–3)
The 300 ms table above misses a slow drift: under sustained sugar or female drive MDN creeps to 47–135 Hz after 450–600 ms and broke off eating / courting into `back`. Fixes: an ongoing eat / court yields to back only at `PREEMPT_BACK` = 150 Hz (bitter from walk still uses 60); court + gate kernels τ = 120 ms (pIP10 fires in bursts; 40 ms dropped courtship between them); female seen at full strength within 3 mm (world `FEMALE_FULL`; at 3 mm to the side the old linear falloff gave pC1 ≈ 2 Hz < gate 3). After: sugar → eat for the whole run on all seeds; female ahead / left → court (seed 3 hesitates once into back ≈ 300 ms when court dips below its off level); bitter → back; empty dish → walk.

## Norm table (9.2)

Script: `pnpm -C apps/pipeline explore:norm [--write]` ([explore/norm.ts](../apps/pipeline/src/explore/norm.ts)): world + sim headless, 1 ms ticks as `DishLoop`, scripted delivery from `packages/sim/src/deliver.ts` (the same take the experiment card runs), 7 stimuli × (none + 4 ops + exploratory P1 on) × seeds 1–3, ≈ 4.5 min. `--write` regenerates `apps/web/src/scene/dish/table.ts` (card ops only).

Seeds 1–3, 1500 ms. Columns: brain state (none, DNp01 off, MDN on, sugar GRNs off, P1 off, P1 on).

First decision · ms from sense onset · `~` = seeds disagree · ✗hit = swatter hit.

| stimulus | none | panic | moon | sugar | p1 | p1on |
| --- | --- | --- | --- | --- | --- | --- |
| sugar | eat 61 | eat 61 | back | walk | eat 61 | court |
| bitter | back 60 | back 60 | back 2 | back 60 | back 60 | court |
| banana | walk | walk | back | walk | walk | court |
| female | court 110 | court 110 | back | court 110 | walk | court 28 |
| shadow | jump 35 | walk | back | jump 35 | jump 35 | court |
| swatter | jump 24 | back ✗hit | ~back | jump 24 | jump 24 | jump 27 |
| none | walk | walk | back | walk | walk | court |

Per seed: action sequence @ first decision ms (peak Hz TTMn / MDN / MN9 / pIP10 / pC1)

- sugar × none: eat @84 (0/104/259/4/0); eat @82 (0/78/260/0/0); eat @81 (0/79/258/0/0)
- sugar × panic: eat @84 (0/104/259/4/0); eat @82 (0/78/260/0/0); eat @81 (0/79/258/0/0)
- sugar × moon: back @26 (57/154/91/39/2); back @29 (76/183/91/37/2); back @16 (91/221/0/0/0)
- sugar × sugar: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- sugar × p1: eat @84 (0/104/259/4/0); eat @82 (0/78/260/0/0); eat @81 (0/79/258/0/0)
- sugar × p1on: court→back @59 (0/191/38/216/135); court→back→court→back→court→back→court @44 (0/229/0/214/134); court→back @60 (0/213/33/214/135)
- bitter × none: back @82 (74/177/0/0/0); back @81 (39/129/99/41/3); back @79 (46/139/100/40/3)
- bitter × panic: back @82 (74/177/0/0/0); back @81 (39/129/99/41/3); back @79 (46/139/100/40/3)
- bitter × moon: back @23 (93/234/81/24/1); back @35 (29/167/92/38/2); back @16 (91/221/0/0/0)
- bitter × sugar: back @82 (74/177/0/0/0); back @81 (39/129/99/41/3); back @79 (46/139/100/40/3)
- bitter × p1: back @82 (44/177/0/0/0); back @81 (48/129/103/36/0); back @79 (29/139/88/31/0)
- bitter × p1on: court→back→court→back→court @45 (0/223/38/216/135); court→back→court→back→court→back→court→back @43 (0/225/0/211/134); court→back @52 (0/214/33/214/135)
- banana × none: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- banana × panic: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- banana × moon: back @23 (78/163/95/32/2); back @23 (25/220/97/37/2); back @16 (91/221/0/0/0)
- banana × sugar: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- banana × p1: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- banana × p1on: court→back→court @49 (0/212/38/215/135); court→back→court→back @47 (0/202/0/203/133); court→back @47 (0/193/33/224/135)
- female × none: court @99 (0/0/89/132/20); court @111 (0/0/12/131/20); court @113 (0/12/0/127/18)
- female × panic: court @99 (0/0/89/132/20); court @111 (0/0/12/131/20); court @113 (0/12/0/127/18)
- female × moon: back @36 (26/179/91/53/9); back @39 (32/176/107/62/10); back @25 (25/178/90/54/9)
- female × sugar: court @99 (0/0/89/132/20); court @111 (0/0/12/131/20); court @113 (0/12/0/127/18)
- female × p1: walk (45/8/116/83/0); walk (37/12/130/72/0); walk (49/14/96/77/0)
- female × p1on: court @29 (0/0/40/306/138); court @24 (0/0/23/288/134); court @29 (0/0/55/293/137)
- shadow × none: jump @35 (237/0/0/0/0); jump→back→jump @38 (242/135/0/0/0); jump @36 (222/23/92/43/3)
- shadow × panic: walk (84/0/0/0/1); walk (139/0/0/0/1); walk (152/0/0/0/1)
- shadow × moon: back→jump→back→jump→back→jump→back→jump→back @22 (215/167/88/35/2); back→jump→back→jump→back→jump→back→jump→back @35 (235/250/78/32/2); back→jump→back→jump→back→jump→back→jump→back @23 (234/211/87/35/2)
- shadow × sugar: jump @35 (237/0/0/0/0); jump→back→jump @38 (242/135/0/0/0); jump @36 (222/23/92/43/3)
- shadow × p1: jump→back→jump→back @35 (248/149/0/0/0); jump→back @38 (232/99/0/0/0); jump @36 (216/13/91/33/0)
- shadow × p1on: court→jump→court→back→jump→back→jump→back @52 (222/187/43/213/135); court→jump→court→jump→court→jump→court @48 (209/0/110/243/133); court→jump→court→back→jump→back→jump→back→court→back @65 (198/196/33/202/133)
- swatter × none: jump @25 (227/32/101/43/3); jump→back @25 (233/76/101/42/3); jump @25 (244/48/99/43/3)
- swatter × panic: back @300 (133/164/0/0/0); back @232 (132/240/0/0/1); back @228 (130/138/0/0/1)
- swatter × moon: back→jump→back @17 (233/182/86/31/2); jump→back @25 (226/222/62/26/1); back→jump→back @23 (228/195/88/36/2)
- swatter × sugar: jump @25 (227/32/101/43/3); jump→back @25 (233/76/101/42/3); jump @25 (244/48/99/43/3)
- swatter × p1: jump→back @25 (226/210/12/8/0); jump @25 (233/17/101/35/0); jump→back @25 (244/92/94/36/0)
- swatter × p1on: jump→court→back @29 (237/230/0/208/134); jump→court→back→court→back→court→back→court @28 (213/224/0/206/134); jump→court→back→court→back→court→back @28 (232/186/0/220/134)
- none × none: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- none × panic: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- none × moon: back @23 (78/163/95/32/2); back @23 (25/220/97/37/2); back @16 (91/221/0/0/0)
- none × sugar: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- none × p1: walk (0/0/0/0/0); walk (0/0/0/0/0); walk (0/0/0/0/0)
- none × p1on: court→back→court @49 (0/212/38/215/135); court→back→court→back @47 (0/202/0/203/133); court→back @47 (0/193/33/224/135)

### Findings
- **Every normal pair is robust** over seeds: sugar → eat, bitter → back, female → court, shadow → jump, swatter → jump (escapes, no hit), nothing / banana → walk. Latency from sense onset: swatter 24, shadow 35, bitter 60, sugar 61, female 110 ms (onset = first tick the sense is on; the sugar walk-in before contact is ≈ 20 ms more). These replace `USUAL.ms` (8.1 first-spike numbers, open loop) for the card's «обычно» row.
- **Ops are specific**: each changes only its own path (DNp01 off leaves eat / back / court alone; sugar GRNs off leaves bitter, loom and female alone; P1 off leaves loom and taste alone).
- **DNp01 off**: shadow → walk (TTMn peaks 84–152 < 170); swatter → **hit** in every seed (the fly backs only after it reassembles, not an escape). The strongest result in the table.
- **MDN on** backs with any stimulus and with nothing (onset ≈ 16–23 ms after start); it overrides eat and court. With loom it flickers back ↔ jump (both commands high), so shadow / swatter × MDN on are not robust → not discoveries.
- **P1 on** (pC1 at 150 Hz) courts with anything, but flickers court ↔ back (MDN 190–230 Hz) in 5 of 7 stimuli; robust only with the female (court at 24–29 ms instead of 110). **Not added as a fifth op.**
- **Banana** never reaches a decision (no steering from the connectome, nothing at the source).

### Decisions (EXPERIMENT-SHAPE §Open)
- **Stimulus slot = 6 rows**: sugar, bitter, female, shadow, swatter, «Ничего не даём». Banana leaves the slot (palette free play only). «Ничего» stays: it is the clean MDN-on experiment and the control for every op.
- **Run end**: first decision + 300 ms tail (the action plays out; a swatter hit is at 120 ms), or 600 ms with no decision (latest normal decision 113 ms sim; slowest op result — swatter hit — at 120).
- **Ops**: the four card ops stay; P1 on stays a brain-view edit.

### Discoveries (12) and bets
Bet chips: «Съест» (eat) · «Попятится» (back) · «Взлетит» (jump) · «Будет ухаживать» (court) · «Пойдёт дальше» (walk) · «Не успеет» (hit). Three per pair: the norm, the actual result, one plausible distractor (order shuffled per visit). Titles and teasers are drafts for the RU copy pass in 9.6.

| # | stimulus × op | result (norm) | bet chips | teaser (locked) |
| --- | --- | --- | --- | --- |
| 1 | sugar × none | eat | eat · walk · back | What does she do with sugar? |
| 2 | bitter × none | back | back · eat · walk | And with something bitter? |
| 3 | shadow × none | jump | jump · back · walk | A shadow from above. |
| 4 | female × none | court (he) | court · walk · back | A female nearby. |
| 5 | swatter × DNp01 off | **hit** (norm jump) | jump · hit · back | Let the swatter land (puzzle 1) |
| 6 | sugar × sugar GRNs off | **walk** (norm eat) | eat · walk · back | Sugar she ignores (puzzle 2) |
| 7 | female × P1 off | **walk** (norm court) | court · walk · back | A female he ignores (puzzle 3) |
| 8 | nothing × MDN on | **back** (norm walk) | walk · back · jump | Backwards with nothing at all (puzzle 4) |
| 9 | shadow × DNp01 off | **walk** (norm jump) | jump · walk · back | A shadow that doesn't scare |
| 10 | sugar × MDN on | **back** (norm eat) | eat · back · walk | Sugar she backs away from |
| 11 | female × MDN on | **back** (norm court) | court · back · walk | Backing away from a female |
| 12 | bitter × sugar GRNs off | back (unchanged) | back · walk · eat | Sugar off — does bitter still work? |

1–4 teach the norm (found on the first run of each stimulus); 5–8 are the Phase 8 puzzles (first guided discoveries); 9–12 show reach (one cell, one escape), override (MDN beats eat, court) and specificity (an op only touches its own path).
