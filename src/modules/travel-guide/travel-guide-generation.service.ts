import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { LlmService } from '../../ai/llm/llm.service';
import { TencentMapService } from './map/tencent-map.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { buildTravelGuidePlan } from './domain/travel-guide-fallback.builder';
import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  parseActivityDayCount,
} from './domain/parse-activity-days.util';
import type {
  LlmTravelGuidePayload,
  TravelGuidePlan,
} from './domain/travel-guide.types';
import { sanitizeLlmTravelGuidePayload } from './domain/travel-guide-payload-normalize.util';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { mapCandidatesToLlmFallback } from './map/travel-guide-map-plan.builder';
import type { TravelGuideMapLlmInput } from './map/travel-guide-map.types';
import type { TravelGuideMapContext } from './map/travel-guide-map.types';
import type { TravelGuideRankedCandidates } from './map/travel-guide-map.types';

/** 仅允许基于腾讯地图候选数据做 AI 润色，禁止无 POI 上下文的生成 */
const TRAVEL_GUIDE_MAP_JSON_SYSTEM = [
  '你是电音节出行攻略助手。输入均为腾讯地图检索后的结构化候选（距离、评分、推荐分、是否适合散场）。',
  '请完成：1) 按预算与距离筛选；2) 按推荐分选取最优；3) 将数据润色为生动中文攻略。',
  '输出 JSON（不要 markdown），字段：transportLines, hotels, parkingLines(仅自驾), nightlifeSpots, tipItems。',
  '硬性规则：',
  '- 酒店/店铺名称必须来自 candidates，禁止编造列表外商户。',
  '- 酒店 note 写明预算区间、距会场距离、评分（若有）、拼房/晚数提示；价格落在 hotelPriceBand 内。',
  '- 散场 nightlife 优先 lateNightFriendly=true，避免普通午市餐厅。',
  '- transportLines 必须是字符串数组（每项为一句完整中文），禁止输出对象；须结合 route、transportHints、venueReadableAddress。',
  '- interCity 为 true 时：先写高铁/航班等城际交通，再写抵目的地后的打车/地铁接驳；禁止把深圳市内地铁写成从上海出发的全程方案。',
  '不要输出天气。',
].join('');

@Injectable()
export class TravelGuideGenerationService {
  private readonly logger = new Logger(TravelGuideGenerationService.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly llmService: LlmService,
    private readonly tencentMap: TencentMapService,
    private readonly poiCollector: TravelGuidePoiCollector,
    private readonly poiRanker: TravelGuidePoiRanker,
  ) {}

  async generate(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
  ): Promise<{ plan: TravelGuidePlan }> {
    if (!this.tencentMap.enabled) {
      throw new ServiceUnavailableException(
        'AI 出行攻略依赖腾讯地图，请配置 TENCENT_MAP_KEY 后重试',
      );
    }

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity.date);

    const mapCtx = await this.poiCollector.collect(activity, dto);
    if (!mapCtx) {
      throw new ServiceUnavailableException(
        '无法获取场馆周边推荐（酒店/餐饮），请确认活动地址或明日再试；若使用腾讯地图 Key，请检查配额是否用尽',
      );
    }

    const ranked = this.poiRanker.rank(mapCtx, dto);
    this.assertRankedCandidates(ranked, Boolean(dto.selfDrive));

    const llmPayload = await this.buildPayloadFromMap(
      activity,
      dto,
      accommodationNights,
      mapCtx,
      ranked,
    );

    const plan = buildTravelGuidePlan({
      activity,
      departure: dto.departure.trim(),
      headcount: dto.headcount,
      budgetTier: dto.budgetTier,
      accommodationNights,
      selfDrive: dto.selfDrive,
      llm: llmPayload,
      mapSourcedOnly: true,
    });

    return { plan };
  }

  private assertRankedCandidates(
    ranked: TravelGuideRankedCandidates,
    selfDrive: boolean,
  ): void {
    if (!ranked.hotels.length) {
      throw new BadRequestException(
        '场馆附近未检索到符合预算的酒店，请调整出发地或预算档位',
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

  /**
   * 腾讯地图排序结果 →（可选）AI 润色 → 否则地图结构化文案，均不使用无地图上下文的 LLM。
   */
  private async buildPayloadFromMap(
    activity: NonNullable<
      Awaited<ReturnType<ActivityService['findByLegacyId']>>
    >,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    mapCtx: TravelGuideMapContext,
    ranked: TravelGuideRankedCandidates,
  ): Promise<LlmTravelGuidePayload> {
    const polished = await this.tryPolishWithAi(
      activity,
      dto,
      accommodationNights,
      mapCtx,
      ranked,
    );

    const payload =
      polished ??
      mapCandidatesToLlmFallback(mapCtx, ranked, {
        departure: dto.departure.trim(),
        selfDrive: Boolean(dto.selfDrive),
        accommodationNights,
        headcount: dto.headcount,
      });

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

    const hotelRanges = budgetTierHotelNightRanges(dto.budgetTier);
    const routeSummary = mapCtx.drivingRoute ?? mapCtx.transitRoute;
    const payload: TravelGuideMapLlmInput = {
      activityName: activity.name,
      venueLabel: activity.location?.trim() || mapCtx.venue.title,
      venueReadableAddress: mapCtx.venueReadableAddress,
      venueSource: mapCtx.venueSource,
      eventDates: activity.date?.trim() || '详见官方日程',
      departure: dto.departure.trim(),
      headcount: dto.headcount,
      budgetTier: dto.budgetTier,
      budgetLabel: budgetTierLabel(dto.budgetTier),
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
      ...payload,
      hotelPriceBands: [hotelRanges.primary, hotelRanges.secondary],
      minHotelRating: ranked.minHotelRating,
      preferAfterparty: true,
    });

    try {
      const result = await this.llmService.invokeJson<LlmTravelGuidePayload>(
        TRAVEL_GUIDE_MAP_JSON_SYSTEM,
        user,
        60_000,
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
    if (!result?.transportLines?.length || !result.hotels?.length) {
      return false;
    }
    if (!result.nightlifeSpots?.length) return false;
    if (selfDrive && !result.parkingLines?.length) {
      return false;
    }
    return true;
  }
}
