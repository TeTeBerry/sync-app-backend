import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LineupArtistAvatar,
  LineupArtistAvatarDocument,
} from '../../database/schemas/lineup-artist-avatar.schema';
import {
  buildLineupAvatarCloudFileId,
  isLineupAvatarAssetKey,
  isLineupAvatarCloudFileId,
  isStoredLineupAvatarRef,
  isUsableLineupAvatarUrl,
} from './utils/lineup-avatar-ref.util';

@Injectable()
export class LineupArtistAvatarService {
  constructor(
    @InjectModel(LineupArtistAvatar.name)
    private readonly model: Model<LineupArtistAvatarDocument>,
  ) {}

  /** Lineup name key → displayable avatar ref (HTTPS URL or CloudBase fileID). */
  async findAvatarUrlsByArtistNames(
    artistNames: string[],
  ): Promise<Map<string, string>> {
    const keys = [
      ...new Set(
        artistNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (!keys.length) {
      return new Map();
    }

    const rows = await this.model
      .find({ artistNameKey: { $in: keys } })
      .select('artistNameKey avatarUrl source')
      .lean()
      .exec();

    const result = new Map<string, string>();
    for (const row of rows) {
      const ref = this.normalizeAvatarRef(row.avatarUrl, row.source);
      if (ref) {
        result.set(row.artistNameKey, ref);
      }
    }

    return result;
  }

  private normalizeAvatarRef(
    raw: string | undefined,
    source?: string | null,
  ): string {
    const trimmed = raw?.trim() ?? '';
    if (!isStoredLineupAvatarRef(trimmed, source)) {
      return '';
    }
    if (isUsableLineupAvatarUrl(trimmed, source)) {
      return trimmed;
    }
    if (isLineupAvatarCloudFileId(trimmed)) {
      return trimmed;
    }
    if (isLineupAvatarAssetKey(trimmed)) {
      return buildLineupAvatarCloudFileId(
        process.env.CLOUDBASE_ENV_ID ?? '',
        trimmed,
        process.env.CLOUDBASE_STORAGE_BUCKET ?? '',
      );
    }
    return '';
  }
}
