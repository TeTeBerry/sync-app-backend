import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobDocument,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  UserItinerary,
  UserItineraryDocument,
} from '../../database/schemas/user-itinerary.schema';
import type { TripPlanDocument } from '../../database/schemas/trip-plan.schema';
import type { FestivalPlanProgressDto } from '@sync/festival-plan-contracts';
import { TripPlanCollaborationService } from '../trip-plan/trip-plan-collaboration.service';

@Injectable()
export class FestivalPlanProgressService {
  constructor(
    @InjectModel(TravelGuideGenerationJob.name)
    private readonly travelGuideJobModel: Model<TravelGuideGenerationJobDocument>,
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
    private readonly tripPlanCollaboration: TripPlanCollaborationService,
  ) {}

  async getProgress(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<FestivalPlanProgressDto> {
    const userId = actor.resolvedUserId?.trim() ?? '';

    const tripPlan = userId
      ? await this.tripPlanCollaboration.resolveForActivity(
          actor,
          activityLegacyId,
        )
      : null;

    const [travelGuide, itinerary] = await Promise.all([
      this.resolveTravelGuideJob(activityLegacyId, actor, tripPlan),
      this.resolveItinerary(activityLegacyId, actor, tripPlan),
    ]);

    return {
      activityLegacyId,
      hasTravelGuide: Boolean(travelGuide),
      travelGuideId: travelGuide?.jobId,
      hasItinerary: Boolean(itinerary?.days?.length),
      itineraryDayCount: itinerary?.days?.length ?? 0,
      itinerarySelectedDjIds: undefined,
      hasTripPlan: Boolean(tripPlan),
    };
  }

  private async resolveTravelGuideJob(
    activityLegacyId: number,
    actor: RequestActor,
    tripPlan: TripPlanDocument | null,
  ) {
    if (tripPlan?.guideId) {
      const byGuide = await this.travelGuideJobModel
        .findOne({ jobId: tripPlan.guideId, status: 'completed' })
        .select('jobId')
        .lean()
        .exec();
      if (byGuide) return byGuide;
    }

    const userId = actor.resolvedUserId?.trim();
    if (!userId) return null;

    return this.travelGuideJobModel
      .findOne({
        ownerUserId: userId,
        activityLegacyId,
        status: 'completed',
      })
      .select('jobId')
      .lean()
      .exec();
  }

  private async resolveItinerary(
    activityLegacyId: number,
    actor: RequestActor,
    tripPlan: TripPlanDocument | null,
  ) {
    if (tripPlan) {
      const shared =
        await this.tripPlanCollaboration.resolveSharedItineraryDoc(tripPlan);
      if (shared) {
        return shared.toObject();
      }
    }

    const userId = actor.resolvedUserId?.trim();
    if (!userId) return null;

    return this.itineraryModel
      .findOne({ userId, activityLegacyId })
      .select('days activityLegacyId')
      .lean()
      .exec();
  }
}
