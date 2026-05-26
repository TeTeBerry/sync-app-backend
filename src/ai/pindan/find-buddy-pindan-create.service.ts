import { Injectable } from '@nestjs/common';
import type { FindBuddyState } from '../conversation/conversation-state.types';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  CreatePindanInput,
  PindanService,
} from '../../modules/pindan/pindan.service';
import type { PindanType } from '../../database/schemas/pindan.schema';
import { resolveActivityId } from '../utils/ticket-draft.parser';
import {
  buildFindBuddyCreatePindanPrompt,
  buildFindBuddyCreatedPindanReply,
} from '../utils/find-buddy-reply.util';
import { buildPindanCardFromDoc } from '../utils/pindan-card.util';
import {
  formatBudgetRangeLabel,
  inferActivityPackageGroupSize,
  isActivityOnlyCreateContext,
  resolvePerPersonBudget,
} from './find-buddy-activity-create.util';
import {
  buildPindanCardSubtitle,
  buildPindanPricePerPerson,
  buildPindanRemark,
  inferPackageGroupSize,
} from './find-buddy-pindan-create.util';
import { setFindBuddyJoinableIds } from '../conversation';
import type { ConversationState } from '../conversation';
import type { PindanJoinCardView as PindanJoinCardDto } from '../presentation/pindan-join-card.view';
import { ProfileService } from '../../modules/profile/profile.service';

type ActivityRow = Awaited<ReturnType<ActivityService['findByCode']>>;

function formatActivityDate(eventDate?: string): string | undefined {
  if (!eventDate) return undefined;
  const match = eventDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return eventDate;
  return `${match[2]}/${match[3]}`;
}

function inferPindanType(fb: FindBuddyState): PindanType {
  if (fb.transportNote && !fb.hotelName && !fb.packageName) {
    return 'transport';
  }
  if (fb.hotelName && !fb.packageName) {
    return 'hotel';
  }
  if (/交通|接驳|巴士|用车/.test(fb.packageName ?? '')) {
    return 'transport';
  }
  return 'package';
}

function buildPindanTitle(fb: FindBuddyState, activityName: string): string {
  if (fb.packageName?.trim()) return fb.packageName.trim();
  if (fb.hotelName?.trim()) return `${fb.hotelName.trim()}住宿拼单`;
  if (isActivityOnlyCreateContext(fb)) return `${activityName}套餐拼单`;
  return `${activityName}拼单`;
}

function resolveGroupSize(fb: FindBuddyState): number {
  if (isActivityOnlyCreateContext(fb)) {
    return inferActivityPackageGroupSize(fb);
  }
  return inferPackageGroupSize(fb);
}

@Injectable()
export class FindBuddyPindanCreateService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly pindanService: PindanService,
    private readonly profileService: ProfileService,
  ) {}

  buildCreatePrompt(fb: FindBuddyState, activityName?: string): string {
    return buildFindBuddyCreatePindanPrompt(fb, activityName);
  }

  buildDeclineReply(activityName: string): string {
    return [
      '好的，暂不创建拼单。',
      '',
      `如需为「${activityName}」发起拼单，随时回复「创建拼单」或点顶部「创建拼单」。`,
    ].join('\n');
  }

  private async ensureActivity(
    fb: FindBuddyState,
    matched?: ActivityRow | null,
  ): Promise<NonNullable<ActivityRow>> {
    if (matched?.code) return matched;

    if (fb.activityId) {
      const byCode = await this.activityService.findByCode(fb.activityId);
      if (byCode) return byCode;
    }

    const keyword = fb.activityKeyword?.trim();
    if (keyword) {
      const byKeyword = await this.activityService.matchActivity(keyword);
      if (byKeyword) return byKeyword;
    }

    return this.activityService.createFromFindBuddy({
      activityId: fb.activityId,
      activityKeyword: fb.activityKeyword,
      packageName: fb.packageName,
      hotelName: fb.hotelName,
      eventDate: fb.eventDate,
      location: fb.location,
      city: fb.city,
      resolvedCode:
        fb.activityId ??
        (fb.activityKeyword ? resolveActivityId(fb.activityKeyword) : undefined),
    });
  }

  private buildCreateInput(
    fb: FindBuddyState,
    activity: NonNullable<ActivityRow>,
    userId?: string,
  ): CreatePindanInput {
    const activityName = activity.name ?? activity.code ?? '活动';
    const groupSize = resolveGroupSize(fb);
    const pricePerPerson = buildPindanPricePerPerson(fb, groupSize);
    const perPersonBudget = resolvePerPersonBudget(fb, groupSize);
    const activityOnly = isActivityOnlyCreateContext(fb);

    return {
      title: buildPindanTitle(fb, activityName),
      subtitle: buildPindanCardSubtitle(1, groupSize),
      remark: buildPindanRemark(fb),
      type: inferPindanType(fb),
      activityId: activity.code,
      activityLegacyId: activity.legacyId,
      leaderUserId: userId ?? 'anonymous',
      price: pricePerPerson,
      originalPrice: fb.packagePrice,
      budgetMin: activityOnly ? perPersonBudget.budgetMin : undefined,
      budgetMax: activityOnly ? perPersonBudget.budgetMax : undefined,
      date: formatActivityDate(fb.eventDate) ?? activity.date,
      location: fb.location ?? fb.city ?? activity.location,
      total: groupSize,
    };
  }

  async createFromFindBuddy(params: {
    state: ConversationState;
    userId?: string;
    matchedActivity?: ActivityRow | null;
  }): Promise<{
    text: string;
    pindanCard?: PindanJoinCardDto;
    nextState: ConversationState;
  }> {
    const fb = params.state.findBuddy;
    if (!fb) {
      return {
        text: '会话状态异常，请重新发起拼单。',
        nextState: params.state,
      };
    }
    const activity = await this.ensureActivity(fb, params.matchedActivity);
    const activityName = activity.name ?? activity.code ?? '活动';
    const groupSize = resolveGroupSize(fb);

    const created = await this.pindanService.create(
      this.buildCreateInput(
        {
          ...fb,
          activityId: activity.code,
          activityKeyword: activityName,
          peopleCount: groupSize,
        },
        activity,
        params.userId,
      ),
    );

    if (params.userId && created.legacyId != null) {
      await this.profileService.registerCreatorJoin(
        created.legacyId,
        params.userId,
      );
    }

    await this.activityService.incrementPinCount(activity.code);

    const mergedFb: FindBuddyState = {
      ...fb,
      phase: 'browse_pindan',
      activityId: activity.code,
      activityKeyword: activityName,
      peopleCount: groupSize,
      joinablePindanIds: [],
    };

    let nextState = setFindBuddyJoinableIds(params.state, []);
    nextState = {
      ...nextState,
      findBuddy: mergedFb,
    };

    const pindanCard = buildPindanCardFromDoc(created, {
      userId: params.userId,
      activityLegacyId: activity.legacyId,
      budgetRangeLabel: isActivityOnlyCreateContext(fb)
        ? formatBudgetRangeLabel(fb, groupSize)
        : undefined,
    });

    return {
      text: buildFindBuddyCreatedPindanReply(
        activityName,
        { ...mergedFb, peopleCount: groupSize },
        groupSize,
        buildPindanPricePerPerson(fb, groupSize),
      ),
      pindanCard,
      nextState,
    };
  }
}
