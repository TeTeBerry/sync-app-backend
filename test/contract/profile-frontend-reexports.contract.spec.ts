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

describe('profile frontend re-exports (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));

  (hasFrontend ? it : it.skip)(
    'profile.ts re-exports shared contract only',
    () => {
      const content = readFrontendFile('src/types/profile.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/profile-contracts');
      expect(content!).not.toMatch(/export interface CurrentUser\s*\{/);
      expect(content!).not.toMatch(/export interface ProfileSummary\s*\{/);
    },
  );

  (hasFrontend ? it : it.skip)(
    'backend.ts does not define profile DTOs inline',
    () => {
      const content = readFrontendFile('src/types/backend.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain("from './profile'");
      expect(content!).not.toMatch(/export interface CurrentUser\s*\{/);
      expect(content!).not.toMatch(/export interface ProfileSummary\s*\{/);
    },
  );
});
