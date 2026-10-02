import type { RunConfig } from './spikes';

/** Baked-run config per scenario: stimulus types (Shiu-style Poisson) + anchor types to report. Checked by bio.test.ts (pnpm test:bio). */
export interface ScenarioRun extends RunConfig {
  anchors: string[];
}

const base = { hz: 150, durationMs: 300, seed: 1, binMs: 1 };

export const SCENARIO_RUNS: Record<string, ScenarioRun> = {
  escape: {
    ...base,
    stimTypes: ['LC4', 'LPLC2'],
    anchors: ['LC4', 'LPLC2', 'DNp01', 'GFC2', 'PSI', 'TTMn', 'DLMn c-f'],
  },
  sugar: {
    ...base,
    // BM_Taste is mechanosensory (MN9 silent); LB3a–d = strongest gustatory route to MN9 (data/scout/sugar.md)
    stimTypes: ['LB3a', 'LB3b', 'LB3c', 'LB3d'],
    anchors: ['LB3d', 'DNge062', 'GNG120', 'GNG015', 'GNG095', 'DNge055', 'MN9', 'MN8'],
  },
  song: {
    ...base,
    stimTypes: ['pC1_14a', 'pC1x_c', 'pC1_14b', 'pC1_5b', 'pC1_7b', 'pC1_19', 'pC1_7a', 'pC1_13a', 'pC1_11b'],
    anchors: ['pC1_14a', 'pIP10', 'dPR1', 'TN1a_g', 'hg1 MN', 'hg3 MN', 'DLMn c-f'],
  },
};
