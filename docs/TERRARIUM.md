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
