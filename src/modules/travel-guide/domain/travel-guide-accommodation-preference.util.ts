import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import type { LlmTravelGuidePayload } from './travel-guide-llm.types';
import { isAccommodationBudgetLabel } from './travel-guide-copy';

/** 按用户「是否住宿」偏好裁剪攻略中的住宿区块与酒店预算项。 */
export function applyTravelGuideAccommodationPreference(
  plan: TravelGuidePlan,
  accommodationNights: number,
): TravelGuidePlan {
  if (accommodationNights > 0) {
    return { ...plan, accommodationNights };
  }

  const budgetItems = plan.budget?.items.filter(
    (item) => !isAccommodationBudgetLabel(item.label),
  );

  return {
    ...plan,
    accommodationNights: 0,
    accommodation: {
      title: plan.accommodation.title,
      hotels: [],
    },
    ...(budgetItems
      ? {
          budget: {
            title: plan.budget!.title,
            items: budgetItems,
          },
        }
      : {}),
  };
}

export function stripLlmAccommodationPayload(
  payload: LlmTravelGuidePayload,
): LlmTravelGuidePayload {
  return {
    ...payload,
    hotels: [],
    accommodationSchemes: [],
    budgetItems: payload.budgetItems?.filter(
      (item) => !isAccommodationBudgetLabel(item.label),
    ),
    tipItems: payload.tipItems?.map((tip) =>
      tip
        .replace(/住宿与/g, '')
        .replace(/酒店与/g, '')
        .replace(/stay and /gi, '')
        .replace(/hotel and /gi, ''),
    ),
  };
}
