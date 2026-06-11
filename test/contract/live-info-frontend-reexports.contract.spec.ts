import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_ROOT = path.resolve(__dirname, '../../../sync-app');

function readFrontendFile(relativePath: string): string | null {
  const fullPath = path.join(FRONTEND_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

describe('live-info frontend re-exports (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));

  (hasFrontend ? it : it.skip)(
    'liveInfo.ts re-exports shared contract only',
    () => {
      const content = readFrontendFile('src/types/liveInfo.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/live-info-contracts');
      expect(content!).not.toMatch(/export interface LiveInfoSnapshot\s*\{/);
    },
  );
});
