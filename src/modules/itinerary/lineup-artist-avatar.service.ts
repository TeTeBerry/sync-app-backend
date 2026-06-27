import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LineupArtistAvatar,
  LineupArtistAvatarDocument,
} from '../../database/schemas/lineup-artist-avatar.schema';
import { isUsableLineupAvatarUrl } from './utils/lineup-avatar-ref.util';

@Injectable()
export class LineupArtistAvatarService {
  constructor(
    @InjectModel(LineupArtistAvatar.name)
    private readonly model: Model<LineupArtistAvatarDocument>,
  ) {}

  /** Lineup name key → public HTTPS CDN avatar URL. */
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
      const url = row.avatarUrl?.trim();
      if (isUsableLineupAvatarUrl(url, row.source)) {
        result.set(row.artistNameKey, url);
      }
    }

    return result;
  }
}
