import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FestivalPlanProgressDto } from '@sync/festival-plan-contracts';
import { RedisMemoryJsonCacheService } from './redis-memory-json-cache.service';

export type HomeSummaryCachePayload = Record<string, unknown>;

@Injectable()
export class HomeSummaryCacheService {
  private readonly ttlSec: number;

  constructor(
    private readonly jsonCache: RedisMemoryJsonCacheService,
    config: ConfigService,
  ) {
    this.ttlSec = config.get<number>('bff.homeSummaryTtlSec') ?? 45;
  }

  private key(userId: string): string {
    return `bff:home:summary:${userId}`;
  }

  async get(userId: string): Promise<HomeSummaryCachePayload | null> {
    if (!userId.trim()) return null;
    return this.jsonCache.getJson<HomeSummaryCachePayload>(this.key(userId));
  }

  async set(userId: string, payload: HomeSummaryCachePayload): Promise<void> {
    if (!userId.trim()) return;
    await this.jsonCache.setJson(this.key(userId), payload, this.ttlSec);
  }

  async invalidate(userId: string): Promise<void> {
    if (!userId.trim()) return;
    await this.jsonCache.delete(this.key(userId));
  }
}

@Injectable()
export class FestivalPlanProgressCacheService {
  private readonly ttlSec: number;

  constructor(
    private readonly jsonCache: RedisMemoryJsonCacheService,
    config: ConfigService,
  ) {
    this.ttlSec = config.get<number>('bff.festivalPlanTtlSec') ?? 60;
  }

  private key(userId: string, activityLegacyId: number): string {
    return `bff:festival-plan:${userId}:${activityLegacyId}`;
  }

  async get(
    userId: string,
    activityLegacyId: number,
  ): Promise<FestivalPlanProgressDto | null> {
    if (!userId.trim()) return null;
    return this.jsonCache.getJson<FestivalPlanProgressDto>(
      this.key(userId, activityLegacyId),
    );
  }

  async set(
    userId: string,
    activityLegacyId: number,
    payload: FestivalPlanProgressDto,
  ): Promise<void> {
    if (!userId.trim()) return;
    await this.jsonCache.setJson(
      this.key(userId, activityLegacyId),
      payload,
      this.ttlSec,
    );
  }

  async invalidate(userId: string, activityLegacyId?: number): Promise<void> {
    if (!userId.trim()) return;
    if (activityLegacyId != null && !Number.isNaN(activityLegacyId)) {
      await this.jsonCache.delete(this.key(userId, activityLegacyId));
    }
  }
}

/** Invalidate cached BFF reads after writes that affect home / festival plan. */
@Injectable()
export class BffReadCacheInvalidationService {
  constructor(
    private readonly homeSummaryCache: HomeSummaryCacheService,
    private readonly festivalPlanCache: FestivalPlanProgressCacheService,
  ) {}

  async invalidateHomeForUser(userId: string | undefined): Promise<void> {
    if (!userId?.trim()) return;
    await this.homeSummaryCache.invalidate(userId.trim());
  }

  async invalidateFestivalPlanForUser(
    userId: string | undefined,
    activityLegacyId: number,
  ): Promise<void> {
    if (!userId?.trim() || Number.isNaN(activityLegacyId)) return;
    await this.festivalPlanCache.invalidate(userId.trim(), activityLegacyId);
  }
}
