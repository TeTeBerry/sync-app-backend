import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '@src/common/auth/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@src/common/auth/auth.constants';
import { AUTH_SESSION_EXPIRED_MESSAGE } from '@src/common/auth/jwt-bearer.util';
import type { AuthService } from '@src/modules/auth/auth.service';

function createContext(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers, query: {}, actor: undefined } as {
    headers: Record<string, string>;
    query: Record<string, string>;
    actor?: unknown;
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const authService = {
    resolveBearerAuth: jest.fn(),
  } as unknown as AuthService;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    guard = new JwtAuthGuard(reflector, authService);
  });

  it('allows @Public routes without Authorization', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) =>
      key === IS_PUBLIC_KEY ? true : false,
    );

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(authService.resolveBearerAuth).not.toHaveBeenCalled();
  });

  it('sets actor from valid Bearer token', async () => {
    (authService.resolveBearerAuth as jest.Mock).mockResolvedValue({
      kind: 'valid',
      actor: { userId: 'user-jwt', userName: 'JWT User' },
    });

    const ctx = createContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().actor).toEqual({
      source: 'jwt',
      clientUserId: 'user-jwt',
      displayName: 'JWT User',
      resolvedUserId: 'user-jwt',
    });
  });

  it('rejects invalid Bearer', async () => {
    (authService.resolveBearerAuth as jest.Mock).mockResolvedValue({
      kind: 'invalid',
    });

    await expect(
      guard.canActivate(createContext({ authorization: 'Bearer bad' })),
    ).rejects.toThrow(new UnauthorizedException(AUTH_SESSION_EXPIRED_MESSAGE));
  });

  it('rejects missing Bearer on protected routes', async () => {
    (authService.resolveBearerAuth as jest.Mock).mockResolvedValue({
      kind: 'absent',
    });

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      new UnauthorizedException('请先登录'),
    );
  });
});
