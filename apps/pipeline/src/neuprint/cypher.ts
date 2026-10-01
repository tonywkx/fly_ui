/**
 * neuPrint's custom endpoint takes no query parameters, so values are inlined.
 * Everything interpolated through `cypher` becomes a safe literal; identifiers go through `raw`.
 */
export type CypherValue = string | number | bigint | boolean | null | Raw | readonly CypherValue[];

export class Raw {
  constructor(readonly text: string) {}
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function raw(identifier: string): Raw {
  if (!IDENTIFIER.test(identifier)) throw new TypeError(`not a Cypher identifier: ${identifier}`);
  return new Raw(identifier);
}

export function literal(value: CypherValue): string {
  if (value instanceof Raw) return value.text;
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  switch (typeof value) {
    case 'string':
      return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`non-finite number: ${value}`);
      return String(value);
    case 'bigint':
    case 'boolean':
      return String(value);
    default:
      throw new TypeError(`no Cypher literal for ${typeof value}`);
  }
}

export function cypher(strings: TemplateStringsArray, ...values: CypherValue[]): string {
  return strings.reduce(
    (out, s, i) => out + s + (i < values.length ? literal(values[i] as CypherValue) : ''),
    '',
  );
}
