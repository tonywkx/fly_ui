import { describe, expect, it } from 'vitest';
import { DICTS, isLang, lang, num, plural, setLangValue, t, tOr } from './index';

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const forms = (v: unknown) => (typeof v === 'string' ? { _: v } : (v as Record<string, string>));

describe('dictionaries', () => {
  it('en has exactly the keys of ru', () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.ru).sort());
  });

  it('every form of a key has the same placeholders in both languages', () => {
    for (const [key, v] of Object.entries(DICTS.ru)) {
      const want = holes(Object.values(forms(v))[0] as string);
      for (const l of ['ru', 'en'] as const)
        for (const s of Object.values(forms(DICTS[l][key as keyof typeof DICTS.ru])))
          expect(holes(s), `${l} ${key}`).toEqual(want);
    }
  });

  it('plurals cover the categories of their language', () => {
    for (const [key, v] of Object.entries(DICTS.ru)) {
      if (typeof v === 'string') continue;
      expect(Object.keys(v).sort(), `ru ${key}`).toEqual(['few', 'many', 'one', 'other']);
      expect(Object.keys(DICTS.en[key as keyof typeof DICTS.en]).sort(), `en ${key}`).toEqual([
        'one',
        'other',
      ]);
    }
  });

  it('no empty strings', () => {
    for (const l of ['ru', 'en'] as const)
      for (const [key, v] of Object.entries(DICTS[l]))
        for (const s of Object.values(forms(v))) expect(s.trim(), `${l} ${key}`).not.toBe('');
  });
});

describe('t / plural / num', () => {
  it('defaults to ru and switches', () => {
    expect(lang()).toBe('ru');
    expect(t('tour.skip')).toBe('Пропустить');
    setLangValue('en');
    expect(t('tour.skip')).toBe('Skip');
    setLangValue('ru');
  });

  it('fills placeholders, formatting numbers', () => {
    expect(t('tour.step', { i: 1, n: 4 }, 'en')).toBe('1 / 4');
    expect(t('electrodes.full', { n: 4 }, 'ru')).toContain('4');
  });

  it('picks the plural form', () => {
    expect(plural('count.neurons', 1, undefined, 'ru')).toBe('1 нейрон');
    expect(plural('count.neurons', 3, undefined, 'ru')).toBe('3 нейрона');
    expect(plural('count.neurons', 5, undefined, 'ru')).toBe('5 нейронов');
    expect(plural('count.neurons', 1, undefined, 'en')).toBe('1 neuron');
    expect(plural('count.neurons', 2, undefined, 'en')).toBe('2 neurons');
  });

  it('formats numbers per language', () => {
    expect(num(176000, 'ru')).toBe('176 000');
    expect(num(176000, 'en')).toBe('176,000');
    expect(num(2.5, 'ru', 1)).toBe('2,5');
  });

  it('falls back for keys built from data', () => {
    expect(tOr('group.region.optic lobe', 'x', 'ru')).toBe('зрительная доля');
    expect(tOr('group.region.nope', 'nope', 'ru')).toBe('nope');
  });

  it('isLang', () => {
    expect(isLang('en')).toBe(true);
    expect(isLang('de')).toBe(false);
  });
});
