import { env } from './env';
import { clientFromEnv } from './neuprint/fromEnv';

const client = clientFromEnv();
const datasets = await client.datasets();
if (!datasets.includes(env.neuprintDataset)) {
  console.error(`dataset ${env.neuprintDataset} not found; available: ${datasets.join(', ')}`);
  process.exit(1);
}
console.log(`neuPrint OK: ${env.neuprintDataset} @ ${env.neuprintServer}`);
console.log('scouting is done by the neuprint-scout agent via src/neuprint/query.ts (PLAN 0.3)');
