import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import { RedisService } from '../../redis/redis.service';
import { createHash } from 'crypto';

@Injectable()
export class ItineraryCacheService {
  private readonly logger = new Logger(ItineraryCacheService.name);
  private readonly scheduleTtlSec: number;
  private readonly generationTtlSec: number;
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
    private readonly jsonCache: RedisMemoryJsonCacheService,
    config: ConfigService,
  ) {
    this.scheduleTtlSec =
      config.get<number>('itinerary.cache.scheduleTtlSec') ?? 600;
    this.generationTtlSec =
      config.get<number>('itinerary.cache.generationTtlSec') ?? 3600;
    this.lockTtlSec = config.get<number>('itinerary.cache.lockTtlSec') ?? 30;
    this.rateMax = config.get<number>('itinerary.rateLimit.max') ?? 8;
    this.rateWindowSec =
      config.get<number>('itinerary.rateLimit.windowSec') ?? 300;
  }

  scheduleKey(activityLegacyId: number, dateKey?: string): string {
    return `itinerary:schedule:v6:${activityLegacyId}:${dateKey ?? 'all'}`;
  }

  generationKey(
    activityLegacyId: number,
    dateKey: string,
    selectedDjIds: string[],
  ): string {
    const sorted = [...selectedDjIds].sort().join(',');
    const hash = createHash('sha256')
      .update(`${activityLegacyId}:${dateKey}:${sorted}`)
      .digest('hex')
      .slice(0, 24);
    return `itinerary:gen:v2:${hash}`;
  }

  generateLockKey(userId: string, activityLegacyId: number): string {
    return `itinerary:lock:${userId}:${activityLegacyId}`;
  }

  rateLimitKey(userId: string, activityLegacyId: number): string {
    return `itinerary:rate:${userId}:${activityLegacyId}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    return this.jsonCache.getJson<T>(key);
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    await this.jsonCache.setJson(key, value, ttlSec);
  }

  async invalidateSchedule(
    activityLegacyId: number,
    dateKey?: string,
  ): Promise<void> {
    await this.jsonCache.delete(this.scheduleKey(activityLegacyId, dateKey));
    if (!dateKey) {
      return;
    }
    await this.jsonCache.delete(this.scheduleKey(activityLegacyId));
  }

  async getScheduleCache<T>(
    activityLegacyId: number,
    dateKey?: string,
  ): Promise<T | null> {
    return this.getJson<T>(this.scheduleKey(activityLegacyId, dateKey));
  }

  async setScheduleCache(
    activityLegacyId: number,
    payload: unknown,
    dateKey?: string,
  ): Promise<void> {
    await this.setJson(
      this.scheduleKey(activityLegacyId, dateKey),
      payload,
      this.scheduleTtlSec,
    );
  }

  async getGenerationCache<T>(
    activityLegacyId: number,
    dateKey: string,
    selectedDjIds: string[],
  ): Promise<T | null> {
    return this.getJson<T>(
      this.generationKey(activityLegacyId, dateKey, selectedDjIds),
    );
  }

  async setGenerationCache(
    activityLegacyId: number,
    dateKey: string,
    selectedDjIds: string[],
    payload: unknown,
  ): Promise<void> {
    await this.setJson(
      this.generationKey(activityLegacyId, dateKey, selectedDjIds),
      payload,
      this.generationTtlSec,
    );
  }

  /** Returns false when duplicate submit (lock held). */
  async acquireGenerateLock(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const key = this.generateLockKey(userId, activityLegacyId);
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

  async releaseGenerateLock(
    userId: string,
    activityLegacyId: number,
  ): Promise<void> {
    const key = this.generateLockKey(userId, activityLegacyId);
    this.memoryLocks.delete(key);
    if (this.redis.isEnabled()) {
      await this.redis.deleteCacheValue(key);
    }
  }

  /** Returns true if allowed; false if rate limited. */
  async checkRateLimit(
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
    return entry.count <= this.rateMax;
  }
}
