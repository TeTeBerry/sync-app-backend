import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@src/modules/auth/auth.service';
import type { IUserRepository } from '@src/modules/user/interfaces/user.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { WechatMiniService } from '@src/modules/auth/wechat-mini.service';
import type { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('AuthService.logout and resolveBearerAuth', () => {
  const jwtService = {
    sign: jest.fn((payload) => `token-${payload.sub}-${payload.tv ?? 0}`),
    verify: jest.fn(),
  } as unknown as JwtService;

  const users = {
    getTokenVersion: jest.fn().mockResolvedValue(0),
    incrementTokenVersion: jest.fn().mockResolvedValue(1),
  } as unknown as IUserRepository;

  const userService = {} as unknown as UserService;
  const wechatMini = {} as unknown as WechatMiniService;
  const wechatContentSecurity = {} as unknown as WechatContentSecurityService;

  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'auth.mode') return 'dev';
      return fallback;
    }),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      config as never,
      jwtService,
      userService,
      wechatMini,
      wechatContentSecurity,
      users,
    );
  });

  it('increments tokenVersion on JWT logout', async () => {
    const actor = toRequestActor('user-1', 'User');
    actor.source = 'jwt';

    const result = await service.logout(actor);

    expect(result).toEqual({ ok: true });
    expect(users.incrementTokenVersion).toHaveBeenCalledWith('user-1');
  });

  it('does not increment tokenVersion for demo logout', async () => {
    await service.logout(toRequestActor('demo-zara', 'Zara'));

    expect(users.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it('rejects revoked bearer tokens', async () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'user-1',
      name: 'User',
      tv: 0,
    });
    (users.getTokenVersion as jest.Mock).mockResolvedValue(1);

    const auth = await service.resolveBearerAuth('Bearer revoked-token');

    expect(auth).toEqual({ kind: 'invalid' });
  });

  it('accepts bearer when token version matches', async () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'user-1',
      name: 'User',
      tv: 2,
    });
    (users.getTokenVersion as jest.Mock).mockResolvedValue(2);

    const auth = await service.resolveBearerAuth('Bearer good-token');

    expect(auth).toEqual({
      kind: 'valid',
      actor: { userId: 'user-1', userName: 'User' },
    });
  });

  it('verifyToken still throws for malformed tokens', () => {
    (jwtService.verify as jest.Mock).mockImplementation(() => {
      throw new Error('bad');
    });

    expect(() => service.verifyToken('bad')).toThrow(UnauthorizedException);
  });
});
