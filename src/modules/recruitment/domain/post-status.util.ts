import type { PostStatus } from '../../../database/schemas/post.schema';

/**
 * 帖子招募状态：
 *
 * recruiting（招募中）— 默认
 * completed（已完成 / 前端展示「已组队」）— 组队成功或手动标记
 */

export type PostRecruitmentCloseReason = 'buddy_teamed' | 'owner_manual';

export type PostRecruitmentReopenReason =
  | 'owner_reopen_recruiting'
  | 'mutual_team_dissolved';

export function isPostRecruiting(status?: PostStatus | string): boolean {
  return !status || status === 'recruiting';
}

export function isRecruitmentClosed(status?: PostStatus | string): boolean {
  return status === 'completed' || status === 'hidden';
}
