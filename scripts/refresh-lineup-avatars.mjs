#!/usr/bin/env node
/**
 * Re-fetch all mapped lineup avatars with homonym-safe TheAudioDB resolution.
 *
 * Resolution order (see theaudiodb-avatars.mjs):
 *   1. PREFERRED_MB_BY_LINEUP (e.g. FISHER → Paul Fisher)
 *   2. MusicBrainz URL on DJ catalog row
 *   3. TheAudioDB text search (skips merged homonym stubs)
 *   4. Genre / identity cross-check
 *
 * Usage:
 *   npm run db:refresh-lineup-avatars
 *   npm run db:refresh-lineup-avatars -- --dry-run
 *   npm run db:refresh-lineup-avatars -- --names "FISHER,MARLO"
 *   npm run db:refresh-lineup-avatars -- --cloud-only --mirror   # after local refresh
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const syncScript = join(__dirname, 'sync-lineup-artist-avatars-cloud.mjs');

const passthrough = process.argv.slice(2);
const dryRun = passthrough.includes('--dry-run');
const cloudOnly = passthrough.includes('--cloud-only');
const mirror = passthrough.includes('--mirror');

const syncArgs = ['--force', ...passthrough.filter(
  (arg) => arg !== '--cloud-only' && arg !== '--mirror',
)];

console.log('🔄 全量刷新阵容头像（homonym-safe TheAudioDB + MB 消歧）');
console.log(
  `   模式: ${dryRun ? 'dry-run（不写库）' : '写入 MongoDB'}${cloudOnly ? ' → 同步云端' : ''}`,
);
console.log('');

const syncResult = spawnSync(process.execPath, [syncScript, ...syncArgs], {
  stdio: 'inherit',
});

if (syncResult.status !== 0) {
  process.exit(syncResult.status ?? 1);
}

if (dryRun || !cloudOnly) {
  if (!dryRun) {
    console.log('');
    console.log('ℹ️  同步到云端: npm run db:refresh-lineup-avatars -- --cloud-only --mirror');
  }
  process.exit(0);
}

console.log('');
console.log('☁️  推送 lineup_artist_avatars → 云端…');

const cloudArgv = ['--cloud-only'];
if (mirror) {
  cloudArgv.push('--mirror');
}

const cloudResult = spawnSync(
  process.execPath,
  [join(__dirname, 'sync-lineup-artist-catalog-all.mjs'), ...cloudArgv],
  { stdio: 'inherit' },
);

process.exit(cloudResult.status ?? 1);
