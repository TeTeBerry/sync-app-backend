import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { travelGuideMapCollectUnavailableMessage } from '../domain/travel-guide-copy';
import { isTravelGuideAbroad } from '../domain/travel-guide-international.util';
import { resolveTravelGuideLocale } from '../domain/travel-guide-locale';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type {
  TravelGuideMapContext,
  TravelGuideRankedCandidates,
  RankedMapPoi,
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
    activity: Activity,
    generationDto: GenerateTravelGuideDto,
    accommodationNights: number,
  ): Promise<{
    mapCtx: TravelGuideMapContext;
    ranked: TravelGuideRankedCandidates;
  }> {
    const locale = resolveTravelGuideLocale(generationDto.locale);
    const abroad = isTravelGuideAbroad(activity);
    const mapCtx = await this.poiCollector.collect(activity, generationDto);
    if (!mapCtx) {
      throw new ServiceUnavailableException(
        travelGuideMapCollectUnavailableMessage(locale, abroad),
      );
    }

    const ranked = this.poiRanker.rank(mapCtx, generationDto);
    this.assertRankedCandidates(
      ranked,
      Boolean(generationDto.selfDrive),
      accommodationNights,
      abroad,
    );

    return { mapCtx, ranked };
  }

  rankHotelsForAllTiers(
    mapCtx: TravelGuideMapContext,
    generationDto: GenerateTravelGuideDto,
  ): Partial<Record<TravelGuideBudgetTier, RankedMapPoi[]>> {
    return this.poiRanker.rankHotelsForAllTiers(mapCtx, generationDto);
  }

  private assertRankedCandidates(
    ranked: TravelGuideRankedCandidates,
    selfDrive: boolean,
    accommodationNights: number,
    abroad: boolean,
  ): void {
    if (accommodationNights > 0 && !ranked.hotels.length && !abroad) {
      throw new BadRequestException(
        '场馆附近未检索到符合预算的酒店推荐，请调整预算档位或稍后重试',
      );
    }
    // Overseas guides can be generated without nightlife recommendations when
    // the curated catalog does not include a verified late-night venue.
    if (!ranked.nightlife.length && !abroad) {
      throw new BadRequestException(
        '场馆附近未检索到散场/餐饮推荐，请稍后重试',
      );
    }
    if (selfDrive && !ranked.parking.length && !abroad) {
      throw new BadRequestException('自驾模式下未检索到停车场，请稍后重试');
    }
  }
}
