import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { formatBudgetTierLabel } from '../travel-guide/domain/travel-guide-budget-tier-ranges.util';
import { resolveTravelGuideBudgetTier } from '../travel-guide/domain/parse-activity-days.util';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { TripPlanService } from './trip-plan.service';

export type TripPlanGuideSummaryDto = {
  hasTravelGuide: boolean;
  guideId?: string;
  departure?: string;
  headcount?: number;
  budgetTier?: string;
  budgetLabel?: string;
};

export type TripPlanSummaryDto = {
  tripPlanId: string;
  activityLegacyId: number;
  memberCount: number;
  guide: TripPlanGuideSummaryDto;
};

@Injectable()
export class TripPlanSummaryService {
  constructor(
    private readonly tripPlanService: TripPlanService,
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly savedPlanModel: Model<TravelGuideSavedPlanDocument>,
  ) {}

  async getSummary(
    tripPlanId: string,
    actor: RequestActor,
  ): Promise<TripPlanSummaryDto> {
    const tripPlan = await this.tripPlanService.getById(tripPlanId, actor);
    const guideId = tripPlan.guideId?.trim();

    if (!guideId) {
      return {
        tripPlanId,
        activityLegacyId: tripPlan.activityLegacyId,
        memberCount: tripPlan.memberIds.length,
        guide: { hasTravelGuide: false },
      };
    }

    const doc = await this.savedPlanModel.findOne({ guideId }).lean().exec();

    if (!doc) {
      return {
        tripPlanId,
        activityLegacyId: tripPlan.activityLegacyId,
        memberCount: tripPlan.memberIds.length,
        guide: { hasTravelGuide: false, guideId },
      };
    }

    const budgetTier = resolveTravelGuideBudgetTier(doc.form.budgetTier);
    const budgetLabel = formatBudgetTierLabel(
      budgetTier,
      doc.plan.budgetTierSnapshots,
    );

    return {
      tripPlanId,
      activityLegacyId: tripPlan.activityLegacyId,
      memberCount: tripPlan.memberIds.length,
      guide: {
        hasTravelGuide: true,
        guideId,
        departure: doc.form.departure,
        headcount: doc.form.headcount,
        budgetTier,
        budgetLabel,
      },
    };
  }
}
