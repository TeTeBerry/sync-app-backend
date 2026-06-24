import type { PostRecruitStatus, PostStatus } from './types';

export interface EventDetailPost {
  id: string;
  userId?: string;
  name: string;
  handle?: string;
  location: string;
  departureCity?: string;
  createdAt?: string;
  body?: string;
  bodyPreview?: string;
  tags: string[];
  avatar: string;
  comments?: number;
  status?: PostStatus;
  moderationReason?: string;
  recruitStatus?: PostRecruitStatus;
  slotsTotal?: number;
  slotsFilled?: number;
}

export interface PostCommentItem {
  id: string;
  userId: string;
  authorName: string;
  avatar: string;
  body: string;
  time: string;
  replies?: PostCommentItem[];
}

export interface EventPostsPage {
  items: EventDetailPost[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface PostCommentsPage {
  items: PostCommentItem[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ProfilePostItem {
  id: string;
  title: string;
  content?: string;
  contentPreview?: string;
  date: string;
  activityLegacyId?: number;
}

export interface ProfilePostsPage {
  items: ProfilePostItem[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface BuddyPostSearchParsed {
  departureCity?: string;
  eventName?: string;
  date?: string;
  genre?: string;
  peopleCount?: string;
  extraKeywords?: string[];
  preferOpenRecruit?: boolean;
  searchTerms: string[];
}

export interface BuddyPostAiSearchResult {
  parsed: BuddyPostSearchParsed;
  items: EventDetailPost[];
  totalMatched: number;
  totalScanned: number;
}

export type BuddyPostComposeCandidateStyle = 'code' | 'slogan';

export interface BuddyPostComposeCandidate {
  id: string;
  text: string;
  style?: BuddyPostComposeCandidateStyle;
}

export interface BuddyPostAiComposeResult {
  candidates: BuddyPostComposeCandidate[];
  disclaimer: string;
  aiGenerated: true;
}
