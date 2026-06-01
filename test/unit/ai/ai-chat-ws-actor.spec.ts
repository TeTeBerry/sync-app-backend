import { resolveWsChatActor } from '../../../src/ai/ws/ai-chat-ws-actor';

describe('resolveWsChatActor', () => {
  const jwt = { userId: 'user-jwt', userName: 'JWT User' };

  it('uses JWT actor when Bearer verified', () => {
    const result = resolveWsChatActor(jwt, { userPhone: '13800000000' });
    expect(result).toEqual({
      ok: true,
      source: 'jwt',
      actor: {
        userId: 'user-jwt',
        userName: 'JWT User',
        userPhone: '13800000000',
      },
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
      expect(result.actor.userId).toBe('user-jwt');
      expect(result.actor.userName).toBe('JWT User');
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
    expect(result).toEqual({
      ok: true,
      source: 'body',
      actor: {
        userId: 'demo-client',
        userName: 'Zara',
        userPhone: undefined,
      },
    });
  });
});
