import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import type { LlmTravelGuidePayload } from './travel-guide-llm.types';

/** 按用户「是否住宿」偏好裁剪攻略中的住宿区块与酒店预算项。 */
export function applyTravelGuideAccommodationPreference(
  plan: TravelGuidePlan,
  accommodationNights: number,
): TravelGuidePlan {
  if (accommodationNights > 0) {
    return { ...plan, accommodationNights };
  }

  const budgetItems = plan.budget?.items.filter(
    (item) => item.label !== '住宿',
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
    budgetItems: payload.budgetItems?.filter((item) => item.label !== '住宿'),
    tipItems: payload.tipItems?.map((tip) =>
      tip.replace(/住宿与/g, '').replace(/酒店与/g, ''),
    ),
  };
}
