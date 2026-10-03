import { csrFromEdges, decodeMeta, encodeMeta, type NeuronRecord } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { focusRoles, partners, ROLE } from './partners';

const record = (bodyId: number, type: string | null): NeuronRecord => ({
  bodyId,
  type,
  class: null,
  superclass: null,
  nt: type ? 'acetylcholine' : null,
  ntConf: null,
  sign: 1,
  region: null,
  somaSide: null,
  maleSpecific: false,
});

// rows: 0 GF, 1 LPLC2, 2 LPLC2, 3 untyped, 4 TTMn
const meta = decodeMeta(
  encodeMeta([
    record(10, 'GF'),
    record(11, 'LPLC2'),
    record(12, 'LPLC2'),
    record(13, null),
    record(14, 'TTMn'),
  ]),
);
// 1→0 (5), 2→0 (9), 3→0 (2), 0→4 (30), 0→3 (1), 4→1 (4)
const csr = csrFromEdges(5, [1, 2, 3, 0, 0, 4], [0, 0, 0, 4, 3, 1], [5, 9, 2, 30, 1, 4]);

describe('partners', () => {
  it('groups inputs by type, strongest first, with the strongest neuron of each group', () => {
    const { inputs } = partners(csr, meta, 0);
    expect(inputs).toEqual([
      { type: 'LPLC2', nt: 'acetylcholine', count: 2, synapses: 14, top: 2 },
      { type: null, nt: null, count: 1, synapses: 2, top: 3 },
    ]);
  });

  it('lists outputs from the row itself', () => {
    const { outputs } = partners(csr, meta, 0);
    expect(outputs.map((p) => [p.type, p.synapses, p.top])).toEqual([
      ['TTMn', 30, 4],
      [null, 1, 3],
    ]);
  });

  it('is empty for an isolated row', () => {
    const lone = csrFromEdges(5, [], [], []);
    expect(partners(lone, meta, 0)).toEqual({ inputs: [], outputs: [] });
  });
});

describe('focusRoles', () => {
  it('marks selected, inputs, outputs and both', () => {
    const roles = focusRoles(csr, 0);
    expect(Array.from(roles)).toEqual([ROLE.selected, ROLE.input, ROLE.input, ROLE.both, ROLE.output]);
  });

  it('keeps the selected role on a self-loop', () => {
    const self = csrFromEdges(2, [0, 1], [0, 0], [1, 1]);
    expect(Array.from(focusRoles(self, 0))).toEqual([ROLE.selected, ROLE.input]);
  });
});
