import {
  formatProductionConfigFailure,
  validateProductionConfig,
} from '../../../src/config/validate-production-config';

function mockConfig(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
  } as never;
}

describe('validateProductionConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('skips validation outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(validateProductionConfig(mockConfig({}))).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it('reports JWT secret errors in production', () => {
    process.env.NODE_ENV = 'production';
    const result = validateProductionConfig(
      mockConfig({
        'auth.jwtSecret': 'sync-dev-jwt-secret-change-me',
        'auth.wechatMini.appId': 'wx-test',
        'auth.wechatMini.appSecret': 'secret',
        'hunyuan.apiKey': 'hk-test',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.apiKey': 'hk-test',
      }),
    );
    expect(result.errors.join('\n')).toMatch(/JWT_SECRET/);
  });

  it('warns but does not block when CORS_ORIGINS is unset', () => {
    process.env.NODE_ENV = 'production';
    const result = validateProductionConfig(
      mockConfig({
        'auth.jwtSecret': 'a'.repeat(32),
        'auth.wechatMini.appId': 'wx-test',
        'auth.wechatMini.appSecret': 'secret',
        'hunyuan.apiKey': 'hk-test',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.apiKey': 'hk-test',
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toMatch(/CORS_ORIGINS/);
  });

  it('requires CLOUDBASE_ENV_ID for CloudBase text LLM', () => {
    process.env.NODE_ENV = 'production';
    const result = validateProductionConfig(
      mockConfig({
        'auth.jwtSecret': 'a'.repeat(32),
        'auth.wechatMini.appId': 'wx-test',
        'auth.wechatMini.appSecret': 'secret',
        'hunyuan.apiKey': 'hk-test',
        'cloudbase.envId': '',
      }),
    );
    expect(result.errors.join('\n')).toMatch(/CLOUDBASE_ENV_ID/);
  });

  it('requires CloudBase credentials for text LLM', () => {
    process.env.NODE_ENV = 'production';
    const result = validateProductionConfig(
      mockConfig({
        'auth.jwtSecret': 'a'.repeat(32),
        'auth.wechatMini.appId': 'wx-test',
        'auth.wechatMini.appSecret': 'secret',
        'hunyuan.apiKey': '',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.apiKey': '',
        'cloudbase.secretId': '',
        'cloudbase.secretKey': '',
      }),
    );
    expect(result.errors.join('\n')).toMatch(/CloudBase text LLM/);
  });

  it('formats fatal errors for startup logs', () => {
    expect(
      formatProductionConfigFailure({
        errors: ['JWT_SECRET must be at least 32 characters'],
        warnings: [],
      }),
    ).toContain('JWT_SECRET must be at least 32 characters');
  });
});
