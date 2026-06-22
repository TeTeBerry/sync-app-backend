import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  FestivalPlanProgressCacheService,
  HomeSummaryCacheService,
} from '../../infra/cache/bff-read-cache.service';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobDocument,
} from '../../database/schemas/travel-guide-generation-job.schema';
import type { FestivalPlanProgressDto } from '../../shared/festival-plan';
import { ItineraryService } from '../itinerary/itinerary.service';
import { NotificationService } from '../notification/notification.service';
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
    private readonly notificationService: NotificationService,
    private readonly festivalPlanCache: FestivalPlanProgressCacheService,
  ) {}

  async getProgress(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<FestivalPlanProgressDto> {
    const userId = actor.resolvedUserId?.trim();
    if (userId) {
      const cached = await this.festivalPlanCache.get(userId, activityLegacyId);
      if (cached) {
        return cached;
      }
    }

    const progress = await this.buildProgress(activityLegacyId, actor);
    if (userId) {
      await this.festivalPlanCache.set(userId, activityLegacyId, progress);
    }
    return progress;
  }

  private async buildProgress(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<FestivalPlanProgressDto> {
    const [savedGuide, guideJob, savedItinerary, buddyPost] = await Promise.all(
      [
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
      ],
    );

    const travelGuideId = savedGuide?.guideId ?? readGuideIdFromJob(guideJob);
    const itineraryDays =
      savedItinerary.saved && savedItinerary.days?.length
        ? savedItinerary.days
        : null;
    const buddyPostId = buddyPost?.id;
    const userId = actor.resolvedUserId?.trim();
    const unreadReplyCount =
      userId && buddyPostId
        ? await this.notificationService.countUnreadPostEngagement(userId, [
            buddyPostId,
          ])
        : 0;

    return {
      activityLegacyId,
      hasTravelGuide: Boolean(travelGuideId),
      travelGuideId,
      hasItinerary: Boolean(itineraryDays?.length),
      itineraryDayCount: itineraryDays?.length,
      itinerarySelectedDjIds: savedItinerary.saved
        ? savedItinerary.selectedDjIds
        : undefined,
      hasBuddyPost: Boolean(buddyPostId),
      buddyPostId,
      unreadReplyCount: unreadReplyCount > 0 ? unreadReplyCount : undefined,
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
  return typeof guideId === 'string' && guideId.trim()
    ? guideId.trim()
    : undefined;
}
