import type { InstagramAssetRequest } from '../marketing-ai-instagram-asset.types';
import {
  DEFAULT_POSTER_SIZE_ID,
  isPosterSizeId,
  resolvePosterSize,
} from './poster-size.presets';
import type { PosterSizeId } from './poster-size.presets';
import type { PosterContentSection, PosterSpec } from './poster.types';

function buildFestivalMeta(
  festival: InstagramAssetRequest['festival'],
): string {
  const locationLine = [festival.location, festival.country]
    .filter(Boolean)
    .join(', ');

  return [locationLine, festival.dates].filter(Boolean).join(' · ');
}

function resolvePosterSizeId(input: InstagramAssetRequest): PosterSizeId {
  if (input.outputSize && isPosterSizeId(input.outputSize)) {
    return input.outputSize;
  }

  const firstSlide = input.carousel[0];
  if (firstSlide && isPosterSizeId(firstSlide.aspectRatio)) {
    return firstSlide.aspectRatio;
  }

  return DEFAULT_POSTER_SIZE_ID;
}

function buildPosterSections(
  input: InstagramAssetRequest,
): PosterContentSection[] {
  const festivalName = input.festival.name.trim().toLowerCase();

  return input.carousel
    .slice()
    .sort((left, right) => left.slide - right.slide)
    .map((slide) => ({
      headline: slide.headline.trim(),
      body: slide.body.trim(),
    }))
    .filter((section) => section.headline || section.body)
    .filter((section, index) => {
      if (index !== 0) {
        return true;
      }

      const headline = section.headline.toLowerCase();
      if (headline === festivalName) {
        return Boolean(section.body);
      }

      return true;
    })
    .map((section, index) => {
      if (index !== 0) {
        return section;
      }

      if (section.headline.toLowerCase() === festivalName) {
        return {
          headline: section.body,
          body: '',
        };
      }

      return section;
    })
    .filter((section) => section.headline || section.body);
}

export function buildPosterSpec(input: InstagramAssetRequest): PosterSpec {
  return {
    festivalName: input.festival.name.trim(),
    festivalMeta: buildFestivalMeta(input.festival),
    topic: input.publishingPackage.topic.trim(),
    genres: input.festival.genres ?? [],
    artists: (input.festival.artists ?? []).slice(0, 4),
    sections: buildPosterSections(input),
    brandName: input.brandStyle.brandName,
    tagline: 'Festival travel planner',
    size: resolvePosterSize(resolvePosterSizeId(input)),
  };
}

export function buildPosterRendererLabel(spec: PosterSpec): string {
  return `poster-sync-web-${spec.size.id}-${spec.size.width}x${spec.size.height}: ${spec.festivalName}`;
}
