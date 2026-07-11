import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HunyuanReasoningEffort } from '../../infra/llm/text-llm.client';
import { LlmService } from '../../infra/llm/llm.service';
import { ActivityService } from '../activity/activity.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  resolveTravelGuideBudgetTier,
} from './domain/parse-activity-days.util';
import type { LlmTravelGuidePayload } from './domain/travel-guide-llm.types';
import {
  isTravelGuideAbroad,
  sanitizeTicketChannelsForActivity,
} from './domain/travel-guide-international.util';
import { sanitizeLlmTravelGuidePayload } from './domain/travel-guide-payload-normalize.util';
import { passesTravelGuideLocaleLanguage } from './domain/travel-guide-locale-language.util';
import { stripLlmAccommodationPayload } from './domain/travel-guide-accommodation-preference.util';
import {
  mapCandidatesToLlmFallback,
  mergeAccommodationSchemesWithLlmPolish,
  mergeNightlifeWithLlmPolish,
  mergeRankedHotelsWithLlmPolish,
} from './map/travel-guide-map-plan.builder';
import { mergeVenueTransportWithLlmPolish } from './domain/travel-guide-transport.util';
import { compactCandidatesForLlm } from './domain/travel-guide-llm-candidates.util';
import type {
  TravelGuideMapContext,
  TravelGuideMapLlmInput,
  TravelGuideRankedCandidates,
} from './map/travel-guide-map.types';
import {
  TRAVEL_GUIDE_LLM_TIMEOUT_MS_DEFAULT,
  getTravelGuideMapJsonSystem,
} from './travel-guide-llm-prompts';
import { resolveTravelGuideLocale } from './domain/travel-guide-locale';

type ActivityRecord = NonNullable<
  Awaited<ReturnType<ActivityService['findByLegacyId']>>
>;

@Injectable()
export class TravelGuideLlmPolishService {
  private readonly logger = new Logger(TravelGuideLlmPolishService.name);
  private readonly travelGuideReasoningEffort: HunyuanReasoningEffort;
  private readonly travelGuideLlmTimeoutMs: number;
  private readonly travelGuideLlmPolishEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly llmService: LlmService,
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

  async buildPayloadFromMap(
    activity: ActivityRecord,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    mapCtx: TravelGuideMapContext,
    ranked: TravelGuideRankedCandidates,
  ): Promise<LlmTravelGuidePayload> {
    const locale = resolveTravelGuideLocale(dto.locale);
    const mapPayload = mapCandidatesToLlmFallback(mapCtx, ranked, {
      departure: dto.departure.trim(),
      departureCity: dto.departureCity?.trim(),
      selfDrive: Boolean(dto.selfDrive),
      accommodationNights,
      headcount: dto.headcount,
      activity,
      locale,
    });

    if (
      !this.travelGuideLlmPolishEnabled ||
      !this.isValidMapSourcedPayload(
        mapPayload,
        Boolean(dto.selfDrive),
        accommodationNights,
        isTravelGuideAbroad(activity),
      )
    ) {
      if (
        !this.isValidMapSourcedPayload(
          mapPayload,
          Boolean(dto.selfDrive),
          accommodationNights,
          isTravelGuideAbroad(activity),
        )
      ) {
        throw new ServiceUnavailableException(
          locale === 'en'
            ? 'Travel guide generation failed. Please try again shortly.'
            : '攻略内容生成失败，请稍后重试',
        );
      }
      return accommodationNights > 0
        ? mapPayload
        : stripLlmAccommodationPayload(mapPayload);
    }

    const polished = await this.tryPolishWithAi(
      activity,
      dto,
      accommodationNights,
      mapCtx,
      ranked,
    );

    const polishedOrMap = polished ?? mapPayload;
    const merged = {
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
      ticketChannels: sanitizeTicketChannelsForActivity(
        polishedOrMap.ticketChannels?.length
          ? polishedOrMap.ticketChannels
          : mapPayload.ticketChannels,
        activity,
        locale,
      ),
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
          route: mapCtx.transitRoute ?? mapCtx.drivingRoute,
          transitDetailLines: mapCtx.transitDetail?.detailLines,
          transportHints: mapCtx.transportHints,
          departureCity: dto.departureCity?.trim(),
          activity,
          locale: resolveTravelGuideLocale(dto.locale),
        },
      ),
      budgetItems: polishedOrMap.budgetItems?.length
        ? polishedOrMap.budgetItems
        : mapPayload.budgetItems,
    };
    const payload =
      accommodationNights > 0 ? merged : stripLlmAccommodationPayload(merged);

    if (
      !this.isValidMapSourcedPayload(
        payload,
        Boolean(dto.selfDrive),
        accommodationNights,
        isTravelGuideAbroad(activity),
      )
    ) {
      throw new ServiceUnavailableException(
        locale === 'en'
          ? 'Travel guide generation failed. Please try again shortly.'
          : '攻略内容生成失败，请稍后重试',
      );
    }

    return payload;
  }

  private async tryPolishWithAi(
    activity: ActivityRecord,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    mapCtx: TravelGuideMapContext,
    ranked: TravelGuideRankedCandidates,
  ): Promise<LlmTravelGuidePayload | null> {
    if (!this.llmService.enabled) return null;

    const locale = resolveTravelGuideLocale(dto.locale);
    const budgetTier = resolveTravelGuideBudgetTier(dto.budgetTier);
    const hotelRanges = budgetTierHotelNightRanges(budgetTier);
    const routeSummary = dto.selfDrive
      ? mapCtx.drivingRoute
      : mapCtx.interCity
        ? (mapCtx.drivingRoute ?? mapCtx.transitRoute)
        : (mapCtx.transitRoute ?? mapCtx.drivingRoute);
    const payload: TravelGuideMapLlmInput = {
      activityName: activity.name,
      venueLabel: activity.location?.trim() || mapCtx.venue.title,
      venueReadableAddress: mapCtx.venueReadableAddress,
      venueSource: mapCtx.venueSource,
      eventDates:
        activity.date?.trim() ||
        (locale === 'en' ? 'See official schedule' : '详见官方日程'),
      departure: dto.departure.trim(),
      headcount: dto.headcount,
      budgetTier,
      budgetLabel: budgetTierLabel(budgetTier, locale),
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
            mode: dto.selfDrive
              ? 'driving'
              : mapCtx.transitRoute
                ? 'transit'
                : 'driving',
          }
        : undefined,
      candidates: ranked,
    };

    const user = JSON.stringify({
      locale,
      outputLanguage: locale === 'en' ? 'en' : 'zh',
      languageInstruction:
        locale === 'en'
          ? 'Respond in English only for all user-facing prose fields. Translate any Chinese candidate notes.'
          : '所有面向用户的文案字段使用简体中文。',
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
      userNote: dto.note?.trim() || null,
    });

    try {
      const systemPrompt = getTravelGuideMapJsonSystem(
        locale,
        accommodationNights,
      );
      const result = await this.llmService.invokeJson<LlmTravelGuidePayload>(
        systemPrompt,
        user,
        this.travelGuideLlmTimeoutMs,
        { reasoningEffort: this.travelGuideReasoningEffort },
      );
      const sanitized = sanitizeLlmTravelGuidePayload(result);
      if (
        !this.isValidMapSourcedPayload(
          sanitized,
          dto.selfDrive,
          accommodationNights,
          isTravelGuideAbroad(activity),
        )
      ) {
        return null;
      }
      if (!passesTravelGuideLocaleLanguage(sanitized, locale)) {
        this.logger.warn(
          `travel guide AI polish rejected: prose language mismatch locale=${locale}`,
        );
        return null;
      }
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
    accommodationNights = 1,
    abroad = false,
  ): result is LlmTravelGuidePayload {
    if (!result?.transportLines?.length) return false;
    if (accommodationNights > 0 && !abroad) {
      const hasHotels =
        (result.accommodationSchemes?.length ?? 0) >= 2 &&
        (result.hotels?.length ?? 0) >= 2;
      if (!hasHotels) return false;
    }
    // Align with POI pipeline: overseas curated catalogs may omit nightlife.
    if (!result.nightlifeSpots?.length && !abroad) return false;
    if (!result.ticketChannels?.length) return false;
    if (!result.budgetItems?.length) return false;
    if (!result.venueTransportOptions?.length) return false;
    if (selfDrive && !abroad && !result.parkingLines?.length) {
      return false;
    }
    return true;
  }
}
