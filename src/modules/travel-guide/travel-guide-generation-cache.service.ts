import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideGenerationCache,
  TravelGuideGenerationCacheDocument,
} from '../../database/schemas/travel-guide-generation-cache.schema';
import type { TravelGuidePlan } from './domain/travel-guide.types';
import {
  buildTravelGuideGenerationCacheKey,
  type TravelGuideGenerationCacheParams,
  isFuzzyTravelGuideParamsMatch,
} from './domain/travel-guide-generation-cache.util';

@Injectable()
export class TravelGuideGenerationCacheService {
  private readonly logger = new Logger(TravelGuideGenerationCacheService.name);
  private readonly generationTtlSec: number;

  constructor(
    @InjectModel(TravelGuideGenerationCache.name)
    private readonly model: Model<TravelGuideGenerationCacheDocument>,
    config: ConfigService,
  ) {
    this.generationTtlSec =
      config.get<number>('travelGuide.cache.generationTtlSec') ?? 604_800;
  }

  async findPlan(cacheKey: string): Promise<TravelGuidePlan | null> {
    const now = new Date();
    const doc = await this.model
      .findOne({
        cacheKey,
        $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }],
      })
      .lean()
      .exec();
    if (!doc?.plan) return null;
    return doc.plan as TravelGuidePlan;
  }

  async savePlan(
    cacheKey: string,
    activityLegacyId: number,
    params: TravelGuideGenerationCacheParams,
    plan: TravelGuidePlan,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.generationTtlSec * 1000);
    await this.model.updateOne(
      { cacheKey },
      {
        $set: {
          cacheKey,
          activityLegacyId,
          requestParams: params,
          plan,
          expiresAt,
        },
      },
      { upsert: true },
    );
    this.logger.debug(
      `travel guide cached activity=${activityLegacyId} key=${cacheKey.slice(0, 8)} ttlSec=${this.generationTtlSec}`,
    );
  }

  /**
   * Fuzzy lookup: scan recent cache entries for the same activityLegacyId
   * and return the first one whose params pass isFuzzyTravelGuideParamsMatch.
   */
  async findSimilarPlan(
    exactParams: TravelGuideGenerationCacheParams,
    maxCandidates = 15,
  ): Promise<TravelGuidePlan | null> {
    const now = new Date();
    const docs = await this.model
      .find({
        activityLegacyId: exactParams.activityLegacyId,
        $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }],
      })
      .sort({ createdAt: -1 })
      .limit(maxCandidates)
      .lean()
      .exec();

    for (const doc of docs) {
      const candidate = doc.requestParams as TravelGuideGenerationCacheParams;
      if (isFuzzyTravelGuideParamsMatch(exactParams, candidate)) {
        this.logger.log(
          `travel guide fuzzy hit activity=${exactParams.activityLegacyId} ` +
            `exact=${buildTravelGuideGenerationCacheKey(exactParams).slice(0, 8)} ` +
            `fuzzy=${doc.cacheKey.slice(0, 8)}`,
        );
        return doc.plan as TravelGuidePlan;
      }
    }
    return null;
  }
}
