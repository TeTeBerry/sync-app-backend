import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Nest build emits `dist/src` when packages are compiled alongside app code. */
export function resolveDistRoot() {
  if (existsSync(join(repoRoot, 'dist/src/main.js'))) {
    return join(repoRoot, 'dist/src');
  }
  if (existsSync(join(repoRoot, 'dist/main.js'))) {
    return join(repoRoot, 'dist');
  }
  return null;
}

export function requireFromDist(relativePath) {
  const distRoot = resolveDistRoot();
  if (!distRoot) {
    throw new Error('dist not built — run npm run build');
  }
  return createRequire(import.meta.url)(join(distRoot, relativePath));
}
