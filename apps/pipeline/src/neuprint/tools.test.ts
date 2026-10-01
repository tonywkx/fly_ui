import { describe, expect, test, vi } from 'vitest';
import type { NeuprintClient } from './client';
import { findNeurons, getPartners, strongestPaths } from './tools';

function fakeClient(respond: (cypher: string) => Record<string, unknown>[] = () => []) {
  const query = vi.fn(async (cypher: string) => respond(cypher));
  return { client: { dataset: 'd', query, datasets: async () => [] } as unknown as NeuprintClient, query };
}

describe('findNeurons', () => {
  test('builds a filtered, limited query', async () => {
    const { client, query } = fakeClient(() => [{ bodyId: 1, type: 'DNp01' }]);
    await expect(findNeurons(client, { type: 'DNp01', fields: ['somaSide'], limit: 5 })).resolves.toEqual([
      { bodyId: 1, type: 'DNp01' },
    ]);
    expect(query.mock.calls[0]?.[0]).toMatchInlineSnapshot(
      `"MATCH (n:Neuron) WHERE n.type = 'DNp01' RETURN n.bodyId AS bodyId, n.type AS type, n.instance AS instance, n.pre AS pre, n.post AS post, n.somaSide AS somaSide ORDER BY n.post DESC LIMIT 5"`,
    );
  });

  test('regex and bodyIds combine; empty filter is rejected', async () => {
    const { client, query } = fakeClient();
    await findNeurons(client, { typeRegex: 'LC4.*', bodyIds: [1, 2] });
    expect(query.mock.calls[0]?.[0]).toContain("n.type =~ 'LC4.*' AND n.bodyId IN [1, 2]");
    await expect(findNeurons(client, {})).rejects.toThrow(/filter/);
  });
});

describe('getPartners', () => {
  test('downstream partners grouped by type', async () => {
    const { client, query } = fakeClient();
    await getPartners(client, { type: 'DNp01', direction: 'down', minWeight: 5, limit: 10 });
    expect(query.mock.calls[0]?.[0]).toMatchInlineSnapshot(
      `"MATCH (a:Neuron)-[c:ConnectsTo]->(b:Neuron) WHERE a.type = 'DNp01' AND c.weight >= 5 RETURN coalesce(b.type, '(untyped)') AS type, count(DISTINCT b) AS neurons, sum(c.weight) AS weight ORDER BY weight DESC LIMIT 10"`,
    );
  });

  test('upstream by bodyId flips the pattern', async () => {
    const { client, query } = fakeClient();
    await getPartners(client, { bodyId: 42, direction: 'up' });
    expect(query.mock.calls[0]?.[0]).toContain(
      'MATCH (b:Neuron)-[c:ConnectsTo]->(a:Neuron) WHERE a.bodyId = 42',
    );
  });
});

describe('strongestPaths', () => {
  // type graph; the fake answers forward (a.type IN …) and backward (b.type IN …) expansions
  const graph = [
    { from: 'LC4', to: 'DNp01', weight: 100 },
    { from: 'LPLC2', to: 'DNp01', weight: 80 },
    { from: 'DNp01', to: 'TTMn', weight: 200 },
    { from: 'LC4', to: 'X', weight: 30 },
    { from: 'X', to: 'Y', weight: 30 },
    { from: 'Y', to: 'TTMn', weight: 30 },
  ];
  const listIn = (cypher: string, side: 'a' | 'b') =>
    [...(cypher.match(new RegExp(`${side}\\.type IN \\[(.*?)\\]`))?.[1]?.matchAll(/'([^']*)'/g) ?? [])].map(
      (m) => m[1],
    );
  const respond = (cypher: string) => {
    const fwd = listIn(cypher, 'a');
    const back = listIn(cypher, 'b');
    return graph.filter((e) => fwd.includes(e.from) || back.includes(e.to));
  };

  test('meets in the middle and ranks paths', async () => {
    const { client, query } = fakeClient(respond);
    const { paths } = await strongestPaths(client, {
      fromTypes: ['LC4', 'LPLC2'],
      toTypes: ['TTMn'],
      maxHops: 3,
      k: 5,
    });
    expect(paths.map((p) => p.nodes.join('>'))).toEqual([
      'LC4>DNp01>TTMn',
      'LPLC2>DNp01>TTMn',
      'LC4>X>Y>TTMn',
    ]);
    expect(query).toHaveBeenCalledTimes(3); // 2 forward hops + 1 backward hop
  });

  test('maxHops bounds path length', async () => {
    const { client } = fakeClient(respond);
    const { paths } = await strongestPaths(client, { fromTypes: ['LC4'], toTypes: ['TTMn'], maxHops: 2 });
    expect(paths.map((p) => p.nodes.join('>'))).toEqual(['LC4>DNp01>TTMn']);
  });
});
