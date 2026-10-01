/**
 * Ad-hoc neuPrint access for humans and agents. Output is compact on purpose (token economy).
 *   tsx src/neuprint/query.ts "<cypher>" [--json] [--max=50]
 *   tsx src/neuprint/query.ts --schema                       Neuron property keys (sampled)
 *   tsx src/neuprint/query.ts --tool=<name> '<json args>'    findNeurons | getPartners | strongestPaths
 */
import { clientFromEnv } from './fromEnv';
import { findNeurons, getPartners, strongestPaths } from './tools';

const flags = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [k, v] as [string, string];
    }),
);
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const max = Number(flags.get('max') ?? 50);
const client = clientFromEnv();

const tools = { findNeurons, getPartners, strongestPaths } as const;

let result: unknown;
const tool = flags.get('tool');
if (tool) {
  const fn = tools[tool as keyof typeof tools];
  if (!fn) throw new Error(`unknown tool ${tool}; one of ${Object.keys(tools).join(', ')}`);
  result = await fn(client, JSON.parse(positional[0] ?? '{}'));
} else if (flags.has('schema')) {
  result = await client.query(
    'MATCH (n:Neuron) WITH n LIMIT 2000 UNWIND keys(n) AS key RETURN key, count(*) AS n ORDER BY n DESC',
  );
} else {
  if (!positional[0]) throw new Error('usage: query.ts "<cypher>" | --schema | --tool=<name> <json>');
  result = await client.query(positional[0]);
}

if (flags.has('json') || !Array.isArray(result))
  console.log(JSON.stringify(result, null, flags.has('json') ? 0 : 2));
else console.log(table(result as Record<string, unknown>[], max));

function table(rows: Record<string, unknown>[], limit: number): string {
  if (rows.length === 0) return '(0 rows)';
  const cols = Object.keys(rows[0] ?? {});
  const cell = (v: unknown) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 40 ? `${s.slice(0, 39)}…` : s;
  };
  const shown = rows.slice(0, limit).map((r) => cols.map((c) => cell(r[c])));
  const widths = cols.map((c, i) => Math.max(c.length, ...shown.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((s, i) => s.padEnd(widths[i] ?? 0)).join('  ');
  const more = rows.length > limit ? `\n… ${rows.length - limit} more rows (${rows.length} total)` : '';
  return [line(cols), ...shown.map(line)].join('\n') + more;
}
