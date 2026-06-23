import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HunyuanReasoningEffort } from '../../infra/llm/text-llm.client';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  assertUserUgcTexts,
  collectTravelGuideUgcTexts,
} from '../../common/media/user-ugc-text.util';
import { ActivityService } from '../activity/activity.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { UserProfileSyncService } from '../user/user-profile-sync.service';
import { LlmService } from '../../infra/llm/llm.service';
import { AmapMapService } from './map/amap.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { buildTravelGuidePlan } from './domain/travel-guide-fallback.builder';
import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  parseActivityDayCount,
  resolveTravelGuideBudgetTier,
} from './domain/parse-activity-days.util';
import type {
  LlmTravelGuidePayload,
  TravelGuidePlan,
} from './domain/travel-guide.types';
import { isTravelGuideAbroad } from './domain/travel-guide-international.util';
import {
  resolveTravelGuideSupported,
  TRAVEL_GUIDE_PREPARING_MESSAGE,
} from './domain/travel-guide-support.util';
import { sanitizeLlmTravelGuidePayload } from './domain/travel-guide-payload-normalize.util';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { TravelGuideGenerationCacheService } from './travel-guide-generation-cache.service';
import { TravelGuideGuardService } from './travel-guide-guard.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
} from './domain/travel-guide-generation-cache.util';
import {
  mapCandidatesToLlmFallback,
  mergeAccommodationSchemesWithLlmPolish,
  mergeNightlifeWithLlmPolish,
  mergeRankedHotelsWithLlmPolish,
} from './map/travel-guide-map-plan.builder';
import { mergeVenueTransportWithLlmPolish } from './domain/travel-guide-transport.util';
import { compactCandidatesForLlm } from './domain/travel-guide-llm-candidates.util';
import type { TravelGuideMapLlmInput } from './map/travel-guide-map.types';
import type { TravelGuideMapContext } from './map/travel-guide-map.types';
import type { TravelGuideRankedCandidates } from './map/travel-guide-map.types';

/** 仅允许基于候选 POI 数据做 AI 润色，禁止无 POI 上下文的生成 */
const TRAVEL_GUIDE_MAP_JSON_SYSTEM = [
  '你是电音节出行攻略助手。交通/酒店/散场候选来自境内高德地图周边检索，或境外/港澳台活动的运营精选 POI（candidates 列表）。',
  '请完成：1) 按预算与距离筛选；2) 按推荐分选取最优；3) 将数据润色为生动中文攻略。',
  '输出 JSON（不要 markdown），字段：',
  'transportLines, accommodationSchemes, hotels, parkingLines(仅自驾), nightlifeSpots, tipItems,',
  'documentItems(仅出国/港澳台), ticketChannels, essentials{network,payment,apps}, venueTransportOptions, budgetItems。',
  '硬性规则：',
  '- 酒店/店铺名称必须来自 candidates，禁止编造列表外商户。',
  '- accommodationSchemes 必须恰好 2 项：label 分别为「就近方案」「市中心方案」，各含 name/note/reason/bookingHint；reason 说明为何选该方案；境外场 bookingHint 用「携程 / Agoda / Booking / Airbnb」。',
  '- hotels 输出 candidates.hotels 前 6 项（与地图排序一致），每项含 name/note/reason/bookingHint；reason 说明距离、预算、评分或场景优势，禁止编造列表外酒店。',
  '- 酒店 note 写明预算区间、距会场距离、评分（若有）、拼房/晚数提示；价格落在 hotelPriceBand 内。',
  '- 散场 nightlifeSpots 输出 candidates.nightlife 前 6 项，每项含 name/note/reason；仅来自「夜宵」检索候选，优先 lateNightFriendly=true；reason 说明为何适合散场后前往（营业时段、距离、品类等）。',
  '- transportLines 必须是字符串数组（每项为一句完整中文），禁止输出对象；须结合 route、transportHints、venueReadableAddress。',
  '- transportLines 仅写城际/国际段（从出发地到目的地城市）：国内跨城写高铁/航班，境外写国际航班与入境准备；境外须从用户出发地对应机场出发（如深圳→深圳宝安 SZX），禁止写高铁/深圳北站等国内枢纽；勿写机场/酒店到会场的细节。',
  '- venueTransportOptions 仅写目的地市内最后一段（机场/酒店/车站 → 会场）；方式与 label 须符合目的地真实交通；禁止写国际航班订票、出发机场飞往目的机场、往返机票等城际/国际段内容；不得增删条目，仅润色 lines。',
  '- transportLines 与 venueTransportOptions 内容禁止重复；城际段与接驳段分开写。',
  '- venueTransportOptions 给出 3–4 种抵达会场方式，每项含 label 与 lines 数组。',
  '- ticketChannels 列出官方与常用购票渠道（含 externalUrl 若有）；每项含 name 与 note。',
  '- essentials 分 network/payment/apps 三组，出国场须写 eSIM/签证区货币/当地叫车 App。',
  '- documentItems 仅当 isAbroad=true 时输出，含护照、签证/签注、返程票、保险等入境必备。',
  '- budgetItems 须含：机票/城际交通(若跨城)、门票、住宿(按用户 budgetTier 与晚数)、市内/会场交通、餐饮、现金/杂费、合计参考；各项 range 为本次出行合计金额（非人均），合计项 label 写「合计参考（全员）」或「合计参考（单人）」并在 note 注明是否含人均；range 用「约 ¥X–Y」格式。',
  '- interCity 为 true 时：transportLines 只写出发地→目的地城市；venueTransportOptions 只写抵目的地后的接驳；禁止把全程写成一种方式。',
  '不要输出天气。',
].join('');

const TRAVEL_GUIDE_LLM_TIMEOUT_MS_DEFAULT = 25_000;

@Injectable()
export class TravelGuideGenerationService {
  private readonly logger = new Logger(TravelGuideGenerationService.name);
  private readonly travelGuideReasoningEffort: HunyuanReasoningEffort;
  private readonly travelGuideLlmTimeoutMs: number;
  private readonly travelGuideLlmPolishEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly activityService: ActivityService,
    private readonly llmService: LlmService,
    private readonly amap: AmapMapService,
    private readonly poiCollector: TravelGuidePoiCollector,
    private readonly poiRanker: TravelGuidePoiRanker,
    private readonly generationCache: TravelGuideGenerationCacheService,
    private readonly travelGuideGuard: TravelGuideGuardService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly userProfileSync: UserProfileSyncService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {
    this.travelGuideReasoningEffort = (this.config.get<string>(
      'hunyuan.travelGuideReasoningEffort',
    ) ?? 'low') as HunyuanReasoningEffort;
    this.travelGuideLlmTimeoutMs =
      this.config.get<number>('hunyuan.travelGuideLlmTimeoutMs') ??
      TRAVEL_GUIDE_LLM_TIMEOUT_MS_DEFAULT;
    this.travelGuideLlmPolishEnabled =
      this.config.get<boolean>('hunyuan.travelGuideLlmPolishEnabled') ?? true;
  }

  async generate(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
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

    const generationDto: GenerateTravelGuideDto = {
      ...dto,
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    };

    const cacheParams = normalizeTravelGuideGenerationParams(
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    const cacheKey = buildTravelGuideGenerationCacheKey(cacheParams);
    const cachedPlan = await this.generationCache.findPlan(cacheKey);
    if (cachedPlan) {
      this.logger.log(
        `travel guide cache hit activity=${activityLegacyId} key=${cacheKey.slice(0, 8)}`,
      );
      this.userProfileSync.applyTravelGuideHints(actor, {
        departure: dto.departure,
        departureCity: dto.departureCity,
      });
      const guideId = await this.persistSavedPlanIfRequested(
        dto,
        accommodationNights,
        actor.resolvedUserId,
        activityLegacyId,
        cachedPlan,
      );
      return guideId ? { plan: cachedPlan, guideId } : { plan: cachedPlan };
    }

    // Fuzzy cache: try similar params before generating
    const fuzzyPlan = await this.generationCache.findSimilarPlan(cacheParams);
    if (fuzzyPlan) {
      this.userProfileSync.applyTravelGuideHints(actor, {
        departure: dto.departure,
        departureCity: dto.departureCity,
      });
      const guideId = await this.persistSavedPlanIfRequested(
        dto,
        accommodationNights,
        actor.resolvedUserId,
        activityLegacyId,
        fuzzyPlan,
      );
      return guideId ? { plan: fuzzyPlan, guideId } : { plan: fuzzyPlan };
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
        const guideId = await this.persistSavedPlanIfRequested(
          dto,
          accommodationNights,
          actor.resolvedUserId,
          activityLegacyId,
          racingPlan,
        );
        return guideId ? { plan: racingPlan, guideId } : { plan: racingPlan };
      }
      throw new ServiceUnavailableException(
        '相同参数的攻略正在生成中，请稍后再试',
      );
    }

    try {
      const mapCtx = await this.poiCollector.collect(activity, generationDto);
      if (!mapCtx) {
        throw new ServiceUnavailableException(
          '无法获取场馆周边推荐（酒店/散场/停车），请确认活动地址或明日再试；若使用高德 Key，请检查配额是否用尽',
        );
      }

      const ranked = this.poiRanker.rank(mapCtx, generationDto);
      this.assertRankedCandidates(ranked, Boolean(generationDto.selfDrive));

      const llmPayload = await this.buildPayloadFromMap(
        activity,
        generationDto,
        accommodationNights,
        mapCtx,
        ranked,
      );

      const plan = buildTravelGuidePlan({
        activity,
        departure: generationDto.departure.trim(),
        headcount: generationDto.headcount,
        budgetTier: generationDto.budgetTier!,
        accommodationNights,
        selfDrive: generationDto.selfDrive,
        llm: llmPayload,
        mapSourcedOnly: true,
        interCity: Boolean(mapCtx.interCity),
      });

      await this.generationCache.savePlan(
        cacheKey,
        activityLegacyId,
        cacheParams,
        plan,
      );

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
    } finally {
      await this.travelGuideGuard.releaseGenerationLock(
        actor.resolvedUserId,
        activityLegacyId,
        generationDto,
        accommodationNights,
      );
    }
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

  private assertRankedCandidates(
    ranked: TravelGuideRankedCandidates,
    selfDrive: boolean,
  ): void {
    if (!ranked.hotels.length) {
      throw new BadRequestException(
        '场馆附近未检索到符合预算的酒店推荐，请调整预算档位或稍后重试',
      );
    }
    if (!ranked.nightlife.length) {
      throw new BadRequestException(
        '场馆附近未检索到散场/餐饮推荐，请稍后重试',
      );
    }
    if (selfDrive && !ranked.parking.length) {
      throw new BadRequestException('自驾模式下未检索到停车场，请稍后重试');
    }
  }

  private async buildPayloadFromMap(
    activity: NonNullable<
      Awaited<ReturnType<ActivityService['findByLegacyId']>>
    >,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    mapCtx: TravelGuideMapContext,
    ranked: TravelGuideRankedCandidates,
  ): Promise<LlmTravelGuidePayload> {
    const mapPayload = mapCandidatesToLlmFallback(mapCtx, ranked, {
      departure: dto.departure.trim(),
      departureCity: dto.departureCity?.trim(),
      selfDrive: Boolean(dto.selfDrive),
      accommodationNights,
      headcount: dto.headcount,
      activity,
    });

    if (
      !this.travelGuideLlmPolishEnabled ||
      !this.isValidMapSourcedPayload(mapPayload, Boolean(dto.selfDrive))
    ) {
      if (!this.isValidMapSourcedPayload(mapPayload, Boolean(dto.selfDrive))) {
        throw new ServiceUnavailableException('攻略内容生成失败，请稍后重试');
      }
      return mapPayload;
    }

    const polished = await this.tryPolishWithAi(
      activity,
      dto,
      accommodationNights,
      mapCtx,
      ranked,
    );

    const polishedOrMap = polished ?? mapPayload;
    const payload = {
      ...polishedOrMap,
      hotels: mergeRankedHotelsWithLlmPolish(
        mapPayload.hotels,
        polishedOrMap.hotels,
      ),
      accommodationSchemes: mergeAccommodationSchemesWithLlmPolish(
        mapPayload.accommodationSchemes ?? [],
        polishedOrMap.accommodationSchemes,
      ),
      nightlifeSpots: mergeNightlifeWithLlmPolish(
        mapPayload.nightlifeSpots,
        polishedOrMap.nightlifeSpots,
      ),
      documentItems: polishedOrMap.documentItems?.length
        ? polishedOrMap.documentItems
        : mapPayload.documentItems,
      ticketChannels: polishedOrMap.ticketChannels?.length
        ? polishedOrMap.ticketChannels
        : mapPayload.ticketChannels,
      essentials: polishedOrMap.essentials ?? mapPayload.essentials,
      venueTransportOptions: mergeVenueTransportWithLlmPolish(
        mapPayload.venueTransportOptions ?? [],
        polishedOrMap.venueTransportOptions,
        {
          departure: dto.departure.trim(),
          venueTitle: mapCtx.venue.title,
          venueReadableAddress: mapCtx.venueReadableAddress,
          selfDrive: Boolean(dto.selfDrive),
          interCity: Boolean(mapCtx.interCity),
          route: mapCtx.drivingRoute ?? mapCtx.transitRoute,
          transportHints: mapCtx.transportHints,
          departureCity: dto.departureCity?.trim(),
          activity,
        },
      ),
      budgetItems: polishedOrMap.budgetItems?.length
        ? polishedOrMap.budgetItems
        : mapPayload.budgetItems,
    };

    if (!this.isValidMapSourcedPayload(payload, Boolean(dto.selfDrive))) {
      throw new ServiceUnavailableException('攻略内容生成失败，请稍后重试');
    }

    return payload;
  }

  private async tryPolishWithAi(
    activity: NonNullable<
      Awaited<ReturnType<ActivityService['findByLegacyId']>>
    >,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    mapCtx: TravelGuideMapContext,
    ranked: TravelGuideRankedCandidates,
  ): Promise<LlmTravelGuidePayload | null> {
    if (!this.llmService.enabled) return null;

    const budgetTier = resolveTravelGuideBudgetTier(dto.budgetTier);
    const hotelRanges = budgetTierHotelNightRanges(budgetTier);
    const routeSummary = mapCtx.drivingRoute ?? mapCtx.transitRoute;
    const payload: TravelGuideMapLlmInput = {
      activityName: activity.name,
      venueLabel: activity.location?.trim() || mapCtx.venue.title,
      venueReadableAddress: mapCtx.venueReadableAddress,
      venueSource: mapCtx.venueSource,
      eventDates: activity.date?.trim() || '详见官方日程',
      departure: dto.departure.trim(),
      headcount: dto.headcount,
      budgetTier,
      budgetLabel: budgetTierLabel(budgetTier),
      accommodationNights,
      selfDrive: Boolean(dto.selfDrive),
      eventEndHour: mapCtx.eventEndHour,
      transportSource: mapCtx.transportSource,
      transportHints: mapCtx.transportHints,
      interCity: Boolean(mapCtx.interCity),
      route: routeSummary
        ? {
            ...routeSummary,
            departureTitle: mapCtx.departure?.title,
            venueTitle: mapCtx.venue.title,
            mode: mapCtx.drivingRoute ? 'driving' : 'transit',
          }
        : undefined,
      candidates: ranked,
    };

    const user = JSON.stringify({
      activityName: payload.activityName,
      venueLabel: payload.venueLabel,
      venueReadableAddress: payload.venueReadableAddress,
      eventDates: payload.eventDates,
      departure: payload.departure,
      headcount: payload.headcount,
      budgetTier: payload.budgetTier,
      budgetLabel: payload.budgetLabel,
      accommodationNights: payload.accommodationNights,
      selfDrive: payload.selfDrive,
      eventEndHour: payload.eventEndHour,
      transportHints: payload.transportHints,
      interCity: payload.interCity,
      route: payload.route,
      candidates: compactCandidatesForLlm(ranked),
      hotelPriceBands: [hotelRanges.primary, hotelRanges.secondary],
      minHotelRating: ranked.minHotelRating,
      preferAfterparty: true,
      isAbroad: isTravelGuideAbroad(activity),
      activityRegion: activity.region ?? 'domestic',
      externalUrl: activity.externalUrl ?? null,
    });

    try {
      const result = await this.llmService.invokeJson<LlmTravelGuidePayload>(
        TRAVEL_GUIDE_MAP_JSON_SYSTEM,
        user,
        this.travelGuideLlmTimeoutMs,
        { reasoningEffort: this.travelGuideReasoningEffort },
      );
      const sanitized = sanitizeLlmTravelGuidePayload(result);
      if (!this.isValidMapSourcedPayload(sanitized, dto.selfDrive)) return null;
      return sanitized;
    } catch (error) {
      this.logger.warn(
        `travel guide AI polish failed, using map templates: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private isValidMapSourcedPayload(
    result: LlmTravelGuidePayload | null,
    selfDrive?: boolean,
  ): result is LlmTravelGuidePayload {
    if (!result?.transportLines?.length) return false;
    const hasHotels =
      result.accommodationSchemes?.length === 2 || result.hotels?.length >= 2;
    if (!hasHotels) return false;
    if (!result.nightlifeSpots?.length) return false;
    if (!result.ticketChannels?.length) return false;
    if (!result.budgetItems?.length) return false;
    if (!result.venueTransportOptions?.length) return false;
    if (selfDrive && !result.parkingLines?.length) {
      return false;
    }
    return true;
  }
}
