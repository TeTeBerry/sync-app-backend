import type { PostBuddyPreviewDto } from './post-buddy-preview.dto';

export type PostApplicationItemDto = {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: string;
  /** ISO time when post owner opened chat from profile posts. */
  ownerOpenedChatAt?: string;
  buddyPreview?: PostBuddyPreviewDto;
};
