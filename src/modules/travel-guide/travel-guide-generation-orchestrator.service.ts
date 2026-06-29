import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  assertUserUgcTexts,
  collectTravelGuideUgcTexts,
} from '../../common/media/user-ugc-text.util';
import { ActivityService } from '../activity/activity.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { UserProfileSyncService } from '../user/user-profile-sync.service';
import { AmapMapService } from './map/amap.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { buildTravelGuidePlan } from './domain/travel-guide-fallback.builder';
import {
  parseActivityDayCount,
  resolveTravelGuideBudgetTier,
} from './domain/parse-activity-days.util';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import {
  resolveTravelGuideSupported,
  TRAVEL_GUIDE_PREPARING_MESSAGE,
} from './domain/travel-guide-support.util';
import { applyTravelGuideAccommodationPreference } from './domain/travel-guide-accommodation-preference.util';
import { TravelGuidePoiPipeline } from './map/travel-guide-poi.pipeline';
import { TravelGuideLlmPolishService } from './travel-guide-llm-polish.service';
import { TravelGuideGenerationCacheService } from './travel-guide-generation-cache.service';
import { TravelGuideGuardService } from './travel-guide-guard.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
  reconcileDepartureCityForCache,
} from './domain/travel-guide-generation-cache.util';
import { applyTravelQuoteEnrichment } from './domain/travel-guide-quote-merge.util';
import { buildPlanHotelByTierFromMapRankings } from './domain/travel-guide-map-hotel-tier.util';
import { buildMinimalMapContextForQuote } from './domain/travel-guide-quote-map-context.util';
import { travelGuideRegionKind } from './domain/travel-guide-international.util';
import { shouldFetchTravelQuote } from './domain/travel-guide-quote.util';
import {
  isPlanQuoteFresh,
  resolveQuoteCacheTtlMs,
} from './domain/travel-guide-quote-freshness.util';
import { TravelQuoteEnrichmentService } from './travel-quote-enrichment.service';
import {
  reportTravelGuideProgress,
  type TravelGuideProgressReporter,
} from './domain/travel-guide-generation-progress.util';

export type TravelGuideGenerateOptions = {
  onProgress?: TravelGuideProgressReporter;
};

@Injectable()
export class TravelGuideGenerationOrchestrator {
  private readonly logger = new Logger(TravelGuideGenerationOrchestrator.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly amap: AmapMapService,
    private readonly config: ConfigService,
    private readonly poiPipeline: TravelGuidePoiPipeline,
    private readonly llmPolish: TravelGuideLlmPolishService,
    private readonly generationCache: TravelGuideGenerationCacheService,
    private readonly travelGuideGuard: TravelGuideGuardService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly userProfileSync: UserProfileSyncService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly quoteEnrichment: TravelQuoteEnrichmentService,
  ) {}

  async generate(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
    options?: TravelGuideGenerateOptions,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    const onProgress = options?.onProgress;
    await reportTravelGuideProgress(onProgress, 'validating');

    if (!this.amap.enabled) {
      throw new ServiceUnavailableException(
        'AI 出行攻略依赖高德地图，请配置 AMAP_KEY 后重试',
      );
    }

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    if (!resolveTravelGuideSupported(activity)) {
      throw new BadRequestException(TRAVEL_GUIDE_PREPARING_MESSAGE);
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectTravelGuideUgcTexts(dto),
    );

    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity.date);

    const departure = dto.departure.trim();
    const departureCity = reconcileDepartureCityForCache(
      departure,
      dto.departureCity?.trim(),
    );

    const { departureCity: _dtoDepartureCity, ...dtoRest } = dto;
    const generationDto: GenerateTravelGuideDto = {
      ...dtoRest,
      departure,
      ...(departureCity ? { departureCity } : {}),
      accommodationNights,
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    };

    const cacheParams = normalizeTravelGuideGenerationParams(
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    const cacheKey = buildTravelGuideGenerationCacheKey(cacheParams);
    const skipGenerationCache = generationDto.forceRegenerate === true;

    if (!skipGenerationCache) {
      const cachedPlan = await this.generationCache.findPlan(cacheKey);
      if (cachedPlan) {
        this.logger.log(
          `travel guide cache hit activity=${activityLegacyId} key=${cacheKey.slice(0, 8)}`,
        );
        const { plan: enriched, quoteRefreshed } =
          await this.enrichCachedPlanWithQuotes(
            cachedPlan,
            activity,
            generationDto,
            accommodationNights,
            onProgress,
          );
        if (quoteRefreshed) {
          await this.generationCache.savePlan(
            cacheKey,
            activityLegacyId,
            cacheParams,
            enriched,
          );
        }
        await reportTravelGuideProgress(onProgress, 'completed');
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          enriched,
        );
      }

      const fuzzyPlan = await this.generationCache.findSimilarPlan(cacheParams);
      if (fuzzyPlan) {
        this.logger.log(
          `travel guide fuzzy cache hit activity=${activityLegacyId}`,
        );
        const { plan: enriched } = await this.enrichCachedPlanWithQuotes(
          fuzzyPlan,
          activity,
          generationDto,
          accommodationNights,
          onProgress,
        );
        await reportTravelGuideProgress(onProgress, 'completed');
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          enriched,
        );
      }
    } else {
      this.logger.log(
        `travel guide force regenerate activity=${activityLegacyId} departure="${generationDto.departure.trim()}"`,
      );
    }

    await this.travelGuideGuard.assertCanGenerate(
      actor.resolvedUserId,
      activityLegacyId,
    );

    const lockAcquired = await this.travelGuideGuard.acquireGenerationLock(
      actor.resolvedUserId,
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    if (!lockAcquired) {
      const racingPlan =
        (await this.generationCache.findPlan(cacheKey)) ??
        (await this.generationCache.findSimilarPlan(cacheParams));
      if (racingPlan) {
        const { plan: enriched } = await this.enrichCachedPlanWithQuotes(
          racingPlan,
          activity,
          generationDto,
          accommodationNights,
          onProgress,
        );
        await reportTravelGuideProgress(onProgress, 'completed');
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          enriched,
        );
      }
      throw new ServiceUnavailableException(
        '相同参数的攻略正在生成中，请稍后再试',
      );
    }

    try {
      await reportTravelGuideProgress(onProgress, 'map_poi');
      const { mapCtx, ranked } = await this.poiPipeline.run(
        activity,
        generationDto,
        accommodationNights,
      );

      const quoteEligible = shouldFetchTravelQuote(
        activity,
        generationDto,
        mapCtx,
      );

      const quoteSnapshot = quoteEligible
        ? await this.quoteEnrichment.run(
            activity,
            generationDto,
            mapCtx,
            accommodationNights,
            { onProgress },
          )
        : null;

      await reportTravelGuideProgress(onProgress, 'ai_writing');
      const llmPayload = await this.llmPolish.buildPayloadFromMap(
        activity,
        generationDto,
        accommodationNights,
        mapCtx,
        ranked,
      );

      await reportTravelGuideProgress(onProgress, 'assembling');
      const mapHotelByTier =
        accommodationNights > 0 &&
        travelGuideRegionKind(activity) === 'domestic'
          ? buildPlanHotelByTierFromMapRankings(
              this.poiPipeline.rankHotelsForAllTiers(mapCtx, generationDto),
              {
                accommodationNights,
                headcount: generationDto.headcount,
                activity,
                selectedBudgetTier: generationDto.budgetTier,
              },
            )
          : undefined;

      const basePlan = buildTravelGuidePlan({
        activity,
        departure: generationDto.departure.trim(),
        headcount: generationDto.headcount,
        budgetTier: generationDto.budgetTier!,
        accommodationNights,
        selfDrive: generationDto.selfDrive,
        llm: llmPayload,
        mapSourcedOnly: true,
        interCity: quoteEligible || Boolean(mapCtx.interCity),
      });

      const plan = applyTravelGuideAccommodationPreference(
        applyTravelQuoteEnrichment(
          mapHotelByTier
            ? { ...basePlan, hotelByTier: mapHotelByTier }
            : basePlan,
          quoteSnapshot,
          {
            headcount: generationDto.headcount,
            accommodationNights,
            regionKind: travelGuideRegionKind(activity),
            interCity: quoteEligible || Boolean(mapCtx.interCity),
            budgetTier: generationDto.budgetTier!,
          },
        ),
        accommodationNights,
      );

      await reportTravelGuideProgress(onProgress, 'finishing');
      await this.generationCache.savePlan(
        cacheKey,
        activityLegacyId,
        cacheParams,
        plan,
      );

      await reportTravelGuideProgress(onProgress, 'completed');
      return this.finishWithPlan(
        dto,
        accommodationNights,
        actor,
        activityLegacyId,
        plan,
      );
    } finally {
      await this.travelGuideGuard.releaseGenerationLock(
        actor.resolvedUserId,
        activityLegacyId,
        generationDto,
        accommodationNights,
      );
    }
  }

  /** 缓存命中时按需补跑 RollingGo（受 quote TTL 与 forceRegenerate 约束）。 */
  private async enrichCachedPlanWithQuotes(
    plan: TravelGuidePlan,
    activity: Awaited<ReturnType<ActivityService['findByLegacyId']>>,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    onProgress?: TravelGuideProgressReporter,
  ): Promise<{ plan: TravelGuidePlan; quoteRefreshed: boolean }> {
    if (!activity) {
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const mapCtx = buildMinimalMapContextForQuote(plan, activity, dto);
    const quoteEligible = shouldFetchTravelQuote(activity, dto, mapCtx);
    if (!quoteEligible) {
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const quoteTtlMs = resolveQuoteCacheTtlMs(
      this.config.get<number>('rollinggo.quoteCacheTtlSec'),
    );
    if (dto.forceRegenerate !== true && isPlanQuoteFresh(plan, quoteTtlMs)) {
      this.logger.log(
        `travel guide quote cache fresh activity=${activity.legacyId} fetchedAt=${plan.quoteFetchedAt}`,
      );
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const quoteSnapshot = await this.quoteEnrichment.run(
      activity,
      dto,
      mapCtx,
      accommodationNights,
      { onProgress },
    );

    if (
      !quoteSnapshot?.flight &&
      !quoteSnapshot?.hotel &&
      !quoteSnapshot?.flightByTier
    ) {
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const enriched = applyTravelQuoteEnrichment(plan, quoteSnapshot, {
      headcount: dto.headcount,
      accommodationNights,
      regionKind: travelGuideRegionKind(activity),
      interCity: quoteEligible || Boolean(mapCtx.interCity),
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    });

    return {
      plan: applyTravelGuideAccommodationPreference(
        enriched,
        accommodationNights,
      ),
      quoteRefreshed: Boolean(
        quoteSnapshot?.flight ||
        quoteSnapshot?.hotel ||
        quoteSnapshot?.flightByTier,
      ),
    };
  }

  private async finishWithPlan(
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    actor: RequestActor,
    activityLegacyId: number,
    plan: TravelGuidePlan,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    this.userProfileSync.applyTravelGuideHints(actor, {
      departure: dto.departure,
      departureCity: dto.departureCity,
    });

    const guideId = await this.persistSavedPlanIfRequested(
      dto,
      accommodationNights,
      actor.resolvedUserId,
      activityLegacyId,
      plan,
    );
    return guideId ? { plan, guideId } : { plan };
  }

  private async persistSavedPlanIfRequested(
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    ownerUserId: string,
    activityLegacyId: number,
    plan: TravelGuidePlan,
  ): Promise<string | undefined> {
    const guideId = dto.guideId?.trim();
    if (!guideId) return undefined;

    await this.savedPlanService.upsert(
      guideId,
      ownerUserId,
      activityLegacyId,
      dto,
      accommodationNights,
      plan,
    );
    return guideId;
  }
}
