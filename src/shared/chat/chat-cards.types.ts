export type RecommendedPostAuthorGender = 'female' | 'male';

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

export interface RecommendedActivityCard {
  activityLegacyId: number;
  title: string;
  date?: string;
  venue?: string;
}
