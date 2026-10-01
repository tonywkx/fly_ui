import { env } from '../env';
import { createClient, type NeuprintClient } from './client';

export function clientFromEnv(): NeuprintClient {
  if (!env.neuprintToken) {
    throw new Error('NEUPRINT_TOKEN missing: copy .env.example to .env and fill it in');
  }
  return createClient({ server: env.neuprintServer, dataset: env.neuprintDataset, token: env.neuprintToken });
}
