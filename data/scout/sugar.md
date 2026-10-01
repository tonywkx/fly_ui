# Sugar scout (male-cns:v1.0)

Data in sugar.json (277 types, 945 neurons, 3925 type edges >=50). Core 85, extended 860.

## Main path
```
BM_Taste (40, ACh .94, labellar/MxLbN taste GRNs; sugar subset unresolved)
  --1376--> GNG015 (2, GABA .82) --478--> MN9 (2)   ; --155--> MN8 (2)
  --215---> GNG095 (2, GABA .86) --436--> MN9
  --472---> DNge055 (2, Glu .72) --63--> MN9 ; --71--> MN6 (2)
  --490---> GNG568 (2, ACh) --450--> DNge051 (2, GABA) --231--> MN9
  --332---> GNG403 (GABA) --200--> MN6 ; --315--> DNg54 (ACh) --142--> MN6
  --179---> GNG018 (ACh) --180--> MN12D (4)
Excitatory MN9 premotor not reached from GRNs: DNge062 (ACh .93) --556--> MN9, DNge080 --219--> MN9
```
Pharyngeal MN11D/V, MN12D are driven mostly by GNG334/GNG019/GNG001 (outside core).

## Anchors
| type | n | NT (conf) | note |
|---|---|---|---|
| BM_Taste | 40 | ACh .94 | best available sugar GRN proxy (no Gr5a/Gr64f type) |
| claw_tpGRN / dorsal_tpGRN | 50 / 10 | ACh | taste-peg GRNs, extended |
| MN9 | 2 | unclear .49 | rostrum protractor (PER), sign 0 |
| MN6, MN8, MN11D/V, MN12D | 2,2,3,2,4 | ACh .55-.68 | proboscis / pharynx MNs |
| Fdg, Rattle, G2N, IN1 | - | - | not typed in male-cns |

## Extended rule
Types <=100 neurons with summed weight >=200 (either direction) to core, plus claw/dorsal tpGRN.
BM_InOm (745) excluded for size. Threshold 200 gives 945 total (500 -> ~410, 100 -> ~1370).

## Notes
- No direct GRN->MN9 synapses; all routes are 2-hop through SEZ (GNG*) interneurons.
- Strongest GRN-reachable MN9 input GNG015 is GABA: sign ambiguity flagged in overrides/openQuestions.
- ISN (4 cells) exists but wires to DNd01/PRW/AstA1, not this path; excluded.
- Low-confidence NT (<0.6) or unclear => sign 0.
