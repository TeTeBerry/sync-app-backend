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
