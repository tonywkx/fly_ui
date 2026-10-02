import { type ChunkEntry, FORMAT_VERSION, firstFrameBytes, type Manifest, parseManifest } from '@fly/data';

/** First-frame budget (CLAUDE.md), raw bytes as written to public/data. */
export const FIRST_FRAME_BUDGET = 15 * 2 ** 20;

export type BakedChunk = Omit<ChunkEntry, 'file' | 'bytes'> & { data: Uint8Array };

export interface ManifestInput extends Pick<Manifest, 'dataset' | 'attribution' | 'unitNm' | 'bbox'> {
  builtAt: Date;
  chunks: BakedChunk[];
  scenarios: { id: string; title: string }[];
}

/** File = `<id>.bin`; each scenario lists the chunks tagged with it, in input order. */
export function buildManifest(o: ManifestInput): Manifest {
  return parseManifest({
    formatVersion: FORMAT_VERSION,
    dataset: o.dataset,
    attribution: o.attribution,
    builtAt: o.builtAt.toISOString(),
    unitNm: o.unitNm,
    bbox: o.bbox,
    chunks: o.chunks.map(({ data, ...c }) => ({ ...c, file: `${c.id}.bin`, bytes: data.byteLength })),
    scenarios: o.scenarios.map((s) => ({
      ...s,
      chunks: o.chunks.filter((c) => c.scenario === s.id).map((c) => c.id),
    })),
  });
}

export class BudgetError extends Error {
  constructor(
    readonly bytes: number,
    readonly budget: number,
  ) {
    super(`first-frame data ${bytes} B exceeds budget ${budget} B`);
    this.name = 'BudgetError';
  }
}

export function checkBudget(m: Manifest, budget = FIRST_FRAME_BUDGET): number {
  const bytes = firstFrameBytes(m);
  if (bytes > budget) throw new BudgetError(bytes, budget);
  return bytes;
}
