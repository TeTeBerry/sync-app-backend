import type { CurrentUser } from './types';

export interface AuthLoginResult {
  accessToken: string;
  user: CurrentUser;
}

export interface ProfileSummary {
  name: string;
  handle: string;
  location: string;
  bio: string;
  avatar: string;
  stats: {
    /** Total activities in 我的活动 (including ended). */
    events: number;
    /** Subset of events that have not ended yet. */
    ongoingEvents: number;
    posts: number;
  };
}

export interface ProfileActivityItem {
  id: string;
  title: string;
  date: string;
  location: string;
  image: string;
  status: 'registered' | 'attended';
  activityLegacyId: string;
}
