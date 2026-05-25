import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { PindanJoinCardView as PindanJoinCardDto } from '../presentation/pindan-join-card.view';
import {
  isFindBuddyFlow,
  setFindBuddyJoinableIds,
  type ConversationState,
} from '../conversation';
import { isAwaitingActivitySelection } from './activity-reply.util';
import {
  isListSelectionInput,
  parseListSelectionIndex,
} from './list-selection.util';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import { resolveThreadPindanRows } from './pindan-query.util';
import { isPindanOpen } from './pindan-reply.util';

const MAX_PINDAN_SELECTION = 5;

export interface PindanJoinReplyResult {
  text: string;
  pindanCard?: PindanJoinCardDto;
  nextState?: ConversationState;
}

export function parsePindanSelectionIndex(input: string): number | null {
  return parseListSelectionIndex(input, MAX_PINDAN_SELECTION);
}

export function shouldHandlePindanJoin(
  state: ConversationState,
  input: string,
  messages: ChatMessageDto[] = [],
): boolean {
  if (!isFindBuddyFlow(state)) return false;
  if (state.findBuddy?.phase !== 'browse_pindan') return false;

  const text = input.trim();
  const explicitSelection = isListSelectionInput(text, MAX_PINDAN_SELECTION);

  if (explicitSelection || /^[1-5]$/.test(text)) {
    if (isAwaitingActivitySelection(messages)) {
      return false;
    }
    return (state.findBuddy?.joinablePindanIds.length ?? 0) > 0;
  }

  return false;
}

function buildPindanCard(
  row: {
    legacyId?: number;
    type?: string;
    title?: string;
    subtitle?: string;
    date?: string;
    location?: string;
    price?: number;
    activityId?: string;
  },
): PindanJoinCardDto | undefined {
  if (row.legacyId == null) return undefined;

  const category =
    row.type === 'package' || row.type === 'hotel' || row.type === 'transport'
      ? row.type
      : 'package';

  return {
    legacyId: row.legacyId,
    category,
    title: row.title ?? '拼单',
    subtitle: row.subtitle,
    date: row.date ?? '',
    location: row.location ?? '',
    price: row.price ?? 0,
    activityId: row.activityId,
  };
}

function buildSuccessText(
  card: PindanJoinCardDto,
  activityName?: string,
): string {
  const meta = [card.date, card.location].filter(Boolean).join(' · ');
  return [
    '已成功加入拼单 🎉',
    '',
    `【${card.title}】${meta ? `（${meta}）` : ''}`,
    activityName ? `活动：${activityName}` : '',
    card.price ? `人均：¥${card.price}` : '',
    '',
    '点击下方卡片可跳转到拼单页查看详情。',
  ]
    .filter(Boolean)
    .join('\n');
}

async function resolveJoinableRows(
  messages: ChatMessageDto[],
  input: string,
  state: ConversationState,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
    profileService: ProfileService;
  },
  userId?: string,
) {
  const rows = await resolveThreadPindanRows(
    messages,
    input,
    services,
    userId,
    state,
  );
  const joinableRows = rows.filter(
    row => !row.userJoined && isPindanOpen(row),
  );

  const storedIds = state.findBuddy?.joinablePindanIds ?? [];
  if (!storedIds.length) {
    return joinableRows;
  }

  const rowMap = new Map(
    joinableRows
      .filter(row => row.legacyId != null)
      .map(row => [row.legacyId as number, row]),
  );

  return storedIds
    .map(id => rowMap.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function buildPindanJoinReply(
  messages: ChatMessageDto[],
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
    profileService: ProfileService;
  },
  context: { userId?: string; userName?: string },
  state: ConversationState,
): Promise<PindanJoinReplyResult | null> {
  if (!shouldHandlePindanJoin(state, input)) {
    return null;
  }

  const selectionIndex = parsePindanSelectionIndex(input);
  if (!selectionIndex) {
    return {
      text: '请告诉我想加入第几条拼单，例如「第一个」或「加入第 2 条」。',
      nextState: state,
    };
  }

  const joinableRows = await resolveJoinableRows(
    messages,
    input,
    state,
    services,
    context.userId,
  );

  if (!joinableRows.length) {
    const allRows = await resolveThreadPindanRows(
      messages,
      input,
      services,
      context.userId,
      state,
    );
    const joinedRows = allRows.filter(row => row.userJoined);
    if (joinedRows.length) {
      const card = buildPindanCard(joinedRows[0]);
      return {
        text: '你已有进行中的拼单，点击下方卡片可查看详情。',
        pindanCard: card,
        nextState: state,
      };
    }
    return {
      text: '当前没有可加入的拼单，请先告诉我活动名称我再帮你搜索。',
      nextState: state,
    };
  }

  const row = joinableRows[selectionIndex - 1];
  if (!row?.legacyId) {
    return {
      text: `只有 ${joinableRows.length} 条可加入拼单，请输入 1-${joinableRows.length} 之间的序号。`,
      nextState: setFindBuddyJoinableIds(
        state,
        joinableRows
          .map(item => item.legacyId)
          .filter((id): id is number => id != null),
      ),
    };
  }

  if (row.userJoined) {
    const card = buildPindanCard(row);
    return {
      text: '你已加入该拼单，点击下方卡片可查看详情。',
      pindanCard: card,
      nextState: state,
    };
  }

  try {
    await services.profileService.joinPindan(row.legacyId, context.userId);
  } catch (error) {
    if (error instanceof ConflictException) {
      const card = buildPindanCard(row);
      if (!card) {
        return { text: '你已加入该拼单，可在「我的拼单」或拼单页查看。', nextState: state };
      }
      return {
        text: '你已加入该拼单，点击下方卡片可查看详情。',
        pindanCard: card,
        nextState: state,
      };
    }
    if (error instanceof BadRequestException) {
      return {
        text: `「${row.title ?? '拼单'}」已满员，请选择其他拼单。`,
        nextState: state,
      };
    }
    throw error;
  }

  const card = buildPindanCard(row);
  if (!card) {
    return { text: '加入拼单成功，但卡片信息不完整，请稍后在拼单页查看。', nextState: state };
  }

  const activity = row.activityId
    ? await services.activityService.findByCode(row.activityId)
    : null;

  return {
    text: buildSuccessText(card, activity?.name),
    pindanCard: card,
    nextState: state,
  };
}
