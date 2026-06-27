import { Injectable } from '@nestjs/common';
import { getChineseAliasesForArtistName } from '../dj/dj-chinese-aliases.util';
import { expandFestivalArtistName } from '../dj/lineup-name-match.util';
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

  private async buildComboArtistDetail(
    artist: CatalogLineupArtistDetailDto,
    parts: string[],
  ): Promise<CatalogLineupArtistDetailDto> {
    const catalog = await this.djService.loadCatalog();
    const avatarUrls =
      await this.lineupArtistAvatarService.findAvatarUrlsByArtistNames(parts);
    const members: CatalogLineupArtistMemberDetailDto[] = [];

    for (const part of parts) {
      const items = this.djService.collectTrustedCatalogItemsForLineupName(
        part,
        catalog,
      );
      const catalogItem = items[0];
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
      const genreDisplay = resolveLineupDisplayGenreFromCatalog(items);
      const seedFallback = catalogItem
        ? undefined
        : buildLineupArtistProfileFallback({
            name: part,
            genre: artist.genre,
            genreLabel: artist.genreLabel,
          });
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
        ...(profileDetail.profileSummary
          ? {
              profileSummary: profileDetail.profileSummary,
              profileFull:
                profileDetail.profileFull ?? profileDetail.profileSummary,
            }
          : seedFallback?.profileSummary
            ? {
                profileSummary: seedFallback.profileSummary,
                profileFull:
                  seedFallback.profileFull ?? seedFallback.profileSummary,
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
