import { env } from './env';

if (!env.neuprintToken) {
  console.error('NEUPRINT_TOKEN missing: copy .env.example to .env and fill it in');
  process.exit(1);
}
console.log(`scout: ${env.neuprintDataset} @ ${env.neuprintServer} — not implemented yet (PLAN 0.2)`);
