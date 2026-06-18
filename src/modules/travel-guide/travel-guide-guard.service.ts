import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
} from './domain/travel-guide-generation-cache.util';

@Injectable()
export class TravelGuideGuardService {
  private readonly logger = new Logger(TravelGuideGuardService.name);
  private readonly lockTtlSec: number;
  private readonly rateMax: number;
  private readonly rateWindowSec: number;
  private readonly memoryLocks = new Map<string, number>();
  private readonly memoryRate = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.lockTtlSec = config.get<number>('travelGuide.cache.lockTtlSec') ?? 45;
    this.rateMax = config.get<number>('travelGuide.rateLimit.max') ?? 6;
    this.rateWindowSec =
      config.get<number>('travelGuide.rateLimit.windowSec') ?? 300;
  }

  generationLockKey(userId: string, cacheKey: string): string {
    const hash = createHash('sha256')
      .update(cacheKey)
      .digest('hex')
      .slice(0, 16);
    return `travel-guide:lock:${userId}:${hash}`;
  }

  rateLimitKey(userId: string, activityLegacyId: number): string {
    return `travel-guide:rate:${userId}:${activityLegacyId}`;
  }

  async assertCanGenerate(
    userId: string,
    activityLegacyId: number,
  ): Promise<void> {
    const allowed = await this.checkRateLimit(userId, activityLegacyId);
    if (!allowed) {
      throw new HttpException(
        `出行攻略生成过于频繁，请 ${Math.ceil(this.rateWindowSec / 60)} 分钟后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Returns false when another identical generation is in flight. */
  async acquireGenerationLock(
    userId: string,
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
  ): Promise<boolean> {
    const cacheKey = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        activityLegacyId,
        dto,
        accommodationNights,
      ),
    );
    const key = this.generationLockKey(userId, cacheKey);

    if (this.redis.isEnabled()) {
      const existing = await this.redis.getCacheValue(key);
      if (existing) return false;
      await this.redis.setCacheValueEx(key, '1', this.lockTtlSec);
      return true;
    }

    const now = Date.now();
    const expiresAt = this.memoryLocks.get(key) ?? 0;
    if (expiresAt > now) return false;
    this.memoryLocks.set(key, now + this.lockTtlSec * 1000);
    return true;
  }

  async releaseGenerationLock(
    userId: string,
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
  ): Promise<void> {
    const cacheKey = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        activityLegacyId,
        dto,
        accommodationNights,
      ),
    );
    const key = this.generationLockKey(userId, cacheKey);
    this.memoryLocks.delete(key);
    if (this.redis.isEnabled()) {
      await this.redis.deleteCacheValue(key);
    }
  }

  private async checkRateLimit(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const key = this.rateLimitKey(userId, activityLegacyId);
    const redisCount = await this.redis.incrementRateLimit(
      key,
      this.rateWindowSec,
    );
    if (redisCount != null) {
      return redisCount <= this.rateMax;
    }

    const now = Date.now();
    const entry = this.memoryRate.get(key);
    if (!entry || entry.resetAt <= now) {
      this.memoryRate.set(key, {
        count: 1,
        resetAt: now + this.rateWindowSec * 1000,
      });
      return true;
    }
    entry.count += 1;
    if (entry.count > this.rateMax) {
      this.logger.warn(`Travel guide rate limit for user ${userId}`);
    }
    return entry.count <= this.rateMax;
  }
}
