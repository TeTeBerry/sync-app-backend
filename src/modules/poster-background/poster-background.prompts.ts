export type PosterBackgroundKind =
  | 'set_vote'
  | 'personality_test'
  | 'recruit_post'
  | 'countdown';

const PERSONALITY_PROMPT_HINTS: Record<string, string> = {
  rager: '炽热红橙高能锐舞氛围，爆发感光影',
  connoisseur: '深邃蓝紫精致电子美学，层次感灯光',
  vibe_curator: '梦幻粉紫柔光派对氛围，流动霓虹',
  zen_raver: '宁静青绿冥想式电音空间，柔和雾气',
  documentarian: '复古胶片质感舞台纪实氛围，暖色散景',
};

const BASE_POSTER_STYLE =
  '抽象电音节视觉壁纸，无文字无人物面部无商标，适合作为手机海报背景，高清插画风格';

export function buildPosterBackgroundPrompt(input: {
  kind: PosterBackgroundKind;
  activityName?: string;
  personalityType?: string;
}): string {
  const eventHint = input.activityName?.trim()
    ? `，灵感来自电音节 ${input.activityName.trim()}`
    : '';

  if (input.kind === 'set_vote') {
    return `${BASE_POSTER_STYLE}，舞台灯光与激光，紫粉蓝霓虹色调，广角景深${eventHint}`.slice(
      0,
      500,
    );
  }

  if (input.kind === 'recruit_post') {
    return `${BASE_POSTER_STYLE}，公开组队招募氛围，霓虹舞台与人群剪影，紫粉色调，期待同行${eventHint}`.slice(
      0,
      500,
    );
  }

  if (input.kind === 'countdown') {
    return `${BASE_POSTER_STYLE}，大节开场前期待感，光束与烟雾，暖色舞台远景${eventHint}`.slice(
      0,
      500,
    );
  }

  const hint =
    PERSONALITY_PROMPT_HINTS[input.personalityType?.trim() ?? ''] ??
    '多彩霓虹电音派对氛围';
  return `${BASE_POSTER_STYLE}，${hint}`.slice(0, 500);
}

export function posterBackgroundSize(_kind: PosterBackgroundKind): string {
  return '720x1280';
}

export function buildPosterBackgroundCacheKey(input: {
  kind: PosterBackgroundKind;
  activityLegacyId?: number;
  personalityType?: string;
}): string {
  if (input.kind === 'set_vote') {
    return `set_vote:${input.activityLegacyId ?? 0}`;
  }
  if (input.kind === 'recruit_post') {
    return `recruit_post:${input.activityLegacyId ?? 0}`;
  }
  if (input.kind === 'countdown') {
    return `countdown:${input.activityLegacyId ?? 0}`;
  }
  return `personality:${input.personalityType?.trim() || 'default'}`;
}
