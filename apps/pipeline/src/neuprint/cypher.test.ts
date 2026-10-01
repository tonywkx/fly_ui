import { describe, expect, test } from 'vitest';
import { cypher, literal, raw } from './cypher';

describe('literal', () => {
  test('strings are quoted and escaped', () => {
    expect(literal('LC4')).toBe("'LC4'");
    expect(literal("it's")).toBe("'it\\'s'");
    expect(literal('a\\b')).toBe("'a\\\\b'");
    expect(literal('a\nb')).toBe("'a\\nb'");
  });

  test('numbers, bigints, booleans, null', () => {
    expect(literal(42)).toBe('42');
    expect(literal(-0.5)).toBe('-0.5');
    expect(literal(720575940630144257n)).toBe('720575940630144257');
    expect(literal(true)).toBe('true');
    expect(literal(null)).toBe('null');
  });

  test('arrays are recursive', () => {
    expect(literal(['LC4', 'LPLC2'])).toBe("['LC4', 'LPLC2']");
    expect(literal([1, [2]])).toBe('[1, [2]]');
  });

  test('rejects values that have no safe literal', () => {
    expect(() => literal(Number.NaN)).toThrow(TypeError);
    expect(() => literal(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => literal(undefined as never)).toThrow(TypeError);
    expect(() => literal({} as never)).toThrow(TypeError);
  });
});

describe('cypher template', () => {
  test('inlines values as literals', () => {
    const q = cypher`MATCH (n:Neuron) WHERE n.type IN ${['DNp01']} AND n.pre > ${10} RETURN n`;
    expect(q).toBe("MATCH (n:Neuron) WHERE n.type IN ['DNp01'] AND n.pre > 10 RETURN n");
  });

  test('injection attempt stays a string literal', () => {
    const q = cypher`MATCH (n) WHERE n.type = ${"x' OR 1=1 RETURN n //"} RETURN n`;
    expect(q).toBe("MATCH (n) WHERE n.type = 'x\\' OR 1=1 RETURN n //' RETURN n");
  });

  test('raw() inlines validated identifiers only', () => {
    expect(cypher`RETURN n.${raw('somaSide')}`).toBe('RETURN n.somaSide');
    expect(() => raw('type) DETACH DELETE n //')).toThrow(TypeError);
  });
});
