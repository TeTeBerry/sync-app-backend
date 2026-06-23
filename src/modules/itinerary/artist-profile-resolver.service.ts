import { Injectable } from '@nestjs/common';
import { DjService } from '../dj/dj.service';
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

    return {
      ...artist,
      ...profileDetail,
      ...(profileDetail.representativeTracks.length
        ? { representativeTracks: profileDetail.representativeTracks }
        : {}),
    };
  }
}
