import { decodeMeta, encodeMeta, type NeuronRecord, type Nt } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { MALE, NT_COLORS } from '../ui/palette';
import {
  CLASS_GROUPS,
  classGroup,
  colorGroups,
  fillTints,
  nextColorBy,
  REGION_GROUPS,
  regionGroup,
} from './colorBy';

const record = (r: Partial<NeuronRecord>): NeuronRecord => ({
  bodyId: Math.random() * 1e9,
  type: null,
  class: null,
  superclass: null,
  nt: null,
  ntConf: null,
  sign: 0,
  region: null,
  somaSide: null,
  maleSpecific: false,
  ...r,
});

const label = (groups: readonly string[], i: number) => groups[i];

describe('regionGroup', () => {
  it('merges hemispheres and sorts ROIs into coarse neuropil groups', () => {
    const g = (r: string | null) => label(REGION_GROUPS, regionGroup(r));
    expect(g('LO(L)')).toBe('optic lobe');
    expect(g('LOP(R)')).toBe('optic lobe');
    expect(g('ME(R)')).toBe('optic lobe');
    expect(g('AVLP(R)')).toBe('central brain');
    expect(g('SIP(L)')).toBe('central brain');
    expect(g('GNG')).toBe('subesophageal zone');
    expect(g('SAD')).toBe('subesophageal zone');
    expect(g('FLA(R)')).toBe('subesophageal zone');
    expect(g('WTct(UTct-T2)(R)')).toBe('upper tectulum');
    expect(g('HTct(UTct-T3)(L)')).toBe('upper tectulum');
    expect(g('NTct(UTct-T1)(L)')).toBe('upper tectulum');
    expect(g('LTct')).toBe('lower tectulum');
    expect(g('IntTct')).toBe('lower tectulum');
    expect(g('LegNp(T1)(L)')).toBe('leg neuropils');
    expect(g('mVAC(T2)(R)')).toBe('leg neuropils');
    expect(g('ANm')).toBe('abdominal');
    expect(g('Ov(L)')).toBe('other VNC');
    expect(g(null)).toBe('unknown');
  });
});

describe('classGroup', () => {
  it('groups superclasses', () => {
    const g = (s: string | null) => label(CLASS_GROUPS, classGroup(s));
    expect(g('cb_sensory')).toBe('sensory');
    expect(g('vnc_sensory')).toBe('sensory');
    expect(g('sensory_ascending')).toBe('sensory');
    expect(g('visual_projection')).toBe('visual');
    expect(g('visual_centrifugal')).toBe('visual');
    expect(g('ol_intrinsic')).toBe('visual');
    expect(g('cb_intrinsic')).toBe('central intrinsic');
    expect(g('descending_neuron')).toBe('descending');
    expect(g('vnc_intrinsic')).toBe('VNC intrinsic');
    expect(g('ascending_neuron')).toBe('ascending');
    expect(g('efferent_ascending')).toBe('ascending');
    expect(g('vnc_motor')).toBe('motor & efferent');
    expect(g('cb_motor')).toBe('motor & efferent');
    expect(g('vnc_efferent')).toBe('motor & efferent');
    expect(g(null)).toBe('unknown');
    expect(g('something_new')).toBe('unknown');
  });
});

describe('colorGroups', () => {
  const meta = decodeMeta(
    encodeMeta([
      record({ nt: 'acetylcholine', region: 'LO(R)', superclass: 'visual_projection' }),
      record({ nt: 'gaba', region: 'LO(L)', superclass: 'visual_projection', maleSpecific: true }),
      record({ nt: 'acetylcholine', region: 'GNG', superclass: 'descending_neuron' }),
      record({ nt: null, region: null, superclass: null }),
    ]),
  );

  it('colours by transmitter, null as unclear; legend lists present groups only, most first', () => {
    const c = colorGroups(meta, 'nt');
    expect(c.legend.map((e) => [e.label, e.count])).toEqual([
      ['acetylcholine', 2],
      ['gaba', 1],
      ['unclear', 1],
    ]);
    expect(c.legend[0]?.swatch).toBe(NT_COLORS.acetylcholine);
    expect(c.swatches[c.group[3] as number]).toBe(NT_COLORS.unclear);
  });

  it('colours by region group, hemispheres merged', () => {
    const c = colorGroups(meta, 'region');
    expect(c.group[0]).toBe(c.group[1]);
    expect(c.legend.map((e) => [e.label, e.count])).toEqual([
      ['optic lobe', 2],
      ['subesophageal zone', 1],
      ['unknown', 1],
    ]);
  });

  it('keeps the fixed group order (signal flow) over counts for region and class', () => {
    const c = colorGroups(meta, 'class');
    expect(c.legend.map((e) => e.label)).toEqual(['visual', 'descending', 'unknown']);
  });

  it('highlights male-specific neurons', () => {
    const c = colorGroups(meta, 'male');
    expect(c.legend.map((e) => [e.label, e.count])).toEqual([
      ['male-specific', 1],
      ['other', 3],
    ]);
    expect(c.swatches[c.group[1] as number]).toBe(MALE);
  });

  it('gives every group a distinct swatch', () => {
    for (const mode of ['nt', 'region', 'class', 'male'] as const) {
      const { swatches } = colorGroups(meta, mode);
      expect(new Set(swatches.map((s) => s.hex)).size, mode).toBe(swatches.length);
    }
  });
});

describe('fillTints', () => {
  it('writes the linear rgb of each row group, stride 4', () => {
    const meta = decodeMeta(encodeMeta([record({ nt: 'gaba' as Nt }), record({ nt: 'glutamate' as Nt })]));
    const out = new Float32Array(12).fill(-1);
    fillTints(out, colorGroups(meta, 'nt'));
    expect([...out.subarray(0, 3)]).toEqual([...NT_COLORS.gaba.rgb].map(Math.fround));
    expect([...out.subarray(4, 7)]).toEqual([...NT_COLORS.glutamate.rgb].map(Math.fround));
    // rows past the table are left alone
    expect(out[8]).toBe(-1);
  });
});

describe('nextColorBy', () => {
  it('cycles through the modes', () => {
    expect(nextColorBy('nt')).toBe('region');
    expect(nextColorBy('class')).toBe('male');
    expect(nextColorBy('male')).toBe('nt');
  });
});
