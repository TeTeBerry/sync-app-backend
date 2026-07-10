import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PublicApiRateLimitService } from '@src/common/rate-limit/public-api-rate-limit.service';
import type { RedisService } from '@src/redis/redis.service';

describe('PublicApiRateLimitService', () => {
  const createService = (overrides: Record<string, number> = {}) => {
    const values: Record<string, number> = {
      'publicApi.rateLimit.windowMs': 60_000,
      'publicApi.rateLimit.ravenPlanMax': 2,
      'publicApi.rateLimit.ravenPlanPollMax': 2,
      'publicApi.rateLimit.ravenPlanReadMax': 2,
      'publicApi.rateLimit.publicEventsMax': 2,
      ...overrides,
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    const redis = {
      incrementRateLimit: jest.fn().mockResolvedValue(null),
    } as unknown as RedisService;
    return new PublicApiRateLimitService(redis, config);
  };

  const req = (headers: Record<string, string>, ip?: string): Request =>
    ({
      headers,
      ip,
    }) as unknown as Request;

  it('prefers validated x-raven-rate-key over spoofable X-Forwarded-For for raven scopes', async () => {
    const service = createService();
    const rateKey = 'proxyIssuedKey123';
    const withKey = req({
      'x-raven-rate-key': rateKey,
      'x-forwarded-for': '1.1.1.1',
    });
    const spoofedXffSameKey = req({
      'x-raven-rate-key': rateKey,
      'x-forwarded-for': '9.9.9.9',
    });
    const otherKey = req({
      'x-raven-rate-key': 'otherProxyKey456',
      'x-forwarded-for': '1.1.1.1',
    });

    await service.assertAllowedAsync('raven_plan', withKey);
    await service.assertAllowedAsync('raven_plan', spoofedXffSameKey);

    await expect(
      service.assertAllowedAsync('raven_plan', spoofedXffSameKey),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    // Different proxy-issued key is a separate bucket (not collapsed by shared XFF).
    await expect(
      service.assertAllowedAsync('raven_plan', otherKey),
    ).resolves.toBeUndefined();
  });

  it('ignores invalid x-raven-rate-key and falls back to IP / XFF', async () => {
    const service = createService();
    const a = req({
      'x-raven-rate-key': 'bad key!',
      'x-forwarded-for': '2.2.2.2',
    });
    const b = req({
      'x-forwarded-for': '2.2.2.2',
    });

    await service.assertAllowedAsync('raven_plan_poll', a);
    await service.assertAllowedAsync('raven_plan_poll', b);
    await expect(
      service.assertAllowedAsync('raven_plan_poll', b),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('does not let x-raven-rate-key rotate buckets on non-raven scopes', async () => {
    const service = createService();
    const first = req({
      'x-raven-rate-key': 'rotateKeyAAAA',
      'x-forwarded-for': '3.3.3.3',
    });
    const rotated = req({
      'x-raven-rate-key': 'rotateKeyBBBB',
      'x-forwarded-for': '3.3.3.3',
    });

    await service.assertAllowedAsync('public_events', first);
    await service.assertAllowedAsync('public_events', rotated);
    await expect(
      service.assertAllowedAsync('public_events', rotated),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
