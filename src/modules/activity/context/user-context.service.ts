import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { AiGuidePlanFormValues } from '@sync/travel-guide-contracts';
import { ActivityRegistrationService } from '../registration/activity-registration.service';
import { ActivityLookupService } from '../activity-lookup.service';
import { ActivityEngagementService } from '../engagement/activity-engagement.service';
import { UserGoalService } from '../../goal/goal.service';
import type { UserGoalDocument } from '../../goal/goal.model';
import { UserGoalKind } from '../../goal/goal.model';
import { PostQueryService } from '../../partner/application/post-query.service';
import { TravelGuideSavedPlanService } from '../../travel-guide/travel-guide-saved-plan.service';
import { UserService } from '../../user/user.service';

export interface UserActivityContext {
  activityLegacyId: number;
  isRegistered: boolean;
  hasBuddyPost: boolean;
  lineupPublished: boolean;
  lineupAnnouncedAt?: string;
  hasTravelGuide: boolean;
  travelGuideId?: string;
  travelGuideForm?: AiGuidePlanFormValues;
  hasSearchedRecruits: boolean;
  hasViewedLineup: boolean;
  lineupViewedAt?: string;
  goals: {
    watchLineup?: UserGoalDocument;
  };
  favorGenres?: string[];
}

@Injectable()
export class UserContextService {
  constructor(
    private readonly registrationService: ActivityRegistrationService,
    private readonly activityLookup: ActivityLookupService,
    private readonly goalService: UserGoalService,
    private readonly postQuery: PostQueryService,
    private readonly engagementService: ActivityEngagementService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly userService: UserService,
  ) {}

  async resolveForActivity(
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<UserActivityContext> {
    const userId = actor.resolvedUserId;
    const [
      registeredIds,
      activity,
      goals,
      ownerPosts,
      engagement,
      savedGuide,
      profile,
    ] = await Promise.all([
      this.registrationService.listRegisteredLegacyIds(actor),
      this.activityLookup.findByLegacyId(activityLegacyId),
      this.goalService.findByUser(userId, activityLegacyId),
      this.postQuery.listByOwner(actor),
      this.engagementService.getEngagement(userId, activityLegacyId),
      this.savedPlanService.findLatestByOwnerAndActivity(
        userId,
        activityLegacyId,
      ),
      this.userService.resolveProfile(actor),
    ]);

    const isRegistered = registeredIds.has(activityLegacyId);
    const lineupPublished = activity?.lineupPublished ?? false;
    const hasBuddyPost = ownerPosts.some(
      (post) => post.activityLegacyId === activityLegacyId,
    );
    const goalsByKind = new Map<string, UserGoalDocument>();
    for (const g of goals) {
      goalsByKind.set(g.kind, g);
    }

    const favorGenres = (profile?.favorGenres ?? [])
      .map((genre) => genre.trim())
      .filter(Boolean);

    const lineupAnnouncedAt = toIsoString(activity?.lineupAnnouncedAt);
    const lineupViewedAt = engagement?.lineupViewedAt;
    const hasViewedLineup = Boolean(lineupViewedAt?.trim());

    return {
      activityLegacyId,
      isRegistered,
      hasBuddyPost,
      lineupPublished,
      lineupAnnouncedAt,
      hasTravelGuide: Boolean(savedGuide?.guideId),
      travelGuideId: savedGuide?.guideId,
      travelGuideForm: savedGuide?.form,
      hasSearchedRecruits: Boolean(engagement?.recruitSearchedAt?.trim()),
      hasViewedLineup,
      lineupViewedAt,
      goals: {
        watchLineup: goalsByKind.get(UserGoalKind.WATCH_LINEUP) ?? undefined,
      },
      ...(favorGenres.length ? { favorGenres } : {}),
    };
  }

  async resolveForUser(actor: RequestActor): Promise<{
    registeredActivities: number[];
    activeGoals: UserGoalDocument[];
  }> {
    const userId = actor.resolvedUserId;
    const goals = await this.goalService.findByUser(userId);

    const registeredActivities = goals
      .filter((g) => g.kind === UserGoalKind.WATCH_LINEUP)
      .map((g) => g.activityLegacyId);

    return {
      registeredActivities,
      activeGoals: goals.filter((g) => g.status === 'active'),
    };
  }
}

function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}
