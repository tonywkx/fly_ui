import pLimit from 'p-limit';
import { z } from 'zod';

export interface ClientOptions {
  server: string;
  dataset: string;
  token: string;
  fetch?: typeof globalThis.fetch;
  concurrency?: number;
  /** Extra attempts after the first one for network errors, 429, 5xx and timeouts. */
  retries?: number;
  retryDelayMs?: number;
}

export interface NeuprintClient {
  readonly dataset: string;
  query<T = Record<string, unknown>>(cypher: string): Promise<T[]>;
  datasets(): Promise<string[]>;
}

export class NeuprintError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'NeuprintError';
  }
}

const tableSchema = z.object({ columns: z.array(z.string()), data: z.array(z.array(z.unknown())) });

export function createClient(opts: ClientOptions): NeuprintClient {
  const { server, dataset, token, fetch = globalThis.fetch, retries = 3, retryDelayMs = 500 } = opts;
  const limit = pLimit(opts.concurrency ?? 4);
  const base = server.replace(/\/+$/, '');
  const redact = (s: string) => (token ? s.replaceAll(token, '***') : s);

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    headers.set('content-type', 'application/json');

    for (let attempt = 0; ; attempt++) {
      let failure: NeuprintError;
      try {
        const res = await fetch(`${base}${path}`, { ...init, headers });
        const body = await res.text();
        if (res.ok) return JSON.parse(body);
        failure = new NeuprintError(`neuPrint ${res.status}: ${redact(body).slice(0, 300)}`, res.status);
        const retryable = res.status === 429 || res.status >= 500 || /timeout/i.test(body);
        if (!retryable) throw failure;
      } catch (e) {
        if (e instanceof NeuprintError) throw e;
        failure = new NeuprintError(`neuPrint request failed: ${redact(String(e))}`);
      }
      if (attempt >= retries) throw failure;
      await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** attempt));
    }
  }

  return {
    dataset,
    query: <T>(cypher: string) =>
      limit(async () => {
        const parsed = tableSchema.safeParse(
          await request('/api/custom/custom', { method: 'POST', body: JSON.stringify({ cypher, dataset }) }),
        );
        if (!parsed.success) throw new NeuprintError('neuPrint: unexpected response shape');
        const { columns, data } = parsed.data;
        return data.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T);
      }),
    datasets: () =>
      limit(async () => Object.keys((await request('/api/dbmeta/datasets')) as Record<string, unknown>)),
  };
}
