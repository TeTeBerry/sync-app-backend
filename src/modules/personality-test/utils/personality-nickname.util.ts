import type {
  PersonalityTestResult,
  RaverPersonalityType,
} from '../personality-test.types';

export const PERSONALITY_NICKNAME_PREFIXES = [
  '小',
  '阿',
  'Q',
  '萌',
  '老',
] as const;

export const PERSONALITY_NICKNAME_SUFFIXES = [
  '酱',
  '君',
  '宝',
  '崽',
  '儿',
] as const;

export const PERSONALITY_NICKNAME_CORES: Record<
  RaverPersonalityType,
  readonly string[]
> = {
  rager: ['拳皇', 'DROP', '硬好', '贝斯', '前排'],
  connoisseur: ['滤波', '铁克诺', '特兰斯', '琶音'],
  vibe_curator: ['浩室', '气氛', '闪片', '舞池', '霓虹'],
  zen_raver: ['氛围', '后排', '佛系', '缓拍', '霓'],
  documentarian: ['快门', '转场', '录现', '镜头', '切片'],
};

export const PERSONALITY_NICKNAME_ID_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const PERSONALITY_NICKNAME_ID_SUFFIX_LENGTH = 4;

export const PERSONALITY_NICKNAME_ID_SUFFIX_PATTERN = /[A-Z0-9]{4}$/;

function pickRandom<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[Math.min(Math.max(index, 0), items.length - 1)]!;
}

function pickRandomChar(chars: string, random: () => number): string {
  const index = Math.floor(random() * chars.length);
  return chars.charAt(Math.min(Math.max(index, 0), chars.length - 1));
}

export function generatePersonalityNicknameIdSuffix(
  random: () => number = Math.random,
  length: number = PERSONALITY_NICKNAME_ID_SUFFIX_LENGTH,
): string {
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    suffix += pickRandomChar(PERSONALITY_NICKNAME_ID_CHARS, random);
  }
  return suffix;
}

export function generatePersonalityNickname(
  primaryType: RaverPersonalityType,
  random: () => number = Math.random,
): string {
  const cores = PERSONALITY_NICKNAME_CORES[primaryType];
  const prefix = pickRandom(PERSONALITY_NICKNAME_PREFIXES, random);
  const core = pickRandom(cores, random);
  const suffix = pickRandom(PERSONALITY_NICKNAME_SUFFIXES, random);
  const idSuffix = generatePersonalityNicknameIdSuffix(random);
  return `${prefix}${core}${suffix}${idSuffix}`;
}

export function isCurrentPersonalityNicknameFormat(nickname: string): boolean {
  const trimmed = nickname.trim();
  if (!trimmed) {
    return false;
  }
  return PERSONALITY_NICKNAME_ID_SUFFIX_PATTERN.test(trimmed);
}

export function isValidPersonalityRaverNicknameQuery(
  nickname: string,
): boolean {
  const trimmed = nickname.trim();
  if (!trimmed || trimmed.length > 32) {
    return false;
  }
  return /^[\u4e00-\u9fa5A-Za-z0-9]+$/.test(trimmed);
}

export function ensurePersonalityResultNickname(
  result: PersonalityTestResult,
): PersonalityTestResult {
  const existing = result.raverNickname?.trim();
  if (existing && isCurrentPersonalityNicknameFormat(existing)) {
    return result.raverNickname === existing
      ? result
      : { ...result, raverNickname: existing };
  }

  return {
    ...result,
    raverNickname: generatePersonalityNickname(result.score.primaryType),
  };
}
