# Song scout (male-cns:v1.0)

Data in song.json (234 types, 2899 type edges >=50, 1703 neurons: core 158, extended +1545). 59 types flagged maleSpecific (fruDsx != fru_low).

## Main path
```
P1 = pC1_14a (6) --962--> pMP2 (2) --1750--> dPR1 (2) --593--> hg1 MN (wing steering)
pC1_14a --565--> pIP10 (2) --1112--> dPR1 ; dPR1 --435--> b3 MN ; dPR1 <-> dPR1 (1023, recurrent)
pIP10/pMP2 --940/433--> TN1a_g (4) --771--> hg3 MN ; --720--> DLMn c-f ; --495--> hg4 MN
pIP10 --608/607/392--> vPR9_a/c/b (GABA) --809--> vMS11 (14, Glu) --1074--> ps1 MN ; --1128--> MNwm36
vPR9_a/c --334/519--> pIP10 (feedback inhibition)
pIP10 --311..479--> TN1a_a..i (sine-song, TN1A); TN1a --~380--> vPR9_a/c
vPR6 (8) --1123--> hg1 MN ; vMS11 --627--> vPR6 (inh)
```

## Anchors found (type: neurons)
pIP10 2 (fru_high), pMP2 2, pIP1 2, DNp13 2 (dsx), DNp62 2 (fru), dPR1 2, vPR6 8, vPR9_a/b/c 4/2/3, vMS11 14,
TN1a_a..i 2-4 each (20 total), pC1_* core 9 types / 33 neurons (P1 has no literal type; 52 pC1 types total).
MNs: hg1-4, ps1, ps2, b1-3, i1, i2, iii1, iii3, tp1, tp2, tpn, MNwm35/36, DLMn a,b / c-f, DVMn 1a-c / 2a,b / 3a,b.

## Sizing
- core = literature path members (above) + pC1 types with summed weight >=100 to pIP10/pMP2/pIP1.
- extended = non-core types with summed weight >=1200 (either direction) to core (1200 -> 1703 total; 800 -> ~2.3k; 2000 -> ~830).
- Biggest extended: LC16 (182, ->pIP1), SApp (148), LPLC4 (97), JO-EV2 (36, auditory, ->pIP1 1350), dMS2 (20, fru).

## Notes
- Signs from NT: ACh +, GABA/Glu -. Motor-neuron presynaptic sign set to 0 (NT predictions noisy; MNs excite muscle via Glu).
- Overrides: P1->pIP10 under-represented, dPR1/vPR6 recurrent, vPR9->pIP10 feedback, vMS11 sign, MN output.
- Refs: von Philipsborn 2011; Clyne & Miesenbock 2008; Lillvis 2024; Shirangi 2016. See openQuestions in JSON.
