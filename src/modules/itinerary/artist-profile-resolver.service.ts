import { Injectable } from '@nestjs/common';
import { getChineseAliasesForArtistName } from '../dj/dj-chinese-aliases.util';
import { expandFestivalArtistName } from '../dj/lineup-name-match.util';
import { isLineupCatalogProfileTrusted } from '../dj/lineup-catalog-profile-trust.util';
import { DjService } from '../dj/dj.service';
import { buildLineupArtistProfileFallback } from './domain/lineup-artist-data-policy';
import { resolveLineupDisplayGenreFromCatalog } from './domain/lineup-artist-data-policy';
import { LineupArtistAvatarService } from './lineup-artist-avatar.service';
import { buildArtistProfileDetailFromCatalog } from './utils/artist-profile-detail.util';
import { LineupCatalogService } from './lineup-catalog.service';
import type {
  CatalogLineupArtistDetailDto,
  CatalogLineupArtistMemberDetailDto,
} from './itinerary-schedule.types';
import { LINEUP_SEED_GENRE_PLACEHOLDER } from '@src/data/itinerary/lineup-seed-genre.constants';
import type { DjCatalogItem } from '../dj/dj.types';

@Injectable()
export class ArtistProfileResolver {
  constructor(
    private readonly lineupCatalog: LineupCatalogService,
    private readonly djService: DjService,
    private readonly lineupArtistAvatarService: LineupArtistAvatarService,
  ) {}

  async getCatalogLineupArtistDetail(
    id: string,
  ): Promise<CatalogLineupArtistDetailDto> {
    const artist = await this.lineupCatalog.resolveCatalogLineupArtistById(id, {
      requireThumbnail: false,
    });
    const comboParts = expandFestivalArtistName(artist.name);
    if (comboParts.length > 1) {
      return this.buildComboArtistDetail(artist, comboParts);
    }

    return this.buildSoloArtistDetail(artist);
  }

  private isProfileTrusted(
    lineupName: string,
    catalogItem?: DjCatalogItem,
  ): boolean {
    if (!catalogItem) {
      return false;
    }
    return isLineupCatalogProfileTrusted(lineupName, catalogItem);
  }

  private pickProfileDetail(
    lineupName: string,
    catalogItem: DjCatalogItem | undefined,
    displayProfile?: string,
  ) {
    if (!catalogItem || !this.isProfileTrusted(lineupName, catalogItem)) {
      const curated = buildLineupArtistProfileFallback({
        name: lineupName,
        genre: LINEUP_SEED_GENRE_PLACEHOLDER,
        genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
      });
      return {
        profileDetail: buildArtistProfileDetailFromCatalog(undefined),
        representativeTracks: curated.representativeTracks,
      };
    }

    return {
      profileDetail: buildArtistProfileDetailFromCatalog({
        ...catalogItem,
        ...(displayProfile ? { profile: displayProfile } : {}),
      }),
      representativeTracks: [] as string[],
    };
  }

  private pickCatalogExtras(catalogItem?: DjCatalogItem) {
    const country = catalogItem?.country?.trim();
    const profileUrls = catalogItem?.urls?.filter((url) => url.trim()) ?? [];
    return {
      ...(country ? { country } : {}),
      ...(profileUrls.length ? { profileUrls } : {}),
    };
  }

  private async buildSoloArtistDetail(
    artist: CatalogLineupArtistDetailDto,
  ): Promise<CatalogLineupArtistDetailDto> {
    const catalog = await this.djService.lookupForLineupArtists([artist.name]);
    const catalogItem = catalog.get(artist.name);
    const displayProfile = catalogItem
      ? await this.djService.resolveProfileForDisplay(
          catalogItem.discogsId,
          catalogItem.profile,
        )
      : undefined;
    const { profileDetail, representativeTracks: curatedTracks } =
      this.pickProfileDetail(artist.name, catalogItem, displayProfile);
    const profileDetailTracks = profileDetail.representativeTracks;

    return {
      ...artist,
      ...this.pickCatalogExtras(catalogItem),
      ...(catalogItem && this.isProfileTrusted(artist.name, catalogItem)
        ? profileDetail
        : {}),
      ...(profileDetailTracks.length
        ? { representativeTracks: profileDetailTracks }
        : curatedTracks.length
          ? { representativeTracks: curatedTracks }
          : {}),
    };
  }

  private async buildComboArtistDetail(
    artist: CatalogLineupArtistDetailDto,
    parts: string[],
  ): Promise<CatalogLineupArtistDetailDto> {
    const batch = await this.djService.resolveLineupCatalogBatch(parts);
    const avatarUrls =
      await this.lineupArtistAvatarService.findAvatarUrlsByArtistNames(parts);
    const members: CatalogLineupArtistMemberDetailDto[] = [];

    for (const part of parts) {
      const items = batch.catalogByLineupName.has(part)
        ? [batch.catalogByLineupName.get(part)!]
        : [];
      const catalogItem = items[0];
      const displayProfile = catalogItem
        ? await this.djService.resolveProfileForDisplay(
            catalogItem.discogsId,
            catalogItem.profile,
          )
        : undefined;
      const { profileDetail } = this.pickProfileDetail(
        part,
        catalogItem,
        displayProfile,
      );
      const genreDisplay =
        batch.genreDisplayByLineupName.get(part) ??
        resolveLineupDisplayGenreFromCatalog(items);
      const nameKey = part.trim().toLowerCase();
      const thumbnail =
        avatarUrls.get(nameKey) ??
        (catalogItem
          ? avatarUrls.get(catalogItem.name.trim().toLowerCase())
          : undefined);
      const chineseAliases = catalogItem?.chineseAliases?.length
        ? catalogItem.chineseAliases
        : getChineseAliasesForArtistName(part);
      const member: CatalogLineupArtistMemberDetailDto = {
        name: part,
        ...(thumbnail ? { thumbnail } : {}),
        ...(chineseAliases.length ? { chineseAliases } : {}),
        ...(genreDisplay.genre !== LINEUP_SEED_GENRE_PLACEHOLDER
          ? { genre: genreDisplay.genre, genreLabel: genreDisplay.genreLabel }
          : {}),
        ...this.pickCatalogExtras(catalogItem),
        ...(profileDetail.profileSummary
          ? {
              profileSummary: profileDetail.profileSummary,
              profileFull:
                profileDetail.profileFull ?? profileDetail.profileSummary,
            }
          : {}),
        ...(profileDetail.representativeTracks.length
          ? { representativeTracks: profileDetail.representativeTracks }
          : {}),
      };
      members.push(member);
    }

    return {
      ...artist,
      members,
    };
  }
}
