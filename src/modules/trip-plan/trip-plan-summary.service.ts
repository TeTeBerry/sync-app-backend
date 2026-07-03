import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { formatBudgetTierLabel } from '../travel-guide/domain/travel-guide-budget-tier-ranges.util';
import { resolveTravelGuideBudgetTier } from '../travel-guide/domain/parse-activity-days.util';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import {
  TripPlan,
  TripPlanDocument,
} from '../../database/schemas/trip-plan.schema';
import {
  TripMemberOverlay,
  TripMemberOverlayDocument,
} from '../../database/schemas/trip-member-overlay.schema';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { TripPlanService } from './trip-plan.service';
import { TripPlanCollaborationService } from './trip-plan-collaboration.service';
import { ItineraryScheduleService } from '../itinerary/itinerary-schedule.service';
import { UserGoalService } from '../goal/goal.service';
import { UserGoalKind, UserGoalStatus } from '../goal/goal.model';
import {
  filterUserTravelPlanNodes,
  sumSplitEnabledNodePrices,
  sumTravelPlanNodePrices,
} from '@sync/travel-plan-contracts';

export type TripPlanTravelSummaryDto = {
  hasTravelPlan: boolean;
  totalSpent?: number;
  splitTotal?: number;
  perPerson?: number;
  nodeCount?: number;
};

export type TripPlanGuideSummaryDto = {
  hasTravelGuide: boolean;
  guideId?: string;
  departure?: string;
  headcount?: number;
  budgetTier?: string;
  budgetLabel?: string;
};

export type TripPlanItinerarySummaryDto = {
  hasItinerary: boolean;
  performanceCount?: number;
  mustSeeCount?: number;
  schedulePublished?: boolean;
  subscribed?: boolean;
};

export type TripPlanSummaryDto = {
  tripPlanId: string;
  activityLegacyId: number;
  memberCount: number;
  guide: TripPlanGuideSummaryDto;
  itinerary: TripPlanItinerarySummaryDto;
  travel: TripPlanTravelSummaryDto;
};

@Injectable()
export class TripPlanSummaryService {
  constructor(
    private readonly tripPlanService: TripPlanService,
    private readonly tripPlanCollaboration: TripPlanCollaborationService,
    @InjectModel(TripPlan.name)
    private readonly tripPlanModel: Model<TripPlanDocument>,
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly savedPlanModel: Model<TravelGuideSavedPlanDocument>,
    @InjectModel(TripMemberOverlay.name)
    private readonly overlayModel: Model<TripMemberOverlayDocument>,
    @Inject(forwardRef(() => ItineraryScheduleService))
    private readonly itineraryScheduleService: ItineraryScheduleService,
    private readonly userGoalService: UserGoalService,
  ) {}

  async getSummary(
    tripPlanId: string,
    actor: RequestActor,
  ): Promise<TripPlanSummaryDto> {
    const tripPlanDto = await this.tripPlanService.getById(tripPlanId, actor);
    const tripPlanDoc = await this.tripPlanModel.findById(tripPlanId).exec();
    const guide = await this.resolveGuideSummary(tripPlanDto.guideId);
    const itinerary = await this.resolveItinerarySummary(
      tripPlanId,
      tripPlanDoc!,
      actor,
      tripPlanDto.activityLegacyId,
    );
    const travel = await this.resolveTravelSummary(
      tripPlanDoc!,
      tripPlanDto.memberIds.length,
    );

    return {
      tripPlanId,
      activityLegacyId: tripPlanDto.activityLegacyId,
      memberCount: tripPlanDto.memberIds.length,
      guide,
      itinerary,
      travel,
    };
  }

  private async resolveGuideSummary(
    guideId?: string,
  ): Promise<TripPlanGuideSummaryDto> {
    const id = guideId?.trim();
    if (!id) {
      return { hasTravelGuide: false };
    }

    const doc = await this.savedPlanModel
      .findOne({ guideId: id })
      .lean()
      .exec();
    if (!doc) {
      return { hasTravelGuide: false, guideId: id };
    }

    const budgetTier = resolveTravelGuideBudgetTier(doc.form.budgetTier);
    const budgetLabel = formatBudgetTierLabel(
      budgetTier,
      doc.plan.budgetTierSnapshots,
    );

    return {
      hasTravelGuide: true,
      guideId: id,
      departure: doc.form.departure,
      headcount: doc.form.headcount,
      budgetTier,
      budgetLabel,
    };
  }

  private async resolveItinerarySummary(
    tripPlanId: string,
    tripPlanDoc: TripPlanDocument,
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<TripPlanItinerarySummaryDto> {
    const schedule = await this.itineraryScheduleService.getSchedule(
      activityLegacyId,
      {},
    );
    const schedulePublished = schedule.schedulePublished === true;

    const subscribed = await this.isSubscribed(actor, activityLegacyId);

    const shared =
      await this.tripPlanCollaboration.resolveSharedItineraryDoc(tripPlanDoc);
    if (!shared) {
      return {
        hasItinerary: false,
        schedulePublished,
        subscribed,
      };
    }

    const doc = shared.toObject();
    const performanceCount = (doc.days ?? []).reduce(
      (sum, day) => sum + (day.items?.length ?? 0),
      0,
    );
    const mustSeeCount = await this.countDistinctMustMarks(tripPlanId);

    return {
      hasItinerary: performanceCount > 0,
      performanceCount,
      mustSeeCount,
      schedulePublished,
      subscribed,
    };
  }

  private async isSubscribed(
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<boolean> {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) return false;
    const goals = await this.userGoalService.findByUser(
      userId,
      activityLegacyId,
    );
    return goals.some(
      (g) =>
        g.kind === UserGoalKind.WATCH_LINEUP &&
        g.status === UserGoalStatus.ACTIVE,
    );
  }

  private async countDistinctMustMarks(tripPlanId: string): Promise<number> {
    if (!tripPlanId) return 0;
    const docs = await this.overlayModel.find({ tripPlanId }).lean().exec();
    const mustIds = new Set<string>();
    for (const doc of docs) {
      for (const [performanceId, mark] of Object.entries(
        doc.itineraryMarks ?? {},
      )) {
        if (mark === 'must') {
          mustIds.add(performanceId);
        }
      }
    }
    return mustIds.size;
  }

  private async resolveTravelSummary(
    tripPlanDoc: TripPlanDocument,
    memberCount: number,
  ): Promise<TripPlanTravelSummaryDto> {
    const shared =
      await this.tripPlanCollaboration.resolveSharedTravelPlanDoc(tripPlanDoc);
    if (!shared) {
      return { hasTravelPlan: false };
    }

    const doc = shared.toObject();
    const userNodes = filterUserTravelPlanNodes(doc.nodes ?? []);
    const nodeCount = userNodes.length;
    if (nodeCount === 0) {
      return { hasTravelPlan: false, nodeCount: 0 };
    }

    const totalSpent = sumTravelPlanNodePrices(userNodes);
    const splitTotal = sumSplitEnabledNodePrices(userNodes);
    const perPerson =
      splitTotal > 0 && memberCount >= 2
        ? Math.round(splitTotal / memberCount)
        : undefined;

    return {
      hasTravelPlan: true,
      totalSpent,
      splitTotal: splitTotal > 0 ? splitTotal : undefined,
      perPerson,
      nodeCount,
    };
  }
}
