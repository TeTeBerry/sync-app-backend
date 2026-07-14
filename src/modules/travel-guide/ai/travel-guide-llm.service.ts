import { Injectable } from '@nestjs/common';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import type { LlmTravelGuidePayload } from '../domain/travel-guide-llm.types';
import type {
  TravelGuideMapContext,
  TravelGuideRankedCandidates,
} from '../map/travel-guide-map.types';
import { TravelGuideLlmPolishService } from '../travel-guide-llm-polish.service';
import type { PlanGenerationContext } from '../types/plan-generation-context';
import {
  buildFlightSampleLine,
  buildHotelItemsFromRecommendations,
  formatFlightReasonCodes,
  formatHotelReasonCodes,
} from '../domain/map-selected-options-to-plan.util';
import { resolveTravelGuideLocale } from '../domain/travel-guide-locale';
import type { FestivalStayGuide } from '@sync/travel-guide-contracts';

export type TravelGuideLlmGenerationInput = {
  activity: Activity;
  dto: GenerateTravelGuideDto;
  accommodationNights: number;
  mapCtx: TravelGuideMapContext;
  ranked: TravelGuideRankedCandidates;
  /** Structured recommendation context — never raw RollingGo payloads. */
  recommendations?: PlanGenerationContext['recommendations'];
  selectedOptions?: PlanGenerationContext['selectedOptions'];
  budget?: PlanGenerationContext['budget'];
  budgetConstraints?: PlanGenerationContext['budgetConstraints'];
  tickets?: PlanGenerationContext['searchResults']['tickets'];
  stayGuide?: FestivalStayGuide;
};

/**
 * Focused LLM facade. Numeric prices/distances/ranking stay outside this service.
 * Explains existing recommendations; does not independently rank or select.
 */
@Injectable()
export class TravelGuideLlmService {
  constructor(private readonly polish: TravelGuideLlmPolishService) {}

  /**
   * Generate structured plan prose from verified map candidates + recommendations.
   */
  async generatePlanContent(
    input: TravelGuideLlmGenerationInput,
  ): Promise<LlmTravelGuidePayload> {
    const payload = await this.polish.buildPayloadFromMap(
      input.activity,
      input.dto,
      input.accommodationNights,
      input.mapCtx,
      input.ranked,
    );

    return overlayRecommendationContext(payload, input);
  }
}

function overlayRecommendationContext(
  payload: LlmTravelGuidePayload,
  input: TravelGuideLlmGenerationInput,
): LlmTravelGuidePayload {
  const tips = [...(payload.tipItems ?? [])];
  const selectedFlight = input.selectedOptions?.flight;
  const selectedHotel = input.selectedOptions?.hotel;
  const flightReasons =
    input.recommendations?.flights.bestOverall?.reasonCodes ?? [];
  const hotelReasons =
    input.recommendations?.hotels.bestOverall?.reasonCodes ?? [];
  const locale = resolveTravelGuideLocale(input.dto.locale);
  const en = locale === 'en';
  const primaryArea = input.stayGuide?.recommendedAreas[0];

  if (primaryArea) {
    tips.unshift(
      en
        ? `Stay area: ${primaryArea.area} — ${primaryArea.reason}`
        : `推荐住宿区域：${primaryArea.area}。${primaryArea.reason}`,
    );
  }

  if (selectedFlight) {
    const line = buildFlightSampleLine(
      selectedFlight,
      flightReasons,
      undefined,
      locale,
    );
    const transportLines = [
      line,
      ...payload.transportLines.filter((l) => l !== line),
    ];
    payload = { ...payload, transportLines };
    tips.unshift(
      en
        ? `Recommended flight: ${selectedFlight.originAirportCode}→${selectedFlight.destinationAirportCode}` +
            (flightReasons.length
              ? ` (${formatFlightReasonCodes(flightReasons, locale)})`
              : '') +
            '. Explain this pick only — do not re-rank.'
        : `推荐航班：${selectedFlight.originAirportCode}→${selectedFlight.destinationAirportCode}` +
            (flightReasons.length
              ? `（${formatFlightReasonCodes(flightReasons, locale)}）`
              : '') +
            '。以下文案仅解释该推荐，不重新排序。',
    );
  }

  // Festival Stay Intelligence is the stay recommendation. Optional inventory
  // must not compete with it in the user-facing plan copy.
  if (selectedHotel && input.accommodationNights > 0 && !input.stayGuide) {
    const hotels = buildHotelItemsFromRecommendations({
      hotels: selectedHotel ? [selectedHotel] : [],
      hotelRecommendations: input.recommendations?.hotels ?? { ranked: [] },
      selectedHotelId: selectedHotel.id,
      nights: input.accommodationNights,
      headcount: input.dto.headcount,
      locale,
    });
    if (hotels.length) {
      const rest = (payload.hotels ?? []).filter(
        (h) => h.name !== selectedHotel.name,
      );
      payload = {
        ...payload,
        hotels: [
          {
            ...hotels[0]!,
            reason: hotelReasons.length
              ? formatHotelReasonCodes(hotelReasons, locale)
              : hotels[0]!.reason,
          },
          ...rest,
        ],
      };
    }
    tips.unshift(
      en
        ? `Recommended stay: ${selectedHotel.name}` +
            (hotelReasons.length
              ? ` (${formatHotelReasonCodes(hotelReasons, locale)})`
              : '')
        : `推荐住宿：${selectedHotel.name}` +
            (hotelReasons.length
              ? `（${formatHotelReasonCodes(hotelReasons, locale)}）`
              : ''),
    );
  }

  if (input.budget?.items?.length) {
    payload = {
      ...payload,
      budgetItems: input.budget.items,
    };
    const total = input.budget.total;
    const currency = input.budget.currency === 'USD' ? '$' : '¥';
    tips.push(
      en
        ? `Budget already calculated from selected options (about ${currency}${total.min}–${total.max} total). Do not rewrite amounts.`
        : `预算已按推荐选项核算（合计约 ${currency}${total.min}–${total.max}），请勿改写金额。`,
    );
  }

  if (input.budgetConstraints) {
    tips.push(
      en
        ? `User budget tier: ${input.budgetConstraints.tierAlias} (estimate constraint, not a live quote). Explain fit — do not change flight/hotel IDs.`
        : `用户预算档：${input.budgetConstraints.tierAlias}（估算约束，非实时报价）。请解释推荐如何贴合该档，勿改选航班/酒店 ID。`,
    );
  }

  if (input.tickets?.length) {
    const channels = input.tickets.slice(0, 4).map((ticket) => ({
      name: ticket.ticketName,
      note:
        ticket.note ??
        (ticket.price
          ? en
            ? `Reference ${ticket.price.currency === 'USD' ? '$' : '¥'}${ticket.price.amount}`
            : `参考价 ${ticket.price.currency === 'USD' ? '$' : '¥'}${ticket.price.amount}`
          : ticket.availability),
    }));
    payload = {
      ...payload,
      ticketChannels: channels,
    };
  }

  const altFlights =
    input.recommendations?.flights.ranked
      .filter(
        (r) =>
          r.optionId !== input.recommendations?.flights.bestOverall?.optionId,
      )
      .slice(0, 2) ?? [];
  if (altFlights.length) {
    tips.push(
      en
        ? `Alternate flight angles: ${altFlights.map((a) => a.category).join(' / ')} (explanation only — do not reselect).`
        : `备选航班维度：${altFlights.map((a) => a.category).join(' / ')}（仅供说明，勿改选）。`,
    );
  }

  return {
    ...payload,
    tipItems: tips,
  };
}
