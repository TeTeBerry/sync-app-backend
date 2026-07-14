import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityService } from '../../activity/activity.service';
import { parseActivityDayCount } from '../domain/parse-activity-days.util';
import { travelGuideRegionKind } from '../domain/travel-guide-international.util';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { HotelRecommendationService } from '../recommendation/hotel-recommendation.service';
import { LocationSearchService } from '../search/location-search.service';
import { HotelSearchService } from '../search/hotel-search.service';
import { FestivalStayGuideService } from '../stay-guide/festival-stay-guide.service';

/** Explicit inventory lookup after Raven has established a recommended area. */
@Injectable()
export class RavenHotelAvailabilityService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly locationSearch: LocationSearchService,
    private readonly stayGuideService: FestivalStayGuideService,
    private readonly hotelSearch: HotelSearchService,
    private readonly hotelRecommendation: HotelRecommendationService,
  ) {}

  async search(activityLegacyId: number, dto: GenerateTravelGuideDto) {
    if (!dto.departureDate || !dto.returnDate) {
      throw new BadRequestException(
        'departureDate and returnDate are required for hotel availability',
      );
    }
    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity)
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);

    const accommodationNights = Math.max(
      1,
      dto.accommodationNights ?? parseActivityDayCount(activity.date),
    );
    const location = await this.locationSearch.resolveAndCollect(
      activity,
      dto,
      accommodationNights,
    );
    const stayGuide = this.stayGuideService.getGuide(activity);
    const hotels = await this.hotelSearch.search({
      destinationCity:
        activity.area?.trim() || activity.location || activity.name,
      checkInDate: dto.departureDate,
      checkOutDate: dto.returnDate,
      accommodationNights,
      headcount: dto.headcount,
      budgetTier: dto.budgetTier ?? 'standard',
      stayPreference: dto.stayPreference,
      regionKind: travelGuideRegionKind(activity),
      locale: dto.locale,
      venue: location.mapCtx?.venue,
      activityLegacyId: activity.legacyId,
      activityName: activity.name,
      activityCode: activity.code,
      activityArea: activity.area,
      activityLocation: activity.location,
      recommendedAreas: stayGuide.recommendedAreas.map((area) => area.area),
      mapHotels: location.ranked?.hotels,
    });
    const recommendations = this.hotelRecommendation.recommend(
      hotels,
      undefined,
      dto.stayPreference,
      stayGuide.recommendedAreas,
    );

    return { stayGuide, hotels, recommendations };
  }
}
