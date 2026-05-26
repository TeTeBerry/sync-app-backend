import { ChatMessageDto } from '../presentation/chat-message.dto';
import { type ConversationState } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import {
  isActivityKeywordInput,
  parseConversationContext,
} from './conversation-context.parser';
import { loadPindanRowsForReply } from './pindan-reply.util';

type PindanRow = Awaited<
  ReturnType<PindanService['searchForActivity']>
>[number];

export async function resolveThreadPindanCandidates(
  messages: ChatMessageDto[],
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
  },
  conversationState?: ConversationState,
): Promise<PindanRow[]> {
  const ctx = parseConversationContext(messages, input);
  const activity =
    (conversationState?.findBuddy?.activityId
      ? await services.activityService.findByCode(
          conversationState.findBuddy.activityId,
        )
      : null) ??
    (ctx.activityId
      ? await services.activityService.findByCode(ctx.activityId)
      : null) ??
    (ctx.activityKeyword
      ? await services.activityService.matchActivity(ctx.activityKeyword)
      : null) ??
    (conversationState?.findBuddy?.activityKeyword
      ? await services.activityService.matchActivity(
          conversationState.findBuddy.activityKeyword,
        )
      : null);

  const activityRef =
    activity?.code ??
    conversationState?.findBuddy?.activityId ??
    ctx.activityId ??
    ctx.activityKeyword ??
    input.trim();

  if (ctx.activityPickerIndex && !activity) {
    const activities = await services.activityService.findAll();
    const picked = activities[ctx.activityPickerIndex - 1];
    if (picked) {
      return services.pindanService.searchForActivity(picked.code);
    }
  }

  if (activity || ctx.activityId || isActivityKeywordInput(input)) {
    return services.pindanService.searchForActivity(activityRef);
  }

  return services.pindanService.searchFromQuery({});
}

/** 结伴流程上下文可用的拼单列表（进行中 + 用户已加入） */
export async function resolveThreadPindanRows(
  messages: ChatMessageDto[],
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
    profileService: ProfileService;
  },
  userId?: string,
  conversationState?: ConversationState,
) {
  const candidates = await resolveThreadPindanCandidates(
    messages,
    input,
    services,
    conversationState,
  );
  return loadPindanRowsForReply(candidates, services, userId);
}
