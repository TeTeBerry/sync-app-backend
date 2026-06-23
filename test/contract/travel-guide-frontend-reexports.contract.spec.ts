import * as fs from 'fs';
import * as path from 'path';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

const FRONTEND_ROOT = path.resolve(__dirname, '../../../sync-app');

function readFrontendFile(relativePath: string): string | null {
  const fullPath = path.join(FRONTEND_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

describe('travel-guide frontend re-exports (monorepo workspace)', () => {
  it('workspace package exports TravelGuidePlan type', () => {
    const activityName: TravelGuidePlan['activityName'] = 'EDC';
    expect(activityName).toBe('EDC');
  });

  it('travelGuide.ts re-exports shared contract only', () => {
    const content = readFrontendFile('src/types/travelGuide.ts');
    expect(content).toBeTruthy();
    expect(content!).toContain('@sync/travel-guide-contracts');
    expect(content!).not.toMatch(/export interface TravelGuidePlan\s*\{/);
    expect(content!).not.toMatch(/export type TravelGuideBudgetTier\s*=/);
  });
});
