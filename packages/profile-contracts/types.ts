export type PrivacyLevel = 'public' | 'private';

export type AccountRiskStatus = 'normal' | 'restricted' | 'banned';

export type AccountRiskReasonCode = 'scalper' | 'content' | 'reports';

export interface AccountRiskPublicStatus {
  status: AccountRiskStatus;
  postBlockedUntil?: string;
  message?: string;
  reasonCode?: AccountRiskReasonCode;
  appealHint?: string;
}

/** Current user profile (`GET/PATCH /api/users/me`). */
export interface CurrentUser {
  id: string;
  name: string;
  handle: string;
  location: string;
  bio: string;
  avatar: string;
  city?: string;
  favorGenres?: string[];
  budgetLevel?: string;
  notificationsEnabled?: boolean;
  privacyLevel?: PrivacyLevel;
  accountRisk?: AccountRiskPublicStatus;
}

export interface UpdateCurrentUserPayload {
  name?: string;
  handle?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  city?: string;
  favorGenres?: string[];
  budgetLevel?: string;
  notificationsEnabled?: boolean;
  privacyLevel?: PrivacyLevel;
}
