import { describe, expect, test, vi } from 'vitest';
import { createClient, NeuprintError } from './client';

const TOKEN = 'secret-token-123';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const text = (body: string, status: number) => new Response(body, { status });

function setup(responses: Array<Response | Error>, opts: { concurrency?: number } = {}) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error('no more mocked responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const client = createClient({
    server: 'https://np.test',
    dataset: 'male-cns:v1.0',
    token: TOKEN,
    fetch: fetch as unknown as typeof globalThis.fetch,
    retries: 2,
    retryDelayMs: 0,
    ...opts,
  });
  return { client, fetch };
}

describe('query', () => {
  test('posts cypher with bearer token and maps rows to objects', async () => {
    const { client, fetch } = setup([
      json({
        columns: ['bodyId', 'type'],
        data: [
          [1, 'DNp01'],
          [2, null],
        ],
      }),
    ]);
    const rows = await client.query('MATCH (n) RETURN n.bodyId AS bodyId, n.type AS type');

    expect(rows).toEqual([
      { bodyId: 1, type: 'DNp01' },
      { bodyId: 2, type: null },
    ]);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://np.test/api/custom/custom');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      cypher: 'MATCH (n) RETURN n.bodyId AS bodyId, n.type AS type',
      dataset: 'male-cns:v1.0',
    });
  });

  test('retries 503 and network errors, then succeeds', async () => {
    const { client, fetch } = setup([
      text('busy', 503),
      new TypeError('fetch failed'),
      json({ columns: ['x'], data: [[1]] }),
    ]);
    await expect(client.query('RETURN 1 AS x')).resolves.toEqual([{ x: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('retries timeouts, then gives up', async () => {
    const { client, fetch } = setup([text('Neo4j timeout', 400), text('timeout', 400), text('timeout', 400)]);
    await expect(client.query('RETURN 1')).rejects.toBeInstanceOf(NeuprintError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('does not retry auth errors', async () => {
    const { client, fetch } = setup([text('unauthorized', 401)]);
    await expect(client.query('RETURN 1')).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('error messages never contain the token', async () => {
    const { client } = setup([text(`bad token ${TOKEN}`, 401)]);
    const err = await client.query('RETURN 1').catch((e: Error) => e);
    expect(String(err)).not.toContain(TOKEN);
    expect(String(err)).toContain('401');
  });

  test('rejects malformed responses', async () => {
    const { client } = setup([json({ rows: [] })]);
    await expect(client.query('RETURN 1')).rejects.toBeInstanceOf(NeuprintError);
  });

  test('caps concurrent requests', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetch = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return json({ columns: ['x'], data: [[1]] });
    });
    const client = createClient({
      server: 'https://np.test',
      dataset: 'd',
      token: TOKEN,
      fetch: fetch as unknown as typeof globalThis.fetch,
      concurrency: 2,
    });
    await Promise.all(Array.from({ length: 6 }, () => client.query('RETURN 1 AS x')));
    expect(peak).toBe(2);
  });
});

describe('datasets', () => {
  test('lists dataset names', async () => {
    const { client, fetch } = setup([json({ 'male-cns:v1.0': {}, 'manc:v1.2': {} })]);
    await expect(client.datasets()).resolves.toEqual(['male-cns:v1.0', 'manc:v1.2']);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://np.test/api/dbmeta/datasets');
  });
});

describe('skeleton', () => {
  const SWC = '1 1 0 0 0 10 -1\n2 0 1 0 0 2 1\n';

  test('gets swc text for a body', async () => {
    const { client, fetch } = setup([text(SWC, 200)]);
    await expect(client.skeleton(20808)).resolves.toBe(SWC);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://np.test/api/skeletons/skeleton/male-cns:v1.0/20808?format=swc');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  test('returns null when the body has no skeleton', async () => {
    const { client, fetch } = setup([text('{"error":"Key \\"1_swc\\" not found\\n"}', 400)]);
    await expect(client.skeleton(1)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('retries 503, then succeeds', async () => {
    const { client, fetch } = setup([text('busy', 503), text(SWC, 200)]);
    await expect(client.skeleton(2)).resolves.toBe(SWC);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('other client errors still throw', async () => {
    const { client } = setup([text('forbidden', 403)]);
    await expect(client.skeleton(3)).rejects.toMatchObject({ status: 403 });
  });
});

describe('roiMesh', () => {
  const OBJ = '# OBJ file\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';

  test('gets obj text, roi name url-encoded', async () => {
    const { client, fetch } = setup([text(OBJ, 200)]);
    await expect(client.roiMesh("a'L(R)")).resolves.toBe(OBJ);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://np.test/api/roimeshes/mesh/male-cns:v1.0/a'L(R)");
  });

  test('returns null when the roi has no mesh', async () => {
    const { client } = setup([text('{"error":"Key \\"CX\\" not found\\n"}', 400)]);
    await expect(client.roiMesh('CX')).resolves.toBeNull();
  });
});
