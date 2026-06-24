import { Injectable } from '@nestjs/common';
import { DjService } from '../dj/dj.service';
import { buildLineupArtistProfileFallback } from './domain/lineup-artist-data-policy';
import { buildArtistProfileDetailFromCatalog } from './utils/artist-profile-detail.util';
import { LineupCatalogService } from './lineup-catalog.service';
import type { CatalogLineupArtistDetailDto } from './itinerary-schedule.types';

@Injectable()
export class ArtistProfileResolver {
  constructor(
    private readonly lineupCatalog: LineupCatalogService,
    private readonly djService: DjService,
  ) {}

  async getCatalogLineupArtistDetail(
    id: string,
  ): Promise<CatalogLineupArtistDetailDto> {
    const artist = await this.lineupCatalog.resolveCatalogLineupArtistById(id, {
      requireThumbnail: false,
    });
    const catalog = await this.djService.lookupForLineupArtists([artist.name]);
    const catalogItem = catalog.get(artist.name);
    const displayProfile = catalogItem
      ? await this.djService.resolveProfileForDisplay(
          catalogItem.discogsId,
          catalogItem.profile,
        )
      : undefined;
    const profileDetail = buildArtistProfileDetailFromCatalog(
      catalogItem
        ? {
            ...catalogItem,
            ...(displayProfile ? { profile: displayProfile } : {}),
          }
        : undefined,
    );
    const seedFallback = catalogItem
      ? { representativeTracks: [] as string[] }
      : buildLineupArtistProfileFallback(artist);
    const representativeTracks =
      profileDetail.representativeTracks.length > 0
        ? profileDetail.representativeTracks
        : seedFallback.representativeTracks;

    return {
      ...artist,
      ...(catalogItem
        ? profileDetail
        : {
            ...(seedFallback.profileSummary
              ? {
                  profileSummary: seedFallback.profileSummary,
                  profileFull:
                    seedFallback.profileFull ?? seedFallback.profileSummary,
                }
              : {}),
          }),
      ...(representativeTracks.length ? { representativeTracks } : {}),
    };
  }
}
