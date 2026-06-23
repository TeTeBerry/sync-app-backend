import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HunyuanReasoningEffort } from '../../../infra/llm/text-llm.client';
import { LlmService } from '../../../infra/llm/llm.service';
import { ActivityService } from '../../activity/activity.service';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  resolveTravelGuideBudgetTier,
} from '../domain/parse-activity-days.util';
import type { LlmTravelGuidePayload } from '../domain/travel-guide.types';
import { isTravelGuideAbroad } from '../domain/travel-guide-international.util';
import { sanitizeLlmTravelGuidePayload } from '../domain/travel-guide-payload-normalize.util';
import { stripLlmAccommodationPayload } from '../domain/travel-guide-accommodation-preference.util';
import {
  mapCandidatesToLlmFallback,
  mergeAccommodationSchemesWithLlmPolish,
  mergeNightlifeWithLlmPolish,
  mergeRankedHotelsWithLlmPolish,
} from './travel-guide-map-plan.builder';
import { mergeVenueTransportWithLlmPolish } from '../domain/travel-guide-transport.util';
import { compactCandidatesForLlm } from '../domain/travel-guide-llm-candidates.util';
import type {
  TravelGuideMapContext,
  TravelGuideMapLlmInput,
  TravelGuideRankedCandidates,
} from './travel-guide-map.types';
import { TravelGuidePoiCollector } from './travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './travel-guide-poi.ranker';

@Injectable()
export class TravelGuidePoiPipeline {
  constructor(
    private readonly poiCollector: TravelGuidePoiCollector,
    private readonly poiRanker: TravelGuidePoiRanker,
  ) {}

  async run(
    activity: Parameters<TravelGuidePoiCollector['collect']>[0],
    generationDto: GenerateTravelGuideDto,
    accommodationNights: number,
  ): Promise<{
    mapCtx: TravelGuideMapContext;
    ranked: TravelGuideRankedCandidates;
  }> {
    const mapCtx = await this.poiCollector.collect(activity, generationDto);
    if (!mapCtx) {
      throw new ServiceUnavailableException(
        '无法获取场馆周边推荐（酒店/散场/停车），请确认活动地址或明日再试；若使用高德 Key，请检查配额是否用尽',
      );
    }

    const ranked = this.poiRanker.rank(mapCtx, generationDto);
    this.assertRankedCandidates(
      ranked,
      Boolean(generationDto.selfDrive),
      accommodationNights,
    );

    return { mapCtx, ranked };
  }

  private assertRankedCandidates(
    ranked: TravelGuideRankedCandidates,
    selfDrive: boolean,
    accommodationNights: number,
  ): void {
    if (accommodationNights > 0 && !ranked.hotels.length) {
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
}
