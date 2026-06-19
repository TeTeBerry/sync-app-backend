export type PrivacyLevel = 'public' | 'private';

/** Legacy DB rows may still read `friends` before migration — treat as private. */
export function normalizePrivacyLevel(
  privacyLevel: string | undefined,
): PrivacyLevel {
  if (privacyLevel === 'private' || privacyLevel === 'friends') {
    return 'private';
  }
  return 'public';
}

export function canViewPersonalInfo(
  privacyLevel: PrivacyLevel | string | undefined,
  isOwner: boolean,
  isBuddy: boolean,
): boolean {
  if (isOwner) return true;
  const level = normalizePrivacyLevel(privacyLevel);
  if (level === 'public') return true;
  void isBuddy;
  return false;
}
