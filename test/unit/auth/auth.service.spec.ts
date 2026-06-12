import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { WechatMiniService } from '../../../src/modules/auth/wechat-mini.service';
import { WechatContentSecurityService } from '../../../src/modules/auth/wechat-content-security.service';
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
              if (key === 'auth.mode') return 'wechat';
              if (key === 'auth.wechatMini.appId') return 'wx-test';
              if (key === 'auth.wechatMini.appSecret') return 'secret';
              return fallback;
            },
          },
        },
        { provide: USER_REPOSITORY, useValue: users },
        { provide: UserService, useValue: userService },
        {
          provide: WechatContentSecurityService,
          useValue: wechatContentSecurity,
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
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
            get: (key: string, fallback?: string) => {
              if (key === 'auth.wechatMini.appId') return 'wx-test';
              if (key === 'auth.wechatMini.appSecret') return 'secret';
              return fallback;
            },
          },
        },
        { provide: UserService, useValue: userService },
        {
          provide: WechatContentSecurityService,
          useValue: wechatContentSecurity,
        },
        { provide: USER_REPOSITORY, useValue: users },
      ],
    }).compile();

    const svc = moduleRef.get(AuthService);

    users.findByOpenid.mockResolvedValue(null);
    users.upsertWechatUser.mockResolvedValue({
      externalId: 'wx_openid-1',
      name: 'Tester',
    });
    userService.getMe.mockResolvedValue({
      id: 'wx_openid-1',
      name: 'Tester',
      handle: '@tester',
      location: '',
      bio: '',
      avatar: 'https://example.com/a.jpg',
    });

    const result = await svc.loginWithWechatCode('code-1', {
      nickName: 'Tester',
      avatarUrl: 'https://example.com/a.jpg',
    });

    expect(result.accessToken).toBeTruthy();
    expect(users.upsertWechatUser).toHaveBeenCalledWith(
      'openid-1',
      expect.objectContaining({
        name: 'Tester',
        avatar: 'https://example.com/a.jpg',
      }),
    );
  });
});
