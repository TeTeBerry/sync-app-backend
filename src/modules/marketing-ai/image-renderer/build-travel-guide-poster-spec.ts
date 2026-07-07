import type { InstagramAssetRequest } from '../marketing-ai-instagram-asset.types';
import { resolveCountryFlagEmoji } from './country-flag.util';
import {
  DEFAULT_POSTER_SIZE_ID,
  isPosterSizeId,
  resolvePosterSize,
} from './poster-size.presets';
import type { PosterSizeId } from './poster-size.presets';
import type { TravelGuidePosterSpec } from './travel-guide-poster.types';

const POSTER_COPY = {
  sectionTitle: 'Festival Travel Guide',
  guideItems: [
    {
      icon: '🏨',
      label: 'STAY',
      subtitle: 'Hotels & best areas near the festival',
    },
    {
      icon: '✈️',
      label: 'TRAVEL',
      subtitle: 'Flights · Transport · Planning',
    },
    {
      icon: '💰',
      label: 'BUDGET',
      subtitle: 'Estimated trip cost guide',
    },
  ],
  follow: 'FOLLOW @RAVEN',
  tagline: "Your guide to the world's best festivals",
  taglineIcon: '🌎',
} as const;

function formatPosterDates(
  festival: InstagramAssetRequest['festival'],
): string {
  if (festival.startDate && festival.endDate) {
    const start = new Date(`${festival.startDate}T00:00:00Z`);
    const end = new Date(`${festival.endDate}T00:00:00Z`);
    const year = start.getUTCFullYear();
    const startMonth = start.toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
    const endMonth = end.toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getUTCDate()}–${end.getUTCDate()}, ${year}`;
    }

    return `${startMonth} ${start.getUTCDate()}–${endMonth} ${end.getUTCDate()}, ${year}`;
  }

  return festival.dates?.trim() ?? '';
}

function formatLocationLine(
  festival: InstagramAssetRequest['festival'],
): string {
  const location = [festival.venue?.trim(), festival.location?.trim()]
    .filter(Boolean)
    .join(', ');
  return location ? location : '';
}

function formatDateLine(festival: InstagramAssetRequest['festival']): string {
  return formatPosterDates(festival);
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

export function buildTravelGuidePosterSpec(
  input: InstagramAssetRequest,
): TravelGuidePosterSpec {
  const festival = input.festival;
  const titleFlag = resolveCountryFlagEmoji(festival.country) || undefined;

  return {
    title: festival.name.trim(),
    titleFlag,
    sectionTitle: POSTER_COPY.sectionTitle,
    locationLine: formatLocationLine(festival),
    dateLine: formatDateLine(festival),
    guideItems: POSTER_COPY.guideItems.map((item) => ({ ...item })),
    follow: POSTER_COPY.follow,
    tagline: POSTER_COPY.tagline,
    taglineIcon: POSTER_COPY.taglineIcon,
    size: resolvePosterSize(resolvePosterSizeId(input)),
  };
}

export function buildTravelGuideRendererLabel(
  spec: TravelGuidePosterSpec,
): string {
  return `travel-guide-poster-${spec.size.id}-${spec.size.width}x${spec.size.height}: ${spec.title}`;
}
