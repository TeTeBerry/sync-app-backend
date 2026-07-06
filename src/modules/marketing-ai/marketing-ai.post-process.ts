import type { MarketingPlatform } from './dto/generate-platform-content.dto';
import type {
  InstagramCarouselSlide,
  LlmPlatformContentPayload,
  PlatformContentResult,
} from './marketing-ai.types';
import type {
  AspectRatio,
  VisualBrief,
  VisualType,
} from './marketing-ai.visual-brief.types';
import { TEXT_ONLY_VISUAL_BRIEF } from './marketing-ai.visual-brief.types';

export const X_CONTENT_STYLE = 'founder-build-in-public';
export const X_MAX_LENGTH = 280;

export const X_PROMOTIONAL_PATTERNS: RegExp[] = [
  /\bdiscover raven\b/i,
  /\bjoin raven\b/i,
  /\btry raven\b/i,
  /\bplan your next festival\b/i,
  /\bdownload\b/i,
  /\bsign up now\b/i,
  /\bplan smarter with\b/i,
  /\bsign up\b/i,
];

export function isPromotionalXContent(content: string): boolean {
  return X_PROMOTIONAL_PATTERNS.some((pattern) => pattern.test(content));
}

export function truncateXContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= X_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, X_MAX_LENGTH - 1).trimEnd()}…`;
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function isVisualType(value: unknown): value is VisualType {
  return (
    value === 'carousel' ||
    value === 'single-image' ||
    value === 'reel' ||
    value === 'short-video' ||
    value === 'text-only'
  );
}

function isAspectRatio(value: unknown): value is AspectRatio {
  return (
    value === '1:1' || value === '4:5' || value === '9:16' || value === '16:9'
  );
}

function resolvePlannerContentType(
  festival: Record<string, unknown>,
): string | undefined {
  const plannerType = festival.plannerContentType;
  return typeof plannerType === 'string' ? plannerType : undefined;
}

const DEFAULT_INSTAGRAM_PUBLISH_TIME = '18:30 GMT+7';
const INSTAGRAM_CAROUSEL_SLIDE_COUNT = 5;

function festivalName(festival: Record<string, unknown>): string {
  return typeof festival.name === 'string' ? festival.name : 'Festival';
}

function normalizeCarouselSlides(
  value: LlmPlatformContentPayload['carousel'],
): InstagramCarouselSlide[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((slide, index) => {
      const slideNumber =
        typeof slide?.slide === 'number' && slide.slide > 0
          ? slide.slide
          : index + 1;
      const headline = slide?.headline?.trim() ?? '';
      const body = slide?.body?.trim() ?? '';
      if (!headline && !body) {
        return null;
      }
      return { slide: slideNumber, headline, body };
    })
    .filter((slide): slide is InstagramCarouselSlide => slide !== null)
    .slice(0, INSTAGRAM_CAROUSEL_SLIDE_COUNT);
}

function buildInstagramCarouselFromVisualBrief(
  visualBrief: VisualBrief | undefined,
  title: string,
  content: string,
  festival: Record<string, unknown>,
): InstagramCarouselSlide[] {
  const name = festivalName(festival);
  const paragraphs = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const overlayLines = visualBrief?.overlayText ?? [];
  const layoutLines =
    visualBrief?.designLayout
      ?.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];

  const slides: InstagramCarouselSlide[] = [];

  for (let index = 0; index < INSTAGRAM_CAROUSEL_SLIDE_COUNT; index += 1) {
    const slideNumber = index + 1;
    const headline =
      overlayLines[index] ||
      layoutLines[index]?.replace(/^slide\s*\d+\s*[:：-]?\s*/i, '') ||
      (index === 0
        ? title || `${name} Guide`
        : `${name} — Part ${slideNumber}`);
    const body =
      paragraphs[index] ||
      paragraphs[paragraphs.length - 1] ||
      content.slice(0, 220);

    slides.push({
      slide: slideNumber,
      headline: headline.slice(0, 120),
      body: body.slice(0, 500),
    });
  }

  return slides;
}

export function buildInstagramPublishingFields(
  payload: LlmPlatformContentPayload,
  festival: Record<string, unknown>,
  title: string,
  content: string,
  visualBrief: VisualBrief | undefined,
): Pick<PlatformContentResult, 'publishTime' | 'carousel'> {
  const carousel =
    normalizeCarouselSlides(payload.carousel).length > 0
      ? normalizeCarouselSlides(payload.carousel)
      : buildInstagramCarouselFromVisualBrief(
          visualBrief,
          title,
          content,
          festival,
        );

  return {
    publishTime: payload.publishTime?.trim() || DEFAULT_INSTAGRAM_PUBLISH_TIME,
    carousel,
  };
}

function parseVisualBriefFromPayload(
  raw: LlmPlatformContentPayload['visualBrief'],
): VisualBrief | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  if (!isVisualType(raw.visualType)) {
    return undefined;
  }

  return {
    visualType: raw.visualType,
    imagePrompt: raw.imagePrompt?.trim() || undefined,
    videoPrompt: raw.videoPrompt?.trim() || undefined,
    designLayout: raw.designLayout?.trim() || undefined,
    aspectRatio: isAspectRatio(raw.aspectRatio) ? raw.aspectRatio : undefined,
    assetsNeeded: normalizeStringArray(raw.assetsNeeded),
    referenceStyle: raw.referenceStyle?.trim() || undefined,
    overlayText: normalizeStringArray(raw.overlayText),
    notes: raw.notes?.trim() || undefined,
  };
}

function threadsWantsVisual(festival: Record<string, unknown>): boolean {
  const plannerType = resolvePlannerContentType(festival);
  return plannerType === 'guide' || plannerType === 'tips';
}

export function normalizeVisualBrief(
  platform: MarketingPlatform,
  payload: LlmPlatformContentPayload,
  festival: Record<string, unknown>,
): VisualBrief | undefined {
  const parsed = parseVisualBriefFromPayload(payload.visualBrief);

  if (platform === 'x' || platform === 'reddit') {
    return TEXT_ONLY_VISUAL_BRIEF;
  }

  if (platform === 'threads') {
    if (!threadsWantsVisual(festival)) {
      return TEXT_ONLY_VISUAL_BRIEF;
    }
    return {
      visualType: 'single-image',
      aspectRatio: '1:1',
      imagePrompt: parsed?.imagePrompt,
      designLayout: parsed?.designLayout,
      overlayText: parsed?.overlayText,
      assetsNeeded: parsed?.assetsNeeded,
      referenceStyle:
        parsed?.referenceStyle ??
        'Premium dark purple/blue gradient, minimal festival travel, Raven brand',
      notes: parsed?.notes,
    };
  }

  if (platform === 'instagram') {
    const visualType =
      parsed?.visualType === 'single-image' ? 'single-image' : 'carousel';
    return {
      visualType,
      aspectRatio: '4:5',
      imagePrompt: parsed?.imagePrompt,
      designLayout: parsed?.designLayout,
      overlayText: parsed?.overlayText,
      assetsNeeded: parsed?.assetsNeeded,
      referenceStyle:
        parsed?.referenceStyle ??
        'Premium dark purple/blue gradient, minimal festival travel, Raven brand — not nightclub flyer',
      notes: parsed?.notes,
    };
  }

  if (platform === 'tiktok') {
    return {
      visualType: 'short-video',
      aspectRatio: '9:16',
      videoPrompt: parsed?.videoPrompt,
      designLayout: parsed?.designLayout,
      overlayText: parsed?.overlayText,
      assetsNeeded: parsed?.assetsNeeded,
      referenceStyle:
        parsed?.referenceStyle ??
        'Premium dark purple/blue gradient, minimal festival travel, Raven brand',
      notes: parsed?.notes,
    };
  }

  return parsed;
}

type ProcessedContent = Pick<
  PlatformContentResult,
  | 'title'
  | 'content'
  | 'hashtags'
  | 'cta'
  | 'contentStyle'
  | 'notes'
  | 'visualBrief'
  | 'publishTime'
  | 'carousel'
>;

export function applyXPostProcess(
  payload: LlmPlatformContentPayload,
  contentStyle: string,
): ProcessedContent {
  const content = truncateXContent(payload.content?.trim() ?? '');
  const notes: string[] = [];

  if ((payload.content?.trim() ?? '').length > X_MAX_LENGTH) {
    notes.push(`Truncated to ${X_MAX_LENGTH} characters`);
  }
  if (isPromotionalXContent(content)) {
    notes.push('Content flagged as promotional — rewrite recommended');
  }

  return {
    title: '',
    content,
    hashtags: [],
    cta: '',
    contentStyle,
    notes: [payload.notes?.trim(), ...notes].filter(Boolean).join('; '),
    visualBrief: TEXT_ONLY_VISUAL_BRIEF,
  };
}

export function applyDefaultPostProcess(
  payload: LlmPlatformContentPayload,
  contentStyle: string,
  platform: MarketingPlatform,
  festival: Record<string, unknown>,
): ProcessedContent {
  const title = payload.title?.trim() ?? '';
  const content = payload.content?.trim() ?? '';
  const visualBrief = normalizeVisualBrief(platform, payload, festival);

  const instagramFields =
    platform === 'instagram'
      ? buildInstagramPublishingFields(
          payload,
          festival,
          title,
          content,
          visualBrief,
        )
      : {};

  return {
    title,
    content,
    hashtags: normalizeHashtags(payload.hashtags),
    cta: payload.cta?.trim() ?? '',
    contentStyle,
    notes: payload.notes?.trim() ?? '',
    visualBrief,
    ...instagramFields,
  };
}
