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

describe('chat frontend re-exports (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));

  (hasFrontend ? it : it.skip)(
    'conversationState.ts re-exports shared contract only',
    () => {
      const content = readFrontendFile('src/types/conversationState.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/chat-contracts');
      expect(content!).not.toMatch(/export type ConversationFlow\s*=/);
      expect(content!).not.toMatch(/export interface ConversationState\s*\{/);
    },
  );

  (hasFrontend ? it : it.skip)(
    'aiChat.ts re-exports stream + card types only',
    () => {
      const content = readFrontendFile('src/types/aiChat.ts');
      expect(content).toBeTruthy();
      expect(content!).toContain('@sync/chat-contracts');
      expect(content!).toMatch(/AiStreamEvent as AiChatStreamEvent/);
      expect(content!).not.toMatch(/export type AiChatStreamEvent\s*=/);
      expect(content!).not.toMatch(/export interface RecommendedPostCard\s*\{/);
      expect(content!).not.toMatch(/export interface AiChatMessage\s*\{/);
    },
  );
});
