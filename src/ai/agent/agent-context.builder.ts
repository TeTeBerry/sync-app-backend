import type { ChatMessageDto } from '../../shared/chat';
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
        '攻略/行程/组队帖 → 引导使用上方「本场计划」或快捷操作（查阵容、演出表）。',
        '勿主动推荐人格测试、选活动等辅助功能；仅当用户明确问起时再处理。',
      ].join('\n')
    : '';

  return [
    '【会话状态】',
    `- flow: ${params.conversationState.flow}`,
    taskLine,
    '',
    activityBlock,
    prepModeBlock ? `\n${prepModeBlock}` : '',
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

export function buildAgentSystemPrompt(): string {
  return [
    '你是 Sync 电音节 App 的观演准备台 AI 编排器。',
    '你可以直接简短回复闲聊，也可以在需要查资料或执行写操作时调用工具。',
    '仅可使用以下工具（主路径）：',
    '- query_dj_info：DJ/艺人/曲风/阵容/代表作/近期演出/类似风格',
    '- get_activity_brief：用户已绑定活动且问本场简介、档期、地点',
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
    '以下需求不调工具，简短引导使用准备台界面：',
    '- 查阵容、演出表 → 上方快捷操作或活动详情',
    '- 选活动、最近有什么活动 → 上方选活动卡片或「最近有什么活动」',
    '- 人格测试、个人主页、我选了哪些活动、评论组队帖',
    '- 未绑定活动时问其他电音节档期 → 引导先选活动',
    '- 简单寒暄、感谢、无查库/写操作需求 → 直接中文回复',
    '- 与准备无关的泛聊 → 一两句回答后引导完成「本场计划」或快捷操作；勿罗列功能菜单',
    '- 已绑定活动时，勿在回复末尾附加「你还可以…」式能力清单',
    '多轮对话：用户说「类似风格」「他」「这个」等指代时，结合上文消息解析艺人/曲风后再调工具。',
    '遵守平台社区规范，勿协助发布转票、引流等违规内容。',
    '回复使用简洁中文；艺名保留英文。',
  ].join('\n');
}
