import { Injectable } from '@nestjs/common';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import type { TravelGuideGenerationCacheParams } from '../domain/travel-guide-generation-cache.util';
import { TravelGuideGenerationCacheService } from '../travel-guide-generation-cache.service';

/**
 * Cache facade for generated plans.
 * Delegates to TravelGuideGenerationCacheService.
 */
@Injectable()
export class TravelGuideCacheService {
  constructor(
    private readonly generationCache: TravelGuideGenerationCacheService,
  ) {}

  findGeneratedPlan(cacheKey: string): Promise<TravelGuidePlan | null> {
    return this.generationCache.findPlan(cacheKey);
  }

  findSimilarGeneratedPlan(
    params: TravelGuideGenerationCacheParams,
  ): Promise<TravelGuidePlan | null> {
    return this.generationCache.findSimilarPlan(params);
  }

  saveGeneratedPlan(
    cacheKey: string,
    activityLegacyId: number,
    params: TravelGuideGenerationCacheParams,
    plan: TravelGuidePlan,
  ): Promise<void> {
    return this.generationCache.savePlan(
      cacheKey,
      activityLegacyId,
      params,
      plan,
    );
  }
}
