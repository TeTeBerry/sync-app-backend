export type PrivacyLevel = 'public' | 'friends' | 'private';

export function canViewPersonalInfo(
  privacyLevel: PrivacyLevel | undefined,
  isOwner: boolean,
  isBuddy: boolean,
): boolean {
  if (isOwner) return true;
  const level = privacyLevel ?? 'public';
  if (level === 'public') return true;
  if (level === 'friends') return isBuddy;
  return false;
}
