import type { BuddySearchHintKind } from '../match/zone-buddy-search.util';

/** 路由后的顶层意图（决定 AiService 走哪条主链） */
export type ChatIntentKind =
  | 'search_posts'
  | 'create_post'
  | 'quick_reply'
  | 'activity_enter'
  | 'legacy_cascade';

export type ChatIntentSource = 'rule' | 'llm' | 'default';

export interface BuddySearchHintPayload {
  displayLabel: string;
  kind?: BuddySearchHintKind;
}

export interface ResolvedChatIntent {
  kind: ChatIntentKind;
  source: ChatIntentSource;
  /** 匹配检索时的 hint（规则或 LLM 给出） */
  buddySearchHint?: BuddySearchHintPayload;
}
