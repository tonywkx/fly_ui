import { describe, expect, it } from 'vitest';
import { parseParams } from './params';
import { encodeExperiment } from './share';

describe('parseParams', () => {
  it('defaults to nothing set', () => {
    expect(parseParams('')).toEqual({ params: { stats: false, snap: false, view: 'dish' }, warnings: [] });
  });

  it('reads every known param', () => {
    const { params, warnings } = parseParams(
      '?snap=1&scenario=escape&t=40.5&debug=soma-dist&stats=1&ui=inspector&gl=webgl2&intro=1200&quality=low',
    );
    expect(warnings).toEqual([]);
    expect(params).toEqual({
      view: 'brain',
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
      params: { stats: false, snap: false, view: 'brain', pick: [0.5, 0.25] },
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
    expect(parseParams('?director').params.director).toBe(true);
    expect(parseParams('?director=0').params).not.toHaveProperty('director');
  });

  it('drops invalid values with a warning', () => {
    const { params, warnings } = parseParams('?debug=bogus&t=-3&scenario=../x');
    expect(params).toEqual({ stats: false, snap: false, view: 'brain' });
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

  it('accepts ru | en for lang', () => {
    expect(parseParams('?lang=en').params.lang).toBe('en');
    const { params, warnings } = parseParams('?lang=de');
    expect(params.lang).toBeUndefined();
    expect(warnings).toEqual(['lang: expected "ru" | "en", got "de"']);
  });

  it('accepts baked | live for sim', () => {
    expect(parseParams('?sim=live').params.sim).toBe('live');
    const { params, warnings } = parseParams('?sim=fast');
    expect(params.sim).toBeUndefined();
    expect(warnings).toEqual(['sim: expected "baked" | "live", got "fast"']);
  });

  it('accepts a tour step 0..4 (0 = off)', () => {
    expect(parseParams('?tour=0').params.tour).toBe(0);
    expect(parseParams('?tour=3').params.tour).toBe(3);
    for (const v of ['5', '1.5', 'x', '']) {
      const { params, warnings } = parseParams(`?tour=${v}`);
      expect(params.tour).toBeUndefined();
      expect(warnings).toEqual([`tour: expected 0..4, got "${v}"`]);
    }
  });

  it('reads a shared experiment code', () => {
    const e = { stimulated: [7], silenced: [10001], stim: { hz: 200, gain: 1.5 } };
    expect(parseParams(`?x=${encodeExperiment(e)}`)).toEqual({
      params: { stats: false, snap: false, view: 'brain', experiment: e },
      warnings: [],
    });
    const { params, warnings } = parseParams('?x=zz');
    expect(params.experiment).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it('ignores unknown keys silently', () => {
    expect(parseParams('?foo=1').warnings).toEqual([]);
  });

  it('reads the dish view and its items', () => {
    const { params, warnings } = parseParams('?view=dish&items=sugar@3,0;bitter@-4.5,2;female@0,5');
    expect(warnings).toEqual([]);
    expect(params.view).toBe('dish');
    expect(params.items).toEqual([
      { kind: 'sugar', x: 3, y: 0 },
      { kind: 'bitter', x: -4.5, y: 2 },
      { kind: 'female', x: 0, y: 5 },
    ]);
  });

  it('drops a bad view or item list', () => {
    const { params, warnings } = parseParams('?view=pond&items=salt@1,1');
    expect(params.view).toBe('dish');
    expect(params.items).toBeUndefined();
    expect(warnings).toHaveLength(2);
  });

  it('reads dish operations, dropping a bad list', () => {
    expect(parseParams('?view=dish&ops=panic,p1').params.ops).toEqual(['panic', 'p1']);
    expect(parseParams('?view=dish&puppet=up,left').params.puppet).toEqual(['up', 'left']);
    expect(parseParams('?puppet=jump').params.puppet).toBeUndefined();
    const bad = parseParams('?ops=panic,lobotomy');
    expect(bad.params.ops).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });

  it('reads a replay frame (sim ms)', () => {
    expect(parseParams('?exp=shadow&run=1&replay=120').params.replay).toBe(120);
    expect(parseParams('?replay=x').warnings).toHaveLength(1);
  });

  it('opens the dish by default, the brain on its own links', () => {
    const view = (q: string) => parseParams(q).params.view;
    expect(view('')).toBe('dish');
    expect(view('?lang=en')).toBe('dish');
    expect(view('?exp=swatter:panic&run=1')).toBe('dish');
    expect(view('?from=brain&zoom=700')).toBe('dish');
    expect(view('?view=brain')).toBe('brain');
    // old links: the bare brain page carried a scenario, a shared code, a tour step…
    for (const q of ['?scenario=escape', '?x=zz', '?tour=2', '?select=1', '?probes=1', '?trace=a>b'])
      expect(view(q)).toBe('brain');
    for (const q of ['?director=1', '?intro=0', '?sim=live', '?debug=id', '?color=nt', '?ui=x', '?pick=0,0'])
      expect(view(q)).toBe('brain');
    expect(view('?from=dish&scenario=sugar')).toBe('brain');
    // an explicit view wins: the way back from the brain carries its code
    expect(view('?view=dish&x=zz&from=brain')).toBe('dish');
    expect(view('?view=brain&exp=sugar')).toBe('brain');
  });

  it('reads an onboarding step (snaps)', () => {
    expect(parseParams('?onb=2').params.onb).toBe(2);
    expect(parseParams('?onb=0').params.onb).toBe(0);
    const bad = parseParams('?onb=5');
    expect(bad.params.onb).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });

  it('reads the welcome (full | short | 0)', () => {
    expect(parseParams('?welcome=full').params.welcome).toBe('full');
    expect(parseParams('?welcome=short').params.welcome).toBe('short');
    expect(parseParams('?welcome=0').params.welcome).toBe('off');
    const bad = parseParams('?welcome=yes');
    expect(bad.params.welcome).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });

  it('reads the zoom arrival and a frozen flight', () => {
    const { params, warnings } = parseParams('?view=dish&from=brain&zoom=700');
    expect(params).toMatchObject({ view: 'dish', from: 'brain', zoom: 700 });
    expect(warnings).toEqual([]);
    const bad = parseParams('?from=pond&zoom=-1');
    expect(bad.params.from).toBeUndefined();
    expect(bad.params.zoom).toBeUndefined();
    expect(bad.warnings).toHaveLength(2);
  });

  it('reads an experiment pair and the run flag, ignoring old puzzle params', () => {
    const { params, warnings } = parseParams('?exp=swatter:panic&run=1&level=2&hint=3');
    expect(params.exp).toEqual({ stim: 'swatter', op: 'panic' });
    expect(params.run).toBe(true);
    expect(params).not.toHaveProperty('level');
    expect(warnings).toEqual([]);
    expect(parseParams('?exp=sugar').params.exp).toEqual({ stim: 'sugar', op: 'none' });
    const bad = parseParams('?exp=banana:panic');
    expect(bad.params.exp).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });

  it('reads the phone sheet tab', () => {
    expect(parseParams('?sheet=put').params.sheet).toBe('put');
    const bad = parseParams('?sheet=ops');
    expect(bad.params.sheet).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });
});
