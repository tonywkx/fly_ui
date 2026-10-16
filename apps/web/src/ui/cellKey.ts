import type { Key } from '@/i18n';

/** Cell types with a plain name (`why.cell.*`); subtypes (LB3a…d) fold into the family. */
const NAMED = /^(LC4|LPLC2|DNp01|TTMn|MN9|MDN|LC10a|pIP10)$|^(LB[13])[a-z]?$/;

/** The plain-name key for a cell type, or null when it has none (the type is shown as is). */
export function cellKey(type: string | null): Key | null {
  const m = type ? NAMED.exec(type) : null;
  return m ? (`why.cell.${m[1] ?? m[2]}` as Key) : null;
}
