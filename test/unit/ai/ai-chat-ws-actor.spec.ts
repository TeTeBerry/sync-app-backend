import { resolveWsChatActor } from '../../../src/ai/ws/ai-chat-ws-actor';

describe('resolveWsChatActor', () => {
  const jwt = { userId: 'user-jwt', userName: 'JWT User' };

  it('uses JWT actor when Bearer verified', () => {
    const result = resolveWsChatActor(jwt, { userPhone: '13800000000' });
    expect(result).toEqual({
      ok: true,
      actor: {
        source: 'jwt',
        clientUserId: 'user-jwt',
        displayName: 'JWT User',
        resolvedUserId: 'user-jwt',
      },
      userPhone: '13800000000',
    });
  });

  it('rejects body userId that conflicts with JWT', () => {
    const result = resolveWsChatActor(jwt, { userId: 'other-user' });
    expect(result).toEqual({
      ok: false,
      message: '用户身份与登录态不一致',
    });
  });

  it('allows matching body userId with JWT', () => {
    const result = resolveWsChatActor(jwt, {
      userId: 'user-jwt',
      userName: 'ignored',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor.clientUserId).toBe('user-jwt');
      expect(result.actor.displayName).toBe('JWT User');
    }
  });

  it('requires body userId when no JWT', () => {
    expect(resolveWsChatActor(null, {})).toEqual({
      ok: false,
      message: '缺少用户身份（请登录或在消息中提供 userId）',
    });
  });

  it('uses demo body identity when no JWT', () => {
    const result = resolveWsChatActor(null, {
      userId: 'demo-client',
      userName: 'Zara',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor).toEqual({
        source: 'demo',
        clientUserId: 'demo-client',
        displayName: 'Zara',
        resolvedUserId: expect.any(String),
      });
      expect(result.userPhone).toBeUndefined();
    }
  });
});
