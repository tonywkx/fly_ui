import { describe, expect, it } from 'vitest';
import { parseParams } from './params';

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

  it('ignores unknown keys silently', () => {
    expect(parseParams('?foo=1').warnings).toEqual([]);
  });
});
