import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import { resolveTravelGuideBudgetTier } from './parse-activity-days.util';
import { buildTravelGuidePlan } from './travel-guide-fallback.builder';
import { attachQuoteTierMetadataToPlan } from './attach-quote-tier-metadata.util';
import { applyFlightTierQuoteToPlan } from './travel-guide-flight-tier.util';
import { applyTravelGuideAccommodationPreference } from './travel-guide-accommodation-preference.util';
import { travelGuideRegionKind } from './travel-guide-international.util';
import {
  buildFlightOffersFromRecommendations,
  buildFlightSampleLine,
  buildHotelItemsFromRecommendations,
  buildHotelSchemesFromRecommendations,
  normalizedFlightToOffer,
} from './map-selected-options-to-plan.util';
import type { PlanGenerationContext } from '../types/plan-generation-context';
import type { LlmTravelGuidePayload } from './travel-guide-llm.types';
import { getTravelGuideCopy } from './travel-guide-copy';
import { resolveTravelGuideLocale } from './travel-guide-locale';

/**
 * Deterministic plan assembler from PlanGenerationContext.
 * Source of truth: selectedOptions + recommendations + budget + generatedContent.
 * Does not call providers, rank, calculate budget, invoke LLM, or persist.
 */
export function assembleTravelGuidePlanFromContext(
  ctx: PlanGenerationContext,
): TravelGuidePlan {
  const dto = ctx.request.dto;
  const activity = ctx.festival;
  const accommodationNights = ctx.request.accommodationNights;
  const budgetTier = resolveTravelGuideBudgetTier(dto.budgetTier);
  const locale = resolveTravelGuideLocale(dto.locale);
  const section = getTravelGuideCopy(locale).section;
  const interCity = Boolean(
    ctx.locations?.mapCtx.interCity ||
    shouldTreatAsInterCity(ctx.quoteEnrichment),
  );

  const generated = applyAuthoritativeOverlaysToLlm(ctx);
  let plan = buildTravelGuidePlan({
    activity,
    departure: dto.departure.trim(),
    headcount: dto.headcount,
    budgetTier,
    accommodationNights,
    selfDrive: dto.selfDrive,
    note: dto.note,
    llm: generated,
    mapSourcedOnly: true,
    interCity,
    skipIndependentBudget: true,
    locale,
  });

  plan = {
    ...plan,
    recommendedDepartureDate: dto.departureDate,
    recommendedReturnDate: dto.returnDate,
    ...(ctx.stayGuide ? { stayGuide: ctx.stayGuide } : {}),
  };

  if (ctx.budget?.items?.length) {
    plan.budget = {
      title: section.budget,
      items: ctx.budget.items,
    };
  }

  if (ctx.selectedOptions.flight) {
    const reasonCodes =
      ctx.recommendations.flights.bestOverall?.reasonCodes ?? [];
    const sample = buildFlightSampleLine(
      ctx.selectedOptions.flight,
      reasonCodes,
      'bestOverall',
      locale,
    );
    const lines = plan.transport.lines.filter((line) => line !== sample);
    const flightOffers = buildFlightOffersFromRecommendations({
      flights: ctx.searchResults.flights,
      flightRecommendations: ctx.recommendations.flights,
      selectedFlightId: ctx.selectedOptions.flight.id,
      locale,
    });
    plan.transport = {
      ...plan.transport,
      lines: [sample, ...lines],
      flightOffers:
        flightOffers.length > 0
          ? flightOffers
          : [
              normalizedFlightToOffer(
                ctx.selectedOptions.flight,
                'bestOverall',
                locale,
                ctx.recommendations.flights.bestOverall?.reasonCodes,
              ),
            ],
    };
  }

  if (ctx.selectedOptions.hotel && accommodationNights > 0) {
    const hotels = buildHotelItemsFromRecommendations({
      hotels: ctx.searchResults.hotels,
      hotelRecommendations: ctx.recommendations.hotels,
      selectedHotelId: ctx.selectedOptions.hotel.id,
      nights: accommodationNights,
      headcount: dto.headcount,
      locale,
    });
    if (hotels.length) {
      plan.accommodation = {
        title: plan.accommodation.title || section.accommodation,
        hotels,
        schemes: buildHotelSchemesFromRecommendations({
          hotels: ctx.searchResults.hotels,
          hotelRecommendations: ctx.recommendations.hotels,
          selectedHotelId: ctx.selectedOptions.hotel.id,
          nights: accommodationNights,
          headcount: dto.headcount,
          locale,
        }),
      };
    }
  }

  if (ctx.selectedOptions.ticket) {
    const ticket = ctx.selectedOptions.ticket;
    plan.tickets = {
      title: plan.tickets?.title ?? '门票渠道',
      channels: [
        {
          name: ticket.ticketName,
          note:
            ticket.note ??
            (ticket.price
              ? `参考价 ${ticket.price.currency === 'USD' ? '$' : '¥'}${ticket.price.amount}`
              : ticket.availability),
        },
        ...(plan.tickets?.channels ?? []).filter(
          (c) => c.name !== ticket.ticketName,
        ),
      ].slice(0, 4),
    };
  }

  // RollingGo quote: tier metadata only — never overrides selections/budget.
  plan = attachQuoteTierMetadataToPlan(plan, ctx.quoteEnrichment, {
    headcount: dto.headcount,
    accommodationNights,
    budgetTier,
    locale,
  });

  // Raven's final journey should surface the selected tier's real fare, not
  // merely retain it as hidden metadata for a later budget change.
  plan = applyFlightTierQuoteToPlan(plan, budgetTier, {
    headcount: dto.headcount,
    regionKind: travelGuideRegionKind(activity),
    interCity,
  });

  return applyTravelGuideAccommodationPreference(plan, accommodationNights);
}

function applyAuthoritativeOverlaysToLlm(
  ctx: PlanGenerationContext,
): LlmTravelGuidePayload {
  const generated = ctx.generatedContent;
  if (!generated) {
    throw new Error(
      'assembleTravelGuidePlanFromContext requires generatedContent',
    );
  }

  const dto = ctx.request.dto;
  const nights = ctx.request.accommodationNights;
  const hotels =
    nights > 0 && ctx.selectedOptions.hotel
      ? buildHotelItemsFromRecommendations({
          hotels: ctx.searchResults.hotels,
          hotelRecommendations: ctx.recommendations.hotels,
          selectedHotelId: ctx.selectedOptions.hotel.id,
          nights,
          headcount: dto.headcount,
          locale: resolveTravelGuideLocale(dto.locale),
        })
      : generated.hotels;

  return {
    ...generated,
    hotels,
    budgetItems: ctx.budget?.items ?? generated.budgetItems,
  };
}

function shouldTreatAsInterCity(
  enrichment: PlanGenerationContext['quoteEnrichment'],
): boolean {
  return Boolean(enrichment?.flight || enrichment?.flightByTier);
}
