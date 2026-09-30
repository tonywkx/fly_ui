import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

try {
  process.loadEnvFile(`${root}.env`);
} catch {
  // no .env: rely on the real environment
}

export const env = {
  root,
  neuprintToken: process.env.NEUPRINT_TOKEN ?? '',
  neuprintServer: process.env.NEUPRINT_SERVER ?? 'https://neuprint.janelia.org',
  neuprintDataset: process.env.NEUPRINT_DATASET ?? 'male-cns:v1.0',
};
