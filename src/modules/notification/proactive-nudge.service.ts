import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { toRequestActor } from '../../common/auth/actor-query.util';
import { UserContextService } from '../activity/context/user-context.service';
import { ActivityRegistrationService } from '../activity/registration/activity-registration.service';
import { ActivityLookupService } from '../activity/activity-lookup.service';
import { NoticeAgent } from '../../ai/agents/notice.agent';
import { NotificationService } from './notification.service';
import {
  POST_REPOSITORY,
  type IPostRepository,
} from '../partner/interfaces/post.repository.interface';
import { travelGuideFormToRecruitSearchQuery } from '../travel-guide/domain/travel-guide-recruit-search-query.util';

const MILLISECONDS_PER_DAY = 86_400_000;
const NUDGE_COOLDOWN_MS = MILLISECONDS_PER_DAY;
const LINEUP_ANNOUNCE_NUDGE_WINDOW_MS = 7 * MILLISECONDS_PER_DAY;
const RECENT_RECRUIT_POST_WINDOW_MS = MILLISECONDS_PER_DAY;
const RECENT_RECRUIT_POST_THRESHOLD = 5;
const UPCOMING_ACTIVITY_WINDOW_DAYS = 30;

type NudgeRuleId = 'N1' | 'N2' | 'N3' | 'N4';

type NudgePayload = {
  ruleId: NudgeRuleId;
  copy: string;
  prefillQuery?: string;
  openBuddyPost?: boolean;
  openLineup?: boolean;
  focusPosts?: boolean;
};

@Injectable()
export class ProactiveNudgeService {
  private readonly logger = new Logger(ProactiveNudgeService.name);

  constructor(
    private readonly userContext: UserContextService,
    private readonly registrationService: ActivityRegistrationService,
    private readonly activityLookup: ActivityLookupService,
    private readonly noticeAgent: NoticeAgent,
    private readonly notificationService: NotificationService,
    @Inject(POST_REPOSITORY)
    private readonly postRepository: IPostRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    await this.checkNudges();
  }

  async checkNudges(): Promise<void> {
    this.logger.debug('Running proactive nudge check...');
    const registrations = await this.registrationService.listAllRegistered();
    const activityCache = new Map<
      number,
      Awaited<ReturnType<ActivityLookupService['findByLegacyId']>>
    >();
    const recentPostCountCache = new Map<number, number>();

    for (const registration of registrations) {
      const { userId, activityLegacyId } = registration;
      let activity = activityCache.get(activityLegacyId);
      if (activity === undefined) {
        activity = await this.activityLookup.findByLegacyId(activityLegacyId);
        activityCache.set(activityLegacyId, activity);
      }

      if (!this.isUpcomingActivity(activity?.date)) {
        continue;
      }

      const actor = toRequestActor(userId);
      const ctx = await this.userContext.resolveForActivity(
        actor,
        activityLegacyId,
      );

      let recentPosts24h = recentPostCountCache.get(activityLegacyId);
      if (recentPosts24h === undefined) {
        recentPosts24h = await this.postRepository.countListedPostsSince(
          activityLegacyId,
          new Date(Date.now() - RECENT_RECRUIT_POST_WINDOW_MS),
        );
        recentPostCountCache.set(activityLegacyId, recentPosts24h);
      }

      await this.evaluateNudgeRules(userId, activityLegacyId, ctx, {
        activityDate: activity?.date,
        activityName: activity?.name,
        recentPosts24h,
      });
    }
  }

  private async evaluateNudgeRules(
    userId: string,
    activityLegacyId: number,
    ctx: Awaited<ReturnType<UserContextService['resolveForActivity']>>,
    options: {
      activityDate?: string;
      activityName?: string;
      recentPosts24h: number;
    },
  ): Promise<void> {
    const daysUntil = this.daysUntil(options.activityDate);
    const nudges: NudgePayload[] = [];
    const eventLabel = options.activityName?.trim() || '';

    if (
      ctx.isRegistered &&
      !ctx.hasBuddyPost &&
      daysUntil != null &&
      daysUntil >= 0 &&
      daysUntil < UPCOMING_ACTIVITY_WINDOW_DAYS
    ) {
      nudges.push({
        ruleId: 'N1',
        copy: '还差一步：发一条公开招募帖',
        openBuddyPost: true,
      });
    }

    if (this.shouldSendLineupNudge(ctx)) {
      nudges.push({
        ruleId: 'N2',
        copy: formatLineupNudgeCopy(eventLabel),
        openLineup: true,
      });
    }

    if (ctx.hasTravelGuide && !ctx.hasSearchedRecruits && ctx.travelGuideForm) {
      nudges.push({
        ruleId: 'N3',
        copy: '用攻略条件找公开招募',
        prefillQuery: travelGuideFormToRecruitSearchQuery(
          ctx.travelGuideForm,
          options.activityDate,
        ),
        focusPosts: true,
      });
    }

    if (
      ctx.isRegistered &&
      !ctx.hasBuddyPost &&
      options.recentPosts24h >= RECENT_RECRUIT_POST_THRESHOLD
    ) {
      nudges.push({
        ruleId: 'N4',
        copy: '这场节招募很活跃，去看看公开招募',
        focusPosts: true,
      });
    }

    for (const nudge of nudges) {
      await this.sendNudgeIfCooledDown(
        userId,
        activityLegacyId,
        nudge,
        eventLabel || undefined,
      );
    }
  }

  private shouldSendLineupNudge(
    ctx: Awaited<ReturnType<UserContextService['resolveForActivity']>>,
  ): boolean {
    if (!ctx.lineupPublished || !ctx.lineupAnnouncedAt) {
      return false;
    }

    const announcedAt = new Date(ctx.lineupAnnouncedAt).getTime();
    if (
      Number.isNaN(announcedAt) ||
      Date.now() - announcedAt > LINEUP_ANNOUNCE_NUDGE_WINDOW_MS
    ) {
      return false;
    }

    if (!ctx.hasViewedLineup) {
      return true;
    }

    const viewedAt = ctx.lineupViewedAt
      ? new Date(ctx.lineupViewedAt).getTime()
      : Number.NaN;
    return Number.isNaN(viewedAt) || viewedAt < announcedAt;
  }

  private async sendNudgeIfCooledDown(
    userId: string,
    activityLegacyId: number,
    nudge: NudgePayload,
    activityName?: string,
  ): Promise<void> {
    const duplicate = await this.notificationService.hasRecentByMeta(
      userId,
      'proactive_nudge',
      {
        activityLegacyId,
        nudgeRule: nudge.ruleId,
        sinceMs: NUDGE_COOLDOWN_MS,
      },
    );
    if (duplicate) {
      return;
    }

    await this.noticeAgent.notifyProactiveNudge({
      userId,
      activityLegacyId,
      ruleId: nudge.ruleId,
      copy: nudge.copy,
      activityName,
      prefillQuery: nudge.prefillQuery,
      openBuddyPost: nudge.openBuddyPost,
      openLineup: nudge.openLineup,
      focusPosts: nudge.focusPosts,
    });
  }

  private isUpcomingActivity(dateStr?: string): boolean {
    const daysUntil = this.daysUntil(dateStr);
    if (daysUntil == null) {
      return true;
    }
    return daysUntil >= 0 && daysUntil < UPCOMING_ACTIVITY_WINDOW_DAYS;
  }

  private daysUntil(dateStr?: string): number | null {
    const raw = dateStr?.trim() ?? '';
    if (!raw) {
      return null;
    }

    const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
    const target = isoMatch ? new Date(isoMatch[0]) : new Date(raw);
    if (Number.isNaN(target.getTime())) {
      return null;
    }

    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);
  }
}

function formatLineupNudgeCopy(activityName: string): string {
  const suffix = '阵容已出，去看看必看 Set';
  const name = activityName.trim();
  return name ? `${name}${suffix}` : suffix;
}
