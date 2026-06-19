import type { ConfigService } from '@nestjs/config';

const DEV_JWT_SECRET = 'sync-dev-jwt-secret-change-me';
const MIN_JWT_SECRET_LENGTH = 32;

export type ProductionConfigValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateProductionConfig(
  config: ConfigService,
): ProductionConfigValidationResult {
  if (process.env.NODE_ENV !== 'production') {
    return { errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

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
    warnings.push(
      'CORS_ORIGINS is unset — OK for WeChat mini program (callContainer); set comma-separated HTTPS origins if you ship H5',
    );
  }

  return { errors, warnings };
}

export function formatProductionConfigFailure(
  result: ProductionConfigValidationResult,
): string {
  return `Production configuration invalid:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`;
}
