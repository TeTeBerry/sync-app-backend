import type { MarketingPlatform } from '../dto/generate-platform-content.dto';
import { instagramPrompt } from './instagram.prompt';
import { redditPrompt } from './reddit.prompt';
import type { PlatformPromptBundle } from './prompt-builder.types';
import { threadsPrompt } from './threads.prompt';
import { tiktokPrompt } from './tiktok.prompt';
import { seoPrompt } from './seo.prompt';
import { xFounderPrompt } from './x-founder.prompt';

const PROMPT_BY_PLATFORM: Record<MarketingPlatform, PlatformPromptBundle> = {
  threads: threadsPrompt,
  instagram: instagramPrompt,
  tiktok: tiktokPrompt,
  seo: seoPrompt,
  x: xFounderPrompt,
  reddit: redditPrompt,
};

export function resolvePlatformPrompt(
  platform: MarketingPlatform,
): PlatformPromptBundle {
  return PROMPT_BY_PLATFORM[platform];
}

export {
  threadsPrompt,
  instagramPrompt,
  tiktokPrompt,
  seoPrompt,
  xFounderPrompt,
  redditPrompt,
};
