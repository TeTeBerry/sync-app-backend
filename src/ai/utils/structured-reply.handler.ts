import { ChatMessageDto } from '../dto/chat.dto';
import type { FindBuddyState } from '../conversation/conversation-state.types';
import {
  isFindBuddyFlow,
  isTicketListingFlow,
  setFindBuddyJoinableIds,
  startFindBuddyFlow,
  type ConversationState,
} from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import { ProfileService } from '../../modules/profile/profile.service';
import {
  buildActivityBrowseCard,
  buildActivityBrowseText,
} from './activity-pindan-card.util';
import {
  resolveActivityCreatePhase,
} from './find-buddy-activity-create.util';
import {
  buildFindBuddyBrowseReply,
  buildFindBuddyCollectCreateReply,
  buildFindBuddyCollectingReply,
  buildFindBuddyCreatePindanPrompt,
  buildFindBuddyExclusionReply,
  getMissingFindBuddyFields,
} from './find-buddy-reply.util';
import {
  formatExcludedActivityLabel,
  isFindBuddyRestartRequest,
  parseExcludedActivityRefs,
  parsePositiveActivityInput,
} from './find-buddy-correction.util';
import {
  buildActivityPickerPrompt,
  parseActivityPickerIndex,
} from './activity-reply.util';
import {
  buildKnownFactsSummary,
  getMissingBuddyFields,
  isActivityKeywordInput,
  isCreatePindanRequest,
  parseConversationContext,
} from './conversation-context.parser';
import {
  buildPindanIntro,
  formatPindanLines,
  getBrowsePindanRows,
  getJoinablePindanRows,
  loadPindanRowsForReply,
  type ReplyPindanRow,
} from './pindan-reply.util';

type TicketRow = {
  activityId?: string;
  userId?: string;
  userName?: string;
  skuCode?: string;
  seatOrSlot?: Record<string, unknown>;
};

function formatTicketRows(
  rows: TicketRow[],
  activityNames: Map<string, string>,
): string {
  if (!rows.length) {
    return '暂无相关门票挂单。';
  }

  return rows
    .slice(0, 5)
    .map((row, index) => {
      const slot = row.seatOrSlot ?? {};
      const type = slot.type === 'buy' ? '收票' : '出票';
      const price = slot.price != null ? `¥${slot.price}` : '面议';
      const qty = slot.quantity != null ? `${slot.quantity}张` : '';
      const event = activityNames.get(row.activityId ?? '') ?? row.activityId ?? '活动';
      const seat = row.skuCode ?? 'GA';
      return `${index + 1}. 【${type}】${event} · ${seat}${qty ? ` · ${qty}` : ''} · ${price}`;
    })
    .join('\n');
}

function buildFindBuddyGuidance(
  joinableRows: ReplyPindanRow[],
  browseRows: ReplyPindanRow[],
  joinedRows: ReplyPindanRow[],
  activityName: string,
  missing: string[],
): string {
  const lines: string[] = [];

  if (joinableRows.length) {
    lines.push(
      '想加入已有拼单，回复序号即可（如「第一个」）。',
      '没有合适的？点顶部「创建拼单」可发起新拼单。',
    );
  } else if (browseRows.length || joinedRows.length) {
    lines.push(
      '你已在该活动的拼单中。',
      '点击下方卡片可查看；如需其他安排，可点「创建拼单」再发起一条。',
    );
  } else {
    lines.push(
      `目前还没有「${activityName}」的可加入拼单。`,
      '建议点顶部「创建拼单」发起新拼单；也可补充出行信息，我帮你继续匹配。',
    );
  }

  if (missing.length) {
    lines.push('', `可选补充：${missing.join('、')}。`);
  }

  return lines.join('\n');
}

function shouldAttachBrowseCard(
  fb: FindBuddyState,
  browseRows: ReplyPindanRow[],
  fromImage: boolean,
): boolean {
  if (
    fb.phase === 'confirm_create_pindan' ||
    fb.phase === 'collect_create_pindan' ||
    fb.phase === 'pick_package'
  ) {
    return false;
  }
  if (fromImage && browseRows.length === 0) {
    return false;
  }
  return true;
}

function shouldHandleStructuredReply(
  state: ConversationState,
  messages: ChatMessageDto[],
  input: string,
): boolean {
  if (isCreatePindanRequest(input)) return true;
  if (isTicketListingFlow(state)) return false;
  if (isFindBuddyFlow(state)) return true;
  if (isActivityKeywordInput(input)) return true;
  return false;
}

export { shouldHandleStructuredReply };

export interface StructuredReplyResult {
  text: string;
  pindanCard?: import('../dto/chat.dto').PindanJoinCardDto;
  nextState: ConversationState;
}

async function resolveFindBuddyActivity(
  state: ConversationState,
  input: string,
  activityService: ActivityService,
) {
  const fb = state.findBuddy!;
  const trimmed = input.trim();
  const excludedRefs = parseExcludedActivityRefs(trimmed);

  const lockedPackageFlow =
    (fb.phase === 'pick_package' && (fb.packageOptions?.length ?? 0) >= 2) ||
    fb.phase === 'confirm_create_pindan' ||
    fb.phase === 'collect_create_pindan';

  if (lockedPackageFlow) {
    if (fb.activityId) {
      const byCode = await activityService.findByCode(fb.activityId);
      if (byCode) return byCode;
    }
    if (fb.activityKeyword) {
      return activityService.matchActivity(fb.activityKeyword);
    }
    return null;
  }

  const pickerIndex = parseActivityPickerIndex(trimmed);
  if (pickerIndex) {
    const activities = await activityService.findAll();
    return activities[pickerIndex - 1] ?? null;
  }

  const positiveActivity = parsePositiveActivityInput(trimmed);
  if (positiveActivity) {
    return activityService.matchActivity(positiveActivity);
  }

  if (excludedRefs.length) {
    return null;
  }

  if (fb.activityId) {
    const byCode = await activityService.findByCode(fb.activityId);
    if (byCode) return byCode;
  }

  if (isActivityKeywordInput(trimmed)) {
    return activityService.matchActivity(trimmed);
  }

  if (fb.activityKeyword) {
    return activityService.matchActivity(fb.activityKeyword);
  }

  return null;
}

async function buildFindBuddyStructuredReply(
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
    profileService: ProfileService;
  },
  context: { userId?: string; image?: string },
  state: ConversationState,
): Promise<StructuredReplyResult> {
  const fb = state.findBuddy ?? startFindBuddyFlow('pick_activity').findBuddy!;
  const fromImage = Boolean(context.image?.trim());
  const excludedRefs = parseExcludedActivityRefs(input);

  if (isFindBuddyRestartRequest(input)) {
    return {
      text: await buildActivityPickerPrompt(
        services.activityService,
        '好的，我们重新开始找搭子 🎵',
      ),
      nextState: startFindBuddyFlow('pick_activity'),
    };
  }

  const activity = await resolveFindBuddyActivity(state, input, services.activityService);

  if (!activity?.code) {
    if (excludedRefs.length) {
      const collecting = buildFindBuddyCollectingReply(fb, undefined, fromImage);
      return {
        text: [
          buildFindBuddyExclusionReply(formatExcludedActivityLabel(excludedRefs)),
          '',
          collecting,
        ].join('\n'),
        nextState: {
          ...state,
          flow: 'find_buddy',
          findBuddy: { ...fb, phase: 'pick_activity' },
        },
      };
    }

    if (
      fromImage &&
      (fb.activityKeyword || fb.packageName || fb.hotelName) &&
      (fb.eventDate || fb.city || fb.packagePrice)
    ) {
      const label = fb.activityKeyword ?? fb.packageName ?? '未命名活动';
      return {
        text: buildFindBuddyCreatePindanPrompt(
          { ...fb, activityKeyword: label },
          label,
        ),
        nextState: {
          ...state,
          flow: 'find_buddy',
          findBuddy: {
            ...fb,
            activityKeyword: label,
            phase: 'confirm_create_pindan',
          },
        },
      };
    }

    const collecting = buildFindBuddyCollectingReply(
      fb,
      undefined,
      fromImage,
    );
    return {
      text: collecting,
      nextState: {
        ...state,
        flow: 'find_buddy',
        findBuddy: { ...fb, phase: 'pick_activity' },
      },
    };
  }

  const pindanRows = await loadPindanRowsForReply(
    await services.pindanService.searchForActivity(activity.code),
    {
      pindanService: services.pindanService,
      profileService: services.profileService,
    },
    context.userId,
  );
  const browseRows = getBrowsePindanRows(pindanRows);
  const joinableRows = getJoinablePindanRows(pindanRows);
  const joinableIds = joinableRows
    .map(row => row.legacyId)
    .filter((id): id is number => id != null);

  const activityName = activity.name ?? activity.code;
  const missing = getMissingFindBuddyFields({
    ...fb,
    activityId: activity.code,
    activityKeyword: activityName,
  });

  const mergedForPhase = {
    ...fb,
    activityId: activity.code,
    activityKeyword: activityName,
  };
  const createPhase = resolveActivityCreatePhase(
    mergedForPhase,
    browseRows.length === 0,
  );

  let nextState = setFindBuddyJoinableIds(state, joinableIds);
  nextState = {
    ...nextState,
    findBuddy: {
      ...nextState.findBuddy!,
      phase: browseRows.length === 0 ? createPhase : 'browse_pindan',
      activityId: activity.code,
      activityKeyword: activityName,
      joinablePindanIds: joinableIds,
    },
  };

  if (fb.phase === 'pick_activity' && missing.length > 0 && !fromImage) {
    const mergedFb = {
      ...fb,
      activityId: activity.code,
      activityKeyword: activityName,
    };
    return {
      text: [
        buildFindBuddyCollectingReply(mergedFb, activityName, false),
        '',
        buildFindBuddyBrowseReply(
          activityName,
          browseRows.length,
          joinableRows.length,
          fb,
          false,
        ),
      ].join('\n'),
      pindanCard: shouldAttachBrowseCard(mergedFb, browseRows, false)
        ? buildActivityBrowseCard(activity, browseRows, mergedFb)
        : undefined,
      nextState,
    };
  }

  const mergedFb = {
    ...fb,
    activityId: activity.code,
    activityKeyword: activityName,
  };
  const attachCard = shouldAttachBrowseCard(
    nextState.findBuddy ?? mergedFb,
    browseRows,
    fromImage,
  );

  const browseText =
    browseRows.length === 0 && createPhase === 'collect_create_pindan'
      ? buildFindBuddyCollectCreateReply(mergedFb, activityName)
      : buildFindBuddyBrowseReply(
          activityName,
          browseRows.length,
          joinableRows.length,
          mergedFb,
          fromImage,
        );

  return {
    text: browseText,
    pindanCard: attachCard
      ? buildActivityBrowseCard(activity, browseRows, mergedFb)
      : undefined,
    nextState,
  };
}

export async function buildStructuredReply(
  messages: ChatMessageDto[],
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
    ticketService: TicketService;
    profileService: ProfileService;
  },
  context: { userId?: string; image?: string } = {},
  state: ConversationState,
): Promise<StructuredReplyResult | null> {
  if (!shouldHandleStructuredReply(state, messages, input)) {
    return null;
  }

  if (isCreatePindanRequest(input) && isFindBuddyFlow(state) && state.findBuddy) {
    const fb = state.findBuddy;
    const activityName =
      fb.activityKeyword ??
      (fb.activityId ? (await services.activityService.findByCode(fb.activityId))?.name : undefined) ??
      fb.activityId;
    const phase = resolveActivityCreatePhase(fb, true);
    const text =
      phase === 'collect_create_pindan'
        ? buildFindBuddyCollectCreateReply(fb, activityName)
        : buildFindBuddyCreatePindanPrompt(fb, activityName);
    return {
      text,
      nextState: {
        ...state,
        findBuddy: {
          ...fb,
          phase,
        },
      },
    };
  }

  if (isFindBuddyFlow(state)) {
    return buildFindBuddyStructuredReply(input, services, context, state);
  }

  if (isActivityKeywordInput(input)) {
    const activity = await services.activityService.matchActivity(input.trim());
    if (!activity?.code) {
      return {
        text: `未找到活动「${input.trim()}」，请换个名称试试（如 EDC、S2O、Ultra）。`,
        nextState: state,
      };
    }

    const pindanRows = await loadPindanRowsForReply(
      await services.pindanService.searchForActivity(activity.code),
      {
        pindanService: services.pindanService,
        profileService: services.profileService,
      },
      context.userId,
    );
    const browseRows = getBrowsePindanRows(pindanRows);
    const joinableRows = getJoinablePindanRows(pindanRows);

    return {
      text: buildActivityBrowseText(
        activity.name ?? activity.code,
        browseRows.length,
        joinableRows.length,
      ),
      pindanCard: buildActivityBrowseCard(activity, browseRows),
      nextState: {
        ...startFindBuddyFlow('browse_pindan'),
        findBuddy: {
          ...startFindBuddyFlow('browse_pindan').findBuddy!,
          activityId: activity.code,
          activityKeyword: activity.name,
        },
      },
    };
  }

  const ctx = parseConversationContext(messages, input);
  const activity =
    (ctx.activityId
      ? await services.activityService.findByCode(ctx.activityId)
      : null) ??
    (ctx.activityKeyword
      ? await services.activityService.matchActivity(ctx.activityKeyword)
      : null);

  const activityRef =
    activity?.code ?? ctx.activityId ?? ctx.activityKeyword ?? input.trim();

  const candidateRows = isActivityKeywordInput(input)
    ? await services.pindanService.searchForActivity(activityRef)
    : await services.pindanService.searchFromQuery({});

  const pindanRows = await loadPindanRowsForReply(
    candidateRows,
    {
      pindanService: services.pindanService,
      profileService: services.profileService,
    },
    context.userId,
  );

  const ticketRows = await services.ticketService.searchListings({
    activityId: activity?.code ?? ctx.activityId,
    type: 'sell',
  });

  const activities = await services.activityService.findAll();
  const activityNames = new Map(
    activities.map(item => [item.code, item.name] as const),
  );

  const activityLabel = activity?.name ?? activityRef;
  const browseRows = getBrowsePindanRows(pindanRows);
  const joinableRows = getJoinablePindanRows(pindanRows);
  const joinedRows = pindanRows.filter(row => row.userJoined);

  const sections = [
    activity?.name
      ? `📍 ${activity.name}${activity.date ? ` · ${activity.date}` : ''}${activity.location ? ` · ${activity.location}` : ''}`
      : '',
    '',
    buildPindanIntro(pindanRows, activityLabel),
    formatPindanLines(joinableRows, 5, '暂无正在拼单的订单。'),
    joinedRows.length
      ? ['', '【你已加入】', formatPindanLines(joinedRows, 5, '暂无')].join('\n')
      : '',
    '',
    '【相关门票（出票）】',
    formatTicketRows(ticketRows, activityNames),
  ].filter(Boolean);

  return {
    text: sections.join('\n'),
    nextState: state,
  };
}
