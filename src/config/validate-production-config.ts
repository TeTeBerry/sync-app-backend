import type { ConfigService } from '@nestjs/config';

const DEV_JWT_SECRET = 'sync-dev-jwt-secret-change-me';
const MIN_JWT_SECRET_LENGTH = 32;

export function validateProductionConfig(config: ConfigService): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const errors: string[] = [];

  const jwtSecret = config.get<string>('auth.jwtSecret')?.trim() ?? '';
  if (!jwtSecret || jwtSecret === DEV_JWT_SECRET) {
    errors.push('JWT_SECRET must be set to a strong value in production');
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }

  const appId = config.get<string>('auth.wechatMini.appId')?.trim() ?? '';
  const appSecret =
    config.get<string>('auth.wechatMini.appSecret')?.trim() ?? '';
  if (!appId || !appSecret) {
    errors.push('WECHAT_MINI_APP_ID and WECHAT_MINI_APP_SECRET are required');
  }

  const hunyuanKey = config.get<string>('hunyuan.apiKey')?.trim() ?? '';
  if (!hunyuanKey) {
    errors.push('HUNYUAN_API_KEY is required for AI features in production');
  }

  const corsOrigins = config.get<string[]>('cors.origins');
  if (!corsOrigins?.length) {
    errors.push(
      'CORS_ORIGINS should be set for production H5 (comma-separated)',
    );
  }

  if (errors.length) {
    throw new Error(
      `Production configuration invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
}
