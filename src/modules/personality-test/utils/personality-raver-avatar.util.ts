import type { PersonalityTestResult } from '../personality-test.types';
import { RAVER_AVATAR_ASSET_KEYS } from '../data/personality-avatar-catalog';

function pickRandom<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[Math.min(Math.max(index, 0), items.length - 1)]!;
}

export function generatePersonalityRaverAvatarKey(
  random: () => number = Math.random,
): string {
  return pickRandom(RAVER_AVATAR_ASSET_KEYS, random);
}

export function isRaverAvatarAssetKeyInCatalog(key: string): boolean {
  return (RAVER_AVATAR_ASSET_KEYS as readonly string[]).includes(key);
}

export function ensurePersonalityResultAvatar(
  result: PersonalityTestResult,
): PersonalityTestResult {
  const existing = result.raverAvatarKey?.trim();
  if (existing && isRaverAvatarAssetKeyInCatalog(existing)) {
    return result.raverAvatarKey === existing
      ? result
      : { ...result, raverAvatarKey: existing };
  }

  return {
    ...result,
    raverAvatarKey: generatePersonalityRaverAvatarKey(),
  };
}
