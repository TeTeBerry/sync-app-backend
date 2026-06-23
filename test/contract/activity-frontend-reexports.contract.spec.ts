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

describe('activity frontend re-exports (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));

  (hasFrontend ? it : it.skip)(
    'activity.ts re-exports shared contract only',
    () => {
      const content = readFrontendFile('src/types/activity.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/activity-contracts');
      expect(content!).not.toMatch(/export interface BackendActivity\s*\{/);
      expect(content!).not.toMatch(/export interface CatalogLineupArtist\s*\{/);
    },
  );

  (hasFrontend ? it : it.skip)(
    'backend.ts does not define activity DTOs inline',
    () => {
      const content = readFrontendFile('src/types/backend.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain("from './activity'");
      expect(content!).not.toMatch(/export interface BackendActivity\s*\{/);
      expect(content!).not.toMatch(
        /export interface ActivityRegistrationResult\s*\{/,
      );
    },
  );
});
