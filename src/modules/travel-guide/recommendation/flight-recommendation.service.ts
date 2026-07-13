import { Injectable } from '@nestjs/common';
import type { NormalizedFlightOption } from '../types/normalized-flight-option';
import type { TravelGuideBudgetConstraints } from '../budget/budget-constraints.types';
import {
  dominantCurrency,
  isViableBudgetFit,
  scoreBudgetFit,
} from '../budget/budget-constraints.types';
import type {
  FlightReasonCode,
  FlightRecommendationCategory,
  FlightRecommendationSet,
  RecommendationResult,
} from './recommendation.types';
import {
  FLIGHT_BUDGET_FIT_BLEND,
  FLIGHT_SCORE_WEIGHTS,
} from './recommendation.types';

/**
 * Flight Score =
 *   (relative price/duration/stops/arrival/reliability) blended with
 *   user budget-fit (separate from relative price competitiveness).
 *
 * Categories: Best overall / Lowest price / Fastest route
 */
@Injectable()
export class FlightRecommendationService {
  recommend(
    flights: NormalizedFlightOption[],
    constraints?: TravelGuideBudgetConstraints | null,
  ): FlightRecommendationSet {
    if (!flights.length) {
      return { ranked: [] };
    }

    const currency =
      constraints?.currency ??
      dominantCurrency(flights.map((f) => f.price.currency)) ??
      'CNY';

    const comparable = flights.filter((f) => f.price.currency === currency);
    const pool = comparable.length ? comparable : flights;
    const crossCurrency =
      comparable.length > 0 && comparable.length < flights.length;

    const scored = pool.map((flight) =>
      scoreFlight(flight, pool, constraints, crossCurrency),
    );
    scored.sort((a, b) => b.score - a.score);

    const cheapest = [...scored].sort(
      (a, b) =>
        a.flight.price.amount - b.flight.price.amount || b.score - a.score,
    )[0];
    const fastest = [...scored].sort((a, b) => {
      const aDur = a.flight.durationMinutes || Number.MAX_SAFE_INTEGER;
      const bDur = b.flight.durationMinutes || Number.MAX_SAFE_INTEGER;
      return aDur - bDur || b.score - a.score;
    })[0];

    const viable = scored.filter((s) => isViableBudgetFit(s.budgetBand));
    const bestPool = viable.length ? viable : scored;
    const bestOverall = bestPool[0]!;

    const cheapestResult = cheapest
      ? toResult(
          {
            ...cheapest,
            reasonCodes: uniqueReasons([
              ...cheapest.reasonCodes,
              'LOWEST_PRICE',
            ]),
          },
          'cheapest',
        )
      : undefined;
    const fastestResult = fastest
      ? toResult(
          {
            ...fastest,
            reasonCodes: uniqueReasons([
              ...fastest.reasonCodes,
              'SHORTEST_DURATION',
            ]),
          },
          'fastest',
        )
      : undefined;
    const bestOverallResult = toResult(bestOverall, 'bestOverall');

    return {
      bestOverall: bestOverallResult,
      cheapest: cheapestResult,
      fastest: fastestResult,
      ranked: dedupeCategoryResults([
        bestOverallResult,
        cheapestResult,
        fastestResult,
      ]),
    };
  }
}

function scoreFlight(
  flight: NormalizedFlightOption,
  all: NormalizedFlightOption[],
  constraints: TravelGuideBudgetConstraints | null | undefined,
  crossCurrency: boolean,
): {
  flight: NormalizedFlightOption;
  score: number;
  budgetBand: ReturnType<typeof scoreBudgetFit>['band'];
  reasonCodes: FlightReasonCode[];
} {
  const prices = all.map((f) => f.price.amount).filter((p) => p > 0);
  const durations = all.map((f) => f.durationMinutes).filter((d) => d > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const minDuration = durations.length ? Math.min(...durations) : 0;
  const maxDuration = durations.length ? Math.max(...durations) : 0;

  const priceNorm =
    maxPrice > minPrice && flight.price.amount > 0
      ? 1 - (flight.price.amount - minPrice) / (maxPrice - minPrice)
      : flight.price.amount > 0
        ? 1
        : 0.4;

  const durationNorm =
    maxDuration > minDuration && flight.durationMinutes > 0
      ? 1 - (flight.durationMinutes - minDuration) / (maxDuration - minDuration)
      : flight.durationMinutes > 0
        ? 1
        : 0.5;

  const stopsNorm = flight.stops <= 0 ? 1 : flight.stops === 1 ? 0.65 : 0.3;

  const { fit: budgetFit, band: budgetBand } = scoreBudgetFit(
    flight.price.amount,
    constraints?.flightTarget,
  );

  const reasonCodes: FlightReasonCode[] = [];
  if (flight.stops <= 0) reasonCodes.push('DIRECT_FLIGHT');
  else if (flight.stops === 1) reasonCodes.push('FEW_STOPS');
  else reasonCodes.push('MULTIPLE_STOPS');
  if (priceNorm >= 0.55) reasonCodes.push('PRICE_WITHIN_BALANCED_RANGE');
  if (flight.price.amount === minPrice && minPrice > 0) {
    reasonCodes.push('LOWEST_PRICE');
  }
  if (flight.durationMinutes > 0 && flight.durationMinutes === minDuration) {
    reasonCodes.push('SHORTEST_DURATION');
  }
  if (
    maxDuration > minDuration &&
    flight.durationMinutes >= minDuration + (maxDuration - minDuration) * 0.75
  ) {
    reasonCodes.push('LONG_DURATION');
  }
  if (arrivalTimeScore(flight.arrivalAt) >= 0.75)
    reasonCodes.push('GOOD_ARRIVAL_TIME');
  const depHour = extractHour(flight.departureAt);
  if (depHour != null && depHour >= 7 && depHour <= 21) {
    reasonCodes.push('GOOD_DEPARTURE_TIME');
  }
  if (resolveSupplierReliability(flight) >= 0.8)
    reasonCodes.push('RELIABLE_SUPPLIER');
  if (budgetBand === 'within') reasonCodes.push('WITHIN_FLIGHT_BUDGET');
  else if (budgetBand === 'slightly_over') {
    reasonCodes.push('SLIGHTLY_OVER_FLIGHT_BUDGET');
  } else if (
    budgetBand === 'materially_over' ||
    budgetBand === 'extreme_over'
  ) {
    reasonCodes.push('OVER_FLIGHT_BUDGET');
  }
  if (crossCurrency) reasonCodes.push('CURRENCY_MISMATCH');

  const quality =
    FLIGHT_SCORE_WEIGHTS.price * priceNorm +
    FLIGHT_SCORE_WEIGHTS.duration * durationNorm +
    FLIGHT_SCORE_WEIGHTS.stops * stopsNorm;

  const score =
    (1 - FLIGHT_BUDGET_FIT_BLEND) * quality +
    FLIGHT_BUDGET_FIT_BLEND * budgetFit;

  return {
    flight,
    score: roundScore(score),
    budgetBand,
    reasonCodes,
  };
}

function arrivalTimeScore(iso: string): number {
  const hour = extractHour(iso);
  if (hour == null) return 0.5;
  if (hour >= 9 && hour <= 20) return 1;
  if (hour >= 8 && hour <= 22) return 0.85;
  if (hour >= 6 && hour < 8) return 0.55;
  if (hour > 22 && hour <= 23) return 0.4;
  return 0.2;
}

function resolveSupplierReliability(flight: NormalizedFlightOption): number {
  if (
    typeof flight.supplierReliability === 'number' &&
    Number.isFinite(flight.supplierReliability)
  ) {
    return clamp(flight.supplierReliability);
  }
  const provider = flight.provider.toLowerCase();
  if (provider === 'rollinggo') return 0.85;
  if (provider === 'amap') return 0.75;
  return 0.55;
}

function extractHour(iso: string): number | null {
  const match = iso.match(/T(\d{2})/);
  if (!match) return null;
  return Number(match[1]);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function uniqueReasons(codes: FlightReasonCode[]): FlightReasonCode[] {
  return [...new Set(codes)];
}

function toResult(
  item: {
    flight: NormalizedFlightOption;
    score: number;
    reasonCodes: FlightReasonCode[];
  },
  category: FlightRecommendationCategory,
): RecommendationResult<FlightRecommendationCategory, FlightReasonCode> {
  return {
    optionId: item.flight.id,
    category,
    score: item.score,
    reasonCodes: item.reasonCodes,
  };
}

function dedupeCategoryResults(
  results: Array<
    | RecommendationResult<FlightRecommendationCategory, FlightReasonCode>
    | undefined
  >,
): Array<RecommendationResult<FlightRecommendationCategory, FlightReasonCode>> {
  const seen = new Set<string>();
  const out: Array<
    RecommendationResult<FlightRecommendationCategory, FlightReasonCode>
  > = [];
  for (const row of results) {
    if (!row || seen.has(row.optionId)) continue;
    seen.add(row.optionId);
    out.push(row);
  }
  return out;
}
