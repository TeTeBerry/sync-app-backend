import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '@src/common/auth/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@src/common/auth/auth.constants';
import {
  AUTH_SESSION_EXPIRED_MESSAGE,
} from '@src/common/auth/jwt-bearer.util';

function createContext(
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): ExecutionContext {
  const request = { headers, query, actor: undefined } as {
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
  const jwtService = {
    verify: jest.fn(),
  } as unknown as JwtService;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    (configService.get as jest.Mock).mockReturnValue(false);
    guard = new JwtAuthGuard(reflector, jwtService, configService);
  });

  it('allows @Public routes without Authorization', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) =>
      key === IS_PUBLIC_KEY ? true : false,
    );

    expect(guard.canActivate(createContext())).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('sets actor from valid Bearer token', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'user-jwt',
      name: 'JWT User',
    });

    const ctx = createContext({ authorization: 'Bearer valid-token' });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().actor).toEqual({
      source: 'jwt',
      clientUserId: 'user-jwt',
      displayName: 'JWT User',
      resolvedUserId: 'user-jwt',
    });
  });

  it('rejects invalid Bearer', () => {
    (jwtService.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid');
    });

    expect(() =>
      guard.canActivate(createContext({ authorization: 'Bearer bad' })),
    ).toThrow(new UnauthorizedException(AUTH_SESSION_EXPIRED_MESSAGE));
  });

  it('rejects missing Bearer when demo query disabled', () => {
    expect(() => guard.canActivate(createContext())).toThrow(
      new UnauthorizedException('请先登录'),
    );
  });

  it('allows demo query when AUTH_ALLOW_DEMO is enabled', () => {
    (configService.get as jest.Mock).mockReturnValue(true);

    const ctx = createContext({}, { userId: 'demo-client' });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().actor?.source).toBe('demo');
  });
});
