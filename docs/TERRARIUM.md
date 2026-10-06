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
