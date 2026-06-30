export type NotificationType = 'general' | 'interaction' | 'system';

/** High-level push category for NoticeAgent routing and client grouping. */
export type NotificationCategory = 'system' | 'general';

/** Deep-link hint for notifications. Includes deprecated `like` for stored meta parsing. */
export type NotificationInteractionType =
  | 'like'
  | 'comment'
  | 'comment_reply'
  | 'activity'
  | 'activity_update'
  | 'proactive_nudge'
  | 'post_rejected'
  | 'post_hidden';

export interface NotificationMeta {
  /** Tab grouping; should match type (see notificationDisplay.getNotificationCategory). */
  category?: NotificationCategory;
  activityLegacyId?: number;
  postId?: string;
  type?: NotificationInteractionType;
  actorUserId?: string;
  actorUserName?: string;
  /** Client display label for activity-related notifications. */
  displayEventName?: string;
  templateKey?: string;
  templateParams?: Record<string, string>;
  rejectionReason?: string;
  parentCommentId?: string;
  /** Activity update summary (e.g. `地点已更新为 …`) for dedupe / display. */
  changeSummary?: string;
  /** Proactive nudge rule id (N1–N4). */
  nudgeRule?: string;
  prefillQuery?: string;
  openBuddyPost?: boolean;
  openLineup?: boolean;
  focusPosts?: boolean;
}
