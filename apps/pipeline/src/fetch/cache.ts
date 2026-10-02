import { access, rename, writeFile } from 'node:fs/promises';

export const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Atomic write: a killed run never leaves a truncated cache file behind. */
export async function put(path: string, data: string) {
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}
