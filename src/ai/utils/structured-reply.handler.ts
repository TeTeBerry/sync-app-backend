import { ChatMessageDto } from '../dto/chat.dto';
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
  openRows: ReplyPindanRow[],
  joinedRows: ReplyPindanRow[],
  activityName: string,
  missing: string[],
): string {
  const lines: string[] = [];

  if (openRows.length) {
    lines.push(
      '想加入已有拼单，回复序号即可（如「第一个」）。',
      '没有合适的？点顶部「创建拼单」可发起新拼单。',
    );
  } else if (joinedRows.length) {
    lines.push(
      '你已在该活动的拼单中。',
      '如需其他安排，可点「创建拼单」发起新拼单，或告诉我更多需求。',
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

  if (fb.activityId) {
    const byCode = await activityService.findByCode(fb.activityId);
    if (byCode) return byCode;
  }

  const pickerIndex = parseActivityPickerIndex(trimmed);
  if (pickerIndex) {
    const activities = await activityService.findAll();
    return activities[pickerIndex - 1] ?? null;
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
  context: { userId?: string },
  state: ConversationState,
): Promise<StructuredReplyResult> {
  const fb = state.findBuddy ?? startFindBuddyFlow('pick_activity').findBuddy!;

  if (fb.phase === 'pick_activity') {
    const activity = await resolveFindBuddyActivity(state, input, services.activityService);
    if (!activity?.code) {
      return {
        text: await buildActivityPickerPrompt(
          services.activityService,
          '好的，我先确认一下你想参加的活动 🎵',
        ),
        nextState: startFindBuddyFlow('pick_activity'),
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
    const openRows = pindanRows.filter(row => !row.userJoined);
    const joinableIds = openRows
      .map(row => row.legacyId)
      .filter((id): id is number => id != null);

    let nextState = setFindBuddyJoinableIds(state, joinableIds);
    nextState = {
      ...nextState,
      findBuddy: {
        ...nextState.findBuddy!,
        phase: 'browse_pindan',
        activityId: activity.code,
        activityKeyword: activity.name,
        joinablePindanIds: joinableIds,
      },
    };

    return {
      text: buildActivityBrowseText(activity.name ?? activity.code, openRows.length),
      pindanCard: buildActivityBrowseCard(activity, openRows),
      nextState,
    };
  }

  const activity = await resolveFindBuddyActivity(state, input, services.activityService);
  if (!activity?.code) {
    return {
      text: await buildActivityPickerPrompt(
        services.activityService,
        '请告诉我你想参加的活动名称或序号 🎵',
      ),
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
  const openRows = pindanRows.filter(row => !row.userJoined);
  const joinableIds = openRows
    .map(row => row.legacyId)
    .filter((id): id is number => id != null);

  return {
    text: buildActivityBrowseText(activity.name ?? activity.code, openRows.length),
    pindanCard: buildActivityBrowseCard(activity, openRows),
    nextState: setFindBuddyJoinableIds(
      {
        ...state,
        findBuddy: {
          ...state.findBuddy!,
          activityId: activity.code,
          activityKeyword: activity.name,
          phase: 'browse_pindan',
          joinablePindanIds: joinableIds,
        },
      },
      joinableIds,
    ),
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
  context: { userId?: string } = {},
  state: ConversationState,
): Promise<StructuredReplyResult | null> {
  if (!shouldHandleStructuredReply(state, messages, input)) {
    return null;
  }

  if (isCreatePindanRequest(input)) {
    return {
      text: [
        '发起新拼单请点顶部「创建拼单」标签，选择酒店/交通等类型后填写发布即可。',
        '',
        '填写活动、日期和人数后，我会继续帮你匹配合适的同行伙伴。',
      ].join('\n'),
      nextState: state,
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
    const openRows = pindanRows.filter(row => !row.userJoined);

    return {
      text: buildActivityBrowseText(activity.name ?? activity.code, openRows.length),
      pindanCard: buildActivityBrowseCard(activity, openRows),
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
  const openRows = pindanRows.filter(row => !row.userJoined);
  const joinedRows = pindanRows.filter(row => row.userJoined);

  const sections = [
    activity?.name
      ? `📍 ${activity.name}${activity.date ? ` · ${activity.date}` : ''}${activity.location ? ` · ${activity.location}` : ''}`
      : '',
    '',
    buildPindanIntro(pindanRows, activityLabel),
    formatPindanLines(openRows, 5, '暂无正在拼单的订单。'),
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
