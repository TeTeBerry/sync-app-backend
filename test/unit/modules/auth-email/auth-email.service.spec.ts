import { AuthEmailService } from '@src/modules/auth-email/auth-email.service';
import type { Request } from 'express';

describe('AuthEmailService', () => {
  const users = {
    findByEmailNormalized: jest.fn(),
    findByExternalId: jest.fn(),
    upsertByExternalId: jest.fn(),
    incrementTokenVersion: jest.fn(),
    getTokenVersion: jest.fn(),
  };
  const userService = {
    getMe: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('jwt-token'),
  };
  const rateLimit = {
    assertAllowedAsync: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'auth.tempEmailOnlyAuthEnabled') return 'true';
      return undefined;
    }),
  };

  let service: AuthEmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthEmailService(
      config as never,
      jwtService as never,
      userService as never,
      rateLimit as never,
      users as never,
    );
  });

  const req = { ip: '127.0.0.1', headers: {} } as Request;

  it('rejects invalid email', async () => {
    await expect(service.loginWithEmail('nope', req)).rejects.toThrow(
      /valid email/i,
    );
  });

  it('creates or retrieves user and returns uniform success copy', async () => {
    users.findByEmailNormalized.mockResolvedValue(null as never);
    users.findByExternalId.mockResolvedValue(null as never);
    users.upsertByExternalId.mockResolvedValue({
      externalId: 'email_abc',
      name: 'traveler',
      emailVerifiedAt: null,
    } as never);
    users.incrementTokenVersion.mockResolvedValue(1 as never);
    userService.getMe.mockResolvedValue({
      id: 'email_abc',
      name: 'traveler',
    } as never);

    const result = await service.loginWithEmail('Traveler@Example.com', req, {
      returnUrl: '/en/events/x/squad',
      intendedAction: 'create_squad_profile',
    });

    expect(result.message).toBe("You're signed in.");
    expect(result.accessToken).toBe('jwt-token');
    expect(result.returnUrl).toBe('/en/events/x/squad');
    expect(result.capabilities.canUseMessaging).toBe(false);
    expect(users.upsertByExternalId).toHaveBeenCalledWith(
      expect.stringMatching(/^email_/),
      expect.objectContaining({
        emailNormalized: 'traveler@example.com',
        emailVerifiedAt: null,
      }),
    );
  });

  it('rejects unsafe return URLs', async () => {
    users.findByEmailNormalized.mockResolvedValue({
      externalId: 'email_abc',
      name: 't',
      emailVerifiedAt: null,
    } as never);
    users.upsertByExternalId.mockResolvedValue({
      externalId: 'email_abc',
      name: 't',
      emailVerifiedAt: null,
    } as never);
    users.incrementTokenVersion.mockResolvedValue(2 as never);
    userService.getMe.mockResolvedValue({
      id: 'email_abc',
      name: 't',
    } as never);

    const result = await service.loginWithEmail('t@example.com', req, {
      returnUrl: 'https://evil.example',
    });
    expect(result.returnUrl).toBeNull();
  });

  it('does not create a second account for duplicate normalized email', async () => {
    users.findByEmailNormalized.mockResolvedValue({
      externalId: 'email_existing',
      name: 'Existing',
      emailVerifiedAt: null,
      handle: '@existing',
    } as never);
    users.upsertByExternalId.mockResolvedValue({
      externalId: 'email_existing',
      name: 'Existing',
      emailVerifiedAt: null,
    } as never);
    users.incrementTokenVersion.mockResolvedValue(3 as never);
    userService.getMe.mockResolvedValue({
      id: 'email_existing',
      name: 'Existing',
    } as never);

    await service.loginWithEmail('Existing@Example.com', req);
    expect(users.upsertByExternalId).toHaveBeenCalledWith(
      'email_existing',
      expect.objectContaining({ emailNormalized: 'existing@example.com' }),
    );
  });

  it('issueWebSession links Google Auth.js ids to an existing email identity', async () => {
    users.findByExternalId.mockResolvedValue(null as never);
    users.findByEmailNormalized.mockResolvedValue({
      externalId: 'email_existing',
      name: 'Existing',
      handle: '@existing',
      avatar: '',
    } as never);
    users.upsertByExternalId.mockResolvedValue({
      externalId: 'email_existing',
      name: 'Existing',
    } as never);
    users.getTokenVersion.mockResolvedValue(4 as never);

    const result = await service.issueWebSession({
      id: 'authjs-mongo-object-id',
      email: 'Existing@Example.com',
      name: 'Google Name',
      provider: 'google',
      providerUserId: 'authjs-mongo-object-id',
    });

    expect(result.accessToken).toBe('jwt-token');
    expect(users.upsertByExternalId).toHaveBeenCalledWith(
      'email_existing',
      expect.objectContaining({
        provider: 'google',
        providerUserId: 'authjs-mongo-object-id',
        emailNormalized: 'existing@example.com',
      }),
    );
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'email_existing', tv: 4 }),
    );
  });

  it('issueWebSession defaults providerUserId for new Google users', async () => {
    users.findByExternalId.mockResolvedValue(null as never);
    users.findByEmailNormalized.mockResolvedValue(null as never);
    users.upsertByExternalId.mockResolvedValue({
      externalId: 'authjs-user-1',
      name: 'Raven',
    } as never);
    users.getTokenVersion.mockResolvedValue(0 as never);

    await service.issueWebSession({
      id: 'authjs-user-1',
      email: 'raven@example.com',
      name: 'Raven',
      provider: 'google',
    });

    expect(users.upsertByExternalId).toHaveBeenCalledWith(
      'authjs-user-1',
      expect.objectContaining({
        provider: 'google',
        providerUserId: 'authjs-user-1',
      }),
    );
  });
});
