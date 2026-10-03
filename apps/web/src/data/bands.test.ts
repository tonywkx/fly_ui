import { decodeMeta, encodeMeta, type NeuronRecord } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { BAND, bandOf, lanes } from './bands';

const record = (
  type: string | null,
  region: string | null,
  superclass: string | null = null,
): NeuronRecord => ({
  bodyId: Math.random() * 1e9,
  type,
  class: null,
  superclass,
  nt: null,
  ntConf: null,
  sign: 0,
  region,
  somaSide: null,
  maleSpecific: false,
});

describe('bandOf', () => {
  it('sorts primary ROIs into optic / central / VNC, descending neurons by superclass', () => {
    expect(bandOf('LO(R)', 'visual_projection')).toBe(BAND.optic);
    expect(bandOf('LOP(L)', null)).toBe(BAND.optic);
    expect(bandOf('ME(L)', null)).toBe(BAND.optic);
    expect(bandOf('GNG', 'cb_intrinsic')).toBe(BAND.central);
    expect(bandOf('SAD', null)).toBe(BAND.central);
    expect(bandOf('AVLP(R)', null)).toBe(BAND.central);
    expect(bandOf(null, null)).toBe(BAND.central);
    expect(bandOf('GNG', 'descending_neuron')).toBe(BAND.descending);
    expect(bandOf('WTct(UTct-T2)(R)', 'vnc_intrinsic')).toBe(BAND.vnc);
    expect(bandOf('LegNp(T3)(L)', 'vnc_motor')).toBe(BAND.vnc);
    expect(bandOf('IntTct', null)).toBe(BAND.vnc);
    expect(bandOf('ANm', 'ascending_neuron')).toBe(BAND.vnc);
    expect(bandOf('Ov(L)', null)).toBe(BAND.vnc);
    expect(bandOf('DMetaN(R)', null)).toBe(BAND.vnc);
    expect(bandOf('mVAC(T1)(L)', null)).toBe(BAND.vnc);
  });
});

describe('lanes', () => {
  it('ranks rows within their band, same types adjacent', () => {
    const meta = decodeMeta(
      encodeMeta([
        record('LC4', 'LO(R)'), // 0 optic
        record('TTMn', 'LegNp(T2)(L)'), // 1 vnc
        record('LPLC2', 'LOP(R)'), // 2 optic
        record('LC4', 'LO(L)'), // 3 optic
        record('GF', 'GNG', 'descending_neuron'), // 4 descending
      ]),
    );
    const l = lanes(meta);
    expect([...l.band]).toEqual([BAND.optic, BAND.vnc, BAND.optic, BAND.optic, BAND.descending]);
    expect([...l.counts]).toEqual([3, 0, 1, 1]);
    // optic: LC4 (0, 3) then LPLC2 (2) → ranks 0, 1/3, 2/3
    expect(l.rank[0]).toBeCloseTo(0);
    expect(l.rank[3]).toBeCloseTo(1 / 3);
    expect(l.rank[2]).toBeCloseTo(2 / 3);
    expect(l.rank[1]).toBe(0);
    expect(l.rank[4]).toBe(0);
  });
});
