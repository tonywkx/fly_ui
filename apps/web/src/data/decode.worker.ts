import type { BBox, ChunkKind } from '@fly/data';
import { expose, transfer } from 'comlink';
import { type Decoded, decodeByKind, transferables } from './decode';

const api = {
  /** Fetch + decode off the main thread; typed arrays come back transferred, not copied. */
  async load(url: string, kind: ChunkKind, bbox: BBox): Promise<Decoded> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const decoded = decodeByKind(kind, await res.arrayBuffer(), bbox);
    return transfer(decoded, transferables(decoded));
  },
};

export type DecodeApi = typeof api;
expose(api);
