import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ownerFilterFromActor } from '../../common/auth/actor-query.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobDocument,
} from '../../database/schemas/travel-guide-generation-job.schema';
import type { FestivalPlanProgressDto } from '../../shared/festival-plan';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  IActivityRegistrationRepository,
} from '../activity/registration/interfaces/activity-registration.repository.interface';
import { ItineraryService } from '../itinerary/itinerary.service';
import { PostQueryService } from '../partner/application/post-query.service';
import { TravelGuideSavedPlanService } from '../travel-guide/travel-guide-saved-plan.service';

@Injectable()
export class FestivalPlanProgressService {
  constructor(
    @InjectModel(TravelGuideGenerationJob.name)
    private readonly travelGuideJobModel: Model<TravelGuideGenerationJobDocument>,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly itineraryService: ItineraryService,
    private readonly postQueryService: PostQueryService,
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: IActivityRegistrationRepository,
  ) {}

  async getProgress(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<FestivalPlanProgressDto> {
    const ownerFilter = ownerFilterFromActor(actor);

    const [savedGuide, guideJob, savedItinerary, buddyPost, registration] =
      await Promise.all([
        this.savedPlanService.findLatestByOwnerAndActivity(
          actor.resolvedUserId,
          activityLegacyId,
        ),
        this.findLatestCompletedGuideJob(
          activityLegacyId,
          actor.resolvedUserId,
        ),
        this.itineraryService.getSaved(activityLegacyId, actor),
        this.postQueryService.findOwnerActivePostForActivity(
          activityLegacyId,
          actor,
        ),
        this.registrationRepository.findByOwnerAndActivity(
          ownerFilter,
          activityLegacyId,
        ),
      ]);

    const travelGuideId = savedGuide?.guideId ?? readGuideIdFromJob(guideJob);
    const itineraryDays =
      savedItinerary.saved && savedItinerary.days?.length
        ? savedItinerary.days
        : null;

    return {
      activityLegacyId,
      hasTravelGuide: Boolean(travelGuideId),
      travelGuideId,
      hasItinerary: Boolean(itineraryDays?.length),
      itineraryDayCount: itineraryDays?.length,
      itinerarySelectedDjIds: savedItinerary.saved
        ? savedItinerary.selectedDjIds
        : undefined,
      hasBuddyPost: Boolean(buddyPost?.id),
      buddyPostId: buddyPost?.id,
      isRegistered: Boolean(registration),
    };
  }

  private findLatestCompletedGuideJob(
    activityLegacyId: number,
    ownerUserId: string,
  ) {
    return this.travelGuideJobModel
      .findOne({
        activityLegacyId,
        ownerUserId,
        status: 'completed',
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }
}

function readGuideIdFromJob(
  guideJob: Pick<TravelGuideGenerationJob, 'requestParams'> | null,
): string | undefined {
  if (!guideJob?.requestParams || typeof guideJob.requestParams !== 'object') {
    return undefined;
  }

  const guideId = (guideJob.requestParams as { guideId?: unknown }).guideId;
  if (typeof guideId !== 'string' || !guideId.trim()) {
    return undefined;
  }
  return guideId.trim();
}
