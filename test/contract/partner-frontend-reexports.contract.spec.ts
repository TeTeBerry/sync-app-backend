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

describe('partner frontend re-exports (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));

  (hasFrontend ? it : it.skip)(
    'partner.ts re-exports shared contract only',
    () => {
      const content = readFrontendFile('src/types/partner.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/partner-contracts');
      expect(content!).not.toMatch(/export interface EventDetailPost\s*\{/);
      expect(content!).not.toMatch(/export interface CreatePostPayload\s*\{/);
    },
  );

  (hasFrontend ? it : it.skip)(
    'backend.ts does not define partner DTOs inline',
    () => {
      const content = readFrontendFile('src/types/backend.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain("from './partner'");
      expect(content!).not.toMatch(/export interface EventDetailPost\s*\{/);
    },
  );
});
