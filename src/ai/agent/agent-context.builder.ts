import type { ChatMessageDto } from '@sync/chat-contracts';
import type { Activity } from '../../database/schemas/activity.schema';
import type { ConversationState } from '../conversation';
import type { OpenAiChatMessage } from './agent-llm.service';
import { CHAT_LLM_CONTEXT_TURNS } from '../../modules/chat/chat.service';

const CONTEXT_TURNS = CHAT_LLM_CONTEXT_TURNS;

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

  const activityBound = params.activity != null;
  const activeTask = params.conversationState.activeTask;
  let taskLine = '';
  if (activeTask?.kind === 'travel_guide') {
    const s = activeTask.travelGuide;
    const filled = [
      s.departure && `出发地=${s.departure}`,
      s.headcount != null && `人数=${s.headcount}`,
      s.budgetTier && `预算=${s.budgetTier}`,
    ].filter(Boolean);
    taskLine = `- activeTask: travel_guide [${filled.join('; ')}]`;
  } else if (activeTask?.kind === 'itinerary') {
    const s = activeTask.itinerary;
    taskLine = `- activeTask: itinerary [dj=${s.selectedDjIds?.length ?? 0}个]`;
  }

  const prepModeBlock = activityBound
    ? [
        '【准备台模式】',
        '用户已绑定活动。回复保持简短，勿罗列功能菜单。',
        '查节/阵容 → 调用 get_activity_brief 或 query_dj_info。',
        '找公开招募帖 → 引导用户点「找招募帖」或去活动详情招募区搜索；勿在对话内检索帖子。',
        '勿主动推荐人格测试、选活动等辅助功能；仅当用户明确问起时再处理。',
      ].join('\n')
    : [
        '【查节模式】',
        '用户未绑定活动。问某场电音节档期/地点/阵容 → 调用 get_festival_info。',
        '找队 → 引导去活动 Tab 或活动详情公开招募区；勿表述为智能配对。',
      ].join('\n');

  return [
    '【会话状态】',
    `- flow: ${params.conversationState.flow}`,
    taskLine,
    '',
    activityBlock,
    `\n${prepModeBlock}`,
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
    buildAgentSystemPrompt(params.activity != null),
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
    const rawContent = message.content?.trim();
    if (!rawContent) {
      continue;
    }
    const content =
      rawContent.length > 1200
        ? rawContent.slice(0, 1200) + '…[截断]'
        : rawContent;
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

export function buildAgentSystemPrompt(activityBound = false): string {
  const catalogTools = activityBound
    ? []
    : [
        '- get_festival_info：未绑活动时查电音节档期、地点、官宣阵容（风暴、EDC、Tomorrowland 等）',
      ];
  const boundTools = activityBound
    ? ['- get_activity_brief：用户已绑定活动且问本场简介、档期、地点']
    : [];

  return [
    '你是 Sync 电音节 App 的 AI 助手，帮助用户查电音节资讯与浏览公开组队招募。',
    '你可以直接简短回复闲聊，也可以在需要查资料或执行写操作时调用工具。',
    '仅可使用以下工具（主路径）：',
    '- query_dj_info：DJ/艺人/曲风/阵容/代表作/近期演出/类似风格',
    ...boundTools,
    ...catalogTools,
    '- travel_guide_collect_slots：出行攻略（解析出发地/人数/预算；齐全则自动生成）',
    '- travel_guide_generate：槽位已齐时生成攻略（通常由 collect_slots 触发）',
    '- itinerary_collect_and_generate：专属行程（解析 DJ 名称并生成）',
    '- itinerary_generate：已明确 selectedDjIds 时生成行程',
    '- post_start_collect → post_submit → post_confirm_publish：组队发帖流程',
    '工具使用原则：',
    '- 上文刚聊某位艺人，用户说「近期演出」「代表作」「类似风格」等简短跟进 → 必须调 query_dj_info，artistName 从上文取',
    '- 不要把用户整句中文指令当作 artistName',
    '- activeTask 为 travel_guide 时，用户补充槽位仍应调用 travel_guide_collect_slots',
    '- activeTask 为 itinerary 时，用户补充 DJ 名称仍应调用 itinerary_collect_and_generate',
    '- 写操作工具返回 terminal 结果时，以工具结果为准，勿重复编造发帖/攻略结果',
    activityBound
      ? '- 已绑定活动问本场档期/简介 → get_activity_brief；问阵容/DJ → query_dj_info'
      : '- 未绑定活动问某节档期/阵容 → get_festival_info（festivalName 取用户提到的节名）',
    activityBound
      ? '以下需求不调工具，简短引导：'
      : '以下需求不调工具，简短引导：',
    activityBound
      ? '- 找队/公开招募 → 活动详情招募区搜索条，或点「找招募帖」跳转（勿称智能配对）'
      : '- 找队/招募 → 活动 Tab 或活动详情公开招募区（勿称智能配对）',
    '- 选活动 → 上方选活动卡片',
    '- 人格测试、个人主页、评论组队帖',
    '- 简单寒暄、感谢、无查库/写操作需求 → 直接中文回复',
    '- 已绑定活动时，勿在回复末尾附加「你还可以…」式能力清单',
    '多轮对话：用户说「类似风格」「他」「这个」等指代时，结合上文消息解析艺人/曲风后再调工具。',
    '遵守平台社区规范，勿协助发布转票、引流等违规内容。',
    '回复使用简洁中文；艺名保留英文。查节回答尾注可加「仅供参考，以主办方为准」。',
  ].join('\n');
}
