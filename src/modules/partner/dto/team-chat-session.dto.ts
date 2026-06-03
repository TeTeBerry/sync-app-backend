import type { PostBuddyPreviewDto } from './post-buddy-preview.dto';

export type TeamChatSessionDto = {
  sessionId: string;
  postId: string;
  applicantUserId: string;
  postTitle: string;
  activityLegacyId?: number;
  activityEndAt?: string;
  destroysAt?: string;
  peerUserId: string;
  peerName: string;
  peerAvatar?: string;
  buddyPreview: PostBuddyPreviewDto;
  lastMessage: string;
  lastMessageAt: string;
  /** Peer messages after last read (0 when caught up). */
  unreadCount: number;
  applicationStatus: 'pending' | 'accepted' | 'rejected';
  postRecruitmentStatus: '招募中' | '已组队' | '已隐藏';
  /** Whether the current user is the post owner. */
  isOwner: boolean;
};
