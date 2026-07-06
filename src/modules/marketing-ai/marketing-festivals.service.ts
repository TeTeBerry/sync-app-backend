import { Inject, Injectable } from '@nestjs/common';
import {
  compareActivityDateAsc,
  extractYearFromText,
  isActivityEnded,
  parseActivityDateRange,
} from '../../common/utils/activity-date.util';
import { findHotActivityProfile } from '@src/data/travel-guide/travel-guide-hot-path.data';
import {
  ACTIVITY_LOOKUP_PORT,
  type ActivityLookupRecord,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';
import type { MarketingFestivalDto } from './marketing-festival.types';

const AREA_COUNTRY_EN: Record<string, string> = {
  泰国: 'Thailand',
  荷兰: 'Netherlands',
  韩国: 'South Korea',
  日本: 'Japan',
  中国: 'China',
  比利时: 'Belgium',
  罗马尼亚: 'Romania',
  英国: 'United Kingdom',
  阿联酋: 'United Arab Emirates',
  美国: 'United States',
  沙特: 'Saudi Arabia',
  克罗地亚: 'Croatia',
};

const DEFAULT_GENRES = ['EDM'];
const HEADLINE_ARTIST_LIMIT = 6;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveCountry(activity: ActivityLookupRecord): string {
  const area = activity.area?.trim();
  if (!area) {
    return activity.region === 'overseas' ? 'International' : 'China';
  }
  return AREA_COUNTRY_EN[area] ?? area;
}

function splitLocationAndVenue(activity: ActivityLookupRecord): {
  location: string;
  venue: string;
} {
  const hotVenue = findHotActivityProfile(
    activity.legacyId,
  )?.venue.title?.trim();
  const raw = activity.location?.trim() ?? '';

  if (!raw) {
    return { location: '', venue: hotVenue ?? '' };
  }

  const dotParts = raw
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  if (dotParts.length >= 2) {
    return {
      location: dotParts[0],
      venue: hotVenue ?? dotParts.slice(1).join(' · '),
    };
  }

  const latinVenue = raw.match(/([A-Za-z][\w\s&.'-]+)$/);
  if (latinVenue) {
    const venue = latinVenue[1].trim();
    const city = raw.slice(0, raw.length - venue.length).trim();
    return {
      location: city || raw,
      venue: hotVenue ?? venue,
    };
  }

  return {
    location: raw,
    venue: hotVenue ?? raw,
  };
}

function buildFestivalId(activity: ActivityLookupRecord): string {
  const year =
    extractYearFromText(activity.name) ??
    extractYearFromText(activity.date) ??
    String(new Date().getFullYear());
  return `${activity.code}-${year}`;
}

function buildDescription(activity: ActivityLookupRecord): string {
  const { location } = splitLocationAndVenue(activity);
  const place = location || activity.area || 'TBA';
  if (activity.lineupPublished) {
    return `${activity.name} in ${place} — lineup announced, official timetable may still be pending.`;
  }
  return `${activity.name} in ${place} — on the Raven festival calendar.`;
}

function resolvePriority(activity: ActivityLookupRecord): number {
  if (activity.hot) {
    return 100;
  }
  if (typeof activity.attendees === 'number' && activity.attendees > 0) {
    return Math.min(90, 50 + Math.floor(activity.attendees / 100));
  }
  return 50;
}

function isUpcomingFestival(
  activity: ActivityLookupRecord,
  now = new Date(),
): boolean {
  if (activity.activityType === 'indoor') {
    return false;
  }
  if (!activity.date?.trim()) {
    return true;
  }
  const yearHint = extractYearFromText(activity.name);
  return !isActivityEnded(activity.date, { yearHint, now });
}

@Injectable()
export class MarketingFestivalsService {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly lineupCatalog: LineupCatalogService,
  ) {}

  async listUpcomingFestivals(
    now = new Date(),
  ): Promise<MarketingFestivalDto[]> {
    const activities = await this.activityLookup.findAllBasics();
    const upcoming = activities
      .filter((activity) => isUpcomingFestival(activity, now))
      .sort(compareActivityDateAsc);

    const festivals: MarketingFestivalDto[] = [];
    for (const activity of upcoming) {
      const yearHint = extractYearFromText(activity.name);
      const parsed = activity.date?.trim()
        ? parseActivityDateRange(activity.date, yearHint)
        : null;
      if (!parsed) {
        continue;
      }

      const lineupArtists =
        await this.lineupCatalog.listLineupArtistsForActivities([
          activity.legacyId,
        ]);
      const { location, venue } = splitLocationAndVenue(activity);

      festivals.push({
        activityLegacyId: activity.legacyId,
        id: buildFestivalId(activity),
        name: activity.name,
        venue,
        location,
        country: resolveCountry(activity),
        startDate: toIsoDate(parsed.start),
        endDate: toIsoDate(parsed.end),
        genres: [...DEFAULT_GENRES],
        headlineArtists: lineupArtists
          .slice(0, HEADLINE_ARTIST_LIMIT)
          .map((artist) => ({
            name: artist.artistName,
            genreLabel: artist.genreLabel,
          })),
        lineupSchedulePublished: Boolean(activity.lineupPublished),
        description: buildDescription(activity),
        priority: resolvePriority(activity),
        ticketUrl: activity.externalUrl?.trim() || undefined,
        websiteUrl: activity.infoSource?.trim() || undefined,
      });
    }

    return festivals;
  }
}
