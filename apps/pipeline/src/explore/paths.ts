import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decodeMeta, decodeTypeGraph } from '@fly/data';
import { kBestPaths, preparePaths } from '../../../web/src/data/paths';

// 8.8 exploratory: strongest type paths sense → command for the decision thread, with each hop's
// dominant region and soma side split. Prints markdown; the result is copied into `PATHS` (bridge.ts).
const dir = fileURLToPath(new URL('../../../web/public/data/', import.meta.url));
const manifest = JSON.parse(await readFile(`${dir}manifest.json`, 'utf8')) as {
  chunks: { id: string; file: string }[];
};
const file = (id: string) => {
  const c = manifest.chunks.find((x) => x.id === id);
  if (!c) throw new Error(`no chunk ${id}`);
  return readFile(`${dir}${c.file}`);
};
const g = decodeTypeGraph(await file('typegraph-full'));
const meta = decodeMeta(await file('meta-full'));
const p = preparePaths(g);
const index = new Map(g.names.map((n, i) => [n, i]));

const QUERIES: [string, string[], string][] = [
  ['jump', ['LC4', 'LPLC2'], 'TTMn'],
  ['eat', ['LB3a', 'LB3b', 'LB3c', 'LB3d'], 'MN9'],
  ['back', ['LB1a', 'LB1b', 'LB1c', 'LB1d', 'LB1e'], 'MDN'],
  ['court', ['LC10a'], 'pIP10'],
  ['gate', ['LC10a'], 'pC1a'],
];

function regions(type: string): string {
  const t = meta.strings.types.indexOf(type);
  const hist = new Map<string, number>();
  for (let i = 0; i < meta.n; i++) {
    if (meta.type[i] !== t) continue;
    const r = meta.strings.regions[meta.region[i] as number] ?? '—';
    hist.set(r, (hist.get(r) ?? 0) + 1);
  }
  return [...hist]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r, n]) => `${r}×${n}`)
    .join(' ');
}

for (const [action, from, to] of QUERIES) {
  console.log(`\n### ${action}: ${from.join('/')} → ${to}`);
  const dst = index.get(to);
  if (dst === undefined) {
    console.log(`no type ${to}`);
    continue;
  }
  for (const f of from) {
    const src = index.get(f);
    if (src === undefined) continue;
    for (const r of kBestPaths(p, src, dst, { k: 3, maxHops: 4 })) {
      const names = r.types.map((t) => g.names[t] as string);
      console.log(`- ${r.fraction.toExponential(2)} · ${names.join(' → ')}`);
    }
  }
}

const seen = new Set<string>();
console.log('\n### regions');
for (const [, from, to] of QUERIES) for (const t of [...from, to]) seen.add(t);
for (const t of ['DNp01', 'pC1a', 'pC1b', 'P1a', ...seen]) console.log(`- ${t}: ${regions(t)}`);
