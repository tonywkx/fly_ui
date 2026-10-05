import { observable, runInAction } from 'mobx';
import { en } from './en';
import { ru } from './ru';

export const LANGS = ['ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (v: string): v is Lang => (LANGS as readonly string[]).includes(v);

/** Plural forms by `Intl.PluralRules` category; `other` is the fallback. */
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
/** Same keys as `T`, each value the same kind (string ↔ plural): what `en` must satisfy. */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Plural };

type Ru = typeof ru;
export type Key = { [K in keyof Ru]: Ru[K] extends string ? K : never }[keyof Ru];
export type PluralKey = Exclude<keyof Ru, Key>;
export type Vars = Record<string, string | number>;

export const DICTS: Record<Lang, Shape<Ru>> = { ru, en };
const LOCALES: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US' };

const current = observable.box<Lang>('ru');
/** Interface language; reading it inside an observer re-renders on a switch. */
export const lang = () => current.get();
export const setLangValue = (l: Lang) => runInAction(() => current.set(l));

const fill = (s: string, vars: Vars | undefined, l: Lang) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? fmt(vars[k] as string | number, l) : m)) : s;
const fmt = (v: string | number, l: Lang) => (typeof v === 'number' ? num(v, l) : v);

/** `{name}` placeholders take `vars`; numbers are formatted for the language. */
export function t(key: Key, vars?: Vars, l: Lang = lang()): string {
  return fill(DICTS[l][key] as string, vars, l);
}

/** Form for `n` (also available as `{n}`). */
export function plural(key: PluralKey, n: number, vars?: Vars, l: Lang = lang()): string {
  const forms = DICTS[l][key] as Plural;
  const form = forms[new Intl.PluralRules(LOCALES[l]).select(n)] ?? forms.other;
  return fill(form, { n, ...vars }, l);
}

/** Dictionary lookup for keys built from data (group ids, scenario ids); `fallback` when absent. */
export function tOr(key: string, fallback: string, l: Lang = lang()): string {
  const v = (DICTS[l] as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : fallback;
}

const numFormats = new Map<string, Intl.NumberFormat>();
/** `176 000` (RU, NBSP) / `176,000` (EN). */
export function num(n: number, l: Lang = lang(), digits?: number): string {
  const id = `${l}:${digits ?? ''}`;
  let f = numFormats.get(id);
  if (!f) {
    f = new Intl.NumberFormat(
      LOCALES[l],
      digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits },
    );
    numFormats.set(id, f);
  }
  return f.format(n);
}
