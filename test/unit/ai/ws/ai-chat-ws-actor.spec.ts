import { resolveWsChatActor } from '../../../../src/ai/ws/ai-chat-ws-actor';

describe('resolveWsChatActor', () => {
  it('rejects anonymous actor when requireAuth is true', () => {
    const result = resolveWsChatActor(
      null,
      { userId: 'demo-user', userName: 'Demo' },
      { requireAuth: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('登录');
    }
  });

  it('allows anonymous actor in dev mode', () => {
    const result = resolveWsChatActor(null, {
      userId: 'demo-user',
      userName: 'Demo',
    });
    expect(result.ok).toBe(true);
  });
});
