import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideGenerationCache,
  TravelGuideGenerationCacheDocument,
} from '../../database/schemas/travel-guide-generation-cache.schema';
import type { TravelGuidePlan } from './domain/travel-guide.types';
import type { TravelGuideGenerationCacheParams } from './domain/travel-guide-generation-cache.util';

@Injectable()
export class TravelGuideGenerationCacheService {
  private readonly logger = new Logger(TravelGuideGenerationCacheService.name);

  constructor(
    @InjectModel(TravelGuideGenerationCache.name)
    private readonly model: Model<TravelGuideGenerationCacheDocument>,
  ) {}

  async findPlan(cacheKey: string): Promise<TravelGuidePlan | null> {
    const doc = await this.model.findOne({ cacheKey }).lean().exec();
    if (!doc?.plan) return null;
    return doc.plan as TravelGuidePlan;
  }

  async savePlan(
    cacheKey: string,
    activityLegacyId: number,
    params: TravelGuideGenerationCacheParams,
    plan: TravelGuidePlan,
  ): Promise<void> {
    await this.model.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          activityLegacyId,
          requestParams: params,
          plan,
        },
      },
      { upsert: true },
    );
    this.logger.debug(
      `travel guide cached activity=${activityLegacyId} key=${cacheKey.slice(0, 8)}`,
    );
  }
}
