/** 路由后的顶层意图（决定 AiService 走哪条主链） */
export type ChatIntentKind = 'quick_reply' | 'activity_enter' | 'dj_info';

export type ChatIntentSource = 'rule' | 'llm' | 'default';

export interface ResolvedChatIntent {
  kind: ChatIntentKind;
  source: ChatIntentSource;
}
