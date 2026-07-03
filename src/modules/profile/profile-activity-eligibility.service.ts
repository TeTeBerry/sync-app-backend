import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  UserGoalKind,
  UserGoalStatus,
  type UserGoalDocument,
} from '../goal/goal.model';
import {
  ActivitySetVote,
  ActivitySetVoteDocument,
} from '../../database/schemas/activity-set-vote.schema';
import {
  UserItinerary,
  UserItineraryDocument,
} from '../../database/schemas/user-itinerary.schema';
import {
  UserTravelPlan,
  UserTravelPlanDocument,
} from '../../database/schemas/user-travel-plan.schema';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobDocument,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  hasMeaningfulItineraryData,
  hasMeaningfulTravelPlanData,
  mergeActivityLegacyIds,
} from './utils/profile-activity-eligibility.util';

const HIDDEN_PROFILE_ACTIVITY_LEGACY_ID = 3;

@Injectable()
export class ProfileActivityEligibilityService {
  constructor(
    @InjectModel('UserGoal')
    private readonly goalModel: Model<UserGoalDocument>,
    @InjectModel(ActivitySetVote.name)
    private readonly setVoteModel: Model<ActivitySetVoteDocument>,
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
    @InjectModel(UserTravelPlan.name)
    private readonly travelPlanModel: Model<UserTravelPlanDocument>,
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly travelGuidePlanModel: Model<TravelGuideSavedPlanDocument>,
    @InjectModel(TravelGuideGenerationJob.name)
    private readonly travelGuideJobModel: Model<TravelGuideGenerationJobDocument>,
  ) {}

  async listEligibleActivityLegacyIds(actor: RequestActor): Promise<number[]> {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) {
      return [];
    }

    const [
      subscribedIds,
      setVoteIds,
      itineraryIds,
      travelGuideIds,
      travelPlanIds,
    ] = await Promise.all([
      this.listSubscribedActivityIds(userId),
      this.listSetVoteActivityIds(userId),
      this.listItineraryActivityIds(userId),
      this.listTravelGuideActivityIds(userId),
      this.listTravelPlanActivityIds(userId),
    ]);

    return mergeActivityLegacyIds(
      subscribedIds,
      setVoteIds,
      itineraryIds,
      [],
      travelGuideIds,
      travelPlanIds,
    ).filter((id) => id !== HIDDEN_PROFILE_ACTIVITY_LEGACY_ID);
  }

  private async listSubscribedActivityIds(userId: string): Promise<number[]> {
    const goals = await this.goalModel
      .find({
        userId,
        kind: UserGoalKind.WATCH_LINEUP,
        status: UserGoalStatus.ACTIVE,
      })
      .select({ activityLegacyId: 1 })
      .lean()
      .exec();

    return goals.map((goal) => goal.activityLegacyId);
  }

  private async listSetVoteActivityIds(userId: string): Promise<number[]> {
    const ballots = await this.setVoteModel
      .find({ userId, picks: { $exists: true, $ne: [] } })
      .select({ activityLegacyId: 1 })
      .lean()
      .exec();

    return ballots.map((ballot) => ballot.activityLegacyId);
  }

  private async listItineraryActivityIds(userId: string): Promise<number[]> {
    const docs = await this.itineraryModel
      .find({ userId })
      .select({ activityLegacyId: 1, days: 1 })
      .lean()
      .exec();

    return docs
      .filter((doc) => hasMeaningfulItineraryData(doc.days))
      .map((doc) => doc.activityLegacyId);
  }

  private async listTravelGuideActivityIds(userId: string): Promise<number[]> {
    const [savedPlans, completedJobs] = await Promise.all([
      this.travelGuidePlanModel
        .find({ ownerUserId: userId })
        .select({ activityLegacyId: 1 })
        .lean()
        .exec(),
      this.travelGuideJobModel
        .find({ ownerUserId: userId, status: 'completed' })
        .select({ activityLegacyId: 1 })
        .lean()
        .exec(),
    ]);

    const ids = new Set<number>();
    for (const row of [...savedPlans, ...completedJobs]) {
      if (Number.isFinite(row.activityLegacyId)) {
        ids.add(row.activityLegacyId);
      }
    }
    return [...ids];
  }

  private async listTravelPlanActivityIds(userId: string): Promise<number[]> {
    const docs = await this.travelPlanModel
      .find({ userId })
      .select({
        activityLegacyId: 1,
        nodes: 1,
        activityConfirmations: 1,
        activityPriceOverrides: 1,
        splitCount: 1,
      })
      .lean()
      .exec();

    return docs
      .filter((doc) => hasMeaningfulTravelPlanData(doc))
      .map((doc) => doc.activityLegacyId);
  }
}
