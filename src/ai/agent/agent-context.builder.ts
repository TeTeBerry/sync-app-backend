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
    '',
    activityBlock,
  ].join('\n');
}

/** @deprecated 保留给单测；运行时使用 buildAgentLlmMessages */
export function buildAgentContextBlock(params: {
  input: string;
  messages: ChatMessageDto[];
  activity?: Activity | null;
  conversationState: ConversationState;
}): string {
  const history = params.messages
    .slice(-CONTEXT_TURNS)
    .map((message) => `[${message.role}] ${message.content.trim()}`)
    .join('\n');

  return [
    buildAgentSessionContext(params),
    '',
    '【最近对话】',
    history || '(无)',
    '',
    '【用户最新消息】',
    params.input.trim(),
  ].join('\n');
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
    '你可以直接简短回复闲聊，也可以在需要查资料时调用工具。',
    '工具使用原则：',
    '- DJ/艺人/曲风/阵容/演出问题 → 调用 query_dj_info（服务端会结合多轮对话再解析）',
    '  - 上文刚聊某位艺人，用户说「近期演出」「代表作」「类似风格」等简短跟进 → 必须调工具，artistName 从上文取',
    '  - 不要把用户整句中文指令当作 artistName',
    '- 用户问音乐节档期/地点/阵容（风暴、EDC Thailand、Tomorrowland）→ get_festival_info',
    '- 用户已绑定活动且问「这场活动是什么」→ get_activity_brief',
    '- 简单寒暄、感谢、无查库需求 → 直接中文回复，不调工具',
    '多轮对话：用户说「类似风格」「他」「这个」等指代时，结合上文消息解析艺人/曲风后再调工具。',
    '不要帮用户发帖或搜组队帖（一期工具未开放）。',
    '回复使用简洁中文；艺名保留英文。',
  ].join('\n');
}
