import { describe, expect, it } from 'vitest';
import { parseParams } from './params';
import { encodeExperiment } from './share';

describe('parseParams', () => {
  it('defaults to nothing set', () => {
    expect(parseParams('')).toEqual({ params: { stats: false, snap: false }, warnings: [] });
  });

  it('reads every known param', () => {
    const { params, warnings } = parseParams(
      '?snap=1&scenario=escape&t=40.5&debug=soma-dist&stats=1&ui=inspector&gl=webgl2&intro=1200&quality=low',
    );
    expect(warnings).toEqual([]);
    expect(params).toEqual({
      scenario: 'escape',
      t: 40.5,
      debug: 'soma-dist',
      stats: true,
      snap: true,
      ui: 'inspector',
      gl: 'webgl2',
      intro: 1200,
      quality: 'low',
    });
  });

  it('reads a pick point as viewport fractions', () => {
    expect(parseParams('?pick=0.5,0.25')).toEqual({
      params: { stats: false, snap: false, pick: [0.5, 0.25] },
      warnings: [],
    });
    for (const bad of ['0.5', '1.2,0.5', 'a,b', '0.5,-0.1', '0.5,0.5,0.5']) {
      const { params, warnings } = parseParams(`?pick=${bad}`);
      expect(params.pick).toBeUndefined();
      expect(warnings).toHaveLength(1);
    }
  });

  it('reads a colour mode', () => {
    expect(parseParams('?color=region').params.color).toBe('region');
    const { params, warnings } = parseParams('?color=rainbow');
    expect(params.color).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it('reads a selected bodyId', () => {
    expect(parseParams('?select=10293').params.select).toBe(10293);
    for (const bad of ['', 'x', '-3', '1.5']) {
      const { params, warnings } = parseParams(`?select=${bad}`);
      expect(params.select).toBeUndefined();
      expect(warnings).toHaveLength(1);
    }
  });

  it('reads electrode bodyIds', () => {
    expect(parseParams('?probes=10293,7').params.probes).toEqual([10293, 7]);
    for (const bad of ['', 'x', '1,,2', '1,2,3,4,5']) {
      const { params, warnings } = parseParams(`?probes=${bad}`);
      expect(params.probes).toBeUndefined();
      expect(warnings).toHaveLength(1);
    }
  });

  it('reads tracer ends (type names may hold commas and spaces)', () => {
    expect(parseParams('?trace=LPLC2>TTMn').params.trace).toEqual({ from: 'LPLC2', to: 'TTMn', path: 0 });
    expect(parseParams(`?trace=${encodeURIComponent('LC4>DLMn a, b>2')}`).params.trace).toEqual({
      from: 'LC4',
      to: 'DLMn a, b',
      path: 2,
    });
    for (const bad of ['', 'LC4', 'LC4>', 'a>b>x', 'a>b>1>2']) {
      const { params, warnings } = parseParams(`?trace=${encodeURIComponent(bad)}`);
      expect(params.trace).toBeUndefined();
      expect(warnings).toHaveLength(1);
    }
  });

  it('treats bare / truthy flags as on, 0/false as off', () => {
    expect(parseParams('?stats').params.stats).toBe(true);
    expect(parseParams('?stats=true').params.stats).toBe(true);
    expect(parseParams('?stats=0').params.stats).toBe(false);
    expect(parseParams('?stats=false').params.stats).toBe(false);
  });

  it('drops invalid values with a warning', () => {
    const { params, warnings } = parseParams('?debug=bogus&t=-3&scenario=../x');
    expect(params).toEqual({ stats: false, snap: false });
    expect(warnings).toHaveLength(3);
    expect(warnings.join()).toMatch(/debug.*bogus/);
  });

  it('warns on non-numeric t', () => {
    expect(parseParams('?t=abc').warnings).toHaveLength(1);
  });

  it('warns on a negative intro time', () => {
    const { params, warnings } = parseParams('?intro=-1');
    expect(params.intro).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it('accepts only webgl2 for gl', () => {
    const { params, warnings } = parseParams('?gl=webgpu');
    expect(params.gl).toBeUndefined();
    expect(warnings).toEqual(['gl: expected "webgl2", got "webgpu"']);
  });

  it('accepts only preset ids for quality', () => {
    const { params, warnings } = parseParams('?quality=ultra');
    expect(params.quality).toBeUndefined();
    expect(warnings).toEqual(['quality: unknown preset "ultra" (low | med | high)']);
  });

  it('accepts baked | live for sim', () => {
    expect(parseParams('?sim=live').params.sim).toBe('live');
    const { params, warnings } = parseParams('?sim=fast');
    expect(params.sim).toBeUndefined();
    expect(warnings).toEqual(['sim: expected "baked" | "live", got "fast"']);
  });

  it('reads a shared experiment code', () => {
    const e = { stimulated: [7], silenced: [10001], stim: { hz: 200, gain: 1.5 } };
    expect(parseParams(`?x=${encodeExperiment(e)}`)).toEqual({
      params: { stats: false, snap: false, experiment: e },
      warnings: [],
    });
    const { params, warnings } = parseParams('?x=zz');
    expect(params.experiment).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it('ignores unknown keys silently', () => {
    expect(parseParams('?foo=1').warnings).toEqual([]);
  });
});
