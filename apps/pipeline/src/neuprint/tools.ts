import type { NeuprintClient } from './client';
import { type CypherValue, cypher, raw } from './cypher';
import { kStrongestPaths, type Path, type TypeEdge } from './paths';

/** Tool-shaped API over neuPrint: small JSON in, small JSON out (future MCP server wraps these). */

export interface NeuronRow {
  bodyId: number;
  type: string | null;
  instance: string | null;
  pre: number;
  post: number;
  [field: string]: unknown;
}

export interface FindNeuronsArgs {
  type?: string;
  typeRegex?: string;
  bodyIds?: number[];
  /** Extra Neuron properties to return (identifiers, e.g. somaSide). */
  fields?: string[];
  limit?: number;
}

export async function findNeurons(client: NeuprintClient, args: FindNeuronsArgs): Promise<NeuronRow[]> {
  const where: string[] = [];
  if (args.type !== undefined) where.push(cypher`n.type = ${args.type}`);
  if (args.typeRegex !== undefined) where.push(cypher`n.type =~ ${args.typeRegex}`);
  if (args.bodyIds !== undefined) where.push(cypher`n.bodyId IN ${args.bodyIds}`);
  if (where.length === 0) throw new Error('findNeurons needs a filter: type, typeRegex or bodyIds');

  const extra = (args.fields ?? []).map((f) => cypher`, n.${raw(f)} AS ${raw(f)}`).join('');
  return client.query<NeuronRow>(
    `MATCH (n:Neuron) WHERE ${where.join(' AND ')} ` +
      `RETURN n.bodyId AS bodyId, n.type AS type, n.instance AS instance, n.pre AS pre, n.post AS post${extra} ` +
      cypher`ORDER BY n.post DESC LIMIT ${args.limit ?? 100}`,
  );
}

export interface PartnerRow {
  type: string;
  neurons: number;
  weight: number;
}

export interface GetPartnersArgs {
  bodyId?: number;
  type?: string;
  /** 'down' = targets of the neuron(s), 'up' = inputs. */
  direction: 'up' | 'down';
  minWeight?: number;
  limit?: number;
}

export async function getPartners(client: NeuprintClient, args: GetPartnersArgs): Promise<PartnerRow[]> {
  const self =
    args.bodyId !== undefined
      ? cypher`a.bodyId = ${args.bodyId}`
      : args.type !== undefined
        ? cypher`a.type = ${args.type}`
        : undefined;
  if (!self) throw new Error('getPartners needs bodyId or type');

  const pattern =
    args.direction === 'down'
      ? 'MATCH (a:Neuron)-[c:ConnectsTo]->(b:Neuron)'
      : 'MATCH (b:Neuron)-[c:ConnectsTo]->(a:Neuron)';
  return client.query<PartnerRow>(
    `${pattern} WHERE ${self} ` +
      cypher`AND c.weight >= ${args.minWeight ?? 5} ` +
      `RETURN coalesce(b.type, '(untyped)') AS type, count(DISTINCT b) AS neurons, sum(c.weight) AS weight ` +
      cypher`ORDER BY weight DESC LIMIT ${args.limit ?? 30}`,
  );
}

export interface StrongestPathsArgs {
  fromTypes: string[];
  toTypes: string[];
  maxHops?: number;
  /** Per neuron-pair synapse threshold before summing to type level. */
  minWeight?: number;
  k?: number;
  /** New types kept per expansion step (strongest first). */
  perHop?: number;
}

/**
 * Type-level strongest paths. Expands the type graph forward from sources (⌈hops/2⌉ steps)
 * and backward from targets (⌊hops/2⌋ steps), then ranks simple paths by Σ 1/weight.
 */
export async function strongestPaths(
  client: NeuprintClient,
  args: StrongestPathsArgs,
): Promise<{ paths: Path[]; edges: number }> {
  const { fromTypes, toTypes, maxHops = 4, minWeight = 10, k = 5, perHop = 40 } = args;
  const edges = new Map<string, TypeEdge>();

  const expand = async (seed: string[], steps: number, dir: 'fwd' | 'back') => {
    const seen = new Set(seed);
    let frontier = seed;
    for (let i = 0; i < steps && frontier.length > 0; i++) {
      const side = dir === 'fwd' ? 'a' : 'b';
      const rows = await client.query<TypeEdge>(
        `MATCH (a:Neuron)-[c:ConnectsTo]->(b:Neuron) WHERE ${side}.type IN ${toList(frontier)} ` +
          cypher`AND c.weight >= ${minWeight} AND a.type IS NOT NULL AND b.type IS NOT NULL ` +
          `RETURN a.type AS from, b.type AS to, sum(c.weight) AS weight ` +
          cypher`ORDER BY weight DESC LIMIT ${perHop * frontier.length}`,
      );
      const next: string[] = [];
      for (const e of rows) {
        edges.set(`${e.from}>${e.to}`, e);
        const node = dir === 'fwd' ? e.to : e.from;
        if (!seen.has(node) && next.length < perHop) {
          seen.add(node);
          next.push(node);
        }
      }
      frontier = next;
    }
  };

  await expand(fromTypes, Math.ceil(maxHops / 2), 'fwd');
  await expand(toTypes, Math.floor(maxHops / 2), 'back');
  return {
    paths: kStrongestPaths([...edges.values()], fromTypes, toTypes, { k, maxHops }),
    edges: edges.size,
  };
}

const toList = (values: CypherValue[]) => cypher`${values}`;
