import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { WechatMiniService } from '../../../src/modules/auth/wechat-mini.service';
import { WechatContentSecurityService } from '../../../src/modules/auth/wechat-content-security.service';
import { WechatUserRiskService } from '../../../src/modules/auth/wechat-user-risk.service';
import { UserService } from '../../../src/modules/user/user.service';
import { USER_REPOSITORY } from '../../../src/modules/user/interfaces/user.repository.interface';

describe('AuthService', () => {
  let authService: AuthService;

  const users = {
    upsertByExternalId: jest.fn(),
    upsertWechatUser: jest.fn(),
    findByOpenid: jest.fn(),
    getTokenVersion: jest.fn().mockResolvedValue(0),
    updateByExternalId: jest.fn(),
  };

  const userService = {
    getMe: jest.fn(),
  };

  const wechatUserRisk = {
    isEnabled: jest.fn(() => false),
    fetchAndAssertRiskRank: jest.fn().mockResolvedValue(0),
    shouldRefreshStoredRank: jest.fn(() => false),
    assertRankAllowed: jest.fn(),
  };

  const wechatContentSecurity = {
    isEnabled: jest.fn(() => false),
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        WechatMiniService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'auth.mode') return 'dev';
              if (key === 'auth.wechatMini.appId') return 'wx-test';
              if (key === 'auth.wechatMini.appSecret') return 'secret';
              return fallback;
            },
          },
        },
        { provide: USER_REPOSITORY, useValue: users },
        { provide: UserService, useValue: userService },
        { provide: WechatUserRiskService, useValue: wechatUserRisk },
        {
          provide: WechatContentSecurityService,
          useValue: wechatContentSecurity,
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it('issues token on dev login', async () => {
    users.upsertByExternalId.mockResolvedValue({
      externalId: 'dev_abc',
      name: 'Tester',
    });
    userService.getMe.mockResolvedValue({
      id: 'dev_abc',
      name: 'Tester',
      handle: '@dev_abc',
      location: '',
      bio: '',
      avatar: '',
    });

    const result = await authService.loginWithDev('Tester');

    expect(result.accessToken).toBeTruthy();
    expect(result.user.id).toBe('dev_abc');
    expect(result.user.name).toBe('Tester');
  });

  it('persists WeChat nickName and avatarUrl on login', async () => {
    const wechatMini = {
      exchangeCode: jest.fn().mockResolvedValue({
        openid: 'openid-1',
        sessionKey: 'sk',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        { provide: WechatMiniService, useValue: wechatMini },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback?: string) => fallback,
          },
        },
        { provide: USER_REPOSITORY, useValue: users },
        { provide: UserService, useValue: userService },
        {
          provide: WechatUserRiskService,
          useValue: {
            fetchAndAssertRiskRank: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: WechatContentSecurityService,
          useValue: wechatContentSecurity,
        },
      ],
    }).compile();

    const svc = moduleRef.get(AuthService);
    users.findByOpenid.mockResolvedValue(null);
    users.upsertWechatUser.mockResolvedValue({
      externalId: 'wx_openid-1',
      name: 'Berry',
      avatar: 'https://wx.qlogo.cn/mmopen/avatar.png',
    });
    userService.getMe.mockResolvedValue({
      id: 'wx_openid-1',
      name: 'Berry',
      handle: '@Berry',
      location: '',
      bio: '',
      avatar: 'https://wx.qlogo.cn/mmopen/avatar.png',
    });

    await svc.loginWithWechatCode(
      'wx-code',
      {
        nickName: 'Berry',
        avatarUrl: 'https://wx.qlogo.cn/mmopen/avatar.png',
      },
      '127.0.0.1',
    );

    expect(users.upsertWechatUser).toHaveBeenCalledWith(
      'openid-1',
      expect.objectContaining({
        name: 'Berry',
        avatar: 'https://wx.qlogo.cn/mmopen/avatar.png',
      }),
    );
  });

  it('rejects dev login when disabled in production mode', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        { provide: WechatMiniService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'auth.mode') return 'wechat';
              return fallback;
            },
          },
        },
        { provide: UserService, useValue: userService },
        { provide: WechatUserRiskService, useValue: wechatUserRisk },
        {
          provide: WechatContentSecurityService,
          useValue: wechatContentSecurity,
        },
        { provide: USER_REPOSITORY, useValue: users },
      ],
    }).compile();

    const svc = moduleRef.get(AuthService);

    await expect(svc.loginWithDev()).rejects.toBeInstanceOf(ForbiddenException);

    process.env.NODE_ENV = prev;
  });
});
