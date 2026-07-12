import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

const REDIS_KEY_PREFIX = 'public:rate:';

type MemoryBucket = { count: number; resetAt: number };

export type PublicRateLimitScope =
  | 'travel_guide_map'
  | 'travel_guide_plan'
  | 'raven_place_suggestions'
  | 'raven_plan'
  | 'raven_plan_poll'
  | 'raven_plan_read'
  | 'post_ai_search'
  | 'post_ai_compose'
  | 'scene_run'
  | 'chat_session'
  | 'personality_nickname_usage'
  | 'poster_background'
  | 'public_events'
  | 'auth_email_login_ip'
  | 'auth_email_login_email';

const RAVEN_RATE_KEY_HEADER = 'x-raven-rate-key';
const RAVEN_RATE_KEY_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

@Injectable()
export class PublicApiRateLimitService {
  private readonly logger = new Logger(PublicApiRateLimitService.name);
  private readonly memoryBuckets = new Map<string, MemoryBucket>();
  private readonly limits: Record<
    PublicRateLimitScope,
    { maxRequests: number; windowMs: number }
  >;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    const windowMs =
      config.get<number>('publicApi.rateLimit.windowMs') ?? 60_000;
    this.limits = {
      travel_guide_map: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.travelGuideMapMax') ?? 30,
        windowMs,
      },
      travel_guide_plan: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.travelGuidePlanMax') ?? 40,
        windowMs,
      },
      raven_place_suggestions: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.ravenPlaceSuggestionsMax') ??
          60,
        windowMs,
      },
      raven_plan: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.ravenPlanMax') ?? 20,
        windowMs,
      },
      // Polling must not share the generate budget — ~1.5s interval would exhaust 20/min quickly.
      raven_plan_poll: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.ravenPlanPollMax') ?? 180,
        windowMs,
      },
      // Saved-plan reads can trigger quote refresh — keep tighter than poll.
      raven_plan_read: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.ravenPlanReadMax') ?? 30,
        windowMs,
      },
      post_ai_search: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.postAiSearchMax') ?? 40,
        windowMs,
      },
      post_ai_compose: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.postAiComposeMax') ?? 30,
        windowMs,
      },
      scene_run: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.sceneRunMax') ??
          config.get<number>('publicApi.rateLimit.postAiSearchMax') ??
          40,
        windowMs,
      },
      chat_session: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.chatSessionMax') ?? 60,
        windowMs,
      },
      personality_nickname_usage: {
        maxRequests:
          config.get<number>(
            'publicApi.rateLimit.personalityNicknameUsageMax',
          ) ?? 30,
        windowMs,
      },
      poster_background: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.posterBackgroundMax') ?? 8,
        windowMs:
          config.get<number>('publicApi.rateLimit.posterBackgroundWindowMs') ??
          24 * 60 * 60 * 1000,
      },
      public_events: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.publicEventsMax') ?? 120,
        windowMs:
          config.get<number>('publicApi.rateLimit.publicEventsWindowMs') ??
          windowMs,
      },
      auth_email_login_ip: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.authEmailLoginIpMax') ?? 20,
        windowMs:
          config.get<number>('publicApi.rateLimit.authEmailLoginWindowMs') ??
          15 * 60 * 1000,
      },
      auth_email_login_email: {
        maxRequests:
          config.get<number>('publicApi.rateLimit.authEmailLoginEmailMax') ??
          10,
        windowMs:
          config.get<number>('publicApi.rateLimit.authEmailLoginWindowMs') ??
          15 * 60 * 1000,
      },
    };
  }

  assertAllowed(
    scope: PublicRateLimitScope,
    req: Request,
    actorKey?: string,
  ): void {
    void scope;
    void req;
    void actorKey;
    // Prefer assertAllowedAsync; sync path kept for compatibility.
  }

  async assertAllowedAsync(
    scope: PublicRateLimitScope,
    req: Request,
    actorKey?: string,
  ): Promise<void> {
    const key = this.buildKey(scope, req, actorKey);
    const { maxRequests, windowMs } = this.limits[scope];
    const redisKey = `${REDIS_KEY_PREFIX}${key}`;
    const windowSec = Math.ceil(windowMs / 1000);

    const redisCount = await this.redis.incrementRateLimit(redisKey, windowSec);
    if (redisCount != null) {
      if (redisCount > maxRequests) {
        throw new HttpException(
          '请求过于频繁，请稍后再试',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return;
    }

    if (!this.checkMemory(key, maxRequests, windowMs)) {
      throw new HttpException(
        '请求过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private buildKey(
    scope: PublicRateLimitScope,
    req: Request,
    actorKey?: string,
  ): string {
    // Only Raven scopes honor proxy-issued x-raven-rate-key (avoids key rotation
    // bypass on other public endpoints that still key by IP).
    const headerKey = req.headers[RAVEN_RATE_KEY_HEADER]?.toString().trim();
    const ravenRateKey =
      scope.startsWith('raven_') &&
      headerKey &&
      RAVEN_RATE_KEY_PATTERN.test(headerKey)
        ? headerKey
        : undefined;
    // Prefer explicit actor / proxy-issued rate key over spoofable XFF.
    const client =
      actorKey?.trim() ||
      ravenRateKey ||
      req.ip?.trim() ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      'anonymous';
    return `${scope}:${client}`;
  }

  private checkMemory(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): boolean {
    const now = Date.now();
    for (const [k, v] of this.memoryBuckets) {
      if (now >= v.resetAt) this.memoryBuckets.delete(k);
    }
    const existing = this.memoryBuckets.get(key);
    if (!existing || now >= existing.resetAt) {
      this.memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    existing.count += 1;
    if (existing.count > maxRequests) {
      this.logger.warn(`Public rate limit exceeded (memory) for ${key}`);
      return false;
    }
    return true;
  }
}
