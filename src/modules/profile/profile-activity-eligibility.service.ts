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
  TripPlan,
  TripPlanDocument,
} from '../../database/schemas/trip-plan.schema';
import {
  hasMeaningfulItineraryData,
  hasMeaningfulTravelPlanData,
  mergeActivityLegacyIds,
} from './utils/profile-activity-eligibility.util';
import { TripPlanCollaborationService } from '../trip-plan/trip-plan-collaboration.service';

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
    @InjectModel(TripPlan.name)
    private readonly tripPlanModel: Model<TripPlanDocument>,
    private readonly tripPlanCollaboration: TripPlanCollaborationService,
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
    const [soloDocs, collabIds] = await Promise.all([
      this.itineraryModel
        .find({ userId })
        .select({ activityLegacyId: 1, days: 1 })
        .lean()
        .exec(),
      this.listCollabItineraryActivityIds(userId),
    ]);

    const ids = new Set<number>(collabIds);
    for (const doc of soloDocs) {
      if (hasMeaningfulItineraryData(doc.days)) {
        ids.add(doc.activityLegacyId);
      }
    }
    return [...ids];
  }

  private async listCollabItineraryActivityIds(
    userId: string,
  ): Promise<number[]> {
    const tripPlans = await this.tripPlanModel
      .find({ memberIds: userId })
      .lean()
      .exec();
    const ids: number[] = [];
    for (const tripPlan of tripPlans) {
      const doc = await this.tripPlanCollaboration.resolveSharedItineraryDoc(
        tripPlan as TripPlanDocument,
      );
      if (doc && hasMeaningfulItineraryData(doc.days)) {
        ids.push(tripPlan.activityLegacyId);
      }
    }
    return ids;
  }

  private async listTravelGuideActivityIds(userId: string): Promise<number[]> {
    const [savedPlans, completedJobs, collabIds] = await Promise.all([
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
      this.listCollabGuideActivityIds(userId),
    ]);

    const ids = new Set<number>(collabIds);
    for (const row of [...savedPlans, ...completedJobs]) {
      if (Number.isFinite(row.activityLegacyId)) {
        ids.add(row.activityLegacyId);
      }
    }
    return [...ids];
  }

  private async listCollabGuideActivityIds(userId: string): Promise<number[]> {
    const tripPlans = await this.tripPlanModel
      .find({ memberIds: userId, guideId: { $exists: true, $ne: null } })
      .select({ activityLegacyId: 1, guideId: 1 })
      .lean()
      .exec();

    const ids: number[] = [];
    for (const tripPlan of tripPlans) {
      if (!tripPlan.guideId) continue;
      const job = await this.travelGuideJobModel
        .findOne({ jobId: tripPlan.guideId, status: 'completed' })
        .select({ jobId: 1 })
        .lean()
        .exec();
      if (job) {
        ids.push(tripPlan.activityLegacyId);
      }
    }
    return ids;
  }

  private async listTravelPlanActivityIds(userId: string): Promise<number[]> {
    const [soloDocs, collabIds] = await Promise.all([
      this.travelPlanModel
        .find({ userId })
        .select({
          activityLegacyId: 1,
          nodes: 1,
          activityConfirmations: 1,
          activityPriceOverrides: 1,
          splitCount: 1,
        })
        .lean()
        .exec(),
      this.listCollabTravelPlanActivityIds(userId),
    ]);

    const ids = new Set<number>(collabIds);
    for (const doc of soloDocs) {
      if (hasMeaningfulTravelPlanData(doc)) {
        ids.add(doc.activityLegacyId);
      }
    }
    return [...ids];
  }

  private async listCollabTravelPlanActivityIds(
    userId: string,
  ): Promise<number[]> {
    const tripPlans = await this.tripPlanModel
      .find({ memberIds: userId })
      .lean()
      .exec();
    const ids: number[] = [];
    for (const tripPlan of tripPlans) {
      const doc = await this.tripPlanCollaboration.resolveSharedTravelPlanDoc(
        tripPlan as TripPlanDocument,
      );
      if (doc && hasMeaningfulTravelPlanData(doc)) {
        ids.push(tripPlan.activityLegacyId);
      }
    }
    return ids;
  }
}
