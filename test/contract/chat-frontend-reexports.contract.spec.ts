import * as fs from 'fs';
import * as path from 'path';
import { CONVERSATION_STATE_VERSION } from '@sync/chat-contracts/conversation-state.types';

const FRONTEND_ROOT = path.resolve(__dirname, '../../../sync-app');

function readFrontendFile(relativePath: string): string | null {
  const fullPath = path.join(FRONTEND_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

describe('chat frontend re-exports (monorepo workspace)', () => {
  it('workspace package exports conversation state version', () => {
    expect(CONVERSATION_STATE_VERSION).toBe(1);
  });

  it('aiChat.ts re-exports post card types from @sync/chat-contracts', () => {
    const content = readFrontendFile('src/types/aiChat.ts');
    expect(content).toBeTruthy();
    expect(content!).toContain('@sync/chat-contracts');
    expect(content!).not.toMatch(/export interface RecommendedPostCard\s*\{/);
  });
});
