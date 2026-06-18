import { validateProductionConfig } from '../../../src/config/validate-production-config';

describe('validateProductionConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('skips validation outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(() =>
      validateProductionConfig({
        get: () => undefined,
      } as never),
    ).not.toThrow();
  });

  it('throws when JWT secret is missing in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      validateProductionConfig({
        get: (key: string) => {
          if (key === 'auth.jwtSecret') return 'sync-dev-jwt-secret-change-me';
          if (key === 'auth.wechatMini.appId') return 'wx-test';
          if (key === 'auth.wechatMini.appSecret') return 'secret';
          if (key === 'hunyuan.apiKey') return 'hk-test';
          if (key === 'cors.origins') return ['https://example.com'];
          return undefined;
        },
      } as never),
    ).toThrow(/JWT_SECRET/);
  });
});
