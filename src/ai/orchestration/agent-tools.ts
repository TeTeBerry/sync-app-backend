/**
 * Agent tool registry for OrchestrationModule Handler 管道。
 * 发帖走 PostIntentService + AgentsModule，不在此注册。
 * @see src/ai/agents/
 */
export const ALL_AGENT_TOOLS = [] as const;

export const AGENT_IDS = ['text-parse', 'image-parse', 'risk'] as const;
