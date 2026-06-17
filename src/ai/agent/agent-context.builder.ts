import type { ChatMessageDto } from '../../shared/chat';
import type { Activity } from '../../database/schemas/activity.schema';
import type { ConversationState } from '../conversation';
import type { OpenAiChatMessage } from './agent-llm.service';

const CONTEXT_TURNS = 8;

export function buildAgentSessionContext(params: {
  activity?: Activity | null;
  conversationState: ConversationState;
}): string {
  const activityBlock =
    params.activity != null
      ? [
          '当前绑定活动：',
          `- legacyId: ${params.activity.legacyId}`,
          `- 名称：${params.activity.name ?? '未知'}`,
          `- 日期：${params.activity.date ?? '未知'}`,
          `- 地点：${params.activity.location ?? '未知'}`,
        ].join('\n')
      : '当前未绑定具体活动（首页或未选活动场景）。';

  return [
    '【会话状态】',
    `- flow: ${params.conversationState.flow}`,
    params.conversationState.activeTask?.kind === 'travel_guide'
      ? `- activeTask: travel_guide slots=${JSON.stringify(params.conversationState.activeTask.travelGuide)}`
      : '',
    params.conversationState.activeTask?.kind === 'itinerary'
      ? `- activeTask: itinerary slots=${JSON.stringify(params.conversationState.activeTask.itinerary)}`
      : '',
    '',
    activityBlock,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildAgentLlmMessages(params: {
  input: string;
  messages: ChatMessageDto[];
  activity?: Activity | null;
  conversationState: ConversationState;
}): OpenAiChatMessage[] {
  const systemContent = [
    buildAgentSystemPrompt(),
    '',
    buildAgentSessionContext(params),
  ].join('\n');

  const llmMessages: OpenAiChatMessage[] = [
    { role: 'system', content: systemContent },
  ];

  const history = params.messages.slice(-CONTEXT_TURNS);
  for (const message of history) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }
    const content = message.content?.trim();
    if (!content) {
      continue;
    }
    llmMessages.push({ role: message.role, content });
  }

  const trimmedInput = params.input.trim();
  const lastMessage = llmMessages[llmMessages.length - 1];
  if (
    trimmedInput &&
    (!lastMessage ||
      lastMessage.role !== 'user' ||
      lastMessage.content !== trimmedInput)
  ) {
    llmMessages.push({ role: 'user', content: trimmedInput });
  }

  return llmMessages;
}

export function buildAgentSystemPrompt(): string {
  return [
    '你是 Sync 电音节 App 的 AI 助手编排器。',
    '你可以直接简短回复闲聊，也可以在需要查资料或执行写操作时调用工具。',
    '工具使用原则：',
    '- DJ/艺人/曲风/阵容/演出问题 → 调用 query_dj_info（服务端会结合多轮对话再解析）',
    '  - 上文刚聊某位艺人，用户说「近期演出」「代表作」「类似风格」等简短跟进 → 必须调工具，artistName 从上文取',
    '  - 不要把用户整句中文指令当作 artistName',
    '- 用户问音乐节档期/地点/阵容（风暴、EDC Thailand、Tomorrowland）→ get_festival_info',
    '- 用户已绑定活动且问「这场活动是什么」→ get_activity_brief',
    '- 用户想发组队帖（已绑定活动）→ post_start_collect；用户给出正文后 → post_submit；确认发布 → post_confirm_publish',
    '- 用户要出行攻略/规划行程/说出发地人数预算 → travel_guide_collect_slots（解析并合并参数；齐全则自动生成）',
    '- activeTask 为 travel_guide 时，用户补充槽位仍应调用 travel_guide_collect_slots',
    '- 用户问「我的报名/个人主页/我报了哪些活动」→ profile_get_summary 或 profile_list_registrations',
    '- 用户要报名/取消报名当前活动 → activity_register / activity_unregister',
    '- 用户问 Raver 人格测试/我的测试结果 → personality_test_get_result；想做测试 → personality_test_open',
    '- 用户要看演出表/阵容日程 → itinerary_get_schedule；要生成专属行程/选 DJ → itinerary_collect_and_generate',
    '- activeTask 为 itinerary 时，用户补充 DJ 名称仍应调用 itinerary_collect_and_generate',
    '- 用户要评论某条组队帖 → post_add_comment（需 postId）；查看评论 → post_list_comments',
    '- 简单寒暄、感谢、无查库/写操作需求 → 直接中文回复，不调工具',
    '多轮对话：用户说「类似风格」「他」「这个」等指代时，结合上文消息解析艺人/曲风后再调工具。',
    '写操作工具返回 terminal 结果时，以工具结果为准，勿重复编造发帖/攻略结果。',
    '遵守平台社区规范，勿协助发布转票、引流等违规内容。',
    '回复使用简洁中文；艺名保留英文。',
  ].join('\n');
}
