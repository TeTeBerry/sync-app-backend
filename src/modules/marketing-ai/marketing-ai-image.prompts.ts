import type { GenerateInstagramAssetsDto } from './dto/generate-instagram-assets.dto';

const RAVEN_INSTAGRAM_STYLE =
  'premium dark background, purple blue gradient, minimal festival travel aesthetic, Raven brand, no nightclub flyer, no crowded poster, no text in image';

export function buildInstagramSlideImagePrompt(
  dto: GenerateInstagramAssetsDto,
  slide: GenerateInstagramAssetsDto['carousel'][number],
): string {
  const festivalName =
    typeof dto.festival.name === 'string' ? dto.festival.name : 'festival';
  const location =
    typeof dto.festival.location === 'string' ? dto.festival.location : '';

  return [
    `Instagram carousel slide ${slide.slide} for ${festivalName}${location ? ` in ${location}` : ''}.`,
    `Visual mood: ${dto.brandStyle || RAVEN_INSTAGRAM_STYLE}.`,
    `Slide headline concept: ${slide.headline}.`,
    `Slide body concept: ${slide.body}.`,
    'Abstract editorial festival travel visual, cinematic lighting, clean composition, no logos, no watermark, no readable text.',
  ]
    .join(' ')
    .slice(0, 500);
}

export const INSTAGRAM_CAROUSEL_IMAGE_SIZE = '720x1280';
