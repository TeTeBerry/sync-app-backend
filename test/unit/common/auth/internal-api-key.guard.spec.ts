import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../../src/common/auth/internal-api-key.guard';

describe('InternalApiKeyGuard', () => {
  const createContext = (headers: Record<string, string | undefined>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as ExecutionContext;

  const mockConfig = (apiKey: string) =>
    ({
      get: (key: string) => (key === 'internal.apiKey' ? apiKey : undefined),
    }) as unknown as ConfigService;

  it('rejects when INTERNAL_API_KEY is not configured', () => {
    const guard = new InternalApiKeyGuard(mockConfig(''));

    expect(() =>
      guard.canActivate(createContext({ 'x-internal-api-key': 'secret' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects missing or wrong header', () => {
    const guard = new InternalApiKeyGuard(mockConfig('expected-key'));

    expect(() => guard.canActivate(createContext({}))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.canActivate(createContext({ 'x-internal-api-key': 'wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('allows matching header', () => {
    const guard = new InternalApiKeyGuard(mockConfig('expected-key'));

    expect(
      guard.canActivate(
        createContext({ 'x-internal-api-key': 'expected-key' }),
      ),
    ).toBe(true);
  });
});
