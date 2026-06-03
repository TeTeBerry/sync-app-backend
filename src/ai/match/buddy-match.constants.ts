/** Max buddy post recommendations returned to the client (Chroma recall may be higher). */
export const BUDDY_RECOMMEND_LIMIT = 3;

/** Max characters shown on a recommended-post card in chat. */
export const BUDDY_RECOMMEND_CARD_SNIPPET_MAX = 56;

/** Blended ranking after LLM rerank (higher = better). */
export const MATCH_RERANK_SLOT_WEIGHT = 10;
export const MATCH_PROFILE_RULE_WEIGHT = 120;
export const MATCH_PROFILE_VECTOR_WEIGHT = 80;
