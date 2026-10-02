import { z } from 'zod';

/** Bump on any change to the manifest schema or a binary layout (see CLAUDE.md). */
export const FORMAT_VERSION = 2;

export const CHUNK_KINDS = ['skeletons', 'cloud', 'neuropil', 'graph', 'typegraph', 'meta'] as const;
export type ChunkKind = (typeof CHUNK_KINDS)[number];

export const ChunkTier = z.enum(['first-frame', 'lazy']);
export type ChunkTier = z.infer<typeof ChunkTier>;

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const ChunkEntry = z.object({
  id: z.string().min(1),
  kind: z.enum(CHUNK_KINDS),
  /** Path relative to the manifest. */
  file: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  tier: ChunkTier,
  scenario: z.string().min(1).optional(),
  lod: z.number().int().nonnegative().optional(),
});
export type ChunkEntry = z.infer<typeof ChunkEntry>;

export const Scenario = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  chunks: z.array(z.string()),
});
export type Scenario = z.infer<typeof Scenario>;

export const Manifest = z
  .object({
    formatVersion: z.literal(FORMAT_VERSION),
    dataset: z.string().min(1),
    attribution: z.string().min(1),
    builtAt: z.iso.datetime(),
    /** Nanometres per coordinate unit (male-cns source units are 8 nm voxels). */
    unitNm: z.number().positive(),
    /** CNS bounding box in source units; Uint16 coordinates of every chunk are quantized inside it. */
    bbox: z.object({ min: Vec3, max: Vec3 }),
    chunks: z.array(ChunkEntry),
    scenarios: z.array(Scenario),
  })
  .superRefine((m, ctx) => {
    if (m.bbox.min.some((v, i) => v >= (m.bbox.max[i] ?? Number.NEGATIVE_INFINITY))) {
      ctx.addIssue({ code: 'custom', path: ['bbox'], message: 'bbox min must be < max on every axis' });
    }
    const ids = new Set<string>();
    for (const c of m.chunks) {
      if (ids.has(c.id))
        ctx.addIssue({ code: 'custom', path: ['chunks'], message: `duplicate chunk id ${c.id}` });
      ids.add(c.id);
    }
    for (const s of m.scenarios) {
      for (const id of s.chunks) {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['scenarios'],
            message: `scenario ${s.id}: unknown chunk ${id}`,
          });
        }
      }
    }
  });
export type Manifest = z.infer<typeof Manifest>;

export class FormatVersionError extends Error {
  constructor(readonly found: unknown) {
    super(`data format version ${String(found)} != expected ${FORMAT_VERSION}; re-run pnpm bake`);
    this.name = 'FormatVersionError';
  }
}

export function parseManifest(json: unknown): Manifest {
  const version = (json as { formatVersion?: unknown } | null)?.formatVersion;
  if (version !== FORMAT_VERSION) throw new FormatVersionError(version);
  return Manifest.parse(json);
}
