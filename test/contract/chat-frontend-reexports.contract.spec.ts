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

describe('partner post card frontend re-exports (monorepo workspace)', () => {
  it('aiChat.ts re-exports RecommendedPostCard from @sync/partner-contracts', () => {
    const content = readFrontendFile('src/types/aiChat.ts');
    expect(content).toBeTruthy();
    expect(content!).toContain('@sync/partner-contracts');
    expect(content!).not.toMatch(/export interface RecommendedPostCard\s*\{/);
  });
});
