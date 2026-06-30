import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { ActivityLookupService } from '../activity/activity-lookup.service';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';
import type { ActivityLookupRecord } from '../activity/ports/activity-lookup.port';
import type { Request } from 'express';

type MusicEvent = Record<string, unknown>;

@Public()
@Controller('public/events')
export class PublicEventController {
  constructor(
    private readonly activityLookup: ActivityLookupService,
    private readonly publicRateLimit: PublicApiRateLimitService,
    private readonly lineupCatalog: LineupCatalogService,
  ) {}

  // ── GET /api/public/events ─────────────────────────────────

  @Get()
  async listEvents(
    @Query('month') month?: string,
    @Query('region') region?: string,
    @Req() req?: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'public_events',
      req ?? ({} as Request),
    );

    const all = await this.activityLookup.findAllBasics();
    const filtered = this.filterActivities(all, { month, region });
    const events = filtered.map((a) => this.toMusicEvent(a));

    const accept = (req?.headers.accept as string) ?? '';
    if (accept.includes('application/ld+json')) {
      return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        numberOfItems: events.length,
        itemListElement: events,
      };
    }
    return events;
  }

  // ── GET /api/public/events/:id.ics ─────────────────────────

  @Get(':legacyId.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async getEventIcs(
    @Param('legacyId') legacyId: string,
    @Req() req?: Request,
  ): Promise<string> {
    await this.publicRateLimit.assertAllowedAsync(
      'public_events',
      req ?? ({} as Request),
    );

    const id = Number(legacyId);
    const activity = await this.activityLookup.findByLegacyId(id);
    if (!activity) throw new NotFoundException('Event not found');

    return this.buildIcs(activity);
  }

  // ── GET /api/public/events/:id ─────────────────────────────

  @Get(':legacyId')
  async getEvent(@Param('legacyId') legacyId: string, @Req() req?: Request) {
    await this.publicRateLimit.assertAllowedAsync(
      'public_events',
      req ?? ({} as Request),
    );

    const id = Number(legacyId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new NotFoundException('Event not found');
    }

    const activity = await this.activityLookup.findByLegacyId(id);
    if (!activity) throw new NotFoundException('Event not found');

    // resolve lineup for the single event
    let performers: Array<{ name: string }> = [];
    if (activity.lineupPublished) {
      const artists = await this.lineupCatalog.listLineupArtistsForActivities([
        id,
      ]);
      performers = artists.map((a) => ({ name: a.artistName }));
    }

    const event = this.toMusicEvent(activity, performers);
    const accept = (req?.headers.accept as string) ?? '';

    if (accept.includes('application/ld+json')) {
      return { '@context': 'https://schema.org', ...event };
    }
    return event;
  }

  // ── filtering ──────────────────────────────────────────────

  private filterActivities(
    activities: ActivityLookupRecord[],
    filters: { month?: string; region?: string },
  ): ActivityLookupRecord[] {
    let result = activities;

    if (filters.month) {
      const m = filters.month.trim();
      const isYearMonth = /^\d{4}-\d{2}$/.test(m);
      const monthNum = Number.parseInt(m, 10);
      if (isYearMonth || (monthNum >= 1 && monthNum <= 12)) {
        result = result.filter((a) => {
          const date = a.date?.trim();
          if (!date) return false;
          if (isYearMonth) return date.startsWith(m);
          const activityMonth = Number.parseInt(date.split('-')[1] ?? '', 10);
          return activityMonth === monthNum;
        });
      }
    }

    if (filters.region) {
      const r = filters.region.trim().toLowerCase();
      result = result.filter((a) => {
        const region = (a.region ?? '').toLowerCase();
        const area = (a.area ?? '').toLowerCase();
        if (r === 'domestic' || r === 'overseas' || r === 'hmt') {
          return region === r;
        }
        return area.includes(r) || region.includes(r);
      });
    }

    return result;
  }

  // ── schema.org MusicEvent mapping ──────────────────────────

  private toMusicEvent(
    a: ActivityLookupRecord,
    performers: Array<{ name: string }> = [],
  ): MusicEvent {
    const endDate = this.resolveEndDate(a.date);

    return {
      '@type': 'MusicEvent',
      name: a.name,
      startDate: a.date ?? '',
      ...(endDate ? { endDate } : {}),
      description: this.buildDescription(a),
      location: {
        '@type': 'Place',
        name: a.location ?? a.area ?? '',
        ...(a.latitude != null && a.longitude
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: a.latitude,
                longitude: a.longitude,
              },
            }
          : {}),
      },
      ...(a.image ? { image: a.image } : {}),
      ...(performers.length
        ? {
            performer: performers.map((p) => ({
              '@type': 'MusicGroup',
              name: p.name,
            })),
          }
        : {}),
      ...(a.externalUrl
        ? {
            offers: {
              '@type': 'Offer',
              url: a.externalUrl,
              availability: 'https://schema.org/InStock',
            },
          }
        : {}),
      url: `https://sync.fun/event/${a.legacyId}`,
      eventStatus: a.lineupPublished
        ? 'https://schema.org/EventScheduled'
        : 'https://schema.org/EventPostponed',
      organizer: {
        '@type': 'Organization',
        name: a.infoSource ?? 'SYNC',
        url: 'https://sync.fun',
      },
    };
  }

  // ── helpers ────────────────────────────────────────────────

  private buildDescription(a: ActivityLookupRecord): string {
    const parts: string[] = [];
    if (a.location) parts.push(`📍 ${a.location}`);
    if (a.area) parts.push(`🌍 ${a.area}`);
    if (a.activityType) {
      parts.push(`🎵 ${a.activityType === 'festival' ? '电音节' : '室内电音'}`);
    }
    if (a.lineupPublished) parts.push('阵容已官宣');
    if (a.recruitPostCount) {
      parts.push(`${a.recruitPostCount} 条组队招募帖`);
    }
    parts.push('平台仅提供资讯，不售票');
    return parts.join(' · ');
  }

  private resolveEndDate(date?: string): string {
    if (!date?.trim()) return '';
    const parts = date.split(/[~～]/);
    return parts.length === 2 && parts[1].trim() ? parts[1].trim() : '';
  }

  // ── ICS ────────────────────────────────────────────────────

  private buildIcs(activity: ActivityLookupRecord): string {
    const uid = `sync-${activity.legacyId}@sync.fun`;
    const dtstart = (activity.date ?? '').replace(/-/g, '');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SYNC//SYNC Events//CN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${dtstart}`,
      `SUMMARY:${activity.name ?? 'SYNC Event'}`,
      `LOCATION:${activity.location ?? ''}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }
}
