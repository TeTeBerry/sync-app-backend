/**
 * Platform-wide free tier (all registered users).
 *
 * - AI 智能匹配 and 联系方式解锁: monthly quota, reset each calendar month (UTC).
 * - 基础组队、发帖、沟通: permanently free — not gated by package or quota
 *   (enforced in product; no paywall in post/team/chat flows).
 * - Paid per-event tiers (pro / pro_plus / ultra) are optional upgrades.
 */

export const FREE_MONTHLY_AI_MATCH_LIMIT = 3;
export const FREE_MONTHLY_CONTACT_UNLOCK_LIMIT = 3;

export const FREE_TIER_ID = 'free' as const;
export const FREE_TIER_NAME = '免费版';
