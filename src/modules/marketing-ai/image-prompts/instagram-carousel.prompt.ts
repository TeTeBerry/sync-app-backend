import type {
  CarouselSlideAssetInput,
  InstagramAssetRequest,
} from '../marketing-ai-instagram-asset.types';

export const INSTAGRAM_CAROUSEL_IMAGE_SIZE = '720x1280';
const MAX_PROMPT_LENGTH = 500;

export function buildInstagramCarouselImagePrompt(
  input: InstagramAssetRequest,
  slide: CarouselSlideAssetInput,
): string {
  const { festival, brandStyle } = input;
  const overlayText =
    slide.overlayText.length > 0
      ? slide.overlayText.join(', ')
      : [slide.headline, slide.body].filter(Boolean).join(' · ');

  const tail = [
    `${slide.aspectRatio} vertical, mobile readable, negative space, not crowded.`,
    `Avoid: ${brandStyle.avoid.join(', ')}.`,
    'No logos, watermark, or unreadable text.',
  ].join(' ');

  const headParts = [
    `Instagram carousel slide ${slide.slide} for ${festival.name}.`,
    `Brand: ${brandStyle.brandName}, premium AI festival travel planner.`,
    `Slide headline "${slide.headline}", body "${slide.body}", overlay "${overlayText}".`,
    `Visual: ${slide.imageDescription}.`,
    `Style: ${brandStyle.mood}, ${brandStyle.background}, ${brandStyle.colorPalette.join('/')}, ${brandStyle.typography}, ${brandStyle.visualTone.join(', ')}.`,
  ];

  let head = headParts.join(' ');
  const maxHeadLength = Math.max(0, MAX_PROMPT_LENGTH - tail.length - 1);
  if (head.length > maxHeadLength) {
    head = `${head.slice(0, maxHeadLength).trimEnd()}…`;
  }

  return `${head} ${tail}`.slice(0, MAX_PROMPT_LENGTH);
}
