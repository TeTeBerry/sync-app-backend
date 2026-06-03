/** Structured fields used for buddy post matching (stored on Post + Chroma metadata). */
export type BuddyMatchIntent =
  | 'carpool' // 交通：拼车、顺风车、包车
  | 'lodging' // 住宿：拼房、酒店、民宿
  | 'team' // 通用组队/搭子（兜底）
  | 'ticket' // 票务：内场、看台、区、票
  | 'food' // 吃饭：宵夜、夜宵、聚餐、吃饭、美食、烧烤
  | 'social'; // 社交：喝酒、蹦迪、派对、afterparty

export interface BuddyMatchCriteria {
  activityLegacyId: number;
  activityName?: string;
  activityCode?: string;
  departureCity?: string;
  eventDate?: string;
  zone?: string;
  headcount?: number;
  genderPref?: string;
  intents?: BuddyMatchIntent[];
  /** Hashtags / labels from requester post or conversation (#拼车, 组队, etc.) */
  requesterTags?: string[];
  /** Requester recruiting post body — reference for content overlap ranking */
  requesterBody?: string;
  /** Post ids that must never be recommended back (e.g. criteria seed owner post) */
  excludePostIds?: string[];
  /** AI shortcut chip the user tapped (找拼车 / 找拼房 / 找队友 …) */
  searchShortcutTag?: string;
  /** Persisted user profile — enriches embedding / rerank when no recruiting post body */
  profileFavorGenres?: string[];
  profileBudgetLevel?: string;
  profileLikeMate?: boolean;
}
