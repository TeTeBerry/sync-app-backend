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
import type { FestivalPlanProgressDto } from '@sync/festival-plan-contracts';

@Injectable()
export class FestivalPlanProgressService {
  constructor(
    @InjectModel(TravelGuideGenerationJob.name)
    private readonly travelGuideJobModel: Model<TravelGuideGenerationJobDocument>,
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
  ) {}

  async getProgress(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<FestivalPlanProgressDto> {
    const userId = actor.resolvedUserId?.trim() ?? '';

    const [travelGuide, itinerary] = await Promise.all([
      userId
        ? this.travelGuideJobModel
            .findOne({
              ownerUserId: userId,
              activityLegacyId,
              status: 'completed',
            })
            .select('jobId')
            .lean()
        : null,
      userId
        ? this.itineraryModel
            .findOne({ userId, activityLegacyId })
            .select('days activityLegacyId')
            .lean()
        : null,
    ]);

    return {
      activityLegacyId,
      hasTravelGuide: Boolean(travelGuide),
      travelGuideId: travelGuide?.jobId,
      hasItinerary: Boolean(itinerary?.days?.length),
      itineraryDayCount: itinerary?.days?.length ?? 0,
      itinerarySelectedDjIds: undefined,
      hasBuddyPost: false,
      buddyPostId: undefined,
      unreadReplyCount: 0,
    };
  }
}
