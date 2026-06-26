import type { PostRecruitStatus, PostStatus } from './types';
import type { RecruitUnityTagId } from './recruit-unity-tags';

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
  recruitUnityTags?: RecruitUnityTagId[];
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
  unityTags?: RecruitUnityTagId[];
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

export type RecommendedPostAuthorGender = 'female' | 'male';

/** Compact post card shown after buddy-post publish / feed highlights. */
export interface RecommendedPostCard {
  postId: string;
  snippet: string;
  authorName: string;
  authorHandle?: string;
  authorAvatar?: string;
  authorGender?: RecommendedPostAuthorGender;
  eventTitle: string;
  location?: string;
  tags?: string[];
  activityLegacyId?: number;
}
