import type { SetVoteLeaderboardEntry, SetVotePick } from './types';

export interface ActivityRegistrationResult {
  ok: true;
  activityLegacyId: number;
  status: 'registered';
  alreadyRegistered?: boolean;
  attendees: number;
}

export interface ActivityUnregisterResult {
  ok: true;
  activityLegacyId: number;
  wasRegistered?: boolean;
  attendees: number;
}

export interface ActivityWechatUpdateOptInResult {
  ok: true;
  activityLegacyId: number;
  wechatActivityUpdateOptIn: true;
}

export interface SetVoteSubmitResult {
  ok: true;
  activityLegacyId: number;
  picks: SetVotePick[];
  totalVoters: number;
  /** False when daily revote limit reached. */
  revoteAllowedToday?: boolean;
}

export interface SetVoteLeaderboardResult {
  activityLegacyId: number;
  totalVoters: number;
  entries: SetVoteLeaderboardEntry[];
  myPicks?: SetVotePick[];
}

export interface SetVoteMeResult {
  activityLegacyId: number;
  picks: SetVotePick[];
  updatedAt?: string;
  revoteAllowedToday?: boolean;
}
