import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import type { TravelGuideMapContext } from '../map/travel-guide-map.types';
import type { TravelGuideRankedCandidates } from '../map/travel-guide-map.types';
import type { TravelQuoteEnrichment } from '../ports/travel-quote.types';
import type { NormalizedFlightOption } from './normalized-flight-option';
import type { NormalizedHotelOption } from './normalized-hotel-option';
import type { NormalizedTicketOption } from './normalized-ticket-option';
import type {
  FlightRecommendationSet,
  HotelRecommendationSet,
} from '../recommendation/recommendation.types';
import type { TravelGuideBudgetBreakdown } from '../budget/travel-guide-budget.service';
import type { TravelGuideBudgetConstraints } from '../budget/budget-constraints.types';
import type { LlmTravelGuidePayload } from '../domain/travel-guide-llm.types';
import type { FestivalStayGuide } from '@sync/travel-guide-contracts';

export type PlanSectionStatus =
  | 'pending'
  | 'ready'
  | 'failed'
  | 'unavailable'
  | 'skipped';

export type PlanGenerationStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'partial'
  | 'failed';

export interface PlanSectionStatuses {
  flights: PlanSectionStatus;
  hotels: PlanSectionStatus;
  tickets: PlanSectionStatus;
  pois: PlanSectionStatus;
  itinerary: PlanSectionStatus;
  budget: PlanSectionStatus;
}

export interface PlanSelectedOptions {
  flight?: NormalizedFlightOption;
  hotel?: NormalizedHotelOption;
  ticket?: NormalizedTicketOption;
}

export interface PlanSearchResults {
  flights: NormalizedFlightOption[];
  hotels: NormalizedHotelOption[];
  tickets: NormalizedTicketOption[];
}

export interface PlanRecommendations {
  flights: FlightRecommendationSet;
  hotels: HotelRecommendationSet;
}

export interface PlanGenerationContext {
  request: {
    dto: GenerateTravelGuideDto;
    actor: RequestActor;
    accommodationNights: number;
    cacheKey: string;
  };
  festival: Activity;
  locations?: {
    mapCtx: TravelGuideMapContext;
    ranked: TravelGuideRankedCandidates;
  };
  stayGuide?: FestivalStayGuide;
  searchResults: PlanSearchResults;
  /** Estimated tier policy — computed before recommendation. */
  budgetConstraints?: TravelGuideBudgetConstraints;
  recommendations: PlanRecommendations;
  selectedOptions: PlanSelectedOptions;
  /** Final budget summary from selected options. */
  budget?: TravelGuideBudgetBreakdown;
  generatedContent?: LlmTravelGuidePayload;
  sectionStatus: PlanSectionStatuses;
  generationStatus: PlanGenerationStatus;

  /** Quote snapshot used only for tier metadata on the assembled plan. */
  quoteEnrichment?: TravelQuoteEnrichment | null;

  plan?: TravelGuidePlan;
  guideId?: string;
  errors: Array<{
    section: keyof PlanSectionStatuses;
    code: string;
    message: string;
  }>;
}

export function createEmptySectionStatuses(): PlanSectionStatuses {
  return {
    flights: 'pending',
    hotels: 'pending',
    tickets: 'pending',
    pois: 'pending',
    itinerary: 'pending',
    budget: 'pending',
  };
}

export function createInitialPlanGenerationContext(input: {
  activity: Activity;
  dto: GenerateTravelGuideDto;
  actor: RequestActor;
  accommodationNights: number;
  cacheKey: string;
}): PlanGenerationContext {
  return {
    request: {
      dto: input.dto,
      actor: input.actor,
      accommodationNights: input.accommodationNights,
      cacheKey: input.cacheKey,
    },
    festival: input.activity,
    searchResults: { flights: [], hotels: [], tickets: [] },
    recommendations: {
      flights: { ranked: [] },
      hotels: { ranked: [] },
    },
    selectedOptions: {},
    sectionStatus: createEmptySectionStatuses(),
    generationStatus: 'generating',
    errors: [],
  };
}

export function resolveGenerationStatus(
  sections: PlanSectionStatuses,
): PlanGenerationStatus {
  const values = Object.values(sections);
  const anyReady = values.some((s) => s === 'ready');
  const anyFailed = values.some((s) => s === 'failed');
  if (anyReady && anyFailed) return 'partial';
  if (anyFailed && !anyReady) return 'failed';
  if (
    values.every((s) => s === 'ready' || s === 'skipped' || s === 'unavailable')
  ) {
    return 'ready';
  }
  return 'generating';
}
