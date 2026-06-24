import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contractPackages = [
  'chat-contracts',
  'travel-plan-contracts',
  'travel-guide-contracts',
  'partner-contracts',
  'itinerary-contracts',
  'festival-plan-contracts',
  'activity-contracts',
  'notification-contracts',
  'profile-contracts',
  'scene-contracts',
];

for (const pkg of contractPackages) {
  const compiled = join(root, 'dist', 'packages', pkg);
  const target = join(root, 'packages', pkg, 'dist');

  if (!existsSync(compiled)) {
    console.warn(`[sync-contract-dist] skip ${pkg}: ${compiled} not found (run nest build first)`);
    continue;
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(compiled, target, { recursive: true });
}
