import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudStorageService } from '../../infra/cloud/cloud-storage.service';
import {
  LineupArtistAvatar,
  LineupArtistAvatarDocument,
} from '../../database/schemas/lineup-artist-avatar.schema';
import {
  assertLineupAvatarCloudFileIdForEnv,
  buildLineupAvatarCloudFileId,
  isLineupAvatarAssetKey,
} from './utils/lineup-avatar-ref.util';

@Injectable()
export class LineupArtistAvatarService {
  private readonly logger = new Logger(LineupArtistAvatarService.name);

  constructor(
    @InjectModel(LineupArtistAvatar.name)
    private readonly model: Model<LineupArtistAvatarDocument>,
    private readonly cloudStorage: CloudStorageService,
    private readonly config: ConfigService,
  ) {}

  /** Lineup name key → CloudBase HTTPS temp URL for artist avatars. */
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
      .select('artistNameKey avatarUrl')
      .lean()
      .exec();

    const envId = this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    const bucket =
      this.config.get<string>('cloudbase.storageBucket')?.trim() ?? '';
    if (!envId) {
      this.logger.warn('cloudbase.envId not set; lineup avatars omitted');
      return new Map();
    }

    const cloudEntries: Array<{ artistNameKey: string; fileId: string }> = [];
    for (const row of rows) {
      const assetKey = row.avatarUrl?.trim();
      if (!isLineupAvatarAssetKey(assetKey)) {
        continue;
      }
      const fileId = buildLineupAvatarCloudFileId(envId, assetKey, bucket);
      if (fileId) {
        cloudEntries.push({ artistNameKey: row.artistNameKey, fileId });
      }
    }

    if (!cloudEntries.length) {
      return new Map();
    }

    const result = new Map<string, string>();
    try {
      const fileIds = cloudEntries.map((entry) => entry.fileId);
      const downloads = await this.cloudStorage.fetchCloudFileDownloadUrls(
        fileIds,
        (fileId) => assertLineupAvatarCloudFileIdForEnv(fileId),
        '无法读取阵容艺人头像',
      );
      cloudEntries.forEach((entry, index) => {
        const downloadUrl = downloads[index]?.trim();
        if (downloadUrl) {
          result.set(entry.artistNameKey, downloadUrl);
        }
      });
    } catch (error) {
      this.logger.warn(
        `lineup avatar cloud resolve failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return result;
  }
}
