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

describe('itinerary frontend re-exports (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));

  (hasFrontend ? it : it.skip)(
    'itinerary.ts re-exports shared contract only',
    () => {
      const content = readFrontendFile('src/types/itinerary.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/itinerary-contracts');
      expect(content!).not.toMatch(/export interface ItineraryDay\s*\{/);
    },
  );
});
